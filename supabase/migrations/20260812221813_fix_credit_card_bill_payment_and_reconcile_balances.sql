-- ============================================================================
-- 1. pay_credit_card_bill só criava a transação de saída na conta que paga
--    (conta corrente) — nunca tocava a conta do próprio cartão. Resultado:
--    pagar uma fatura nunca reduzia o "valor devido" mostrado no cartão em
--    /contas e na aba Faturas, porque esse valor vem inteiramente da soma
--    das transações da conta cartão. Também só preenchia as colunas em
--    português (valor/tipo/data), deixando amount/type/date nulos.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.pay_credit_card_bill(p_bill_id uuid, p_account_pagamento_id uuid, p_valor numeric DEFAULT NULL::numeric)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
declare
  v_bill credit_card_bills%rowtype;
  v_transaction_id uuid;
  v_valor numeric;
begin
  select * into v_bill from credit_card_bills where id = p_bill_id;
  v_valor := coalesce(p_valor, v_bill.valor_total);

  insert into transactions
    (family_id, account_id, description, descricao, amount, valor,
     type, tipo, date, data, tipo_especial, source)
  values
    (v_bill.family_id, p_account_pagamento_id,
     'Pagamento fatura cartão', 'Pagamento fatura cartão',
     v_valor, v_valor, 'expense', 'despesa', current_date, current_date,
     'pagamento_fatura', 'manual')
  returning id into v_transaction_id;

  insert into transactions
    (family_id, account_id, description, descricao, amount, valor,
     type, tipo, date, data, tipo_especial, source)
  values
    (v_bill.family_id, v_bill.account_id,
     'Pagamento de fatura', 'Pagamento de fatura',
     v_valor, v_valor, 'income', 'receita', current_date, current_date,
     'pagamento_fatura', 'manual');

  update credit_card_bills
  set status = 'paga', valor_pago = coalesce(p_valor, valor_total)
  where id = p_bill_id;

  return v_transaction_id;
end;
$function$;

