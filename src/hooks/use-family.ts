import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

interface FamilyData {
  familyId: string | null;
  familyName: string | null;
  loading: boolean;
  error: string | null;
}

// Cache simples em memória para evitar múltiplas queries
const cache = new Map<string, { familyId: string; familyName: string; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export function useFamily(): FamilyData {
  const { user, loading: authLoading } = useAuth();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [familyName, setFamilyName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }

    // Verificar cache
    const cached = cache.get(user.id);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setFamilyId(cached.familyId);
      setFamilyName(cached.familyName);
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: err } = await supabase
          .from('profiles')
          .select('family_id, families(nome)')
          .eq('id', user.id)
          .maybeSingle();

        if (err) throw err;

        const fid = data?.family_id ?? null;
        const fname = (data as any)?.families?.nome ?? null;

        setFamilyId(fid);
        setFamilyName(fname);

        if (fid) {
          cache.set(user.id, { familyId: fid, familyName: fname, ts: Date.now() });
        }
      } catch (e: any) {
        setError(e?.message ?? 'Erro ao carregar família');
      } finally {
        setLoading(false);
      }
    })();
  }, [user, authLoading]);

  return { familyId, familyName, loading, error };
}

// Limpar cache quando necessário (ex: após trocar de família)
export function clearFamilyCache() {
  cache.clear();
}
