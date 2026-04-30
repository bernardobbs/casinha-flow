import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  QrCode,
  Users,
  User as UserIcon,
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
type TxSource = "pix" | "cartao" | "boleto";
type TxScope = "family" | "personal";

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
}

const txSchema = z.object({
  description: z.string().trim().min(2, "Descrição muito curta").max(120),
  amount: z.number().positive("Valor deve ser maior que zero").max(99_999_999),
  date: z.string().min(1, "Data obrigatória"),
  type: z.enum(["income", "expense"]),
  source: z.enum(["pix", "cartao", "boleto"]),
  scope: z.enum(["family", "personal"]),
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
  pix: "Pix",
  cartao: "Cartão",
  boleto: "Boleto",
};

const SourceIcon = ({ source }: { source: TxSource }) => {
  if (source === "pix") return <QrCode className="h-3.5 w-3.5" />;
  if (source === "cartao") return <CreditCard className="h-3.5 w-3.5" />;
  return <Receipt className="h-3.5 w-3.5" />;
};

function TransactionsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // form state
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<TxType>("expense");
  const [source, setSource] = useState<TxSource>("pix");
  const [scope, setScope] = useState<TxScope>("family");

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

      const { data: txs, error } = await supabase
        .from("transactions")
        .select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Erro ao carregar transações");
      } else {
        setTransactions(
          (txs ?? []).map((t) => ({ ...t, amount: Number(t.amount) })) as Transaction[]
        );
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
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase
      .from("transactions")
      .insert({
        family_id: familyId,
        user_id: user.id,
        ...parsed.data,
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
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Transações</h1>
          <p className="text-muted-foreground mt-1">Receitas, despesas e tudo que entra e sai.</p>
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
                  <Select value={source} onValueChange={(v) => setSource(v as TxSource)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pix">Pix</SelectItem>
                      <SelectItem value="cartao">Cartão</SelectItem>
                      <SelectItem value="boleto">Boleto</SelectItem>
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
    </div>
  );
}
