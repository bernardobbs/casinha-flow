-- Reconciliação com extrato real do Nubank (fatura fechando 25/08/2026,
-- confirmado pelo usuário em 12/08/2026): soma dos lançamentos da fatura
-- atual (encargos - pagamento já recebido) = R$240,13 devidos.
-- Mesmo mecanismo de adjust_account_balance (aplicado direto aqui por não
-- haver sessão autenticada neste contexto).
DO $$
DECLARE
  v_account_id uuid := 'ca93b48e-59db-4ad5-9cc3-eaedc1664ff9';
  v_family_id uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  v_user_id uuid := '49c0fa9c-85c8-45c2-9ea2-5241eee02d32';
  v_saldo_atual numeric;
  v_saldo_real numeric := -240.13;
  v_diferenca numeric;
  v_tipo text;
  v_desc text := 'Ajuste manual de saldo — reconciliação extrato Nubank Roxinho 12/08';
BEGIN
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
