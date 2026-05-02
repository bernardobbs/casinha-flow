CREATE TABLE public.daily_ai_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL,
  user_id UUID NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  modulo TEXT NOT NULL,
  prompt_usado TEXT NOT NULL,
  resposta_ia JSONB NOT NULL DEFAULT '{}'::jsonb,
  custo_credito INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_daily_ai_runs_family_date ON public.daily_ai_runs(family_id, data);

ALTER TABLE public.daily_ai_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own family ai runs"
ON public.daily_ai_runs FOR SELECT
USING (family_id = public.get_user_family_id(auth.uid()));

CREATE POLICY "Insert own family ai runs"
ON public.daily_ai_runs FOR INSERT
WITH CHECK (
  family_id = public.get_user_family_id(auth.uid())
  AND user_id = auth.uid()
);

CREATE OR REPLACE FUNCTION public.count_ai_runs_today(_family_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.daily_ai_runs
  WHERE family_id = _family_id AND data = CURRENT_DATE;
$$;