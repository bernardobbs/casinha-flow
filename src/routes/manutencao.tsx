import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFamily } from "@/hooks/use-family";
import { useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Wrench, Plus, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { SkeletonPage } from "@/components/skeletons";
import { fmtBRL } from '@/lib/format';

export const Route = createFileRoute("/manutencao")({
  head: () => ({ meta: [{ title: "Manutenção — Casinha Hub" }] }),
  component: ManutencaoPage,
});

type Task = {
  id: string; titulo: string; categoria: string;
  prioridade: string; status: string; responsavel: string | null;
  custo_estimado: number | null; data_prevista: string | null;
  dias_atraso: number;
};

const PRIORIDADE_COR: Record<string, string> = {
  urgente: "bg-red-500/15 text-red-700 border-red-300",
  alta: "bg-orange-500/15 text-orange-700 border-orange-300",
  media: "bg-yellow-500/15 text-yellow-700 border-yellow-300",
  baixa: "bg-muted text-muted-foreground",
};
const PRIORIDADE_LABEL: Record<string, string> = {
  urgente: "🚨 Urgente", alta: "🔴 Alta", media: "🟡 Média", baixa: "🟢 Baixa",
};
const CAT_EMOJI: Record<string, string> = {
  eletrica: "⚡", hidraulica: "💧", pintura: "🖌️",
  limpeza: "🧹", jardim: "🌿", eletrodomestico: "🔌",
  geral: "🔧", outros: "📦",
};
const fmtDate = (d: string | null) =>
  d ? new Date(d + "T12:00").toLocaleDateString("pt-BR") : "—";

function ManutencaoPage() {
  const { user, loading: authLoading } = useAuth();
  const { familyId, loading: familyLoading } = useFamily();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!familyId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.rpc("get_manutencao_pendente" as any, {
        p_family_id: familyId,
      });
      setTasks((data as any) ?? []);
      setLoading(false);
    })();
  }, [familyId]);

  const concluir = async (id: string) => {
    const { error } = await supabase.from("maintenance_tasks" as any)
      .update({ status: "concluida", data_conclusao: new Date().toISOString().slice(0, 10) })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("✅ Tarefa concluída!");
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  if (authLoading || familyLoading || loading) return <SkeletonPage />;

  const urgentes = tasks.filter(t => t.prioridade === "urgente" || t.prioridade === "alta");
  const demais = tasks.filter(t => t.prioridade !== "urgente" && t.prioridade !== "alta");

  return (
    <div className="min-h-screen p-4" style={{ background: "var(--gradient-subtle)" }}>
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
              <Wrench className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Manutenção</h1>
              <p className="text-sm text-muted-foreground">{tasks.length} tarefa{tasks.length !== 1 ? "s" : ""} pendente{tasks.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>

        {tasks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500 opacity-60" />
              <p className="font-medium">Nenhuma manutenção pendente</p>
              <p className="text-sm mt-1">A casa está em dia! 🏠</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {urgentes.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-orange-500" /> Prioritárias
                </p>
                {urgentes.map(t => <TaskCard key={t.id} t={t} onConcluir={concluir} />)}
              </div>
            )}
            {demais.length > 0 && (
              <div className="space-y-2">
                {urgentes.length > 0 && <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1"><Clock className="h-4 w-4" /> Outras</p>}
                {demais.map(t => <TaskCard key={t.id} t={t} onConcluir={concluir} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TaskCard({ t, onConcluir }: { t: Task; onConcluir: (id: string) => void }) {
  return (
    <Card className="border-border/60">
      <CardContent className="py-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{CAT_EMOJI[t.categoria] ?? "🔧"} {t.titulo}</span>
            <Badge className={`text-xs border ${PRIORIDADE_COR[t.prioridade]}`}>{PRIORIDADE_LABEL[t.prioridade]}</Badge>
            {t.dias_atraso > 0 && <Badge variant="destructive" className="text-xs">{t.dias_atraso}d atrasada</Badge>}
          </div>
          <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
            {t.responsavel && <span>👤 {t.responsavel}</span>}
            {t.data_prevista && <span>📅 {fmtDate(t.data_prevista)}</span>}
            {t.custo_estimado && <span>💰 {fmtBRL(t.custo_estimado)}</span>}
          </div>
        </div>
        <Button size="sm" variant="outline" className="shrink-0 gap-1"
          onClick={() => onConcluir(t.id)}>
          <CheckCircle2 className="h-3.5 w-3.5" /> Concluir
        </Button>
      </CardContent>
    </Card>
  );
}
