import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Wallet, ArrowLeft, Loader2, Target, Plus, Trash2 } from "lucide-react";
import { CrisisBanner } from "@/components/crisis-banner";
import { AlertsBell } from "@/components/alerts-bell";

export const Route = createFileRoute("/budgets")({
  head: () => ({
    meta: [
      { title: "Orçamentos — Casinha Flow" },
      { name: "description", content: "Defina orçamentos por categoria e acompanhe o consumo do mês." },
    ],
  }),
  component: BudgetsPage,
});

interface Category {
  id: string;
  nome: string;
  tipo: "despesa" | "receita";
  cor: string;
  icone: string;
  is_essencial: boolean;
}

interface BudgetStatus {
  budget_id: string;
  category_id: string;
  category_nome: string;
  category_cor: string;
  category_icone: string;
  is_essencial: boolean;
  valor_planejado: number;
  valor_gasto: number;
  pct_atingido: number;
  status_cor: "green" | "yellow" | "red" | "gray";
}

const formatCurrency = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const monthLabel = (firstDay: string) =>
  new Date(firstDay + "T00:00:00").toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

const getMonthOptions = (): string[] => {
  const months: string[] = [];
  const now = new Date();
  for (let i = -6; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push(d.toISOString().slice(0, 10));
  }
  return months;
};

function BudgetsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [statuses, setStatuses] = useState<BudgetStatus[]>([]);
  const [crisisActive, setCrisisActive] = useState(false);
  const [mes, setMes] = useState<string>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });

  const [newCategoryId, setNewCategoryId] = useState<string>("");
  const [newAmount, setNewAmount] = useState<string>("");

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  const loadStatuses = useCallback(async (fid: string, m: string) => {
    const { data, error } = await supabase.rpc("get_budget_status", {
      _family_id: fid,
      _mes: m,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setStatuses(
      ((data ?? []) as BudgetStatus[]).map((s) => ({
        ...s,
        valor_planejado: Number(s.valor_planejado),
        valor_gasto: Number(s.valor_gasto),
        pct_atingido: Number(s.pct_atingido),
      })),
    );
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: profile } = await supabase
        .from("profiles")
        .select("family_id")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile?.family_id) {
        setLoading(false);
        return;
      }
      setFamilyId(profile.family_id);

      const [{ data: cats }, { data: crisis }] = await Promise.all([
        supabase
          .from("categories")
          .select("id, nome, tipo, cor, icone, is_essencial")
          .eq("family_id", profile.family_id)
          .eq("tipo", "despesa")
          .order("is_essencial", { ascending: false })
          .order("nome"),
        supabase
          .from("crisis_events")
          .select("id")
          .eq("family_id", profile.family_id)
          .eq("ativo", true)
          .maybeSingle(),
      ]);
      setCategories((cats ?? []) as Category[]);
      setCrisisActive(!!crisis);
      await loadStatuses(profile.family_id, mes);
      setLoading(false);
    })();
  }, [user, mes, loadStatuses]);

  const totals = useMemo(() => {
    let planejado = 0;
    let gasto = 0;
    for (const s of statuses) {
      planejado += s.valor_planejado;
      gasto += s.valor_gasto;
    }
    return { planejado, gasto };
  }, [statuses]);

  const availableCategories = useMemo(
    () => categories.filter((c) => !statuses.some((s) => s.category_id === c.id)),
    [categories, statuses],
  );

  const handleAdd = async () => {
    if (!familyId || !newCategoryId) {
      toast.error("Selecione uma categoria");
      return;
    }
    const valor = Number(newAmount.replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    const { error } = await supabase.from("budgets").upsert(
      {
        family_id: familyId,
        category_id: newCategoryId,
        mes,
        valor_planejado: valor,
      },
      { onConflict: "family_id,category_id,mes" },
    );
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Orçamento salvo");
    setNewCategoryId("");
    setNewAmount("");
    await loadStatuses(familyId, mes);
  };

  const handleUpdate = async (categoryId: string, valor: number) => {
    if (!familyId) return;
    const { error } = await supabase.from("budgets").upsert(
      {
        family_id: familyId,
        category_id: categoryId,
        mes,
        valor_planejado: valor,
      },
      { onConflict: "family_id,category_id,mes" },
    );
    if (error) {
      toast.error(error.message);
      return;
    }
    await loadStatuses(familyId, mes);
  };

  const handleDelete = async (budgetId: string) => {
    const { error } = await supabase.from("budgets").delete().eq("id", budgetId);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (familyId) await loadStatuses(familyId, mes);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <header className="border-b border-border/60 bg-card/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">Casinha Flow</span>
          </Link>
          <div className="flex items-center gap-2">
            <AlertsBell />
            <Link to="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <CrisisBanner />

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
              <Target className="h-7 w-7" />
              Orçamentos mensais
            </h1>
            <p className="text-muted-foreground mt-1">
              Defina limites por categoria e acompanhe o consumo do mês.
            </p>
          </div>
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getMonthOptions().map((m) => (
                <SelectItem key={m} value={m}>
                  {monthLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Totals */}
        <div className="grid sm:grid-cols-3 gap-4">
          <Card className="border-border/60">
            <CardContent className="py-5">
              <p className="text-xs text-muted-foreground">Total planejado</p>
              <p className="text-2xl font-semibold tracking-tight mt-1">
                {formatCurrency(totals.planejado)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="py-5">
              <p className="text-xs text-muted-foreground">Total gasto</p>
              <p className="text-2xl font-semibold tracking-tight mt-1">
                {formatCurrency(totals.gasto)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="py-5">
              <p className="text-xs text-muted-foreground">Saldo do orçamento</p>
              <p
                className="text-2xl font-semibold tracking-tight mt-1"
                style={{
                  color:
                    totals.planejado - totals.gasto < 0
                      ? "var(--destructive)"
                      : "inherit",
                }}
              >
                {formatCurrency(totals.planejado - totals.gasto)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Add */}
        <Card className="border-border/60 shadow-[var(--shadow-soft)]">
          <CardHeader>
            <CardTitle className="text-base">Definir novo orçamento</CardTitle>
            <CardDescription>Para {monthLabel(mes)}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-[1fr_180px_auto] gap-3">
              <div>
                <Label className="text-xs">Categoria</Label>
                <Select value={newCategoryId} onValueChange={setNewCategoryId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.length === 0 && (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        Todas categorias já têm orçamento
                      </div>
                    )}
                    {availableCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-2">
                          <span>{c.icone}</span>
                          <span>{c.nome}</span>
                          {c.is_essencial && (
                            <Badge variant="secondary" className="text-[10px] py-0 h-4">
                              Essencial
                            </Badge>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Valor planejado</Label>
                <Input
                  className="mt-1"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="0,00"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleAdd} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Salvar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Budget list */}
        <Card className="border-border/60 shadow-[var(--shadow-soft)]">
          <CardHeader>
            <CardTitle className="text-base">Por categoria</CardTitle>
            <CardDescription>Barras coloridas mostram o consumo atual</CardDescription>
          </CardHeader>
          <CardContent>
            {statuses.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nenhum orçamento definido para este mês.
              </p>
            ) : (
              <ul className="space-y-4">
                {statuses.map((s) => {
                  const isSuspended = crisisActive && !s.is_essencial;
                  const colorMap: Record<string, string> = {
                    green: "#22c55e",
                    yellow: "#f59e0b",
                    red: "var(--destructive)",
                    gray: "var(--muted-foreground)",
                  };
                  const barColor = isSuspended
                    ? "var(--muted-foreground)"
                    : colorMap[s.status_cor];
                  const pct = Math.min(100, s.pct_atingido);
                  return (
                    <li key={s.category_id} className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-lg">{s.category_icone}</span>
                          <span
                            className={`font-medium ${isSuspended ? "line-through text-muted-foreground" : ""}`}
                          >
                            {s.category_nome}
                          </span>
                          {s.is_essencial && (
                            <Badge variant="secondary" className="text-[10px] py-0 h-4">
                              Essencial
                            </Badge>
                          )}
                          {isSuspended && (
                            <Badge
                              className="text-[10px] py-0 h-4"
                              style={{
                                background: "var(--destructive)",
                                color: "var(--destructive-foreground)",
                              }}
                            >
                              Suspenso
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            defaultValue={s.valor_planejado}
                            className="w-28 h-8 text-right"
                            onBlur={(e) => {
                              const v = Number(e.target.value.replace(",", "."));
                              if (Number.isFinite(v) && v !== s.valor_planejado) {
                                void handleUpdate(s.category_id, v);
                              }
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDelete(s.budget_id)}
                            aria-label="Remover"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div
                        className="h-2 rounded-full overflow-hidden"
                        style={{ background: "color-mix(in oklab, var(--muted-foreground) 15%, transparent)" }}
                      >
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${pct}%`,
                            background: barColor,
                            opacity: isSuspended ? 0.5 : 1,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          {formatCurrency(s.valor_gasto)} / {formatCurrency(s.valor_planejado)}
                        </span>
                        <span style={{ color: isSuspended ? undefined : barColor }}>
                          {s.pct_atingido.toFixed(0)}%
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
