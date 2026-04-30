-- Enums for transaction classification
CREATE TYPE public.transaction_type AS ENUM ('income', 'expense');
CREATE TYPE public.transaction_source AS ENUM ('pix', 'cartao', 'boleto');
CREATE TYPE public.transaction_scope AS ENUM ('family', 'personal');

-- Transactions table
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  type public.transaction_type NOT NULL,
  source public.transaction_source NOT NULL,
  scope public.transaction_scope NOT NULL DEFAULT 'family',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_family_date ON public.transactions(family_id, date DESC);
CREATE INDEX idx_transactions_user ON public.transactions(user_id);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- View: family-scoped rows visible to all family members; personal rows only to the owner
CREATE POLICY "View family transactions or own personal"
ON public.transactions
FOR SELECT
USING (
  family_id = public.get_user_family_id(auth.uid())
  AND (scope = 'family' OR user_id = auth.uid())
);

-- Insert: must be the authoring user and within own family
CREATE POLICY "Insert own transactions in own family"
ON public.transactions
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND family_id = public.get_user_family_id(auth.uid())
);

-- Update: only the author may edit
CREATE POLICY "Update own transactions"
ON public.transactions
FOR UPDATE
USING (user_id = auth.uid());

-- Delete: author or family admin
CREATE POLICY "Delete own or admin transactions"
ON public.transactions
FOR DELETE
USING (
  user_id = auth.uid()
  OR public.is_family_admin(auth.uid(), family_id)
);

-- Updated_at trigger
CREATE TRIGGER update_transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();