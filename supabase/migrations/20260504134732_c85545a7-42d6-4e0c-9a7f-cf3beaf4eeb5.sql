-- Tabela bills_reminders (contas a pagar)
CREATE TABLE IF NOT EXISTS public.bills_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  user_id uuid,
  descricao text NOT NULL,
  valor numeric(14,2) NOT NULL,
  data_vencimento date NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  account_id uuid,
  category_id uuid,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bills_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own family bills_reminders" ON public.bills_reminders
  FOR SELECT USING (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "Insert own family bills_reminders" ON public.bills_reminders
  FOR INSERT WITH CHECK (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "Update own family bills_reminders" ON public.bills_reminders
  FOR UPDATE USING (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "Delete own family bills_reminders" ON public.bills_reminders
  FOR DELETE USING (family_id = public.get_user_family_id(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_bills_reminders_family_venc
  ON public.bills_reminders(family_id, data_vencimento) WHERE status = 'pendente';

CREATE TRIGGER bills_reminders_set_updated_at
  BEFORE UPDATE ON public.bills_reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC: get_saldo_total (soma saldo_atual das contas ativas, exclui cartão pois é dívida)
CREATE OR REPLACE FUNCTION public.get_saldo_total(p_family_id uuid)
RETURNS TABLE(saldo_total numeric, saldo_contas numeric, divida_cartoes numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.get_user_family_id(auth.uid()) IS DISTINCT FROM p_family_id THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN tipo <> 'cartao' THEN saldo_atual ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN tipo = 'cartao' THEN GREATEST(-saldo_atual, 0) ELSE 0 END), 0) AS saldo_total,
    COALESCE(SUM(CASE WHEN tipo <> 'cartao' THEN saldo_atual ELSE 0 END), 0) AS saldo_contas,
    COALESCE(SUM(CASE WHEN tipo = 'cartao' THEN GREATEST(-saldo_atual, 0) ELSE 0 END), 0) AS divida_cartoes
  FROM public.accounts
  WHERE family_id = p_family_id AND ativo = true;
END;
$$;

-- RPC: get_dashboard_summary (resumo financeiro do mês com projeção linear + score)
CREATE OR REPLACE FUNCTION public.get_dashboard_summary(p_family_id uuid)
RETURNS TABLE(
  mes date, dia_atual int, dias_mes int,
  renda_mensal numeric, total_essenciais numeric, total_dividas numeric,
  total_estilo_vida numeric, saldo_atual numeric, saldo_projetado numeric,
  meta_essenciais numeric, meta_estilo_vida numeric, meta_reserva numeric,
  modo_crise boolean, estagio_crise smallint, score int, score_label text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_state public.financial_state;
  v_start date := date_trunc('month', CURRENT_DATE)::date;
  v_dias_mes int := EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day'))::int;
  v_dia_atual int := EXTRACT(DAY FROM CURRENT_DATE)::int;
  v_estagio smallint;
  v_gasto numeric;
  v_proj numeric;
  v_score int := 0;
  v_orc_estourados int := 0;
BEGIN
  IF public.get_user_family_id(auth.uid()) IS DISTINCT FROM p_family_id THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  SELECT * INTO v_state FROM public.financial_state
   WHERE family_id = p_family_id AND public.financial_state.mes = v_start;
  IF v_state IS NULL THEN
    v_state := public.recalc_financial_state(p_family_id, v_start, NULL);
  END IF;

  SELECT estagio_atual INTO v_estagio FROM public.crisis_events
   WHERE family_id = p_family_id AND ativo = true LIMIT 1;

  v_gasto := v_state.total_essenciais + v_state.total_dividas + v_state.total_estilo_vida;
  v_proj := CASE WHEN v_dia_atual > 0 THEN (v_gasto / v_dia_atual) * v_dias_mes ELSE v_gasto END;

  -- Score composto
  -- 30pt: saldo projetado positivo
  IF (v_state.renda_mensal - v_proj) > 0 THEN v_score := v_score + 30; END IF;
  -- 25pt: reserva >= essenciais
  IF v_state.total_reserva >= v_state.total_essenciais AND v_state.total_essenciais > 0 THEN
    v_score := v_score + 25;
  END IF;
  -- 25pt: dívidas <= 30% renda
  IF v_state.renda_mensal > 0 AND v_state.total_dividas <= (v_state.renda_mensal * 0.30) THEN
    v_score := v_score + 25;
  END IF;
  -- 20pt: nenhum orçamento estourado
  SELECT COUNT(*) INTO v_orc_estourados FROM public.get_budget_status(p_family_id, v_start)
    WHERE status_cor = 'red';
  IF v_orc_estourados = 0 THEN v_score := v_score + 20; END IF;

  -- Modo crise limita score a 40
  IF COALESCE(v_state.modo_crise, false) THEN
    v_score := LEAST(v_score, 40);
  END IF;

  RETURN QUERY SELECT
    v_start, v_dia_atual, v_dias_mes,
    v_state.renda_mensal, v_state.total_essenciais, v_state.total_dividas,
    v_state.total_estilo_vida, v_state.saldo_atual, (v_state.renda_mensal - v_proj),
    v_state.meta_essenciais, v_state.meta_estilo_vida, v_state.meta_reserva,
    COALESCE(v_state.modo_crise, false), v_estagio, v_score,
    (CASE WHEN v_score >= 71 THEN 'Saudável'
          WHEN v_score >= 41 THEN 'Atenção'
          ELSE 'Crítico' END)::text;
END;
$$;

-- RPC: get_projecao_categorias (gasto atual + projeção linear por categoria com orçamento)
CREATE OR REPLACE FUNCTION public.get_projecao_categorias(p_family_id uuid)
RETURNS TABLE(
  category_id uuid, nome text, cor text, icone text, is_essencial boolean,
  valor_planejado numeric, valor_gasto numeric, valor_projetado numeric,
  pct_atingido numeric, status_proj text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_start date := date_trunc('month', CURRENT_DATE)::date;
  v_dias_mes int := EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day'))::int;
  v_dia_atual int := GREATEST(EXTRACT(DAY FROM CURRENT_DATE)::int, 1);
BEGIN
  IF public.get_user_family_id(auth.uid()) IS DISTINCT FROM p_family_id THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  RETURN QUERY
  SELECT
    c.id, c.nome, c.cor, c.icone, c.is_essencial,
    COALESCE(b.valor_planejado, 0) AS valor_planejado,
    COALESCE(g.gasto, 0) AS valor_gasto,
    ROUND((COALESCE(g.gasto, 0) / v_dia_atual) * v_dias_mes, 2) AS valor_projetado,
    CASE WHEN COALESCE(b.valor_planejado, 0) > 0
      THEN ROUND((COALESCE(g.gasto, 0) / b.valor_planejado) * 100, 2)
      ELSE 0 END AS pct_atingido,
    CASE
      WHEN COALESCE(b.valor_planejado, 0) <= 0 THEN 'sem_orcamento'
      WHEN ROUND((COALESCE(g.gasto, 0) / v_dia_atual) * v_dias_mes, 2) > b.valor_planejado THEN 'vai_estourar'
      WHEN ROUND((COALESCE(g.gasto, 0) / v_dia_atual) * v_dias_mes, 2) > b.valor_planejado * 0.85 THEN 'atencao'
      ELSE 'ok'
    END::text AS status_proj
  FROM public.categories c
  LEFT JOIN public.budgets b
    ON b.category_id = c.id AND b.family_id = p_family_id AND b.mes = v_start
  LEFT JOIN LATERAL (
    SELECT SUM(t.amount) AS gasto FROM public.transactions t
    WHERE t.family_id = p_family_id AND t.type = 'expense'
      AND t.tipo_especial = 'normal'
      AND t.category_id = c.id
      AND t.date >= v_start AND t.date < (v_start + INTERVAL '1 month')
  ) g ON true
  WHERE c.family_id = p_family_id AND c.tipo = 'despesa'
    AND (COALESCE(b.valor_planejado, 0) > 0 OR COALESCE(g.gasto, 0) > 0)
  ORDER BY COALESCE(g.gasto, 0) DESC;
END;
$$;