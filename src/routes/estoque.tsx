import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFamily } from "@/hooks/use-family";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ChevronDown, ChevronRight, Package, Plus, Minus, Search, ShoppingCart, Loader2, ClipboardList } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EstoqueRevisao from "./estoque.revisao-semanal";
import { toast } from "sonner";
import { SkeletonPage } from "@/components/skeletons";

export const Route = createFileRoute("/estoque")({
  head: () => ({ meta: [{ title: "Estoque — Casinha Hub" }] }),
  component: EstoquePage,
});

type Produto = {
  id: string; parent_id: string | null; nome: string; categoria: string;
  unidade: string; quantidade_por_embalagem: number; unidade_embalagem: string;
  estoque_atual: number; estoque_minimo: number; consumo_diario_medio: number;
  status: string; dias_restantes: number | null; qtd_subprodutos: number;
  sugestao_compra: number | null; risco_ruptura: boolean;
  preco_ultima_compra: number | null;
};

const STATUS_COR: Record<string, string> = {
  zerado: "bg-red-500", critico: "bg-red-400", baixo: "bg-orange-400",
  atencao: "bg-yellow-400", ok: "bg-emerald-500",
};
const STATUS_LABEL: Record<string, string> = {
  zerado: "Zerado", critico: "Crítico", baixo: "Baixo", atencao: "Atenção", ok: "Ok",
};
const STATUS_BADGE: Record<string, "destructive" | "secondary" | "outline"> = {
  zerado: "destructive", critico: "destructive", baixo: "secondary",
  atencao: "secondary", ok: "outline",
};
const fmtBRL = (n: number) => Number(n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtQtd = (n: number, und: string) => `${Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${und}`;

function EstoquePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { familyId, loading: familyLoading } = useFamily();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todas");
  const [editando, setEditando] = useState<Record<string, string>>({}); // id → valor digitado
  const [saving, setSaving] = useState<Record<string, boolean>>({}); // id → salvando
  const [statusFiltro, setStatusFiltro] = useState("todos");

  useEffect(() => { if (!authLoading && !user) navigate({ to: "/auth" }); }, [user, authLoading, navigate]);

  const reload = async () => {
    if (!user || !familyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("v_stock_status" as any).select("*")
      .eq("family_id", familyId).order("categoria").order("nome");
    if (error) toast.error("Erro ao carregar estoque");
    setProdutos(((data as any) ?? []) as Produto[]);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [user, familyId]);

  // Atualização otimista: UI primeiro, banco em background
  const salvarEstoque = async (id: string, novoEstoque: number) => {
    const prod = produtos.find(p => p.id === id);
    if (!prod) return;
    const estoqueAnterior = prod.estoque_atual;
    const delta = novoEstoque - estoqueAnterior;
    if (delta === 0) return;

    // Atualizar UI imediatamente
    setProdutos(prev => prev.map(p => p.id === id ? { ...p, estoque_atual: novoEstoque } : p));
    if (prod.parent_id) {
      const irmãos = produtos.filter(p => p.parent_id === prod.parent_id && p.id !== id);
      const totalFilhos = irmãos.reduce((s, p) => s + (p.estoque_atual ?? 0), 0) + novoEstoque;
      setProdutos(prev => prev.map(p => p.id === prod.parent_id ? { ...p, estoque_atual: totalFilhos } : p));
    }

    // Salvar no banco em background
    setSaving(prev => ({ ...prev, [id]: true }));
    const { error } = await supabase.from("products" as any)
      .update({ estoque_atual: novoEstoque }).eq("id", id);
    if (error) {
      // Reverter se falhar
      setProdutos(prev => prev.map(p => p.id === id ? { ...p, estoque_atual: estoqueAnterior } : p));
      toast.error(error.message);
    } else {
      // Registrar movimento
      supabase.from("stock_movements" as any).insert({
        product_id: id, family_id: familyId, user_id: user?.id,
        tipo: delta > 0 ? "entrada" : "saida", quantidade: Math.abs(delta),
      }).then(() => {}).catch(() => {});
    }
    setSaving(prev => ({ ...prev, [id]: false }));
  };

  const mover = (id: string, delta: number) => {
    const prod = produtos.find(p => p.id === id);
    if (!prod) return;
    const novo = Math.max(0, (prod.estoque_atual ?? 0) + delta);
    salvarEstoque(id, novo);
  };

  const confirmarInput = (id: string) => {
    const val = editando[id];
    if (val === undefined) return;
    const prod = produtos.find(p => p.id === id);
    if (!prod) return;
    // Valor digitado é em unidades de embalagem
    const qtdEmb = parseFloat(val.replace(",", "."));
    if (isNaN(qtdEmb) || qtdEmb < 0) { setEditando(prev => { const n = {...prev}; delete n[id]; return n; }); return; }
    const novoEstoque = qtdEmb * prod.quantidade_por_embalagem;
    salvarEstoque(id, novoEstoque);
    setEditando(prev => { const n = {...prev}; delete n[id]; return n; });
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

  const categorias = useMemo(() => ["Todas", ...Array.from(new Set(maes.map(p => p.categoria))).sort()], [maes]);

  const maesFiltradas = useMemo(() => maes.filter(p => {
    if (categoriaFiltro !== "Todas" && p.categoria !== categoriaFiltro) return false;
    if (statusFiltro !== "todos" && p.status !== statusFiltro) return false;
    if (search && !p.nome.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [maes, categoriaFiltro, statusFiltro, search]);

  const resumo = useMemo(() => ({
    zerado: maes.filter(p => p.status === "zerado").length,
    critico: maes.filter(p => p.status === "critico").length,
    baixo: maes.filter(p => p.status === "baixo").length,
    atencao: maes.filter(p => p.status === "atencao").length,
    ok: maes.filter(p => p.status === "ok").length,
  }), [maes]);

  if (authLoading || familyLoading) return <SkeletonPage />;

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <header className="border-b border-border/60 bg-card/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link to="/dashboard"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Painel</Button></Link>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" /> Estoque
            </h1>
          </div>
          <Link to="/estoque/revisao-semanal">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ClipboardList className="h-4 w-4" /> Revisão
            </Button>
          </Link>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {/* Resumo */}
        <div className="grid grid-cols-5 gap-2">
          {[
            { l: "Zerado", v: resumo.zerado, k: "zerado", cor: "text-red-600" },
            { l: "Crítico", v: resumo.critico, k: "critico", cor: "text-red-500" },
            { l: "Baixo", v: resumo.baixo, k: "baixo", cor: "text-orange-500" },
            { l: "Atenção", v: resumo.atencao, k: "atencao", cor: "text-yellow-600" },
            { l: "Ok", v: resumo.ok, k: "ok", cor: "text-emerald-600" },
          ].map(s => (
            <button key={s.k} onClick={() => setStatusFiltro(statusFiltro === s.k ? "todos" : s.k)}
              className={`rounded-lg border p-2 text-center transition-all ${statusFiltro === s.k ? "border-primary bg-primary/10" : "border-border/60 bg-card"}`}>
              <p className={`text-lg font-bold ${s.cor}`}>{s.v}</p>
              <p className="text-xs text-muted-foreground">{s.l}</p>
            </button>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
          </div>
          <div className="flex flex-wrap gap-1">
            {categorias.map(c => (
              <button key={c} onClick={() => setCategoriaFiltro(c)}
                className={`text-xs px-2 py-1 rounded-full border transition-all ${categoriaFiltro === c ? "bg-primary text-primary-foreground border-primary" : "border-border/60 bg-card hover:bg-muted"}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Lista hierárquica */}
        {loading ? <SkeletonPage /> : maesFiltradas.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhum produto encontrado.</CardContent></Card>
        ) : (
          <div className="space-y-1">
            {maesFiltradas.map(mae => {
              const filhos = filhosPor[mae.id] ?? [];
              const expandido = expandidos.has(mae.id);
              const pct = mae.estoque_minimo > 0 ? Math.min(100, (mae.estoque_atual / (mae.estoque_minimo * 2)) * 100) : 50;
              return (
                <div key={mae.id} className="rounded-lg border border-border/60 bg-card overflow-hidden">
                  {/* Linha do produto mãe */}
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <button onClick={() => setExpandidos(prev => {
                      const s = new Set(prev);
                      s.has(mae.id) ? s.delete(mae.id) : s.add(mae.id);
                      return s;
                    })} className="text-muted-foreground hover:text-foreground shrink-0">
                      {expandido ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{mae.nome}</span>
                        <Badge variant={STATUS_BADGE[mae.status] ?? "outline"} className="text-xs">
                          {STATUS_LABEL[mae.status]}
                        </Badge>
                        {mae.risco_ruptura && <Badge variant="destructive" className="text-xs">⚠️ Ruptura</Badge>}
                        {filhos.length > 0 && <span className="text-xs text-muted-foreground">{filhos.length} {filhos.length === 1 ? "marca" : "marcas"}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[120px]">
                          <div className={`h-full ${STATUS_COR[mae.status]} transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {fmtQtd(mae.estoque_atual, mae.unidade)}
                          {mae.estoque_minimo > 0 && ` / mín ${fmtQtd(mae.estoque_minimo, mae.unidade)}`}
                        </span>
                        {mae.dias_restantes !== null && (
                          <span className="text-xs text-muted-foreground">~{mae.dias_restantes}d</span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{mae.categoria}</span>
                  </div>

                  {/* Sub-produtos expandidos */}
                  {expandido && filhos.length > 0 && (
                    <div className="border-t border-border/40 bg-muted/20">
                      {filhos.map(filho => (
                        <div key={filho.id} className="flex items-center gap-2 px-4 py-2 border-b last:border-0 border-border/30">
                          <span className="text-xs text-muted-foreground ml-2 w-1 shrink-0">└</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{filho.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {fmtQtd(filho.estoque_atual, filho.unidade)}
                              {filho.quantidade_por_embalagem > 1 && ` (${filho.quantidade_por_embalagem} ${filho.unidade_embalagem}/emb)`}
                              {filho.preco_ultima_compra && ` · ${fmtBRL(filho.preco_ultima_compra)}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button variant="outline" size="sm" className="h-7 w-7 p-0"
                              onClick={() => mover(filho.id, -filho.quantidade_por_embalagem)}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            {editando[filho.id] !== undefined ? (
                              <input
                                type="number"
                                value={editando[filho.id]}
                                onChange={e => setEditando(prev => ({ ...prev, [filho.id]: e.target.value }))}
                                onBlur={() => confirmarInput(filho.id)}
                                onKeyDown={e => { if (e.key === "Enter") confirmarInput(filho.id); if (e.key === "Escape") setEditando(prev => { const n = {...prev}; delete n[filho.id]; return n; }); }}
                                className="w-14 h-7 text-xs text-center border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
                                autoFocus
                                min={0}
                                step={1}
                              />
                            ) : (
                              <button
                                onClick={() => setEditando(prev => ({
                                  ...prev,
                                  [filho.id]: String(Number(filho.estoque_atual / filho.quantidade_por_embalagem).toFixed(1))
                                }))}
                                className="w-14 h-7 text-xs text-center tabular-nums border rounded-md hover:bg-muted transition-colors">
                                {saving[filho.id] ? "..." : `${Number(filho.estoque_atual / filho.quantidade_por_embalagem).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} un`}
                              </button>
                            )}
                            <Button variant="outline" size="sm" className="h-7 w-7 p-0"
                              onClick={() => mover(filho.id, filho.quantidade_por_embalagem)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
