import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AlertTriangle } from "lucide-react";

interface CrisisRow {
  id: string;
  estagio_atual: number;
  data_inicio: string;
  ativo: boolean;
}

export function CrisisBanner() {
  const { user } = useAuth();
  const [crisis, setCrisis] = useState<CrisisRow | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("family_id")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile?.family_id) return;

      const { data } = await supabase
        .from("crisis_events")
        .select("id, estagio_atual, data_inicio, ativo")
        .eq("family_id", profile.family_id)
        .eq("ativo", true)
        .maybeSingle();

      if (!cancelled) setCrisis(data ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!crisis) return null;

  const days = Math.max(
    1,
    Math.floor(
      (Date.now() - new Date(crisis.data_inicio + "T00:00:00").getTime()) /
        (1000 * 60 * 60 * 24),
    ) + 1,
  );

  return (
    <Link
      to="/crisis"
      className="block border-b border-destructive/40"
      style={{
        background:
          "color-mix(in oklab, var(--destructive) 14%, transparent)",
      }}
    >
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span
              className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
              style={{ background: "var(--destructive)" }}
            />
            <span
              className="relative inline-flex h-3 w-3 rounded-full"
              style={{ background: "var(--destructive)" }}
            />
          </span>
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <p className="text-sm font-medium">
            ⚠️ MODO CRISE ATIVO — Estágio {crisis.estagio_atual}
          </p>
        </div>
        <p className="text-xs text-muted-foreground hidden sm:block">
          {days} {days === 1 ? "dia" : "dias"} em crise · clique para gerenciar
        </p>
      </div>
    </Link>
  );
}
