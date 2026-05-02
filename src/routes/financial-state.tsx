import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Wallet,
  ArrowLeft,
  Loader2,
  PiggyBank,
  Sparkles,
  TrendingDown,
  CreditCard,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/financial-state")({
  head: () => ({
    meta: [
      { title: "Estado financeiro — Casinha Flow" },
      {
        name: "description",
        content:
          "Painel mensal 50/30/20: essenciais, estilo de vida e reserva.",
      },
    ],
  }),
  component: FinancialStatePage,
});

interface FinancialState {
  id: string;
  family_id: string;
  mes: string;
  renda_mensal: number;
  total_essenciais: number;
  total_dividas: number;
  total_reserva: number;
  total_estilo_vida: number;
  saldo_atual: number;
  meta_essenciais: number;
  meta_estilo_vida: number;
  meta_reserva: number;
  modo_crise: boolean;
}

const formatCurrency = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const monthLabel = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

function firstOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function FinancialStatePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalcing, setRecalcing] = useState(false);
  const [savingRenda, setSavingRenda] = useState(false);
  const [savingReserva, setSavingReserva] = useState(false);
  const [state, setState] = useState<FinancialState | null>(null);
  const [mes, setMes] = useState<string>(firstOfMonth());
  const [rendaInput, setRendaInput] = useState<string>("");
  const [reservaInput, setReservaInput] = useState<string>("");

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  // Resolve family id
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

  // Load + auto-recalc state for selected month
  const loadState = async (opts?: { renda?: number }) => {
    if (!familyId) return;
    setLoading(true);

    // 1) call recalc to make sure totals are fresh
    const args: { _family_id: string; _mes: string; _renda?: number } = {
      _family_id: familyId,
      _mes: mes,
    };
    if (typeof opts?.renda === "number") args._renda = opts.renda;
    const { data: rpc, error: rpcErr } = await supabase.rpc(
      "recalc_financial_state",
      args,
    );

    if (rpcErr) {
      toast.error(`Erro ao calcular estado: ${rpcErr.message}`);
      setLoading(false);
      return;
    }

    const row = (Array.isArray(rpc) ? rpc[0] : rpc) as FinancialState | null;
    if (row) {
      const normalized: FinancialState = {
        ...row,
        renda_mensal: Number(row.renda_mensal),
        total_essenciais: Number(row.total_essenciais),
        total_dividas: Number(row.total_dividas),
        total_reserva: Number(row.total_reserva),
        total_estilo_vida: Number(row.total_estilo_vida),
        saldo_atual: Number(row.saldo_atual),
        meta_essenciais: Number(row.meta_essenciais),
        meta_estilo_vida: Number(row.meta_estilo_vida),
        meta_reserva: Number(row.meta_reserva),
      };
      setState(normalized);
      setRendaInput(
        normalized.renda_mensal > 0
          ? normalized.renda_mensal.toFixed(2).replace(".", ",")
          : "",
      );
      setReservaInput(
        normalized.total_reserva > 0
          ? normalized.total_reserva.toFixed(2).replace(".", ",")
          : "",
      );
    } else {
      setState(null);
    }

    // Auto-ativação de crise: verifica critérios após recalc
    try {
      const { data: check } = await supabase.rpc("check_crisis_activation", {
        _family_id: familyId,
        _mes: mes,
      });
      const result = Array.isArray(check) ? check[0] : check;
      if (result?.should_activate && result?.criterio) {
        const { data: existing } = await supabase
          .from("crisis_events")
          .select("id")
          .eq("family_id", familyId)
          .eq("ativo", true)
          .maybeSingle();
        if (!existing) {
          await supabase.rpc("activate_crisis", {
            _family_id: familyId,
            _motivo: "automatico",
            _criterio: result.criterio,
          });
          toast.warning(`Modo Crise ativado: ${result.criterio}`);
        }
      }
    } catch {
      // silencioso — não bloqueia a tela
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!familyId) return;
    loadState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId, mes]);

  const handleSaveRenda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyId) return;
    const parsed = Number(rendaInput.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error("Renda inválida");
      return;
    }
    setSavingRenda(true);
    await loadState({ renda: parsed });
    setSavingRenda(false);
    toast.success("Renda atualizada");
  };

  const handleSaveReserva = async () => {
    if (!familyId || !state) return;
    const parsed = Number(reservaInput.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error("Reserva inválida");
      return;
    }
    setSavingReserva(true);
    const { error } = await supabase
      .from("financial_state")
      .update({ total_reserva: parsed })
      .eq("id", state.id);
    setSavingReserva(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setState({ ...state, total_reserva: parsed });
    toast.success("Reserva atualizada");
  };

  const handleRecalc = async () => {
    setRecalcing(true);
    await loadState();
    setRecalcing(false);
    toast.success("Recalculado");
  };

  // Last 6 months selector
  const monthOptions = useMemo(() => {
    const now = new Date();
    const arr: { value: string; label: string }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = d.toISOString().slice(0, 10);
      arr.push({ value, label: monthLabel(value) });
    }
    return arr;
  }, []);

  const pct = (v: number, meta: number) => {
    if (meta <= 0) return 0;
    return Math.min(100, Math.round((v / meta) * 100));
  };

  if (authLoading || (loading && !state)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return null;

  const e = state?.total_essenciais ?? 0;
  const ev = state?.total_estilo_vida ?? 0;
  const dv = state?.total_dividas ?? 0;
  const rs = state?.total_reserva ?? 0;
  const renda = state?.renda_mensal ?? 0;
  const metaEss = state?.meta_essenciais ?? 0;
  const metaEst = state?.meta_estilo_vida ?? 0;
  const metaRes = state?.meta_reserva ?? 0;
  const saldo = state?.saldo_atual ?? 0;

  const overEssencial = renda > 0 && e > metaEss;
  const overEstilo = renda > 0 && ev > metaEst;
  const underReserva = renda > 0 && rs < metaRes;

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
            <div className="flex flex-col leading-tight">
              <span className="font-semibold tracking-tight">Casinha Flow</span>
              <span className="text-[10px] text-muted-foreground hidden sm:block">
                controle e liberdade andando juntos
              </span>
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
            <h1 className="text-3xl font-semibold tracking-tight">Estado financeiro</h1>
            <p className="text-muted-foreground mt-1 capitalize">
              {state ? monthLabel(state.mes) : monthLabel(mes)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              value={mes}
              onChange={(ev) => setMes(ev.target.value)}
            >
              {monthOptions.map((o) => (
                <option key={o.value} value={o.value} className="capitalize">
                  {o.label}
                </option>
              ))}
            </select>
            <Button variant="outline" className="gap-2" onClick={handleRecalc} disabled={recalcing}>
              {recalcing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Recalcular
            </Button>
          </div>
        </div>

        {state?.modo_crise && (
          <Card
            className="border-destructive/40"
            style={{
              background: "color-mix(in oklab, var(--destructive) 8%, transparent)",
            }}
          >
            <CardContent className="py-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium">Modo Crise ativado</p>
                <p className="text-sm text-muted-foreground">
                  Foco em essenciais e dívidas. Estilo de vida deve ser reduzido.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Renda + Saldo */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="border-border/60 shadow-[var(--shadow-soft)] md:col-span-2">
            <CardHeader>
              <CardTitle>Renda mensal</CardTitle>
              <CardDescription>
                Defina a renda do mês para calcular as metas 50/30/20.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveRenda} className="flex flex-wrap items-end gap-3">
                <div className="space-y-2 flex-1 min-w-[200px]">
                  <Label htmlFor="renda">Renda do mês (R$)</Label>
                  <Input
                    id="renda"
                    inputMode="decimal"
                    value={rendaInput}
                    onChange={(ev) =>
                      setRendaInput(ev.target.value.replace(/[^0-9.,]/g, ""))
                    }
                    placeholder="0,00"
                  />
                </div>
                <Button type="submit" disabled={savingRenda}>
                  {savingRenda ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar renda"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-[var(--shadow-soft)]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Saldo do mês
              </CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div
                className="text-3xl font-semibold tracking-tight"
                style={{
                  color: saldo >= 0 ? "var(--success)" : "var(--destructive)",
                }}
              >
                {formatCurrency(saldo)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Renda − essenciais − dívidas − estilo de vida
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 50/30/20 */}
        <Card className="border-border/60 shadow-[var(--shadow-soft)]">
          <CardHeader>
            <CardTitle>Painel 50/30/20</CardTitle>
            <CardDescription>
              Como sua renda está sendo distribuída este mês.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {renda <= 0 && (
              <p className="text-sm text-muted-foreground">
                Defina a renda mensal para calcular as metas.
              </p>
            )}

            {/* Essenciais 50% */}
            <BucketRow
              icon={<Sparkles className="h-4 w-4" />}
              color="var(--primary)"
              title="Essenciais"
              subtitle="Meta 50% — moradia, alimentação, saúde, transporte, educação"
              value={e}
              meta={metaEss}
              over={overEssencial}
            />

            {/* Estilo de vida 30% */}
            <BucketRow
              icon={<TrendingDown className="h-4 w-4" />}
              color="#06b6d4"
              title="Estilo de vida"
              subtitle="Meta 30% — lazer, assinaturas, vestuário"
              value={ev}
              meta={metaEst}
              over={overEstilo}
            />

            {/* Reserva 20% */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full"
                    style={{
                      background: "color-mix(in oklab, var(--success) 14%, transparent)",
                      color: "var(--success)",
                    }}
                  >
                    <PiggyBank className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-medium leading-tight">Reserva</p>
                    <p className="text-xs text-muted-foreground">
                      Meta 20% — guardado/investido
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">
                    {formatCurrency(rs)}{" "}
                    <span className="text-muted-foreground font-normal">
                      / {formatCurrency(metaRes)}
                    </span>
                  </p>
                  {underReserva && (
                    <Badge variant="outline" className="mt-1 font-normal text-[10px]">
                      Abaixo da meta
                    </Badge>
                  )}
                </div>
              </div>
              <Progress
                value={pct(rs, metaRes)}
                className="bg-muted [&>div]:bg-[var(--success)]"
              />
              <div className="flex flex-wrap items-end gap-2 pt-2">
                <div className="flex-1 min-w-[180px] space-y-1">
                  <Label htmlFor="reserva" className="text-xs">
                    Atualizar reserva guardada
                  </Label>
                  <Input
                    id="reserva"
                    inputMode="decimal"
                    value={reservaInput}
                    onChange={(ev) =>
                      setReservaInput(ev.target.value.replace(/[^0-9.,]/g, ""))
                    }
                    placeholder="0,00"
                    className="h-9"
                    disabled={!state}
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveReserva}
                  disabled={!state || savingReserva}
                >
                  {savingReserva ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                </Button>
              </div>
            </div>

            {/* Dívidas (informational) */}
            <div className="border-t border-border/60 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full"
                    style={{
                      background: "color-mix(in oklab, var(--destructive) 14%, transparent)",
                      color: "var(--destructive)",
                    }}
                  >
                    <CreditCard className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-medium leading-tight">Dívidas</p>
                    <p className="text-xs text-muted-foreground">
                      Pagamentos do mês na categoria Dívidas
                    </p>
                  </div>
                </div>
                <p className="font-semibold tabular-nums text-destructive">
                  {formatCurrency(dv)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

interface BucketRowProps {
  icon: React.ReactNode;
  color: string;
  title: string;
  subtitle: string;
  value: number;
  meta: number;
  over: boolean;
}

function BucketRow({ icon, color, title, subtitle, value, meta, over }: BucketRowProps) {
  const formatCurrency = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const pct = meta > 0 ? Math.min(100, Math.round((value / meta) * 100)) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-full"
            style={{
              background: `color-mix(in oklab, ${color} 14%, transparent)`,
              color,
            }}
          >
            {icon}
          </span>
          <div>
            <p className="font-medium leading-tight">{title}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-semibold tabular-nums">
            {formatCurrency(value)}{" "}
            <span className="text-muted-foreground font-normal">
              / {formatCurrency(meta)}
            </span>
          </p>
          {over && (
            <Badge variant="destructive" className="mt-1 font-normal text-[10px]">
              Acima da meta
            </Badge>
          )}
        </div>
      </div>
      <Progress
        value={pct}
        className="bg-muted"
        style={
          over
            ? ({ ["--tw-bg-opacity" as never]: 1 } as React.CSSProperties)
            : undefined
        }
      />
    </div>
  );
}
