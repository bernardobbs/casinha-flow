import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFamily } from "@/hooks/use-family";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Loader2, Save, ChevronDown, ChevronRight } from "lucide-react";
import { SkeletonPage } from "@/components/skeletons";

export const Route = createFileRoute("/estoque/revisao-semanal")({
  head: () => ({ meta: [{ title: "Inventário — Casinha Hub" }] }),
  component: InventarioPage,
});

type Produto = {
  id: string; nome: string; categoria: string; unidade: string;
  estoque_atual: number; quantidade_por_embalagem: number;
  unidade_embalagem: string; parent_id: string | null;
};

const CAT_EMOJI: Record<string, string> = {
  Mercearia: "🛒", Laticínios: "🥛", Bebidas: "🥤", "Bebidas Quentes": "☕",
  Carnes: "🥩", Frios: "🧀", Temperos: "🧄", Higiene: "🧴", Limpeza: "🧹",
};
const CAT_COLOR: Record<string, string> = {
  Mercearia: "#0284c7", Laticínios: "#9333ea", Bebidas: "#3b82f6",
  "Bebidas Quentes": "#ca8a04", Carnes: "#ef4444", Frios: "#06b6d4",
  Temperos: "#c026d3", Higiene: "#16a34a", Limpeza: "#f97316",
};

