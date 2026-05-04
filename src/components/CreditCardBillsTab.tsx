import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";

const fmt = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Bill {
  id: string;
  account_id: string;
  mes_referencia: string;
  data_vencimento: string | null;
  valor_total: number;
  valor_pago: number;
  status: "aberta" | "fechada" | "paga" | "atrasada";
}

interface CardAccount {
  id: string;
  nome: string;
  cor: string;
  icone: string;
  limite_credito: number | null;
  saldo_atual: number;
  dia_fechamento: number | null;
  dia_vencimento: number | null;
}

interface DebitAccount {
  id: string;
  nome: string;
  icone: string;
  saldo_atual: number;
}

const STATUS_BADGE: Record<Bill["status"], { label: string; className: string }> = {
  paga: { label: "🟢 Paga", className: "bg-green-500/15 text-green-700 dark:text-green-400" },
  aberta: { label: "🟡 Aberta", className: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" },
  fechada: { label: "🔴 Fechada", className: "bg-red-500/15 text-red-700 dark:text-red-400" },
  atrasada: { label: "⚫ Atrasada", className: "bg-zinc-700/30 text-foreground" },
};

function effectiveStatus(bill: Bill): Bill["status"] {
  if (bill.status === "paga") return "paga";
  if (bill.data_vencimento) {
    const due = new Date(bill.data_vencimento);
    if (due < new Date(new Date().toDateString())) return "atrasada";
  }
  return bill.status;
}

export function CreditCardBillsTab({ familyId }: { familyId: string }) {
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<CardAccount[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [debitAccounts, setDebitAccounts] = useState<DebitAccount[]>([]);
  const [payingBill, setPayingBill] = useState<Bill | null>(null);
  const [paying, setPaying] = useState(false);
  const [payAccount, setPayAccount] = useState<string>("");
  const [payAmount, setPayAmount] = useState<string>("");

  const load = async () => {
    setLoading(true);
    // Dispara alertas de fatura
    await supabase.rpc("check_credit_card_bill_alerts", { _family_id: familyId });

    const [{ data: accs }, { data: allBills }] = await Promise.all([
      supabase
        .from("accounts")
        .select("*")
        .eq("family_id", familyId)
        .eq("ativo", true)
        .order("created_at", { ascending: true }),
      supabase
        .from("credit_card_bills")
        .select("*")
        .eq("family_id", familyId)
        .order("mes_referencia", { ascending: false }),
    ]);

    const accounts = (accs ?? []) as Array<CardAccount & { tipo: string }>;
    setCards(accounts.filter((a) => a.tipo === "cartao"));
    setDebitAccounts(
      accounts
        .filter((a) => a.tipo !== "cartao")
        .map((a) => ({ id: a.id, nome: a.nome, icone: a.icone, saldo_atual: a.saldo_atual })),
    );
    setBills((allBills ?? []) as Bill[]);
    setLoading(false);
  };

  useEffect(() => {
    if (familyId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId]);

  const openPay = (bill: Bill) => {
    setPayingBill(bill);
    setPayAccount("");
    const remaining = Number(bill.valor_total) - Number(bill.valor_pago);
    setPayAmount(remaining.toFixed(2).replace(".", ","));
  };

  const handlePay = async () => {
    if (!payingBill) return;
    const amt = Number(payAmount.replace(/\./g, "").replace(",", "."));
    if (!payAccount) {
      toast.error("Selecione a conta de débito");
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Valor inválido");
      return;
    }
    setPaying(true);
    const { error } = await supabase.rpc("pay_credit_card_bill", {
      _bill_id: payingBill.id,
      _from_account: payAccount,
      _amount: amt,
      _date: new Date().toISOString().slice(0, 10),
    });
    setPaying(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("✅ Fatura paga");
    setPayingBill(null);
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhum cartão de crédito cadastrado.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {cards.map((card) => {
        const cardBills = bills.filter((b) => b.account_id === card.id);
        const used = card.saldo_atual < 0 ? Math.abs(Number(card.saldo_atual)) : 0;
        const limit = Number(card.limite_credito ?? 0);
        const usedPct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
        return (
          <Card key={card.id} style={{ borderLeft: `4px solid ${card.cor}` }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="text-xl">{card.icone}</span>
                {card.nome}
              </CardTitle>
              <CardDescription className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1">
                    <CreditCard className="h-3 w-3" /> Limite usado
                  </span>
                  <span className="tabular-nums">
                    {fmt(used)} / {fmt(limit)}
                  </span>
                </div>
                <Progress value={usedPct} />
              </CardDescription>
            </CardHeader>
            <CardContent>
              {cardBills.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Sem faturas registradas.</p>
              ) : (
                <div className="space-y-2">
                  {cardBills.map((b) => {
                    const st = effectiveStatus(b);
                    const remaining = Number(b.valor_total) - Number(b.valor_pago);
                    return (
                      <div
                        key={b.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">
                              {new Date(b.mes_referencia).toLocaleDateString("pt-BR", {
                                month: "2-digit",
                                year: "numeric",
                              })}
                            </span>
                            <Badge variant="outline" className={STATUS_BADGE[st].className}>
                              {STATUS_BADGE[st].label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Vence:{" "}
                            {b.data_vencimento
                              ? new Date(b.data_vencimento).toLocaleDateString("pt-BR")
                              : "—"}
                            {" · "}Pago: {fmt(Number(b.valor_pago))}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold tabular-nums">{fmt(Number(b.valor_total))}</p>
                          {st !== "paga" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-1 h-7"
                              onClick={() => openPay(b)}
                              disabled={remaining <= 0}
                            >
                              Pagar fatura
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={!!payingBill} onOpenChange={(o) => !o && setPayingBill(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Receipt className="h-4 w-4 inline mr-2" />
              Pagar fatura
            </DialogTitle>
            <DialogDescription>
              {payingBill &&
                `Mês ${new Date(payingBill.mes_referencia).toLocaleDateString("pt-BR", {
                  month: "2-digit",
                  year: "numeric",
                })} · Total ${fmt(Number(payingBill.valor_total))}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Conta de débito</Label>
              <Select value={payAccount} onValueChange={setPayAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {debitAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.icone} {a.nome} · {fmt(Number(a.saldo_atual))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                inputMode="decimal"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handlePay} disabled={paying}>
              {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
