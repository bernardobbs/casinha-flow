-- ============================================================================
-- 1. find_possible_duplicate_transaction — dedup check called by the frontend
--    right before inserting a manual transaction. Mirrors the exact pattern
--    that produced 7 real duplicate rows found during a manual audit
--    (22-23/08): same account + same date + same valor + same tipo + same
--    descricao, entered twice (double click, or re-entered days later without
--    noticing it was already there). Returns candidates so the UI can warn
--    and let the user confirm rather than silently blocking a legitimate
--    repeat charge (e.g. two separate R$100 fuel purchases on the same day).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.find_possible_duplicate_transaction(
  p_family_id uuid,
  p_account_id uuid,
  p_data date,
  p_valor numeric,
  p_tipo text,
  p_descricao text
)
RETURNS TABLE(id uuid, descricao text, valor numeric, data date, created_at timestamptz, source text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.get_user_family_id(auth.uid()) IS DISTINCT FROM p_family_id THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  RETURN QUERY
  SELECT t.id, COALESCE(t.descricao, t.description), COALESCE(t.valor, t.amount),
         COALESCE(t.data, t.date), t.created_at, t.source
  FROM public.transactions t
  WHERE t.family_id = p_family_id
    AND (p_account_id IS NULL OR t.account_id = p_account_id)
    AND COALESCE(t.data, t.date) = p_data
    AND COALESCE(t.valor, t.amount) = p_valor
    AND CASE COALESCE(t.tipo, t.type)
          WHEN 'expense' THEN 'despesa' WHEN 'income' THEN 'receita'
          ELSE COALESCE(t.tipo, t.type)
        END = p_tipo
    AND lower(trim(COALESCE(t.descricao, t.description))) = lower(trim(p_descricao))
  ORDER BY t.created_at DESC
  LIMIT 3;
END;
$$;

-- ============================================================================
-- 2. match_transaction_to_bill — auto-marks a pending bills_reminders row as
--    paid when a matching real transaction is created (manual entry today;
--    bank import once that lands). Without this, a reminder only clears when
--    the user pays it through the dedicated "Pagar" button in /contas-a-pagar
--    — if the same charge is entered any other way (quick add, a future CSV
--    import), the reminder is orphaned and sits "pendente" forever even
--    though it was actually paid. Found 3 real cases stuck like this during
--    audit (SAAE Água, TV Streaming, Spindola Gás, all past their due date).
--
--    Scoped to plain reminders (credit_card_bill_id IS NULL) — card bills
--    already have their own atomic pay_credit_card_bill() flow and are left
--    alone here to avoid double-touching that logic.
--
--    Matching is high-confidence only (exact amount, ±5 day window around
--    the due date, expense-type transactions) — same bar Securo's
--    recurring-match uses for its auto-link tier. Softer/fuzzy matching is
--    intentionally left out; a false auto-match silently hides a real unpaid
--    bill, which is worse than leaving it for the user to match by hand.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.match_transaction_to_bill(p_transaction_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tx public.transactions%ROWTYPE;
  v_tipo text;
  v_valor numeric;
  v_data date;
  v_bill_id uuid;
BEGIN
  SELECT * INTO v_tx FROM public.transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF public.get_user_family_id(auth.uid()) IS DISTINCT FROM v_tx.family_id THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  v_tipo := COALESCE(v_tx.tipo, v_tx.type);
  v_valor := COALESCE(v_tx.valor, v_tx.amount);
  v_data := COALESCE(v_tx.data, v_tx.date);

  IF v_tipo NOT IN ('despesa', 'expense') OR v_valor IS NULL OR v_data IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT br.id INTO v_bill_id
  FROM public.bills_reminders br
  WHERE br.family_id = v_tx.family_id
    AND br.status = 'pendente'
    AND br.credit_card_bill_id IS NULL
    AND br.transaction_id IS NULL
    AND (br.account_id IS NULL OR br.account_id = v_tx.account_id)
    AND COALESCE(br.valor, br.valor_estimado) = v_valor
    AND br.data_vencimento BETWEEN (v_data - INTERVAL '5 days') AND (v_data + INTERVAL '5 days')
  ORDER BY ABS(br.data_vencimento - v_data)
  LIMIT 1;

  IF v_bill_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.bills_reminders
  SET status = 'pago',
      transaction_id = p_transaction_id,
      valor = v_valor,
      account_id = COALESCE(account_id, v_tx.account_id)
  WHERE id = v_bill_id;

  RETURN v_bill_id;
END;
$$;
