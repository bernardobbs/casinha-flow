-- Add 'importado' to source enum
ALTER TYPE transaction_source ADD VALUE IF NOT EXISTS 'importado';

-- Add category and external_id columns
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Unique index for dedup per family
CREATE UNIQUE INDEX IF NOT EXISTS transactions_family_external_id_unique
  ON public.transactions (family_id, external_id)
  WHERE external_id IS NOT NULL;