import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFamily } from "@/hooks/use-family";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Loader2, AlertTriangle, ShieldAlert, ShieldCheck, TrendingUp, Wallet, PiggyBank, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { SkeletonPage } from "@/components/skeletons";

export const Route = createFileRoute("/situacao")({
  head: () => ({ meta: [{ title: "Situação Financeira — Casinha Hub" }] }),
  component: SituacaoPage,
});

type DashSummary = {
  mes: string; dia_atual: number; dias_mes: number;
  renda_mensal: number; total_essenciais: number; total_dividas: number;
  total_estilo_vida: number; saldo_atual: number; saldo_projetado: number;
  meta_essenciais: number; meta_estilo_vida: number; meta_reserva: number;
  modo_crise: boolean; estagio_crise: number | null; score: number; score_label: string;
};
type CatProj = {
  category_id: string; nome: string; cor: string; icone: string; is_essencial: boolean;
  valor_planejado: number; valor_gasto: number; valor_projetado: number;
  pct_atingido: number; status_proj: string;
};
type SaldoTotal = { saldo_total: number; saldo_contas: number; divida_cartoes: number };
type CrisisEvent = {
  id: string; family_id: string; data_inicio: string; data_fim: string | null;
  estagio_atual: number; ativo: boolean;
};

const STAGE_INFO = [
  { n: 1, title: "Estabilização", desc: "Estilo de vida = 0%. Foco total em essenciais e dívidas.", cor: "text-red-600" },
  { n: 2, title: "Recuperação", desc: "Estilo de vida até 10% da renda. Reserva crescendo.", cor: "text-orange-500" },
  { n: 3, title: "Retorno", desc: "Volta gradual ao 50/30/20. Dívidas sob controle.", cor: "text-yellow-500" },
];

