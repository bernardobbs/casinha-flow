import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFamily } from "@/hooks/use-family";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Wrench, Plus, CheckCircle2, AlertTriangle, Clock, Pencil, Trash2, ArrowLeft } from "lucide-react";
import { SkeletonPage } from "@/components/skeletons";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/manutencao")({
  head: () => ({ meta: [{ title: "Manutenção — Casinha Hub" }] }),
  component: ManutencaoPage,
});

type Task = {
  id: string; titulo: string; categoria: string; descricao: string | null;
  prioridade: string; status: string; responsavel: string | null;
  custo_estimado: number | null; data_prevista: string | null;
  dias_atraso: number;
};

const CATEGORIAS = [
  { value: "eletrica", label: "⚡ Elétrica" },
  { value: "hidraulica", label: "💧 Hidráulica" },
  { value: "pintura", label: "🖌️ Pintura" },
  { value: "limpeza", label: "🧹 Limpeza" },
  { value: "jardim", label: "🌿 Jardim" },
  { value: "eletrodomestico", label: "🔌 Eletrodoméstico" },
  { value: "geral", label: "🔧 Geral" },
  { value: "outros", label: "📦 Outros" },
];
const PRIORIDADES = [
  { value: "urgente", label: "🚨 Urgente" },
  { value: "alta", label: "🔴 Alta" },
  { value: "media", label: "🟡 Média" },
  { value: "baixa", label: "🟢 Baixa" },
];
const PRIORIDADE_COR: Record<string, string> = {
  urgente: "bg-red-500/15 text-red-700 border-red-300",
  alta: "bg-orange-500/15 text-orange-700 border-orange-300",
  media: "bg-yellow-500/15 text-yellow-700 border-yellow-300",
  baixa: "bg-muted text-muted-foreground",
};
const CAT_EMOJI: Record<string, string> = {
  eletrica: "⚡", hidraulica: "💧", pintura: "🖌️",
  limpeza: "🧹", jardim: "🌿", eletrodomestico: "🔌", geral: "🔧", outros: "📦",
};
const fmtBRL = (n: number | null) => n == null ? "" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | null) => d ? new Date(d + "T12:00").toLocaleDateString("pt-BR") : "—";

const EMPTY = { titulo: "", categoria: "geral", descricao: "", prioridade: "media", responsavel: "", custo_estimado: "", data_prevista: "" };

