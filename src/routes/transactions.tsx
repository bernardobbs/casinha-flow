import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Wallet,
  ArrowLeft,
  Loader2,
  TrendingUp,
  TrendingDown,
  Trash2,
  CreditCard,
  Receipt,
  
  Users,
  User as UserIcon,
  Upload,
  FileDown,
  Tag,
  Plus,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/transactions")({
  head: () => ({
    meta: [
      { title: "Transações — Casinha Flow" },
      { name: "description", content: "Adicione e acompanhe receitas e despesas da família." },
    ],
  }),
  component: TransactionsPage,
});

type TxType = "income" | "expense";
type TxSource = "manual" | "importado" | "cartao";
type TxScope = "family" | "personal";
type CategoryTipo = "despesa" | "receita";

interface Category {
  id: string;
  family_id: string;
  nome: string;
  tipo: CategoryTipo;
  cor: string;
  icone: string;
  is_essencial: boolean;
  parent_id: string | null;
}

interface Transaction {
  id: string;
  family_id: string;
  user_id: string;
  date: string;
  description: string;
  amount: number;
  type: TxType;
  source: TxSource;
  scope: TxScope;
  category?: string | null;
  category_id?: string | null;
  external_id?: string | null;
  is_essencial?: boolean;
}

const txSchema = z.object({
  description: z.string().trim().min(2, "Descrição muito curta").max(120),
  amount: z.number().positive("Valor deve ser maior que zero").max(99_999_999),
  date: z.string().min(1, "Data obrigatória"),
  type: z.enum(["income", "expense"]),
  source: z.enum(["manual", "cartao"]),
  scope: z.enum(["family", "personal"]),
  is_essencial: z.boolean(),
  category_id: z.string().uuid().nullable(),
});

const formatCurrency = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const sourceLabel: Record<TxSource, string> = {
  manual: "Manual",
  cartao: "Cartão",
  importado: "Importado",
};

const SourceIcon = ({ source }: { source: TxSource }) => {
  if (source === "cartao") return <CreditCard className="h-3.5 w-3.5" />;
  if (source === "importado") return <FileDown className="h-3.5 w-3.5" />;
  return <Receipt className="h-3.5 w-3.5" />;
};

// ---- CSV import helpers ----

const CATEGORY_RULES: { keywords: string[]; category: string }[] = [
  { keywords: ["mercado", "padaria"], category: "Alimentação" },
  { keywords: ["posto", "uber"], category: "Transporte" },
  { keywords: ["farmacia", "farmácia", "drogaria"], category: "Saúde" },
  { keywords: ["aluguel", "energia", "internet"], category: "Moradia" },
  { keywords: ["parcela", "financiamento", "emprestimo", "empréstimo"], category: "Dívidas" },
  { keywords: ["netflix", "spotify", "amazon"], category: "Assinaturas" },
];

function classifyCategory(description: string): string {
  const d = description.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((k) => d.includes(k))) return rule.category;
  }
  return "Outros";
}

