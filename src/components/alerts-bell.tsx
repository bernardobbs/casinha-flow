import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Bell, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";

type Severity = "info" | "warning" | "critical";

interface Alert {
  id: string;
  tipo: string;
  mensagem: string;
  severidade: Severity;
  lido: boolean;
  created_at: string;
}

const sevColor: Record<Severity, string> = {
  info: "var(--primary)",
  warning: "#f59e0b",
  critical: "var(--destructive)",
};

export function AlertsBell() {
  const { user } = useAuth();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async (fid: string) => {
    const { data } = await supabase
      .from("alerts")
      .select("id, tipo, mensagem, severidade, lido, created_at")
      .eq("family_id", fid)
      .order("created_at", { ascending: false })
      .limit(30);
    setAlerts((data ?? []) as Alert[]);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("family_id")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile?.family_id || cancelled) return;
      const fid = profile.family_id;
      setFamilyId(fid);
      await load(fid);

      // Realtime subscription
      const channel = supabase
        .channel(`alerts-${fid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "alerts",
            filter: `family_id=eq.${fid}`,
          },
          () => void load(fid),
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    })();
    return () => {
      cancelled = true;
    };
  }, [user, load]);

  const unread = alerts.filter((a) => !a.lido).length;

  const markRead = async (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, lido: true } : a)),
    );
    const { error } = await supabase
      .from("alerts")
      .update({ lido: true })
      .eq("id", id);
    if (error) toast.error("Não foi possível marcar como lido");
  };

  const markAllRead = async () => {
    if (!familyId) return;
    setAlerts((prev) => prev.map((a) => ({ ...a, lido: true })));
    await supabase
      .from("alerts")
      .update({ lido: true })
      .eq("family_id", familyId)
      .eq("lido", false);
  };

  const dismiss = async (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    await supabase.from("alerts").delete().eq("id", id);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Alertas">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full text-[10px] font-semibold flex items-center justify-center text-white"
              style={{ background: "var(--destructive)" }}
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <p className="text-sm font-semibold">Alertas</p>
            <p className="text-xs text-muted-foreground">
              {unread > 0 ? `${unread} não lido(s)` : "Tudo em dia"}
            </p>
          </div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead}>
              Marcar todos
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {alerts.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum alerta no momento.
            </div>
          )}
          {alerts.map((a) => (
            <div
              key={a.id}
              className="px-4 py-3 border-b border-border/60 last:border-0 flex gap-3 items-start"
              style={{
                background: a.lido
                  ? "transparent"
                  : "color-mix(in oklab, var(--primary) 4%, transparent)",
              }}
            >
              <span
                className="mt-1 h-2 w-2 rounded-full flex-shrink-0"
                style={{ background: sevColor[a.severidade] }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-snug">{a.mensagem}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {new Date(a.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                {!a.lido && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => markRead(a.id)}
                    aria-label="Marcar como lido"
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => dismiss(a.id)}
                  aria-label="Descartar"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