-- ============================================================================
-- 2. recalc_account_balance excluía tipo_especial='pagamento_fatura' do
--    cálculo de saldo de QUALQUER conta — mesmo sendo dinheiro real que saiu
--    (conta corrente) ou entrou (agora, no cartão, com o fix acima). Mantém
--    a exclusão de 'transferencia' — dados históricos importados têm pelo
--    menos 2 casos rotulados errado como transferência que não são
--    transferências entre contas da família (revisão futura).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.recalc_account_balance(p_account_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_saldo_inicial numeric;
  v_receitas numeric;
  v_despesas numeric;
BEGIN
  SELECT saldo_inicial INTO v_saldo_inicial FROM accounts WHERE id = p_account_id;

  SELECT COALESCE(SUM(COALESCE(amount, valor)), 0) INTO v_receitas
  FROM transactions
  WHERE account_id = p_account_id
    AND COALESCE(type, tipo) IN ('income', 'receita')
    AND COALESCE(tipo_especial, 'normal') != 'transferencia';

  SELECT COALESCE(SUM(COALESCE(amount, valor)), 0) INTO v_despesas
  FROM transactions
  WHERE account_id = p_account_id
    AND COALESCE(type, tipo) IN ('expense', 'despesa')
    AND COALESCE(tipo_especial, 'normal') != 'transferencia';

  UPDATE accounts
  SET saldo_atual = v_saldo_inicial + v_receitas - v_despesas
  WHERE id = p_account_id;
END;
$function$;

-- ============================================================================
-- 3. Reconciliação histórica: 4 pagamentos de fatura importados do extrato
--    da conta corrente nunca tiveram o lado espelhado no cartão (import
--    rodou antes deste fix existir). Cartão confirmado com o usuário.
-- ============================================================================
INSERT INTO transactions
  (family_id, account_id, description, descricao, amount, valor,
   type, tipo, date, data, tipo_especial, source)
VALUES
  ((SELECT family_id FROM accounts WHERE id = '67cb5c51-3d4e-4558-b0ea-f6c8875f027b'),
   '67cb5c51-3d4e-4558-b0ea-f6c8875f027b', 'Pagamento de fatura', 'Pagamento de fatura',
   2786.54, 2786.54, 'income', 'receita', '2026-01-22', '2026-01-22', 'pagamento_fatura', 'manual'),
  ((SELECT family_id FROM accounts WHERE id = '67cb5c51-3d4e-4558-b0ea-f6c8875f027b'),
   '67cb5c51-3d4e-4558-b0ea-f6c8875f027b', 'Pagamento de fatura', 'Pagamento de fatura',
   3585.45, 3585.45, 'income', 'receita', '2026-03-25', '2026-03-25', 'pagamento_fatura', 'manual'),
  ((SELECT family_id FROM accounts WHERE id = '67cb5c51-3d4e-4558-b0ea-f6c8875f027b'),
   '67cb5c51-3d4e-4558-b0ea-f6c8875f027b', 'Pagamento de fatura', 'Pagamento de fatura',
   5554.11, 5554.11, 'income', 'receita', '2026-04-27', '2026-04-27', 'pagamento_fatura', 'manual'),
  ((SELECT family_id FROM accounts WHERE id = 'ca93b48e-59db-4ad5-9cc3-eaedc1664ff9'),
   'ca93b48e-59db-4ad5-9cc3-eaedc1664ff9', 'Pagamento de fatura', 'Pagamento de fatura',
   345.80, 345.80, 'income', 'receita', '2026-05-25', '2026-05-25', 'pagamento_fatura', 'manual');

-- ============================================================================
-- 4. Reconciliação com extratos reais do banco (confirmados pelo usuário em
--    12/08/2026) — o histórico de transações importado está incompleto
--    demais (faturas parceladas, saques, IOF/juros não totalmente
--    replicados) pra confiar na soma pura. Mesmo mecanismo de
--    adjust_account_balance (aplicado direto aqui por não haver sessão
--    autenticada neste contexto), cria a transação de ajuste e fixa o saldo
--    real reportado.
-- ============================================================================
DO $$
DECLARE
  v_family_id uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  v_user_id uuid := '49c0fa9c-85c8-45c2-9ea2-5241eee02d32';
  v_account_id uuid;
  v_saldo_atual numeric;
  v_saldo_real numeric;
  v_diferenca numeric;
  v_tipo text;
  v_desc text;
BEGIN
  -- BB visa Black (Visa Infinite) — fatura aberta real: R$7.823,24
  v_account_id := '67cb5c51-3d4e-4558-b0ea-f6c8875f027b';
  v_saldo_real := -7823.24;
  v_desc := 'Ajuste manual de saldo — reconciliação extrato Visa Infinite 12/08';
  SELECT saldo_atual INTO v_saldo_atual FROM accounts WHERE id = v_account_id;
  v_diferenca := v_saldo_real - v_saldo_atual;
  v_tipo := CASE WHEN v_diferenca > 0 THEN 'income' ELSE 'expense' END;
  INSERT INTO transactions (
    family_id, user_id, account_id, description, descricao, amount, valor,
    type, tipo, date, data, source, tipo_especial, is_essencial, conciliado
  ) VALUES (
    v_family_id, v_user_id, v_account_id, v_desc, v_desc,
    ABS(v_diferenca), ABS(v_diferenca), v_tipo,
    CASE WHEN v_diferenca > 0 THEN 'receita' ELSE 'despesa' END,
    current_date, current_date, 'manual', 'ajuste_saldo', false, true
  );
  UPDATE accounts SET saldo_atual = v_saldo_real WHERE id = v_account_id;

  -- BB Conta Corrente — saldo real do extrato: -R$6.222,34
  v_account_id := 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
  v_saldo_real := -6222.34;
  v_desc := 'Ajuste manual de saldo — reconciliação extrato BB Conta Corrente 12/08';
  SELECT saldo_atual INTO v_saldo_atual FROM accounts WHERE id = v_account_id;
  v_diferenca := v_saldo_real - v_saldo_atual;
  v_tipo := CASE WHEN v_diferenca > 0 THEN 'income' ELSE 'expense' END;
  INSERT INTO transactions (
    family_id, user_id, account_id, description, descricao, amount, valor,
    type, tipo, date, data, source, tipo_especial, is_essencial, conciliado
  ) VALUES (
    v_family_id, v_user_id, v_account_id, v_desc, v_desc,
    ABS(v_diferenca), ABS(v_diferenca), v_tipo,
    CASE WHEN v_diferenca > 0 THEN 'receita' ELSE 'despesa' END,
    current_date, current_date, 'manual', 'ajuste_saldo', false, true
  );
  UPDATE accounts SET saldo_atual = v_saldo_real WHERE id = v_account_id;
END $$;
