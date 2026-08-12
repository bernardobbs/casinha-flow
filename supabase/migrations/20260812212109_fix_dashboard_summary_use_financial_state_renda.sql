-- get_dashboard_summary tinha dois problemas graves:
-- 1. `renda_mensal` (o campo exibido em /dashboard, /situacao, no contexto
--    do Assistente IA e na análise de crise) era calculado somando
--    transações tipo 'receita' do mês — mas esta família não lança salário
--    como transação, define a renda manualmente em /financial-state. Sem
--    transações de receita, o valor exibido caía pra uma soma residual
--    (ex.: R$330) em vez do salário real, deixando saldo_atual/saldo_projetado
--    profundamente negativos por engano.
-- 2. As metas 50/30/20 (meta_essenciais/estilo/reserva) usavam uma variável
--    SEPARADA (v_renda_base) com uma cascata de fallback que, na ausência de
--    orçamento de categoria receita, somava TODOS os valores planejados de
--    orçamento (não é renda) e por fim aplicava um PISO HARDCODED de
--    R$13.112 — um número financeiro pessoal fixo dentro do banco,
--    desconectado de qualquer dado real da família.
-- 3. `total_dividas` nunca era de fato somado (variável declarada e nunca
--    atualizada, sempre 0).
--
-- Fix: uma única fonte de renda (financial_state.renda_mensal do mês, a
-- mesma que /financial-state mantém), dívidas somadas de verdade, sem
-- nenhum valor hardcoded.

CREATE OR REPLACE FUNCTION public.get_dashboard_summary(p_family_id uuid)
 RETURNS TABLE(mes text, dia_atual integer, dias_mes integer, renda_mensal numeric, total_essenciais numeric, total_dividas numeric, total_estilo_vida numeric, saldo_atual numeric, saldo_projetado numeric, meta_essenciais numeric, meta_estilo_vida numeric, meta_reserva numeric, modo_crise boolean, estagio_crise integer, score integer, score_label text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_mes_inicio  date    := date_trunc('month', current_date)::date;
  v_mes_fim     date    := v_mes_inicio + interval '1 month';
  v_dia_atual   int     := extract(day from current_date)::int;
  v_dias_mes    int     := extract(day from (v_mes_fim - interval '1 day'))::int;
  v_renda       numeric := 0;
  v_essenciais  numeric := 0;
  v_dividas     numeric := 0;
  v_estilo      numeric := 0;
  v_gasto_total numeric;
  v_score       int;
  v_label       text;
BEGIN
  -- Renda: valor manual salvo em financial_state pro mês (mesma fonte que
  -- /financial-state usa) — nunca calculada a partir de transações
  -- 'receita', que esta família não lança.
  SELECT fs.renda_mensal INTO v_renda
  FROM financial_state fs
  WHERE fs.family_id = p_family_id AND fs.mes = v_mes_inicio;
  v_renda := COALESCE(v_renda, 0);

  SELECT COALESCE(SUM(COALESCE(t.valor, t.amount)), 0) INTO v_essenciais
  FROM transactions t
  JOIN categories c ON c.id = t.category_id
  WHERE t.family_id = p_family_id
    AND COALESCE(t.tipo, t.type) = 'despesa'
    AND c.is_essencial = true
    AND COALESCE(c.nome, '') != 'Dívidas'
    AND COALESCE(t.data, t.date) >= v_mes_inicio
    AND COALESCE(t.data, t.date) < v_mes_fim
    AND COALESCE(t.tipo_especial, 'normal') = 'normal';

  SELECT COALESCE(SUM(COALESCE(t.valor, t.amount)), 0) INTO v_dividas
  FROM transactions t
  JOIN categories c ON c.id = t.category_id
  WHERE t.family_id = p_family_id
    AND COALESCE(t.tipo, t.type) = 'despesa'
    AND c.nome = 'Dívidas'
    AND COALESCE(t.data, t.date) >= v_mes_inicio
    AND COALESCE(t.data, t.date) < v_mes_fim
    AND COALESCE(t.tipo_especial, 'normal') = 'normal';

  SELECT COALESCE(SUM(COALESCE(t.valor, t.amount)), 0) INTO v_estilo
  FROM transactions t
  LEFT JOIN categories c ON c.id = t.category_id
  WHERE t.family_id = p_family_id
    AND COALESCE(t.tipo, t.type) = 'despesa'
    AND COALESCE(c.is_essencial, false) = false
    AND COALESCE(t.data, t.date) >= v_mes_inicio
    AND COALESCE(t.data, t.date) < v_mes_fim
    AND COALESCE(t.tipo_especial, 'normal') = 'normal';

  v_gasto_total := v_essenciais + v_dividas + v_estilo;

  v_score := GREATEST(0, 100
    - CASE WHEN v_renda > 0 AND v_gasto_total > v_renda THEN 30 ELSE 0 END
    - CASE WHEN v_renda > 0 AND v_essenciais > v_renda * 0.6 THEN 20 ELSE 0 END
    - CASE WHEN v_renda = 0 AND v_gasto_total > 0 THEN 30 ELSE 0 END
    - CASE WHEN (v_renda - v_gasto_total) < 0 THEN 20 ELSE 0 END);

  v_label := CASE
    WHEN v_score >= 71 THEN 'Saudável'
    WHEN v_score >= 41 THEN 'Atenção'
    ELSE 'Crítico'
  END;

  RETURN QUERY SELECT
    to_char(v_mes_inicio, 'YYYY-MM-DD'),
    v_dia_atual, v_dias_mes,
    v_renda, v_essenciais, v_dividas, v_estilo,
    v_renda - v_gasto_total,
    CASE WHEN v_dia_atual > 0
      THEN ROUND(v_renda - (v_gasto_total / v_dia_atual * v_dias_mes), 2)
      ELSE 0 END,
    ROUND(v_renda * 0.50, 2),
    ROUND(v_renda * 0.30, 2),
    ROUND(v_renda * 0.20, 2),
    false, null::int, v_score, v_label;
END;
$function$;
