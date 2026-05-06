import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type AccountType = "corrente" | "poupanca" | "carteira" | "cartao" | "investimento";

export interface AccountFormData {
  id?: string;
  nome: string;
  tipo: AccountType;
  cor: string;
  icone: string;
  banco: string | null;
  bandeira: string | null;
  agencia: string | null;
  numero_conta: string | null;
  digito: string | null;
  saldo_inicial: number;
  saldo_atual?: number;
  limite_credito: number | null;
  limite_cheque_especial: number | null;
  dia_fechamento: number | null;
  dia_vencimento: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  familyId: string;
  account?: Partial<AccountFormData> | null;
  onSaved: () => void;
}

const TYPES: { value: AccountType; label: string; icon: string; defaultColor: string }[] = [
  { value: "corrente", label: "Corrente", icon: "🏦", defaultColor: "#3B82F6" },
  { value: "poupanca", label: "Poupança", icon: "🐷", defaultColor: "#22C55E" },
  { value: "cartao", label: "Cartão", icon: "💳", defaultColor: "#8B5CF6" },
  { value: "carteira", label: "Carteira", icon: "👛", defaultColor: "#F59E0B" },
  { value: "investimento", label: "Investimento", icon: "📈", defaultColor: "#10B981" },
];

const SWATCHES = [
  "#3B82F6", "#22C55E", "#8B5CF6", "#F59E0B",
  "#10B981", "#EF4444", "#EC4899", "#0EA5E9",
];

const BANKS: { value: string; label: string; icon: string }[] = [
  { value: "Nubank", label: "Nubank", icon: "💜" },
  { value: "Inter", label: "Inter", icon: "🟠" },
  { value: "Banco do Brasil", label: "Banco do Brasil", icon: "🏦" },
  { value: "Itaú", label: "Itaú", icon: "🟧" },
  { value: "Santander", label: "Santander", icon: "🔴" },
  { value: "Caixa Econômica Federal", label: "Caixa Econômica Federal", icon: "🟢" },
  { value: "Bradesco", label: "Bradesco", icon: "🔵" },
  { value: "C6 Bank", label: "C6 Bank", icon: "🟡" },
  { value: "BTG Pactual", label: "BTG Pactual", icon: "⚫" },
  { value: "Sicoob", label: "Sicoob", icon: "🟢" },
  { value: "PicPay", label: "PicPay", icon: "💚" },
  { value: "Mercado Pago", label: "Mercado Pago", icon: "🔷" },
  { value: "Visa", label: "Visa (sem banco específico)", icon: "💳" },
  { value: "Mastercard", label: "Mastercard (sem banco específico)", icon: "💳" },
  { value: "Outro", label: "Outro", icon: "🏦" },
];

const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const parseNum = (s: string) => {
  if (!s) return NaN;
  return Number(String(s).replace(/\./g, "").replace(",", "."));
};

const fmtMoney = (v: string) => v.replace(/[^0-9.,]/g, "");

