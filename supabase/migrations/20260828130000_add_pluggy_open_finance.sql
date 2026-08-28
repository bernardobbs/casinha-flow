-- ============================================================================
-- Suporte a Open Finance via Meu Pluggy: cada "item" da Pluggy é uma conexão
-- com um banco (login feito no portal deles, não aqui). Guardamos o item_id
-- pra saber quais bancos a família já conectou, e vinculamos cada conta
-- retornada pela Pluggy a uma linha existente (ou nova) em accounts — sem
-- vínculo automático, porque o usuário já tem contas cadastradas manualmente
-- e criar duplicata seria pior que pedir pra ele mapear uma vez.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pluggy_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  item_id text NOT NULL,
  connector_name text,
  status text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_id, item_id)
);
ALTER TABLE public.pluggy_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own family pluggy_items" ON public.pluggy_items
  FOR SELECT USING (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "Insert own family pluggy_items" ON public.pluggy_items
  FOR INSERT WITH CHECK (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "Update own family pluggy_items" ON public.pluggy_items
  FOR UPDATE USING (family_id = public.get_user_family_id(auth.uid()));
CREATE POLICY "Delete own family pluggy_items" ON public.pluggy_items
  FOR DELETE USING (family_id = public.get_user_family_id(auth.uid()));

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS pluggy_account_id text,
  ADD COLUMN IF NOT EXISTS pluggy_item_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_pluggy_account_id
  ON public.accounts(family_id, pluggy_account_id)
  WHERE pluggy_account_id IS NOT NULL;