function ManutencaoPage() {
  const { user, loading: authLoading } = useAuth();
  const { familyId, loading: familyLoading } = useFamily();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [statusFiltro, setStatusFiltro] = useState<"pendente" | "concluida" | "todas">("pendente");

  useEffect(() => { if (!authLoading && !user) navigate({ to: "/auth" }); }, [user, authLoading, navigate]);

  const load = async () => {
    if (!familyId) return;
    setLoading(true);
    let q = supabase.from("maintenance_tasks" as any)
      .select("id, titulo, categoria, descricao, prioridade, status, responsavel, custo_estimado, data_prevista, created_at")
      .eq("family_id", familyId)
      .order("data_prevista", { ascending: true, nullsFirst: false });
    if (statusFiltro !== "todas") q = q.eq("status", statusFiltro);
    const { data } = await q;
    const hoje = new Date().toISOString().slice(0, 10);
    setTasks(((data ?? []) as any[]).map((t: any) => ({
      ...t,
      dias_atraso: t.data_prevista && t.data_prevista < hoje && t.status === "pendente"
        ? Math.floor((new Date(hoje).getTime() - new Date(t.data_prevista).getTime()) / 86400000)
        : 0,
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [familyId, statusFiltro]);

  const openNew = () => { setEditing(null); setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (t: Task) => {
    setEditing(t);
    setForm({
      titulo: t.titulo, categoria: t.categoria, descricao: t.descricao ?? "",
      prioridade: t.prioridade, responsavel: t.responsavel ?? "",
      custo_estimado: t.custo_estimado != null ? String(t.custo_estimado) : "",
      data_prevista: t.data_prevista ?? "",
    });
    setDialogOpen(true);
  };

  const salvar = async () => {
    if (!form.titulo.trim()) { toast.error("Título é obrigatório"); return; }
    setSaving(true);
    const payload: any = {
      family_id: familyId,
      titulo: form.titulo.trim(), categoria: form.categoria,
      descricao: form.descricao || null, prioridade: form.prioridade,
      responsavel: form.responsavel || null,
      custo_estimado: form.custo_estimado ? parseFloat(form.custo_estimado.replace(",", ".")) : null,
      data_prevista: form.data_prevista || null,
      status: editing?.status ?? "pendente",
    };
    const { error } = editing
      ? await supabase.from("maintenance_tasks" as any).update(payload).eq("id", editing.id)
      : await supabase.from("maintenance_tasks" as any).insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "✅ Tarefa atualizada" : "✅ Tarefa criada");
    setDialogOpen(false);
    load();
  };

  const excluir = async (id: string) => {
    if (!confirm("Excluir esta tarefa?")) return;
    const { error } = await supabase.from("maintenance_tasks" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Tarefa excluída");
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const concluir = async (id: string) => {
    const { error } = await supabase.from("maintenance_tasks" as any)
      .update({ status: "concluida", data_conclusao: new Date().toISOString().slice(0, 10) }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("✅ Tarefa concluída!");
    load();
  };

  if (authLoading || familyLoading) return <SkeletonPage />;

  const urgentes = tasks.filter(t => t.prioridade === "urgente" || t.prioridade === "alta");
  const demais = tasks.filter(t => t.prioridade !== "urgente" && t.prioridade !== "alta");

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <header className="border-b border-border/60 bg-card/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link to="/dashboard"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Painel</Button></Link>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" /> Manutenção
            </h1>
          </div>
          <Button size="sm" onClick={openNew} className="gap-1.5">
            <Plus className="h-4 w-4" /> Nova tarefa
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {/* Filtro de status */}
        <div className="flex gap-2">
          {([["pendente", "⏳ Pendentes"], ["concluida", "✅ Concluídas"], ["todas", "📋 Todas"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setStatusFiltro(v)}
              className={`text-sm px-3 py-1.5 rounded-full border transition-all ${statusFiltro === v ? "bg-primary text-primary-foreground border-primary" : "border-border/60 bg-card hover:bg-muted"}`}>
              {l}
            </button>
          ))}
          <span className="ml-auto text-sm text-muted-foreground self-center">{tasks.length} tarefa{tasks.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? <SkeletonPage /> : tasks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500 opacity-60" />
              <p className="font-medium">Nenhuma tarefa {statusFiltro === "pendente" ? "pendente" : "encontrada"}</p>
              {statusFiltro === "pendente" && <p className="text-sm mt-1">A casa está em dia! 🏠</p>}
              <Button size="sm" className="mt-4 gap-1.5" onClick={openNew}><Plus className="h-4 w-4" /> Criar tarefa</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {urgentes.length > 0 && statusFiltro !== "concluida" && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-orange-500" /> Prioritárias
                </p>
                {urgentes.map(t => <TaskCard key={t.id} t={t} onConcluir={concluir} onEdit={openEdit} onDelete={excluir} />)}
              </div>
            )}
            {demais.length > 0 && (
              <div className="space-y-2">
                {urgentes.length > 0 && statusFiltro !== "concluida" &&
                  <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1"><Clock className="h-4 w-4" /> Outras</p>}
                {demais.map(t => <TaskCard key={t.id} t={t} onConcluir={concluir} onEdit={openEdit} onDelete={excluir} />)}
              </div>
            )}
            {statusFiltro === "concluida" && tasks.length > 0 && tasks.filter(t => t.prioridade === "urgente" || t.prioridade === "alta").length > 0 &&
              urgentes.map(t => <TaskCard key={t.id} t={t} onConcluir={concluir} onEdit={openEdit} onDelete={excluir} />)}
          </div>
        )}
      </main>

      {/* Dialog criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar tarefa" : "Nova tarefa de manutenção"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Título *</Label>
              <Input value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Ex: Trocar torneira da cozinha" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={v => setForm(p => ({ ...p, categoria: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><Label>Prioridade</Label>
                <Select value={form.prioridade} onValueChange={v => setForm(p => ({ ...p, prioridade: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORIDADES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select></div>
            </div>
            <div><Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} rows={2} placeholder="Detalhes opcionais..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data prevista</Label>
                <Input type="date" value={form.data_prevista} onChange={e => setForm(p => ({ ...p, data_prevista: e.target.value }))} /></div>
              <div><Label>Custo estimado</Label>
                <Input value={form.custo_estimado} onChange={e => setForm(p => ({ ...p, custo_estimado: e.target.value }))} placeholder="R$ 0,00" /></div>
            </div>
            <div><Label>Responsável</Label>
              <Input value={form.responsavel} onChange={e => setForm(p => ({ ...p, responsavel: e.target.value }))} placeholder="Quem vai fazer?" /></div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={salvar} disabled={saving}>{saving ? "Salvando..." : editing ? "Salvar" : "Criar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaskCard({ t, onConcluir, onEdit, onDelete }: {
  t: Task; onConcluir: (id: string) => void;
  onEdit: (t: Task) => void; onDelete: (id: string) => void;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="py-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{CAT_EMOJI[t.categoria] ?? "🔧"} {t.titulo}</span>
            <Badge className={`text-xs border ${PRIORIDADE_COR[t.prioridade]}`}>
              {PRIORIDADES.find(p => p.value === t.prioridade)?.label ?? t.prioridade}
            </Badge>
            {t.dias_atraso > 0 && <Badge variant="destructive" className="text-xs">{t.dias_atraso}d atrasada</Badge>}
            {t.status === "concluida" && <Badge className="text-xs bg-emerald-500/15 text-emerald-700 border-emerald-300">✅ Concluída</Badge>}
          </div>
          {t.descricao && <p className="text-xs text-muted-foreground">{t.descricao}</p>}
          <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
            {t.responsavel && <span>👤 {t.responsavel}</span>}
            {t.data_prevista && <span>📅 {fmtDate(t.data_prevista)}</span>}
            {t.custo_estimado != null && <span>💰 {fmtBRL(t.custo_estimado)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={() => onEdit(t)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => onDelete(t.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          {t.status === "pendente" && (
            <Button size="sm" variant="outline" className="gap-1 h-8" onClick={() => onConcluir(t.id)}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Concluir
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
