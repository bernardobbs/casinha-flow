-- ============================================================================
-- Ações que o assistente de IA pode executar, no modelo "propor -> confirmar
-- -> executar": o modelo chama uma função ai_propor_* que resolve nomes pra
-- IDs, valida o que dá pra validar sem chutar, e grava uma linha pendente em
-- ai_pending_actions com um resumo pronto pra mostrar ao usuário. Só quando
-- o usuário confirma numa mensagem seguinte é que ai_executar_acao roda de
-- verdade — nada é escrito no banco de dados real da família na hora da
-- proposta.
--
-- Seguem o mesmo padrão de auth de registrar_abastecimento (auth.role() !=
-- 'service_role'): quando chamadas pela edge function (que já validou o
-- usuário e a família antes de expor a ferramenta ao modelo) o guard é
-- pulado; quando chamadas direto do app autenticado, continua exigindo que
-- o usuário pertença à família informada.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  user_id uuid,
  tipo text NOT NULL CHECK (tipo IN ('transacao', 'estoque', 'abastecimento')),
  payload jsonb NOT NULL,
  resumo text NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'executada', 'cancelada')),
  resultado jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz
);
ALTER TABLE public.ai_pending_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own family ai_pending_actions" ON public.ai_pending_actions
  FOR SELECT USING (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "Insert own family ai_pending_actions" ON public.ai_pending_actions
  FOR INSERT WITH CHECK (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "Update own family ai_pending_actions" ON public.ai_pending_actions
  FOR UPDATE USING (family_id = public.get_user_family_id(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_family_status
  ON public.ai_pending_actions(family_id, status);

-- ============================================================================
-- match_transaction_to_bill precisava do bypass de service_role também —
-- hoje ela só é chamada do app autenticado, mas ai_executar_acao (chamada
-- pela edge function, sem sessão de usuário) precisa poder chamá-la depois
-- de lançar uma transação vinda de uma ação de IA confirmada.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.match_transaction_to_bill(p_transaction_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tx public.transactions%ROWTYPE;
  v_tipo text;
  v_valor numeric;
  v_data date;
  v_bill_id uuid;
  v_family uuid;
BEGIN
  SELECT * INTO v_tx FROM public.transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF auth.role() != 'service_role' THEN
    v_family := public.get_user_family_id(auth.uid());
    IF v_family IS DISTINCT FROM v_tx.family_id THEN
      RAISE EXCEPTION 'Não autorizado';
    END IF;
  END IF;

  v_tipo := COALESCE(v_tx.tipo, v_tx.type);
  v_valor := COALESCE(v_tx.valor, v_tx.amount);
  v_data := COALESCE(v_tx.data, v_tx.date);

  IF v_tipo NOT IN ('despesa', 'expense') OR v_valor IS NULL OR v_data IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT br.id INTO v_bill_id
  FROM public.bills_reminders br
  WHERE br.family_id = v_tx.family_id
    AND br.status = 'pendente'
    AND br.credit_card_bill_id IS NULL
    AND br.transaction_id IS NULL
    AND (br.account_id IS NULL OR br.account_id = v_tx.account_id)
    AND COALESCE(br.valor, br.valor_estimado) = v_valor
    AND br.data_vencimento BETWEEN (v_data - INTERVAL '5 days') AND (v_data + INTERVAL '5 days')
  ORDER BY ABS(br.data_vencimento - v_data)
  LIMIT 1;

  IF v_bill_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.bills_reminders
  SET status = 'pago',
      transaction_id = p_transaction_id,
      valor = v_valor,
      account_id = COALESCE(account_id, v_tx.account_id)
  WHERE id = v_bill_id;

  RETURN v_bill_id;
END;
$$;

-- ============================================================================
-- ai_propor_transacao — resolve categoria/conta por nome, checa duplicata
-- (mesma lógica de find_possible_duplicate_transaction) e grava a proposta.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ai_propor_transacao(
  p_family_id uuid,
  p_user_id uuid,
  p_descricao text,
  p_valor numeric,
  p_tipo text,
  p_categoria_nome text DEFAULT NULL,
  p_conta_nome text DEFAULT NULL,
  p_data date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_family uuid;
  v_category_id uuid;
  v_category_nome text;
  v_account_id uuid;
  v_account_nome text;
  v_dup_id uuid;
  v_action_id uuid;
  v_resumo text;
  v_aviso text := NULL;
BEGIN
  IF auth.role() != 'service_role' THEN
    v_family := public.get_user_family_id(auth.uid());
    IF v_family IS NULL OR v_family != p_family_id THEN
      RAISE EXCEPTION 'Acesso negado';
    END IF;
  END IF;

  IF p_tipo NOT IN ('despesa', 'receita') THEN
    RETURN jsonb_build_object('erro', 'tipo deve ser "despesa" ou "receita"');
  END IF;
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RETURN jsonb_build_object('erro', 'valor deve ser maior que zero');
  END IF;
  IF p_descricao IS NULL OR trim(p_descricao) = '' THEN
    RETURN jsonb_build_object('erro', 'descricao obrigatoria');
  END IF;

  IF p_categoria_nome IS NOT NULL THEN
    SELECT id, nome INTO v_category_id, v_category_nome FROM categories
      WHERE family_id = p_family_id AND tipo = p_tipo AND nome ILIKE '%' || p_categoria_nome || '%'
      ORDER BY nome LIMIT 1;
  END IF;

  IF p_conta_nome IS NOT NULL THEN
    SELECT id, nome INTO v_account_id, v_account_nome FROM accounts
      WHERE family_id = p_family_id AND ativo = true AND nome ILIKE '%' || p_conta_nome || '%'
      ORDER BY nome LIMIT 1;
  ELSE
    SELECT id, nome INTO v_account_id, v_account_nome FROM accounts
      WHERE family_id = p_family_id AND ativo = true AND tipo <> 'cartao'
      ORDER BY created_at LIMIT 1;
  END IF;

  SELECT t.id INTO v_dup_id
  FROM transactions t
  WHERE t.family_id = p_family_id
    AND (v_account_id IS NULL OR t.account_id = v_account_id)
    AND COALESCE(t.data, t.date) = p_data
    AND COALESCE(t.valor, t.amount) = p_valor
    AND CASE COALESCE(t.tipo, t.type)
          WHEN 'expense' THEN 'despesa' WHEN 'income' THEN 'receita'
          ELSE COALESCE(t.tipo, t.type)
        END = p_tipo
    AND lower(trim(COALESCE(t.descricao, t.description))) = lower(trim(p_descricao))
  LIMIT 1;
  IF v_dup_id IS NOT NULL THEN
    v_aviso := 'Já existe um lançamento igual a este na mesma data — confirme com o usuário se ele realmente quer duplicar antes de propor executar.';
  END IF;

  v_resumo := format('%s de R$ %s — "%s"%s%s',
    CASE WHEN p_tipo = 'despesa' THEN 'Despesa' ELSE 'Receita' END,
    to_char(p_valor, 'FM999999990.00'), p_descricao,
    CASE WHEN v_category_nome IS NOT NULL THEN ' | categoria: ' || v_category_nome ELSE ' | sem categoria' END,
    CASE WHEN v_account_nome IS NOT NULL THEN ' | conta: ' || v_account_nome ELSE ' | sem conta definida' END
  );

  INSERT INTO ai_pending_actions (family_id, user_id, tipo, payload, resumo)
  VALUES (p_family_id, p_user_id, 'transacao', jsonb_build_object(
    'descricao', p_descricao, 'valor', p_valor, 'tipo', p_tipo,
    'category_id', v_category_id, 'account_id', v_account_id, 'data', p_data
  ), v_resumo)
  RETURNING id INTO v_action_id;

  RETURN jsonb_build_object(
    'action_id', v_action_id, 'resumo', v_resumo, 'aviso', v_aviso,
    'categoria_encontrada', v_category_nome, 'conta_encontrada', v_account_nome
  );
END;
$$;

-- ============================================================================
-- ai_propor_estoque — resolve produto por nome; se houver mais de um match
-- (ex: duas marcas do mesmo item), devolve as opções em vez de chutar qual.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ai_propor_estoque(
  p_family_id uuid,
  p_user_id uuid,
  p_produto_nome text,
  p_quantidade numeric,
  p_operacao text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_family uuid;
  v_matches jsonb;
  v_count int;
  v_product_id uuid;
  v_nome text;
  v_estoque_atual numeric;
  v_unidade text;
  v_novo_valor numeric;
  v_action_id uuid;
  v_resumo text;
BEGIN
  IF auth.role() != 'service_role' THEN
    v_family := public.get_user_family_id(auth.uid());
    IF v_family IS NULL OR v_family != p_family_id THEN
      RAISE EXCEPTION 'Acesso negado';
    END IF;
  END IF;

  IF p_operacao NOT IN ('definir', 'adicionar', 'remover') THEN
    RETURN jsonb_build_object('erro', 'operacao deve ser "definir", "adicionar" ou "remover"');
  END IF;
  IF p_quantidade IS NULL OR p_quantidade < 0 THEN
    RETURN jsonb_build_object('erro', 'quantidade invalida');
  END IF;

  SELECT count(*) INTO v_count FROM products
  WHERE family_id = p_family_id AND ativo = true AND nome ILIKE '%' || p_produto_nome || '%'
    AND (parent_id IS NOT NULL OR NOT EXISTS (
      SELECT 1 FROM products c WHERE c.parent_id = products.id AND c.ativo = true
    ));

  IF v_count = 0 THEN
    RETURN jsonb_build_object('erro', 'Nenhum produto encontrado com esse nome no catalogo.');
  END IF;

  IF v_count > 1 THEN
    SELECT jsonb_agg(jsonb_build_object('nome', nome, 'estoque_atual', estoque_atual, 'unidade', unidade))
    INTO v_matches
    FROM products
    WHERE family_id = p_family_id AND ativo = true AND nome ILIKE '%' || p_produto_nome || '%'
      AND (parent_id IS NOT NULL OR NOT EXISTS (
        SELECT 1 FROM products c WHERE c.parent_id = products.id AND c.ativo = true
      ));
    RETURN jsonb_build_object(
      'erro', 'Mais de um produto encontrado com esse nome — peça ao usuário pra especificar a marca.',
      'opcoes', v_matches
    );
  END IF;

  SELECT id, nome, estoque_atual, unidade INTO v_product_id, v_nome, v_estoque_atual, v_unidade
  FROM products
  WHERE family_id = p_family_id AND ativo = true AND nome ILIKE '%' || p_produto_nome || '%'
    AND (parent_id IS NOT NULL OR NOT EXISTS (
      SELECT 1 FROM products c WHERE c.parent_id = products.id AND c.ativo = true
    ))
  LIMIT 1;

  v_novo_valor := CASE p_operacao
    WHEN 'definir' THEN p_quantidade
    WHEN 'adicionar' THEN v_estoque_atual + p_quantidade
    WHEN 'remover' THEN GREATEST(v_estoque_atual - p_quantidade, 0)
  END;

  v_resumo := format('%s: %s %s → %s %s', v_nome, v_estoque_atual, v_unidade, v_novo_valor, v_unidade);

  INSERT INTO ai_pending_actions (family_id, user_id, tipo, payload, resumo)
  VALUES (p_family_id, p_user_id, 'estoque', jsonb_build_object(
    'product_id', v_product_id, 'nome', v_nome,
    'valor_anterior', v_estoque_atual, 'valor_novo', v_novo_valor, 'unidade', v_unidade
  ), v_resumo)
  RETURNING id INTO v_action_id;

  RETURN jsonb_build_object('action_id', v_action_id, 'resumo', v_resumo);
END;
$$;

-- ============================================================================
-- ai_propor_abastecimento — resolve veículo por apelido, conta/categoria
-- padrão; delega a execução real pra registrar_abastecimento (já testada).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ai_propor_abastecimento(
  p_family_id uuid,
  p_user_id uuid,
  p_veiculo_apelido text,
  p_litros numeric,
  p_valor_pago numeric,
  p_hodometro numeric,
  p_preco_litro numeric DEFAULT NULL,
  p_combustivel_usado text DEFAULT NULL,
  p_tanque_cheio boolean DEFAULT true,
  p_posto text DEFAULT NULL,
  p_data date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_family uuid;
  v_vehicle_id uuid;
  v_apelido text;
  v_combustivel text;
  v_tipo_veic text;
  v_account_id uuid;
  v_category_id uuid;
  v_preco_litro numeric;
  v_action_id uuid;
  v_resumo text;
BEGIN
  IF auth.role() != 'service_role' THEN
    v_family := public.get_user_family_id(auth.uid());
    IF v_family IS NULL OR v_family != p_family_id THEN
      RAISE EXCEPTION 'Acesso negado';
    END IF;
  END IF;

  SELECT id, apelido, combustivel, tipo INTO v_vehicle_id, v_apelido, v_combustivel, v_tipo_veic
  FROM vehicles WHERE family_id = p_family_id AND ativo = true AND apelido ILIKE '%' || p_veiculo_apelido || '%'
  LIMIT 1;
  IF v_vehicle_id IS NULL THEN
    RETURN jsonb_build_object('erro', 'Veiculo nao encontrado com esse apelido.');
  END IF;

  IF p_litros IS NULL OR p_litros <= 0 OR p_valor_pago IS NULL OR p_valor_pago <= 0 OR p_hodometro IS NULL THEN
    RETURN jsonb_build_object('erro', 'Informe litros, valor pago e hodometro (todos maiores que zero).');
  END IF;

  v_preco_litro := COALESCE(p_preco_litro, ROUND(p_valor_pago / p_litros, 3));

  SELECT id INTO v_account_id FROM accounts
    WHERE family_id = p_family_id AND ativo = true AND tipo <> 'cartao' ORDER BY created_at LIMIT 1;

  SELECT id INTO v_category_id FROM categories
    WHERE family_id = p_family_id AND tipo = 'despesa' AND nome ILIKE '%gasolina%'
      AND (v_tipo_veic IS NULL OR nome ILIKE '%' || v_tipo_veic || '%')
    LIMIT 1;
  IF v_category_id IS NULL THEN
    SELECT id INTO v_category_id FROM categories
      WHERE family_id = p_family_id AND tipo = 'despesa' AND nome ILIKE '%gasolina%' LIMIT 1;
  END IF;

  v_resumo := format('Abastecimento %s: %s L a R$ %s/L = R$ %s | hodometro %s km%s',
    v_apelido, p_litros, v_preco_litro, p_valor_pago, p_hodometro,
    CASE WHEN p_posto IS NOT NULL THEN ' | ' || p_posto ELSE '' END);

  INSERT INTO ai_pending_actions (family_id, user_id, tipo, payload, resumo)
  VALUES (p_family_id, p_user_id, 'abastecimento', jsonb_build_object(
    'vehicle_id', v_vehicle_id, 'account_id', v_account_id, 'category_id', v_category_id,
    'data', p_data, 'valor_pago', p_valor_pago, 'preco_litro', v_preco_litro,
    'litros', p_litros, 'hodometro', p_hodometro,
    'combustivel_usado', COALESCE(p_combustivel_usado, v_combustivel, 'gasolina'),
    'posto', p_posto, 'tanque_cheio', p_tanque_cheio
  ), v_resumo)
  RETURNING id INTO v_action_id;

  RETURN jsonb_build_object('action_id', v_action_id, 'resumo', v_resumo,
    'conta_encontrada', v_account_id IS NOT NULL, 'categoria_encontrada', v_category_id IS NOT NULL);
END;
$$;

-- ============================================================================
-- ai_executar_acao — só roda depois de confirmação explícita do usuário
-- (decidido pelo modelo, no turno seguinte à proposta). Idempotente: uma
-- ação já executada ou cancelada não roda de novo.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ai_executar_acao(p_family_id uuid, p_user_id uuid, p_action_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_family uuid;
  v_action ai_pending_actions%ROWTYPE;
  v_tx_id uuid;
  v_result jsonb;
BEGIN
  IF auth.role() != 'service_role' THEN
    v_family := public.get_user_family_id(auth.uid());
    IF v_family IS NULL OR v_family != p_family_id THEN
      RAISE EXCEPTION 'Acesso negado';
    END IF;
  END IF;

  SELECT * INTO v_action FROM ai_pending_actions WHERE id = p_action_id AND family_id = p_family_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('erro', 'Acao nao encontrada.');
  END IF;
  IF v_action.status != 'pendente' THEN
    RETURN jsonb_build_object('erro', format('Essa acao ja foi %s anteriormente.', v_action.status));
  END IF;

  IF v_action.tipo = 'transacao' THEN
    INSERT INTO transactions (
      family_id, user_id, account_id, category_id, description, descricao,
      amount, valor, type, tipo, date, data, source, tipo_especial, is_essencial
    ) VALUES (
      p_family_id, p_user_id,
      (v_action.payload->>'account_id')::uuid, (v_action.payload->>'category_id')::uuid,
      v_action.payload->>'descricao', v_action.payload->>'descricao',
      (v_action.payload->>'valor')::numeric, (v_action.payload->>'valor')::numeric,
      CASE v_action.payload->>'tipo' WHEN 'despesa' THEN 'expense' ELSE 'income' END,
      v_action.payload->>'tipo',
      (v_action.payload->>'data')::date, (v_action.payload->>'data')::date,
      'manual', 'normal', false
    ) RETURNING id INTO v_tx_id;

    IF (v_action.payload->>'account_id') IS NOT NULL THEN
      PERFORM recalc_account_balance((v_action.payload->>'account_id')::uuid);
    END IF;
    IF v_action.payload->>'tipo' = 'despesa' THEN
      PERFORM match_transaction_to_bill(v_tx_id);
    END IF;

    v_result := jsonb_build_object('transaction_id', v_tx_id);

  ELSIF v_action.tipo = 'estoque' THEN
    UPDATE products SET estoque_atual = (v_action.payload->>'valor_novo')::numeric
    WHERE id = (v_action.payload->>'product_id')::uuid;

    INSERT INTO stock_movements (product_id, family_id, quantidade, tipo, origem, motivo)
    VALUES (
      (v_action.payload->>'product_id')::uuid, p_family_id,
      ABS((v_action.payload->>'valor_novo')::numeric - (v_action.payload->>'valor_anterior')::numeric),
      CASE WHEN (v_action.payload->>'valor_novo')::numeric >= (v_action.payload->>'valor_anterior')::numeric
        THEN 'entrada' ELSE 'saida' END,
      'manual', 'Ajuste via assistente IA'
    );

    PERFORM recalcular_consumo_estoque((v_action.payload->>'product_id')::uuid);

    v_result := jsonb_build_object(
      'product_id', v_action.payload->>'product_id',
      'novo_estoque', v_action.payload->>'valor_novo'
    );

  ELSIF v_action.tipo = 'abastecimento' THEN
    v_result := registrar_abastecimento(
      p_family_id, p_user_id,
      (v_action.payload->>'vehicle_id')::uuid, (v_action.payload->>'account_id')::uuid,
      (v_action.payload->>'category_id')::uuid, (v_action.payload->>'data')::date,
      (v_action.payload->>'valor_pago')::numeric, (v_action.payload->>'preco_litro')::numeric,
      (v_action.payload->>'litros')::numeric, (v_action.payload->>'hodometro')::numeric,
      v_action.payload->>'combustivel_usado', v_action.payload->>'posto',
      (v_action.payload->>'tanque_cheio')::boolean
    );
  ELSE
    RETURN jsonb_build_object('erro', 'Tipo de acao desconhecido.');
  END IF;

  UPDATE ai_pending_actions SET status = 'executada', resultado = v_result, executed_at = now()
  WHERE id = p_action_id;

  RETURN jsonb_build_object('sucesso', true, 'resumo', v_action.resumo, 'resultado', v_result);
END;
$$;

-- ============================================================================
-- ai_cancelar_acao
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ai_cancelar_acao(p_family_id uuid, p_action_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_family uuid;
  v_updated int;
BEGIN
  IF auth.role() != 'service_role' THEN
    v_family := public.get_user_family_id(auth.uid());
    IF v_family IS NULL OR v_family != p_family_id THEN
      RAISE EXCEPTION 'Acesso negado';
    END IF;
  END IF;

  UPDATE ai_pending_actions SET status = 'cancelada'
  WHERE id = p_action_id AND family_id = p_family_id AND status = 'pendente';
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN jsonb_build_object('erro', 'Acao nao encontrada ou ja processada.');
  END IF;
  RETURN jsonb_build_object('sucesso', true);
END;
$$;
