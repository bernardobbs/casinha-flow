import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFamily } from "@/hooks/use-family";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Wallet, LogOut, Loader2, AlertTriangle, TrendingUp, Plus, Upload, BarChart3,
  CalendarClock, CreditCard, Target, Repeat, ClipboardList, Fuel, Package, Settings, Banknote,
} from "lucide-react";
import { CrisisBanner } from "@/components/crisis-banner";
import { AlertsBell } from "@/components/alerts-bell";
import { SkeletonDashboard } from "@/components/skeletons";
import { fmtBRL } from '@/lib/format';

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel — Casinha Hub" },
      { name: "description", content: "Resumo do mês: saldo, score de saúde, orçamentos e alertas." },
    ],
  }),
  component: Dashboard,
});

type DashSummary = {
  mes: string; dia_atual: number; dias_mes: number;
  renda_mensal: number; total_essenciais: number; total_dividas: number;
  total_estilo_vida: number; saldo_atual: number; saldo_projetado: number;
  meta_essenciais: number; meta_estilo_vida: number; meta_reserva: number;
  modo_crise: boolean; estagio_crise: number | null; score: number; score_label: string;
};
type Saldo = { saldo_total: number; saldo_contas: number; divida_cartoes: number };
type CatProj = {
  category_id: string; nome: string; cor: string; icone: string; is_essencial: boolean;
  valor_planejado: number; valor_gasto: number; valor_projetado: number;
  pct_atingido: number; status_proj: string;
};
type AlertRow = { id: string; mensagem: string; severidade: string; created_at: string };
type ContaPendente = { descricao: string; valor: number; data_vencimento: string; origem: string };

