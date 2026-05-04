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
import { AlertsBell } from "@/components/alerts-bell";

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
  account_id?: string | null;
  tipo_especial?: "normal" | "transferencia" | "pagamento_fatura";
}

interface AccountLite {
  id: string;
  nome: string;
  tipo: "corrente" | "poupanca" | "carteira" | "cartao" | "investimento";
  icone: string;
  ativo: boolean;
  dia_fechamento: number | null;
  dia_vencimento: number | null;
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
  account_id: z.string().uuid().nullable(),
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
  // Sugestão da função categorize_transaction
  suggested_category_id?: string | null;
  suggested_origem?: "manual" | "ia" | "keyword" | null;
  suggested_nivel?: number | null;
  suggested_confianca?: number | null;
  // Dedup status
  dup_status?: "novo" | "possivel" | "existe";
  dup_match?: { id: string; description: string; date: string; amount: number } | null;
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
  const [accountId, setAccountId] = useState<string>("");
  const [accounts, setAccounts] = useState<AccountLite[]>([]);
  const [parcelado, setParcelado] = useState(false);
  const [numParcelas, setNumParcelas] = useState(2);
  const [suggestion, setSuggestion] = useState<{
    category_id: string;
    nivel: number;
    origem: "manual" | "ia" | "keyword";
  } | null>(null);

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
  const [importAccountId, setImportAccountId] = useState<string>("");
  const [importing, setImporting] = useState(false);

  // duplicate detection
  const [dupOpen, setDupOpen] = useState(false);
  const [dupCandidates, setDupCandidates] = useState<Transaction[]>([]);
  const [pendingPayload, setPendingPayload] = useState<z.infer<typeof txSchema> | null>(null);

  // crisis mode + non-essential confirmation
  const [crisisActive, setCrisisActive] = useState(false);
  const [crisisConfirmOpen, setCrisisConfirmOpen] = useState(false);
  const [crisisPendingPayload, setCrisisPendingPayload] = useState<z.infer<typeof txSchema> | null>(null);

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

      const [{ data: txs, error: txErr }, { data: cats, error: catErr }, { data: crisis }, { data: accs }] = await Promise.all([
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
        supabase
          .from("crisis_events")
          .select("id")
          .eq("family_id", profile.family_id)
          .eq("ativo", true)
          .maybeSingle(),
        supabase
          .from("accounts")
          .select("id, nome, tipo, icone, ativo, dia_fechamento, dia_vencimento")
          .eq("family_id", profile.family_id)
          .eq("ativo", true)
          .order("created_at", { ascending: true }),
      ]);
      setAccounts((accs ?? []) as AccountLite[]);

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
      setCrisisActive(!!crisis);
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

    // Aprende a regra de categorização (se categoria foi escolhida manualmente)
    if (payload.category_id && payload.description) {
      void supabase.rpc("learn_categorization_rule", {
        _family_id: familyId,
        _termo: payload.description,
        _category_id: payload.category_id,
        _origem: "manual",
      });
    }

    setDescription("");
    setAmount("");
    setDate(today);
    setIsEssencial(false);
    setCategoryId("");
    setSuggestion(null);

