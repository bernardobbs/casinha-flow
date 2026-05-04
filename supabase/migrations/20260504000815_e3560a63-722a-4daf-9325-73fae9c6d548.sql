-- =========================================================
-- PARCELAMENTO + TRIGGER DE FATURA + ALERTAS DE FATURA
-- =========================================================

-- Tabela: installment_plans (plano de parcelamento)
CREATE TABLE public.installment_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL,
  user_id UUID NOT NULL,
  account_id UUID NOT NULL,
  category_id UUID,
  description TEXT NOT NULL,
  valor_total NUMERIC(14,2) NOT NULL CHECK (valor_total > 0),
  total_parcelas SMALLINT NOT NULL CHECK (total_parcelas BETWEEN 2 AND 36),
  data_compra DATE NOT NULL DEFAULT CURRENT_DATE,
  is_essencial BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_installment_plans_family ON public.installment_plans(family_id);
CREATE INDEX idx_installment_plans_account ON public.installment_plans(account_id);

ALTER TABLE public.installment_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own family installment plans" ON public.installment_plans
  FOR SELECT USING (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "Insert own family installment plans" ON public.installment_plans
  FOR INSERT WITH CHECK (family_id = public.get_user_family_id(auth.uid()) AND user_id = auth.uid());
CREATE POLICY "Update own family installment plans" ON public.installment_plans
  FOR UPDATE USING (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "Delete own family installment plans" ON public.installment_plans
  FOR DELETE USING (family_id = public.get_user_family_id(auth.uid()));

CREATE TRIGGER installment_plans_updated
  BEFORE UPDATE ON public.installment_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela: installments (parcelas individuais)
CREATE TABLE public.installments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.installment_plans(id) ON DELETE CASCADE,
  numero SMALLINT NOT NULL,
  valor NUMERIC(14,2) NOT NULL,
  fatura_mes DATE NOT NULL,
  transaction_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, numero)
);

CREATE INDEX idx_installments_plan ON public.installments(plan_id);
CREATE INDEX idx_installments_fatura ON public.installments(fatura_mes);

ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own family installments" ON public.installments
  FOR SELECT USING (plan_id IN (SELECT id FROM public.installment_plans WHERE family_id = public.get_user_family_id(auth.uid())));
CREATE POLICY "Insert own family installments" ON public.installments
  FOR INSERT WITH CHECK (plan_id IN (SELECT id FROM public.installment_plans WHERE family_id = public.get_user_family_id(auth.uid())));
CREATE POLICY "Update own family installments" ON public.installments
  FOR UPDATE USING (plan_id IN (SELECT id FROM public.installment_plans WHERE family_id = public.get_user_family_id(auth.uid())));
CREATE POLICY "Delete own family installments" ON public.installments
  FOR DELETE USING (plan_id IN (SELECT id FROM public.installment_plans WHERE family_id = public.get_user_family_id(auth.uid())));

-- =========================================================
-- RPC: criar plano de parcelamento (gera plan + installments + transactions)
-- Regra: dia_compra <= dia_fechamento -> fatura do mês atual
--        dia_compra >  dia_fechamento -> fatura do próximo mês
-- =========================================================
CREATE OR REPLACE FUNCTION public.create_installment_plan(
  _family_id UUID,
  _account_id UUID,
  _description TEXT,
  _valor_total NUMERIC,
  _total_parcelas SMALLINT,
  _data_compra DATE,
  _category_id UUID DEFAULT NULL,
  _is_essencial BOOLEAN DEFAULT false
)
RETURNS installment_plans
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acc public.accounts;
  v_plan public.installment_plans;
  v_first_fatura DATE;
  v_valor_parcela NUMERIC(14,2);
  v_valor_ultima NUMERIC(14,2);
  v_tx_id UUID;
  v_inst_id UUID;
  v_total_distrib NUMERIC(14,2) := 0;
  i SMALLINT;
  v_fatura DATE;
  v_valor NUMERIC(14,2);
BEGIN
  IF public.get_user_family_id(auth.uid()) IS DISTINCT FROM _family_id THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  SELECT * INTO v_acc FROM public.accounts WHERE id = _account_id AND family_id = _family_id;
  IF v_acc IS NULL THEN RAISE EXCEPTION 'Conta não encontrada'; END IF;
  IF v_acc.tipo <> 'cartao_credito' THEN RAISE EXCEPTION 'Parcelamento exige conta do tipo cartão'; END IF;
  IF v_acc.dia_fechamento IS NULL THEN RAISE EXCEPTION 'Cartão sem dia de fechamento configurado'; END IF;

  -- Calcula primeira fatura
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
$$;

-- =========================================================
-- TRIGGER: aloca transações de cartão na credit_card_bills correta
-- =========================================================
CREATE OR REPLACE FUNCTION public.allocate_credit_card_bill()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acc public.accounts;
  v_fatura_mes DATE;
  v_bill_id UUID;
  v_venc DATE;
