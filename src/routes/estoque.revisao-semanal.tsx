import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { ArrowLeft, Check, Loader2, Minus, Plus } from "lucide-react";

export const Route = createFileRoute("/estoque/revisao-semanal")({
  head: () => ({
    meta: [
      { title: "Revisão de Estoque — Casinha Flow" },
      { name: "description", content: "Revisão semanal de estoque da família." },
    ],
  }),
  component: RevisaoEstoquePage,
});

interface StockItem {
  id: string;
  family_id: string;
  nome: string;
  categoria: string | null;
  unidade: string;
  quantidade_atual: number;
  quantidade_minima: number;
  data_validade: string | null;
  ultima_revisao: string | null;
  urgencia: "zerado" | "vencendo" | "critico" | "baixo" | "ok";
  dias_sem_revisao: number;
  dias_para_vencer: number | null;
  dias_restantes: number | null;
}

const URG_BADGE: Record<StockItem["urgencia"], { label: string; cls: string }> = {
  zerado:   { label: "🔴 Zerado",   cls: "bg-red-500/15 text-red-700" },
  critico:  { label: "🟠 Crítico",  cls: "bg-orange-500/15 text-orange-700" },
  baixo:    { label: "🟡 Baixo",    cls: "bg-yellow-500/15 text-yellow-700" },
  vencendo: { label: "⚠️ Vencendo", cls: "bg-amber-500/15 text-amber-700" },
  ok:       { label: "✅ OK",        cls: "bg-emerald-500/15 text-emerald-700" },
};

const URG_ORDER: Record<StockItem["urgencia"], number> = {
  zerado: 0, vencendo: 1, critico: 2, baixo: 3, ok: 4,
};

function RevisaoEstoquePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [revisedIds, setRevisedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles").select("family_id").eq("id", user.id).maybeSingle();
      if (profile?.family_id) setFamilyId(profile.family_id);
    })();
  }, [user]);

  const load = async () => {
    if (!familyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("v_stock_review" as never)
      .select("*")
      .eq("family_id", familyId);
    if (error) toast.error(error.message);
    const list = ((data ?? []) as unknown as StockItem[])
      .map((r) => ({ ...r, quantidade_atual: Number(r.quantidade_atual), quantidade_minima: Number(r.quantidade_minima) }))
      .sort((a, b) => URG_ORDER[a.urgencia] - URG_ORDER[b.urgencia]);
    setItems(list);
    setLoading(false);
  };

  useEffect(() => { if (familyId) load(); /* eslint-disable-next-line */ }, [familyId]);

  const counts = useMemo(() => ({
    zerados: items.filter((i) => i.urgencia === "zerado").length,
    criticos: items.filter((i) => i.urgencia === "critico").length,
    vencendo: items.filter((i) => i.urgencia === "vencendo").length,
    semRev: items.filter((i) => i.dias_sem_revisao >= 7).length,
  }), [items]);

  const adjustQty = async (item: StockItem, delta: number) => {
    if (!user || !familyId) return;
    setBusyId(item.id);
    const tipo = delta >= 0 ? "entrada" : "saida";
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("stock_movements").insert({
      product_id: item.id,
      family_id: familyId,
      user_id: user.id,
      tipo,
      quantidade: Math.abs(delta),
      data: today,
    });
    if (error) { setBusyId(null); toast.error(error.message); return; }
    await supabase.from("products").update({ ultima_revisao: today }).eq("id", item.id);
    setItems((prev) => prev.map((p) => p.id === item.id
      ? { ...p, quantidade_atual: Math.max(0, p.quantidade_atual + delta), ultima_revisao: today, dias_sem_revisao: 0 }
      : p));
    setRevisedIds((s) => new Set(s).add(item.id));
    setBusyId(null);
  };

  const acabou = async (item: StockItem) => {
    if (!user || !familyId) return;
    setBusyId(item.id);
    const today = new Date().toISOString().slice(0, 10);
    await supabase.from("stock_movements").insert({
      product_id: item.id, family_id: familyId, user_id: user.id,
      tipo: "ajuste", quantidade: 0, data: today, motivo: "Acabou — revisão semanal",
    });
    await supabase.from("products").update({ ultima_revisao: today, quantidade_atual: 0 }).eq("id", item.id);
    setItems((prev) => prev.map((p) => p.id === item.id
      ? { ...p, quantidade_atual: 0, urgencia: "zerado", ultima_revisao: today, dias_sem_revisao: 0 }
      : p));
    setRevisedIds((s) => new Set(s).add(item.id));
    setBusyId(null);
    toast.success("Marcado como zerado");
  };

  const naoCompro = async (item: StockItem) => {
    setBusyId(item.id);
    const { error } = await supabase.from("products").update({ ativo: false }).eq("id", item.id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    setItems((prev) => prev.filter((p) => p.id !== item.id));
    toast.success("Produto desativado");
  };

  const finalizar = async () => {
    if (!user || !familyId) return;
    setFinalizing(true);
    const { error } = await supabase.from("weekly_reviews").insert({
      family_id: familyId,
      user_id: user.id,
      checklist: {
        tipo: "estoque",
        revisados: revisedIds.size,
        criticos: counts.criticos,
        zerados: counts.zerados,
      },
    });
    setFinalizing(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`✅ Revisão finalizada — ${revisedIds.size} itens revisados`);
    navigate({ to: "/estoque" });
  };

  const todayPt = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!user) return null;

  return (
    <div className="min-h-screen pb-24" style={{ background: "var(--gradient-subtle)" }}>
      <header className="border-b border-border/60 bg-card/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-semibold tracking-tight">📦 Revisão de Estoque</span>
          <Link to="/estoque"><Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" />Estoque</Button></Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <div>
          <h1 className="text-xl font-semibold">Revisão de Estoque</h1>
          <p className="text-sm text-muted-foreground">{todayPt}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">🔴 Zerados</CardTitle></CardHeader><CardContent className="text-xl font-semibold">{counts.zerados}</CardContent></Card>
          <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">🟠 Críticos</CardTitle></CardHeader><CardContent className="text-xl font-semibold">{counts.criticos}</CardContent></Card>
          <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">⚠️ Vencendo</CardTitle></CardHeader><CardContent className="text-xl font-semibold">{counts.vencendo}</CardContent></Card>
          <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">📋 Sem revisão</CardTitle></CardHeader><CardContent className="text-xl font-semibold">{counts.semRev}</CardContent></Card>
        </div>

        {loading ? (
          <div className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
        ) : items.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum produto ativo para revisar.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const urg = URG_BADGE[item.urgencia];
              return (
                <Card key={item.id} className={revisedIds.has(item.id) ? "border-emerald-500/40" : ""}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate flex items-center gap-2">
                          {revisedIds.has(item.id) && <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                          {item.nome}
                        </div>
                        {item.categoria && <div className="text-xs text-muted-foreground">{item.categoria}</div>}
                        <div className="text-xs text-muted-foreground">
                          {item.quantidade_atual} {item.unidade}
                          {item.dias_para_vencer !== null && item.dias_para_vencer <= 30 && (
                            <span className="ml-2">· vence em {item.dias_para_vencer}d</span>
                          )}
                        </div>
                      </div>
                      <Badge className={`${urg.cls} font-normal whitespace-nowrap`}>{urg.label}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 px-2 gap-1" disabled={busyId === item.id} onClick={() => adjustQty(item, 1)}>
                        <Plus className="h-3 w-3" />1
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 gap-1" disabled={busyId === item.id} onClick={() => adjustQty(item, 5)}>
                        <Plus className="h-3 w-3" />5
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 gap-1" disabled={busyId === item.id || item.quantidade_atual <= 0} onClick={() => adjustQty(item, -1)}>
                        <Minus className="h-3 w-3" />1
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 gap-1" disabled={busyId === item.id || item.quantidade_atual <= 0} onClick={() => adjustQty(item, -5)}>
                        <Minus className="h-3 w-3" />5
                      </Button>
                      <Sheet>
                        <SheetTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">Acabou</Button>
                        </SheetTrigger>
                        <SheetContent side="bottom">
                          <SheetHeader>
                            <SheetTitle>{item.nome}</SheetTitle>
                            <SheetDescription>O que aconteceu com esse item?</SheetDescription>
                          </SheetHeader>
                          <div className="grid gap-2 py-4">
                            <Button onClick={() => acabou(item)} className="justify-start gap-2 h-auto py-3">
                              <span className="text-xl">📦</span>
                              <span className="text-left">
                                <div className="font-medium">Zerado — vou repor</div>
                                <div className="text-xs opacity-80">Marca como 0 e mantém na lista</div>
                              </span>
                            </Button>
                            <Button onClick={() => naoCompro(item)} variant="outline" className="justify-start gap-2 h-auto py-3">
                              <span className="text-xl">🚫</span>
                              <span className="text-left">
                                <div className="font-medium">Não compro mais</div>
                                <div className="text-xs opacity-80">Desativa o produto</div>
                              </span>
                            </Button>
                          </div>
                        </SheetContent>
                      </Sheet>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur border-t border-border/60 p-3 z-20">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {revisedIds.size} de {items.length} revisados
          </span>
          <Button onClick={finalizar} disabled={finalizing} className="gap-2">
            {finalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Finalizar revisão
          </Button>
        </div>
      </div>
    </div>
  );
}
