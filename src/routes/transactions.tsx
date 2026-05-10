import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { TransactionBase, TxType, TxSource, TxScope, TipoEspecial } from "@/types";
import { useAuth } from "@/hooks/use-auth";
import { useFamily } from "@/hooks/use-family";
import { importLog, clearImportLogs, getImportLogs } from "@/lib/import-logger";
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
import { ReconciliationPanel } from "@/components/reconciliation-panel";
import { MonthView } from "@/components/month-view";
import { SkeletonTransactions } from "@/components/skeletons";

export const Route = createFileRoute("/transactions")({
  head: () => ({
    meta: [
      { title: "Transações — Casinha Hub" },
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

// Tipo local — ver TransactionBase em @/types para o centralizado
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

import {
  SourceIcon, classifyCategory, detectFormat, detectTipoEspecial,
  parseBBExtrato, parseBBCSV, parseNubank, parseInter, parseCaixaExtrato, parseCsv,
} from '@/lib/import-parsers.tsx';
import type { ParsedRow, ImportFormat } from '@/lib/import-parsers.tsx';
import { fmtBRL } from '@/lib/format';
const formatCurrency = fmtBRL;

function TransactionsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { familyId, loading: familyLoading } = useFamily();
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
  const [showImportLogs, setShowImportLogs] = useState(false);
  const [importLogs, setImportLogs] = useState<{level: string; msg: string; ts: string}[]>([]);

  const [importAutoDetected, setImportAutoDetected] = useState<string | null>(null);

  // duplicate detection
  const [dupOpen, setDupOpen] = useState(false);
  const [dupCandidates, setDupCandidates] = useState<Transaction[]>([]);
  const [pendingPayload, setPendingPayload] = useState<z.infer<typeof txSchema> | null>(null);

  // crisis mode + non-essential confirmation
  const [crisisActive, setCrisisActive] = useState(false);
  const [crisisConfirmOpen, setCrisisConfirmOpen] = useState(false);
  const [crisisPendingPayload, setCrisisPendingPayload] = useState<z.infer<typeof txSchema> | null>(null);

  // Inline duplicate warning
  const [dupWarn, setDupWarn] = useState<{ id: string; date: string; description: string; amount: number; score: number } | null>(null);
  const [dupWarnIgnored, setDupWarnIgnored] = useState(false);

  const checkDuplicateInline = async () => {
    if (!familyId || dupWarnIgnored) return;
    const amt = Number(amount.replace(",", "."));
    if (!description.trim() || !date || !Number.isFinite(amt) || amt <= 0) return;
    const { data } = await supabase.rpc("check_duplicate_transaction", {
      p_family_id: familyId,
      p_date: date,
      p_amount: amt,
      p_description: description,
      p_account_id: accountId || undefined,
    });
    const top = Array.isArray(data) && data.length > 0 ? data[0] : null;
    if (top && Number(top.similarity_score) >= 70) {
      setDupWarn({
        id: top.id,
        date: top.date,
        description: top.description,
        amount: Number(top.amount),
        score: Number(top.similarity_score),
      });
    } else {
      setDupWarn(null);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user || !familyId) {
      // Se authLoading terminou mas não tem familyId, parar loading
      if (!authLoading && user) setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);

      // Carregar apenas últimos 3 meses para performance
      const dataLimite = new Date();
      dataLimite.setMonth(dataLimite.getMonth() - 3);
      const dataLimiteStr = dataLimite.toISOString().slice(0, 10);

      const [{ data: txs, error: txErr }, { data: cats, error: catErr }, { data: crisis }, { data: accs }] = await Promise.all([
        supabase
          .from("transactions")
          .select("id,date,description,amount,type,source,scope,category,category_id,account_id,external_id,is_essencial,tipo_especial,conciliado,created_at")
          .eq("family_id", familyId)
          .gte("date", dataLimiteStr)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("categories")
          .select("*")
          .eq("family_id", familyId)
          .order("tipo", { ascending: true })
          .order("is_essencial", { ascending: false })
          .order("nome", { ascending: true }),
        supabase
          .from("crisis_events")
          .select("id")
          .eq("family_id", familyId)
          .eq("ativo", true)
          .maybeSingle(),
        supabase
          .from("accounts")
          .select("id, nome, tipo, icone, ativo, dia_fechamento, dia_vencimento")
          .eq("family_id", familyId)
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
  }, [user, familyId]);

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
    clearImportLogs();
    importLog('info', `Arquivo selecionado: ${file.name} (${(file.size/1024).toFixed(1)}KB)`);
    setImportLogs([]);

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 2MB)");
      return;
    }

    // Garantir familyId disponível
    let fid = familyId;
    if (!fid && user) {
      importLog('info', 'Buscando familyId...');
      const { data: prof } = await supabase
        .from("profiles").select("family_id").eq("id", user.id).maybeSingle();
      fid = prof?.family_id ?? null;
      importLog(fid ? 'info' : 'error', `familyId: ${fid ?? 'não encontrado'}`);
    }

    // Garantir accounts carregadas
    let accsLocal = accounts;
    if (accsLocal.length === 0 && fid) {
      importLog('info', 'Carregando contas...');
      const { data: accsData } = await supabase
        .from("accounts")
        .select("id, nome, tipo, icone, ativo")
        .eq("family_id", fid)
        .eq("ativo", true)
        .order("created_at", { ascending: true });
      accsLocal = (accsData ?? []) as AccountLite[];
      setAccounts(accsLocal);
      importLog('info', `${accsLocal.length} contas carregadas: ${accsLocal.map(a => a.nome).join(', ')}`);
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 2MB)");
      return;
    }
    try {
      // BB exporta em Windows-1252. Tentar decodificar corretamente.
      const buffer = await file.arrayBuffer();
      let text = '';

      // Tentar windows-1252 (Latin-1 extended) — padrão BB
      const w1252 = new TextDecoder('windows-1252').decode(buffer);
      // Tentar UTF-8
      let utf8 = '';
      try { utf8 = new TextDecoder('utf-8', { fatal: true }).decode(buffer); } catch {}

      // Escolher o encoding com menos caracteres de substituição
      const w1252Erros = (w1252.match(/\uFFFD/g) ?? []).length;
      const utf8Erros = utf8 ? (utf8.match(/\uFFFD/g) ?? []).length : 999;
      text = utf8Erros < w1252Erros ? utf8 : w1252;

      importLog('info', `Encoding: ${utf8Erros < w1252Erros ? 'UTF-8' : 'Windows-1252'} (erros: ${Math.min(w1252Erros, utf8Erros)})`);
      importLog('info', `Arquivo lido: ${text.length} chars, ${text.split('\n').length} linhas`);
      importLog('info', `Primeiras 3 linhas:\n${text.split('\n').slice(0,3).join('\n')}`);

      const formato = detectFormat(text, file.name);
      importLog('info', `Formato detectado: ${formato.toUpperCase()}`);

      let rows: ParsedRow[];
      switch (formato) {
        case 'bb':     rows = parseBBExtrato(text); break;
        case 'bb_csv': rows = parseBBCSV(text); break;
        case 'nubank': rows = parseNubank(text); break;
        case 'inter':  rows = parseInter(text); break;
        case 'caixa':  rows = parseCaixaExtrato(text); break;
        default:       rows = parseCsv(text);
      }

      importLog('info', `Linhas parseadas: ${rows.length}`);
      const comErro = rows.filter(r => r.error);
      const validas = rows.filter(r => !r.error);
      if (comErro.length > 0) importLog('warn', `${comErro.length} linhas com erro`, comErro.map(r => r.error));
      importLog('info', `${validas.length} linhas válidas`, validas.slice(0,3));

      if (rows.length === 0) {
        importLog('error', 'Nenhuma linha encontrada após parse');
        toast.error(`Nenhuma linha encontrada (formato: ${formato.toUpperCase()})`);
        return;
      }
      toast.info(`📄 ${formato.toUpperCase()} detectado — ${rows.length} transações`);

      importLog(fid ? 'info' : 'warn', `familyId no parse: ${fid ?? 'ausente'}`);

      // Categorização automática
      if (fid) {
        importLog('info', `Categorizando ${validas.length} transações...`);
        const enriched = await Promise.all(
          rows.map(async (r) => {
            if (r.error) return r;
            try {
              const { data, error: catErr } = await supabase.rpc("categorize_transaction", {
                _family_id: fid,
                _description: r.description,
                _dummy: false,
              });
              if (catErr) importLog('warn', `Erro ao categorizar "${r.description}"`, catErr.message);
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
            } catch (e) {
              importLog('warn', `Exceção ao categorizar "${r.description}"`, e);
              return r;
            }
          })
        );
        const categorizadas = enriched.filter(r => r.suggested_category_id);
        importLog('info', `${categorizadas.length}/${validas.length} categorizadas`);

        // Detecção de duplicatas
        const withDup: ParsedRow[] = await Promise.all(
          enriched.map(async (r) => {
            if (r.error) return r;
            const { data: matches } = await supabase
              .from("transactions")
              .select("id, description, date, amount, external_id")
              .eq("family_id", fid)
              .eq("date", r.date)
              .gte("amount", Math.abs(r.amount) - 0.01)
              .lte("amount", Math.abs(r.amount) + 0.01)
              .limit(3);
            const list = matches ?? [];
            if (list.some((m: any) => m.external_id === r.external_id)) {
              return { ...r, dup_status: "existe", selected: false, dup_match: list[0] as any };
            }
            const word = r.description.split(/\s+/).find((w) => w.length >= 4)?.toLowerCase();
            const partial = word ? list.find((m: any) => (m.description ?? "").toLowerCase().includes(word)) : null;
            if (partial) return { ...r, dup_status: "possivel", dup_match: { ...(partial as any), amount: Number((partial as any).amount) } };
            return { ...r, dup_status: "novo" };
          })
        );
        const duplicatas = withDup.filter(r => r.dup_status === 'existe');
        importLog('info', `${duplicatas.length} duplicatas encontradas`);
        setParsedRows(withDup);
      } else {
        importLog('warn', 'familyId não disponível — sem categorização');
        setParsedRows(rows);
      }

      // Auto-sugestão de conta pelo nome do arquivo
      const fname = file.name.toLowerCase();
      const detectKeywords: { match: RegExp; hints: string[] }[] = [
        { match: /(^|[^a-z])bb([^a-z]|$)|banco do brasil|extrato_conta/, hints: ["bb", "brasil"] },
        { match: /nubank|nu_bank|nu-/, hints: ["nubank", "nu"] },
        { match: /inter/, hints: ["inter"] },
        { match: /ita[uú]/, hints: ["itau", "itaú"] },
        { match: /caixa/, hints: ["caixa"] },
        { match: /santander/, hints: ["santander"] },
      ];
      let detectedId = "";
      let detectedName: string | null = null;
      for (const rule of detectKeywords) {
        if (rule.match.test(fname)) {
          const acc = accsLocal.find((a) =>
            rule.hints.some((h) => a.nome.toLowerCase().includes(h))
          );
          if (acc) {
            detectedId = acc.id;
            detectedName = acc.nome;
          }
          break;
        }
      }
      // Se só tem uma conta, selecionar automaticamente
      if (!detectedId && accsLocal.length === 1) {
        detectedId = accsLocal[0].id;
        detectedName = accsLocal[0].nome;
      }
      importLog(detectedId ? 'info' : 'warn', detectedId ? `Conta detectada: ${detectedName}` : `Conta não detectada — ${accsLocal.length} disponíveis`);
      setImportAccountId(detectedId);
      setImportAutoDetected(detectedName);
      setImportLogs(getImportLogs());
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
    // Garantir familyId — pode não estar no state ainda
    let fid = familyId;
    if (!fid && user) {
      const { data: prof } = await supabase
        .from("profiles").select("family_id").eq("id", user.id).maybeSingle();
      fid = prof?.family_id ?? null;
    }
    if (!user || !fid) {
      importLog('error', `Abortado: user=${!!user} familyId=${fid}`);
      toast.error("Sessão inválida — recarregue a página");
      return;
    }
    if (!importAccountId) {
      toast.error("Selecione a conta bancária antes de importar");
      return;
    }
    const toImport = parsedRows.filter((r) => r.selected && !r.error);
    importLog('info', `Iniciando import: ${toImport.length} linhas selecionadas de ${parsedRows.length} total`);

    if (toImport.length === 0) {
      toast.error("Selecione ao menos uma linha");
      return;
    }

    setImporting(true);

    // Pre-check existing external_ids
    const externalIds = toImport.map((r) => r.external_id);
    const { data: existing, error: checkErr } = await supabase
      .from("transactions")
      .select("external_id")
      .eq("family_id", fid)
      .in("external_id", externalIds);

    if (checkErr) importLog('warn', 'Erro ao checar duplicatas', checkErr.message);

    const existingSet = new Set((existing ?? []).map((e) => e.external_id));
    const newRows = toImport.filter((r) => !existingSet.has(r.external_id));
    const duplicates = toImport.length - newRows.length;
    importLog('info', `${newRows.length} novas, ${duplicates} duplicatas`);

    if (newRows.length === 0) {
      setImporting(false);
      importLog('warn', `0 novas — todas ${duplicates} consideradas duplicatas. Verifique se external_ids batem.`);
      setImportLogs(getImportLogs());
      toast.info(`0 importados — ${duplicates} já existem no banco`);
      setImportOpen(false);
      setParsedRows([]);
      return;
    }

    importLog('info', `Payload: ${newRows.length} linhas. Primeira: ${JSON.stringify({
      date: newRows[0].date,
      desc: newRows[0].description?.slice(0,30),
      amount: newRows[0].amount,
      external_id: newRows[0].external_id,
      fid: fid?.slice(0,8)
    })}`);

    const payload = newRows.map((r) => {
      const cat = r.suggested_category_id
        ? categories.find((c) => c.id === r.suggested_category_id)
        : undefined;
      return {
        family_id: fid,
        user_id: user.id,
        date: r.date,
        description: r.description,
        amount: Math.abs(r.amount),
        type: r.type,
        source: "importado" as const,
        scope: importScope,
        account_id: importAccountId,
        category: cat?.nome ?? r.category,
        category_id: r.suggested_category_id ?? null,
        is_essencial: cat?.is_essencial ?? false,
        external_id: r.external_id,
        tipo_especial: r.tipo_especial ?? "normal",
      };
    });

    const { data, error } = await supabase
      .from("transactions")
      .insert(payload)
      .select();

    setImporting(false);

    if (error) {
      importLog('error', 'Erro no INSERT', { message: error.message, details: error.details, hint: error.hint, code: error.code });
      toast.error(`Erro na importação: ${error.message}`);
      // Mostrar logs no console para debug
      console.group('🔴 Import Logs');
      getImportLogs().forEach(l => console[l.level === 'error' ? 'error' : 'log'](`[${l.ts}] ${l.msg}`, l.data ?? ''));
      console.groupEnd();
      return;
    }

    importLog('success', `${(data ?? []).length} transações inseridas com sucesso`);
    setImportLogs(getImportLogs());

    const inserted = (data ?? []).map((t) => ({
      ...(t as Transaction),
      amount: Number(t.amount),
    }));

    setTransactions((prev) =>
      [...inserted, ...prev].sort((a, b) => (a.date < b.date ? 1 : -1))
    );

    const accName = accounts.find((a) => a.id === importAccountId)?.nome ?? "";
    const entradas = inserted.filter((t) => t.type === "income" && t.tipo_especial !== "transferencia").length;
    const saidas = inserted.filter((t) => t.type === "expense" && t.tipo_especial !== "transferencia").length;
    const transfers = inserted.filter((t) => t.tipo_especial === "transferencia").length;
    toast.success(
      `✅ ${inserted.length} importadas para: ${accName}`,
      {
        description: `💰 ${entradas} entradas · 💸 ${saidas} saídas · 🔄 ${transfers} transferências · ⚠️ ${duplicates} duplicatas ignoradas`,
      }
    );
    await supabase.rpc("recalc_account_balance", { _account_id: importAccountId });
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

  if (authLoading || familyLoading || loading) return <SkeletonTransactions />;
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
              <span className="font-semibold tracking-tight">Casinha Hub</span>
              <span className="text-[10px] text-muted-foreground hidden sm:block">O centro de controle da sua casa</span>
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
              accept=".csv,.txt,text/csv,text/plain"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button variant="outline" className="gap-2" onClick={handleFilePick}>
              <Upload className="h-4 w-4" />
              Importar Extrato
            </Button>
          </div>
        </div>

        {/* Totals — mostrados dentro do MonthView por mês */}

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
                    onChange={(e) => { setAmount(e.target.value.replace(/[^0-9.,]/g, "")); setDupWarnIgnored(false); }}
                    onBlur={checkDuplicateInline}
                    placeholder="0,00"
                    required
                  />
                  {dupWarn && (
                    <div
                      className="text-xs rounded-md p-2 flex items-start gap-2"
                      style={{ background: "color-mix(in oklab, hsl(45 90% 50%) 14%, transparent)", color: "hsl(38 80% 30%)" }}
                    >
                      <span className="leading-tight">
                        ⚠️ Transação similar encontrada:{" "}
                        <strong>{formatDate(dupWarn.date)}</strong> — {dupWarn.description} —{" "}
                        <strong>{formatCurrency(dupWarn.amount)}</strong>
                      </span>
                      <button
                        type="button"
                        className="ml-auto underline whitespace-nowrap"
                        onClick={() => { setDupWarn(null); setDupWarnIgnored(true); }}
                      >
                        Ignorar
                      </button>
                    </div>
                  )}
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

        {/* List + Reconciliation tabs */}
        <Tabs defaultValue="historico" className="w-full">
          <TabsList>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="conciliacao">Conciliação</TabsTrigger>
          </TabsList>
          <TabsContent value="historico" className="mt-4">
            {familyId && (
              <MonthView
                familyId={familyId}
                userId={user.id}
                categories={categories}
                accounts={accounts}
              />
            )}
          </TabsContent>
          <TabsContent value="conciliacao" className="mt-4">
            {familyId && (
              <ReconciliationPanel
                familyId={familyId}
                categories={categories}
                accounts={accounts}
                onChanged={() => {
                  void supabase
                    .from("transactions")
                    .select("*")
                    .order("date", { ascending: false })
                    .order("created_at", { ascending: false })
                    .then(({ data }) => {
                      if (data) setTransactions(data.map((t) => ({ ...t, amount: Number(t.amount) })) as Transaction[]);
                    });
                }}
              />
            )}
          </TabsContent>
        </Tabs>
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

          <div className="space-y-3 pb-3 border-b">
            <div className="space-y-1">
              <Label className="text-xs">Em qual conta estão essas transações? *</Label>
              <Select value={importAccountId || undefined} onValueChange={setImportAccountId}>
                <SelectTrigger><SelectValue placeholder="Selecione a conta bancária" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.icone} {a.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {importAutoDetected && (
                <p className="text-xs text-muted-foreground">
                  🔍 Detectado pelo nome do arquivo: <span className="font-medium">{importAutoDetected}</span> — confirme ou altere
                </p>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedCount === validRows.length && validRows.length > 0}
                  onCheckedChange={(c) => toggleAll(Boolean(c))}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedCount} de {validRows.length} selecionada(s)
                </span>
              </div>
              <div className="w-40">
                <Select value={importScope} onValueChange={(v) => setImportScope(v as TxScope)}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="family">Família</SelectItem>
                    <SelectItem value="personal">Pessoal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                          {!r.suggested_category_id && r.dup_status !== "existe" && r.dup_status !== "possivel" && r.tipo_especial !== "transferencia" && (
                            <Badge variant="outline" className="font-normal text-muted-foreground">❓ Sem categoria</Badge>
                          )}
                          {r.tipo_especial === "transferencia" && <Badge className="font-normal bg-blue-500/15 text-blue-700">↔️ Transferência</Badge>}
                          {r.tipo_especial === "pagamento_fatura" && <Badge className="font-normal bg-purple-500/15 text-purple-700">💳 Fatura</Badge>}
                          {r.dup_status === "novo" && r.tipo_especial === "normal" && <Badge className="font-normal bg-green-500/15 text-green-700">✅ Novo</Badge>}
                          {r.dup_status === "possivel" && <Badge className="font-normal bg-yellow-500/15 text-yellow-700">⚠️ Possível duplicata</Badge>}
                          {r.dup_status === "existe" && <Badge variant="secondary" className="font-normal">🔄 Já existe</Badge>}
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

          {/* Painel de logs */}
          {importLogs.length > 0 && (
            <div className="border-t pt-3">
              <button
                onClick={() => setShowImportLogs(v => !v)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                🔍 {showImportLogs ? "Ocultar" : "Ver"} logs de importação ({importLogs.length})
              </button>
              {showImportLogs && (
                <div className="mt-2 max-h-40 overflow-y-auto rounded bg-muted p-2 font-mono text-[10px] space-y-0.5">
                  {importLogs.map((l, i) => (
                    <div key={i} className={
                      l.level === 'error' ? 'text-red-500' :
                      l.level === 'warn' ? 'text-amber-600' :
                      l.level === 'success' ? 'text-emerald-600' :
                      'text-muted-foreground'
                    }>
                      {l.level === 'error' ? '❌' : l.level === 'warn' ? '⚠️' : l.level === 'success' ? '✅' : '📋'} {l.msg}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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

