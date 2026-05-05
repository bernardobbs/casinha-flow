CREATE OR REPLACE FUNCTION public.adjust_account_balance(
  p_account_id uuid,
  p_family_id uuid,
  p_user_id uuid,
  p_saldo_real numeric,
  p_observacao text DEFAULT 'Ajuste manual de saldo'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo_atual numeric;
  v_diff numeric;
BEGIN
  SELECT saldo_atual INTO v_saldo_atual
  FROM public.accounts
  WHERE id = p_account_id AND family_id = p_family_id;

  IF v_saldo_atual IS NULL THEN
    RAISE EXCEPTION 'Conta não encontrada';
  END IF;

  v_diff := p_saldo_real - v_saldo_atual;

  IF abs(v_diff) < 0.005 THEN
    RETURN;
  END IF;

  INSERT INTO public.transactions (
    family_id, user_id, account_id, date,
    description, amount, type, source, scope, tipo_especial, is_essencial
  ) VALUES (
    p_family_id, p_user_id, p_account_id, CURRENT_DATE,
    p_observacao, abs(v_diff),
    CASE WHEN v_diff > 0 THEN 'income'::transaction_type ELSE 'expense'::transaction_type END,
    'manual'::transaction_source, 'family'::transaction_scope,
    'ajuste_saldo'::transaction_special_type, false
  );

  PERFORM public.recalc_account_balance(p_account_id);
END;
$$;