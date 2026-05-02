-- Crisis events table
CREATE TABLE public.crisis_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE,
  motivo_ativacao TEXT NOT NULL CHECK (motivo_ativacao IN ('automatico','manual')),
  criterio_disparado TEXT,
  estagio_atual SMALLINT NOT NULL DEFAULT 1 CHECK (estagio_atual BETWEEN 1 AND 3),
  plano_saida JSONB DEFAULT '{}'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_crisis_events_family ON public.crisis_events(family_id);
CREATE UNIQUE INDEX idx_crisis_events_one_active_per_family
  ON public.crisis_events(family_id) WHERE ativo = true;

ALTER TABLE public.crisis_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own family crisis"
ON public.crisis_events FOR SELECT
USING (family_id = public.get_user_family_id(auth.uid()));

CREATE POLICY "Insert own family crisis"
ON public.crisis_events FOR INSERT
WITH CHECK (family_id = public.get_user_family_id(auth.uid()));

CREATE POLICY "Update own family crisis"
ON public.crisis_events FOR UPDATE
USING (family_id = public.get_user_family_id(auth.uid()));

CREATE POLICY "Delete own family crisis"
ON public.crisis_events FOR DELETE
USING (family_id = public.get_user_family_id(auth.uid()));

CREATE TRIGGER update_crisis_events_updated_at
BEFORE UPDATE ON public.crisis_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Crisis stage history
CREATE TABLE public.crisis_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crisis_id UUID NOT NULL REFERENCES public.crisis_events(id) ON DELETE CASCADE,
  estagio SMALLINT NOT NULL CHECK (estagio BETWEEN 1 AND 3),
  data_entrada TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_saida TIMESTAMP WITH TIME ZONE,
  criterio_avanco TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_crisis_stage_history_crisis ON public.crisis_stage_history(crisis_id);

ALTER TABLE public.crisis_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own family crisis history"
ON public.crisis_stage_history FOR SELECT
USING (crisis_id IN (SELECT id FROM public.crisis_events WHERE family_id = public.get_user_family_id(auth.uid())));

CREATE POLICY "Insert own family crisis history"
ON public.crisis_stage_history FOR INSERT
WITH CHECK (crisis_id IN (SELECT id FROM public.crisis_events WHERE family_id = public.get_user_family_id(auth.uid())));

CREATE POLICY "Update own family crisis history"
ON public.crisis_stage_history FOR UPDATE
USING (crisis_id IN (SELECT id FROM public.crisis_events WHERE family_id = public.get_user_family_id(auth.uid())));

CREATE POLICY "Delete own family crisis history"
ON public.crisis_stage_history FOR DELETE
USING (crisis_id IN (SELECT id FROM public.crisis_events WHERE family_id = public.get_user_family_id(auth.uid())));

