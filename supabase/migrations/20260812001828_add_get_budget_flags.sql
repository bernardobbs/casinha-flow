-- get_budget_flags: sinaliza categorias que estouraram (ou sobraram muito)
-- consistentemente nos últimos N meses, pra orientar ajuste manual do
-- orçamento — nunca ajusta valor sozinho, só aponta o padrão.
CREATE OR REPLACE FUNCTION public.get_budget_flags(p_family_id uuid, p_meses_historico int DEFAULT 3)
 RETURNS TABLE(
   category_id uuid,
   category_nome text,
   meses_avaliados int,
   meses_estourou int,
   meses_folga int,
   media_pct numeric
 )
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH meses AS (
    SELECT (date_trunc('month', current_date) - (n || ' months')::interval)::date AS mes_inicio
    FROM generate_series(1, p_meses_historico) AS n
  ),
  gastos AS (
    SELECT
      b.category_id,
      c.nome AS category_nome,
      m.mes_inicio,
      b.valor_planejado,
      COALESCE(SUM(COALESCE(t.valor, t.amount)), 0) AS gasto
    FROM meses m
    JOIN budgets b ON b.family_id = p_family_id AND b.mes = m.mes_inicio
    JOIN categories c ON c.id = b.category_id
    LEFT JOIN transactions t
      ON t.family_id = p_family_id
      AND t.category_id = b.category_id
      AND COALESCE(t.tipo, t.type) = 'despesa'
      AND COALESCE(t.data, t.date) >= m.mes_inicio
      AND COALESCE(t.data, t.date) < m.mes_inicio + interval '1 month'
      AND COALESCE(t.tipo_especial, 'normal') = 'normal'
    WHERE b.valor_planejado > 0
    GROUP BY b.category_id, c.nome, m.mes_inicio, b.valor_planejado
  )
  SELECT
    g.category_id,
    g.category_nome,
    COUNT(*)::int AS meses_avaliados,
    COUNT(*) FILTER (WHERE g.gasto >= g.valor_planejado)::int AS meses_estourou,
    COUNT(*) FILTER (WHERE g.gasto <= g.valor_planejado * 0.5)::int AS meses_folga,
    ROUND(AVG((g.gasto / g.valor_planejado) * 100), 1) AS media_pct
  FROM gastos g
  GROUP BY g.category_id, g.category_nome;
END;
$function$;
