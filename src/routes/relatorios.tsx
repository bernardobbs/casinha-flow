import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFamily } from "@/hooks/use-family";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Printer, Loader2, TrendingUp, BarChart3, FileText } from "lucide-react";
import { SkeletonPage } from "@/components/skeletons";

export const Route = createFileRoute("/relatorios" as any)({
  head: () => ({ meta: [{ title: "Relatórios — Casinha Hub" }] }),
  component: RelatoriosPage,
});

type Account = { id: string; nome: string; tipo: string };
type Transaction = { id: string; date: string; description: string; amount: number; type: string; category: string | null; tipo_especial: string | null };
type MesSummary = { mes: string; receita: number; despesa: number; saldo: number };
type BudgetRow = { category_id: string; category_nome: string; category_icone: string; is_essencial: boolean; valor_planejado: number; valor_gasto: number; pct_atingido: number; status_cor: string };

const fmtBRL = (n: number) => Number(n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (iso: string) => new Date(iso + "T12:00").toLocaleDateString("pt-BR");

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
};

function getMonthOptions() {
  const opts = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push({
      value: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    });
  }
  return opts;
}

const PRINT_STYLE = `@media print { .no-print { display: none !important; } }`;

// ─── Mini bar chart sem biblioteca ───────────────────────────────────────────
function BarChart({ data }: { data: MesSummary[] }) {
  const maxVal = Math.max(...data.flatMap(d => [d.receita, d.despesa]), 1);
  return (
    <div className="space-y-1">
      <div className="flex items-end justify-between gap-1 h-40">
        {data.map(d => {
          const mesLabel = MONTH_LABELS[d.mes.slice(5, 7)] ?? d.mes.slice(5, 7);
          const hR = Math.round((d.receita / maxVal) * 100);
          const hD = Math.round((d.despesa / maxVal) * 100);
          return (
            <div key={d.mes} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full flex items-end justify-center gap-0.5 h-32">
                <div className="w-[45%] rounded-t" style={{ height: `${hR}%`, background: "hsl(142 71% 45%)" }} title={`Receita: ${fmtBRL(d.receita)}`} />
                <div className="w-[45%] rounded-t" style={{ height: `${hD}%`, background: "hsl(0 84% 60%)" }} title={`Despesa: ${fmtBRL(d.despesa)}`} />
              </div>
              <span className="text-[10px] text-muted-foreground">{mesLabel}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded inline-block" style={{ background: "hsl(142 71% 45%)" }} />Receita</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded inline-block" style={{ background: "hsl(0 84% 60%)" }} />Despesa</span>
      </div>
    </div>
  );
}

function RelatoriosPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { familyId, familyName, loading: familyLoading } = useFamily();
  const printRef = useRef<HTMLDivElement>(null);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("todas");
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));

  // Aba Extrato
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);

  // Aba Evolução
  const [evolucao, setEvolucao] = useState<MesSummary[]>([]);
  const [loadingEv, setLoadingEv] = useState(false);

  // Aba Orçado x Realizado
  const [budget, setBudget] = useState<BudgetRow[]>([]);
  const [loadingBu, setLoadingBu] = useState(false);

  useEffect(() => { if (!authLoading && !user) navigate({ to: "/auth" }); }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!familyId) return;
    supabase.from("accounts").select("id, nome, tipo").eq("family_id", familyId).eq("ativo", true).order("nome")
      .then(({ data }) => setAccounts((data ?? []) as Account[]));
    carregarEvolucao();
    carregarBudget();
  }, [familyId]);

  const carregarExtrato = async () => {
    if (!familyId) return;
    setLoadingTx(true);
    const inicio = mes + "-01";
    const fim = new Date(new Date(inicio).getFullYear(), new Date(inicio).getMonth() + 1, 0).toISOString().slice(0, 10);
    let q = supabase.from("transactions")
      .select("id, date, description, amount, type, category, tipo_especial")
      .eq("family_id", familyId)
      .gte("date", inicio).lte("date", fim)
      .neq("tipo_especial", "transferencia")
      .order("date", { ascending: true });
    if (accountId !== "todas") q = q.eq("account_id", accountId);
    const { data } = await q;
    setTransactions(((data ?? []).map((t: any) => ({ ...t, amount: Number(t.amount) }))) as Transaction[]);
    setLoadingTx(false);
  };

  const carregarEvolucao = async () => {
    if (!familyId) return;
    setLoadingEv(true);
    const { data } = await supabase.rpc("get_monthly_summary" as any, {
      p_family_id: familyId, p_months: 6,
    });
    if (data) {
      const rows = (data as any[]).map(d => ({
        mes: d.mes,
        receita: Number(d.receita ?? 0),
        despesa: Number(d.despesa ?? 0),
        saldo: Number(d.saldo ?? 0),
      }));
      setEvolucao(rows);
    } else {
      // Fallback: query direta
      const from = new Date(); from.setMonth(from.getMonth() - 5);
      const fromStr = from.toISOString().slice(0, 7) + "-01";
      const { data: txs } = await supabase.from("transactions")
        .select("date, amount, type, tipo_especial")
        .eq("family_id", familyId)
        .gte("date", fromStr)
        .neq("tipo_especial", "transferencia");
      const map: Record<string, MesSummary> = {};
      (txs ?? []).forEach((t: any) => {
        const m = (t.date as string).slice(0, 7);
        if (!map[m]) map[m] = { mes: m, receita: 0, despesa: 0, saldo: 0 };
        const v = Math.abs(Number(t.amount));
        if (t.type === "income") map[m].receita += v;
        else map[m].despesa += v;
      });
      Object.values(map).forEach(r => { r.saldo = r.receita - r.despesa; });
      setEvolucao(Object.values(map).sort((a, b) => a.mes.localeCompare(b.mes)));
    }
    setLoadingEv(false);
  };

  const carregarBudget = async () => {
    if (!familyId) return;
    setLoadingBu(true);
    const { data } = await supabase.rpc("get_budget_status" as any, {
      p_family_id: familyId, p_mes: mes + "-01",
    });
    setBudget((data ?? []) as BudgetRow[]);
    setLoadingBu(false);
  };

  useEffect(() => { if (familyId) carregarBudget(); }, [mes, familyId]);

  const mesLabel = getMonthOptions().find(o => o.value === mes)?.label ?? mes;
  const contaNome = accountId === "todas" ? "Todas as contas" : accounts.find(a => a.id === accountId)?.nome ?? "";
  const receitas = transactions.filter(t => t.type === "income").reduce((s, t) => s + Math.abs(t.amount), 0);
  const despesas = transactions.filter(t => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);

  const totalPlanejado = budget.reduce((s, b) => s + b.valor_planejado, 0);
  const totalGasto = budget.reduce((s, b) => s + b.valor_gasto, 0);

  if (authLoading || familyLoading) return <SkeletonPage />;

  return (
    <>
      <style>{PRINT_STYLE}</style>
      <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
        <header className="border-b border-border/60 bg-card/60 backdrop-blur-sm sticky top-0 z-10 no-print">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link to="/dashboard"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Painel</Button></Link>
              <h1 className="text-lg font-semibold">Relatórios</h1>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-5">
          <Tabs defaultValue="extrato">
            <TabsList className="no-print mb-4 w-full sm:w-auto">
              <TabsTrigger value="extrato" className="gap-1.5"><FileText className="h-4 w-4" />Extrato</TabsTrigger>
              <TabsTrigger value="evolucao" className="gap-1.5"><TrendingUp className="h-4 w-4" />Evolução Mensal</TabsTrigger>
              <TabsTrigger value="orcado" className="gap-1.5"><BarChart3 className="h-4 w-4" />Orçado x Realizado</TabsTrigger>
            </TabsList>

            {/* ── ABA EXTRATO ─────────────────────────── */}
            <TabsContent value="extrato" className="space-y-4">
              <Card className="border-border/60 no-print">
                <CardContent className="py-4">
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[150px]">
                      <p className="text-xs text-muted-foreground mb-1">Mês</p>
                      <Select value={mes} onValueChange={setMes}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{getMonthOptions().map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 min-w-[150px]">
                      <p className="text-xs text-muted-foreground mb-1">Conta</p>
                      <Select value={accountId} onValueChange={setAccountId}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todas">Todas as contas</SelectItem>
                          {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={carregarExtrato} disabled={loadingTx} className="gap-2">
                        {loadingTx ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
                      </Button>
                      {transactions.length > 0 && (
                        <Button variant="outline" onClick={() => window.print()} className="gap-2">
                          <Printer className="h-4 w-4" /> Imprimir
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {transactions.length === 0 && !loadingTx && (
                <Card className="border-border/60">
                  <CardContent className="py-10 text-center text-muted-foreground">Selecione o mês e a conta e clique em <strong>Buscar</strong>.</CardContent>
                </Card>
              )}

              {transactions.length > 0 && (
                <Card className="border-border/60">
                  <CardContent className="py-4">
                    <div ref={printRef}>
                      <div className="mb-4">
                        <h2 className="text-lg font-bold">Extrato — {mesLabel}</h2>
                        <p className="text-sm text-muted-foreground">{familyName} · {contaNome}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3">
                          <p className="text-xs text-muted-foreground">Receitas</p>
                          <p className="font-semibold text-emerald-700 dark:text-emerald-400">{fmtBRL(receitas)}</p>
                        </div>
                        <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3">
                          <p className="text-xs text-muted-foreground">Despesas</p>
                          <p className="font-semibold text-red-700 dark:text-red-400">{fmtBRL(despesas)}</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3">
                          <p className="text-xs text-muted-foreground">Saldo</p>
                          <p className={`font-semibold ${receitas - despesas >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}`}>{fmtBRL(receitas - despesas)}</p>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Data</th>
                              <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Descrição</th>
                              <th className="text-left py-2 pr-3 font-medium text-muted-foreground hidden sm:table-cell">Categoria</th>
                              <th className="text-right py-2 font-medium text-muted-foreground">Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {transactions.map(t => (
                              <tr key={t.id} className="border-b last:border-0">
                                <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(t.date)}</td>
                                <td className="py-2 pr-3 max-w-[200px] truncate">{t.description}</td>
                                <td className="py-2 pr-3 text-muted-foreground text-xs hidden sm:table-cell">{t.category ?? "—"}</td>
                                <td className={`py-2 text-right tabular-nums font-medium ${t.type === "income" ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                                  {t.type === "income" ? "+" : "-"}{fmtBRL(Math.abs(t.amount))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2">
                              <td colSpan={3} className="py-2 font-bold">Saldo do período</td>
                              <td className={`py-2 text-right font-bold tabular-nums ${receitas - despesas >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}`}>{fmtBRL(receitas - despesas)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ── ABA EVOLUÇÃO MENSAL ──────────────────── */}
            <TabsContent value="evolucao" className="space-y-4">
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" /> Evolução dos últimos 6 meses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingEv ? (
                    <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : evolucao.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-8">Sem dados suficientes.</p>
                  ) : (
                    <div className="space-y-6">
                      <BarChart data={evolucao} />
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 font-medium text-muted-foreground">Mês</th>
                              <th className="text-right py-2 font-medium text-muted-foreground">Receita</th>
                              <th className="text-right py-2 font-medium text-muted-foreground">Despesa</th>
                              <th className="text-right py-2 font-medium text-muted-foreground">Saldo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {evolucao.map(d => {
                              const label = new Date(d.mes + "-15").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
                              return (
                                <tr key={d.mes} className="border-b last:border-0">
                                  <td className="py-2 capitalize">{label}</td>
                                  <td className="py-2 text-right text-emerald-700 dark:text-emerald-400 tabular-nums">{fmtBRL(d.receita)}</td>
                                  <td className="py-2 text-right text-red-700 dark:text-red-400 tabular-nums">{fmtBRL(d.despesa)}</td>
                                  <td className={`py-2 text-right font-medium tabular-nums ${d.saldo >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}`}>{fmtBRL(d.saldo)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── ABA ORÇADO x REALIZADO ───────────────── */}
            <TabsContent value="orcado" className="space-y-4">
              <Card className="border-border/60 no-print">
                <CardContent className="py-4">
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[150px]">
                      <p className="text-xs text-muted-foreground mb-1">Mês</p>
                      <Select value={mes} onValueChange={setMes}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{getMonthOptions().map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
                    <span className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />Orçado x Realizado — {mesLabel}</span>
                    <div className="flex gap-4 text-sm font-normal text-muted-foreground">
                      <span>Planejado: <strong className="text-foreground">{fmtBRL(totalPlanejado)}</strong></span>
                      <span>Gasto: <strong className={totalGasto > totalPlanejado ? "text-destructive" : "text-foreground"}>{fmtBRL(totalGasto)}</strong></span>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingBu ? (
                    <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : budget.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-8">Sem orçamento para este mês.</p>
                  ) : (
                    <div className="space-y-3">
                      {budget
                        .filter(b => b.valor_planejado > 0 || b.valor_gasto > 0)
                        .sort((a, b) => b.pct_atingido - a.pct_atingido)
                        .map(b => {
                          const pct = Math.min(100, b.pct_atingido);
                          const barColor = b.status_cor === "red" ? "bg-red-500" : b.status_cor === "yellow" ? "bg-yellow-500" : "bg-emerald-500";
                          return (
                            <div key={b.category_id} className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span className="truncate max-w-[200px]">{b.category_icone} {b.category_nome}</span>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-muted-foreground text-xs">{fmtBRL(b.valor_gasto)} / {fmtBRL(b.valor_planejado)}</span>
                                  <Badge variant={b.status_cor === "red" ? "destructive" : "secondary"} className="text-xs w-12 justify-center">
                                    {b.pct_atingido.toFixed(0)}%
                                  </Badge>
                                </div>
                              </div>
                              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                                <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </>
  );
}
