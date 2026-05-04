import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCardBillsTab } from "@/components/CreditCardBillsTab";
import { toast } from "sonner";
import { ArrowLeft, ArrowRightLeft, CreditCard, Loader2, Plus, Wallet } from "lucide-react";

export const Route = createFileRoute("/contas")({
  head: () => ({
    meta: [
      { title: "Contas — Casinha Flow" },
      { name: "description", content: "Contas bancárias, carteiras e cartões da família." },
    ],
  }),
  component: ContasPage,
});

type AccountType = "corrente" | "poupanca" | "carteira" | "cartao" | "investimento";

interface Account {
  id: string;
  family_id: string;
  nome: string;
  tipo: AccountType;
  saldo_inicial: number;
  saldo_atual: number;
  cor: string;
  icone: string;
  ativo: boolean;
  limite_credito: number | null;
  dia_fechamento: number | null;
  dia_vencimento: number | null;
}

const fmt = (n: number) =>
  Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const TYPE_LABEL: Record<AccountType, string> = {
  corrente: "Conta corrente",
  poupanca: "Poupança",
  carteira: "Carteira",
  cartao: "Cartão de crédito",
  investimento: "Investimento",
};

const TYPE_ICON: Record<AccountType, string> = {
  corrente: "🏦",
  poupanca: "🐷",
  carteira: "💵",
  cartao: "💳",
  investimento: "📈",
};

function ContasPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [openTransfer, setOpenTransfer] = useState(false);
  const [creating, setCreating] = useState(false);
  const [transferring, setTransferring] = useState(false);

  // Create form
  const [form, setForm] = useState({
    nome: "",
    tipo: "corrente" as AccountType,
    saldo_inicial: "",
    cor: "#3b82f6",
    limite_credito: "",
    dia_fechamento: "",
    dia_vencimento: "",
  });

  // Transfer form
  const [transfer, setTransfer] = useState({
    from_id: "",
    to_id: "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    description: "Transferência entre contas",
  });

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("family_id")
        .eq("id", user.id)
        .maybeSingle();
      setFamilyId(profile?.family_id ?? null);
    })();
  }, [user]);

  const loadAccounts = async () => {
    if (!familyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("accounts")
      .select("*")
      .eq("family_id", familyId)
      .order("created_at", { ascending: true });
    const accs = (data ?? []) as unknown as Account[];

    // Recalc todos os saldos
    for (const a of accs) {
      await supabase.rpc("recalc_account_balance", { _account_id: a.id });
    }
    const { data: refreshed } = await supabase
      .from("accounts")
      .select("*")
      .eq("family_id", familyId)
      .order("created_at", { ascending: true });
    setAccounts((refreshed ?? []) as unknown as Account[]);
    setLoading(false);
  };

  useEffect(() => {
    if (familyId) loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId]);

  const parseNum = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));

  const handleCreate = async () => {
    if (!familyId) return;
    if (!form.nome.trim()) {
      toast.error("Nome obrigatório");
      return;
    }
    setCreating(true);
    const saldo = Number.isFinite(parseNum(form.saldo_inicial)) ? parseNum(form.saldo_inicial) : 0;
    const isCard = form.tipo === "cartao";
    const { error } = await supabase.from("accounts").insert({
      family_id: familyId,
      nome: form.nome.trim(),
      tipo: form.tipo,
      saldo_inicial: saldo,
      saldo_atual: saldo,
      cor: form.cor,
      icone: TYPE_ICON[form.tipo],
      limite_credito: isCard ? parseNum(form.limite_credito) || 0 : null,
      dia_fechamento: isCard ? parseInt(form.dia_fechamento, 10) || null : null,
      dia_vencimento: isCard ? parseInt(form.dia_vencimento, 10) || null : null,
    });
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setOpenCreate(false);
    setForm({
      nome: "",
      tipo: "corrente",
      saldo_inicial: "",
      cor: "#3b82f6",
      limite_credito: "",
      dia_fechamento: "",
      dia_vencimento: "",
    });
    toast.success("Conta criada");
    await loadAccounts();
  };

  const handleTransfer = async () => {
    if (!familyId || !user) return;
    const amt = parseNum(transfer.amount);
    if (!transfer.from_id || !transfer.to_id || transfer.from_id === transfer.to_id) {
      toast.error("Selecione contas diferentes");
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Valor inválido");
      return;
    }
    setTransferring(true);
    // 2 transações: saída + entrada, ambas com tipo_especial = 'transferencia'
    const { error } = await supabase.from("transactions").insert([
      {
        family_id: familyId,
        user_id: user.id,
        account_id: transfer.from_id,
        amount: amt,
        type: "expense",
        date: transfer.date,
        description: transfer.description,
        tipo_especial: "transferencia",
        source: "manual",
      },
      {
        family_id: familyId,
        user_id: user.id,
        account_id: transfer.to_id,
        amount: amt,
        type: "income",
        date: transfer.date,
        description: transfer.description,
        tipo_especial: "transferencia",
        source: "manual",
      },
    ]);
    setTransferring(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setOpenTransfer(false);
    setTransfer({
      from_id: "",
      to_id: "",
      amount: "",
      date: new Date().toISOString().slice(0, 10),
      description: "Transferência entre contas",
    });
    toast.success("Transferência registrada");
    await loadAccounts();
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return null;

  const totalConsolidado = accounts
    .filter((a) => a.tipo !== "cartao" && a.ativo)
    .reduce((s, a) => s + Number(a.saldo_atual), 0);

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <header className="border-b border-border/60 bg-card/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition">
            <div
              className="h-9 w-9 rounded-lg flex items-center justify-center"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">Casinha Flow</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-muted-foreground">Saldo total</p>
              <p className="font-semibold tabular-nums">{fmt(totalConsolidado)}</p>
            </div>
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
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Contas</h1>
            <p className="text-muted-foreground mt-1">
              Saldo total consolidado:{" "}
              <span className="font-semibold tabular-nums" style={{ color: "var(--success)" }}>
                {fmt(totalConsolidado)}
              </span>{" "}
              <span className="text-xs">(exclui cartões)</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={openTransfer} onOpenChange={setOpenTransfer}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <ArrowRightLeft className="h-4 w-4" />
                  Transferir
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Transferência entre contas</DialogTitle>
                  <DialogDescription>
                    Não entra no painel 50/30/20.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Conta de origem</Label>
                    <Select
                      value={transfer.from_id}
                      onValueChange={(v) => setTransfer({ ...transfer, from_id: v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {accounts.filter((a) => a.ativo).map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.icone} {a.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Conta de destino</Label>
                    <Select
                      value={transfer.to_id}
                      onValueChange={(v) => setTransfer({ ...transfer, to_id: v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {accounts.filter((a) => a.ativo && a.id !== transfer.from_id).map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.icone} {a.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Valor (R$)</Label>
                      <Input
                        inputMode="decimal"
                        value={transfer.amount}
                        onChange={(e) =>
                          setTransfer({ ...transfer, amount: e.target.value.replace(/[^0-9.,]/g, "") })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Data</Label>
                      <Input
                        type="date"
                        value={transfer.date}
                        onChange={(e) => setTransfer({ ...transfer, date: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Input
                      value={transfer.description}
                      onChange={(e) => setTransfer({ ...transfer, description: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleTransfer} disabled={transferring}>
                    {transferring ? <Loader2 className="h-4 w-4 animate-spin" /> : "Transferir"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={openCreate} onOpenChange={setOpenCreate}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nova conta
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova conta</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      value={form.nome}
                      onChange={(e) => setForm({ ...form, nome: e.target.value })}
                      placeholder="Ex: Banco do Brasil"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select
                      value={form.tipo}
                      onValueChange={(v) => setForm({ ...form, tipo: v as AccountType })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(TYPE_LABEL) as AccountType[]).map((t) => (
                          <SelectItem key={t} value={t}>
                            {TYPE_ICON[t]} {TYPE_LABEL[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Saldo inicial (R$)</Label>
                    <Input
                      inputMode="decimal"
                      value={form.saldo_inicial}
                      onChange={(e) =>
                        setForm({ ...form, saldo_inicial: e.target.value.replace(/[^0-9.,]/g, "") })
                      }
                      placeholder="0,00"
                    />
                  </div>
                  {form.tipo === "cartao" && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-2">
                        <Label>Limite</Label>
                        <Input
                          inputMode="decimal"
                          value={form.limite_credito}
                          onChange={(e) =>
                            setForm({ ...form, limite_credito: e.target.value.replace(/[^0-9.,]/g, "") })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Fecha dia</Label>
                        <Input
                          type="number"
                          min={1}
                          max={31}
                          value={form.dia_fechamento}
                          onChange={(e) => setForm({ ...form, dia_fechamento: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Vence dia</Label>
                        <Input
                          type="number"
                          min={1}
                          max={31}
                          value={form.dia_vencimento}
                          onChange={(e) => setForm({ ...form, dia_vencimento: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button onClick={handleCreate} disabled={creating}>
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs defaultValue="contas" className="w-full">
          <TabsList>
            <TabsTrigger value="contas">Contas</TabsTrigger>
            <TabsTrigger value="faturas">Faturas</TabsTrigger>
          </TabsList>
          <TabsContent value="contas" className="mt-6">
            {accounts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Nenhuma conta ainda. Crie sua primeira conta acima.
                </CardContent>
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.map((a) => {
                  const isCard = a.tipo === "cartao";
                  const used = isCard && a.saldo_atual < 0 ? Math.abs(Number(a.saldo_atual)) : 0;
                  const limit = Number(a.limite_credito ?? 0);
                  const usedPct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
                  return (
                    <Card
                      key={a.id}
                      className="border-border/60 shadow-[var(--shadow-soft)]"
                      style={{ borderLeft: `4px solid ${a.cor}` }}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <span className="text-xl">{a.icone}</span>
                            {a.nome}
                          </CardTitle>
                          <Badge variant="outline" className="font-normal text-[10px]">
                            {TYPE_LABEL[a.tipo]}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs">
                          Inicial: {fmt(Number(a.saldo_inicial))}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {isCard ? (
                          <>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground flex items-center gap-1">
                                <CreditCard className="h-3 w-3" />
                                Usado
                              </span>
                              <span className="font-semibold tabular-nums">
                                {fmt(used)} / {fmt(limit)}
                              </span>
                            </div>
                            <Progress value={usedPct} />
                            <p className="text-xs text-muted-foreground">
                              Fecha dia {a.dia_fechamento ?? "—"} • Vence dia {a.dia_vencimento ?? "—"}
                            </p>
                          </>
                        ) : (
                          <div className="text-2xl font-semibold tabular-nums" style={{
                            color: Number(a.saldo_atual) < 0 ? "var(--destructive)" : "var(--foreground)",
                          }}>
                            {fmt(Number(a.saldo_atual))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
          <TabsContent value="faturas" className="mt-6">
            {familyId && <CreditCardBillsTab familyId={familyId} />}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
