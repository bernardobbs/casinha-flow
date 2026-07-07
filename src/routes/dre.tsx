import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFamily } from "@/hooks/use-family";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/dre")({
  head: () => ({ meta: [{ title: "DRE — Casinha Hub" }] }),
  component: DrePage,
});

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const SALARIO = 10942.85;
const ALUGUEL_REC = 2169.57;
const PARC_FATURA = 2543.37; // termina set/26 (parcela 13/13)
const PARC_FIM = "2026-09"; // último mês com parcelamento

// Categorias de receita
const CAT_REC = ["Receita — Salário","Receita — Aluguel","Receita — Outros","Outras Receitas","Salário / Proventos"];

function DrePage() {
  const { user, loading: authLoading } = useAuth();
  const { familyId } = useFamily();
  const navigate = useNavigate();
  const [dados, setDados] = useState<any[]>([]);
  const [recorrentes, setRecorrentes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesAtual] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [anoAtual] = useState(() => new Date().getFullYear());
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  useEffect(() => { if (!authLoading && !user) navigate({ to: "/auth" }); }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!familyId) return;
    setLoading(true);
    Promise.all([
      supabase
        .from("transactions" as any)
        .select("date, amount, type, categories(nome, tipo)")
        .eq("family_id", familyId)
        .gte("date", `${anoAtual}-01-01`)
        .lte("date", `${anoAtual}-12-31`)
        .order("date"),
      supabase
        .from("recurring_transactions" as any)
        .select("descricao, valor, tipo, dia_do_mes")
        .eq("family_id", familyId)
        .eq("ativo", true),
    ]).then(([{ data: txs }, { data: recs }]) => {
      setDados((txs ?? []) as any[]);
      setRecorrentes((recs ?? []) as any[]);
      setLoading(false);
    });
  }, [familyId, anoAtual]);

  // Agrupar por mês e categoria
  const porMes = useMemo(() => {
    const m: Record<string, { receitas: Record<string, number>; despesas: Record<string, number> }> = {};
    for (let i = 1; i <= 12; i++) {
      const k = `${anoAtual}-${String(i).padStart(2, "0")}`;
      m[k] = { receitas: {}, despesas: {} };
    }
    dados.forEach((t: any) => {
      const mes = t.date.slice(0, 7);
      if (!m[mes]) return;
      const cat = t.categories?.nome ?? "Sem categoria";
      const tipo = t.type;
      if (tipo === "income") {
        m[mes].receitas[cat] = (m[mes].receitas[cat] ?? 0) + Number(t.amount);
      } else {
        m[mes].despesas[cat] = (m[mes].despesas[cat] ?? 0) + Number(t.amount);
      }
    });
    return m;
  }, [dados, anoAtual]);

  // Total recorrentes despesa
  const totalRecorrentesDespesa = useMemo(() =>
    recorrentes.filter(r => r.tipo === "despesa").reduce((s: number, r: any) => s + Number(r.valor), 0),
    [recorrentes]
  );

  const totalRecorrentesReceita = useMemo(() =>
    recorrentes.filter(r => r.tipo === "receita").reduce((s: number, r: any) => s + Number(r.valor), 0),
    [recorrentes]
  );

  // Cálculo por mês
  const resumoMes = useMemo(() => {
    return Object.entries(porMes).map(([mes, { receitas, despesas }]) => {
      const totalRec = Object.values(receitas).reduce((s, v) => s + v, 0);
      const totalDesp = Object.values(despesas).reduce((s, v) => s + v, 0);
      const resultado = totalRec - totalDesp;
      const isFuturo = mes > mesAtual;
      const isAtual = mes === mesAtual;
      return { mes, totalRec, totalDesp, resultado, receitas, despesas, isFuturo, isAtual };
    });
  }, [porMes, mesAtual]);

  // Projeção meses futuros (próximos 12 meses)
  const projecaoFutura = useMemo(() => {
    const meses = [];
    const hoje = new Date();
    for (let i = 0; i < 13; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      const mesStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const temParc = mesStr <= PARC_FIM;
      const receitaProj = SALARIO + ALUGUEL_REC;
      const despFixaProj = totalRecorrentesDespesa;
      const faturaEstimada = 5000 + (temParc ? PARC_FATURA : 0);
      const totalDespProj = despFixaProj + faturaEstimada;
      const resultado = receitaProj - totalDespProj;
      meses.push({
        mes: mesStr,
        label: `${MESES[d.getMonth()]}/${d.getFullYear()}`,
        receitaProj,
        despFixaProj,
        faturaEstimada,
        totalDespProj,
        resultado,
        temParc,
        isAtual: mesStr === mesAtual,
      });
    }
    return meses;
  }, [totalRecorrentesDespesa, mesAtual]);

  const toggle = (k: string) => setExpandidos(prev => {
    const n = new Set(prev);
    n.has(k) ? n.delete(k) : n.add(k);
    return n;
  });

  const ResultBadge = ({ v }: { v: number }) => (
    <span className={`font-bold tabular-nums ${v >= 0 ? "text-emerald-600" : "text-red-500"}`}>
      {v >= 0 ? "+" : ""}{fmt(v)}
    </span>
  );

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/dashboard"><Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />Dashboard</Button></Link>
          <h1 className="text-base font-semibold flex-1">📊 DRE</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        <Tabs defaultValue="mensal">
          <TabsList className="w-full">
            <TabsTrigger value="mensal" className="flex-1 gap-1.5"><TrendingUp className="h-4 w-4" />Mês Atual</TabsTrigger>
            <TabsTrigger value="anual" className="flex-1 gap-1.5"><Calendar className="h-4 w-4" />Anual {anoAtual}</TabsTrigger>
            <TabsTrigger value="futuro" className="flex-1 gap-1.5"><TrendingDown className="h-4 w-4" />Projeção Futura</TabsTrigger>
          </TabsList>

          {/* ══ ABA MÊS ATUAL ══ */}
          <TabsContent value="mensal" className="space-y-3 pt-2">
            {(() => {
              const m = resumoMes.find(r => r.mes === mesAtual);
              if (!m) return null;
              const diasMes = new Date(anoAtual, new Date().getMonth() + 1, 0).getDate();
              const diaAtual = new Date().getDate();
              const pctMes = Math.round((diaAtual / diasMes) * 100);

              // Projeção do mês
              const mediaDesp = m.totalDesp / Math.max(1, diaAtual);
              const projDesp = mediaDesp * diasMes;
              const projRec = m.totalRec > 0 ? m.totalRec : SALARIO + ALUGUEL_REC;
              const projResultado = projRec - projDesp;

              return (
                <>
                  {/* Cards de resumo */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Receitas realizadas", value: m.totalRec, color: "text-emerald-600" },
                      { label: "Despesas realizadas", value: m.totalDesp, color: "text-red-500" },
                      { label: "Resultado parcial", value: m.resultado, color: m.resultado >= 0 ? "text-emerald-600" : "text-red-500" },
                      { label: "Projeção fechamento", value: projResultado, color: projResultado >= 0 ? "text-emerald-600" : "text-red-500" },
                    ].map(item => (
                      <Card key={item.label} className="border-border/60">
                        <CardContent className="py-3 px-4">
                          <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                          <p className={`text-lg font-bold tabular-nums ${item.color}`}>{fmt(item.value)}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Barra de progresso do mês */}
                  <Card className="border-border/60">
                    <CardContent className="py-3 px-4 space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Progresso do mês</span>
                        <span>Dia {diaAtual} de {diasMes} ({pctMes}%)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pctMes}%` }} />
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Projeção despesas: <span className="font-medium text-foreground">{fmt(projDesp)}</span></span>
                        <span className="text-muted-foreground">Projeção receitas: <span className="font-medium text-emerald-600">{fmt(projRec)}</span></span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Receitas detalhadas */}
                  <Card className="border-border/60">
                    <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors" onClick={() => toggle("rec-atual")}>
                      <span className="font-semibold text-sm text-emerald-600">📈 Receitas</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-emerald-600">{fmt(m.totalRec)}</span>
                        {expandidos.has("rec-atual") ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </button>
                    {expandidos.has("rec-atual") && (
                      <div className="border-t border-border/50 divide-y divide-border/30">
                        {Object.entries(m.receitas).map(([cat, val]) => (
                          <div key={cat} className="flex justify-between px-4 py-2 text-sm">
                            <span className="text-muted-foreground">{cat}</span>
                            <span className="tabular-nums font-medium text-emerald-600">{fmt(val as number)}</span>
                          </div>
                        ))}
                        {/* Receitas projetadas ainda não recebidas */}
                        {m.totalRec < SALARIO && (
                          <div className="flex justify-between px-4 py-2 text-sm bg-emerald-50/50 dark:bg-emerald-950/20">
                            <span className="text-muted-foreground italic">Salário (previsto)</span>
                            <span className="tabular-nums font-medium text-emerald-400">{fmt(SALARIO)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>

                  {/* Despesas detalhadas */}
                  <Card className="border-border/60">
                    <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors" onClick={() => toggle("desp-atual")}>
                      <span className="font-semibold text-sm text-red-500">💸 Despesas por categoria</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-red-500">{fmt(m.totalDesp)}</span>
                        {expandidos.has("desp-atual") ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </button>
                    {expandidos.has("desp-atual") && (
                      <div className="border-t border-border/50">
                        {Object.entries(m.despesas)
                          .sort(([, a], [, b]) => (b as number) - (a as number))
                          .map(([cat, val]) => {
                            const pct = m.totalDesp > 0 ? ((val as number) / m.totalDesp) * 100 : 0;
                            return (
                              <div key={cat} className="px-4 py-2 space-y-1">
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">{cat}</span>
                                  <span className="tabular-nums font-medium">{fmt(val as number)}</span>
                                </div>
                                <div className="h-1 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-red-400 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </Card>
                </>
              );
            })()}
          </TabsContent>

          {/* ══ ABA ANUAL ══ */}
          <TabsContent value="anual" className="space-y-2 pt-2">
            {/* Totais anuais */}
            {(() => {
              const totalRec = resumoMes.reduce((s, m) => s + m.totalRec, 0);
              const totalDesp = resumoMes.reduce((s, m) => s + m.totalDesp, 0);
              return (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <Card className="border-border/60"><CardContent className="py-3 px-3 text-center">
                    <p className="text-xs text-muted-foreground">Receitas {anoAtual}</p>
                    <p className="text-base font-bold text-emerald-600 tabular-nums">{fmt(totalRec)}</p>
                  </CardContent></Card>
                  <Card className="border-border/60"><CardContent className="py-3 px-3 text-center">
                    <p className="text-xs text-muted-foreground">Despesas {anoAtual}</p>
                    <p className="text-base font-bold text-red-500 tabular-nums">{fmt(totalDesp)}</p>
                  </CardContent></Card>
                  <Card className="border-border/60"><CardContent className="py-3 px-3 text-center">
                    <p className="text-xs text-muted-foreground">Resultado</p>
                    <p className={`text-base font-bold tabular-nums ${totalRec - totalDesp >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmt(totalRec - totalDesp)}</p>
                  </CardContent></Card>
                </div>
              );
            })()}

            {/* Tabela mês a mês */}
            <Card className="border-border/60 overflow-hidden">
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border/50">
                      <th className="text-left px-4 py-2 font-semibold text-xs">Mês</th>
                      <th className="text-right px-3 py-2 font-semibold text-xs text-emerald-600">Receitas</th>
                      <th className="text-right px-3 py-2 font-semibold text-xs text-red-500">Despesas</th>
                      <th className="text-right px-4 py-2 font-semibold text-xs">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumoMes.map(({ mes, totalRec, totalDesp, resultado, isAtual, isFuturo }) => {
                      const idx = parseInt(mes.slice(5, 7)) - 1;
                      return (
                        <tr key={mes} className={`border-b border-border/30 transition-colors ${isAtual ? "bg-primary/5 font-medium" : isFuturo ? "opacity-40" : "hover:bg-muted/30"}`}>
                          <td className="px-4 py-2.5 text-sm flex items-center gap-1">
                            {isAtual && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                            {MESES[idx]}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600 text-xs">
                            {totalRec > 0 ? fmt(totalRec) : isFuturo ? <span className="text-muted-foreground">—</span> : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-red-500 text-xs">
                            {totalDesp > 0 ? fmt(totalDesp) : isFuturo ? <span className="text-muted-foreground">—</span> : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {(totalRec > 0 || totalDesp > 0) && !isFuturo
                              ? <ResultBadge v={resultado} />
                              : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══ ABA PROJEÇÃO FUTURA ══ */}
          <TabsContent value="futuro" className="space-y-3 pt-2">
            <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 border">
              <CardContent className="py-3 px-4 text-sm text-amber-800 dark:text-amber-300 space-y-1">
                <p className="font-semibold">📌 Base da projeção</p>
                <p>Receita fixa: Salário {fmt(SALARIO)} + Aluguel {fmt(ALUGUEL_REC)}</p>
                <p>Despesas fixas: recorrentes cadastrados ({fmt(totalRecorrentesDespesa)}/mês)</p>
                <p>Parcelas fatura: {fmt(PARC_FATURA)}/mês até Set/2026 → zeram em Out/2026 🎉</p>
              </CardContent>
            </Card>

            <div className="space-y-2">
              {projecaoFutura.map(m => (
                <Card key={m.mes} className={`border-border/60 overflow-hidden ${m.isAtual ? "ring-2 ring-primary/30" : ""}`}>
                  <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left" onClick={() => toggle("fut-" + m.mes)}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{m.label}</span>
                        {m.isAtual && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">atual</span>}
                        {!m.temParc && <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">sem parcela</span>}
                      </div>
                      <div className="flex gap-4 mt-0.5 text-xs text-muted-foreground">
                        <span>Receita: {fmt(m.receitaProj)}</span>
                        <span>Despesa: ~{fmt(m.totalDespProj)}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <ResultBadge v={m.resultado} />
                      {expandidos.has("fut-" + m.mes) ? <ChevronUp className="h-3.5 w-3.5 ml-auto mt-1 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto mt-1 text-muted-foreground" />}
                    </div>
                  </button>

                  {expandidos.has("fut-" + m.mes) && (
                    <div className="border-t border-border/50 px-4 py-3 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Salário</span>
                        <span className="text-emerald-600 tabular-nums">{fmt(SALARIO)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Aluguel recebido</span>
                        <span className="text-emerald-600 tabular-nums">{fmt(ALUGUEL_REC)}</span>
                      </div>
                      <div className="border-t border-border/30 my-1" />
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Recorrentes fixos</span>
                        <span className="text-red-500 tabular-nums">−{fmt(m.despFixaProj)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fatura cartão estimada{m.temParc ? " (c/ parcela)" : ""}</span>
                        <span className="text-red-500 tabular-nums">−{fmt(m.faturaEstimada)}</span>
                      </div>
                      {!m.temParc && (
                        <div className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded mt-1">
                          ✅ Parcela de R$ {fmt(PARC_FATURA)} não existe mais — economia de {fmt(PARC_FATURA)}/mês
                        </div>
                      )}
                      <div className="border-t border-border/30 my-1" />
                      <div className="flex justify-between font-semibold">
                        <span>Resultado projetado</span>
                        <ResultBadge v={m.resultado} />
                      </div>
                    </div>
                  )}

                  {/* Barra visual */}
                  <div className="h-1 mx-4 mb-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${m.resultado >= 0 ? "bg-emerald-500" : "bg-red-500"}`}
                      style={{ width: `${Math.min(100, Math.abs(m.resultado) / m.receitaProj * 100)}%` }}
                    />
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