BEGIN
  IF NEW.account_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_acc FROM public.accounts WHERE id = NEW.account_id;
  IF v_acc IS NULL OR v_acc.tipo <> 'cartao_credito' THEN RETURN NEW; END IF;
  IF NEW.tipo_especial = 'pagamento_fatura' THEN RETURN NEW; END IF;
  IF NEW.type <> 'expense' THEN RETURN NEW; END IF;

  -- Para parcelamento já gravamos NEW.date como fatura_mes (dia 1).
  -- Para compra normal, recalcula:
  IF v_acc.dia_fechamento IS NOT NULL AND EXTRACT(DAY FROM NEW.date) <> 1 THEN
    IF EXTRACT(DAY FROM NEW.date) <= v_acc.dia_fechamento THEN
      v_fatura_mes := date_trunc('month', NEW.date)::date;
    ELSE
      v_fatura_mes := (date_trunc('month', NEW.date) + INTERVAL '1 month')::date;
    END IF;
  ELSE
    v_fatura_mes := date_trunc('month', NEW.date)::date;
  END IF;

  -- Vencimento estimado
  IF v_acc.dia_vencimento IS NOT NULL THEN
    v_venc := (v_fatura_mes + ((LEAST(v_acc.dia_vencimento, 28) - 1) || ' day')::interval)::date;
  END IF;

  -- Upsert da fatura
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
$$;

CREATE TRIGGER trg_allocate_credit_card_bill
  AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.allocate_credit_card_bill();

-- =========================================================
-- RPC: transferência entre contas
-- =========================================================
CREATE OR REPLACE FUNCTION public.create_transfer(
  _family_id UUID,
  _from_account UUID,
  _to_account UUID,
  _amount NUMERIC,
  _date DATE DEFAULT CURRENT_DATE,
  _description TEXT DEFAULT 'Transferência'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ext TEXT := 'transfer-' || gen_random_uuid()::text;
BEGIN
  IF public.get_user_family_id(auth.uid()) IS DISTINCT FROM _family_id THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;
  IF _from_account = _to_account THEN RAISE EXCEPTION 'Contas iguais'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Valor inválido'; END IF;

  INSERT INTO public.transactions
    (family_id, user_id, account_id, type, amount, description, date, source, tipo_especial, external_id)
  VALUES
    (_family_id, auth.uid(), _from_account, 'expense', _amount,
     _description || ' (saída)', _date, 'manual', 'transferencia', v_ext);

  INSERT INTO public.transactions
    (family_id, user_id, account_id, type, amount, description, date, source, tipo_especial, external_id)
  VALUES
    (_family_id, auth.uid(), _to_account, 'income', _amount,
     _description || ' (entrada)', _date, 'manual', 'transferencia', v_ext);

  PERFORM public.recalc_account_balance(_from_account);
  PERFORM public.recalc_account_balance(_to_account);
END;
$$;

-- =========================================================
-- RPC: pagar fatura
-- =========================================================
CREATE OR REPLACE FUNCTION public.pay_credit_card_bill(
  _bill_id UUID,
  _from_account UUID,
  _amount NUMERIC,
  _date DATE DEFAULT CURRENT_DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill public.credit_card_bills;
BEGIN
  SELECT * INTO v_bill FROM public.credit_card_bills WHERE id = _bill_id;
  IF v_bill IS NULL THEN RAISE EXCEPTION 'Fatura não encontrada'; END IF;
  IF public.get_user_family_id(auth.uid()) IS DISTINCT FROM v_bill.family_id THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  -- Saída na conta origem
  INSERT INTO public.transactions
    (family_id, user_id, account_id, type, amount, description, date, source, tipo_especial)
  VALUES
    (v_bill.family_id, auth.uid(), _from_account, 'expense', _amount,
     'Pagamento fatura ' || to_char(v_bill.mes_referencia, 'MM/YYYY'),
     _date, 'manual', 'pagamento_fatura');

  -- Entrada no cartão (reduz dívida)
  INSERT INTO public.transactions
    (family_id, user_id, account_id, type, amount, description, date, source, tipo_especial)
  VALUES
    (v_bill.family_id, auth.uid(), v_bill.account_id, 'income', _amount,
     'Pagamento fatura ' || to_char(v_bill.mes_referencia, 'MM/YYYY'),
     _date, 'manual', 'pagamento_fatura');

  UPDATE public.credit_card_bills
    SET valor_pago = valor_pago + _amount,
        status = CASE WHEN valor_pago + _amount >= valor_total THEN 'paga'::credit_card_bill_status ELSE status END,
        updated_at = now()
    WHERE id = _bill_id;

  PERFORM public.recalc_account_balance(_from_account);
  PERFORM public.recalc_account_balance(v_bill.account_id);
END;
$$;

-- =========================================================
-- RPC: verificar e gerar alertas de fatura (chamada ao abrir /contas)
-- =========================================================
CREATE OR REPLACE FUNCTION public.check_credit_card_bill_alerts(_family_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_today DATE := CURRENT_DATE;
  v_close_date DATE;
  v_due_date DATE;
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
    WHERE a.family_id = _family_id AND a.tipo = 'cartao_credito' AND a.ativo = true
  LOOP
    -- Fechamento (próximo)
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

    -- Vencimento
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
$$;