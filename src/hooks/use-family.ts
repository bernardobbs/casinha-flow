import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

interface FamilyData {
  familyId: string | null;
  familyName: string | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// Cache em memória com suporte a invalidação seletiva
const cache = new Map<string, { familyId: string; familyName: string; ts: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos (era 5)

async function fetchFamily(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('family_id, families(nome)')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  const fid = data?.family_id ?? null;
  const fname = (data as Record<string, unknown> & { families?: { nome?: string } })?.families?.nome ?? null;
  if (fid) cache.set(userId, { familyId: fid, familyName: fname ?? '', ts: Date.now() });
  return { familyId: fid, familyName: fname };
}

export function useFamily(): FamilyData {
  const { user, loading: authLoading } = useAuth();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [familyName, setFamilyName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    if (!user) { setLoading(false); return; }
    const cached = cache.get(user.id);
    if (!force && cached && Date.now() - cached.ts < CACHE_TTL) {
      setFamilyId(cached.familyId);
      setFamilyName(cached.familyName);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFamily(user.id);
      setFamilyId(result.familyId);
      setFamilyName(result.familyName);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar família');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [user, authLoading, load]);

  return { familyId, familyName, loading, error, refetch: () => load(true) };
}

/** Limpar todo o cache (ex: logout) */
export function clearFamilyCache() { cache.clear(); }

/** Pré-carregar família em background */
export function prefetchFamily(userId: string) {
  const cached = cache.get(userId);
  if (!cached || Date.now() - cached.ts >= CACHE_TTL) {
    void fetchFamily(userId);
  }
}
