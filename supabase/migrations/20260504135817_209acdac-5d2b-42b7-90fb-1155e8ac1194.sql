-- ========= recurring_transactions =========
DO $$ BEGIN
  CREATE TYPE public.recurring_frequency AS ENUM ('mensal','semanal','quinzenal','anual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.recurring_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  user_id uuid NOT NULL,
  description text NOT NULL,
  amount numeric(14,2) NOT NULL,
  type transaction_type NOT NULL,
  frequencia public.recurring_frequency NOT NULL DEFAULT 'mensal',
  dia_do_mes smallint,
  proxima_data date NOT NULL DEFAULT CURRENT_DATE,
  ultima_geracao date,
  ativo boolean NOT NULL DEFAULT true,
  account_id uuid,
  category_id uuid,
  is_essencial boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own family recurring" ON public.recurring_transactions
  FOR SELECT USING (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "Insert own family recurring" ON public.recurring_transactions
  FOR INSERT WITH CHECK (family_id = public.get_user_family_id(auth.uid()) AND user_id = auth.uid());
CREATE POLICY "Update own family recurring" ON public.recurring_transactions
  FOR UPDATE USING (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "Delete own family recurring" ON public.recurring_transactions
  FOR DELETE USING (family_id = public.get_user_family_id(auth.uid()));

CREATE TRIGGER recurring_set_updated_at
  BEFORE UPDATE ON public.recurring_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========= weekly_reviews =========
CREATE TABLE IF NOT EXISTS public.weekly_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  user_id uuid NOT NULL,
  fechado_em timestamptz NOT NULL DEFAULT now(),
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.weekly_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own family reviews" ON public.weekly_reviews
  FOR SELECT USING (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "Insert own family reviews" ON public.weekly_reviews
  FOR INSERT WITH CHECK (family_id = public.get_user_family_id(auth.uid()) AND user_id = auth.uid());

-- ========= RPC generate_recurring_transactions =========
CREATE OR REPLACE FUNCTION public.generate_recurring_transactions(p_family_id uuid)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rec RECORD;
  v_today date := CURRENT_DATE;
  v_next date;
  v_count int := 0;
  v_dup boolean;
  v_ext text;
BEGIN
  IF public.get_user_family_id(auth.uid()) IS DISTINCT FROM p_family_id THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  FOR rec IN
    SELECT * FROM public.recurring_transactions
    WHERE family_id = p_family_id AND ativo = true AND proxima_data <= v_today
  LOOP
    -- Loop até alcançar hoje (cobre múltiplos vencimentos perdidos)
    WHILE rec.proxima_data <= v_today LOOP
      v_ext := 'recurring-' || rec.id::text || '-' || rec.proxima_data::text;
      SELECT EXISTS (
        SELECT 1 FROM public.transactions
        WHERE family_id = p_family_id AND external_id = v_ext
      ) INTO v_dup;

      IF NOT v_dup THEN
        INSERT INTO public.transactions
          (family_id, user_id, account_id, category_id, type, amount, description,
           date, is_essencial, source, tipo_especial, external_id)
        VALUES
          (p_family_id, rec.user_id, rec.account_id, rec.category_id, rec.type, rec.amount,
           rec.description, rec.proxima_data, rec.is_essencial, 'manual', 'normal', v_ext);
        v_count := v_count + 1;
      END IF;

      v_next := CASE rec.frequencia
        WHEN 'mensal'     THEN (rec.proxima_data + INTERVAL '1 month')::date
        WHEN 'semanal'    THEN (rec.proxima_data + INTERVAL '7 days')::date
        WHEN 'quinzenal'  THEN (rec.proxima_data + INTERVAL '14 days')::date
        WHEN 'anual'      THEN (rec.proxima_data + INTERVAL '1 year')::date
      END;
      rec.proxima_data := v_next;
    END LOOP;

    UPDATE public.recurring_transactions
      SET proxima_data = v_next, ultima_geracao = v_today, updated_at = now()
      WHERE id = rec.id;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ========= RPC check_bills_alerts =========
CREATE OR REPLACE FUNCTION public.check_bills_alerts(p_family_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rec RECORD;
  v_today date := CURRENT_DATE;
  v_dias int;
BEGIN
  IF public.get_user_family_id(auth.uid()) IS DISTINCT FROM p_family_id THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  -- Marca atrasadas
  UPDATE public.bills_reminders
    SET status = 'atrasado', updated_at = now()
    WHERE family_id = p_family_id AND status = 'pendente' AND data_vencimento < v_today;

  FOR rec IN
    SELECT id, descricao, valor, data_vencimento, status FROM public.bills_reminders
    WHERE family_id = p_family_id AND status IN ('pendente','atrasado')
      AND data_vencimento <= (v_today + INTERVAL '3 days')
  LOOP
    v_dias := rec.data_vencimento - v_today;
    IF v_dias < 0 THEN
      PERFORM public.create_alert(p_family_id, 'bill_overdue',
        '🔴 ' || rec.descricao || ' atrasada há ' || abs(v_dias) || ' dia(s)',
        'critical', rec.id, 'bills_reminder');
    ELSIF v_dias = 0 THEN
      PERFORM public.create_alert(p_family_id, 'bill_due_today',
        '🟠 ' || rec.descricao || ' vence hoje',
        'critical', rec.id, 'bills_reminder');
    ELSE
      PERFORM public.create_alert(p_family_id, 'bill_due_soon',
        '🟡 ' || rec.descricao || ' vence em ' || v_dias || ' dia(s)',
        'warning', rec.id, 'bills_reminder');
    END IF;
  END LOOP;
END;
$$;