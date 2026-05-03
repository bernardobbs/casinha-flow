
-- =========================================================
-- PARTE 1: family_settings
-- =========================================================
CREATE TABLE public.family_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  chave text NOT NULL,
  valor text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_id, chave)
);
CREATE INDEX idx_family_settings_family ON public.family_settings(family_id);
ALTER TABLE public.family_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own family settings" ON public.family_settings
  FOR SELECT USING (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "Insert own family settings" ON public.family_settings
  FOR INSERT WITH CHECK (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "Update own family settings" ON public.family_settings
  FOR UPDATE USING (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "Delete own family settings" ON public.family_settings
  FOR DELETE USING (family_id = public.get_user_family_id(auth.uid()));

CREATE TRIGGER trg_family_settings_updated
  BEFORE UPDATE ON public.family_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- PARTE 2: accounts + credit_card_bills
-- =========================================================
CREATE TYPE public.account_type AS ENUM ('corrente','poupanca','carteira','cartao','investimento');
CREATE TYPE public.credit_card_bill_status AS ENUM ('aberta','fechada','paga');

CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  nome text NOT NULL,
  tipo public.account_type NOT NULL DEFAULT 'corrente',
  saldo_inicial numeric(14,2) NOT NULL DEFAULT 0,
  saldo_atual numeric(14,2) NOT NULL DEFAULT 0,
  cor text NOT NULL DEFAULT '#3b82f6',
  icone text NOT NULL DEFAULT '🏦',
  ativo boolean NOT NULL DEFAULT true,
  limite_credito numeric(14,2),
  dia_fechamento smallint,
  dia_vencimento smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_accounts_family ON public.accounts(family_id);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own family accounts" ON public.accounts
  FOR SELECT USING (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "Insert own family accounts" ON public.accounts
  FOR INSERT WITH CHECK (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "Update own family accounts" ON public.accounts
  FOR UPDATE USING (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "Delete own family accounts" ON public.accounts
  FOR DELETE USING (family_id = public.get_user_family_id(auth.uid()));

CREATE TRIGGER trg_accounts_updated
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.credit_card_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  family_id uuid NOT NULL,
  mes_referencia date NOT NULL,
  valor_total numeric(14,2) NOT NULL DEFAULT 0,
  valor_pago numeric(14,2) NOT NULL DEFAULT 0,
  data_vencimento date,
  status public.credit_card_bill_status NOT NULL DEFAULT 'aberta',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, mes_referencia)
);
CREATE INDEX idx_ccb_family ON public.credit_card_bills(family_id);
CREATE INDEX idx_ccb_account ON public.credit_card_bills(account_id);
ALTER TABLE public.credit_card_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own family bills" ON public.credit_card_bills
  FOR SELECT USING (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "Insert own family bills" ON public.credit_card_bills
  FOR INSERT WITH CHECK (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "Update own family bills" ON public.credit_card_bills
  FOR UPDATE USING (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "Delete own family bills" ON public.credit_card_bills
  FOR DELETE USING (family_id = public.get_user_family_id(auth.uid()));

CREATE TRIGGER trg_ccb_updated
  BEFORE UPDATE ON public.credit_card_bills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- ALTER transactions: account_id + tipo_especial
-- =========================================================
CREATE TYPE public.transaction_special_type AS ENUM ('normal','transferencia','pagamento_fatura');

ALTER TABLE public.transactions
  ADD COLUMN account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  ADD COLUMN tipo_especial public.transaction_special_type NOT NULL DEFAULT 'normal';

CREATE INDEX idx_transactions_account ON public.transactions(account_id);
CREATE INDEX idx_transactions_tipo_especial ON public.transactions(tipo_especial);

-- =========================================================
-- PARTE 3: categorization_rules
-- =========================================================
CREATE TYPE public.categorization_origin AS ENUM ('manual','ia','keyword');

CREATE TABLE public.categorization_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  termo text NOT NULL,
  termo_normalizado text NOT NULL,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  origem public.categorization_origin NOT NULL DEFAULT 'manual',
  confianca numeric(3,2) NOT NULL DEFAULT 1.0,
  usos integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_id, termo_normalizado)
);
CREATE INDEX idx_catrules_family ON public.categorization_rules(family_id);
CREATE INDEX idx_catrules_norm ON public.categorization_rules(family_id, termo_normalizado);
ALTER TABLE public.categorization_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own family rules" ON public.categorization_rules
  FOR SELECT USING (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "Insert own family rules" ON public.categorization_rules
  FOR INSERT WITH CHECK (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "Update own family rules" ON public.categorization_rules
  FOR UPDATE USING (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "Delete own family rules" ON public.categorization_rules
  FOR DELETE USING (family_id = public.get_user_family_id(auth.uid()));

CREATE TRIGGER trg_catrules_updated
  BEFORE UPDATE ON public.categorization_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Função: normalizar texto
-- =========================================================
CREATE OR REPLACE FUNCTION public.normalize_text(_t text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(
    translate(
      coalesce(_t,''),
      'áàâãäéèêëíìîïóòôõöúùûüýÿçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÝÇÑ',
      'aaaaaeeeeiiiiooooouuuuyycnaaaaaeeeeiiiioooooUUUUYCN'
    )
  );
$$;

-- =========================================================
-- Função: seed default keywords
-- =========================================================
CREATE OR REPLACE FUNCTION public.seed_default_categorization_keywords(_family_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_cat_id uuid;
  pairs CONSTANT text[][] := ARRAY[
    ['Alimentação','mercado'],['Alimentação','supermercado'],['Alimentação','hortifruti'],
    ['Alimentação','acougue'],['Alimentação','padaria'],['Alimentação','mateus'],
    ['Alimentação','carvalho'],['Alimentação','atacadao'],['Alimentação','restaurante'],
    ['Alimentação','lanche'],['Alimentação','ifood'],['Alimentação','delivery'],
    ['Alimentação','churrascaria'],
    ['Transporte','posto'],['Transporte','shell'],['Transporte','ipiranga'],
    ['Transporte','petrobras'],['Transporte','gasolina'],['Transporte','etanol'],
    ['Transporte','uber'],['Transporte','99'],['Transporte','taxi'],
    ['Transporte','estacionamento'],['Transporte','parking'],
    ['Saúde','farmacia'],['Saúde','drogaria'],['Saúde','pague menos'],
    ['Saúde','drogasil'],['Saúde','medico'],['Saúde','consulta'],
    ['Saúde','exame'],['Saúde','hospital'],['Saúde','unimed'],
    ['Moradia','aluguel'],['Moradia','energia'],['Moradia','agua'],
    ['Moradia','internet'],['Moradia','celular'],['Moradia','gas'],
    ['Moradia','condominio'],['Moradia','vivo'],['Moradia','claro'],
    ['Moradia','tim'],['Moradia','oi'],
    ['Educação','escola'],['Educação','faculdade'],['Educação','curso'],
    ['Educação','mensalidade'],['Educação','livro'],['Educação','vestibular'],
    ['Educação','intellectus'],
    ['Dívidas','parcela'],['Dívidas','financiamento'],['Dívidas','emprestimo'],
    ['Dívidas','banco'],['Dívidas','juros'],['Dívidas','iof'],
    ['Assinaturas','netflix'],['Assinaturas','spotify'],['Assinaturas','amazon'],
    ['Assinaturas','apple'],['Assinaturas','youtube'],['Assinaturas','disney'],
    ['Assinaturas','hbo'],['Assinaturas','bytedance'],['Assinaturas','tiktok']
  ];
  i int;
BEGIN
  FOR i IN 1 .. array_length(pairs,1) LOOP
    SELECT id INTO v_cat_id FROM public.categories
      WHERE family_id = _family_id AND nome = pairs[i][1] LIMIT 1;
    IF v_cat_id IS NOT NULL THEN
      INSERT INTO public.categorization_rules
        (family_id, termo, termo_normalizado, category_id, origem, confianca, usos)
      VALUES
        (_family_id, pairs[i][2], public.normalize_text(pairs[i][2]), v_cat_id, 'keyword', 0.8, 0)
      ON CONFLICT (family_id, termo_normalizado) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- =========================================================
-- Função: categorize_transaction (3 níveis)
-- =========================================================
CREATE OR REPLACE FUNCTION public.categorize_transaction(_family_id uuid, _description text)
RETURNS TABLE(
  category_id uuid,
  origem public.categorization_origin,
  confianca numeric,
  nivel int,
  auto_apply boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text := public.normalize_text(_description);
  v_rule RECORD;
BEGIN
  IF public.get_user_family_id(auth.uid()) IS DISTINCT FROM _family_id THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;
  IF coalesce(v_norm,'') = '' THEN
    RETURN;
  END IF;

  -- Nível 1: match exato
  SELECT r.category_id, r.origem, r.confianca INTO v_rule
  FROM public.categorization_rules r
  WHERE r.family_id = _family_id AND r.termo_normalizado = v_norm
  ORDER BY r.confianca DESC, r.usos DESC LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT v_rule.category_id, v_rule.origem, v_rule.confianca, 1,
      (v_rule.confianca >= 0.8);
    RETURN;
  END IF;

  -- Nível 2: match parcial (descrição contém termo aprendido)
  SELECT r.category_id, r.origem, r.confianca INTO v_rule
  FROM public.categorization_rules r
  WHERE r.family_id = _family_id
    AND r.origem IN ('manual','ia')
    AND length(r.termo_normalizado) >= 3
    AND v_norm LIKE '%' || r.termo_normalizado || '%'
  ORDER BY r.confianca DESC, length(r.termo_normalizado) DESC, r.usos DESC
  LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT v_rule.category_id, v_rule.origem, v_rule.confianca, 2, false;
    RETURN;
  END IF;

  -- Nível 3: keywords fixas
  SELECT r.category_id, r.origem, r.confianca INTO v_rule
  FROM public.categorization_rules r
  WHERE r.family_id = _family_id
    AND r.origem = 'keyword'
    AND length(r.termo_normalizado) >= 3
    AND v_norm LIKE '%' || r.termo_normalizado || '%'
  ORDER BY length(r.termo_normalizado) DESC LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT v_rule.category_id, v_rule.origem, v_rule.confianca, 3, false;
    RETURN;
  END IF;
END;
$$;

-- =========================================================
-- Função: learn_categorization_rule
-- =========================================================
CREATE OR REPLACE FUNCTION public.learn_categorization_rule(
  _family_id uuid,
  _termo text,
  _category_id uuid,
  _origem public.categorization_origin DEFAULT 'manual'
)
RETURNS public.categorization_rules
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text := public.normalize_text(_termo);
  v_conf numeric := CASE _origem
    WHEN 'manual' THEN 1.0
    WHEN 'ia' THEN 0.6
    WHEN 'keyword' THEN 0.8 END;
  v_row public.categorization_rules;
BEGIN
  IF public.get_user_family_id(auth.uid()) IS DISTINCT FROM _family_id THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;
  IF coalesce(v_norm,'') = '' THEN
    RAISE EXCEPTION 'Termo vazio';
  END IF;

  INSERT INTO public.categorization_rules
    (family_id, termo, termo_normalizado, category_id, origem, confianca, usos)
  VALUES
    (_family_id, _termo, v_norm, _category_id, _origem, v_conf, 1)
  ON CONFLICT (family_id, termo_normalizado) DO UPDATE
    SET category_id = EXCLUDED.category_id,
        origem = CASE
          WHEN public.categorization_rules.origem = 'manual' OR EXCLUDED.origem = 'manual'
            THEN 'manual'::public.categorization_origin
          ELSE EXCLUDED.origem
        END,
        confianca = LEAST(1.0,
          CASE
            WHEN EXCLUDED.origem = 'manual' THEN 1.0
            WHEN public.categorization_rules.usos + 1 >= 3 THEN 1.0
            ELSE GREATEST(public.categorization_rules.confianca, EXCLUDED.confianca)
          END),
        usos = public.categorization_rules.usos + 1,
        updated_at = now()
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

-- =========================================================
-- Atualizar handle_new_user para popular keywords
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_family_id UUID;
  user_full_name TEXT;
  family_name TEXT;
BEGIN
  user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  family_name := COALESCE(NEW.raw_user_meta_data->>'family_name', 'Família ' || user_full_name);

  INSERT INTO public.families (name, created_by) VALUES (family_name, NEW.id)
    RETURNING id INTO new_family_id;
  INSERT INTO public.profiles (id, full_name, email, family_id)
    VALUES (NEW.id, user_full_name, NEW.email, new_family_id);
  INSERT INTO public.family_members (family_id, user_id, role)
    VALUES (new_family_id, NEW.id, 'admin');

  PERFORM public.seed_default_categories(new_family_id);
  PERFORM public.seed_default_categorization_keywords(new_family_id);
  RETURN NEW;
END;
$$;

-- =========================================================
-- Atualizar recalc_financial_state: ignorar transferencias e pagamento_fatura
-- =========================================================
CREATE OR REPLACE FUNCTION public.recalc_financial_state(_family_id uuid, _mes date, _renda numeric DEFAULT NULL::numeric)
RETURNS public.financial_state
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _start DATE := date_trunc('month', _mes)::date;
  _end   DATE := (date_trunc('month', _mes) + INTERVAL '1 month')::date;
  v_essenciais NUMERIC(14,2) := 0;
  v_dividas    NUMERIC(14,2) := 0;
  v_estilo     NUMERIC(14,2) := 0;
  v_renda_tx   NUMERIC(14,2) := 0;
  v_row        public.financial_state;
BEGIN
  IF public.get_user_family_id(auth.uid()) IS DISTINCT FROM _family_id THEN
    RAISE EXCEPTION 'Não autorizado para esta família';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_dividas
  FROM public.transactions
  WHERE family_id = _family_id AND type = 'expense'
    AND tipo_especial = 'normal'
    AND date >= _start AND date < _end
    AND ( category = 'Dívidas' OR category_id IN (
      SELECT id FROM public.categories WHERE family_id = _family_id AND nome = 'Dívidas'));

  SELECT COALESCE(SUM(amount), 0) INTO v_essenciais
  FROM public.transactions t
  WHERE t.family_id = _family_id AND t.type = 'expense'
    AND t.tipo_especial = 'normal'
    AND t.date >= _start AND t.date < _end
    AND ( t.is_essencial = true OR t.category_id IN (
      SELECT id FROM public.categories WHERE family_id = _family_id AND is_essencial = true))
    AND COALESCE(t.category,'') <> 'Dívidas'
    AND ( t.category_id IS NULL OR t.category_id NOT IN (
      SELECT id FROM public.categories WHERE family_id = _family_id AND nome = 'Dívidas'));

  SELECT COALESCE(SUM(amount), 0) INTO v_estilo
  FROM public.transactions t
  WHERE t.family_id = _family_id AND t.type = 'expense'
    AND t.tipo_especial = 'normal'
    AND t.date >= _start AND t.date < _end
    AND COALESCE(t.is_essencial, false) = false
    AND ( t.category_id IS NULL OR t.category_id NOT IN (
      SELECT id FROM public.categories WHERE family_id = _family_id
        AND (is_essencial = true OR nome = 'Dívidas')))
    AND COALESCE(t.category,'') <> 'Dívidas';

  SELECT COALESCE(SUM(amount), 0) INTO v_renda_tx
  FROM public.transactions
  WHERE family_id = _family_id AND type = 'income'
    AND tipo_especial = 'normal'
    AND date >= _start AND date < _end;

  INSERT INTO public.financial_state (
    family_id, mes, renda_mensal,
    total_essenciais, total_dividas, total_estilo_vida,
    saldo_atual, meta_essenciais, meta_estilo_vida, meta_reserva
  ) VALUES (
    _family_id, _start, COALESCE(_renda, v_renda_tx),
    v_essenciais, v_dividas, v_estilo,
    COALESCE(_renda, v_renda_tx) - v_essenciais - v_dividas - v_estilo,
    COALESCE(_renda, v_renda_tx) * 0.50,
    COALESCE(_renda, v_renda_tx) * 0.30,
    COALESCE(_renda, v_renda_tx) * 0.20
  )
  ON CONFLICT (family_id, mes) DO UPDATE SET
    renda_mensal      = COALESCE(_renda, public.financial_state.renda_mensal),
    total_essenciais  = EXCLUDED.total_essenciais,
    total_dividas     = EXCLUDED.total_dividas,
    total_estilo_vida = EXCLUDED.total_estilo_vida,
    saldo_atual       = COALESCE(_renda, public.financial_state.renda_mensal)
                        - EXCLUDED.total_essenciais - EXCLUDED.total_dividas - EXCLUDED.total_estilo_vida,
    meta_essenciais   = COALESCE(_renda, public.financial_state.renda_mensal) * 0.50,
    meta_estilo_vida  = COALESCE(_renda, public.financial_state.renda_mensal) * 0.30,
    meta_reserva      = COALESCE(_renda, public.financial_state.renda_mensal) * 0.20,
    updated_at        = now()
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

-- =========================================================
-- Função: recalc account balance
-- =========================================================
CREATE OR REPLACE FUNCTION public.recalc_account_balance(_account_id uuid)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acc public.accounts;
  v_in numeric := 0;
  v_out numeric := 0;
  v_saldo numeric := 0;
BEGIN
  SELECT * INTO v_acc FROM public.accounts WHERE id = _account_id;
  IF v_acc IS NULL THEN RETURN 0; END IF;
  IF public.get_user_family_id(auth.uid()) IS DISTINCT FROM v_acc.family_id THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  SELECT COALESCE(SUM(amount),0) INTO v_in FROM public.transactions
    WHERE account_id = _account_id AND type = 'income';
  SELECT COALESCE(SUM(amount),0) INTO v_out FROM public.transactions
    WHERE account_id = _account_id AND type = 'expense';

  v_saldo := v_acc.saldo_inicial + v_in - v_out;
  UPDATE public.accounts SET saldo_atual = v_saldo, updated_at = now()
    WHERE id = _account_id;
  RETURN v_saldo;
END;
$$;

-- Seed keywords para famílias existentes
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.families LOOP
    PERFORM public.seed_default_categorization_keywords(r.id);
  END LOOP;
END $$;