-- Function: check if crisis should auto-activate based on financial_state
CREATE OR REPLACE FUNCTION public.check_crisis_activation(_family_id UUID, _mes DATE)
RETURNS TABLE(should_activate BOOLEAN, criterio TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state public.financial_state;
  v_prev1 public.financial_state;
  v_prev2 public.financial_state;
  v_start DATE := date_trunc('month', _mes)::date;
BEGIN
  IF public.get_user_family_id(auth.uid()) IS DISTINCT FROM _family_id THEN
    RAISE EXCEPTION 'Não autorizado para esta família';
  END IF;

  SELECT * INTO v_state FROM public.financial_state
  WHERE family_id = _family_id AND mes = v_start;

  IF v_state IS NULL OR v_state.renda_mensal <= 0 THEN
    RETURN QUERY SELECT false, NULL::text;
    RETURN;
  END IF;

  -- Critério 1: (essenciais + dívidas) > 80% da renda
  IF (v_state.total_essenciais + v_state.total_dividas) > (v_state.renda_mensal * 0.80) THEN
    RETURN QUERY SELECT true, 'Essenciais + dívidas excedem 80% da renda'::text;
    RETURN;
  END IF;

  -- Critério 2: reserva < total_essenciais (menos de 1 mês de reserva)
  IF v_state.total_reserva < v_state.total_essenciais THEN
    RETURN QUERY SELECT true, 'Reserva insuficiente (menos de 1 mês de essenciais)'::text;
    RETURN;
  END IF;

  -- Critério 3: saldo negativo por 2 meses consecutivos
  SELECT * INTO v_prev1 FROM public.financial_state
  WHERE family_id = _family_id AND mes = (v_start - INTERVAL '1 month')::date;
  SELECT * INTO v_prev2 FROM public.financial_state
  WHERE family_id = _family_id AND mes = (v_start - INTERVAL '2 month')::date;

  IF v_state.saldo_atual < 0 AND v_prev1.saldo_atual < 0 THEN
    RETURN QUERY SELECT true, 'Saldo negativo por 2 meses consecutivos'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT false, NULL::text;
END;
$$;

-- Function: activate crisis (manual or automatic)
CREATE OR REPLACE FUNCTION public.activate_crisis(
  _family_id UUID,
  _motivo TEXT,
  _criterio TEXT
) RETURNS public.crisis_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.crisis_events;
  v_new public.crisis_events;
BEGIN
  IF public.get_user_family_id(auth.uid()) IS DISTINCT FROM _family_id THEN
    RAISE EXCEPTION 'Não autorizado para esta família';
  END IF;

  SELECT * INTO v_existing FROM public.crisis_events
  WHERE family_id = _family_id AND ativo = true LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  INSERT INTO public.crisis_events (family_id, motivo_ativacao, criterio_disparado, estagio_atual, ativo)
  VALUES (_family_id, _motivo, _criterio, 1, true)
  RETURNING * INTO v_new;

  INSERT INTO public.crisis_stage_history (crisis_id, estagio, data_entrada)
  VALUES (v_new.id, 1, now());

  -- Marca financial_state do mês atual em modo_crise
  UPDATE public.financial_state
  SET modo_crise = true
  WHERE family_id = _family_id
    AND mes = date_trunc('month', CURRENT_DATE)::date;

  RETURN v_new;
END;
$$;

-- Function: advance crisis stage
CREATE OR REPLACE FUNCTION public.advance_crisis_stage(_crisis_id UUID)
RETURNS public.crisis_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_crisis public.crisis_events;
  v_state public.financial_state;
  v_prev public.financial_state;
  v_can_advance BOOLEAN := false;
  v_criterio TEXT;
  v_start DATE := date_trunc('month', CURRENT_DATE)::date;
BEGIN
  SELECT * INTO v_crisis FROM public.crisis_events WHERE id = _crisis_id;
  IF v_crisis IS NULL THEN
    RAISE EXCEPTION 'Crise não encontrada';
  END IF;
  IF public.get_user_family_id(auth.uid()) IS DISTINCT FROM v_crisis.family_id THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;
  IF NOT v_crisis.ativo THEN
    RAISE EXCEPTION 'Crise não está ativa';
  END IF;

  SELECT * INTO v_state FROM public.financial_state
  WHERE family_id = v_crisis.family_id AND mes = v_start;
  SELECT * INTO v_prev FROM public.financial_state
  WHERE family_id = v_crisis.family_id AND mes = (v_start - INTERVAL '1 month')::date;

  IF v_state IS NULL THEN
    RAISE EXCEPTION 'Estado financeiro do mês atual não encontrado';
  END IF;

  IF v_crisis.estagio_atual = 1 THEN
    -- Avanço: essenciais cobertos por 2 meses + dívidas não crescendo
    IF v_state.renda_mensal >= v_state.total_essenciais
       AND v_prev.renda_mensal >= v_prev.total_essenciais
       AND (v_prev.total_dividas IS NULL OR v_state.total_dividas <= v_prev.total_dividas) THEN
      v_can_advance := true;
      v_criterio := 'Essenciais cobertos por 2 meses + dívidas estáveis';
    END IF;
  ELSIF v_crisis.estagio_atual = 2 THEN
    -- Avanço: reserva > 1x essenciais
    IF v_state.total_reserva > v_state.total_essenciais THEN
      v_can_advance := true;
      v_criterio := 'Reserva supera 1x essenciais';
    END IF;
  ELSIF v_crisis.estagio_atual = 3 THEN
    -- Saída completa: reserva > 1x essenciais + dívidas controladas
    IF v_state.total_reserva > v_state.total_essenciais
       AND v_state.total_dividas <= (v_state.renda_mensal * 0.30) THEN
      -- Encerra crise
      UPDATE public.crisis_stage_history
      SET data_saida = now(), criterio_avanco = 'Saída completa: reserva e dívidas controladas'
      WHERE crisis_id = _crisis_id AND data_saida IS NULL;

      UPDATE public.crisis_events
      SET ativo = false, data_fim = CURRENT_DATE, updated_at = now()
      WHERE id = _crisis_id
      RETURNING * INTO v_crisis;

      UPDATE public.financial_state
      SET modo_crise = false
      WHERE family_id = v_crisis.family_id AND mes = v_start;

      RETURN v_crisis;
    END IF;
  END IF;

  IF NOT v_can_advance THEN
    RAISE EXCEPTION 'Critérios para avanço não atendidos';
  END IF;

  -- Fecha estágio atual no histórico
  UPDATE public.crisis_stage_history
  SET data_saida = now(), criterio_avanco = v_criterio
  WHERE crisis_id = _crisis_id AND estagio = v_crisis.estagio_atual AND data_saida IS NULL;

  -- Avança
  UPDATE public.crisis_events
  SET estagio_atual = v_crisis.estagio_atual + 1, updated_at = now()
  WHERE id = _crisis_id
  RETURNING * INTO v_crisis;

  INSERT INTO public.crisis_stage_history (crisis_id, estagio, data_entrada)
  VALUES (_crisis_id, v_crisis.estagio_atual, now());

  RETURN v_crisis;
END;
$$;

-- Function: resolve crisis manually
CREATE OR REPLACE FUNCTION public.resolve_crisis(_crisis_id UUID)
RETURNS public.crisis_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_crisis public.crisis_events;
BEGIN
  SELECT * INTO v_crisis FROM public.crisis_events WHERE id = _crisis_id;
  IF v_crisis IS NULL THEN
    RAISE EXCEPTION 'Crise não encontrada';
  END IF;
  IF public.get_user_family_id(auth.uid()) IS DISTINCT FROM v_crisis.family_id THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  UPDATE public.crisis_stage_history
  SET data_saida = now(), criterio_avanco = COALESCE(criterio_avanco, 'Resolvido manualmente')
  WHERE crisis_id = _crisis_id AND data_saida IS NULL;

  UPDATE public.crisis_events
  SET ativo = false, data_fim = CURRENT_DATE, updated_at = now()
  WHERE id = _crisis_id
  RETURNING * INTO v_crisis;

  UPDATE public.financial_state
  SET modo_crise = false
  WHERE family_id = v_crisis.family_id
    AND mes = date_trunc('month', CURRENT_DATE)::date;

  RETURN v_crisis;
END;
$$;