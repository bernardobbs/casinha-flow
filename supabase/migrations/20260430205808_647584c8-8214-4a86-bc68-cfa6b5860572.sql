
-- Enum para papéis do membro na família
CREATE TYPE public.family_role AS ENUM ('admin', 'member');

-- Tabela de famílias
CREATE TABLE public.families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de perfis (espelha auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de membros da família com papéis
CREATE TABLE public.family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.family_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (family_id, user_id)
);

-- Habilita RLS
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- Função para obter a família do usuário (security definer evita recursão de RLS)
CREATE OR REPLACE FUNCTION public.get_user_family_id(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT family_id FROM public.profiles WHERE id = _user_id;
$$;

-- Função para checar se usuário é admin da família
CREATE OR REPLACE FUNCTION public.is_family_admin(_user_id UUID, _family_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE user_id = _user_id AND family_id = _family_id AND role = 'admin'
  );
$$;

-- RLS: profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can view family members profiles"
  ON public.profiles FOR SELECT
  USING (family_id IS NOT NULL AND family_id = public.get_user_family_id(auth.uid()));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS: families
CREATE POLICY "Users can view their family"
  ON public.families FOR SELECT
  USING (id = public.get_user_family_id(auth.uid()));

CREATE POLICY "Users can create families"
  ON public.families FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Family admins can update family"
  ON public.families FOR UPDATE
  USING (public.is_family_admin(auth.uid(), id));

-- RLS: family_members
CREATE POLICY "Users can view members of their family"
  ON public.family_members FOR SELECT
  USING (family_id = public.get_user_family_id(auth.uid()));

CREATE POLICY "Users can insert themselves into a family"
  ON public.family_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Family admins can manage members"
  ON public.family_members FOR DELETE
  USING (public.is_family_admin(auth.uid(), family_id));

-- Trigger: atualiza updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_families_updated_at
  BEFORE UPDATE ON public.families
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: ao criar usuário, cria perfil + família + membership automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_family_id UUID;
  user_full_name TEXT;
  family_name TEXT;
BEGIN
  user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  family_name := COALESCE(NEW.raw_user_meta_data->>'family_name', 'Família ' || user_full_name);

  -- Cria a família
  INSERT INTO public.families (name, created_by)
  VALUES (family_name, NEW.id)
  RETURNING id INTO new_family_id;

  -- Cria o perfil já vinculado à família
  INSERT INTO public.profiles (id, full_name, email, family_id)
  VALUES (NEW.id, user_full_name, NEW.email, new_family_id);

  -- Adiciona como admin da família
  INSERT INTO public.family_members (family_id, user_id, role)
  VALUES (new_family_id, NEW.id, 'admin');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
