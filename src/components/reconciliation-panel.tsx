import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2, Sparkles, Trash2, Search } from "lucide-react";
import { fmtBRL as fmt } from '@/lib/format';

interface Cat {
  id: string;
  nome: string;
  tipo: "despesa" | "receita";
  cor: string;
  icone: string;
}
interface Acc {
  id: string;
  nome: string;
  icone: string;
}
interface PendingTx {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category_id: string | null;
  account_id: string | null;
  tipo_especial: "normal" | "transferencia" | "pagamento_fatura";
}

type FilterMode = "todos" | "sem_categoria" | "sem_conta";

const fmtDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

interface Props {
  familyId: string;
  categories: Cat[];
  accounts: Acc[];
  onChanged?: () => void;
}

export function ReconciliationPanel({ familyId, categories, accounts, onChanged }: Props) {
  const [items, setItems] = useState<PendingTx[]>([]);
  const [totalImported, setTotalImported] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>("todos");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCat, setBulkCat] = useState<string>("");
  const [bulkAcc, setBulkAcc] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: pending } = await supabase
      .from("transactions")
      .select("id, date, description, amount, type, category_id, account_id, tipo_especial")
      .eq("family_id", familyId)
      .eq("source", "importado")
      .or("category_id.is.null,account_id.is.null")
      .order("date", { ascending: false })
      .limit(500);

    const { count } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("family_id", familyId)
      .eq("source", "importado");

    setItems((pending as PendingTx[]) ?? []);
    setTotalImported(count ?? 0);
    setSelected(new Set());
    setLoading(false);
  };

  useEffect(() => {
    if (familyId) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId]);

  const filtered = useMemo(() => {
    return items.filter((t) => {
      if (filter === "sem_categoria" && t.category_id) return false;
      if (filter === "sem_conta" && t.account_id) return false;
      if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [items, filter, search]);

  const pendingCount = items.length;
  const reconciledCount = Math.max(0, totalImported - pendingCount);
  const progressPct = totalImported > 0 ? Math.round((reconciledCount / totalImported) * 100) : 0;

  const updateField = async (id: string, patch: Partial<PendingTx>) => {
    const { error } = await supabase.from("transactions").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    // Aprender regra quando categoria é definida manualmente
    if (patch.category_id) {
      const tx = items.find(t => t.id === id);
      if (tx?.description && familyId) {
        void supabase.rpc("learn_categorization_rule", {
          _family_id: familyId,
          _termo: tx.description.toLowerCase().slice(0, 60),
          _category_id: patch.category_id,
        });
      }
    }
    setItems((prev) =>
      prev
        .map((t) => (t.id === id ? { ...t, ...patch } : t))
        .filter((t) => !t.category_id || !t.account_id),
    );
    if (patch.account_id) {
      void supabase.rpc("recalc_account_balance", { _account_id: patch.account_id });
    }
    onChanged?.();
  };

  const ignoreTx = async (id: string) => {
    if (!confirm("Excluir esta transação?")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setItems((prev) => prev.filter((t) => t.id !== id));
    setSelected((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
    toast.success("Transação removida");
    onChanged?.();
  };

  const toggleAll = (c: boolean) => {
    setSelected(c ? new Set(filtered.map((t) => t.id)) : new Set());
  };
  const toggleOne = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const applyBulk = async () => {
    if (selected.size === 0) return;
    if (!bulkCat && !bulkAcc) {
      toast.error("Escolha uma categoria ou conta");
      return;
    }
    setBusy(true);
    const patch: Partial<PendingTx> = {};
    if (bulkCat) patch.category_id = bulkCat;
    if (bulkAcc) patch.account_id = bulkAcc;
    const ids = Array.from(selected);
    const { error } = await supabase.from("transactions").update(patch).in("id", ids);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} transação(ões) atualizadas`);
    setBulkCat("");
    setBulkAcc("");
    await load();
  };

  const applyAutoRules = async () => {
    const targets = items.filter((t) => !t.category_id);
    if (targets.length === 0) {
      toast.info("Nenhuma transação sem categoria");
      return;
    }
    setBusy(true);
    let count = 0;
    for (const t of targets) {
      const { data } = await supabase.rpc("categorize_transaction", {
        _family_id: familyId,
        _description: t.description,
        _dummy: false,
      });
      const sug = Array.isArray(data) ? data[0] : data;
      if (sug?.category_id) {
        await supabase.from("transactions").update({ category_id: sug.category_id }).eq("id", t.id);
        count++;
      }
    }
    setBusy(false);
    toast.success(`${count} transação(ões) categorizadas automaticamente`);
    await load();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 shadow-[var(--shadow-soft)]">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Conciliação</CardTitle>
            <CardDescription>
              Categorize e atribua conta às transações importadas.
            </CardDescription>
          </div>
          <Button onClick={applyAutoRules} disabled={busy} variant="outline" size="sm" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Aplicar regras automáticas
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              <span className="text-foreground font-medium">{reconciledCount}</span> categorizadas ✅ ·{" "}
              <span className="text-foreground font-medium">{pendingCount}</span> pendentes ⚠️
            </span>
            <span className="text-muted-foreground">{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            <Button size="sm" variant={filter === "todos" ? "default" : "outline"} onClick={() => setFilter("todos")}>
              Todos
            </Button>
            <Button
              size="sm"
              variant={filter === "sem_categoria" ? "default" : "outline"}
              onClick={() => setFilter("sem_categoria")}
            >
              Sem categoria
            </Button>
            <Button
              size="sm"
              variant={filter === "sem_conta" ? "default" : "outline"}
              onClick={() => setFilter("sem_conta")}
            >
              Sem conta
            </Button>
          </div>
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar descrição"
              className="pl-8 h-9"
            />
          </div>
          <Badge variant="secondary">{filtered.length} pendente(s)</Badge>
        </div>

        {selected.size > 0 && (
          <div className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-2">
            <div className="text-sm font-medium">{selected.size} selecionada(s)</div>
            <div className="flex flex-wrap gap-2 items-center">
              <Select value={bulkCat || undefined} onValueChange={setBulkCat}>
                <SelectTrigger className="h-8 w-[180px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.icone} {c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={bulkAcc || undefined} onValueChange={setBulkAcc}>
                <SelectTrigger className="h-8 w-[180px]"><SelectValue placeholder="Conta" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.icone} {a.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={applyBulk} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
              </Button>
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            🎉 Tudo conciliado!
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground border-b pb-2">
              <Checkbox
                checked={selected.size === filtered.length && filtered.length > 0}
                onCheckedChange={(c) => toggleAll(Boolean(c))}
              />
              <span>Selecionar todos</span>
            </div>
            <ul className="divide-y divide-border">
              {filtered.map((t) => {
                const noCat = !t.category_id;
                const noAcc = !t.account_id;
                const status =
                  noCat && noAcc
                    ? { label: "Sem categoria e conta", cls: "bg-red-500/15 text-red-700" }
                    : noCat
                    ? { label: "Sem categoria", cls: "bg-yellow-500/15 text-yellow-700" }
                    : { label: "Sem conta", cls: "bg-blue-500/15 text-blue-700" };
                const validCats = categories.filter(
                  (c) => c.tipo === (t.type === "income" ? "receita" : "despesa"),
                );
                return (
                  <li key={t.id} className="py-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={selected.has(t.id)}
                        onCheckedChange={() => toggleOne(t.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="text-xs text-muted-foreground">{fmtDate(t.date)}</span>
                          <span className="font-medium truncate">{t.description}</span>
                          <Badge className={`font-normal ${status.cls}`}>{status.label}</Badge>
                        </div>
                      </div>
                      <div
                        className="font-semibold text-sm shrink-0"
                        style={{ color: t.type === "income" ? "var(--success)" : "var(--destructive)" }}
                      >
                        {t.type === "income" ? "+" : "−"} {fmt(t.amount)}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-muted-foreground hover:text-destructive"
                        onClick={() => ignoreTx(t.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 pl-6">
                      <Select
                        value={t.category_id || undefined}
                        onValueChange={(v) => updateField(t.id, { category_id: v })}
                      >
                        <SelectTrigger className="h-8 w-[170px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
                        <SelectContent>
                          {validCats.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.icone} {c.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={t.account_id || undefined}
                        onValueChange={(v) => updateField(t.id, { account_id: v })}
                      >
                        <SelectTrigger className="h-8 w-[170px]"><SelectValue placeholder="Conta" /></SelectTrigger>
                        <SelectContent>
                          {accounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.icone} {a.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={t.tipo_especial}
                        onValueChange={(v) =>
                          updateField(t.id, { tipo_especial: v as PendingTx["tipo_especial"] })
                        }
                      >
                        <SelectTrigger className="h-8 w-[170px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="transferencia">Transferência</SelectItem>
                          <SelectItem value="pagamento_fatura">Pagamento fatura</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
