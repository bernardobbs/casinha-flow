import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFamily } from "@/hooks/use-family";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Wallet,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  ShieldAlert,
  Check,
  History,
  TrendingUp,
} from "lucide-react";
import { CrisisAiAnalysis } from "@/components/crisis-ai-analysis";
import { SkeletonPage } from "@/components/skeletons";

export const Route = createFileRoute("/crisis")({
  head: () => ({
    meta: [
      { title: "Módulo Crise — Casinha Hub" },
      {
        name: "description",
        content:
          "Detecção e gestão de crise financeira: estágios de saída e plano de estabilização.",
      },
    ],
  }),
  component: CrisisPage,
});

interface CrisisEvent {
  id: string;
  family_id: string;
  data_inicio: string;
  data_fim: string | null;
  motivo_ativacao: string;
  criterio_disparado: string | null;
  estagio_atual: number;
  ativo: boolean;
  created_at: string;
}

interface StageHistory {
  id: string;
  crisis_id: string;
  estagio: number;
  data_entrada: string;
  data_saida: string | null;
  criterio_avanco: string | null;
}

const STAGE_INFO = [
  {
    n: 1,
    title: "Estabilização",
    desc: "Estilo de vida = 0%. Foco total em essenciais e dívidas.",
    advance: "Essenciais cobertos por 2 meses + dívidas não crescendo",
  },
  {
    n: 2,
    title: "Recuperação",
    desc: "Estilo de vida até 10% da renda. Reserva > 0,5x essenciais.",
    advance: "Reserva > 1x essenciais",
  },
  {
    n: 3,
    title: "Retorno",
    desc: "Volta gradual ao 50/30/20. Reserva > 1x essenciais + dívidas controladas.",
    advance: "Saída completa: reserva e dívidas sob controle",
  },
];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

function CrisisPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { familyId, loading: familyLoading } = useFamily();
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<CrisisEvent | null>(null);
  const [history, setHistory] = useState<CrisisEvent[]>([]);
  const [stages, setStages] = useState<StageHistory[]>([]);
  const [showDeclare, setShowDeclare] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [acting, setActing] = useState(false);
  const [nonEssentialAlert, setNonEssentialAlert] = useState<number | null>(
    null,
  );

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: profile } = await supabase
      .from("profiles")
      .select("family_id")
      .eq("id", user.id)
      .maybeSingle();
    const fid = familyId ?? null;
    setFamilyId(fid);
    if (!fid) {
      setLoading(false);
      return;
    }

    const { data: events } = await supabase
      .from("crisis_events")
      .select("*")
      .eq("family_id", fid)
      .order("data_inicio", { ascending: false });

    const all = (events ?? []) as CrisisEvent[];
    const cur = all.find((e) => e.ativo) ?? null;
    setActive(cur);
    setHistory(all.filter((e) => !e.ativo));

    if (cur) {
      const { data: hs } = await supabase
        .from("crisis_stage_history")
        .select("*")
        .eq("crisis_id", cur.id)
        .order("data_entrada", { ascending: true });
      setStages((hs ?? []) as StageHistory[]);

      // Alertar gastos não-essenciais detectados no mês durante crise
      const start = new Date();
      start.setDate(1);
      const startISO = start.toISOString().slice(0, 10);
      const { count } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("family_id", fid)
        .eq("type", "expense")
        .eq("is_essencial", false)
        .gte("date", startISO);
      setNonEssentialAlert(count ?? 0);
    } else {
      setStages([]);
      setNonEssentialAlert(null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleDeclare = async () => {
    if (!familyId) return;
    setActing(true);
    const { error } = await supabase.rpc("activate_crisis", {
      _family_id: familyId,
      _motivo: "manual",
      _criterio: "Declarada manualmente pelo usuário",
    });
    setActing(false);
    setShowDeclare(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Modo Crise ativado");
    loadAll();
  };

  const handleAdvance = async () => {
    if (!active) return;
    setActing(true);
    const { error } = await supabase.rpc("advance_crisis_stage", {
      _crisis_id: active.id,
    });
    setActing(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Estágio atualizado");
    loadAll();
  };

  const handleResolve = async () => {
    if (!active) return;
    setActing(true);
    const { error } = await supabase.rpc("resolve_crisis", {
      _crisis_id: active.id,
    });
    setActing(false);
    setShowResolve(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Crise resolvida");
    loadAll();
  };

  if (authLoading || familyLoading || loading) return <SkeletonPage />;
  if (!user) return null;

  const days = active
    ? Math.floor(
        (Date.now() -
          new Date(active.data_inicio + "T00:00:00").getTime()) /
          (1000 * 60 * 60 * 24),
      ) + 1
    : 0;

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--gradient-subtle)" }}
    >
      <header className="border-b border-border/60 bg-card/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 hover:opacity-80 transition"
          >
            <div
              className="h-9 w-9 rounded-lg flex items-center justify-center"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-semibold tracking-tight">Casinha Hub</span>
              <span className="text-[10px] text-muted-foreground hidden sm:block">
                O centro de controle da sua casa
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
            <h1 className="text-3xl font-semibold tracking-tight">
              Módulo Crise
            </h1>
            <p className="text-muted-foreground mt-1">
              Foco em estabilização: essenciais e dívidas em primeiro lugar.
            </p>
          </div>
          {!active && (
            <Button
              variant="destructive"
              className="gap-2"
              onClick={() => setShowDeclare(true)}
            >
              <ShieldAlert className="h-4 w-4" />
              Declarar Crise
            </Button>
          )}
        </div>

        {active ? (
          <>
            {/* Banner pulsante */}
            <Card
              className="border-destructive/40 overflow-hidden"
              style={{
                background:
                  "color-mix(in oklab, var(--destructive) 10%, transparent)",
              }}
            >
              <CardContent className="py-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3 w-3">
                    <span
                      className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
                      style={{ background: "var(--destructive)" }}
                    />
                    <span
                      className="relative inline-flex h-3 w-3 rounded-full"
                      style={{ background: "var(--destructive)" }}
                    />
                  </span>
                  <div>
                    <p className="font-semibold">
                      ⚠️ MODO CRISE ATIVO — Estágio {active.estagio_atual}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {STAGE_INFO[active.estagio_atual - 1].title} ·{" "}
                      {days} {days === 1 ? "dia" : "dias"} em crise
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="font-normal">
                  {active.motivo_ativacao === "manual"
                    ? "Ativação manual"
                    : "Ativação automática"}
                </Badge>
              </CardContent>
            </Card>

            {/* Detalhes */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="border-border/60 shadow-[var(--shadow-soft)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground font-medium">
                    Critério disparado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">
                    {active.criterio_disparado ?? "—"}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-[var(--shadow-soft)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground font-medium">
                    Início
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tracking-tight">
                    {formatDate(active.data_inicio)}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-[var(--shadow-soft)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground font-medium">
                    Estágio atual
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tracking-tight">
                    {active.estagio_atual} / 3
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {STAGE_INFO[active.estagio_atual - 1].title}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Tracker visual de estágios */}
            <Card className="border-border/60 shadow-[var(--shadow-soft)]">
              <CardHeader>
                <CardTitle>Linha do tempo</CardTitle>
                <CardDescription>
                  Caminho de saída em três estágios.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="relative grid sm:grid-cols-3 gap-6">
                  {STAGE_INFO.map((s) => {
                    const reached = active.estagio_atual >= s.n;
                    const current = active.estagio_atual === s.n;
                    return (
                      <li
                        key={s.n}
                        className="rounded-lg border p-4 transition"
                        style={{
                          borderColor: current
                            ? "var(--destructive)"
                            : "var(--border)",
                          background: current
                            ? "color-mix(in oklab, var(--destructive) 6%, transparent)"
                            : reached
                              ? "color-mix(in oklab, var(--success) 6%, transparent)"
                              : "transparent",
                        }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
                            style={{
                              background: current
                                ? "var(--destructive)"
                                : reached
                                  ? "var(--success)"
                                  : "var(--muted)",
                              color: current || reached
                                ? "var(--primary-foreground)"
                                : "var(--muted-foreground)",
                            }}
                          >
                            {reached && !current ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              s.n
                            )}
                          </span>
                          <p className="font-medium">{s.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                          {s.desc}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          <span className="font-medium">Avança quando:</span>{" "}
                          {s.advance}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>

            {/* Comportamento em modo crise */}
            <Card className="border-border/60 shadow-[var(--shadow-soft)]">
              <CardHeader>
                <CardTitle>Regras em vigor</CardTitle>
                <CardDescription>
                  Comportamento do sistema enquanto a crise está ativa.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-3 text-sm">
                <div className="flex gap-2">
                  <span>✅</span>
                  <p>
                    <span className="font-medium">Manter:</span> essenciais +
                    dívidas (prioridade total)
                  </p>
                </div>
                <div className="flex gap-2">
                  <span>❌</span>
                  <p>
                    <span className="font-medium">Suspender:</span> regra
                    50/30/20
                  </p>
                </div>
                <div className="flex gap-2">
                  <span>❄️</span>
                  <p>
                    <span className="font-medium">Congelar:</span>{" "}
                    movimentações de reserva
                  </p>
                </div>
                <div className="flex gap-2">
                  <span>🚫</span>
                  <p>
                    <span className="font-medium">Bloquear:</span> gastos de
                    estilo de vida
                  </p>
                </div>
              </CardContent>
            </Card>

            {nonEssentialAlert !== null && nonEssentialAlert > 0 && (
              <Card
                className="border-destructive/40"
                style={{
                  background:
                    "color-mix(in oklab, var(--destructive) 6%, transparent)",
                }}
              >
                <CardContent className="py-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">
                      {nonEssentialAlert} gasto(s) não-essencial(is) detectado(s)
                      neste mês
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Em modo crise, gastos de estilo de vida devem ser evitados.
                      Revise as transações marcadas como não essenciais.
                    </p>
                    <Link to="/transactions">
                      <Button size="sm" variant="outline" className="mt-2">
                        Ver transações
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Ações */}
            <div className="flex flex-wrap gap-3">
              <Button
                className="gap-2"
                onClick={handleAdvance}
                disabled={acting}
              >
                {acting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <TrendingUp className="h-4 w-4" />
                )}
                Verificar saída da crise
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowResolve(true)}
                disabled={acting}
              >
                Resolver crise manualmente
              </Button>
            </div>

            <CrisisAiAnalysis hasCrisis={true} />

            {/* Histórico de estágios da crise atual */}
            {stages.length > 0 && (
              <Card className="border-border/60 shadow-[var(--shadow-soft)]">
                <CardHeader>
                  <CardTitle>Progresso desta crise</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {stages.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-start justify-between gap-4 text-sm border-b border-border/60 pb-3 last:border-0 last:pb-0"
                      >
                        <div>
                          <p className="font-medium">
                            Estágio {s.estagio} —{" "}
                            {STAGE_INFO[s.estagio - 1]?.title}
                          </p>
                          {s.criterio_avanco && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {s.criterio_avanco}
                            </p>
                          )}
                        </div>
                        <div className="text-right text-xs text-muted-foreground tabular-nums">
                          <p>{formatDate(s.data_entrada)}</p>
                          {s.data_saida && (
                            <p>→ {formatDate(s.data_saida)}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card className="border-border/60 shadow-[var(--shadow-soft)]">
            <CardContent className="py-12 text-center space-y-3">
              <div
                className="h-12 w-12 rounded-full flex items-center justify-center mx-auto"
                style={{
                  background:
                    "color-mix(in oklab, var(--success) 14%, transparent)",
                  color: "var(--success)",
                }}
              >
                <Check className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight">
                Nenhuma crise ativa
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                O sistema verifica automaticamente os critérios de ativação ao
                atualizar o estado financeiro. Você também pode declarar uma
                crise manualmente.
              </p>
            </CardContent>
          </Card>
        )}

        {!active && <CrisisAiAnalysis hasCrisis={false} />}

        {/* Histórico de crises */}
        {history.length > 0 && (
          <Card className="border-border/60 shadow-[var(--shadow-soft)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Histórico de crises
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {history.map((c) => (
                  <li
                    key={c.id}
                    className="py-3 flex items-start justify-between gap-4 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {c.criterio_disparado ?? "Crise"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Motivo:{" "}
                        {c.motivo_ativacao === "manual"
                          ? "manual"
                          : "automático"}
                      </p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground tabular-nums">
                      <p>{formatDate(c.data_inicio)}</p>
                      {c.data_fim && <p>→ {formatDate(c.data_fim)}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </main>

      <AlertDialog open={showDeclare} onOpenChange={setShowDeclare}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Declarar Modo Crise?</AlertDialogTitle>
            <AlertDialogDescription>
              O sistema entrará em modo de estabilização: regra 50/30/20
              suspensa, foco em essenciais e dívidas. Você poderá sair quando
              os critérios forem atendidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeclare}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Ativar crise
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showResolve} onOpenChange={setShowResolve}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resolver crise manualmente?</AlertDialogTitle>
            <AlertDialogDescription>
              A crise será encerrada e o sistema voltará ao modo normal. Use
              esta opção apenas se você tiver certeza de que a situação foi
              estabilizada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleResolve}>
              Encerrar crise
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
