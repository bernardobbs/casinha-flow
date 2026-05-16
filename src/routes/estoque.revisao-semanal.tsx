import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFamily } from "@/hooks/use-family";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Package, CheckCircle2, Loader2 } from "lucide-react";
import { SkeletonPage } from "@/components/skeletons";

export const Route = createFileRoute("/estoque/revisao-semanal")({
  head: () => ({ meta: [{ title: "Inventário de Estoque — Casinha Hub" }] }),
  component: RevisaoEstoquePage,
});

type Produto = {
  id: string; nome: string; categoria: string; unidade: string;
  estoque_atual: number; quantidade_por_embalagem: number; unidade_embalagem: string;
  parent_id: string | null;
};

const CATS = ["Mercearia","Laticínios","Bebidas","Bebidas Quentes","Carnes","Frios","Temperos","Higiene","Limpeza"];

function RevisaoEstoquePage() {
  const { user, loading: authLoading } = useAuth();
  const { familyId, loading: familyLoading } = useFamily();
  const navigate = useNavigate();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [catFiltro, setCatFiltro] = useState("Todas");
  const [busyAll, setBusyAll] = useState(false);

  useEffect(() => { if (!authLoading && !user) navigate({ to: "/auth" }); }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!familyId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("products" as any)
        .select("id, nome, categoria, unidade, estoque_atual, quantidade_por_embalagem, unidade_embalagem, parent_id")
        .eq("family_id", familyId).eq("ativo", true)
        .order("categoria").order("nome");
      const list = ((data ?? []) as Produto[]);
      setProdutos(list);
      // Pré-preencher com valores atuais em embalagens
      const init: Record<string, string> = {};
      list.filter(p => p.parent_id !== null).forEach(p => {
        const embs = p.quantidade_por_embalagem > 0 ? p.estoque_atual / p.quantidade_por_embalagem : 0;
        init[p.id] = embs > 0 ? String(Math.round(embs * 10) / 10) : "0";
      });
      setInputs(init);
      setLoading(false);
    })();
  }, [familyId]);

  const salvarItem = async (filho: Produto, valor: string) => {
    const qtd = parseFloat(valor.replace(",", "."));
    if (isNaN(qtd) || qtd < 0) return;
    const novoEstoque = qtd * filho.quantidade_por_embalagem;
    setSaving(prev => ({ ...prev, [filho.id]: true }));
    const { error } = await supabase.from("products" as any)
      .update({ estoque_atual: novoEstoque }).eq("id", filho.id);
    if (error) { toast.error(error.message); }
    else {
      setSaved(prev => new Set([...prev, filho.id]));
      // Atualizar pai
      const pai = produtos.find(p => p.id === filho.parent_id);
      if (pai) {
        const irmaos = produtos.filter(p => p.parent_id === filho.parent_id && p.id !== filho.id);
        const totalFilhos = irmaos.reduce((s, p) => {
          const v = parseFloat(inputs[p.id] ?? "0") || 0;
          return s + v * p.quantidade_por_embalagem;
        }, 0) + novoEstoque;
        await supabase.from("products" as any).update({ estoque_atual: totalFilhos }).eq("id", filho.parent_id);
        setProdutos(prev => prev.map(p => p.id === filho.parent_id ? { ...p, estoque_atual: totalFilhos } : p));
      }
    }
    setSaving(prev => ({ ...prev, [filho.id]: false }));
  };

  const salvarTodos = async () => {
    setBusyAll(true);
    const filhos = produtos.filter(p => p.parent_id !== null);
    for (const filho of filhos) {
      await salvarItem(filho, inputs[filho.id] ?? "0");
    }
    toast.success("✅ Inventário salvo!");
    setBusyAll(false);
  };

  // Organizar hierarquia
  const maes = useMemo(() => produtos.filter(p => p.parent_id === null), [produtos]);
  const filhosPor = useMemo(() => {
    const m: Record<string, Produto[]> = {};
    produtos.filter(p => p.parent_id).forEach(p => {
      if (!m[p.parent_id!]) m[p.parent_id!] = [];
      m[p.parent_id!].push(p);
    });
    return m;
  }, [produtos]);

  const cats = useMemo(() => ["Todas", ...CATS.filter(c => maes.some(m => m.categoria === c))], [maes]);
  const maesFiltradas = useMemo(() =>
    maes.filter(m => catFiltro === "Todas" || m.categoria === catFiltro), [maes, catFiltro]);

  const totalSalvos = saved.size;
  const totalFilhos = produtos.filter(p => p.parent_id !== null).length;
  const pct = totalFilhos > 0 ? Math.round((totalSalvos / totalFilhos) * 100) : 0;

  if (authLoading || familyLoading) return <SkeletonPage />;

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <header className="border-b border-border/60 bg-card/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Link to="/estoque"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Estoque</Button></Link>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" /> Inventário
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {totalSalvos > 0 && (
              <span className="text-xs text-muted-foreground">{totalSalvos}/{totalFilhos} atualizados ({pct}%)</span>
            )}
            <Button size="sm" onClick={salvarTodos} disabled={busyAll} className="gap-1.5">
              {busyAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {busyAll ? "Salvando..." : "Salvar tudo"}
            </Button>
          </div>
        </div>
        {/* Progresso */}
        {totalSalvos > 0 && (
          <div className="h-1 bg-muted">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {/* Instrução */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-3 text-sm text-muted-foreground">
            💡 Digite a quantidade de <strong>embalagens</strong> que você tem em casa para cada produto. Deixe <strong>0</strong> se não tiver. Clique em <strong>Salvar tudo</strong> ao terminar.
          </CardContent>
        </Card>

        {/* Filtro categoria */}
        <div className="flex flex-wrap gap-1.5">
          {cats.map(c => (
            <button key={c} onClick={() => setCatFiltro(c)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all ${catFiltro === c ? "bg-primary text-primary-foreground border-primary" : "border-border/60 bg-card hover:bg-muted"}`}>
              {c}
            </button>
          ))}
        </div>

        {loading ? <SkeletonPage /> : (
          <div className="space-y-2">
            {maesFiltradas.map(mae => {
              const filhos = filhosPor[mae.id] ?? [];
              if (!filhos.length) return null;
              const totalMae = filhos.reduce((s, f) => {
                const v = parseFloat(inputs[f.id] ?? "0") || 0;
                return s + v * f.quantidade_por_embalagem;
              }, 0);
              return (
                <Card key={mae.id} className="border-border/60">
                  <CardHeader className="py-2 px-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">{mae.nome}</CardTitle>
                      <span className="text-xs text-muted-foreground">
                        Total: {totalMae.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} {mae.unidade}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="py-2 px-4 space-y-2">
                    {filhos.map(filho => {
                      const isSaved = saved.has(filho.id);
                      const isSaving = saving[filho.id];
                      return (
                        <div key={filho.id} className="flex items-center gap-3">
                          <span className={`flex-1 text-sm truncate ${isSaved ? "text-emerald-700 dark:text-emerald-400" : ""}`}>
                            {isSaved && "✓ "}{filho.nome}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <input
                              type="number" min={0} step={1}
                              value={inputs[filho.id] ?? "0"}
                              onChange={e => {
                                setInputs(prev => ({ ...prev, [filho.id]: e.target.value }));
                                setSaved(prev => { const n = new Set(prev); n.delete(filho.id); return n; });
                              }}
                              onBlur={e => salvarItem(filho, e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") salvarItem(filho, inputs[filho.id] ?? "0"); }}
                              className="w-16 h-8 text-sm text-center border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
                            />
                            <span className="text-xs text-muted-foreground w-12">
                              {isSaving ? <Loader2 className="h-3 w-3 animate-spin inline" /> : `un de ${filho.quantidade_por_embalagem}${filho.unidade_embalagem}`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
