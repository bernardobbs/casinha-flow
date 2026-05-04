-- Add recorrente_id to transactions linking to recurring_transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS recorrente_id uuid REFERENCES public.recurring_transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_recorrente_id ON public.transactions(recorrente_id);
CREATE INDEX IF NOT EXISTS idx_transactions_family_date ON public.transactions(family_id, date DESC);

-- Monthly summary: lista de meses com receitas/despesas
CREATE OR REPLACE FUNCTION public.get_monthly_summary(p_family_id uuid)
RETURNS TABLE(mes date, total_receita numeric, total_despesa numeric, qtd integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    date_trunc('month', t.date)::date AS mes,
    COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount END), 0) AS total_receita,
    COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount END), 0) AS total_despesa,
    COUNT(*)::int AS qtd
  FROM public.transactions t
  WHERE t.family_id = p_family_id
  GROUP BY 1
  ORDER BY 1 DESC;
$$;

-- Transactions for a specific month
CREATE OR REPLACE FUNCTION public.get_transactions_by_month(p_family_id uuid, p_mes date)
RETURNS SETOF public.transactions
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.transactions
  WHERE family_id = p_family_id
    AND date >= date_trunc('month', p_mes)::date
    AND date <  (date_trunc('month', p_mes) + interval '1 month')::date
  ORDER BY date DESC, created_at DESC;
$$;