// ============================================================
// CASINHA HUB — Hook: dados compartilhados da família
// Centraliza accounts + categories com cache simples
// Substitui as 12 queries repetidas sem cache pelo projeto
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AccountLite {
  id: string;
  nome: string;
  tipo: string;
  icone?: string;
  ativo: boolean;
}

export interface CategoryLite {
  id: string;
  nome: string;
  tipo: 'despesa' | 'receita';
  icone?: string;
  cor?: string;
  is_essencial: boolean;
  parent_id?: string | null;
}

// Cache em memória simples (5 min TTL)
const CACHE_TTL = 5 * 60 * 1000;
const cache: Record<string, { data: unknown; ts: number }> = {};

function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const entry = cache[key];
  if (entry && Date.now() - entry.ts < CACHE_TTL) return Promise.resolve(entry.data as T);
  return fn().then(data => { cache[key] = { data, ts: Date.now() }; return data; });
}

export function invalidateFamilyCache(familyId: string) {
  delete cache[`accounts:${familyId}`];
  delete cache[`categories:${familyId}`];
}

export function useFamilyData(familyId: string | null) {
  const [accounts, setAccounts] = useState<AccountLite[]>([]);
  const [categories, setCategories] = useState<CategoryLite[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!familyId) return;
    setLoading(true);
    const [accs, cats] = await Promise.all([
      cached(`accounts:${familyId}`, async () => {
        const { data } = await supabase
          .from('accounts')
          .select('id, nome, tipo, icone, ativo')
          .eq('family_id', familyId)
          .eq('ativo', true)
          .order('nome');
        return (data ?? []) as AccountLite[];
      }),
      cached(`categories:${familyId}`, async () => {
        const { data } = await supabase
          .from('categories')
          .select('id, nome, tipo, icone, cor, is_essencial, parent_id')
          .eq('family_id', familyId)
          .order('nome');
        return (data ?? []) as CategoryLite[];
      }),
    ]);
    setAccounts(accs);
    setCategories(cats);
    setLoading(false);
  }, [familyId]);

  useEffect(() => { load(); }, [load]);

  const expenseCategories = categories.filter(c => c.tipo === 'despesa');
  const incomeCategories = categories.filter(c => c.tipo === 'receita');

  return { accounts, categories, expenseCategories, incomeCategories, loading, reload: load };
}