export function AccountFormDialog({ open, onOpenChange, familyId, account, onSaved }: Props) {
  const isEdit = !!account?.id;
  const [saving, setSaving] = useState(false);

  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<AccountType>("corrente");
  const [cor, setCor] = useState("#3B82F6");
  const [banco, setBanco] = useState<string>("");
  const [bancoOutro, setBancoOutro] = useState<string>("");
  const [agencia, setAgencia] = useState("");
  const [numeroConta, setNumeroConta] = useState("");
  const [digito, setDigito] = useState("");
  const [saldoInicial, setSaldoInicial] = useState("");
  const [hasCE, setHasCE] = useState(false);
  const [limiteCE, setLimiteCE] = useState("");
  const [limiteCredito, setLimiteCredito] = useState("");
  const [diaFech, setDiaFech] = useState("");
  const [diaVenc, setDiaVenc] = useState("");

  // Reset when opening
  useEffect(() => {
    if (!open) return;
    if (account) {
      setNome(account.nome ?? "");
      setTipo((account.tipo as AccountType) ?? "corrente");
      setCor(account.cor ?? "#3B82F6");
      const b = account.banco ?? "";
      const isKnown = BANKS.some((x) => x.value === b);
      setBanco(b ? (isKnown ? b : "Outro") : "");
      setBancoOutro(b && !isKnown ? b : "");
      setAgencia(account.agencia ?? "");
      setNumeroConta(account.numero_conta ?? "");
      setDigito(account.digito ?? "");
      setSaldoInicial(
        account.saldo_inicial != null ? String(account.saldo_inicial).replace(".", ",") : "",
      );
      setHasCE(!!account.limite_cheque_especial && Number(account.limite_cheque_especial) > 0);
      setLimiteCE(
        account.limite_cheque_especial
          ? String(account.limite_cheque_especial).replace(".", ",")
          : "",
      );
      setLimiteCredito(
        account.limite_credito ? String(account.limite_credito).replace(".", ",") : "",
      );
      setDiaFech(account.dia_fechamento ? String(account.dia_fechamento) : "");
      setDiaVenc(account.dia_vencimento ? String(account.dia_vencimento) : "");
    } else {
      setNome("");
      setTipo("corrente");
      setCor("#3B82F6");
      setBanco("");
      setBancoOutro("");
      setAgencia("");
      setNumeroConta("");
      setDigito("");
      setSaldoInicial("");
      setHasCE(false);
      setLimiteCE("");
      setLimiteCredito("");
      setDiaFech("");
      setDiaVenc("");
    }
  }, [open, account]);

  // Auto color por tipo (apenas em criação)
  useEffect(() => {
    if (isEdit) return;
    const t = TYPES.find((x) => x.value === tipo);
    if (t) setCor(t.defaultColor);
  }, [tipo, isEdit]);

  const bankIcon = useMemo(() => {
    if (banco === "Outro" || !banco) return "🏦";
    return BANKS.find((b) => b.value === banco)?.icon ?? "🏦";
  }, [banco]);

  const finalIcon = useMemo(() => {
    if (tipo === "carteira") return "👛";
    if (tipo === "investimento") return "📈";
    if (tipo === "cartao") return "💳";
    return bankIcon;
  }, [tipo, bankIcon]);

  const showBanco = tipo === "corrente" || tipo === "poupanca" || tipo === "cartao";
  const showDadosBancarios = tipo === "corrente" || tipo === "poupanca";
  const showCartao = tipo === "cartao";

  const previewCardSubtitle = useMemo(() => {
    if (showDadosBancarios) {
      const ag = agencia ? `Ag. ${agencia}` : "";
      const cc = numeroConta ? `CC ${numeroConta}${digito ? "-" + digito : ""}` : "";
      return [ag, cc].filter(Boolean).join(" | ") || "Sem dados bancários";
    }
    if (showCartao) {
      const lim = parseNum(limiteCredito);
      const limStr = Number.isFinite(lim) && lim > 0
        ? `Limite: ${lim.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
        : "Sem limite";
      const f = diaFech ? `Fecha dia ${diaFech}` : "";
      const v = diaVenc ? `Vence dia ${diaVenc}` : "";
      return [limStr, f, v].filter(Boolean).join(" · ");
    }
    return "";
  }, [showDadosBancarios, showCartao, agencia, numeroConta, digito, limiteCredito, diaFech, diaVenc]);

  const cartaoPreview = useMemo(() => {
    const f = parseInt(diaFech, 10);
    const v = parseInt(diaVenc, 10);
    if (!Number.isFinite(f) || !Number.isFinite(v)) return null;
    const now = new Date();
    const closeMonthIdx = (now.getMonth() + (v <= f ? 1 : 0)) % 12;
    const dueMonthIdx = (closeMonthIdx + 1) % 12;
    return {
      faturaMes: MES[closeMonthIdx],
      vencMes: MES[dueMonthIdx],
      f,
      v,
    };
  }, [diaFech, diaVenc]);

  const handleSave = async () => {
    if (!nome.trim()) {
      toast.error("Informe o nome da conta");
      return;
    }
    const bancoFinal =
      showBanco
        ? banco === "Outro"
          ? bancoOutro.trim() || null
          : banco || null
        : null;

    const saldoNum = parseNum(saldoInicial);
    const limCE = parseNum(limiteCE);
    const limCred = parseNum(limiteCredito);

    if (showCartao && (!Number.isFinite(limCred) || limCred <= 0)) {
      toast.error("Informe o limite do cartão");
      return;
    }

    setSaving(true);
    const payload = {
      family_id: familyId,
      nome: nome.trim(),
      tipo,
      cor,
      icone: finalIcon,
      banco: bancoFinal,
      bandeira: showCartao ? bancoFinal : null,
      agencia: showDadosBancarios ? agencia.trim() || null : null,
      numero_conta: showDadosBancarios ? numeroConta.trim() || null : null,
      digito: showDadosBancarios ? digito.trim() || null : null,
      saldo_inicial: showDadosBancarios && Number.isFinite(saldoNum) ? saldoNum : 0,
      limite_credito: showCartao ? limCred : null,
      limite_cheque_especial:
        showDadosBancarios && hasCE && Number.isFinite(limCE) ? limCE : null,
      dia_fechamento: showCartao && diaFech ? parseInt(diaFech, 10) : null,
      dia_vencimento: showCartao && diaVenc ? parseInt(diaVenc, 10) : null,
    };

    let error;
    if (isEdit && account?.id) {
      ({ error } = await supabase.from("accounts").update(payload).eq("id", account.id));
    } else {
      ({ error } = await supabase
        .from("accounts")
        .insert({ ...payload, saldo_atual: payload.saldo_inicial }));
    }
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(isEdit ? "✅ Conta atualizada" : "✅ Conta salva");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar conta" : "Nova conta"}</DialogTitle>
          <DialogDescription>
            Cadastre os dados da conta para um melhor controle financeiro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* SEÇÃO 1 — IDENTIFICAÇÃO */}
          <section className="space-y-3">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder='Ex: "Nubank", "BB Conta Clara"'
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <div className="grid grid-cols-5 gap-1">
                {TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTipo(t.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-[11px] transition",
                      tipo === t.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/60 text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    <span className="text-base">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCor(c)}
                    className={cn(
                      "h-7 w-7 rounded-full border-2 transition",
                      cor.toUpperCase() === c.toUpperCase()
                        ? "border-foreground scale-110"
                        : "border-transparent",
                    )}
                    style={{ background: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* SEÇÃO 2 — INSTITUIÇÃO */}
          {showBanco && (
            <section className="space-y-3 border-t pt-4">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Instituição financeira
              </Label>
              <div className="space-y-2">
                <Label>Banco</Label>
                <Select value={banco} onValueChange={setBanco}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o banco" />
                  </SelectTrigger>
                  <SelectContent>
                    {BANKS.map((b) => (
                      <SelectItem key={b.value} value={b.value}>
                        <span className="mr-2">{b.icon}</span>
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {banco === "Outro" && (
                  <Input
                    value={bancoOutro}
                    onChange={(e) => setBancoOutro(e.target.value)}
                    placeholder="Nome da instituição"
                  />
                )}
              </div>
            </section>
          )}

          {/* SEÇÃO 3 — DADOS BANCÁRIOS */}
          {showDadosBancarios && (
            <section className="space-y-3 border-t pt-4">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Dados bancários
              </Label>
              <div className="grid grid-cols-[1fr_1.5fr_0.6fr] gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Agência</Label>
                  <Input value={agencia} onChange={(e) => setAgencia(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Conta</Label>
                  <Input
                    value={numeroConta}
                    onChange={(e) => setNumeroConta(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Dígito</Label>
                  <Input value={digito} onChange={(e) => setDigito(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Saldo inicial (R$)</Label>
                <Input
                  inputMode="decimal"
                  value={saldoInicial}
                  onChange={(e) => setSaldoInicial(fmtMoney(e.target.value))}
                  placeholder="0,00"
                />
                <p className="text-[11px] text-muted-foreground">
                  Informe o saldo atual da conta.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Cheque especial</p>
                  <p className="text-[11px] text-muted-foreground">
                    Possui limite de cheque especial?
                  </p>
                </div>
                <Switch checked={hasCE} onCheckedChange={setHasCE} />
              </div>

              {hasCE && (
                <div className="space-y-1">
                  <Label>Limite (R$)</Label>
                  <Input
                    inputMode="decimal"
                    value={limiteCE}
                    onChange={(e) => setLimiteCE(fmtMoney(e.target.value))}
                    placeholder="0,00"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Valor disponível além do saldo.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* SEÇÃO 4 — CARTÃO */}
          {showCartao && (
            <section className="space-y-3 border-t pt-4">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Dados do cartão
              </Label>
              <div className="space-y-1">
                <Label>Limite total (R$) *</Label>
                <Input
                  inputMode="decimal"
                  value={limiteCredito}
                  onChange={(e) => setLimiteCredito(fmtMoney(e.target.value))}
                  placeholder="0,00"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Fecha dia</Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={diaFech}
                    onChange={(e) => setDiaFech(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Vence dia</Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={diaVenc}
                    onChange={(e) => setDiaVenc(e.target.value)}
                  />
                </div>
              </div>
              {cartaoPreview && (
                <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
                  <p>
                    📅 Compras até dia <strong>{cartaoPreview.f}</strong> → fatura de{" "}
                    <strong>{cartaoPreview.faturaMes}</strong>
                  </p>
                  <p>
                    💳 Vencimento: dia <strong>{cartaoPreview.v}</strong> de{" "}
                    <strong>{cartaoPreview.vencMes}</strong>
                  </p>
                  <p className="text-muted-foreground">
                    ⚠️ Compras após dia {cartaoPreview.f} entram na próxima fatura.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* SEÇÃO 5 — PREVIEW */}
          {nome.trim() && (
            <section className="border-t pt-4">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Como vai aparecer
              </Label>
              <div
                className="mt-2 rounded-md border bg-card p-3 flex items-center gap-3"
                style={{ borderLeft: `4px solid ${cor}` }}
              >
                <span className="text-2xl">{finalIcon}</span>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {nome}{" "}
                    {showBanco && (banco === "Outro" ? bancoOutro : banco) ? (
                      <span className="text-muted-foreground font-normal">
                        · {banco === "Outro" ? bancoOutro : banco}
                      </span>
                    ) : null}
                  </p>
                  {previewCardSubtitle && (
                    <p className="text-xs text-muted-foreground truncate">
                      {previewCardSubtitle}
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
