
-- Corrige search_path em update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Revoga execução pública das SECURITY DEFINER (somente authenticated/service_role)
REVOKE EXECUTE ON FUNCTION public.get_user_family_id(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_family_admin(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_user_family_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_family_admin(UUID, UUID) TO authenticated;
