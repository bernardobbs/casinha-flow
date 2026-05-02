CREATE TABLE public.financial_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  mes DATE NOT NULL,
  renda_mensal NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_essenciais NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_dividas NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_reserva NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_estilo_vida NUMERIC(14,2) NOT NULL DEFAULT 0,
  saldo_atual NUMERIC(14,2) NOT NULL DEFAULT 0,
  meta_essenciais NUMERIC(14,2) NOT NULL DEFAULT 0,
  meta_estilo_vida NUMERIC(14,2) NOT NULL DEFAULT 0,
  meta_reserva NUMERIC(14,2) NOT NULL DEFAULT 0,
  modo_crise BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (family_id, mes)
);

-- Validation trigger: ensure mes is the first day of the month
CREATE OR REPLACE FUNCTION public.validate_financial_state_mes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXTRACT(DAY FROM NEW.mes) <> 1 THEN
    RAISE EXCEPTION 'mes deve ser o primeiro dia do mês (got %)', NEW.mes;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_financial_state_validate_mes
BEFORE INSERT OR UPDATE ON public.financial_state
FOR EACH ROW EXECUTE FUNCTION public.validate_financial_state_mes();

CREATE INDEX idx_financial_state_family_mes ON public.financial_state(family_id, mes DESC);

ALTER TABLE public.financial_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own family financial state"
ON public.financial_state FOR SELECT
USING (family_id = public.get_user_family_id(auth.uid()));

CREATE POLICY "Insert own family financial state"
ON public.financial_state FOR INSERT
WITH CHECK (family_id = public.get_user_family_id(auth.uid()));

CREATE POLICY "Update own family financial state"
ON public.financial_state FOR UPDATE
USING (family_id = public.get_user_family_id(auth.uid()));

CREATE POLICY "Delete own family financial state"
ON public.financial_state FOR DELETE
USING (family_id = public.get_user_family_id(auth.uid()));

CREATE TRIGGER update_financial_state_updated_at
BEFORE UPDATE ON public.financial_state
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Recalc function: aggregates transactions for the month and updates the row.
-- If renda_mensal is provided, it overwrites; otherwise keeps existing.
CREATE OR REPLACE FUNCTION public.recalc_financial_state(
  _family_id UUID,
  _mes DATE,
  _renda NUMERIC DEFAULT NULL
)
RETURNS public.financial_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _start DATE := date_trunc('month', _mes)::date;
  _end   DATE := (date_trunc('month', _mes) + INTERVAL '1 month')::date;
  v_essenciais NUMERIC(14,2) := 0;
  v_dividas    NUMERIC(14,2) := 0;
  v_estilo     NUMERIC(14,2) := 0;
  v_renda_tx   NUMERIC(14,2) := 0;
  v_renda      NUMERIC(14,2);
  v_row        public.financial_state;
BEGIN
  -- Authorization: caller must belong to the family
  IF public.get_user_family_id(auth.uid()) IS DISTINCT FROM _family_id THEN
    RAISE EXCEPTION 'Não autorizado para esta família';
  END IF;

  -- Despesas: dividas (categoria "Dívidas")
  SELECT COALESCE(SUM(amount), 0) INTO v_dividas
  FROM public.transactions
  WHERE family_id = _family_id
    AND type = 'expense'
    AND date >= _start AND date < _end
    AND (
      category = 'Dívidas'
      OR category_id IN (
        SELECT id FROM public.categories
        WHERE family_id = _family_id AND nome = 'Dívidas'
      )
    );

  -- Despesas: essenciais (is_essencial = true) excluindo dívidas
  SELECT COALESCE(SUM(amount), 0) INTO v_essenciais
  FROM public.transactions t
  WHERE t.family_id = _family_id
    AND t.type = 'expense'
    AND t.date >= _start AND t.date < _end
    AND (
      t.is_essencial = true
      OR t.category_id IN (
        SELECT id FROM public.categories
        WHERE family_id = _family_id AND is_essencial = true
      )
    )
    AND COALESCE(t.category, '') <> 'Dívidas'
    AND (
      t.category_id IS NULL
      OR t.category_id NOT IN (
        SELECT id FROM public.categories
        WHERE family_id = _family_id AND nome = 'Dívidas'
      )
    );

  -- Despesas: estilo de vida (não essenciais e não dívidas)
  SELECT COALESCE(SUM(amount), 0) INTO v_estilo
  FROM public.transactions t
  WHERE t.family_id = _family_id
    AND t.type = 'expense'
    AND t.date >= _start AND t.date < _end
    AND COALESCE(t.is_essencial, false) = false
    AND (
      t.category_id IS NULL
      OR t.category_id NOT IN (
        SELECT id FROM public.categories
        WHERE family_id = _family_id
          AND (is_essencial = true OR nome = 'Dívidas')
      )
    )
    AND COALESCE(t.category, '') <> 'Dívidas';

  -- Renda observada nas transações do mês (income)
  SELECT COALESCE(SUM(amount), 0) INTO v_renda_tx
  FROM public.transactions
  WHERE family_id = _family_id
    AND type = 'income'
    AND date >= _start AND date < _end;

  -- Upsert
  INSERT INTO public.financial_state (
    family_id, mes, renda_mensal,
    total_essenciais, total_dividas, total_estilo_vida,
    saldo_atual, meta_essenciais, meta_estilo_vida, meta_reserva
  )
  VALUES (
    _family_id, _start,
    COALESCE(_renda, v_renda_tx),
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
    saldo_atual       =
      COALESCE(_renda, public.financial_state.renda_mensal)
      - EXCLUDED.total_essenciais
      - EXCLUDED.total_dividas
      - EXCLUDED.total_estilo_vida,
    meta_essenciais   = COALESCE(_renda, public.financial_state.renda_mensal) * 0.50,
    meta_estilo_vida  = COALESCE(_renda, public.financial_state.renda_mensal) * 0.30,
    meta_reserva      = COALESCE(_renda, public.financial_state.renda_mensal) * 0.20,
    updated_at        = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;