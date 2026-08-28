-- finalizar_compra e get_previsao_estoque ainda liam/escreviam na coluna
-- legada products.quantidade_atual (do schema original) em vez da coluna
-- atual products.estoque_atual, que é a que /estoque, v_stock_status e o
-- resto do app realmente usam. Consequência prática: concluir uma lista de
-- compras não atualizava o estoque visível, e o Assistente IA sempre lia
-- estoque zerado (COALESCE(quantidade_atual, 0) — coluna nunca escrita por
-- nenhum fluxo atual). Também troca recalc_consumo_medio (opera em
-- consumo_medio_diario, não lido por ninguém) por recalcular_consumo_estoque
-- (opera em consumo_diario_medio, a coluna real).

CREATE OR REPLACE FUNCTION public.finalizar_compra(
  p_list_id uuid, p_family_id uuid, p_user_id uuid,
  p_account_id uuid, p_category_id uuid, p_data date DEFAULT CURRENT_DATE
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric := 0;
  v_transaction_id uuid;
  v_item record;
  v_novo_estoque numeric;
  v_count_estoque int := 0;
  v_count_items int := 0;
BEGIN
  -- Calcular total real da lista
  SELECT COALESCE(SUM(
    COALESCE(preco_real, preco_estimado, 0) * COALESCE(quantidade, 1)
  ), 0) INTO v_total
  FROM shopping_items
  WHERE list_id = p_list_id AND comprado = true;

  -- 1. Criar transação financeira
  INSERT INTO transactions (
    family_id, user_id, account_id, category_id,
    description, amount, type, source, scope,
    date, tipo_especial, conciliado
  )
  SELECT
    p_family_id, p_user_id, p_account_id, p_category_id,
    'Compra — ' || sl.nome,
    -v_total, 'expense', 'compras', 'family',
    p_data, 'normal', false
  FROM shopping_lists sl WHERE sl.id = p_list_id
  RETURNING id INTO v_transaction_id;

  -- Atualizar conta
  PERFORM recalc_account_balance(p_account_id);

  -- 2. Para cada item comprado com product_id: atualizar estoque
  FOR v_item IN
    SELECT si.*, p.estoque_atual, p.custo_medio, p.nome as produto_nome
    FROM shopping_items si
    LEFT JOIN products p ON p.id = si.product_id
    WHERE si.list_id = p_list_id
      AND si.comprado = true
      AND si.product_id IS NOT NULL
  LOOP
    v_novo_estoque := COALESCE(v_item.estoque_atual, 0) + COALESCE(v_item.quantidade, 1);

    -- Atualizar produto
    UPDATE products SET
      estoque_atual = v_novo_estoque,
      preco_ultima_compra = COALESCE(v_item.preco_real, v_item.preco_estimado),
      custo_medio = CASE
        WHEN custo_medio IS NULL THEN COALESCE(v_item.preco_real, v_item.preco_estimado)
        ELSE ROUND((custo_medio + COALESCE(v_item.preco_real, v_item.preco_estimado)) / 2, 4)
      END,
      data_ultima_compra = p_data,
      ultima_revisao = p_data
    WHERE id = v_item.product_id;

    -- Se o produto é uma variante de marca ("filho"), recalcula o total da
    -- mãe como soma dos filhos — mesma regra usada em estoque.tsx e no
    -- endpoint do Hermes. Sem efeito (WHERE não bate nada) se não tiver mãe.
    UPDATE products mae SET estoque_atual = (
      SELECT COALESCE(SUM(f.estoque_atual), 0) FROM products f
      WHERE f.parent_id = mae.id AND f.ativo = true
    )
    WHERE mae.id = (SELECT parent_id FROM products WHERE id = v_item.product_id);

    -- Registrar movimentação de estoque
    INSERT INTO stock_movements (
      product_id, family_id, user_id,
      tipo, quantidade, preco_unitario,
      origem, shopping_list_id, shopping_item_id,
      transaction_id, data
    ) VALUES (
      v_item.product_id, p_family_id, p_user_id,
      'entrada', v_item.quantidade,
      COALESCE(v_item.preco_real, v_item.preco_estimado),
      'compra', p_list_id, v_item.id,
      v_transaction_id, p_data
    );

    -- Recalcular consumo médio (função atual — opera em estoque_atual/consumo_diario_medio)
    PERFORM recalcular_consumo_estoque(v_item.product_id);

    -- Marcar item como estoque atualizado
    UPDATE shopping_items SET estoque_atualizado = true WHERE id = v_item.id;

    v_count_estoque := v_count_estoque + 1;
  END LOOP;

  -- 3. Contar itens totais comprados
  SELECT count(*) INTO v_count_items FROM shopping_items
  WHERE list_id = p_list_id AND comprado = true;

  -- 4. Marcar lista como concluída e vincular transação
  UPDATE shopping_lists SET
    status = 'concluida',
    total_real = v_total,
    transaction_id = v_transaction_id,
    account_id = p_account_id,
    category_id = p_category_id,
    updated_at = now()
  WHERE id = p_list_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'total', v_total,
    'itens_comprados', v_count_items,
    'estoque_atualizado', v_count_estoque
  );
END;
$function$;

-- Nomes de saída (quantidade_atual, consumo_medio_diario) mantidos por
-- compatibilidade com quem já lê o resultado (src/routes/assistente.tsx) —
-- só a fonte interna dos dados muda pra coluna real.
CREATE OR REPLACE FUNCTION public.get_previsao_estoque(p_family_id uuid)
 RETURNS TABLE(product_id uuid, nome text, categoria text, quantidade_atual numeric, unidade text, consumo_medio_diario numeric, dias_restantes integer, previsao_reposicao date, estoque_minimo numeric, status_estoque text, custo_medio numeric)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.nome, p.categoria,
    COALESCE(p.estoque_atual, 0),
    p.unidade,
    COALESCE(p.consumo_diario_medio, 0),
    CASE WHEN COALESCE(p.consumo_diario_medio, 0) > 0
      THEN (COALESCE(p.estoque_atual, 0) / p.consumo_diario_medio)::int
      ELSE NULL END,
    CASE WHEN COALESCE(p.consumo_diario_medio, 0) > 0
      THEN CURRENT_DATE + ((COALESCE(p.estoque_atual, 0) / p.consumo_diario_medio)::int)
      ELSE NULL END,
    COALESCE(p.estoque_minimo, 0),
    CASE
      WHEN COALESCE(p.estoque_atual, 0) = 0 THEN 'zerado'
      WHEN COALESCE(p.estoque_atual, 0) <= COALESCE(p.estoque_minimo, 0) THEN 'critico'
      WHEN COALESCE(p.consumo_diario_medio, 0) > 0
        AND (COALESCE(p.estoque_atual, 0) / p.consumo_diario_medio) <= 7 THEN 'baixo'
      ELSE 'ok'
    END,
    p.custo_medio
  FROM products p
  WHERE p.family_id = p_family_id AND p.ativo = true
  ORDER BY
    CASE
      WHEN COALESCE(p.estoque_atual, 0) = 0 THEN 0
      WHEN COALESCE(p.estoque_atual, 0) <= COALESCE(p.estoque_minimo, 0) THEN 1
      WHEN COALESCE(p.consumo_diario_medio, 0) > 0
        AND (COALESCE(p.estoque_atual, 0) / p.consumo_diario_medio) <= 7 THEN 2
      ELSE 3
    END,
    p.nome;
END;
$function$;
