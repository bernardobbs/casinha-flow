import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFamily } from "@/hooks/use-family";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Plus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { SkeletonContasAPagar } from "@/components/skeletons";
import { fmtBRL } from '@/lib/format';

export const Route = createFileRoute("/contas-a-pagar")({
  head: () => ({ meta: [{ title: "Contas a pagar — Casinha Hub" }] }),
  component: ContasAPagarPage,
});

type BillRow = {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  status: string;
  account_id: string | null;
  account_nome: string | null;
  category_id: string | null;
  origem: "lembrete" | "fatura_cartao" | "parcela";
  tipo: string;
};
type Acc = { id: string; nome: string };

const diasAte = (d: string) => Math.floor((new Date(d + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);

function ContasAPagarPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { familyId, loading: familyLoading } = useFamily();
  const [rows, setRows] = useState<BillRow[]>([]);
  const [accounts, setAccounts] = useState<Acc[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<BillRow | null>(null);

  // form novo
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));

  // form pagar
  const [payAccount, setPayAccount] = useState<string>("");

  useEffect(() => { if (!authLoading && !user) navigate({ to: "/auth" }); }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const fid = familyId ?? null;
      setFamilyId(fid);
      if (!fid) { setLoading(false); return; }
      try { await supabase.rpc("check_bills_alerts", { p_family_id: fid }); } catch { /* */ }

      const [b, a] = await Promise.all([
        supabase.rpc("get_previsao_mes", { p_family_id: fid }),
        supabase.from("accounts").select("id, nome").eq("family_id", fid).eq("ativo", true).order("nome"),
      ]);
      setRows(((b.data ?? []) as BillRow[]));
      setAccounts((a.data ?? []) as Acc[]);
      setLoading(false);
    })();
  }, [user]);

  const reload = async () => {
    if (!familyId) return;
    const { data } = await supabase.rpc("get_previsao_mes", { p_family_id: familyId });
    setRows((data ?? []) as BillRow[]);
  };

  const grupos = useMemo(() => {
    const atrasadas: BillRow[] = [];
    const hoje: BillRow[] = [];
    const proximos: BillRow[] = [];
    const futuras: BillRow[] = [];
    rows.forEach((r) => {
      const d = diasAte(r.data_vencimento);
      if (d < 0 || r.status === "atrasado") atrasadas.push(r);
      else if (d === 0) hoje.push(r);
      else if (d <= 7) proximos.push(r);
      else futuras.push(r);
    });
    return { atrasadas, hoje, proximos, futuras };
  }, [rows]);

  const totaisPorOrigem = useMemo(() => ({
    faturas: rows.filter(r => r.origem === "fatura_cartao").reduce((s, r) => s + Number(r.valor), 0),
    recorrentes: rows.filter(r => r.origem === "lembrete").reduce((s, r) => s + Number(r.valor), 0),
    parcelas: rows.filter(r => r.origem === "parcela").reduce((s, r) => s + Number(r.valor), 0),
  }), [rows]);

  const totalPendente = rows
    .filter((r) => new Date(r.data_vencimento).getMonth() === new Date().getMonth() && new Date(r.data_vencimento).getFullYear() === new Date().getFullYear())
    .reduce((acc, r) => acc + Number(r.valor), 0);

  const submitNovo = async () => {
    if (!familyId || !user) return;
    const v = Number(valor.replace(",", "."));
    if (!descricao || !v || v <= 0) return toast.error("Preencha descrição e valor");
    const { error } = await supabase.from("bills_reminders").insert({
      family_id: familyId, user_id: user.id, descricao, valor: v, data_vencimento: data, status: "pendente",
    });
    if (error) return toast.error(error.message);
    toast.success("Lembrete criado");
    setOpen(false); setDescricao(""); setValor("");
    reload();
  };

  const pagar = async () => {
    if (!payOpen || !familyId || !user) return;
    if (!payAccount) return toast.error("Selecione a conta");

    try {
      // 1. Criar transação de saída
      const { error: txErr } = await supabase.from("transactions").insert({
        family_id: familyId,
        user_id: user.id,
        account_id: payAccount,
        category_id: payOpen.category_id,
        type: "expense",
        amount: payOpen.valor,
        description: payOpen.descricao,
        date: new Date().toISOString().slice(0, 10),
        source: "manual",
        tipo_especial: "normal",
        conciliado: true,
      });
      if (txErr) return toast.error(txErr.message);

      // 2. Marcar como pago conforme a origem
      if (payOpen.origem === "lembrete") {
        await supabase.from("bills_reminders")
          .update({ status: "pago" }).eq("id", payOpen.id);
      } else if (payOpen.origem === "fatura_cartao") {
        await supabase.rpc("pay_credit_card_bill" as any, {
          p_bill_id: payOpen.id,
          p_account_id: payAccount,
          p_family_id: familyId,
          p_user_id: user.id,
        });
      } else if (payOpen.origem === "parcela") {
        await (supabase.from("installments") as any)
          .update({ status: "pago" }).eq("id", payOpen.id);
      }

      // 3. Recalcular saldo da conta
      await supabase.rpc("recalc_account_balance", { _account_id: payAccount });

      toast.success("✅ Pago com sucesso!");
    } catch (e) {
      toast.error("Erro ao registrar pagamento");
    }

    setPayOpen(null);
    setPayAccount("");
    reload();
  };

  if (authLoading || familyLoading || loading) return <SkeletonContasAPagar />;

  const Section = ({ titulo, items, urgencia }: { titulo: string; items: BillRow[]; urgencia: "danger" | "warn" | "info" | "muted" }) => {
    if (items.length === 0) return null;
    const cls = urgencia === "danger" ? "border-destructive/40 bg-destructive/5"
      : urgencia === "warn" ? "border-orange-400/40 bg-orange-400/5"
      : urgencia === "info" ? "border-yellow-400/40 bg-yellow-400/5"
      : "";
    return (
      <Card className={cls}>
        <CardHeader><CardTitle className="text-base">{titulo} <Badge variant="secondary" className="ml-2">{items.length}</Badge></CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y">
            {items.map((b) => {
              const d = diasAte(b.data_vencimento);
              const tag = d < 0 ? `Vencido há ${Math.abs(d)}d` : d === 0 ? "Hoje" : `Em ${d}d`;
              return (
                <li key={b.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">
                      {b.origem === "fatura_cartao" ? "💳 " : b.origem === "parcela" ? "📋 " : "🔄 "}
                      {b.descricao}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Vence {new Date(b.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")} · {tag}
                      {b.account_nome ? ` · ${b.account_nome}` : ""}
                    </p>
                  </div>
                  <span className="font-semibold text-sm whitespace-nowrap">{fmtBRL(Number(b.valor))}</span>
                  <Button size="sm" onClick={() => setPayOpen(b)}>Marcar como pago</Button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link to="/dashboard"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Painel</Button></Link>
            <h1 className="text-xl font-semibold">📅 Contas a pagar</h1>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Novo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo lembrete</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Descrição</Label><Input value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Valor</Label><Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" /></div>
                  <div><Label>Vencimento</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
                </div>
              </div>
              <DialogFooter><Button onClick={submitNovo}>Criar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-6 space-y-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Total pendente do mês</span>
              <span className="text-xl font-semibold">{fmtBRL(totalPendente)}</span>
            </div>
            {(totaisPorOrigem.faturas > 0 || totaisPorOrigem.recorrentes > 0 || totaisPorOrigem.parcelas > 0) && (
              <div className="grid grid-cols-3 gap-2 border-t pt-3">
                {totaisPorOrigem.faturas > 0 && (
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">💳 Faturas</p>
                    <p className="text-sm font-medium">{fmtBRL(totaisPorOrigem.faturas)}</p>
                  </div>
                )}
                {totaisPorOrigem.recorrentes > 0 && (
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">🔄 Recorrentes</p>
                    <p className="text-sm font-medium">{fmtBRL(totaisPorOrigem.recorrentes)}</p>
                  </div>
                )}
                {totaisPorOrigem.parcelas > 0 && (
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">📋 Parcelas</p>
                    <p className="text-sm font-medium">{fmtBRL(totaisPorOrigem.parcelas)}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Section titulo="🔴 Atrasadas" items={grupos.atrasadas} urgencia="danger" />
        <Section titulo="🟠 Hoje" items={grupos.hoje} urgencia="warn" />
        <Section titulo="🟡 Próximos 7 dias" items={grupos.proximos} urgencia="info" />
        <Section titulo="⚪ Futuras" items={grupos.futuras} urgencia="muted" />

        {rows.length === 0 && (
          <Card><CardContent className="py-8 text-center text-muted-foreground flex flex-col items-center gap-2">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
            Sem contas pendentes. ✅
          </CardContent></Card>
        )}
      </main>

      <Dialog open={!!payOpen} onOpenChange={(v) => { if (!v) { setPayOpen(null); setPayAccount(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marcar como pago</DialogTitle></DialogHeader>
          {payOpen && (
            <div className="space-y-3">
              <p className="text-sm">{payOpen.descricao} · <strong>{fmtBRL(Number(payOpen.valor))}</strong></p>
              <div>
                <Label>Pagar com qual conta?</Label>
                <Select value={payAccount || undefined} onValueChange={setPayAccount}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{accounts.map((a) => (<SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={pagar}>Confirmar pagamento</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
