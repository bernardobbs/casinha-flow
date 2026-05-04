-- Corrigir funções que checam 'cartao_credito' mas o enum usa 'cartao'

CREATE OR REPLACE FUNCTION public.allocate_credit_card_bill()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_acc public.accounts;
  v_fatura_mes DATE;
  v_bill_id UUID;
  v_venc DATE;
BEGIN
  IF NEW.account_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_acc FROM public.accounts WHERE id = NEW.account_id;
  IF v_acc IS NULL OR v_acc.tipo <> 'cartao' THEN RETURN NEW; END IF;
  IF NEW.tipo_especial = 'pagamento_fatura' THEN RETURN NEW; END IF;
  IF NEW.type <> 'expense' THEN RETURN NEW; END IF;

  IF v_acc.dia_fechamento IS NOT NULL AND EXTRACT(DAY FROM NEW.date) <> 1 THEN
    IF EXTRACT(DAY FROM NEW.date) <= v_acc.dia_fechamento THEN
      v_fatura_mes := date_trunc('month', NEW.date)::date;
    ELSE
      v_fatura_mes := (date_trunc('month', NEW.date) + INTERVAL '1 month')::date;
    END IF;
  ELSE
    v_fatura_mes := date_trunc('month', NEW.date)::date;
  END IF;

  IF v_acc.dia_vencimento IS NOT NULL THEN
    v_venc := (v_fatura_mes + ((LEAST(v_acc.dia_vencimento, 28) - 1) || ' day')::interval)::date;
  END IF;

  SELECT id INTO v_bill_id FROM public.credit_card_bills
    WHERE family_id = NEW.family_id AND account_id = NEW.account_id AND mes_referencia = v_fatura_mes;

  IF v_bill_id IS NULL THEN
    INSERT INTO public.credit_card_bills
      (family_id, account_id, mes_referencia, valor_total, valor_pago, data_vencimento, status)
    VALUES
      (NEW.family_id, NEW.account_id, v_fatura_mes, NEW.amount, 0, v_venc, 'aberta');
  ELSE
    UPDATE public.credit_card_bills
      SET valor_total = valor_total + NEW.amount, updated_at = now()
      WHERE id = v_bill_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- Trigger não estava criado — criar agora
DROP TRIGGER IF EXISTS trg_allocate_credit_card_bill ON public.transactions;
CREATE TRIGGER trg_allocate_credit_card_bill
  AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.allocate_credit_card_bill();

CREATE OR REPLACE FUNCTION public.create_installment_plan(_family_id uuid, _account_id uuid, _description text, _valor_total numeric, _total_parcelas smallint, _data_compra date, _category_id uuid DEFAULT NULL::uuid, _is_essencial boolean DEFAULT false)
 RETURNS installment_plans
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_acc public.accounts;
  v_plan public.installment_plans;
  v_first_fatura DATE;
  v_valor_parcela NUMERIC(14,2);
  v_valor_ultima NUMERIC(14,2);
  v_tx_id UUID;
  i SMALLINT;
  v_fatura DATE;
  v_valor NUMERIC(14,2);
