import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFamily } from "@/hooks/use-family";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Printer, Loader2 } from "lucide-react";
import { SkeletonPage } from "@/components/skeletons";

export const Route = createFileRoute("/relatorios" as any)({
  head: () => ({ meta: [{ title: "Relatórios — Casinha Hub" }] }),
  component: RelatoriosPage,
});

type Account = { id: string; nome: string; tipo: string };
type Transaction = {
  id: string; date: string; description: string; amount: number;
  type: string; category: string | null; tipo_especial: string | null;
};

const fmtBRL = (n: number) => (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (iso: string) => new Date(iso + "T12:00").toLocaleDateString("pt-BR");

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

function RelatoriosPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { familyId, familyName, loading: familyLoading } = useFamily();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("todas");
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!authLoading && !user) navigate({ to: "/auth" }); }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!familyId) return;
    supabase.from("accounts").select("id, nome, tipo").eq("family_id", familyId).eq("ativo", true).order("nome")
      .then(({ data }) => setAccounts((data ?? []) as Account[]));
  }, [familyId]);

  const buscar = async () => {
    if (!familyId) return;
    setLoading(true);
    const inicio = mes + "-01";
    const fim = new Date(new Date(inicio).getFullYear(), new Date(inicio).getMonth() + 1, 0).toISOString().slice(0, 10);
    let q = supabase.from("transactions")
      .select("id, date, description, amount, type, category, tipo_especial")
      .eq("family_id", familyId)
      .gte("date", inicio).lte("date", fim)
      .order("date", { ascending: true });
    if (accountId !== "todas") q = q.eq("account_id", accountId);
    const { data } = await q;
    setTransactions(((data ?? []).map((t: any) => ({ ...t, amount: Number(t.amount) }))) as Transaction[]);
    setLoading(false);
  };

  const handlePrint = () => {
    const printContent = printRef.current?.innerHTML;
    if (!printContent) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>Extrato — ${mesLabel} — ${contaNome}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; color: #000; }
        h1 { font-size: 16px; margin-bottom: 4px; }
        h2 { font-size: 13px; color: #555; margin-bottom: 16px; font-weight: normal; }
        table { width: 100%; border-collapse: collapse; }
        th { border-bottom: 2px solid #000; text-align: left; padding: 4px 6px; font-size: 11px; }
        td { border-bottom: 1px solid #ddd; padding: 4px 6px; }
        .right { text-align: right; }
        .receita { color: #166534; }
        .despesa { color: #991b1b; }
        .total { font-weight: bold; border-top: 2px solid #000; }
        @media print { body { margin: 10px; } }
      </style>
      </head><body>${printContent}</body></html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 300);
  };

  const mesLabel = getMonthOptions().find(o => o.value === mes)?.label ?? mes;
  const contaNome = accountId === "todas" ? "Todas as contas" : accounts.find(a => a.id === accountId)?.nome ?? "";

  const receitas = transactions.filter(t => t.type === "income" && t.tipo_especial !== "transferencia");
  const despesas = transactions.filter(t => t.type === "expense" && t.tipo_especial !== "transferencia");
  const totalReceitas = receitas.reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalDespesas = despesas.reduce((s, t) => s + Math.abs(t.amount), 0);

  if (authLoading || familyLoading) return <SkeletonPage />;

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <header className="border-b border-border/60 bg-card/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link to="/dashboard"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Painel</Button></Link>
            <h1 className="text-lg font-semibold">Relatórios</h1>
          </div>
          {transactions.length > 0 && (
            <Button onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" /> Imprimir PDF
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-4">
        {/* Filtros */}
        <Card className="border-border/60">
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[160px]">
                <p className="text-xs text-muted-foreground mb-1">Mês</p>
                <Select value={mes} onValueChange={setMes}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{getMonthOptions().map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[160px]">
                <p className="text-xs text-muted-foreground mb-1">Conta</p>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as contas</SelectItem>
                    {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={buscar} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Relatório */}
        {transactions.length > 0 && (
          <Card className="border-border/60">
            <CardContent className="py-4">
              <div ref={printRef}>
                <h1>Extrato — {mesLabel}</h1>
                <h2>{familyName} · {contaNome}</h2>

                {/* Resumo */}
                <table style={{ marginBottom: 16 }}>
                  <tbody>
                    <tr><td><strong>Receitas</strong></td><td className="right receita"><strong>{fmtBRL(totalReceitas)}</strong></td></tr>
                    <tr><td><strong>Despesas</strong></td><td className="right despesa"><strong>{fmtBRL(totalDespesas)}</strong></td></tr>
                    <tr className="total"><td><strong>Saldo</strong></td><td className="right"><strong>{fmtBRL(totalReceitas - totalDespesas)}</strong></td></tr>
                  </tbody>
                </table>

                {/* Transações */}
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Descrição</th>
                      <th>Categoria</th>
                      <th className="right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions
                      .filter(t => t.tipo_especial !== "transferencia")
                      .map(t => (
                        <tr key={t.id}>
                          <td style={{ whiteSpace: "nowrap" }}>{fmtDate(t.date)}</td>
                          <td>{t.description}</td>
                          <td style={{ color: "#666" }}>{t.category ?? "—"}</td>
                          <td className={`right ${t.type === "income" ? "receita" : "despesa"}`}>
                            {t.type === "income" ? "+" : ""}{fmtBRL(Math.abs(t.amount))}
                          </td>
                        </tr>
                      ))}
                    <tr className="total">
                      <td colSpan={3}><strong>Saldo do período</strong></td>
                      <td className="right"><strong>{fmtBRL(totalReceitas - totalDespesas)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {transactions.length === 0 && !loading && (
          <Card className="border-border/60">
            <CardContent className="py-10 text-center text-muted-foreground">
              Selecione o mês e a conta e clique em <strong>Buscar</strong>.
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
