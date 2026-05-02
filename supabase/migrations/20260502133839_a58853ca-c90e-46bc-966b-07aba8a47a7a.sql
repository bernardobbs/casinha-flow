-- Enum for category type
CREATE TYPE public.category_type AS ENUM ('despesa', 'receita');

-- Categories table
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo public.category_type NOT NULL,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  cor TEXT NOT NULL DEFAULT '#9ca3af',
  icone TEXT NOT NULL DEFAULT '📦',
  is_essencial BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_family ON public.categories(family_id);
CREATE INDEX idx_categories_parent ON public.categories(parent_id);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View categories of own family"
ON public.categories FOR SELECT
USING (family_id = public.get_user_family_id(auth.uid()));

CREATE POLICY "Insert categories in own family"
ON public.categories FOR INSERT
WITH CHECK (family_id = public.get_user_family_id(auth.uid()));

CREATE POLICY "Update categories of own family"
ON public.categories FOR UPDATE
USING (family_id = public.get_user_family_id(auth.uid()));

CREATE POLICY "Delete categories of own family"
ON public.categories FOR DELETE
USING (family_id = public.get_user_family_id(auth.uid()));

CREATE TRIGGER update_categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add category_id to transactions
ALTER TABLE public.transactions
ADD COLUMN category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

CREATE INDEX idx_transactions_category ON public.transactions(category_id);

-- Function to seed default categories for a family
CREATE OR REPLACE FUNCTION public.seed_default_categories(_family_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.categories (family_id, nome, tipo, cor, icone, is_essencial, is_default) VALUES
    -- Despesas essenciais
    (_family_id, 'Alimentação', 'despesa', '#22c55e', '🛒', true, true),
    (_family_id, 'Moradia',     'despesa', '#3b82f6', '🏠', true, true),
    (_family_id, 'Transporte',  'despesa', '#f59e0b', '🚗', true, true),
    (_family_id, 'Saúde',       'despesa', '#ef4444', '💊', true, true),
    (_family_id, 'Educação',    'despesa', '#8b5cf6', '📚', true, true),
    (_family_id, 'Dívidas',     'despesa', '#dc2626', '💳', true, true),
    -- Despesas não-essenciais
    (_family_id, 'Lazer',        'despesa', '#06b6d4', '🎉', false, true),
    (_family_id, 'Assinaturas',  'despesa', '#64748b', '📱', false, true),
    (_family_id, 'Vestuário',    'despesa', '#ec4899', '👕', false, true),
    (_family_id, 'Outros',       'despesa', '#9ca3af', '📦', false, true),
    -- Receitas
    (_family_id, 'Salário',         'receita', '#16a34a', '💰', false, true),
    (_family_id, 'Freelance',       'receita', '#0ea5e9', '💼', false, true),
    (_family_id, 'Outros receita',  'receita', '#9ca3af', '➕', false, true);
END;
$$;

-- Update handle_new_user to also seed categories
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_family_id UUID;
  user_full_name TEXT;
  family_name TEXT;
BEGIN
  user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  family_name := COALESCE(NEW.raw_user_meta_data->>'family_name', 'Família ' || user_full_name);

  INSERT INTO public.families (name, created_by)
  VALUES (family_name, NEW.id)
  RETURNING id INTO new_family_id;

  INSERT INTO public.profiles (id, full_name, email, family_id)
  VALUES (NEW.id, user_full_name, NEW.email, new_family_id);

  INSERT INTO public.family_members (family_id, user_id, role)
  VALUES (new_family_id, NEW.id, 'admin');

  -- Seed default categories
  PERFORM public.seed_default_categories(new_family_id);

  RETURN NEW;
END;
$function$;

-- Backfill: seed default categories for existing families that don't have any
DO $$
DECLARE
  fam RECORD;
BEGIN
  FOR fam IN
    SELECT f.id FROM public.families f
    WHERE NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.family_id = f.id)
  LOOP
    PERFORM public.seed_default_categories(fam.id);
  END LOOP;
END $$;