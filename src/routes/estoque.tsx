import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Package, Plus, Upload, ListChecks, Loader2, Minus, AlertTriangle } from "lucide-react";
import { SkeletonEstoque } from "@/components/skeletons";

export const Route = createFileRoute("/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque — Casinha Hub" },
      { name: "description", content: "Controle de estoque doméstico: geladeira, freezer, despensa e armário." },
    ],
  }),
  component: EstoquePage,
});

const LOC_LABEL: Record<string, string> = {
  geladeira: "❄️ Geladeira", freezer: "🧊 Freezer", despensa: "🗄️ Despensa", armario: "🗃️ Armário", outro: "📦 Outro",
};
const UNITS = ["un", "kg", "g", "L", "ml", "pct"] as const;

type StockRow = {
  product_id: string; family_id: string;
  nome: string; categoria: string | null; marca: string | null;
  unidade: string; localizacao: string;
  quantidade_atual: number; quantidade_minima: number;
  preco_atual: number | null; data_validade: string | null;
  consumo_diario: number; dias_restantes: number | null;
  status: "normal" | "atencao" | "baixo" | "critico";
  risco_ruptura: boolean; dias_para_vencer: number | null;
  variacao_preco_pct: number | null; preco_anterior: number | null;
};

const fmtBRL = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function EstoquePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const [openProduct, setOpenProduct] = useState(false);
  const [openMovement, setOpenMovement] = useState<{ open: boolean; productId?: string; tipo?: "entrada" | "saida" }>({ open: false });
  const [openImport, setOpenImport] = useState(false);
  const [openList, setOpenList] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  const reload = async () => {
    if (!user) return;
    setLoading(true);
    const { data: profile } = await supabase.from("profiles").select("family_id").eq("id", user.id).maybeSingle();
    if (!profile?.family_id) { setLoading(false); return; }
    setFamilyId(profile.family_id);
    const { data, error } = await supabase
      .from("v_stock_status" as any)
      .select("*")
      .eq("family_id", profile.family_id)
      .order("nome");
    if (error) toast.error("Erro ao carregar estoque");
    setRows(((data as any) ?? []) as StockRow[]);
    setLoading(false);
  };
  useEffect(() => { reload(); }, [user]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filter !== "todos" && r.localizacao !== filter) return false;
      if (search && !r.nome.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [rows, filter, search]);

  const atencao = useMemo(
    () => filtered.filter(r => r.risco_ruptura || (r.dias_para_vencer !== null && r.dias_para_vencer <= 7)),
    [filtered]
  );

  if (authLoading || loading) return <SkeletonEstoque />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Link to="/dashboard"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Painel</Button></Link>
            <h1 className="text-lg sm:text-xl font-semibold flex items-center gap-2 truncate"><Package className="h-5 w-5" /> Estoque</h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={() => setOpenProduct(true)}><Plus className="h-4 w-4 mr-1" />Produto</Button>
            <Button size="sm" variant="outline" onClick={() => setOpenImport(true)}><Upload className="h-4 w-4 mr-1" />CSV</Button>
            <Button size="sm" variant="outline" onClick={() => setOpenList(true)}><ListChecks className="h-4 w-4 mr-1" />Lista</Button>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 pb-3 flex items-center gap-2 flex-wrap">
          {[
            { v: "todos", l: "Todos" },
            { v: "geladeira", l: "❄️ Geladeira" },
            { v: "freezer", l: "🧊 Freezer" },
            { v: "despensa", l: "🗄️ Despensa" },
            { v: "armario", l: "🗃️ Armário" },
          ].map(b => (
            <Button key={b.v} size="sm" variant={filter === b.v ? "default" : "outline"} onClick={() => setFilter(b.v)}>{b.l}</Button>
          ))}
          <Input placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:ml-auto sm:max-w-xs" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {atencao.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-semibold flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" />Atenção</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {atencao.map(r => (
                <Card key={r.product_id} className="border-destructive/50 bg-destructive/5">
                  <CardContent className="py-4">
                    <p className="font-medium">{r.nome}</p>
                    <p className="text-xs text-muted-foreground">{r.categoria ?? "Sem categoria"} • {LOC_LABEL[r.localizacao]}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {r.risco_ruptura && <Badge variant="destructive">Risco ruptura</Badge>}
                      {r.dias_para_vencer !== null && r.dias_para_vencer < 0 && <Badge variant="destructive">Vencido</Badge>}
                      {r.dias_para_vencer !== null && r.dias_para_vencer >= 0 && r.dias_para_vencer <= 7 && (
                        <Badge variant="secondary">Vence em {r.dias_para_vencer}d</Badge>
                      )}
                      {r.dias_restantes !== null && r.dias_restantes <= 7 && <Badge variant="outline">~{r.dias_restantes}d restantes</Badge>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {filtered.length === 0 ? (
          <Card><CardContent className="py-10 text-center space-y-3">
            <p className="text-muted-foreground">Nenhum produto encontrado.</p>
            <Button onClick={() => setOpenProduct(true)}>Cadastrar primeiro produto</Button>
          </CardContent></Card>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(r => (
              <ProductCard key={r.product_id} r={r}
                onEntrada={() => setOpenMovement({ open: true, productId: r.product_id, tipo: "entrada" })}
                onSaida={() => setOpenMovement({ open: true, productId: r.product_id, tipo: "saida" })}
              />
            ))}
          </section>
        )}
      </main>

      <ProductDialog open={openProduct} onOpenChange={setOpenProduct} familyId={familyId} userId={user?.id ?? ""} onSaved={reload} />
      <MovementDialog
        open={openMovement.open}
        onOpenChange={(o: boolean) => setOpenMovement(p => ({ ...p, open: o }))}
        familyId={familyId} userId={user?.id ?? ""} productId={openMovement.productId ?? null}
        tipo={openMovement.tipo ?? "entrada"} onSaved={reload}
      />
      <ImportDialog open={openImport} onOpenChange={setOpenImport} familyId={familyId} userId={user?.id ?? ""} onSaved={reload} />
      <ShoppingListDialog open={openList} onOpenChange={setOpenList} rows={rows} />
    </div>
  );
}

function ProductCard({ r, onEntrada, onSaida }: { r: StockRow; onEntrada: () => void; onSaida: () => void }) {
  const ratio = r.quantidade_minima > 0 ? Math.min(2, r.quantidade_atual / r.quantidade_minima) : 1;
  const pct = Math.min(100, (ratio / 2) * 100);
  const barColor = r.status === "critico" ? "bg-red-500" : r.status === "baixo" ? "bg-orange-500" : r.status === "atencao" ? "bg-yellow-500" : "bg-green-500";
  const variacao = r.variacao_preco_pct;
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-start justify-between gap-2">
          <span>{r.nome}</span>
          <Badge variant={r.status === "normal" ? "secondary" : r.status === "critico" ? "destructive" : "outline"}>
            {r.status === "critico" ? "Crítico" : r.status === "baixo" ? "Baixo" : r.status === "atencao" ? "Atenção" : "Normal"}
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">{r.categoria ?? "Sem categoria"} • {LOC_LABEL[r.localizacao]}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Estoque</span>
            <span className="font-medium">{Number(r.quantidade_atual).toLocaleString("pt-BR")} {r.unidade} <span className="text-muted-foreground text-xs">/ mín {r.quantidade_minima}</span></span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
          </div>
          {r.dias_restantes !== null && (
            <p className="text-xs text-muted-foreground mt-1">~{r.dias_restantes} dias restantes</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {r.data_validade && r.dias_para_vencer !== null && (
            <Badge variant={r.dias_para_vencer < 0 ? "destructive" : r.dias_para_vencer <= 7 ? "secondary" : "outline"}>
              {r.dias_para_vencer < 0 ? `Vencido há ${Math.abs(r.dias_para_vencer)}d` : `Vence em ${r.dias_para_vencer}d`}
            </Badge>
          )}
          {r.preco_atual !== null && (
            <Badge variant="outline">
              {fmtBRL(r.preco_atual)}
              {variacao !== null && (
                <span className={`ml-1 ${variacao > 0 ? "text-red-500" : "text-green-600"}`}>
                  {variacao > 0 ? "↑" : "↓"}{Math.abs(variacao).toFixed(1)}%
                </span>
              )}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={onEntrada}><Plus className="h-3 w-3 mr-1" />Entrada</Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={onSaida}><Minus className="h-3 w-3 mr-1" />Saída</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ProductDialog({ open, onOpenChange, familyId, userId, onSaved }: any) {
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [marca, setMarca] = useState("");
  const [produtoBase, setProdutoBase] = useState("");
  const [unidade, setUnidade] = useState<typeof UNITS[number]>("un");
  const [localizacao, setLocalizacao] = useState("despensa");
  const [qtd, setQtd] = useState("0");
  const [qtdMin, setQtdMin] = useState("1");
  const [preco, setPreco] = useState("");
  const [validade, setValidade] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) { setNome(""); setCategoria(""); setMarca(""); setProdutoBase(""); setQtd("0"); setQtdMin("1"); setPreco(""); setValidade(""); }
  }, [open]);

  const submit = async () => {
    if (!familyId || !userId || !nome) { toast.error("Informe o nome"); return; }
    setSaving(true);
    const { error } = await supabase.from("products" as any).insert({
      family_id: familyId, user_id: userId, nome,
      categoria: categoria || null, marca: marca || null,
      produto_base: produtoBase || nome || null,
      estoque_minimo: parseFloat(qtdMin.replace(",", ".")) || 1,
      preco_atual: preco ? parseFloat(preco.replace(",", ".")) : null,
      data_validade: validade || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("✅ Produto cadastrado");
    onOpenChange(false); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>+ Novo produto</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Arroz Tio João 5kg" /></div>
          <div>
            <Label>Produto base</Label>
            <Input value={produtoBase} onChange={(e) => setProdutoBase(e.target.value)}
              placeholder="Ex: Arroz (agrupa marcas diferentes)" />
            <p className="text-xs text-muted-foreground mt-1">
              Use o mesmo nome para agrupar marcas do mesmo produto
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Categoria</Label><Input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Cereais" /></div>
            <div><Label>Marca</Label><Input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Tio João, Ideal..." /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Unidade</Label>
              <Select value={unidade} onValueChange={(v: any) => setUnidade(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Localização</Label>
              <Select value={localizacao} onValueChange={setLocalizacao}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LOC_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Qtd atual</Label><Input value={qtd} onChange={(e) => setQtd(e.target.value)} inputMode="decimal" /></div>
            <div><Label>Qtd mínima</Label><Input value={qtdMin} onChange={(e) => setQtdMin(e.target.value)} inputMode="decimal" /></div>
            <div><Label>Preço (R$)</Label><Input value={preco} onChange={(e) => setPreco(e.target.value)} inputMode="decimal" placeholder="0,00" /></div>
          </div>
          <div><Label>Validade (opcional)</Label><Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MovementDialog({ open, onOpenChange, familyId, userId, productId, tipo, onSaved }: any) {
  const [qtd, setQtd] = useState("");
  const [preco, setPreco] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!open) { setQtd(""); setPreco(""); setMotivo(""); } }, [open]);

  const submit = async () => {
    if (!familyId || !userId || !productId) return;
    const q = parseFloat(qtd.replace(",", "."));
    if (!q || q <= 0) { toast.error("Quantidade inválida"); return; }
    setSaving(true);
    const { error } = await supabase.from("stock_movements" as any).insert({
      family_id: familyId, user_id: userId, product_id: productId,
      tipo, quantidade: q,
      preco_unitario: preco ? parseFloat(preco.replace(",", ".")) : null,
      motivo: motivo || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(tipo === "entrada" ? "✅ Entrada registrada" : "✅ Saída registrada");
    onOpenChange(false); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{tipo === "entrada" ? "Registrar entrada" : "Registrar saída"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Quantidade</Label><Input value={qtd} onChange={(e) => setQtd(e.target.value)} inputMode="decimal" /></div>
          {tipo === "entrada" && (
            <div><Label>Preço unitário (R$, opcional)</Label><Input value={preco} onChange={(e) => setPreco(e.target.value)} inputMode="decimal" /></div>
          )}
          <div><Label>Motivo (opcional)</Label><Input value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({ open, onOpenChange, familyId, userId, onSaved }: any) {
  const [csv, setCsv] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!open) setCsv(""); }, [open]);
  const submit = async () => {
    if (!familyId || !userId) return;
    const lines = csv.trim().split("\n").filter(l => l.trim());
    if (lines.length < 2) { toast.error("CSV vazio"); return; }
    const header = lines[0].split(",").map(s => s.trim().toLowerCase());
    const idx = (k: string) => header.indexOf(k);
    if (idx("nome") < 0) { toast.error("Coluna 'nome' obrigatória"); return; }
    setSaving(true);
    const rows = lines.slice(1).map(l => {
      const c = l.split(",").map(s => s.trim());
      return {
        family_id: familyId, user_id: userId,
        nome: c[idx("nome")],
        categoria: idx("categoria") >= 0 ? c[idx("categoria")] || null : null,
        marca: idx("marca") >= 0 ? c[idx("marca")] || null : null,
        unidade: idx("unidade") >= 0 && c[idx("unidade")] ? c[idx("unidade")] : "un",
        localizacao: idx("localizacao") >= 0 && c[idx("localizacao")] ? c[idx("localizacao")] : "despensa",
        quantidade_atual: idx("quantidade_atual") >= 0 ? parseFloat(c[idx("quantidade_atual")] || "0") : 0,
        quantidade_minima: idx("quantidade_minima") >= 0 ? parseFloat(c[idx("quantidade_minima")] || "1") : 1,
        preco_atual: idx("preco_atual") >= 0 && c[idx("preco_atual")] ? parseFloat(c[idx("preco_atual")]) : null,
      };
    });
    const { error } = await supabase.from("products" as any).insert(rows);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`✅ ${rows.length} produtos importados`);
    onOpenChange(false); onSaved();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Importar CSV</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">
          Cabeçalhos: <code>nome,categoria,marca,unidade,localizacao,quantidade_atual,quantidade_minima,preco_atual</code>
        </p>
        <textarea
          className="w-full h-40 p-2 border rounded-md bg-background text-sm font-mono"
          value={csv} onChange={(e) => setCsv(e.target.value)}
          placeholder="nome,categoria,unidade,quantidade_atual,quantidade_minima&#10;Arroz,Cereais,kg,5,2"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Importar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShoppingListDialog({ open, onOpenChange, rows }: { open: boolean; onOpenChange: (o: boolean) => void; rows: StockRow[] }) {
  const lista = useMemo(() => {
    return rows
      .filter(r => r.quantidade_atual <= r.quantidade_minima || r.risco_ruptura)
      .map(r => {
        const faltante = Math.max(r.quantidade_minima * 2 - r.quantidade_atual, r.quantidade_minima - r.quantidade_atual);
        const qtd = Math.ceil(Math.max(faltante, 1));
        return { nome: r.nome, qtd, unidade: r.unidade, localizacao: r.localizacao };
      });
  }, [rows]);
  const texto = useMemo(() =>
    lista.map(i => `• ${i.nome} — ${i.qtd} ${i.unidade}`).join("\n"), [lista]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>🛒 Lista de compras</DialogTitle></DialogHeader>
        {lista.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada precisa de reposição agora 🎉</p>
        ) : (
          <>
            <div className="space-y-1 max-h-80 overflow-auto">
              {lista.map((i, k) => (
                <div key={k} className="flex justify-between text-sm border-b pb-1">
                  <span>{i.nome}</span>
                  <span className="text-muted-foreground">{i.qtd} {i.unidade} • {LOC_LABEL[i.localizacao]}</span>
                </div>
              ))}
            </div>
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(texto); toast.success("Lista copiada"); }}>
              Copiar lista
            </Button>
          </>
        )}
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