function ScoreDonut({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const r = 38, c = 2 * Math.PI * r, off = c - (pct / 100) * c;
  const color = pct >= 71 ? "hsl(142 71% 45%)" : pct >= 41 ? "hsl(38 92% 50%)" : "hsl(0 84% 60%)";
  return (
    <svg width="100" height="100" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
        transform="rotate(-90 50 50)" />
      <text x="50" y="56" textAnchor="middle" fontSize="22" fontWeight="700" fill="currentColor">{pct}</text>
    </svg>
  );
}

function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { familyId, loading: familyLoading } = useFamily();
  const navigate = useNavigate();
  const [familyName, setFamilyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DashSummary | null>(null);
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [cats, setCats] = useState<CatProj[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [stockReviewOk, setStockReviewOk] = useState<boolean | null>(null);
  const [contasPendentes, setContasPendentes] = useState<ContaPendente[]>([]);
  const [totalPendente, setTotalPendente] = useState(0);

  useEffect(() => { if (!authLoading && !user) navigate({ to: "/auth" }); }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const fid = familyId ?? null;
      if (!fid) { setLoading(false); return; }

      const [s, sa, c, prev] = await Promise.all([
        supabase.rpc("get_dashboard_summary", { p_family_id: fid }),
        supabase.rpc("get_saldo_total", { p_family_id: fid }),
        supabase.rpc("get_projecao_categorias", { p_family_id: fid }),
        supabase.rpc("get_previsao_mes", { p_family_id: fid }),
      ]);

      if (cancelled) return;

      if (s.data && Array.isArray(s.data) && s.data[0]) setSummary(s.data[0] as DashSummary);
      if (sa.data && Array.isArray(sa.data) && sa.data[0]) setSaldo(sa.data[0] as Saldo);
      if (c.data) setCats((c.data as CatProj[]).slice(0, 6));
      if (prev.data) {
        const pendentes = (prev.data as ContaPendente[]).filter((p: ContaPendente) => p.status !== 'pago');
        setContasPendentes(pendentes.slice(0, 3));
        setTotalPendente(pendentes.reduce((acc, p) => acc + Number(p.valor), 0));
      }

      // Badge estoque
      const { data: lastRev } = await supabase
        .from("weekly_reviews").select("created_at, checklist")
        .eq("family_id", fid).order("created_at", { ascending: false }).limit(20);
      if (cancelled) return;
      const stockRev = (lastRev ?? []).find((r: Record<string,unknown>) => (r?.checklist as Record<string,unknown>)?.tipo === "estoque");
      if (!stockRev) setStockReviewOk(false);
      else {
        const ageDays = (Date.now() - new Date((stockRev as Record<string,string>).created_at).getTime()) / 86400000;
        setStockReviewOk(ageDays <= 7);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, familyId]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Sessão encerrada.");
    navigate({ to: "/auth" });
  };

  if (authLoading || loading) {
    return <SkeletonDashboard />;
  }
  if (!user) return null;

  const firstName = user.user_metadata?.full_name?.split(" ")[0]
    ?? user.email?.split("@")[0] ?? "olá";
  const mesLabel = summary
    ? new Date(summary.mes + "T12:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    : "";
  const gastoTotal = (summary?.total_essenciais ?? 0) + (summary?.total_dividas ?? 0) + (summary?.total_estilo_vida ?? 0);
  const reservaAtual = (summary?.renda_mensal ?? 0) - gastoTotal;

  const catBadge = (s: string) =>
    s === "vai_estourar" ? "🔴" : s === "atencao" ? "⚠️" : s === "ok" ? "✅" : "—";

  const diasRestantes = summary ? summary.dias_mes - summary.dia_atual : 0;

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <header className="border-b border-border/60 bg-card/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--gradient-primary)" }}>
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="flex flex-col leading-tight min-w-0">
              <span className="font-semibold tracking-tight truncate">Olá, {firstName}! 👋</span>
              <span className="text-[11px] text-muted-foreground capitalize">
                {mesLabel} {familyName && `• ${familyName}`}
                {diasRestantes > 0 && ` • ${diasRestantes} dias restantes`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <AlertsBell />
            <Button variant="ghost" size="sm" onClick={handleSignOut}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <CrisisBanner />

      <main className="max-w-6xl mx-auto px-4 py-5 space-y-5">
        {/* Saldo + Score */}
        <Card className="border-border/60 shadow-[var(--shadow-soft)]">
          <CardContent className="py-5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Saldo total</p>
              <p className={`text-3xl font-semibold tracking-tight ${(saldo?.saldo_total ?? 0) < 0 ? "text-destructive" : ""}`}>
                {fmtBRL(saldo?.saldo_total ?? 0)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Contas {fmtBRL(saldo?.saldo_contas ?? 0)} • Cartões {fmtBRL(saldo?.divida_cartoes ?? 0)}
              </p>
              {totalPendente > 0 && (
                <Link to="/contas-a-pagar">
                  <p className="text-[11px] text-amber-600 mt-1 hover:underline">
                    ⚠️ {fmtBRL(totalPendente)} comprometido este mês
                  </p>
                </Link>
              )}
            </div>
            {summary && (
              <div className="flex flex-col items-center shrink-0">
                <MiniGauge score={summary.score} />
                <span className="text-xs font-medium -mt-1">{summary.score_label}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resumo do mês */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Receita" value={fmtBRL(summary?.renda_mensal ?? 0)} tone="success" />
          <Stat label="Gasto" value={fmtBRL(gastoTotal)} tone="destructive" />
          <Stat label="Saldo mês" value={fmtBRL((summary?.renda_mensal ?? 0) - gastoTotal)} />
          <Stat label="Projeção" value={fmtBRL(summary?.saldo_projetado ?? 0)}
            tone={(summary?.saldo_projetado ?? 0) < 0 ? "destructive" : "default"} />
        </div>

        {/* 50/30/20 */}
        <Card className="border-border/60 shadow-[var(--shadow-soft)]">
          <CardHeader className="pb-3"><CardTitle className="text-base">Regra 50/30/20</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Bar50 label="Essenciais (50%)" hoje={summary?.total_essenciais ?? 0} meta={summary?.meta_essenciais ?? 0} />
            <Bar50 label="Estilo de vida (30%)" hoje={summary?.total_estilo_vida ?? 0} meta={summary?.meta_estilo_vida ?? 0} />
            <Bar50 label="Reserva (20%)" hoje={reservaAtual} meta={summary?.meta_reserva ?? 0} />
          </CardContent>
        </Card>

        {/* Contas pendentes próximas */}
        {contasPendentes.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/40">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-amber-600" />
                  Próximas a vencer
                </CardTitle>
                <Link to="/contas-a-pagar" className="text-xs text-primary hover:underline">Ver todas →</Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {contasPendentes.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="truncate">
                    {(p as any).origem === 'fatura_cartao' ? '💳' : (p as any).origem === 'parcela' ? '📋' : '🔄'} {p.descricao}
                  </span>
                  <span className="font-medium tabular-nums shrink-0 ml-2">{fmtBRL(Number(p.valor))}</span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between text-xs font-semibold text-amber-700 dark:text-amber-400">
                <span>Total comprometido</span>
                <span>{fmtBRL(totalPendente)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Categorias top 6 */}
        <Card className="border-border/60 shadow-[var(--shadow-soft)]">
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base">Por categoria</CardTitle>
            <Link to="/situacao" className="text-xs text-primary hover:underline">Ver todas →</Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {cats.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem categorias com gastos este mês.</p>
            ) : cats.map((c) => {
              const pct = c.valor_planejado > 0 ? Math.min(100, (c.valor_gasto / c.valor_planejado) * 100) : 0;
              // Mostrar nome curto (sem prefixo pai)
              const nomeExibido = c.nome.includes(" — ") ? c.nome.split(" — ").slice(1).join(" — ") : c.nome;
              return (
                <div key={c.category_id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium truncate">{catBadge(c.status_proj)} {c.icone} {nomeExibido}</span>
                    <span className="text-muted-foreground tabular-nums text-xs">
                      {fmtBRL(c.valor_gasto)}{c.valor_planejado > 0 ? ` / ${fmtBRL(c.valor_planejado)}` : ""}
                    </span>
                  </div>
                  <Progress value={pct} />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Alertas urgentes */}
        {alerts.length > 0 && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Alertas urgentes</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {alerts.map(a => (
                  <li key={a.id} className="text-sm flex items-start gap-2">
                    <span>🔴</span><span>{a.mensagem}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Ações rápidas */}
        <div className="grid grid-cols-2 gap-3">
          <QuickAction to="/transactions" icon={<Plus className="h-4 w-4" />} label="Lançar" />
          <QuickAction to="/transactions" icon={<Upload className="h-4 w-4" />} label="Importar" />
          <QuickAction to="/situacao" icon={<BarChart3 className="h-4 w-4" />} label="Situação" />
          <QuickAction to="/contas-a-pagar" icon={<CalendarClock className="h-4 w-4" />} label="A Pagar" />
        </div>

        {/* Cards de acesso */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <AccessCard to="/transactions" icon={<CreditCard />} label="Transações" />
          <AccessCard to="/contas" icon={<Banknote />} label="Contas Bancárias" />
          <AccessCard to="/budgets" icon={<Target />} label="Orçamento" />
          <AccessCard to="/recorrentes" icon={<Repeat />} label="Recorrentes" />
          <AccessCard to="/revisao-semanal" icon={<ClipboardList />} label="Revisão" />
          <AccessCard to="/gasolina" icon={<Fuel />} label="Gasolina" />
          <Link to="/estoque" className="group">
            <Card className="border-border/60 hover:border-primary/40 transition">
              <CardContent className="py-4 flex flex-col items-center gap-1">
                <Package className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />
                <span className="text-xs font-medium">Estoque</span>
                {stockReviewOk === false && <Badge className="bg-yellow-500/15 text-yellow-700 font-normal text-[10px]">⚠️ Revisão pendente</Badge>}
                {stockReviewOk === true && <Badge className="bg-emerald-500/15 text-emerald-700 font-normal text-[10px]">✅ Em dia</Badge>}
              </CardContent>
            </Card>
          </Link>
          <AccessCard to="/financial-state" icon={<TrendingUp />} label="Estado fin." />
          <AccessCard to="/configuracoes" icon={<Settings />} label="Config." />
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" | "destructive" }) {
  const color = tone === "success" ? "var(--success)" : tone === "destructive" ? "var(--destructive)" : undefined;
  return (
    <Card className="border-border/60">
      <CardContent className="py-3">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="font-semibold tabular-nums text-sm sm:text-base" style={color ? { color } : undefined}>{value}</p>
      </CardContent>
    </Card>
  );
}

function Bar50({ label, hoje, meta }: { label: string; hoje: number; meta: number }) {
  const pct = meta > 0 ? Math.min(100, (Math.max(0, hoje) / meta) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="text-muted-foreground tabular-nums text-xs">{fmtBRL(hoje)} / {fmtBRL(meta)}</span>
      </div>
      <Progress value={pct} />
    </div>
  );
}

function QuickAction({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to}>
      <Button variant="outline" className="w-full justify-start gap-2 h-12">
        {icon}<span>{label}</span>
      </Button>
    </Link>
  );
}

function AccessCard({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to}>
      <Card className="border-border/60 hover:border-primary/40 transition-colors">
        <CardContent className="py-4 flex flex-col items-center gap-1.5 text-center">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-xs font-medium">{label}</span>
        </CardContent>
      </Card>
    </Link>
  );
}
