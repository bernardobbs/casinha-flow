import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFamily } from "@/hooks/use-family";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SkeletonRecorrentes } from "@/components/skeletons";

export const Route = createFileRoute("/recorrentes")({
  head: () => ({ meta: [{ title: "Recorrentes — Casinha Hub" }] }),
  component: RecorrentesPage,
});

type Freq = "mensal" | "semanal" | "quinzenal" | "anual";
type RecRow = {
  id: string; description: string; amount: number; type: "income" | "expense";
  frequencia: Freq; dia_do_mes: number | null; proxima_data: string;
  ativo: boolean; account_id: string | null; category_id: string | null;
  is_essencial: boolean;
};
type Acc = { id: string; nome: string };
type Cat = { id: string; nome: string; tipo: "despesa" | "receita" };

const fmtBRL = (n: number) => (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function RecorrentesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { familyId, loading: familyLoading } = useFamily();
  const [rows, setRows] = useState<RecRow[]>([]);
  const [accounts, setAccounts] = useState<Acc[]>([]);
  const [categories, setCategories] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  // form
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [frequencia, setFrequencia] = useState<Freq>("mensal");
  const [diaDoMes, setDiaDoMes] = useState("1");
  const [gerarLembrete, setGerarLembrete] = useState(true);
  const [accountId, setAccountId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");

  useEffect(() => { if (!authLoading && !user) navigate({ to: "/auth" }); }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user || !familyId) return;
    (async () => {
      setLoading(true);
      const [r, a, c] = await Promise.all([
        supabase.from("recurring_transactions")
          .select("id, description, amount, type, frequencia, dia_do_mes, proxima_data, ativo, account_id, category_id, is_essencial")
          .eq("family_id", familyId).order("proxima_data", { ascending: true }),
        supabase.from("accounts").select("id, nome").eq("family_id", familyId).eq("ativo", true).order("nome"),
        supabase.from("categories").select("id, nome, tipo").eq("family_id", familyId).order("nome"),
      ]);
      setRows((r.data ?? []) as RecRow[]);
      setAccounts((a.data ?? []) as Acc[]);
      setCategories((c.data ?? []) as Cat[]);
      setLoading(false);
    })();
  }, [user, familyId]);

  const reload = async () => {
    if (!familyId) return;
    const { data } = await supabase.from("recurring_transactions")
      .select("id, description, amount, type, frequencia, dia_do_mes, proxima_data, ativo, account_id, category_id, is_essencial")
      .eq("family_id", familyId).order("proxima_data", { ascending: true });
    setRows((data ?? []) as RecRow[]);
  };

  const toggleAtivo = async (id: string, atual: boolean) => {
    const { error } = await supabase.from("recurring_transactions")
      .update({ ativo: !atual }).eq("id", id);
    if (error) return toast.error("Erro ao atualizar");
    toast.success(!atual ? "✅ Ativada" : "⏸ Pausada");
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta recorrente? As transações já geradas permanecem.")) return;
    const { error } = await supabase.from("recurring_transactions").delete().eq("id", id);
    if (error) return toast.error("Erro ao excluir");
    toast.success("Excluída");
    reload();
  };

  const submit = async () => {
    if (!familyId || !user) return;
    const amt = Number(amount.replace(",", "."));
    if (!description || !amt || amt <= 0) return toast.error("Preencha descrição e valor");
    const dia = Math.max(1, Math.min(28, Number(diaDoMes) || 1));
    // próxima data baseada no dia do mês escolhido (mês atual ou seguinte)
    const today = new Date();
    let prox = new Date(today.getFullYear(), today.getMonth(), dia);
    if (prox < today) prox = new Date(today.getFullYear(), today.getMonth() + 1, dia);

    const { error } = await supabase.from("recurring_transactions").insert({
      family_id: familyId,
      user_id: user.id,
      description,
      amount: amt,
      type,
      frequencia,
      dia_do_mes: dia,
      gerar_lembrete: gerarLembrete as boolean,
      proxima_data: prox.toISOString().slice(0, 10),
      account_id: accountId || null,
      category_id: categoryId || null,
      is_essencial: false,
      ativo: true,
    });
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Recorrente criada");
    setOpen(false);
    setDescription(""); setAmount(""); setDiaDoMes("1"); setAccountId(""); setCategoryId("");
    reload();
  };

  const totalMensalComprometido = rows
    .filter((r) => r.ativo && r.type === "expense")
    .reduce((acc, r) => {
      const fator = r.frequencia === "mensal" ? 1
        : r.frequencia === "semanal" ? 4.33
        : r.frequencia === "quinzenal" ? 2
        : r.frequencia === "anual" ? 1 / 12 : 0;
      return acc + Number(r.amount) * fator;
    }, 0);

  if (authLoading || loading) return <SkeletonRecorrentes />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link to="/dashboard"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Painel</Button></Link>
            <h1 className="text-xl font-semibold">🔄 Recorrentes</h1>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Nova</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova recorrente</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Descrição</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Valor</Label><Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" /></div>
                  <div>
                    <Label>Tipo</Label>
                    <Select value={type} onValueChange={(v) => setType(v as "income" | "expense")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">Despesa</SelectItem>
                        <SelectItem value="income">Receita</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Frequência</Label>
                    <Select value={frequencia} onValueChange={(v) => setFrequencia(v as Freq)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mensal">Mensal</SelectItem>
                        <SelectItem value="semanal">Semanal</SelectItem>
                        <SelectItem value="quinzenal">Quinzenal</SelectItem>
                        <SelectItem value="anual">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Dia do mês (1-28)</Label>
                    <Input type="number" min={1} max={28} value={diaDoMes} onChange={(e) => setDiaDoMes(e.target.value)} />
                  </div>
                  <div className="flex items-center justify-between border rounded-md p-2 col-span-2">
                    <div>
                      <p className="text-sm font-medium">Gerar lembrete em A Pagar</p>
                      <p className="text-xs text-muted-foreground">Aparece automaticamente no mês corrente</p>
                    </div>
                    <Switch checked={gerarLembrete} onCheckedChange={setGerarLembrete} />
                  </div>
                </div>
                <div>
                  <Label>Conta</Label>
                  <Select value={accountId || undefined} onValueChange={setAccountId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{accounts.map((a) => (<SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={categoryId || undefined} onValueChange={setCategoryId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {categories.filter((c) => c.tipo === (type === "income" ? "receita" : "despesa")).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button onClick={submit}>Criar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardContent className="py-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total mensal comprometido (despesas ativas)</span>
            <span className="text-xl font-semibold">{fmtBRL(totalMensalComprometido)}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Suas recorrentes</CardTitle></CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma recorrente cadastrada.</p>
            ) : (
              <ul className="divide-y">
                {rows.map((r) => (
                  <li key={r.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{r.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtBRL(Number(r.amount))} · {r.frequencia}
                        {r.dia_do_mes ? ` · dia ${r.dia_do_mes}` : ""}
                        · próx: {new Date(r.proxima_data).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <Badge variant={r.type === "expense" ? "destructive" : "secondary"}>
                      {r.type === "expense" ? "Despesa" : "Receita"}
                    </Badge>
                    <Switch checked={r.ativo} onCheckedChange={() => toggleAtivo(r.id, r.ativo)} />
                    <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