const fmtBRL = (n: number) => (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (iso: string) => new Date(iso + "T12:00").toLocaleDateString("pt-BR");

function Stat({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-3 text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${bad ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}

function SituacaoPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { familyId, loading: familyLoading } = useFamily();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DashSummary | null>(null);
  const [cats, setCats] = useState<CatProj[]>([]);
  const [saldo, setSaldo] = useState<SaldoTotal | null>(null);
  const [crisis, setCrisis] = useState<CrisisEvent | null>(null);
  const [crisisDialog, setCrisisDialog] = useState(false);
  const [crisisLoading, setCrisisLoading] = useState(false);
  const [financialState, setFinancialState] = useState<{ total_reserva: number; patrimonio_liquido: number } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  const load = async () => {
    if (!user || !familyId) return;
    setLoading(true);

    const [s, c, sa, cr, fs] = await Promise.all([
      supabase.rpc("get_dashboard_summary", { p_family_id: familyId }),
      supabase.rpc("get_projecao_categorias", { p_family_id: familyId }),
      supabase.rpc("get_saldo_total", { p_family_id: familyId }),
      supabase.from("crisis_events")
        .select("id,family_id,data_inicio,data_fim,estagio_atual,ativo")
        .eq("family_id", familyId).eq("ativo", true).maybeSingle(),
      supabase.from("financial_state" as any)
        .select("total_reserva,patrimonio_liquido").eq("family_id", familyId).maybeSingle(),
    ]);

    const sRow = Array.isArray(s.data) ? s.data[0] : s.data;
    if (sRow) setSummary(sRow as DashSummary);
    if (c.data) setCats(c.data as CatProj[]);
    const saRow = Array.isArray(sa.data) ? sa.data[0] : sa.data;
    if (saRow) setSaldo(saRow as SaldoTotal);
    if (cr.data) setCrisis(cr.data as CrisisEvent);
    if (fs.data) setFinancialState(fs.data as any);

    setLoading(false);
  };

  useEffect(() => { load(); }, [user, familyId]);

  const ativarCrise = async () => {
    if (!familyId) return;
    setCrisisLoading(true);
    const { error } = await supabase.rpc("activate_crisis" as any, {
      p_family_id: familyId, p_motivo: "Ativado manualmente", p_estagio: 1,
    });
    setCrisisLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Modo crise ativado");
    setCrisisDialog(false);
    await load();
  };

  const resolverCrise = async () => {
    if (!crisis) return;
    setCrisisLoading(true);
    const { error } = await supabase.rpc("resolve_crisis" as any, { p_crisis_id: crisis.id });
    setCrisisLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Modo crise desativado");
    await load();
  };

  const avancarEstagio = async () => {
    if (!crisis) return;
    setCrisisLoading(true);
    const { error } = await supabase.rpc("advance_crisis_stage" as any, { p_crisis_id: crisis.id });
    setCrisisLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Avançou para o próximo estágio");
    await load();
  };

  const gastoTotal = (summary?.total_essenciais ?? 0) + (summary?.total_dividas ?? 0) + (summary?.total_estilo_vida ?? 0);
  const pctMes = summary ? (summary.dia_atual / summary.dias_mes) * 100 : 0;
  const mesLabel = summary
    ? new Date(summary.mes + "T12:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    : "";

  const orcamento = useMemo(() => {
    const planejado = cats.reduce((s, c) => s + (c.valor_planejado ?? 0), 0);
    const realizado = cats.reduce((s, c) => s + (c.valor_gasto ?? 0), 0);
    const projetado = cats.reduce((s, c) => s + (c.valor_projetado ?? 0), 0);
    return { planejado, realizado, projetado };
  }, [cats]);

  if (authLoading || familyLoading || loading) return <SkeletonPage />;

  const stageInfo = crisis ? STAGE_INFO[crisis.estagio_atual - 1] : null;

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <header className="border-b border-border/60 bg-card/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link to="/dashboard"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Painel</Button></Link>
            <h1 className="text-lg font-semibold capitalize">{mesLabel}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-5">

        {/* CRISE ATIVA — banner */}
        {crisis && stageInfo && (
          <div className="rounded-xl border-2 border-destructive bg-destructive/10 p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 font-semibold text-destructive">
                <ShieldAlert className="h-5 w-5" />
                MODO CRISE — Estágio {crisis.estagio_atual}: {stageInfo.title}
              </div>
              <Badge variant="destructive">Desde {fmtDate(crisis.data_inicio)}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{stageInfo.desc}</p>
            <div className="flex gap-2 flex-wrap">
              {crisis.estagio_atual < 3 && (
                <Button size="sm" variant="outline" onClick={avancarEstagio} disabled={crisisLoading}>
                  {crisisLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Avançar estágio →"}
                </Button>
              )}
              <Button size="sm" variant="outline" className="text-destructive border-destructive"
                onClick={resolverCrise} disabled={crisisLoading}>
                {crisisLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ShieldCheck className="h-4 w-4 mr-1" />Encerrar crise</>}
              </Button>
            </div>
          </div>
        )}

        {/* 1. SITUAÇÃO — Mês atual */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" />
              Situação — {mesLabel}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progresso do mês */}
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Progresso do mês</span>
                <span>Dia {summary?.dia_atual} de {summary?.dias_mes}</span>
              </div>
              <Progress value={pctMes} className="h-2" />
            </div>

            {/* Cards de resumo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Receita" value={fmtBRL(summary?.renda_mensal ?? 0)} />
              <Stat label="Gasto" value={fmtBRL(gastoTotal)} />
              <Stat label="Saldo mês" value={fmtBRL(summary?.saldo_atual ?? 0)} bad={(summary?.saldo_atual ?? 0) < 0} />
              <Stat label="Projeção fim do mês" value={fmtBRL(summary?.saldo_projetado ?? 0)} bad={(summary?.saldo_projetado ?? 0) < 0} />
            </div>

            {/* Orçamento planejado vs realizado */}
            <div className="rounded-lg border border-border/60 p-4 space-y-3">
              <p className="text-sm font-medium">Orçamento</p>
              <div className="grid grid-cols-3 gap-3 text-center text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Planejado</p>
                  <p className="font-semibold">{fmtBRL(orcamento.planejado)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Realizado</p>
                  <p className="font-semibold">{fmtBRL(orcamento.realizado)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Projeção</p>
                  <p className={`font-semibold ${orcamento.projetado > orcamento.planejado ? "text-destructive" : ""}`}>
                    {fmtBRL(orcamento.projetado)}
                  </p>
                </div>
              </div>
              <Progress
                value={orcamento.planejado > 0 ? Math.min(100, (orcamento.realizado / orcamento.planejado) * 100) : 0}
                className="h-2"
              />
            </div>

            {/* Top categorias com problema */}
            {cats.filter(c => c.status_proj === "vai_estourar" || c.pct_atingido > 80).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Categorias em atenção</p>
                {cats.filter(c => c.status_proj === "vai_estourar" || c.pct_atingido > 80).slice(0, 5).map(c => (
                  <div key={c.category_id} className="flex items-center gap-2 text-sm">
                    <span>{c.icone}</span>
                    <span className="flex-1 truncate">{c.nome}</span>
                    <span className="text-xs text-muted-foreground">{fmtBRL(c.valor_gasto)} / {fmtBRL(c.valor_planejado)}</span>
                    <Badge variant={c.status_proj === "vai_estourar" ? "destructive" : "secondary"} className="text-xs">
                      {c.pct_atingido.toFixed(0)}%
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. ESTADO FINANCEIRO */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-primary" />
              Estado Financeiro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border border-border/60 bg-card p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Wallet className="h-3.5 w-3.5" />Saldo em contas
                </div>
                <p className="text-lg font-semibold">{fmtBRL(saldo?.saldo_contas ?? 0)}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <CreditCard className="h-3.5 w-3.5" />Dívida cartões
                </div>
                <p className={`text-lg font-semibold ${(saldo?.divida_cartoes ?? 0) > 0 ? "text-destructive" : ""}`}>
                  {fmtBRL(saldo?.divida_cartoes ?? 0)}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <TrendingUp className="h-3.5 w-3.5" />Saldo líquido
                </div>
                <p className={`text-lg font-semibold ${(saldo?.saldo_total ?? 0) < 0 ? "text-destructive" : ""}`}>
                  {fmtBRL(saldo?.saldo_total ?? 0)}
                </p>
              </div>
              {financialState && (
                <>
                  <div className="rounded-lg border border-border/60 bg-card p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <PiggyBank className="h-3.5 w-3.5" />Reserva
                    </div>
                    <p className="text-lg font-semibold">{fmtBRL(financialState.total_reserva ?? 0)}</p>
                    {summary && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {((financialState.total_reserva ?? 0) / Math.max(summary.total_essenciais, 1)).toFixed(1)}x essenciais
                      </p>
                    )}
                  </div>
                  <div className="rounded-lg border border-border/60 bg-card p-3 col-span-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <TrendingUp className="h-3.5 w-3.5" />Patrimônio líquido
                    </div>
                    <p className={`text-lg font-semibold ${(financialState.patrimonio_liquido ?? 0) < 0 ? "text-destructive" : ""}`}>
                      {fmtBRL(financialState.patrimonio_liquido ?? 0)}
                    </p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 3. MODO CRISE */}
        {!crisis && (
          <Card className="border-border/60">
            <CardContent className="py-5 flex items-center justify-between gap-4">
              <div>
                <p className="font-medium flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                  Modo Crise
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Ative quando as contas não fecham. Define um plano de 3 estágios para recuperação.
                </p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setCrisisDialog(true)}>
                Ativar
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Dialog confirmação ativar crise */}
      <AlertDialog open={crisisDialog} onOpenChange={setCrisisDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Ativar Modo Crise?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O sistema vai iniciar o Estágio 1 (Estabilização): redução máxima de gastos e foco total
              em essenciais e dívidas. Você pode desativar a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={ativarCrise} disabled={crisisLoading}
              className="bg-destructive hover:bg-destructive/90">
              {crisisLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ativar Modo Crise"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