function InventarioPage() {
  const { user, loading: authLoading } = useAuth();
  const { familyId, loading: familyLoading } = useFamily();
  const navigate = useNavigate();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [savingAll, setSavingAll] = useState(false);
  const [catFiltro, setCatFiltro] = useState("Todas");
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [somenteDirty, setSomenteDirty] = useState(false);

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
      // Pré-preencher com valores atuais
      const init: Record<string, string> = {};
      list.filter(p => p.parent_id !== null).forEach(p => {
        const embs = p.quantidade_por_embalagem > 0 ? p.estoque_atual / p.quantidade_por_embalagem : 0;
        init[p.id] = embs > 0 ? String(parseFloat(embs.toFixed(2))) : "0";
      });
      setInputs(init);
      setLoading(false);
    })();
  }, [familyId]);

  const salvarItem = async (filho: Produto, valor: string) => {
    const qtd = parseFloat(valor.replace(",", "."));
    if (isNaN(qtd) || qtd < 0) return;
    const novoEstoque = Math.round(qtd * filho.quantidade_por_embalagem * 1000) / 1000;
    const anterior = filho.estoque_atual;
    if (Math.abs(novoEstoque - anterior) < 0.001) {
      setDirty(prev => { const n = new Set(prev); n.delete(filho.id); return n; });
      return;
    }
    setSaving(prev => ({ ...prev, [filho.id]: true }));
    // Atualizar otimisticamente
    setProdutos(prev => prev.map(p => p.id === filho.id ? { ...p, estoque_atual: novoEstoque } : p));
    const { error } = await supabase.from("products" as any).update({ estoque_atual: novoEstoque }).eq("id", filho.id);
    if (error) {
      setProdutos(prev => prev.map(p => p.id === filho.id ? { ...p, estoque_atual: anterior } : p));
      toast.error(error.message);
    } else {
      setSaved(prev => new Set([...prev, filho.id]));
      setDirty(prev => { const n = new Set(prev); n.delete(filho.id); return n; });
      // Atualizar pai
      if (filho.parent_id) {
        const irmaos = produtos.filter(p => p.parent_id === filho.parent_id && p.id !== filho.id);
        const totalPai = irmaos.reduce((s, p) => {
          const v = parseFloat(inputs[p.id] ?? "0") * p.quantidade_por_embalagem || p.estoque_atual;
          return s + v;
        }, 0) + novoEstoque;
        await supabase.from("products" as any).update({ estoque_atual: totalPai }).eq("id", filho.parent_id);
        setProdutos(prev => prev.map(p => p.id === filho.parent_id ? { ...p, estoque_atual: totalPai } : p));
      }
    }
    setSaving(prev => ({ ...prev, [filho.id]: false }));
  };

  const salvarTodos = async () => {
    const dirtyList = produtos.filter(p => p.parent_id !== null && dirty.has(p.id));
    if (!dirtyList.length) { toast.info("Nenhuma alteração pendente"); return; }
    setSavingAll(true);
    for (const filho of dirtyList) {
      await salvarItem(filho, inputs[filho.id] ?? "0");
    }
    toast.success(`✅ ${dirtyList.length} itens atualizados`);
    setSavingAll(false);
  };

  const maes = useMemo(() => produtos.filter(p => p.parent_id === null), [produtos]);
  const filhosPor = useMemo(() => {
    const m: Record<string, Produto[]> = {};
    produtos.filter(p => p.parent_id).forEach(p => {
      if (!m[p.parent_id!]) m[p.parent_id!] = [];
      m[p.parent_id!].push(p);
    });
    return m;
  }, [produtos]);

  const cats = useMemo(() => ["Todas", ...Array.from(new Set(maes.map(m => m.categoria))).sort()], [maes]);

  const maesFiltradas = useMemo(() => maes.filter(m => {
    if (catFiltro !== "Todas" && m.categoria !== catFiltro) return false;
    if (somenteDirty) {
      const filhos = filhosPor[m.id] ?? [];
      return filhos.some(f => dirty.has(f.id));
    }
    return true;
  }), [maes, catFiltro, somenteDirty, dirty, filhosPor]);

  const toggleExpand = (id: string) => {
    setExpandidos(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const dirtyCount = dirty.size;
  const totalItens = produtos.filter(p => p.parent_id !== null).length;

  if (authLoading || familyLoading) return <SkeletonPage />;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/60 bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <Link to="/estoque">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Estoque
            </Button>
          </Link>
          <h1 className="text-base font-semibold flex-1">📦 Inventário</h1>
          <div className="flex items-center gap-2">
            {dirtyCount > 0 && (
              <span className="text-xs bg-orange-100 text-orange-700 border border-orange-300 px-2 py-0.5 rounded-full font-medium">
                {dirtyCount} alterações
              </span>
            )}
            <Button size="sm" onClick={salvarTodos} disabled={savingAll || dirtyCount === 0} className="gap-1.5">
              {savingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {savingAll ? "Salvando..." : "Salvar tudo"}
            </Button>
          </div>
        </div>
        {/* Barra de progresso de alterações */}
        {dirtyCount > 0 && (
          <div className="h-0.5 bg-orange-500/30">
            <div className="h-full bg-orange-500 transition-all" style={{ width: "100%" }} />
          </div>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {/* Instrução */}
        <div className="text-sm text-muted-foreground bg-card border border-border/60 rounded-xl px-4 py-3">
          💡 Clique em qualquer produto para expandir e atualizar as quantidades. Use <strong>Tab</strong> para navegar entre campos. Clique em <strong>Salvar tudo</strong> ao terminar.
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-1.5 items-center">
          {cats.map(c => (
            <button key={c} onClick={() => setCatFiltro(c)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all ${catFiltro === c ? "bg-primary text-primary-foreground border-primary" : "border-border/60 bg-card hover:bg-muted"}`}>
              {CAT_EMOJI[c] ?? ""} {c}
            </button>
          ))}
          <button onClick={() => setSomenteDirty(!somenteDirty)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-all ml-auto ${somenteDirty ? "bg-orange-500 text-white border-orange-500" : "border-border/60 bg-card hover:bg-muted"}`}>
            {somenteDirty ? "✎ Só alterados" : "✎ Só alterados"}
          </button>
        </div>

        {loading ? <SkeletonPage /> : (
          <div className="space-y-2">
            {maesFiltradas.map(mae => {
              const filhos = filhosPor[mae.id] ?? [];
              if (!filhos.length) return null;
              const expanded = expandidos.has(mae.id);
              const temDirty = filhos.some(f => dirty.has(f.id));
              const temSaved = filhos.some(f => saved.has(f.id));
              const catColor = CAT_COLOR[mae.categoria] ?? "#64748b";

              return (
                <div key={mae.id} className="border border-border/60 rounded-xl overflow-hidden bg-card">
                  {/* Cabeçalho do produto mãe — clicável */}
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                    onClick={() => toggleExpand(mae.id)}
                  >
                    <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: catColor }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{mae.nome}</span>
                        <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                          {CAT_EMOJI[mae.categoria] ?? ""} {mae.categoria}
                        </span>
                        {temDirty && <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">alterado</span>}
                        {!temDirty && temSaved && <span className="text-xs bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded">✓ salvo</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Total: {mae.estoque_atual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} {mae.unidade}
                        {filhos.length > 1 && ` · ${filhos.length} embalagens`}
                      </div>
                    </div>
                    {expanded
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                  </button>

                  {/* Sub-produtos expandidos */}
                  {expanded && (
                    <div className="border-t border-border/60 divide-y divide-border/40">
                      {filhos.map(filho => {
                        const isDirty = dirty.has(filho.id);
                        const isSaved = saved.has(filho.id);
                        const isSaving = saving[filho.id];
                        return (
                          <div key={filho.id} className={`flex items-center gap-3 px-4 py-2.5 ${isDirty ? "bg-orange-50/50 dark:bg-orange-950/20" : isSaved ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""}`}>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{filho.nome}</p>
                              <p className="text-xs text-muted-foreground">
                                {filho.quantidade_por_embalagem} {filho.unidade_embalagem}/emb
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {/* Botão − */}
                              <button
                                className="w-7 h-7 rounded-lg border border-border/60 bg-background hover:bg-muted flex items-center justify-center text-sm font-medium transition-colors"
                                onClick={() => {
                                  const cur = parseFloat(inputs[filho.id] ?? "0") || 0;
                                  const novo = Math.max(0, cur - 1);
                                  setInputs(p => ({ ...p, [filho.id]: String(novo) }));
                                  setDirty(p => new Set([...p, filho.id]));
                                  setSaved(p => { const n = new Set(p); n.delete(filho.id); return n; });
                                }}>−</button>
                              {/* Input */}
                              <input
                                type="number" min={0} step={0.5}
                                value={inputs[filho.id] ?? "0"}
                                onChange={e => {
                                  setInputs(p => ({ ...p, [filho.id]: e.target.value }));
                                  setDirty(p => new Set([...p, filho.id]));
                                  setSaved(p => { const n = new Set(p); n.delete(filho.id); return n; });
                                }}
                                onBlur={e => salvarItem(filho, e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === "Enter") salvarItem(filho, inputs[filho.id] ?? "0");
                                }}
                                className={`w-16 h-8 text-sm text-center border rounded-lg bg-background focus:outline-none focus:ring-2 tabular-nums transition-colors
                                  ${isDirty ? "border-orange-400 ring-orange-200 focus:ring-orange-300" : isSaved ? "border-emerald-400 focus:ring-emerald-200" : "border-border/60 focus:ring-primary/30"}`}
                              />
                              {/* Botão + */}
                              <button
                                className="w-7 h-7 rounded-lg border border-border/60 bg-background hover:bg-muted flex items-center justify-center text-sm font-medium transition-colors"
                                onClick={() => {
                                  const cur = parseFloat(inputs[filho.id] ?? "0") || 0;
                                  const novo = cur + 1;
                                  setInputs(p => ({ ...p, [filho.id]: String(novo) }));
                                  setDirty(p => new Set([...p, filho.id]));
                                  setSaved(p => { const n = new Set(p); n.delete(filho.id); return n; });
                                }}>+</button>
                              {/* Status */}
                              <div className="w-5 flex justify-center">
                                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                                {!isSaving && isSaved && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                              </div>
                              <span className="text-xs text-muted-foreground w-6 text-right">un</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {maesFiltradas.length === 0 && !loading && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="font-medium">Nenhum produto encontrado</p>
            <p className="text-sm mt-1">Tente remover os filtros</p>
          </div>
        )}

        <p className="text-xs text-center text-muted-foreground pb-4">
          {totalItens} embalagens cadastradas
        </p>
      </main>
    </div>
  );
}
