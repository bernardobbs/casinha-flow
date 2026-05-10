import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFamily } from "@/hooks/use-family";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { SkeletonPage } from "@/components/skeletons";

export const Route = createFileRoute("/revisao-semanal")({
  head: () => ({ meta: [{ title: "Revisão semanal — Casinha Hub" }] }),
  component: RevisaoSemanalPage,
});

type Tx = { id: string; description: string; amount: number; type: "income" | "expense"; category_id: string | null; date: string };
type CatProj = {
  category_id: string; nome: string; icone: string;
  valor_planejado: number; valor_gasto: number; valor_projetado: number; status_proj: string;
};
type BillRow = { id: string; descricao: string; valor: number; data_vencimento: string; status: string; category_id: string | null };
type Acc = { id: string; nome: string };

const fmtBRL = (n: number) => (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const diasAte = (d: string) => Math.floor((new Date(d + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);

function RevisaoSemanalPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { familyId, loading: familyLoading } = useFamily();
  const [loading, setLoading] = useState(true);
  const [txWeek, setTxWeek] = useState<Tx[]>([]);
  const [txPrev, setTxPrev] = useState<Tx[]>([]);
  const [cats, setCats] = useState<CatProj[]>([]);
  const [billsWeek, setBillsWeek] = useState<BillRow[]>([]);
  const [billsNext, setBillsNext] = useState<BillRow[]>([]);
  const [accounts, setAccounts] = useState<Acc[]>([]);
  const [chk, setChk] = useState({ semCat: false, vencidasPagas: false, estourou: false });
  const [payOpen, setPayOpen] = useState<BillRow | null>(null);
  const [payAccount, setPayAccount] = useState("");

  useEffect(() => { if (!authLoading && !user) navigate({ to: "/auth" }); }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: profile } = await supabase.from("profiles").select("family_id").eq("id", user.id).maybeSingle();
      const fid = profile?.family_id ?? null;
      setFamilyId(fid);
      if (!fid) { setLoading(false); return; }

      const today = new Date();
      const start7 = new Date(today); start7.setDate(start7.getDate() - 7);
      const start14 = new Date(today); start14.setDate(start14.getDate() - 14);
      const in7 = new Date(today); in7.setDate(in7.getDate() + 7);

      const iso = (d: Date) => d.toISOString().slice(0, 10);

      const [w, p, c, bw, bn, a] = await Promise.all([
        supabase.from("transactions")
          .select("id, description, amount, type, category_id, date")
          .eq("family_id", fid).gte("date", iso(start7)).lte("date", iso(today))
          .eq("tipo_especial", "normal"),
        supabase.from("transactions")
          .select("id, description, amount, type, category_id, date")
          .eq("family_id", fid).gte("date", iso(start14)).lt("date", iso(start7))
          .eq("tipo_especial", "normal"),
        supabase.rpc("get_projecao_categorias", { p_family_id: fid }),
        supabase.from("bills_reminders")
          .select("id, descricao, valor, data_vencimento, status, category_id")
          .eq("family_id", fid).gte("data_vencimento", iso(start7)).lte("data_vencimento", iso(today)),
        supabase.from("bills_reminders")
          .select("id, descricao, valor, data_vencimento, status, category_id")
          .eq("family_id", fid).neq("status", "pago")
          .gt("data_vencimento", iso(today)).lte("data_vencimento", iso(in7))
          .order("data_vencimento", { ascending: true }),
        supabase.from("accounts").select("id, nome").eq("family_id", fid).eq("ativo", true).order("nome"),
      ]);

      setTxWeek((w.data ?? []) as Tx[]);
      setTxPrev((p.data ?? []) as Tx[]);
      setCats((c.data ?? []) as CatProj[]);
      setBillsWeek((bw.data ?? []) as BillRow[]);
      setBillsNext((bn.data ?? []) as BillRow[]);
      setAccounts((a.data ?? []) as Acc[]);
      setLoading(false);
    })();
  }, [user]);

  const totalSemana = txWeek.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const totalSemAnt = txPrev.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const delta = totalSemana - totalSemAnt;

  const top3 = useMemo(() => {
    const map = new Map<string, number>();
    txWeek.filter((t) => t.type === "expense" && t.category_id).forEach((t) => {
      map.set(t.category_id!, (map.get(t.category_id!) ?? 0) + Number(t.amount));
    });
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    return sorted.map(([cid, total]) => {
      const c = cats.find((x) => x.category_id === cid);
      return { nome: c?.nome ?? "—", icone: c?.icone ?? "📦", total };
    });
  }, [txWeek, cats]);

  const semCategoria = txWeek.filter((t) => t.type === "expense" && !t.category_id);

  const fechar = async () => {
    if (!familyId || !user) return;
    const { error } = await supabase.from("weekly_reviews").insert({
      family_id: familyId, user_id: user.id, checklist: chk,
    });
    if (error) return toast.error(error.message);
    localStorage.setItem("casinha:last-review", new Date().toISOString());
    toast.success("✅ Revisão fechada");
    navigate({ to: "/dashboard" });
  };

  const pagar = async () => {
    if (!payOpen || !familyId || !user || !payAccount) return toast.error("Selecione a conta");
    const { error: txErr } = await supabase.from("transactions").insert({
      family_id: familyId, user_id: user.id, account_id: payAccount,
      category_id: payOpen.category_id, type: "expense",
      amount: payOpen.valor, description: payOpen.descricao,
      date: new Date().toISOString().slice(0, 10),
      source: "manual", tipo_especial: "normal",
    });
    if (txErr) return toast.error(txErr.message);
    await supabase.from("bills_reminders").update({ status: "pago" }).eq("id", payOpen.id);
    await supabase.rpc("recalc_account_balance", { _account_id: payAccount });
    toast.success("Pago");
    setBillsWeek((p) => p.map((b) => b.id === payOpen.id ? { ...b, status: "pago" } : b));
    setBillsNext((p) => p.filter((b) => b.id !== payOpen.id));
    setPayOpen(null); setPayAccount("");
  };

  if (authLoading || familyLoading || loading) return <SkeletonPage />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container max-w-5xl mx-auto px-4 py-4 flex items-center gap-2">
          <Link to="/dashboard"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Painel</Button></Link>
          <h1 className="text-xl font-semibold">📋 Revisão semanal</h1>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-6 space-y-6">
        <Tabs defaultValue="financeiro">
          <TabsList>
            <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
            <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
          </TabsList>

          <TabsContent value="financeiro" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Gasto na semana</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold">{fmtBRL(totalSemana)}</span>
                  <span className={`text-sm flex items-center gap-1 ${delta > 0 ? "text-destructive" : "text-green-600"}`}>
                    {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {fmtBRL(Math.abs(delta))} vs semana anterior
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Anterior: {fmtBRL(totalSemAnt)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Top 3 categorias</CardTitle></CardHeader>
              <CardContent>
                {top3.length === 0 ? <p className="text-sm text-muted-foreground">Sem gastos categorizados.</p> : (
                  <ul className="space-y-2">
                    {top3.map((c, i) => (
                      <li key={i} className="flex justify-between text-sm">
                        <span>{c.icone} {c.nome}</span>
                        <span className="font-medium">{fmtBRL(c.total)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Sem categoria <Badge variant="secondary" className="ml-2">{semCategoria.length}</Badge></CardTitle></CardHeader>
              <CardContent>
                {semCategoria.length === 0 ? <p className="text-sm text-muted-foreground">Tudo categorizado ✅</p> : (
                  <ul className="space-y-2">
                    {semCategoria.map((t) => (
                      <li key={t.id} className="flex items-center justify-between text-sm border-b pb-2">
                        <span className="truncate">{t.description}</span>
                        <div className="flex items-center gap-2">
                          <span>{fmtBRL(Number(t.amount))}</span>
                          <Link to="/transactions"><Badge variant="outline" className="cursor-pointer">Categorizar</Badge></Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Projeção por categoria</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground border-b">
                    <tr><th className="py-2">Categoria</th><th>Gasto mês</th><th>Projeção</th><th>Status</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {cats.map((c) => {
                      const badge = c.status_proj === "vai_estourar" ? { t: "🔴 vai estourar", v: "destructive" as const }
                        : c.status_proj === "atencao" ? { t: "⚠️ risco", v: "secondary" as const }
                        : c.status_proj === "ok" ? { t: "✅ ok", v: "secondary" as const }
                        : { t: "—", v: "outline" as const };
                      return (
                        <tr key={c.category_id}>
                          <td className="py-2">{c.icone} {c.nome}</td>
                          <td>{fmtBRL(c.valor_gasto)}</td>
                          <td>{fmtBRL(c.valor_projetado)}</td>
                          <td><Badge variant={badge.v}>{badge.t}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pagamentos" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Vencidas na semana</CardTitle></CardHeader>
              <CardContent>
                {billsWeek.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma.</p> : (
                  <ul className="divide-y">
                    {billsWeek.map((b) => (
                      <li key={b.id} className="py-2 flex items-center justify-between text-sm">
                        <span>{b.descricao}</span>
                        <div className="flex items-center gap-2">
                          <span>{fmtBRL(Number(b.valor))}</span>
                          {b.status === "pago" ? <Badge variant="secondary">✅ pago</Badge> : (
                            <Button size="sm" variant="outline" onClick={() => setPayOpen(b)}>Pagar</Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Próximos 7 dias</CardTitle></CardHeader>
              <CardContent>
                {billsNext.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma.</p> : (
                  <ul className="divide-y">
                    {billsNext.map((b) => {
                      const d = diasAte(b.data_vencimento);
                      return (
                        <li key={b.id} className="py-2 flex items-center justify-between text-sm">
                          <div>
                            <p>{b.descricao}</p>
                            <p className="text-xs text-muted-foreground">Em {d}d · {new Date(b.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span>{fmtBRL(Number(b.valor))}</span>
                            <Button size="sm" onClick={() => setPayOpen(b)}>Pagar</Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card>
          <CardHeader><CardTitle>Checklist de fechamento</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox checked={chk.semCat} onCheckedChange={(v) => setChk((p) => ({ ...p, semCat: !!v }))} />
              <span className="text-sm">Transações sem categoria classificadas?</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox checked={chk.vencidasPagas} onCheckedChange={(v) => setChk((p) => ({ ...p, vencidasPagas: !!v }))} />
              <span className="text-sm">Contas vencidas pagas?</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox checked={chk.estourou} onCheckedChange={(v) => setChk((p) => ({ ...p, estourou: !!v }))} />
              <span className="text-sm">Alguma categoria estourou?</span>
            </label>
            <Button className="w-full mt-2" onClick={fechar}>Fechar revisão</Button>
          </CardContent>
        </Card>
      </main>

      <Dialog open={!!payOpen} onOpenChange={(v) => { if (!v) { setPayOpen(null); setPayAccount(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pagar conta</DialogTitle></DialogHeader>
          {payOpen && (
            <div className="space-y-3">
              <p className="text-sm">{payOpen.descricao} · <strong>{fmtBRL(Number(payOpen.valor))}</strong></p>
              <div>
                <Label>Conta</Label>
                <Select value={payAccount || undefined} onValueChange={setPayAccount}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{accounts.map((a) => (<SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={pagar}>Confirmar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