BEGIN
  IF public.get_user_family_id(auth.uid()) IS DISTINCT FROM _family_id THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;
  SELECT * INTO v_acc FROM public.accounts WHERE id = _account_id AND family_id = _family_id;
  IF v_acc IS NULL THEN RAISE EXCEPTION 'Conta não encontrada'; END IF;
  IF v_acc.tipo <> 'cartao' THEN RAISE EXCEPTION 'Parcelamento exige conta do tipo cartão'; END IF;
  IF v_acc.dia_fechamento IS NULL THEN RAISE EXCEPTION 'Cartão sem dia de fechamento configurado'; END IF;

  IF EXTRACT(DAY FROM _data_compra) <= v_acc.dia_fechamento THEN
    v_first_fatura := date_trunc('month', _data_compra)::date;
  ELSE
    v_first_fatura := (date_trunc('month', _data_compra) + INTERVAL '1 month')::date;
  END IF;

  v_valor_parcela := ROUND(_valor_total / _total_parcelas, 2);
  v_valor_ultima := _valor_total - (v_valor_parcela * (_total_parcelas - 1));

  INSERT INTO public.installment_plans
    (family_id, user_id, account_id, category_id, description, valor_total, total_parcelas, data_compra, is_essencial)
  VALUES
    (_family_id, auth.uid(), _account_id, _category_id, _description, _valor_total, _total_parcelas, _data_compra, _is_essencial)
  RETURNING * INTO v_plan;

  FOR i IN 1.._total_parcelas LOOP
    v_fatura := (v_first_fatura + ((i - 1) || ' month')::interval)::date;
    v_valor := CASE WHEN i = _total_parcelas THEN v_valor_ultima ELSE v_valor_parcela END;

    INSERT INTO public.transactions
      (family_id, user_id, account_id, category_id, type, amount, description, date, is_essencial, source, tipo_especial)
    VALUES
      (_family_id, auth.uid(), _account_id, _category_id, 'expense', v_valor,
       _description || ' (' || i || '/' || _total_parcelas || ')',
       v_fatura, _is_essencial, 'manual', 'normal')
    RETURNING id INTO v_tx_id;

    INSERT INTO public.installments (plan_id, numero, valor, fatura_mes, transaction_id)
    VALUES (v_plan.id, i, v_valor, v_fatura, v_tx_id);
  END LOOP;

  RETURN v_plan;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_credit_card_bill_alerts(_family_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  v_today DATE := CURRENT_DATE;
  v_close_date DATE;
  v_days_close INT;
  v_days_due INT;
BEGIN
  IF public.get_user_family_id(auth.uid()) IS DISTINCT FROM _family_id THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  FOR rec IN
    SELECT a.id AS account_id, a.nome, a.dia_fechamento, a.dia_vencimento,
           b.id AS bill_id, b.mes_referencia, b.data_vencimento, b.status, b.valor_total, b.valor_pago
    FROM public.accounts a
    LEFT JOIN public.credit_card_bills b
      ON b.account_id = a.id AND b.family_id = a.family_id
      AND b.mes_referencia = date_trunc('month', v_today)::date
    WHERE a.family_id = _family_id AND a.tipo = 'cartao' AND a.ativo = true
  LOOP
    IF rec.dia_fechamento IS NOT NULL THEN
      v_close_date := (date_trunc('month', v_today) + ((LEAST(rec.dia_fechamento,28) - 1) || ' day')::interval)::date;
      IF v_close_date < v_today THEN
        v_close_date := (date_trunc('month', v_today) + INTERVAL '1 month' + ((LEAST(rec.dia_fechamento,28) - 1) || ' day')::interval)::date;
      END IF;
      v_days_close := v_close_date - v_today;
      IF v_days_close BETWEEN 0 AND 5 THEN
        PERFORM public.create_alert(_family_id, 'card_closing_soon',
          '🟡 Fatura ' || rec.nome || ' fecha em ' || v_days_close || ' dia(s)',
          'warning', rec.account_id, 'account');
      END IF;
    END IF;

    IF rec.bill_id IS NOT NULL AND rec.status <> 'paga' AND rec.data_vencimento IS NOT NULL THEN
      v_days_due := rec.data_vencimento - v_today;
      IF v_days_due < 0 THEN
        PERFORM public.create_alert(_family_id, 'card_overdue',
          '🔴 Fatura ' || rec.nome || ' atrasada há ' || abs(v_days_due) || ' dia(s)',
          'critical', rec.bill_id, 'credit_card_bill');
      ELSIF v_days_due = 0 THEN
        PERFORM public.create_alert(_family_id, 'card_due_today',
          '🔴 Fatura ' || rec.nome || ' vence hoje',
          'critical', rec.bill_id, 'credit_card_bill');
      ELSIF v_days_due BETWEEN 1 AND 3 THEN
        PERFORM public.create_alert(_family_id, 'card_due_soon',
          '🔴 Fatura ' || rec.nome || ' vence em ' || v_days_due || ' dia(s)',
          'critical', rec.bill_id, 'credit_card_bill');
      END IF;
    END IF;
  END LOOP;
END;
$function$;