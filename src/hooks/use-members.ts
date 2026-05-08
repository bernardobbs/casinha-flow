import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Member {
  id: string;
  user_id: string;
  nome: string;
  icone: string;
  cor: string;
  role: 'admin' | 'member';
  tipo: 'auth' | 'local';
}

export function useMembers(familyId: string | null) {
  const [membros, setMembros] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!familyId) return;
    setLoading(true);
    supabase
      .from('family_members')
      .select('id, user_id, nome, icone, cor, role, tipo')
      .eq('family_id', familyId)
      .order('nome')
      .then(({ data }) => {
        setMembros((data ?? []) as Member[]);
        setLoading(false);
      });
  }, [familyId]);

  return { membros, loading };
}
