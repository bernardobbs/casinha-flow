ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS banco text,
  ADD COLUMN IF NOT EXISTS agencia text,
  ADD COLUMN IF NOT EXISTS numero_conta text,
  ADD COLUMN IF NOT EXISTS digito text,
  ADD COLUMN IF NOT EXISTS bandeira text,
  ADD COLUMN IF NOT EXISTS limite_cheque_especial numeric(14,2);