-- Recreate source enum with new values (manual | importado | cartao)
ALTER TABLE public.transactions ALTER COLUMN source DROP DEFAULT;
ALTER TABLE public.transactions ALTER COLUMN source TYPE TEXT;
DROP TYPE IF EXISTS transaction_source;
CREATE TYPE transaction_source AS ENUM ('manual', 'importado', 'cartao');

-- Map any legacy values just in case
UPDATE public.transactions SET source = 'manual' WHERE source NOT IN ('manual','importado','cartao');

ALTER TABLE public.transactions
  ALTER COLUMN source TYPE transaction_source USING source::transaction_source;
ALTER TABLE public.transactions
  ALTER COLUMN source SET DEFAULT 'manual'::transaction_source;

-- Add is_essencial flag
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_essencial BOOLEAN NOT NULL DEFAULT false;