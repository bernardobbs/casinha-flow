import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
  Repeat,
  Trash2,
  TrendingDown,
  TrendingUp,
  Search,
} from "lucide-react";

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
interface Tx {
  id: string;
  family_id: string;
  user_id: string;
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  source: string;
  scope: string;
  category_id: string | null;
  account_id: string | null;
  is_essencial: boolean;
  tipo_especial: "normal" | "transferencia" | "pagamento_fatura";
  recorrente_id?: string | null;
}
interface MonthSummary {
  mes: string;
  total_receita: number;
  total_despesa: number;
  qtd: number;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtMonthLabel = (iso: string) => {
  const d = new Date(iso + (iso.length === 7 ? "-01" : "") + "T00:00:00");
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`;
};

const fmtDayLabel = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()} de ${MESES[d.getMonth()]}`;
};

const firstOfMonth = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);

const addMonths = (iso: string, delta: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + delta);
  return firstOfMonth(d);
};

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

const tipoEspecialBadge = (t: Tx["tipo_especial"]) => {
  if (t === "transferencia") return "🔄 Transferência";
  if (t === "pagamento_fatura") return "💳 Pag. fatura";
  return null;
};

interface Props {
  familyId: string;
  userId: string;
  categories: Cat[];
  accounts: Acc[];
}

