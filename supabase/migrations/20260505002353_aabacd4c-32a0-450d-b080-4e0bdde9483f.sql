
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS conciliado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS conciliado_em timestamptz;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS ultima_revisao date;

CREATE OR REPLACE FUNCTION public.check_duplicate_transaction(
  p_family_id uuid,
  p_date date,
  p_amount numeric,
  p_description text,
  p_account_id uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, "date" date, description text, amount numeric, similarity_score integer)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH base AS (
    SELECT t.id, t.date, t.description, t.amount,
      CASE
        WHEN lower(t.description) = lower(p_description) THEN 100
        WHEN lower(t.description) LIKE '%' || lower(split_part(p_description, ' ', 1)) || '%'
          OR lower(p_description) LIKE '%' || lower(split_part(t.description, ' ', 1)) || '%'
          THEN 75
        ELSE 50
      END
      - LEAST(60, abs((t.date - p_date)) * 10) AS score
    FROM public.transactions t
    WHERE t.family_id = p_family_id
      AND abs(t.amount - abs(p_amount)) < 0.01
      AND t.date BETWEEN p_date - INTERVAL '3 days' AND p_date + INTERVAL '3 days'
      AND (p_account_id IS NULL OR t.account_id = p_account_id)
  )
  SELECT id, "date", description, amount, score::integer AS similarity_score
  FROM base
  WHERE score >= 50
  ORDER BY score DESC
  LIMIT 5;
$$;

CREATE OR REPLACE VIEW public.v_stock_review AS
SELECT
  p.id,
  p.family_id,
  p.nome,
  p.categoria,
  p.unidade,
  p.quantidade_atual,
  p.quantidade_minima,
  p.data_validade,
  p.ultima_revisao,
  CASE
    WHEN p.quantidade_atual <= 0 THEN 'zerado'
    WHEN p.data_validade IS NOT NULL AND p.data_validade <= CURRENT_DATE + INTERVAL '7 days' THEN 'vencendo'
    WHEN p.quantidade_atual <= p.quantidade_minima * 0.5 THEN 'critico'
    WHEN p.quantidade_atual <= p.quantidade_minima THEN 'baixo'
    ELSE 'ok'
  END AS urgencia,
  CASE
    WHEN p.ultima_revisao IS NULL THEN 999
    ELSE (CURRENT_DATE - p.ultima_revisao)
  END AS dias_sem_revisao,
  CASE
    WHEN p.data_validade IS NULL THEN NULL
    ELSE (p.data_validade - CURRENT_DATE)
  END AS dias_para_vencer,
  NULL::integer AS dias_restantes
FROM public.products p
WHERE p.ativo = true;
