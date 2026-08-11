-- recalc_financial_state_safe recomputava renda_mensal somando transações
-- tipo='receita' do mês e sobrescrevia isso no UPDATE — mas a única forma
-- de definir renda no app é o campo manual "Renda mensal" em
-- financial-state.tsx, que faz upsert(renda_mensal) e IMEDIATAMENTE chama
-- este recalc. Resultado: a renda salva era descartada na hora (revertida
-- pra soma de transações receita — 0 quando a família não lança salário
-- como transação, que é o caso aqui). financial_state ficava sempre vazia
-- pra esta família. Fix: recalc preserva a renda_mensal já persistida
-- (lida da própria tabela) e só recalcula essenciais/dívidas/estilo de
-- vida/saldo a partir das transações — nunca mais toca renda_mensal.

CREATE OR REPLACE FUNCTION public.recalc_financial_state_safe(p_family_id uuid, p_mes date)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_renda numeric;
  v_essenciais numeric;
  v_dividas numeric;
  v_estilo_vida numeric;
  v_saldo numeric;
  v_mes_inicio date;
  v_mes_fim date;
BEGIN
  v_mes_inicio := date_trunc('month', p_mes)::date;
  v_mes_fim := (date_trunc('month', p_mes) + interval '1 month')::date;

  -- Renda: preserva o valor já salvo pra este mês (definido manualmente na
  -- UI) — recalc nunca deve sobrescrever isso a partir de transações.
  SELECT renda_mensal INTO v_renda
  FROM financial_state
  WHERE family_id = p_family_id AND mes = v_mes_inicio;
  v_renda := COALESCE(v_renda, 0);

  -- Essenciais
  SELECT coalesce(sum(coalesce(t.valor, t.amount)), 0) INTO v_essenciais
  FROM transactions t
  LEFT JOIN categories c ON c.id = t.category_id
  WHERE t.family_id = p_family_id
    AND coalesce(t.tipo, t.type) = 'despesa'
    AND coalesce(t.data, t.date) >= v_mes_inicio
    AND coalesce(t.data, t.date) < v_mes_fim
    AND t.is_essencial = true
    AND coalesce(c.nome, '') != 'Dívidas'
    AND coalesce(t.tipo_especial, 'normal') = 'normal';

  -- Dívidas
  SELECT coalesce(sum(coalesce(t.valor, t.amount)), 0) INTO v_dividas
  FROM transactions t
  JOIN categories c ON c.id = t.category_id
  WHERE t.family_id = p_family_id
    AND coalesce(t.tipo, t.type) = 'despesa'
    AND coalesce(t.data, t.date) >= v_mes_inicio
    AND coalesce(t.data, t.date) < v_mes_fim
    AND c.nome = 'Dívidas'
    AND coalesce(t.tipo_especial, 'normal') = 'normal';

  -- Estilo de vida
  SELECT coalesce(sum(coalesce(valor, amount)), 0) INTO v_estilo_vida
  FROM transactions
  WHERE family_id = p_family_id
    AND coalesce(tipo, type) = 'despesa'
    AND coalesce(data, date) >= v_mes_inicio
    AND coalesce(data, date) < v_mes_fim
    AND is_essencial = false
    AND coalesce(tipo_especial, 'normal') = 'normal';

  v_saldo := v_renda - v_essenciais - v_dividas - v_estilo_vida;

  INSERT INTO financial_state
    (family_id, mes, renda_mensal, total_essenciais, total_dividas,
     total_estilo_vida, saldo_atual, meta_essenciais, meta_estilo_vida, meta_reserva)
  VALUES
    (p_family_id, v_mes_inicio, v_renda, v_essenciais, v_dividas,
     v_estilo_vida, v_saldo,
     v_renda * 0.5, v_renda * 0.3, v_renda * 0.2)
  ON CONFLICT (family_id, mes)
  DO UPDATE SET
    total_essenciais = v_essenciais,
    total_dividas = v_dividas,
    total_estilo_vida = v_estilo_vida,
    saldo_atual = v_saldo,
    meta_essenciais = v_renda * 0.5,
    meta_estilo_vida = v_renda * 0.3,
    meta_reserva = v_renda * 0.2;
    -- renda_mensal deliberadamente fora do UPDATE: nunca reseta o valor
    -- manual já salvo (lido em v_renda acima).
END;
$function$;