export function MonthView({ familyId, userId, categories, accounts }: Props) {
  const todayIso = firstOfMonth(new Date());
  const [currentMes, setCurrentMes] = useState<string>(todayIso);
  const [summary, setSummary] = useState<MonthSummary[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "income" | "expense" | "transfer">("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Tx | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const loadSummary = async () => {
    const { data } = await supabase.rpc("get_monthly_summary", { p_family_id: familyId });
    setSummary(((data ?? []) as MonthSummary[]).map((r) => ({
      ...r,
      total_receita: Number(r.total_receita),
      total_despesa: Number(r.total_despesa),
    })));
  };

  const loadMonth = async (mes: string) => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_transactions_by_month", {
      p_family_id: familyId,
      p_mes: mes,
    });
    if (error) toast.error(error.message);
    setTxs(((data ?? []) as Tx[]).map((t) => ({ ...t, amount: Number(t.amount) })));
    setLoading(false);
  };

  useEffect(() => {
    if (familyId) {
      void loadSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId]);

  useEffect(() => {
    if (familyId) void loadMonth(currentMes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId, currentMes]);

  const totals = useMemo(() => {
    let inc = 0, exp = 0;
    for (const t of txs) {
      if (t.type === "income") inc += t.amount;
      else exp += t.amount;
    }
    return { inc, exp, bal: inc - exp };
  }, [txs]);

  const filtered = useMemo(() => {
    return txs.filter((t) => {
      if (filter === "income" && t.type !== "income") return false;
      if (filter === "expense" && t.type !== "expense") return false;
      if (filter === "transfer" && t.tipo_especial === "normal") return false;
      if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [txs, filter, search]);

  const groups = useMemo(() => {
    const map = new Map<string, Tx[]>();
    for (const t of filtered) {
      if (!map.has(t.date)) map.set(t.date, []);
      map.get(t.date)!.push(t);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  const refresh = () => {
    void loadMonth(currentMes);
    void loadSummary();
  };

  return (
    <div className="space-y-4">
      {/* Cards de totais do mês */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border/60 bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Receitas</p>
          <p className="text-lg font-semibold tabular-nums" style={{ color: "var(--success)" }}>
            {fmt(totals.inc)}
          </p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Despesas</p>
          <p className="text-lg font-semibold tabular-nums text-destructive">
            {fmt(totals.exp)}
          </p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Saldo</p>
          <p className="text-lg font-semibold tabular-nums" style={{ color: totals.bal >= 0 ? "var(--success)" : "var(--destructive)" }}>
            {fmt(totals.bal)}
          </p>
        </div>
      </div>

      {/* Month selector */}
      <div className="flex items-center justify-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setCurrentMes(addMonths(currentMes, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="min-w-[180px] gap-2 capitalize">
              {fmtMonthLabel(currentMes)}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-1 max-h-[360px] overflow-auto">
            {summary.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3">Sem meses anteriores.</p>
            ) : (
              summary.map((s) => {
                const mesIso = s.mes.slice(0, 10);
                const isCurrent = mesIso === todayIso;
                const isSelected = mesIso === currentMes;
                return (
                  <button
                    key={mesIso}
                    onClick={() => {
                      setCurrentMes(mesIso);
                      setPickerOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-sm text-sm hover:bg-muted transition flex items-start justify-between gap-2 ${
                      isSelected ? "bg-muted" : ""
                    }`}
                  >
                    <div className="flex-1">
                      <div className="font-medium capitalize flex items-center gap-2">
                        {fmtMonthLabel(mesIso)}
                        {isCurrent && (
                          <Badge variant="secondary" className="font-normal text-[10px]">Este mês</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {fmt(s.total_receita)} recebido · {fmt(s.total_despesa)} gasto
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </PopoverContent>
        </Popover>
        <Button variant="outline" size="icon" onClick={() => setCurrentMes(addMonths(currentMes, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="border-border/60">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">💰 Receitas</div>
            <div className="font-semibold" style={{ color: "var(--success)" }}>
              {fmt(totals.inc)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">💸 Despesas</div>
            <div className="font-semibold text-destructive">{fmt(totals.exp)}</div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">💵 Saldo</div>
            <div
              className="font-semibold"
              style={{ color: totals.bal >= 0 ? "var(--success)" : "var(--destructive)" }}
            >
              {fmt(totals.bal)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>Todos</Button>
          <Button size="sm" variant={filter === "income" ? "default" : "outline"} onClick={() => setFilter("income")}>Receitas</Button>
          <Button size="sm" variant={filter === "expense" ? "default" : "outline"} onClick={() => setFilter("expense")}>Despesas</Button>
          <Button size="sm" variant={filter === "transfer" ? "default" : "outline"} onClick={() => setFilter("transfer")}>Transferências</Button>
        </div>
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar"
            className="pl-8 h-9"
          />
        </div>
      </div>

      {/* List grouped by date */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Nenhuma transação neste mês.</p>
      ) : (
        <div className="space-y-4">
          {groups.map(([day, list]) => (
            <div key={day}>
              <div className="text-xs font-medium text-muted-foreground mb-1 px-1">
                📅 {fmtDayLabel(day)}
              </div>
              <Card className="border-border/60 overflow-hidden">
                <ul className="divide-y divide-border">
                  {list.map((t) => {
                    const cat = t.category_id ? categories.find((c) => c.id === t.category_id) : null;
                    const acc = t.account_id ? accounts.find((a) => a.id === t.account_id) : null;
                    const special = tipoEspecialBadge(t.tipo_especial);
                    return (
                      <li
                        key={t.id}
                        className="px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-muted/40 transition"
                        onClick={() => setOpen(t)}
                      >
                        <div className="h-8 w-8 rounded-full flex items-center justify-center text-base shrink-0"
                          style={{
                            background: cat
                              ? `color-mix(in oklab, ${cat.cor} 14%, transparent)`
                              : t.type === "income"
                              ? "color-mix(in oklab, var(--success) 12%, transparent)"
                              : "color-mix(in oklab, var(--destructive) 12%, transparent)",
                            color: cat ? cat.cor : t.type === "income" ? "var(--success)" : "var(--destructive)",
                          }}
                        >
                          {cat ? <span>{cat.icone}</span> : t.type === "income" ? "💰" : "💸"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate flex items-center gap-1">
                            {truncate(t.description, 35)}
                            {t.recorrente_id && <Repeat className="h-3 w-3 text-primary shrink-0" />}
                          </div>
                          <div className="flex flex-wrap items-center gap-1 mt-0.5">
                            {acc && (
                              <Badge variant="outline" className="font-normal text-[10px] py-0">
                                {acc.icone} {acc.nome}
                              </Badge>
                            )}
                            {special && (
                              <Badge variant="secondary" className="font-normal text-[10px] py-0">
                                {special}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div
                          className="text-sm font-semibold shrink-0"
                          style={{ color: t.type === "income" ? "var(--success)" : "var(--destructive)" }}
                        >
                          {t.type === "income" ? "+" : "−"} {fmt(t.amount)}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </div>
          ))}
        </div>
      )}

      <EditDrawer
        tx={open}
        onClose={() => setOpen(null)}
        categories={categories}
        accounts={accounts}
        userId={userId}
        familyId={familyId}
        onSaved={() => {
          setOpen(null);
          refresh();
        }}
      />
    </div>
  );
}

// =================== Drawer ===================

interface DrawerProps {
  tx: Tx | null;
  categories: Cat[];
  accounts: Acc[];
  familyId: string;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}

function EditDrawer({ tx, categories, accounts, familyId, userId, onClose, onSaved }: DrawerProps) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [accountId, setAccountId] = useState<string>("");
  const [tipoEspecial, setTipoEspecial] = useState<Tx["tipo_especial"]>("normal");
  const [isEssencial, setIsEssencial] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);

  // recurring section
  const [enableRecurring, setEnableRecurring] = useState(false);
  const [diaMes, setDiaMes] = useState<number>(1);
  const [frequencia, setFrequencia] = useState<"mensal" | "quinzenal" | "semanal" | "anual">("mensal");
  const [recurringInfo, setRecurringInfo] = useState<{ description: string; frequencia: string } | null>(null);
  const [creatingRec, setCreatingRec] = useState(false);

  useEffect(() => {
    if (!tx) return;
    setDescription(tx.description);
    setAmount(String(tx.amount));
    setDate(tx.date);
    setCategoryId(tx.category_id ?? "");
    setAccountId(tx.account_id ?? "");
    setTipoEspecial(tx.tipo_especial);
    setIsEssencial(tx.is_essencial);
    setObservacao("");
    setEnableRecurring(false);
    setDiaMes(new Date(tx.date + "T00:00:00").getDate());
    setFrequencia("mensal");
    setRecurringInfo(null);
    if (tx.recorrente_id) {
      void supabase
        .from("recurring_transactions")
        .select("description, frequencia")
        .eq("id", tx.recorrente_id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setRecurringInfo({ description: data.description, frequencia: data.frequencia });
        });
    }
  }, [tx]);

  if (!tx) return null;

  const validCats = categories.filter(
    (c) => c.tipo === (tx.type === "income" ? "receita" : "despesa"),
  );

  const handleSave = async () => {
    setSaving(true);
    const amt = Number(amount.replace(",", "."));
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Valor inválido");
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from("transactions")
      .update({
        description: description.trim(),
        amount: amt,
        date,
        category_id: categoryId || null,
        account_id: accountId || null,
        tipo_especial: tipoEspecial,
        is_essencial: isEssencial,
      })
      .eq("id", tx.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    if (accountId) void supabase.rpc("recalc_account_balance", { _account_id: accountId });
    onSaved();
  };

  const handleDelete = async () => {
    if (!confirm("Excluir esta transação?")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", tx.id);
    if (error) return toast.error(error.message);
    toast.success("Removida");
    if (tx.account_id) void supabase.rpc("recalc_account_balance", { _account_id: tx.account_id });
    onSaved();
  };

  const computeProxima = (): string => {
    const d = new Date(date + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (frequencia === "mensal" || frequencia === "anual") {
      const target = new Date(today.getFullYear(), today.getMonth(), diaMes);
      if (target <= today) target.setMonth(target.getMonth() + (frequencia === "anual" ? 12 : 1));
      return target.toISOString().slice(0, 10);
    }
    const days = frequencia === "semanal" ? 7 : 14;
    const next = new Date(d);
    while (next <= today) next.setDate(next.getDate() + days);
    return next.toISOString().slice(0, 10);
  };

  const handleCreateRecurring = async () => {
    setCreatingRec(true);
    const amt = Number(amount.replace(",", "."));
    const { data, error } = await supabase
      .from("recurring_transactions")
      .insert({
        family_id: familyId,
        user_id: userId,
        description: description.trim(),
        amount: amt,
        type: tx.type,
        frequencia,
        dia_do_mes: frequencia === "mensal" || frequencia === "anual" ? diaMes : null,
        account_id: accountId || null,
        category_id: categoryId || null,
        is_essencial: isEssencial,
        ativo: true,
        proxima_data: computeProxima(),
      })
      .select("id")
      .single();
    if (error || !data) {
      setCreatingRec(false);
      return toast.error(error?.message ?? "Erro");
    }
    const { error: linkErr } = await supabase
      .from("transactions")
      .update({ recorrente_id: data.id })
      .eq("id", tx.id);
    setCreatingRec(false);
    if (linkErr) return toast.error(linkErr.message);
    toast.success("✅ Recorrente criada");
    onSaved();
  };

  const handleUnlink = async () => {
    const { error } = await supabase
      .from("transactions")
      .update({ recorrente_id: null })
      .eq("id", tx.id);
    if (error) return toast.error(error.message);
    toast.success("Desvinculada");
    onSaved();
  };

  return (
    <Sheet open={!!tx} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar transação</SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            {tx.type === "income" ? (
              <TrendingUp className="h-4 w-4" style={{ color: "var(--success)" }} />
            ) : (
              <TrendingDown className="h-4 w-4 text-destructive" />
            )}
            {tx.type === "income" ? "Receita" : "Despesa"}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 py-4">
          <div>
            <Label>Descrição</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Valor</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={categoryId || undefined} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
              <SelectContent>
                {validCats.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.icone} {c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Conta</Label>
            <Select value={accountId || undefined} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Sem conta" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.icone} {a.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo especial</Label>
            <Select value={tipoEspecial} onValueChange={(v) => setTipoEspecial(v as Tx["tipo_especial"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
                <SelectItem value="pagamento_fatura">Pagamento de fatura</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="essencial-edit" className="cursor-pointer">Despesa essencial</Label>
            <Switch id="essencial-edit" checked={isEssencial} onCheckedChange={setIsEssencial} />
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Notas internas (não persistido)"
              rows={2}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
            <Button variant="outline" onClick={handleDelete} className="text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Recurring section */}
          <div className="pt-4 mt-4 border-t space-y-3">
            <div className="flex items-center gap-2 font-medium">
              <Repeat className="h-4 w-4" /> Recorrente
            </div>
            {tx.recorrente_id ? (
              <div className="rounded-md border p-3 space-y-2">
                <div className="text-sm">
                  🔁 Esta transação é recorrente
                  {recurringInfo && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {recurringInfo.description} · {recurringInfo.frequencia}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Link to="/recorrentes" className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">Ver em Recorrentes</Button>
                  </Link>
                  <Button variant="ghost" size="sm" onClick={handleUnlink}>Desvincular</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <Label htmlFor="rec-toggle" className="cursor-pointer text-sm">Esta transação se repete?</Label>
                  <Switch id="rec-toggle" checked={enableRecurring} onCheckedChange={setEnableRecurring} />
                </div>
                {enableRecurring && (
                  <div className="space-y-3 rounded-md border p-3">
                    <div>
                      <Label className="text-xs">Frequência</Label>
                      <Select value={frequencia} onValueChange={(v) => setFrequencia(v as typeof frequencia)}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mensal">Mensal</SelectItem>
                          <SelectItem value="quinzenal">Quinzenal</SelectItem>
                          <SelectItem value="semanal">Semanal</SelectItem>
                          <SelectItem value="anual">Anual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {(frequencia === "mensal" || frequencia === "anual") && (
                      <div>
                        <Label className="text-xs">Dia do mês</Label>
                        <Input
                          type="number"
                          min={1}
                          max={31}
                          value={diaMes}
                          onChange={(e) => setDiaMes(Math.max(1, Math.min(31, Number(e.target.value) || 1)))}
                          className="h-9"
                        />
                      </div>
                    )}
                    <Button
                      onClick={handleCreateRecurring}
                      disabled={creatingRec}
                      className="w-full"
                      size="sm"
                    >
                      {creatingRec ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar recorrente"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
