import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, ShoppingCart, Plus, Trash2, Pencil, ChevronDown, ChevronUp, Loader2, ListChecks, Wallet, CheckCircle2, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFamily } from "@/hooks/use-family";
import { useFamilyData } from '@/hooks/use-family-data';
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { fmtBRL } from '@/lib/format';

export const Route = createFileRoute("/compras")({
  head: () => ({ meta: [{ title: "Compras — Casinha Hub" }] }),
  component: ComprasPage,
});

type Status = "aberta" | "em_andamento" | "concluida";
type ShoppingList = {
  id: string; nome: string; status: Status;
  data_prevista: string | null; local_preferido: string | null;
  total_estimado: number; total_real: number; created_at: string;
};
type ShoppingItem = {
  id: string; list_id: string; nome: string;
  quantidade: number; unidade: string;
  preco_estimado: number | null; preco_real: number | null;
  comprado: boolean; comprado_em: string | null;
};

const UNITS = ["un", "kg", "g", "L", "ml", "cx", "pct"] as const;
const LOCAIS = ["Supermercado Mateus", "Sam's Club", "Atacadão", "Outro"] as const;

const STATUS_LABEL: Record<Status, string> = {
  aberta: "Aberta", em_andamento: "Em andamento", concluida: "Concluída",
};
const STATUS_VARIANT: Record<Status, string> = {
  aberta: "bg-muted text-muted-foreground",
  em_andamento: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  concluida: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};


function ComprasPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { familyId } = useFamily();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [itemsByList, setItemsByList] = useState<Record<string, ShoppingItem[]>>({});
  const [pendingByList, setPendingByList] = useState<Record<string, { total: number; pendentes: number }>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<Status>("aberta");
  const [loading, setLoading] = useState(true);
  const [productNames, setProductNames] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; nome: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; nome: string }[]>([]);

  const [listDialog, setListDialog] = useState<{ open: boolean; editing?: ShoppingList }>({ open: false });
  const [itemDialog, setItemDialog] = useState<{ open: boolean; listId?: string }>({ open: false });
  const [deleteList, setDeleteList] = useState<ShoppingList | null>(null);
  const [completeAsk, setCompleteAsk] = useState<ShoppingList | null>(null);
  // Estado para finalizar compra com integração financeira
  const [finalizarDialog, setFinalizarDialog] = useState<{ open: boolean; list: ShoppingList | null }>({ open: false, list: null });
  const [finalizarAccount, setFinalizarAccount] = useState<string>("");
  const [finalizarCategory, setFinalizarCategory] = useState<string>("");
  const [finalizarLoading, setFinalizarLoading] = useState(false);
  const [finalizarResult, setFinalizarResult] = useState<{ total: number; estoque: number; itens: number } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  const reload = async () => {
    if (!familyId) return;
    setLoading(true);

    const [{ data }, { data: prods }, { data: accs }, { data: cats }] = await Promise.all([
      supabase.from("shopping_lists").select("*")
        .eq("family_id", familyId).order("created_at", { ascending: false }),
      supabase.from("products").select("nome").eq("family_id", familyId).eq("ativo", true),
      supabase.from("accounts").select("id, nome").eq("family_id", familyId).eq("ativo", true).order("nome"),
      supabase.from("categories").select("id, nome").eq("family_id", familyId).eq("tipo", "despesa").order("nome"),
    ]);

    const ls = (data ?? []) as unknown as ShoppingList[];
    setLists(ls);
    setProductNames(((prods ?? []) as {nome:string}[]).map(p => p.nome));
    setAccounts((accs ?? []) as typeof accounts);
    setCategories((cats ?? []) as typeof categories);

    if (ls.length) {
      const ids = ls.map(l => l.id);
      const { data: itemsAll } = await supabase
        .from("shopping_items").select("list_id, comprado").in("list_id", ids);
      const counts: Record<string, { total: number; pendentes: number }> = {};
      ((itemsAll ?? []) as {list_id:string;comprado:boolean}[]).forEach((it) => {
        const c = counts[it.list_id] ?? { total: 0, pendentes: 0 };
        c.total++; if (!it.comprado) c.pendentes++;
        counts[it.list_id] = c;
      });
      setPendingByList(counts);
    }
    setLoading(false);
  };
  useEffect(() => { reload(); }, [familyId]);

  const loadItems = async (listId: string) => {
    const { data, error } = await supabase
      .from("shopping_items")
      .select("*")
      .eq("list_id", listId)
      .order("comprado")
      .order("nome");
    if (error) { toast.error("Erro ao carregar itens"); return; }
    setItemsByList(prev => ({ ...prev, [listId]: (data ?? []) as unknown as ShoppingItem[] }));
  };

  const toggleExpand = async (listId: string) => {
    const next = new Set(expanded);
    if (next.has(listId)) next.delete(listId);
    else { next.add(listId); if (!itemsByList[listId]) await loadItems(listId); }
    setExpanded(next);
  };

  const recalcTotals = async (listId: string) => {
    const { data } = await supabase
      .from("shopping_items")
      .select("preco_estimado, preco_real, quantidade, comprado")
      .eq("list_id", listId);
    let est = 0, real = 0;
    ((data ?? []) as Record<string,unknown>[]).forEach((it) => {
      const q = Number(it.quantidade) || 0;
      est += (Number(it.preco_estimado) || 0) * q;
      if (it.comprado) real += (Number(it.preco_real) || Number(it.preco_estimado) || 0) * q;
    });
    await supabase.from("shopping_lists").update({ total_estimado: est, total_real: real }).eq("id", listId);
    setLists(prev => prev.map(l => l.id === listId ? { ...l, total_estimado: est, total_real: real } : l));
  };

  const filtered = useMemo(() => lists.filter(l => l.status === tab), [lists, tab]);
  const summary = useMemo(() => {
    const abertas = lists.filter(l => l.status !== "concluida");
    const pendentes = abertas.reduce((s, l) => s + (pendingByList[l.id]?.pendentes ?? 0), 0);
    const estimado = abertas.reduce((s, l) => s + Number(l.total_estimado || 0), 0);
    return { abertasCount: abertas.length, pendentes, estimado };
  }, [lists, pendingByList]);

  // ── ações ────────────────────────────────────────────
  const saveList = async (form: { nome: string; data_prevista: Date | undefined; local_preferido: string }) => {
    if (!familyId) return;
    if (!form.nome.trim()) { toast.error("Informe o nome da lista"); return; }
    const payload = {
      nome: form.nome.trim(),
      data_prevista: form.data_prevista ? format(form.data_prevista, "yyyy-MM-dd") : null,
      local_preferido: form.local_preferido || null,
    };
    if (listDialog.editing) {
      const { error } = await supabase.from("shopping_lists").update(payload).eq("id", listDialog.editing.id);
      if (error) { toast.error("Erro ao salvar"); return; }
      toast.success("Lista atualizada");
    } else {
      const { error } = await supabase.from("shopping_lists").insert({ ...payload, family_id: familyId, status: "aberta" });
      if (error) { toast.error("Erro ao criar lista"); return; }
      toast.success("Lista criada");
    }
    setListDialog({ open: false });
    await reload();
  };

  const removeList = async (l: ShoppingList) => {
    await supabase.from("shopping_items").delete().eq("list_id", l.id);
    const { error } = await supabase.from("shopping_lists").delete().eq("id", l.id);
    if (error) toast.error("Erro ao excluir"); else toast.success("Lista excluída");
    setDeleteList(null);
    await reload();
  };

  const saveItem = async (form: { nome: string; quantidade: number; unidade: string; preco_estimado: number | null }) => {
    if (!familyId || !itemDialog.listId) return;
    if (!form.nome.trim()) { toast.error("Informe o nome do item"); return; }
    const { error } = await supabase.from("shopping_items").insert({
      list_id: itemDialog.listId,
      family_id: familyId,
      nome: form.nome.trim(),
      quantidade: form.quantidade || 1,
      unidade: form.unidade,
      preco_estimado: form.preco_estimado,
    });
    if (error) { toast.error("Erro ao adicionar item"); return; }
    toast.success("Item adicionado");
    const lid = itemDialog.listId;
    setItemDialog({ open: false });
    await loadItems(lid);
    await recalcTotals(lid);
    await refreshCounts(lid);
  };

  const refreshCounts = async (listId: string) => {
    const { data } = await supabase.from("shopping_items").select("comprado").eq("list_id", listId);
    const arr = (data ?? []) as Record<string,unknown>[];
    setPendingByList(prev => ({ ...prev, [listId]: { total: arr.length, pendentes: arr.filter((i: any) => !i.comprado).length } }));
  };

  const toggleItem = async (item: ShoppingItem) => {
    const novo = !item.comprado;
    const { error } = await supabase.from("shopping_items").update({
      comprado: novo,
      comprado_em: novo ? new Date().toISOString() : null,
    }).eq("id", item.id);
    if (error) { toast.error("Erro"); return; }
    setItemsByList(prev => ({
      ...prev,
      [item.list_id]: (prev[item.list_id] ?? []).map(i => i.id === item.id ? { ...i, comprado: novo, comprado_em: novo ? new Date().toISOString() : null } : i),
    }));
    await recalcTotals(item.list_id);
    await refreshCounts(item.list_id);

    // se todos comprados → perguntar concluir
    const items = (itemsByList[item.list_id] ?? []).map(i => i.id === item.id ? { ...i, comprado: novo } : i);
    if (novo && items.length > 0 && items.every(i => i.comprado)) {
      const list = lists.find(l => l.id === item.list_id);
      if (list && list.status !== "concluida") setCompleteAsk(list);
    }
  };

  const updateItemPrice = async (item: ShoppingItem, preco: number) => {
    await supabase.from("shopping_items").update({ preco_real: preco }).eq("id", item.id);
    setItemsByList(prev => ({
      ...prev,
      [item.list_id]: (prev[item.list_id] ?? []).map(i => i.id === item.id ? { ...i, preco_real: preco } : i),
    }));
    await recalcTotals(item.list_id);
  };

  const removeItem = async (item: ShoppingItem) => {
    await supabase.from("shopping_items").delete().eq("id", item.id);
    setItemsByList(prev => ({ ...prev, [item.list_id]: (prev[item.list_id] ?? []).filter(i => i.id !== item.id) }));
    await recalcTotals(item.list_id);
    await refreshCounts(item.list_id);
  };

  const concluirLista = async (l: ShoppingList) => {
    // Abrir dialog de finalização com integração financeira
    setCompleteAsk(null);
    setFinalizarResult(null);
    setFinalizarAccount(accounts[0]?.id ?? "");
    // Tentar auto-detectar categoria supermercado
    const catSuper = categories.find(c =>
      c.nome.toLowerCase().includes("supermercado") || c.nome.toLowerCase().includes("alimenta")
    );
    setFinalizarCategory(catSuper?.id ?? categories[0]?.id ?? "");
    setFinalizarDialog({ open: true, list: l });
  };

  const handleFinalizarCompra = async () => {
    const l = finalizarDialog.list;
    if (!l || !familyId || !user) return;
    if (!finalizarAccount) { toast.error("Selecione a conta"); return; }

    setFinalizarLoading(true);
    try {
      const { data, error } = await supabase.rpc("finalizar_compra", {
        p_list_id: l.id,
        p_family_id: familyId,
        p_user_id: user.id,
        p_account_id: finalizarAccount,
        p_category_id: finalizarCategory || null,
        p_data: new Date().toISOString().slice(0, 10),
      });
      if (error) { toast.error(error.message); return; }
      const result = data as Record<string,unknown>;
      setFinalizarResult({
        total: result.total,
        estoque: result.estoque_atualizado,
        itens: result.itens_comprados,
      });
      toast.success(`✅ Compra finalizada! ${result.itens_comprados} itens, R$ ${Number(result.total).toFixed(2)}`);
      await reload();
    } finally {
      setFinalizarLoading(false);
    }
  };

  // ── UI ────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-4" style={{ background: "var(--gradient-subtle)" }}>
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
              <ShoppingCart className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">🛒 Compras</h1>
              <p className="text-sm text-muted-foreground">Listas e itens da família</p>
            </div>
          </div>
          <Button onClick={() => setListDialog({ open: true })} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Nova lista
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <SummaryCard icon={<ListChecks className="h-4 w-4" />} label="Listas abertas" value={String(summary.abertasCount)} />
          <SummaryCard icon={<ShoppingCart className="h-4 w-4" />} label="Itens pendentes" value={String(summary.pendentes)} />
          <SummaryCard icon={<Wallet className="h-4 w-4" />} label="Estimado" value={fmtBRL(summary.estimado)} />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Status)}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="aberta">Abertas</TabsTrigger>
            <TabsTrigger value="em_andamento">Em andamento</TabsTrigger>
            <TabsTrigger value="concluida">Concluídas</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map(i => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">
            <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Nenhuma lista nesta aba</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(l => {
              const counts = pendingByList[l.id] ?? { total: 0, pendentes: 0 };
              const comprados = counts.total - counts.pendentes;
              const pct = counts.total > 0 ? (comprados / counts.total) * 100 : 0;
              const isOpen = expanded.has(l.id);
              const items = itemsByList[l.id];
              return (
                <Card key={l.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-lg">🛒</span>
                          <h3 className="font-semibold truncate">{l.nome}</h3>
                          <Badge className={cn("border-0", STATUS_VARIANT[l.status])}>{STATUS_LABEL[l.status]}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {counts.total} itens · {comprados} comprados · {fmtBRL(l.status === "concluida" ? l.total_real : l.total_estimado)}
                        </p>
                        {(l.data_prevista || l.local_preferido) && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {l.data_prevista && <>📅 {format(new Date(l.data_prevista + "T00:00:00"), "dd MMM", { locale: ptBR })}</>}
                            {l.data_prevista && l.local_preferido && " · "}
                            {l.local_preferido && <>📍 {l.local_preferido}</>}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" onClick={() => setListDialog({ open: true, editing: l })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteList(l)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => toggleExpand(l.id)}>
                        {isOpen ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                        {isOpen ? "Ocultar itens" : "Ver itens"}
                      </Button>
                      {l.status !== "concluida" && counts.total > 0 && counts.pendentes === 0 && (
                        <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => concluirLista(l)}>
                          <CheckCircle2 className="h-4 w-4" />
                          Finalizar
                        </Button>
                      )}
                    </div>

                    {isOpen && (
                      <div className="space-y-2 pt-2 border-t">
                        {!items ? (
                          <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                        ) : items.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-2">Nenhum item ainda</p>
                        ) : (
                          items.map(it => (
                            <ItemRow key={it.id} item={it} onToggle={() => toggleItem(it)} onPrice={(v) => updateItemPrice(it, v)} onRemove={() => removeItem(it)} />
                          ))
                        )}
                        <Button variant="ghost" size="sm" className="w-full" onClick={() => setItemDialog({ open: true, listId: l.id })}>
                          <Plus className="h-4 w-4 mr-1" /> Adicionar item
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* DIALOG: Lista */}
      <ListDialog
        key={listDialog.editing?.id ?? "new"}
        open={listDialog.open}
        editing={listDialog.editing}
        onClose={() => setListDialog({ open: false })}
        onSave={saveList}
      />

      {/* DIALOG: Item */}
      <ItemDialog
        open={itemDialog.open}
        productNames={productNames}
        onClose={() => setItemDialog({ open: false })}
        onSave={saveItem}
      />

      {/* CONFIRM excluir */}
      <AlertDialog open={!!deleteList} onOpenChange={(o) => !o && setDeleteList(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lista?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteList?.nome}" e todos os seus itens serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteList && removeList(deleteList)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CONFIRM concluir */}
      <AlertDialog open={!!completeAsk} onOpenChange={(o) => !o && setCompleteAsk(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar compra?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os itens de "{completeAsk?.nome}" foram marcados. Deseja finalizar e registrar no financeiro?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Agora não</AlertDialogCancel>
            <AlertDialogAction onClick={() => completeAsk && concluirLista(completeAsk)}>Finalizar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DIALOG: Finalizar compra com integração financeira */}
      <Dialog open={finalizarDialog.open} onOpenChange={(o) => { if (!finalizarLoading) setFinalizarDialog({ open: o, list: finalizarDialog.list }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Finalizar compra
            </DialogTitle>
          </DialogHeader>

          {finalizarResult ? (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 p-4 space-y-2">
                <p className="font-semibold text-emerald-700 dark:text-emerald-400">✅ Compra finalizada com sucesso!</p>
                <div className="text-sm space-y-1 text-emerald-600 dark:text-emerald-400">
                  <p>💰 Transação criada: <strong>{fmtBRL(finalizarResult.total)}</strong></p>
                  <p>📦 Estoque atualizado: <strong>{finalizarResult.estoque} produtos</strong></p>
                  <p>🛒 Itens comprados: <strong>{finalizarResult.itens}</strong></p>
                </div>
              </div>
              <Button className="w-full" onClick={() => setFinalizarDialog({ open: false, list: null })}>
                Fechar
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Ao finalizar, o sistema irá automaticamente:
              </p>
              <ul className="text-sm space-y-1 text-muted-foreground list-none">
                <li className="flex items-center gap-2"><span className="text-emerald-600">✓</span> Criar lançamento financeiro</li>
                <li className="flex items-center gap-2"><span className="text-emerald-600">✓</span> Atualizar estoque dos produtos vinculados</li>
                <li className="flex items-center gap-2"><span className="text-emerald-600">✓</span> Registrar movimentação de estoque</li>
              </ul>

              <div className="space-y-2">
                <Label>Conta bancária <span className="text-destructive">*</span></Label>
                <Select value={finalizarAccount} onValueChange={setFinalizarAccount}>
                  <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Categoria financeira</Label>
                <Select value={finalizarCategory} onValueChange={setFinalizarCategory}>
                  <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={() => setFinalizarDialog({ open: false, list: null })} disabled={finalizarLoading}>
                  Cancelar
                </Button>
                <Button onClick={handleFinalizarCompra} disabled={finalizarLoading || !finalizarAccount} className="gap-2">
                  {finalizarLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Finalizar compra
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">{icon}<span>{label}</span></div>
        <div className="text-base font-bold mt-1 truncate">{value}</div>
      </CardContent>
    </Card>
  );
}

function ItemRow({ item, onToggle, onPrice, onRemove }: {
  item: ShoppingItem;
  onToggle: () => void;
  onPrice: (v: number) => void;
  onRemove: () => void;
}) {
  const [priceInput, setPriceInput] = useState<string>(item.preco_real != null ? String(item.preco_real) : "");
  return (
    <div className="flex items-center gap-2 text-sm">
      <Checkbox checked={item.comprado} onCheckedChange={onToggle} />
      <div className="flex-1 min-w-0">
        <div className={cn("truncate", item.comprado && "line-through text-muted-foreground")}>{item.nome}</div>
        <div className="text-[11px] text-muted-foreground">
          {item.quantidade} {item.unidade}
          {item.preco_estimado != null && <> · est. {fmtBRL(Number(item.preco_estimado) * Number(item.quantidade))}</>}
        </div>
      </div>
      {item.comprado && (
        <Input
          type="number" step="0.01" placeholder="R$ real"
          className="h-8 w-24 text-xs"
          value={priceInput}
          onChange={(e) => setPriceInput(e.target.value)}
          onBlur={() => {
            const n = parseFloat(priceInput);
            if (!isNaN(n) && n !== Number(item.preco_real)) onPrice(n);
          }}
        />
      )}
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onRemove}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function ListDialog({ open, editing, onClose, onSave }: {
  open: boolean; editing?: ShoppingList; onClose: () => void;
  onSave: (form: { nome: string; data_prevista: Date | undefined; local_preferido: string }) => void;
}) {
  const initialLocal = editing?.local_preferido && !LOCAIS.includes(editing.local_preferido as any) ? "Outro" : (editing?.local_preferido ?? "");
  const [nome, setNome] = useState(editing?.nome ?? "");
  const [data, setData] = useState<Date | undefined>(editing?.data_prevista ? new Date(editing.data_prevista + "T00:00:00") : undefined);
  const [localSel, setLocalSel] = useState<string>(initialLocal);
  const [localOutro, setLocalOutro] = useState<string>(initialLocal === "Outro" ? (editing?.local_preferido ?? "") : "");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Editar lista" : "Nova lista"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Compra do mês" />
          </div>
          <div>
            <Label>Data prevista</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !data && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {data ? format(data, "PPP", { locale: ptBR }) : "Escolher data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={data} onSelect={setData} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Local preferido</Label>
            <Select value={localSel} onValueChange={setLocalSel}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                {LOCAIS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            {localSel === "Outro" && (
              <Input className="mt-2" value={localOutro} onChange={(e) => setLocalOutro(e.target.value)} placeholder="Nome do local" />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave({
            nome,
            data_prevista: data,
            local_preferido: localSel === "Outro" ? localOutro : localSel,
          })}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ItemDialog({ open, productNames, onClose, onSave }: {
  open: boolean; productNames: string[]; onClose: () => void;
  onSave: (form: { nome: string; quantidade: number; unidade: string; preco_estimado: number | null }) => void;
}) {
  const [nome, setNome] = useState("");
  const [quantidade, setQuantidade] = useState<string>("1");
  const [unidade, setUnidade] = useState<string>("un");
  const [preco, setPreco] = useState<string>("");

  useEffect(() => {
    if (open) { setNome(""); setQuantidade("1"); setUnidade("un"); setPreco(""); }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo item</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome *</Label>
            <Input list="produtos-sugestoes" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Arroz 5kg" />
            <datalist id="produtos-sugestoes">
              {productNames.map(n => <option key={n} value={n} />)}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Quantidade</Label>
              <Input type="number" step="0.01" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
            </div>
            <div>
              <Label>Unidade</Label>
              <Select value={unidade} onValueChange={setUnidade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Preço estimado (R$)</Label>
            <Input type="number" step="0.01" value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="0,00" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave({
            nome,
            quantidade: parseFloat(quantidade) || 1,
            unidade,
            preco_estimado: preco ? parseFloat(preco) : null,
          })}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
