import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { SkeletonSituacao } from "@/components/skeletons";

export const Route = createFileRoute("/situacao")({
  head: () => ({
    meta: [
      { title: "Situação Atual — Casinha Flow" },
      { name: "description", content: "Visão financeira completa: score de saúde, projeções, alertas e contas a pagar." },
    ],
  }),
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
type AlertRow = { id: string; tipo: string; mensagem: string; severidade: string; created_at: string };
type BillRow = { id: string; descricao: string; valor: number; data_vencimento: string; status: string };

const fmtBRL = (n: number) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ScoreGauge({ score, label }: { score: number; label: string }) {
  const pct = Math.max(0, Math.min(100, score));
  const r = 70;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const color = pct >= 71 ? "hsl(142 71% 45%)" : pct >= 41 ? "hsl(38 92% 50%)" : "hsl(0 84% 60%)";
  return (
    <div className="flex flex-col items-center justify-center">
      <svg width="180" height="180" viewBox="0 0 180 180">
        <circle cx="90" cy="90" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="14" />
        <circle
          cx="90" cy="90" r={r} fill="none" stroke={color} strokeWidth="14"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
          transform="rotate(-90 90 90)"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        <text x="90" y="86" textAnchor="middle" fontSize="36" fontWeight="700" fill="currentColor">
          {pct}
        </text>
        <text x="90" y="110" textAnchor="middle" fontSize="13" fill="hsl(var(--muted-foreground))">
          de 100
        </text>
      </svg>
      <p className="mt-2 font-semibold" style={{ color }}>{label}</p>
    </div>
  );
}

function SituacaoPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DashSummary | null>(null);
  const [cats, setCats] = useState<CatProj[]>([]);
  const [saldo, setSaldo] = useState<SaldoTotal | null>(null);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [bills, setBills] = useState<BillRow[]>([]);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: profile } = await supabase
        .from("profiles").select("family_id").eq("id", user.id).maybeSingle();
      const fid = profile?.family_id ?? null;
      setFamilyId(fid);
      if (!fid) { setLoading(false); return; }

      const today = new Date();
      const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
      const isoToday = today.toISOString().slice(0, 10);
      const iso7 = in7.toISOString().slice(0, 10);

      const [s, c, sa, al, bl] = await Promise.all([
        supabase.rpc("get_dashboard_summary", { p_family_id: fid }),
        supabase.rpc("get_projecao_categorias", { p_family_id: fid }),
        supabase.rpc("get_saldo_total", { p_family_id: fid }),
        supabase.from("alerts").select("id,tipo,mensagem,severidade,created_at")
          .eq("family_id", fid).eq("lido", false)
          .order("created_at", { ascending: false }).limit(5),
        supabase.from("bills_reminders")
          .select("id,descricao,valor,data_vencimento,status")
          .eq("family_id", fid).eq("status", "pendente")
          .gte("data_vencimento", isoToday.slice(0, 8) + "01")
          .lte("data_vencimento", iso7)
          .order("data_vencimento", { ascending: true }),
      ]);

      if (s.data && Array.isArray(s.data) && s.data[0]) setSummary(s.data[0] as DashSummary);
      if (c.data) setCats(c.data as CatProj[]);
      if (sa.data && Array.isArray(sa.data) && sa.data[0]) setSaldo(sa.data[0] as SaldoTotal);
      if (al.data) setAlerts(al.data as AlertRow[]);
      if (bl.data) setBills(bl.data as BillRow[]);
      setLoading(false);
    })();
  }, [user]);

  const markAlertRead = async (id: string) => {
    const { error } = await supabase.from("alerts").update({ lido: true }).eq("id", id);
    if (error) return toast.error("Erro ao marcar alerta");
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const acoesSugeridas = useMemo(() => {
    const acoes: { tipo: "warn" | "danger" | "info"; texto: string }[] = [];
    if (summary?.saldo_projetado != null && summary.saldo_projetado < 0) {
      acoes.push({ tipo: "danger", texto: `Atenção: projeção de saldo negativa (${fmtBRL(summary.saldo_projetado)}) ao fim do mês` });
    }
    cats.filter((c) => c.status_proj === "vai_estourar").forEach((c) => {
      const excesso = c.valor_projetado - c.valor_planejado;
      acoes.push({ tipo: "warn", texto: `${c.icone} ${c.nome}: reduza ~${fmtBRL(excesso)} para fechar dentro do orçamento` });
    });
    bills.forEach((b) => {
      const dias = Math.floor((new Date(b.data_vencimento).getTime() - Date.now()) / 86400000);
      if (dias < 0) acoes.push({ tipo: "danger", texto: `${b.descricao} venceu há ${Math.abs(dias)} dia(s) — pague ${fmtBRL(b.valor)}` });
      else if (dias <= 1) acoes.push({ tipo: "warn", texto: `${b.descricao} vence ${dias === 0 ? "hoje" : "amanhã"} — pague ${fmtBRL(b.valor)}` });
    });
    return acoes;
  }, [summary, cats, bills]);

  if (authLoading || loading) return <SkeletonSituacao />;

  if (!familyId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6">
        <p className="text-muted-foreground">Família não encontrada.</p>
        <Link to="/dashboard"><Button>Voltar ao painel</Button></Link>
      </div>
    );
  }

  const pctMes = summary ? (summary.dia_atual / summary.dias_mes) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link to="/dashboard"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Painel</Button></Link>
            <h1 className="text-xl font-semibold tracking-tight">📈 Situação atual</h1>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* 1. Score + crise */}
        {summary?.modo_crise && (
          <div className="rounded-lg border border-destructive bg-destructive/10 text-destructive px-4 py-3 font-semibold animate-pulse">
            ⚠️ MODO CRISE ATIVO {summary.estagio_crise ? `— Estágio ${summary.estagio_crise}` : ""}
          </div>
        )}

        <Card>
          <CardHeader><CardTitle>Saúde financeira</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-6 items-center">
            {summary && <ScoreGauge score={summary.score} label={summary.score_label} />}
            <div className="md:col-span-2 space-y-3">
              <div>
                <div className="flex justify-between text-sm text-muted-foreground mb-1">
                  <span>Progresso do mês</span>
                  <span>Dia {summary?.dia_atual} de {summary?.dias_mes}</span>
                </div>
                <Progress value={pctMes} />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Stat label="Renda" value={fmtBRL(summary?.renda_mensal ?? 0)} />
                <Stat label="Gasto" value={fmtBRL((summary?.total_essenciais ?? 0) + (summary?.total_dividas ?? 0) + (summary?.total_estilo_vida ?? 0))} />
                <Stat label="Saldo total" value={fmtBRL(saldo?.saldo_total ?? 0)} />
                <Stat label="Projeção fim do mês" value={fmtBRL(summary?.saldo_projetado ?? 0)} highlight={(summary?.saldo_projetado ?? 0) < 0} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Categorias */}
        <Card>
          <CardHeader><CardTitle>Por categoria</CardTitle></CardHeader>
          <CardContent>
            {cats.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados de categorias para este mês.</p>
            ) : (
              <ul className="space-y-3">
                {cats.map((c) => {
                  const pct = c.valor_planejado > 0 ? Math.min(100, (c.valor_gasto / c.valor_planejado) * 100) : 0;
                  const badge =
                    c.status_proj === "vai_estourar" ? { txt: "🔴 Vai estourar", cls: "bg-destructive/15 text-destructive" } :
                    c.status_proj === "atencao" ? { txt: "⚠️ Atenção", cls: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" } :
                    c.status_proj === "ok" ? { txt: "✅ OK", cls: "bg-green-500/15 text-green-700 dark:text-green-400" } :
                    { txt: "Sem orçamento", cls: "bg-muted text-muted-foreground" };
                  return (
                    <li key={c.category_id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{c.icone} {c.nome}</span>
                        <span className="text-muted-foreground">
                          {fmtBRL(c.valor_gasto)} / {fmtBRL(c.valor_planejado)}
                        </span>
                      </div>
                      <Progress value={pct} />
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Projeção: {fmtBRL(c.valor_projetado)}</span>
                        <span className={`px-2 py-0.5 rounded ${badge.cls}`}>{badge.txt}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 4. Tabela 50/30/20 */}
        <Card>
          <CardHeader><CardTitle>Regra 50/30/20</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2">Categoria</th>
                  <th className="py-2">Meta</th>
                  <th className="py-2">Hoje</th>
                  <th className="py-2">% da meta</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <Row50 label="Essenciais (50%)" meta={summary?.meta_essenciais ?? 0} hoje={summary?.total_essenciais ?? 0} />
                <Row50 label="Estilo de vida (30%)" meta={summary?.meta_estilo_vida ?? 0} hoje={summary?.total_estilo_vida ?? 0} />
                <Row50 label="Reserva (20%)" meta={summary?.meta_reserva ?? 0} hoje={(summary?.renda_mensal ?? 0) - (summary?.total_essenciais ?? 0) - (summary?.total_dividas ?? 0) - (summary?.total_estilo_vida ?? 0)} />
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* 5. Alertas */}
        <Card>
          <CardHeader><CardTitle>Alertas não lidos</CardTitle></CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem alertas pendentes. ✅</p>
            ) : (
              <ul className="space-y-2">
                {alerts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 rounded border p-3">
                    <span className="text-sm">{a.mensagem}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={a.severidade === "critical" ? "destructive" : "secondary"}>{a.severidade}</Badge>
                      <Button size="sm" variant="ghost" onClick={() => markAlertRead(a.id)}>✓</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 6. Contas a pagar */}
        <Card>
          <CardHeader><CardTitle>Contas a pagar — próximos 7 dias</CardTitle></CardHeader>
          <CardContent>
            {bills.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma conta nos próximos 7 dias.</p>
            ) : (
              <ul className="space-y-2">
                {bills.map((b) => {
                  const dias = Math.floor((new Date(b.data_vencimento).getTime() - Date.now()) / 86400000);
                  const badge = dias < 0 ? { t: "Vencido", c: "destructive" as const } :
                    dias === 0 ? { t: "Hoje", c: "destructive" as const } :
                    { t: `Em ${dias}d`, c: "secondary" as const };
                  return (
                    <li key={b.id} className="flex items-center justify-between rounded border p-3">
                      <div>
                        <p className="font-medium text-sm">{b.descricao}</p>
                        <p className="text-xs text-muted-foreground">Vence {new Date(b.data_vencimento).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-sm">{fmtBRL(b.valor)}</span>
                        <Badge variant={badge.c}>{badge.t}</Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 7. Ações sugeridas */}
        <Card>
          <CardHeader><CardTitle>Ações sugeridas</CardTitle></CardHeader>
          <CardContent>
            {acoesSugeridas.length === 0 ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" /> Tudo no rumo. Nada urgente agora.
              </p>
            ) : (
              <ul className="space-y-2">
                {acoesSugeridas.map((a, i) => (
                  <li key={i} className={`rounded border p-3 text-sm flex items-start gap-2 ${
                    a.tipo === "danger" ? "border-destructive/40 bg-destructive/5" :
                    a.tipo === "warn" ? "border-yellow-500/40 bg-yellow-500/5" : ""
                  }`}>
                    <AlertTriangle className={`h-4 w-4 mt-0.5 ${a.tipo === "danger" ? "text-destructive" : "text-yellow-600"}`} />
                    <span>{a.texto}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-semibold ${highlight ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}

function Row50({ label, meta, hoje }: { label: string; meta: number; hoje: number }) {
  const pct = meta > 0 ? Math.round((hoje / meta) * 100) : 0;
  return (
    <tr>
      <td className="py-2 font-medium">{label}</td>
      <td className="py-2">{fmtBRL(meta)}</td>
      <td className="py-2">{fmtBRL(hoje)}</td>
      <td className="py-2">{pct}%</td>
    </tr>
  );
}