function parseDate(raw: string): string | null {
  const s = raw.trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

function parseAmount(raw: string): number | null {
  let s = raw.trim().replace(/[R$\s]/gi, "");
  if (!s) return null;
  // If has comma, treat as decimal separator (BR format)
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function splitCsvLine(line: string): string[] {
  // simple CSV with optional quoted fields
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === "," || c === ";") {
        out.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

interface ParsedRow {
  date: string;
  description: string;
  amount: number; // signed
  type: TxType;
  category: string;
  external_id: string;
  selected: boolean;
  error?: string;
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  // Detect header (skip if first row contains 'data' keyword)
  const startIdx =
    /data/i.test(lines[0]) && /(descri|valor)/i.test(lines[0]) ? 1 : 0;

  const rows: ParsedRow[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length < 3) continue;
    const date = parseDate(cols[0]);
    const description = cols[1];
    const amount = parseAmount(cols[2]);

    if (!date || !description || amount === null) {
      rows.push({
        date: cols[0] ?? "",
        description: description ?? "",
        amount: 0,
        type: "expense",
        category: "Outros",
        external_id: "",
        selected: false,
        error: "Linha inválida",
      });
      continue;
    }

    const type: TxType = amount < 0 ? "expense" : "income";
    rows.push({
      date,
      description,
      amount,
      type,
      category: classifyCategory(description),
      external_id: `${date}|${description.toLowerCase().trim()}|${amount.toFixed(2)}`,
      selected: true,
    });
  }
  return rows;
}

function TransactionsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // form state
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<TxType>("expense");
  const [source, setSource] = useState<Exclude<TxSource, "importado">>("manual");
  const [scope, setScope] = useState<TxScope>("family");
  const [isEssencial, setIsEssencial] = useState(false);
  const [categoryId, setCategoryId] = useState<string>("");

  // new-category dialog
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatNome, setNewCatNome] = useState("");
  const [newCatTipo, setNewCatTipo] = useState<CategoryTipo>("despesa");
  const [newCatIcone, setNewCatIcone] = useState("📦");
  const [newCatCor, setNewCatCor] = useState("#9ca3af");
  const [newCatEssencial, setNewCatEssencial] = useState(false);
  const [creatingCat, setCreatingCat] = useState(false);

  // import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importScope, setImportScope] = useState<TxScope>("family");
  const [importing, setImporting] = useState(false);

  // duplicate detection
  const [dupOpen, setDupOpen] = useState(false);
  const [dupCandidates, setDupCandidates] = useState<Transaction[]>([]);
  const [pendingPayload, setPendingPayload] = useState<z.infer<typeof txSchema> | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);

      const { data: profile } = await supabase
        .from("profiles")
        .select("family_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.family_id) {
        setLoading(false);
        return;
      }
      setFamilyId(profile.family_id);

      const [{ data: txs, error: txErr }, { data: cats, error: catErr }] = await Promise.all([
        supabase
          .from("transactions")
          .select("*")
          .order("date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("categories")
          .select("*")
          .order("tipo", { ascending: true })
          .order("is_essencial", { ascending: false })
          .order("nome", { ascending: true }),
      ]);

      if (txErr) {
        toast.error("Erro ao carregar transações");
      } else {
        setTransactions(
          (txs ?? []).map((t) => ({ ...t, amount: Number(t.amount) })) as Transaction[]
        );
      }
      if (catErr) {
        toast.error("Erro ao carregar categorias");
      } else {
        setCategories((cats ?? []) as Category[]);
      }
      setLoading(false);
    };

    load();
  }, [user]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of transactions) {
      if (t.type === "income") income += t.amount;
      else expense += t.amount;
    }
    return { income, expense, balance: income - expense };
  }, [transactions]);

  const insertTransaction = async (payload: z.infer<typeof txSchema>) => {
    if (!user || !familyId) return;
    const cat = payload.category_id
      ? categories.find((c) => c.id === payload.category_id)
      : null;
    setSubmitting(true);
    const { data, error } = await supabase
      .from("transactions")
      .insert({
        family_id: familyId,
        user_id: user.id,
        ...payload,
        category: cat?.nome ?? null,
      })
      .select()
      .single();
    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setTransactions((prev) => [
      { ...(data as Transaction), amount: Number(data!.amount) },
      ...prev,
    ]);
    toast.success("Transação adicionada");
    setDescription("");
    setAmount("");
    setDate(today);
    setIsEssencial(false);
    setCategoryId("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !familyId) return;

    const parsed = txSchema.safeParse({
      description,
      amount: Number(amount.replace(",", ".")),
      date,
      type,
      source,
      scope,
      is_essencial: isEssencial,
      category_id: categoryId || null,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    // Duplicate detection: same family + same date + same amount + similar description
    const { data: candidates } = await supabase
      .from("transactions")
      .select("*")
      .eq("family_id", familyId)
      .eq("date", parsed.data.date)
      .eq("amount", parsed.data.amount)
      .ilike("description", `%${parsed.data.description}%`)
      .limit(5);

    if (candidates && candidates.length > 0) {
      setDupCandidates(
        candidates.map((c) => ({ ...(c as Transaction), amount: Number(c.amount) }))
      );
      setPendingPayload(parsed.data);
      setDupOpen(true);
      return;
    }

    await insertTransaction(parsed.data);
  };

  const handleConfirmDuplicate = async () => {
    if (!pendingPayload) return;
    setDupOpen(false);
    await insertTransaction(pendingPayload);
    setPendingPayload(null);
    setDupCandidates([]);
  };

  const handleCancelDuplicate = () => {
    setDupOpen(false);
    setPendingPayload(null);
    setDupCandidates([]);
  };


  const handleDelete = async (id: string) => {
    const prev = transactions;
    setTransactions((t) => t.filter((x) => x.id !== id));
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) {
      setTransactions(prev);
      toast.error("Não foi possível excluir");
      return;
    }
    toast.success("Transação removida");
  };

  // ---- Import handlers ----

  const handleFilePick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 2MB)");
      return;
    }
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        toast.error("Nenhuma linha encontrada no CSV");
        return;
      }
      setParsedRows(rows);
      setImportOpen(true);
    } catch {
      toast.error("Não foi possível ler o arquivo");
    }
  };

  const toggleRow = (idx: number) => {
    setParsedRows((rows) =>
      rows.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r))
    );
  };

  const toggleAll = (checked: boolean) => {
    setParsedRows((rows) =>
      rows.map((r) => (r.error ? r : { ...r, selected: checked }))
    );
  };

  const validRows = parsedRows.filter((r) => !r.error);
  const selectedCount = parsedRows.filter((r) => r.selected && !r.error).length;

  const handleConfirmImport = async () => {
    if (!user || !familyId) return;
    const toImport = parsedRows.filter((r) => r.selected && !r.error);
    if (toImport.length === 0) {
      toast.error("Selecione ao menos uma linha");
      return;
    }

    setImporting(true);

    // Pre-check existing external_ids in this family
    const externalIds = toImport.map((r) => r.external_id);
    const { data: existing } = await supabase
      .from("transactions")
      .select("external_id")
      .eq("family_id", familyId)
      .in("external_id", externalIds);

    const existingSet = new Set((existing ?? []).map((e) => e.external_id));
    const newRows = toImport.filter((r) => !existingSet.has(r.external_id));
    const duplicates = toImport.length - newRows.length;

    if (newRows.length === 0) {
      setImporting(false);
      toast.info(`0 importados, ${duplicates} ignorados (duplicados)`);
      setImportOpen(false);
      setParsedRows([]);
      return;
    }

    const payload = newRows.map((r) => ({
      family_id: familyId,
      user_id: user.id,
      date: r.date,
      description: r.description,
      amount: Math.abs(r.amount),
      type: r.type,
      source: "importado" as const,
      scope: importScope,
      category: r.category,
      external_id: r.external_id,
    }));

    const { data, error } = await supabase
      .from("transactions")
      .insert(payload)
      .select();

    setImporting(false);

    if (error) {
      toast.error(`Erro na importação: ${error.message}`);
      return;
    }

    const inserted = (data ?? []).map((t) => ({
      ...(t as Transaction),
      amount: Number(t.amount),
    }));

    setTransactions((prev) =>
      [...inserted, ...prev].sort((a, b) => (a.date < b.date ? 1 : -1))
    );

    toast.success(
      `${inserted.length} importados, ${duplicates} ignorados (duplicados)`
    );
    setImportOpen(false);
    setParsedRows([]);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <header className="border-b border-border/60 bg-card/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-semibold tracking-tight">Casinha Flow</span>
              <span className="text-[10px] text-muted-foreground hidden sm:block">controle e liberdade andando juntos</span>
            </div>
          </Link>
          <Link to="/dashboard">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Painel
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Transações</h1>
            <p className="text-muted-foreground mt-1">Receitas, despesas e tudo que entra e sai.</p>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button variant="outline" className="gap-2" onClick={handleFilePick}>
              <Upload className="h-4 w-4" />
              Importar Extrato
            </Button>
          </div>
        </div>

        {/* Totals */}
        <div className="grid sm:grid-cols-3 gap-4">
          <Card className="border-border/60 shadow-[var(--shadow-soft)]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Receitas</CardTitle>
              <TrendingUp className="h-4 w-4" style={{ color: "var(--success)" }} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-tight" style={{ color: "var(--success)" }}>
                {formatCurrency(totals.income)}
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-[var(--shadow-soft)]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Despesas</CardTitle>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-tight text-destructive">
                {formatCurrency(totals.expense)}
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-[var(--shadow-soft)]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Saldo</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div
                className="text-2xl font-semibold tracking-tight"
                style={{ color: totals.balance >= 0 ? "var(--success)" : "var(--destructive)" }}
              >
                {formatCurrency(totals.balance)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Add form */}
        <Card className="border-border/60 shadow-[var(--shadow-soft)]">
          <CardHeader>
            <CardTitle>Nova transação</CardTitle>
            <CardDescription>Registre uma entrada ou saída.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Tabs value={type} onValueChange={(v) => setType(v as TxType)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="expense">Despesa</TabsTrigger>
                  <TabsTrigger value="income">Receita</TabsTrigger>
                </TabsList>
                <TabsContent value="expense" />
                <TabsContent value="income" />
              </Tabs>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="desc">Descrição</Label>
                  <Input
                    id="desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Mercado, salário, conta de luz..."
                    maxLength={120}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Valor (R$)</Label>
                  <Input
                    id="amount"
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
                    placeholder="0,00"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Data</Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Forma</Label>
                  <Select value={source} onValueChange={(v) => setSource(v as Exclude<TxSource, "importado">)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="cartao">Cartão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Escopo</Label>
                  <Select value={scope} onValueChange={(v) => setScope(v as TxScope)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="family">Família (compartilhado)</SelectItem>
                      <SelectItem value="personal">Pessoal (só você)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2 sm:col-span-2 pt-1">
                  <Checkbox
                    id="essencial"
                    checked={isEssencial}
                    onCheckedChange={(c) => setIsEssencial(Boolean(c))}
                  />
                  <Label htmlFor="essencial" className="cursor-pointer font-normal">
                    Despesa essencial
                  </Label>
                </div>
              </div>

              <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar transação"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* List */}
        <Card className="border-border/60 shadow-[var(--shadow-soft)]">
          <CardHeader>
            <CardTitle>Histórico</CardTitle>
            <CardDescription>
              {transactions.length === 0
                ? "Nenhuma transação ainda."
                : `${transactions.length} transação(ões) registrada(s).`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Adicione sua primeira movimentação acima.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {transactions.map((t) => {
                  const mine = t.user_id === user.id;
                  return (
                    <li key={t.id} className="py-3 flex items-center gap-3">
                      <div
                        className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          background:
                            t.type === "income"
                              ? "color-mix(in oklab, var(--success) 12%, transparent)"
                              : "color-mix(in oklab, var(--destructive) 12%, transparent)",
                          color: t.type === "income" ? "var(--success)" : "var(--destructive)",
                        }}
                      >
                        {t.type === "income" ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{t.description}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">{formatDate(t.date)}</span>
                          <Badge variant="secondary" className="gap-1 font-normal">
                            <SourceIcon source={t.source} />
                            {sourceLabel[t.source]}
                          </Badge>
                          <Badge variant="outline" className="gap-1 font-normal">
                            {t.scope === "family" ? <Users className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
                            {t.scope === "family" ? "Família" : "Pessoal"}
                          </Badge>
                          {t.category && (
                            <Badge variant="outline" className="gap-1 font-normal">
                              <Tag className="h-3 w-3" />
                              {t.category}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div
                          className="font-semibold"
                          style={{
                            color: t.type === "income" ? "var(--success)" : "var(--destructive)",
                          }}
                        >
                          {t.type === "income" ? "+" : "−"} {formatCurrency(t.amount)}
                        </div>
                        {mine && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(t.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Import preview dialog */}
      <Dialog open={importOpen} onOpenChange={(o) => { if (!importing) setImportOpen(o); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Pré-visualizar importação</DialogTitle>
            <DialogDescription>
              {parsedRows.length} linha(s) lida(s). Selecione as que deseja importar.
              Categorias foram sugeridas automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-4 pb-2 border-b">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedCount === validRows.length && validRows.length > 0}
                onCheckedChange={(c) => toggleAll(Boolean(c))}
              />
              <span className="text-sm text-muted-foreground">
                {selectedCount} de {validRows.length} selecionada(s)
              </span>
            </div>
            <div className="w-48">
              <Select value={importScope} onValueChange={(v) => setImportScope(v as TxScope)}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="family">Escopo: Família</SelectItem>
                  <SelectItem value="personal">Escopo: Pessoal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="max-h-[400px] overflow-auto -mx-6 px-6">
            <ul className="divide-y divide-border text-sm">
              {parsedRows.map((r, idx) => (
                <li key={idx} className="py-2 flex items-center gap-3">
                  <Checkbox
                    checked={r.selected}
                    disabled={!!r.error}
                    onCheckedChange={() => toggleRow(idx)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{r.description || "—"}</span>
                      {!r.error && (
                        <Badge variant="outline" className="font-normal gap-1">
                          <Tag className="h-3 w-3" />
                          {r.category}
                        </Badge>
                      )}
                      {r.error && (
                        <Badge variant="destructive" className="font-normal">{r.error}</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {r.date || "data inválida"}
                    </span>
                  </div>
                  <div
                    className="font-semibold shrink-0"
                    style={{
                      color: r.error
                        ? "var(--muted-foreground)"
                        : r.type === "income"
                        ? "var(--success)"
                        : "var(--destructive)",
                    }}
                  >
                    {r.error
                      ? "—"
                      : `${r.type === "income" ? "+" : "−"} ${formatCurrency(Math.abs(r.amount))}`}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setImportOpen(false)} disabled={importing}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmImport} disabled={importing || selectedCount === 0}>
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                `Importar ${selectedCount} transação(ões)`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate detection dialog */}
      <Dialog open={dupOpen} onOpenChange={(o) => { if (!o) handleCancelDuplicate(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Possível duplicidade detectada</DialogTitle>
            <DialogDescription>
              Encontramos {dupCandidates.length} transação(ões) parecida(s) já registrada(s) na sua família.
              Deseja salvar mesmo assim?
            </DialogDescription>
          </DialogHeader>

          <ul className="divide-y divide-border text-sm max-h-64 overflow-auto">
            {dupCandidates.map((c) => (
              <li key={c.id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">{formatDate(c.date)}</span>
                    <Badge variant="secondary" className="gap-1 font-normal">
                      <SourceIcon source={c.source} />
                      {sourceLabel[c.source]}
                    </Badge>
                  </div>
                </div>
                <div
                  className="font-semibold shrink-0"
                  style={{
                    color: c.type === "income" ? "var(--success)" : "var(--destructive)",
                  }}
                >
                  {c.type === "income" ? "+" : "−"} {formatCurrency(c.amount)}
                </div>
              </li>
            ))}
          </ul>

          <DialogFooter>
            <Button variant="ghost" onClick={handleCancelDuplicate} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmDuplicate} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar mesmo assim"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

