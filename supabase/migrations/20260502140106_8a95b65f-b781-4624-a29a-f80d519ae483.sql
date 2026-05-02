-- BUDGETS
CREATE TABLE public.budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL,
  category_id UUID NOT NULL,
  mes DATE NOT NULL,
  valor_planejado NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (family_id, category_id, mes)
);

CREATE INDEX idx_budgets_family_mes ON public.budgets(family_id, mes);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own family budgets" ON public.budgets
  FOR SELECT USING (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "Insert own family budgets" ON public.budgets
  FOR INSERT WITH CHECK (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "Update own family budgets" ON public.budgets
  FOR UPDATE USING (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "Delete own family budgets" ON public.budgets
  FOR DELETE USING (family_id = public.get_user_family_id(auth.uid()));

CREATE TRIGGER trg_budgets_updated_at BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Validate mes is first day of month
CREATE OR REPLACE FUNCTION public.validate_budget_mes()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXTRACT(DAY FROM NEW.mes) <> 1 THEN
    RAISE EXCEPTION 'mes deve ser o primeiro dia do mês (got %)', NEW.mes;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_budgets_validate_mes BEFORE INSERT OR UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.validate_budget_mes();

-- ALERTS
CREATE TYPE public.alert_severity AS ENUM ('info', 'warning', 'critical');

CREATE TABLE public.alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL,
  tipo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  severidade public.alert_severity NOT NULL DEFAULT 'info',
  referencia_id UUID,
  referencia_tipo TEXT,
  lido BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alerts_family_lido ON public.alerts(family_id, lido, created_at DESC);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own family alerts" ON public.alerts
  FOR SELECT USING (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "Insert own family alerts" ON public.alerts
  FOR INSERT WITH CHECK (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "Update own family alerts" ON public.alerts
  FOR UPDATE USING (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "Delete own family alerts" ON public.alerts
  FOR DELETE USING (family_id = public.get_user_family_id(auth.uid()));

CREATE TRIGGER trg_alerts_updated_at BEFORE UPDATE ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Status do orçamento por categoria/mês
CREATE OR REPLACE FUNCTION public.get_budget_status(_family_id UUID, _mes DATE)
RETURNS TABLE(
  budget_id UUID,
  category_id UUID,
  category_nome TEXT,
  category_cor TEXT,
  category_icone TEXT,
  is_essencial BOOLEAN,
  valor_planejado NUMERIC,
  valor_gasto NUMERIC,
  pct_atingido NUMERIC,
  status_cor TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _start DATE := date_trunc('month', _mes)::date;
  _end   DATE := (date_trunc('month', _mes) + INTERVAL '1 month')::date;
BEGIN
  IF public.get_user_family_id(auth.uid()) IS DISTINCT FROM _family_id THEN
    RAISE EXCEPTION 'Não autorizado para esta família';
  END IF;

  RETURN QUERY
  SELECT
    b.id,
    c.id,
    c.nome,
    c.cor,
    c.icone,
    c.is_essencial,
    b.valor_planejado,
    COALESCE((
      SELECT SUM(t.amount) FROM public.transactions t
      WHERE t.family_id = _family_id
        AND t.type = 'expense'
        AND t.category_id = c.id
        AND t.date >= _start AND t.date < _end
    ), 0)::NUMERIC AS valor_gasto,
    CASE WHEN b.valor_planejado > 0 THEN
      ROUND((COALESCE((
        SELECT SUM(t.amount) FROM public.transactions t
        WHERE t.family_id = _family_id
          AND t.type = 'expense'
          AND t.category_id = c.id
          AND t.date >= _start AND t.date < _end
      ), 0) / b.valor_planejado) * 100, 2)
    ELSE 0 END AS pct_atingido,
    CASE
      WHEN b.valor_planejado <= 0 THEN 'gray'
      WHEN COALESCE((
        SELECT SUM(t.amount) FROM public.transactions t
        WHERE t.family_id = _family_id AND t.type = 'expense'
          AND t.category_id = c.id AND t.date >= _start AND t.date < _end
      ), 0) >= b.valor_planejado THEN 'red'
      WHEN COALESCE((
        SELECT SUM(t.amount) FROM public.transactions t
        WHERE t.family_id = _family_id AND t.type = 'expense'
          AND t.category_id = c.id AND t.date >= _start AND t.date < _end
      ), 0) >= (b.valor_planejado * 0.70) THEN 'yellow'
      ELSE 'green'
    END AS status_cor
  FROM public.budgets b
  JOIN public.categories c ON c.id = b.category_id
  WHERE b.family_id = _family_id AND b.mes = _start;
END;
$$;

-- Cria alerta evitando duplicação no mesmo dia para mesmo tipo/referência
CREATE OR REPLACE FUNCTION public.create_alert(
  _family_id UUID, _tipo TEXT, _mensagem TEXT,
  _severidade public.alert_severity, _ref_id UUID, _ref_tipo TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existing UUID;
  v_id UUID;
BEGIN
  SELECT id INTO v_existing FROM public.alerts
  WHERE family_id = _family_id
    AND tipo = _tipo
    AND COALESCE(referencia_id::text, '') = COALESCE(_ref_id::text, '')
    AND created_at >= (now() - INTERVAL '24 hours')
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  INSERT INTO public.alerts (family_id, tipo, mensagem, severidade, referencia_id, referencia_tipo)
  VALUES (_family_id, _tipo, _mensagem, _severidade, _ref_id, _ref_tipo)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Verifica e dispara alertas após uma transação
CREATE OR REPLACE FUNCTION public.check_transaction_alerts(_transaction_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tx public.transactions;
  v_mes DATE;
  v_budget public.budgets;
  v_gasto NUMERIC := 0;
  v_pct NUMERIC := 0;
  v_cat_nome TEXT;
  v_state public.financial_state;
  v_micro_count INT;
BEGIN
  SELECT * INTO v_tx FROM public.transactions WHERE id = _transaction_id;
  IF v_tx IS NULL THEN
    RETURN;
  END IF;
  IF public.get_user_family_id(auth.uid()) IS DISTINCT FROM v_tx.family_id THEN
    RETURN;
  END IF;

  v_mes := date_trunc('month', v_tx.date)::date;

  -- Orçamento da categoria
  IF v_tx.type = 'expense' AND v_tx.category_id IS NOT NULL THEN
    SELECT * INTO v_budget FROM public.budgets
    WHERE family_id = v_tx.family_id AND category_id = v_tx.category_id AND mes = v_mes;

    IF v_budget IS NOT NULL AND v_budget.valor_planejado > 0 THEN
      SELECT COALESCE(SUM(amount), 0) INTO v_gasto FROM public.transactions
      WHERE family_id = v_tx.family_id AND type = 'expense'
        AND category_id = v_tx.category_id
        AND date >= v_mes AND date < (v_mes + INTERVAL '1 month');

      v_pct := (v_gasto / v_budget.valor_planejado) * 100;
      SELECT nome INTO v_cat_nome FROM public.categories WHERE id = v_tx.category_id;

      IF v_pct >= 100 THEN
        PERFORM public.create_alert(
          v_tx.family_id, 'budget_exceeded',
          '🔴 Orçamento de ' || COALESCE(v_cat_nome, 'categoria') || ' ultrapassado (' || ROUND(v_pct,0) || '%)',
          'critical', v_budget.id, 'budget'
        );
      ELSIF v_pct >= 85 THEN
        PERFORM public.create_alert(
          v_tx.family_id, 'budget_warning',
          '🟡 ' || COALESCE(v_cat_nome, 'categoria') || ' atingiu ' || ROUND(v_pct,0) || '% do orçamento',
          'warning', v_budget.id, 'budget'
        );
      END IF;
    END IF;
  END IF;

  -- Saldo negativo
  SELECT * INTO v_state FROM public.financial_state
  WHERE family_id = v_tx.family_id AND mes = v_mes;
  IF v_state IS NOT NULL AND v_state.saldo_atual < 0 THEN
    PERFORM public.create_alert(
      v_tx.family_id, 'negative_balance',
      '🔴 Saldo negativo detectado neste mês',
      'critical', v_state.id, 'financial_state'
    );
  END IF;

  -- Microgastos: 5+ despesas em menos de 2h
  IF v_tx.type = 'expense' THEN
    SELECT COUNT(*) INTO v_micro_count FROM public.transactions
    WHERE family_id = v_tx.family_id AND type = 'expense'
      AND created_at >= (now() - INTERVAL '2 hours');
    IF v_micro_count >= 5 THEN
      PERFORM public.create_alert(
        v_tx.family_id, 'microspending',
        '🟡 ' || v_micro_count || ' gastos em menos de 2h — atenção a microgastos',
        'warning', NULL, NULL
      );
    END IF;
  END IF;
END;
$$;