// ============================================================
// CASINHA HUB — Helpers Supabase tipados
// Reduz os 88 'as any' e centraliza padrões de erro
// ============================================================
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Table = string;

/** Select com tipo genérico e tratamento de erro padronizado */
export async function dbSelect<T = unknown>(
  table: Table,
  query: (q: ReturnType<typeof supabase.from>) => Promise<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const { data, error } = await query(supabase.from(table as any));
  if (error) {
    console.error(`[db:${table}]`, error);
    return [];
  }
  return data ?? [];
}

/** Insert com toast automático de erro */
export async function dbInsert<T = unknown>(
  table: Table,
  payload: Record<string, unknown>,
  options?: { successMsg?: string; select?: boolean }
): Promise<T | null> {
  let q = supabase.from(table as any).insert(payload);
  if (options?.select) q = (q as any).select().single();
  const { data, error } = await (q as any);
  if (error) {
    toast.error(`Erro ao salvar: ${error.message}`);
    return null;
  }
  if (options?.successMsg) toast.success(options.successMsg);
  return data as T;
}

/** Update com toast automático */
export async function dbUpdate(
  table: Table,
  id: string,
  payload: Record<string, unknown>,
  options?: { successMsg?: string }
): Promise<boolean> {
  const { error } = await supabase.from(table as any).update(payload).eq('id', id);
  if (error) { toast.error(error.message); return false; }
  if (options?.successMsg) toast.success(options.successMsg);
  return true;
}

/** RPC tipado com tratamento de erro */
export async function dbRpc<T = unknown>(
  fn: string,
  params: Record<string, unknown> = {}
): Promise<T | null> {
  const { data, error } = await supabase.rpc(fn as any, params);
  if (error) {
    console.error(`[rpc:${fn}]`, error);
    return null;
  }
  return data as T;
}
