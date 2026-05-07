import { useEffect, useMemo, useState } from "react";
import { Plus, Loader2, TrendingDown, TrendingUp, Sparkles } from "lucide-react";
import { useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TxType = "income" | "expense";

interface Category {
  id: string;
  nome: string;
  tipo: "despesa" | "receita";
  cor: string;
  icone: string;
  is_essencial: boolean;
}

interface Account {
  id: string;
  nome: string;
  tipo: string;
  icone: string;
}

const fmt = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const HIDE_ON = ["/", "/auth"];

export function QuickAddButton() {
  const { user } = useAuth();
  const location = useLocation();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [type, setType] = useState<TxType>("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [accountId, setAccountId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [suggestion, setSuggestion] = useState<{
    category_id: string;
    origem: string;
    confianca: number;
    nivel: number;
    auto_apply: boolean;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const hide = HIDE_ON.includes(location.pathname);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("family_id")
        .eq("id", user.id)
        .maybeSingle();
      setFamilyId(profile?.family_id ?? null);
    })();
  }, [user]);

  useEffect(() => {
    if (!familyId) return;
    (async () => {
      const [{ data: accs }, { data: cats }] = await Promise.all([
        supabase
          .from("accounts")
          .select("id,nome,tipo,icone")
          .eq("family_id", familyId)
          .eq("ativo", true)
          .order("created_at", { ascending: true }),
        supabase
          .from("categories")
          .select("id,nome,tipo,cor,icone,is_essencial")
          .eq("family_id", familyId)
          .order("nome", { ascending: true }),
      ]);
      setAccounts((accs ?? []) as Account[]);
      setCategories((cats ?? []) as Category[]);
    })();
  }, [familyId]);

  const filteredCats = useMemo(
    () => categories.filter((c) => c.tipo === (type === "income" ? "receita" : "despesa")),
    [categories, type],
  );

  const reset = () => {
    setStep(1);
    setType("expense");
    setAmount("");
    setDescription("");
    setAccountId("");
    setCategoryId("");
    setSuggestion(null);
  };

  const handleSelectType = (t: TxType) => {
    setType(t);
    setStep(2);
  };

  const parseAmount = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));

  const handleNextFromValue = async () => {
    const amt = parseAmount(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Valor inválido");
      return;
    }
    if (!description.trim()) {
      toast.error("Descrição obrigatória");
      return;
    }
    // Sugestão automática
    if (familyId && type === "expense") {
      const { data } = await supabase.rpc("categorize_transaction", {
        _family_id: familyId,
        _description: description,
        _dummy: false,
      });
      const first = (data ?? [])[0];
      if (first) {
        setSuggestion(first as typeof suggestion);
        if (first.auto_apply) setCategoryId(first.category_id);
      } else {
        setSuggestion(null);
      }
    }
    setStep(3);
  };

  const handleSave = async () => {
    if (!familyId || !user) return;
    const amt = parseAmount(amount);
    if (type === "expense" && !categoryId) {
      toast.error("Selecione uma categoria");
      return;
    }
    setSubmitting(true);
    const cat = categories.find((c) => c.id === categoryId);
    const { data: inserted, error } = await supabase
      .from("transactions")
      .insert({
        family_id: familyId,
        user_id: user.id,
        type,
        amount: amt,
        description: description.trim(),
        date: new Date().toISOString().slice(0, 10),
        account_id: accountId || null,
        category_id: categoryId || null,
        category: cat?.nome ?? null,
        is_essencial: cat?.is_essencial ?? false,
        source: "manual",
        tipo_especial: "normal",
      })
      .select("id")
      .single();

    if (error || !inserted) {
      setSubmitting(false);
      toast.error(error?.message ?? "Erro ao salvar");
      return;
    }

    // Aprende regra
    if (categoryId && description.trim()) {
      await supabase.rpc("learn_categorization_rule", {
        _family_id: familyId,
        _termo: description.trim(),
        _category_id: categoryId,
        _origem: "manual",
      });
    }
    // Recalcula saldo da conta
    if (accountId) {
      await supabase.rpc("recalc_account_balance", { _account_id: accountId });
    }
    // Alertas
    await supabase.rpc("check_transaction_alerts", { _transaction_id: inserted.id });

    setSubmitting(false);
    toast.success(`✅ ${fmt(amt)} salvo`);
    reset();
    setOpen(false);
  };

  if (hide || !user || !familyId) return null;

  return (
    <>
      <Button
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg p-0"
        aria-label="Quick add"
        style={{ background: "var(--gradient-primary)" }}
      >
        <Plus className="h-6 w-6" />
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {step === 1 && "Nova transação"}
              {step === 2 && (type === "expense" ? "Saída" : "Entrada")}
              {step === 3 && "Categoria"}
            </DialogTitle>
            <DialogDescription>
              {step === 1 && "O que você quer registrar?"}
              {step === 2 && "Valor e descrição"}
              {step === 3 && "Selecione a categoria"}
            </DialogDescription>
          </DialogHeader>

          {step === 1 && (
            <div className="grid grid-cols-2 gap-3 py-2">
              <button
                type="button"
                onClick={() => handleSelectType("expense")}
                className="rounded-xl border border-border/60 p-6 flex flex-col items-center gap-2 hover:bg-destructive/10 transition"
              >
                <TrendingDown className="h-7 w-7 text-destructive" />
                <span className="font-medium">Saída</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectType("income")}
                className="rounded-xl border border-border/60 p-6 flex flex-col items-center gap-2 hover:bg-primary/10 transition"
              >
                <TrendingUp className="h-7 w-7 text-primary" />
                <span className="font-medium">Entrada</span>
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  inputMode="decimal"
                  autoFocus
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Mercado Mateus"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleNextFromValue();
                  }}
                />
              </div>
              {accounts.length > 0 && (
                <div className="space-y-2">
                  <Label>Conta (opcional)</Label>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.icone} {a.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <DialogFooter className="gap-2">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  Voltar
                </Button>
                <Button onClick={handleNextFromValue}>Próximo</Button>
              </DialogFooter>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              {suggestion && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center gap-2 text-sm">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <div className="flex-1">
                    Sugestão:{" "}
                    <span className="font-medium">
                      {categories.find((c) => c.id === suggestion.category_id)?.nome ?? "—"}
                    </span>{" "}
                    <Badge variant="outline" className="ml-1 text-[10px]">
                      {suggestion.origem} · {Math.round(suggestion.confianca * 100)}%
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCategoryId(suggestion.category_id)}
                  >
                    Aplicar
                  </Button>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 max-h-[280px] overflow-y-auto">
                {filteredCats.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoryId(c.id)}
                    className={cn(
                      "rounded-lg border p-3 flex flex-col items-center gap-1 text-xs transition",
                      categoryId === c.id
                        ? "border-primary bg-primary/10"
                        : "border-border/60 hover:bg-muted/50",
                    )}
                  >
                    <span className="text-xl">{c.icone}</span>
                    <span className="text-center leading-tight">{c.nome}</span>
                  </button>
                ))}
              </div>
              <DialogFooter className="gap-2">
                <Button variant="ghost" onClick={() => setStep(2)}>
                  Voltar
                </Button>
                <Button onClick={handleSave} disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default QuickAddButton;