    // Auto-recalc monthly financial state for this transaction's month
    await recalcMonth(payload.date);
    // Recalc balance da conta
    if (payload.account_id) {
      await supabase.rpc("recalc_account_balance", { _account_id: payload.account_id });
    }
    // Trigger alert checks (budget thresholds, negative balance, microspending)
    if (data?.id) {
      await supabase.rpc("check_transaction_alerts", { _transaction_id: data.id });
    }
  };

  const recalcMonth = async (txDate: string) => {
    if (!familyId || !txDate) return;
    const d = new Date(txDate + "T00:00:00");
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    await supabase.rpc("recalc_financial_state", {
      _family_id: familyId,
      _mes: firstDay,
    });
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
      account_id: accountId || null,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    // Branch: parcelamento em cartão (cria plan + N transactions via RPC)
    const selAcc = accounts.find((a) => a.id === accountId);
    if (
      parsed.data.type === "expense" &&
      parcelado &&
      selAcc?.tipo === "cartao" &&
      accountId
    ) {
      if (numParcelas < 2) {
        toast.error("Mínimo 2 parcelas");
        return;
      }
      setSubmitting(true);
      const { error: instErr } = await supabase.rpc("create_installment_plan", {
        _family_id: familyId,
        _account_id: accountId,
        _description: parsed.data.description,
        _valor_total: parsed.data.amount,
        _total_parcelas: numParcelas,
        _data_compra: parsed.data.date,
        _category_id: parsed.data.category_id ?? undefined,
        _is_essencial: parsed.data.is_essencial,
      });
      setSubmitting(false);
      if (instErr) {
        toast.error(instErr.message);
        return;
      }
      toast.success(`Compra parcelada em ${numParcelas}x criada`);
      setDescription("");
      setAmount("");
      setIsEssencial(false);
      setCategoryId("");
      setParcelado(false);
      setNumParcelas(2);
      // Refresh
      const { data: refreshed } = await supabase
        .from("transactions")
        .select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      setTransactions(
        ((refreshed ?? []) as Transaction[]).map((t) => ({ ...t, amount: Number(t.amount) }))
      );
      await recalcMonth(parsed.data.date);
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

    // Crisis mode: confirm non-essential expense before saving
    if (
      crisisActive &&
      parsed.data.type === "expense" &&
      !parsed.data.is_essencial
    ) {
      setCrisisPendingPayload(parsed.data);
      setCrisisConfirmOpen(true);
      return;
    }

    await insertTransaction(parsed.data);
  };

  const handleConfirmDuplicate = async () => {
    if (!pendingPayload) return;
    setDupOpen(false);
    const payload = pendingPayload;
    setPendingPayload(null);
    setDupCandidates([]);
    if (
      crisisActive &&
      payload.type === "expense" &&
      !payload.is_essencial
    ) {
      setCrisisPendingPayload(payload);
      setCrisisConfirmOpen(true);
      return;
    }
    await insertTransaction(payload);
  };

  const handleCancelDuplicate = () => {
    setDupOpen(false);
    setPendingPayload(null);
    setDupCandidates([]);
  };


  const handleDelete = async (id: string) => {
    const prev = transactions;
    const removed = prev.find((x) => x.id === id);
    setTransactions((t) => t.filter((x) => x.id !== id));
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) {
      setTransactions(prev);
      toast.error("Não foi possível excluir");
      return;
    }
    toast.success("Transação removida");
    if (removed) void recalcMonth(removed.date);
  };

  // When category changes, sync is_essencial automatically
  const handleCategoryChange = (id: string) => {
    setCategoryId(id);
    const cat = categories.find((c) => c.id === id);
    if (cat) {
      setIsEssencial(cat.is_essencial);
      // expense category selected → ensure expense tab; receita → income
      if (cat.tipo === "despesa" && type !== "expense") setType("expense");
      if (cat.tipo === "receita" && type !== "income") setType("income");
    }
  };

  const handleCreateCategory = async () => {
    if (!user || !familyId) return;
    const nome = newCatNome.trim();
    if (nome.length < 2) {
      toast.error("Nome muito curto");
      return;
    }
    setCreatingCat(true);
    const { data, error } = await supabase
      .from("categories")
      .insert({
        family_id: familyId,
        nome,
        tipo: newCatTipo,
        cor: newCatCor,
        icone: newCatIcone || "📦",
        is_essencial: newCatTipo === "despesa" ? newCatEssencial : false,
        is_default: false,
      })
      .select()
      .single();
    setCreatingCat(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const created = data as Category;
    setCategories((prev) => [...prev, created]);
    setCategoryId(created.id);
    if (created.tipo === "despesa") setIsEssencial(created.is_essencial);
    toast.success("Categoria criada");
    setNewCatOpen(false);
    setNewCatNome("");
    setNewCatIcone("📦");
    setNewCatCor("#9ca3af");
    setNewCatEssencial(false);
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
      // Aplica sugestão via categorize_transaction para cada linha válida
      if (familyId) {
        const enriched = await Promise.all(
          rows.map(async (r) => {
            if (r.error) return r;
            try {
              const { data } = await supabase.rpc("categorize_transaction", {
                _family_id: familyId,
                _description: r.description,
              });
              const sug = Array.isArray(data) && data.length > 0 ? data[0] : null;
              if (sug) {
                const cat = categories.find((c) => c.id === sug.category_id);
                return {
                  ...r,
                  category: cat?.nome ?? r.category,
                  suggested_category_id: sug.category_id,
                  suggested_origem: sug.origem,
                  suggested_nivel: sug.nivel,
                  suggested_confianca: Number(sug.confianca),
                };
              }
              return { ...r, suggested_category_id: null };
            } catch {
              return r;
            }
          })
        );
        setParsedRows(enriched);
      } else {
        setParsedRows(rows);
      }
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

    const payload = newRows.map((r) => {
      const cat = r.suggested_category_id
        ? categories.find((c) => c.id === r.suggested_category_id)
        : undefined;
      return {
        family_id: familyId,
        user_id: user.id,
        date: r.date,
        description: r.description,
        amount: Math.abs(r.amount),
        type: r.type,
        source: "importado" as const,
        scope: importScope,
        category: cat?.nome ?? r.category,
        category_id: r.suggested_category_id ?? null,
        is_essencial: cat?.is_essencial ?? false,
        external_id: r.external_id,
      };
    });

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

    // Recalc all months touched by the import
    const months = new Set(inserted.map((t) => t.date.slice(0, 7) + "-01"));
    for (const m of months) void recalcMonth(m);
    // Trigger alert checks for each imported transaction
    for (const t of inserted) {
      void supabase.rpc("check_transaction_alerts", { _transaction_id: t.id });
    }
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
          <div className="flex items-center gap-2">
            <AlertsBell />
            <Link to="/dashboard">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Painel
              </Button>
            </Link>
          </div>
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
              <Tabs
                value={type}
                onValueChange={(v) => {
                  const next = v as TxType;
                  setType(next);
                  // clear category if it doesn't match new type
                  const cat = categories.find((c) => c.id === categoryId);
                  if (cat && ((next === "expense" && cat.tipo !== "despesa") || (next === "income" && cat.tipo !== "receita"))) {
                    setCategoryId("");
                  }
                }}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="expense">Despesa</TabsTrigger>
                  <TabsTrigger value="income">Receita</TabsTrigger>
                </TabsList>
                <TabsContent value="expense" />
                <TabsContent value="income" />
              </Tabs>

              {/* Category selector */}
              <div className="space-y-2">
                <Label>Categoria</Label>
                <div className="flex gap-2">
                  <Select value={categoryId} onValueChange={handleCategoryChange}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories
                        .filter((c) => (type === "expense" ? c.tipo === "despesa" : c.tipo === "receita"))
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <span className="flex items-center gap-2">
                              <span
                                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-xs"
                                style={{
                                  background: `color-mix(in oklab, ${c.cor} 18%, transparent)`,
                                  color: c.cor,
                                }}
                              >
                                {c.icone}
                              </span>
                              <span>{c.nome}</span>
                              {c.is_essencial && (
                                <span className="text-[10px] text-muted-foreground">• essencial</span>
                              )}
                            </span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setNewCatTipo(type === "expense" ? "despesa" : "receita");
                      setNewCatOpen(true);
                    }}
                    title="Nova categoria"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>


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

                <div className="space-y-2 sm:col-span-2">
                  <Label>Conta</Label>
                  <Select value={accountId || "none"} onValueChange={(v) => {
                    setAccountId(v === "none" ? "" : v);
                    if (v === "none") setParcelado(false);
                  }}>
                    <SelectTrigger><SelectValue placeholder="Sem conta" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Sem conta —</SelectItem>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.icone} {a.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Parcelamento — só aparece se cartão e despesa */}
                {(() => {
                  const acc = accounts.find((a) => a.id === accountId);
                  if (acc?.tipo !== "cartao" || type !== "expense") return null;
                  const valorTotal = Number((amount || "0").replace(",", ".")) || 0;
                  const dt = new Date(date + "T00:00:00");
                  const firstFatura = (() => {
                    if (!acc.dia_fechamento) return dt;
                    const d = dt.getDate() <= acc.dia_fechamento
                      ? new Date(dt.getFullYear(), dt.getMonth(), 1)
                      : new Date(dt.getFullYear(), dt.getMonth() + 1, 1);
                    return d;
                  })();
                  return (
                    <div className="sm:col-span-2 rounded-lg border border-border/60 p-3 space-y-3 bg-card/40">
                      <div className="flex items-center justify-between">
                        <Label className="font-normal">Parcelado?</Label>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant={!parcelado ? "default" : "outline"}
                            onClick={() => setParcelado(false)}
                          >
                            NÃO
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={parcelado ? "default" : "outline"}
                            onClick={() => setParcelado(true)}
                          >
                            SIM
                          </Button>
                        </div>
                      </div>
                      {parcelado && (
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div className="space-y-1">
                            <Label className="text-xs">Parcelas</Label>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                className="h-8 w-8"
                                onClick={() => setNumParcelas((n) => Math.max(2, n - 1))}
                              >−</Button>
                              <Input
                                type="number"
                                min={2}
                                max={36}
                                value={numParcelas}
                                onChange={(e) => setNumParcelas(Math.max(2, Math.min(36, parseInt(e.target.value, 10) || 2)))}
                                className="h-8 text-center"
                              />
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                className="h-8 w-8"
                                onClick={() => setNumParcelas((n) => Math.min(36, n + 1))}
                              >+</Button>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Valor/parcela</Label>
                            <div className="h-8 px-3 flex items-center rounded-md border border-input bg-background tabular-nums text-sm">
                              {formatCurrency(valorTotal / numParcelas)}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">1ª fatura</Label>
                            <div className="h-8 px-3 flex items-center rounded-md border border-input bg-background text-sm">
                              {firstFatura.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

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
                  const cat =
                    (t.category_id && categories.find((c) => c.id === t.category_id)) ||
                    (t.category && categories.find((c) => c.nome === t.category)) ||
                    null;
                  return (
                    <li key={t.id} className="py-3 flex items-center gap-3">
                      <div
                        className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-base"
                        style={{
                          background: cat
                            ? `color-mix(in oklab, ${cat.cor} 14%, transparent)`
                            : t.type === "income"
                            ? "color-mix(in oklab, var(--success) 12%, transparent)"
                            : "color-mix(in oklab, var(--destructive) 12%, transparent)",
                          color: cat
                            ? cat.cor
                            : t.type === "income"
                            ? "var(--success)"
                            : "var(--destructive)",
                        }}
                      >
                        {cat ? (
                          <span>{cat.icone}</span>
                        ) : t.type === "income" ? (
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
                          {(cat?.nome || t.category) && (
                            <Badge
                              variant="outline"
                              className="gap-1 font-normal"
                              style={
                                cat
                                  ? {
                                      borderColor: `color-mix(in oklab, ${cat.cor} 40%, transparent)`,
                                      color: cat.cor,
                                    }
                                  : undefined
                              }
                            >
                              <Tag className="h-3 w-3" />
                              {cat?.nome ?? t.category}
                            </Badge>
                          )}
                          {(cat?.is_essencial || t.is_essencial) && (
                            <Badge
                              className="gap-1 font-normal"
                              style={{
                                background: "color-mix(in oklab, var(--primary) 14%, transparent)",
                                color: "var(--primary)",
                                borderColor: "transparent",
                              }}
                            >
                              <Sparkles className="h-3 w-3" />
                              Essencial
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
                        <>
                          <Badge variant="outline" className="font-normal gap-1">
                            <Tag className="h-3 w-3" />
                            {r.category}
                          </Badge>
                          {r.suggested_nivel === 1 && (
                            <Badge className="font-normal" style={{ background: "color-mix(in oklab, var(--success) 18%, transparent)", color: "var(--success)" }}>
                              ✅ Aprendido
                            </Badge>
                          )}
                          {(r.suggested_nivel === 2 || r.suggested_nivel === 3) && (
                            <Badge variant="secondary" className="font-normal">💡 Sugerido</Badge>
                          )}
                          {!r.suggested_category_id && (
                            <Badge variant="outline" className="font-normal text-muted-foreground">❓ Novo</Badge>
                          )}
                        </>
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

      {/* New category dialog */}
      <Dialog open={newCatOpen} onOpenChange={(o) => { if (!creatingCat) setNewCatOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova categoria</DialogTitle>
            <DialogDescription>
              Crie uma categoria personalizada para sua família.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cat-nome">Nome</Label>
              <Input
                id="cat-nome"
                value={newCatNome}
                onChange={(e) => setNewCatNome(e.target.value)}
                placeholder="Ex: Pet, Academia, Investimentos..."
                maxLength={40}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={newCatTipo} onValueChange={(v) => setNewCatTipo(v as CategoryTipo)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="despesa">Despesa</SelectItem>
                    <SelectItem value="receita">Receita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-icone">Ícone (emoji)</Label>
                <Input
                  id="cat-icone"
                  value={newCatIcone}
                  onChange={(e) => setNewCatIcone(e.target.value.slice(0, 4))}
                  placeholder="📦"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cat-cor">Cor</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="cat-cor"
                  type="color"
                  value={newCatCor}
                  onChange={(e) => setNewCatCor(e.target.value)}
                  className="h-10 w-16 p-1 cursor-pointer"
                />
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-base"
                  style={{
                    background: `color-mix(in oklab, ${newCatCor} 14%, transparent)`,
                    color: newCatCor,
                  }}
                >
                  {newCatIcone || "📦"}
                </span>
                <span className="text-sm text-muted-foreground">{newCatCor}</span>
              </div>
            </div>

            {newCatTipo === "despesa" && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="cat-essencial"
                  checked={newCatEssencial}
                  onCheckedChange={(c) => setNewCatEssencial(Boolean(c))}
                />
                <Label htmlFor="cat-essencial" className="cursor-pointer font-normal">
                  Marcar como essencial (Módulo Crise)
                </Label>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewCatOpen(false)} disabled={creatingCat}>
              Cancelar
            </Button>
            <Button onClick={handleCreateCategory} disabled={creatingCat || newCatNome.trim().length < 2}>
              {creatingCat ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar categoria"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Crisis-mode non-essential confirmation */}
      <Dialog open={crisisConfirmOpen} onOpenChange={setCrisisConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>⚠️ Gasto não-essencial em modo crise</DialogTitle>
            <DialogDescription>
              Você está em modo crise. Confirme se realmente deseja registrar
              este gasto não-essencial.
            </DialogDescription>
          </DialogHeader>
          {crisisPendingPayload && (
            <div className="text-sm space-y-1 py-2">
              <p><span className="text-muted-foreground">Descrição:</span> {crisisPendingPayload.description}</p>
              <p><span className="text-muted-foreground">Valor:</span> {formatCurrency(crisisPendingPayload.amount)}</p>
              <p><span className="text-muted-foreground">Data:</span> {formatDate(crisisPendingPayload.date)}</p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setCrisisConfirmOpen(false);
                setCrisisPendingPayload(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!crisisPendingPayload) return;
                const p = crisisPendingPayload;
                setCrisisConfirmOpen(false);
                setCrisisPendingPayload(null);
                await insertTransaction(p);
              }}
            >
              Salvar mesmo assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

