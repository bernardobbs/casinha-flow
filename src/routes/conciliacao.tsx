import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFamily } from "@/hooks/use-family";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, Check, Loader2, RefreshCw, Trash2, Sparkles } from "lucide-react";
import { SkeletonPage } from "@/components/skeletons";

export const Route = createFileRoute("/conciliacao")({
  head: () => ({
    meta: [
      { title: "Conciliação — Casinha Hub" },
      { name: "description", content: "Reconcilie transações pendentes da família." },
    ],
  }),
  component: ConciliacaoPage,
});

interface Tx {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  source: "manual" | "importado" | "cartao";
  category_id: string | null;
  account_id: string | null;
  recorrente_id: string | null;
  conciliado: boolean;
}

interface Cat { id: string; nome: string; tipo: "despesa" | "receita"; icone: string }
interface Acc { id: string; nome: string; icone: string }

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ConciliacaoPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { familyId, loading: familyLoading } = useFamily();
  const [loading, setLoading] = useState(true);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [accs, setAccs] = useState<Acc[]>([]);
  const [counts, setCounts] = useState({ semCat: 0, pend: 0, conc: 0 });
  const [bulkLoading, setBulkLoading] = useState(false);
  const [iaLoading, setIaLoading] = useState(false);
  const [reprocessando, setReprocessando] = useState(false);
  const [reprocessStep, setReprocessStep] = useState('');

  const SB_URL = SUPABASE_URL;
  const SB_ANON = SUPABASE_PUBLISHABLE_KEY;

  const reprocessarTudo = async () => {
    if (!familyId) return;
    setReprocessando(true);

    // PASSO 1: Aplicar regras conhecidas (banco aplica direto)
    setReprocessStep('📚 Aplicando regras aprendidas...');
    await supabase.rpc('apply_transaction_rules' as any, { p_family_id: familyId });

    // Buscar dados frescos do banco (não do estado)
    const [{ data: txFrescas }, { data: catsFrescas }, { data: accsFrescos }] = await Promise.all([
      supabase.from("transactions").select("id, description, amount, type, category_id, account_id")
        .eq("family_id", familyId).eq("conciliado", false).limit(200),
      supabase.from("categories").select("id, nome, tipo").eq("family_id", familyId),
      supabase.from("accounts").select("id, nome, tipo").eq("family_id", familyId).eq("ativo", true),
    ]);

    const semCat = (txFrescas ?? []).filter((t: any) => !t.category_id);

    // PASSO 2: IA categoriza o que sobrou
    if (semCat.length > 0) {
      setReprocessStep(`✨ Categorizando ${semCat.length} transações com IA...`);
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        try {
          const resp = await fetch(`${SB_URL}/functions/v1/ai-assistant`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}`, "apikey": SB_ANON },
            body: JSON.stringify({
              feature: "categorizacao",
              txs: semCat.map((t: any) => ({ id: t.id, description: t.description, amount: t.amount, type: t.type })),
              categories: (catsFrescas ?? []).map((c: any) => ({ id: c.id, nome: c.nome, tipo: c.tipo })),
              accounts: (accsFrescos ?? []).map((a: any) => ({ id: a.id, nome: a.nome, tipo: a.tipo })),
            }),
          });
          if (resp.ok) {
            const data = await resp.json();
            const resultados: { id: string; category_id: string; account_id: string }[] = data.results ?? [];
            for (const r of resultados) {
              if (!r.category_id) continue;
              await supabase.from("transactions").update({
                category_id: r.category_id,
                ...(r.account_id ? { account_id: r.account_id } : {}),
              }).eq("id", r.id);
              // Salvar regra aprendida
              const tx = semCat.find((t: any) => t.id === r.id) as any;
              if (tx) {
                supabase.rpc('save_transaction_rule' as any, {
                  p_family_id: familyId, p_description: tx.description,
                  p_category_id: r.category_id, p_account_id: r.account_id ?? null,
                  p_tipo: tx.type, p_origem: 'ia',
                }).then(() => {}).catch(() => {});
              }
            }
          }
        } catch (e: any) { toast.error("Erro IA: " + e.message); }
      }
    }

    // PASSO 3: Conciliar automaticamente as completas
    setReprocessStep('✅ Conciliando transações completas...');
    const { data: conciliadas } = await supabase.from("transactions")
      .update({ conciliado: true, conciliado_em: new Date().toISOString() })
      .eq("family_id", familyId).eq("conciliado", false)
      .not("category_id", "is", null).not("account_id", "is", null)
      .select("id");

    await load();
    toast.success(`✅ Reprocessamento concluído — ${(conciliadas?.length ?? 0) + semCat.length} transações processadas`);
    setReprocessando(false);
    setReprocessStep('');
  };

  const categorizarComIA = reprocessarTudo;

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  const load = async () => {
    if (!familyId) return;
    setLoading(true);
    const [{ data: pend }, { data: cs }, { data: as }, { count: semCat }, { count: cConc }] = await Promise.all([
      supabase.from("transactions").select("*")
        .eq("family_id", familyId).eq("conciliado", false)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("categories").select("id,nome,tipo,icone").eq("family_id", familyId).order("nome"),
      supabase.from("accounts").select("id,nome,icone").eq("family_id", familyId).eq("ativo", true),
      supabase.from("transactions").select("id", { count: "exact", head: true })
        .eq("family_id", familyId).is("category_id", null),
      supabase.from("transactions").select("id", { count: "exact", head: true })
        .eq("family_id", familyId).eq("conciliado", true),
    ]);
    const list = ((pend ?? []) as unknown as Tx[]).map((t) => ({ ...t, amount: Number(t.amount) }));
    setTxs(list);
    setCats((cs ?? []) as Cat[]);
    setAccs((as ?? []) as Acc[]);
    setCounts({ semCat: semCat ?? 0, pend: list.length, conc: cConc ?? 0 });
    setLoading(false);
  };

  useEffect(() => {
    if (!familyId) return;
    (async () => {
      await load();
      // Auto-aplicar regras conhecidas ao abrir
      await supabase.rpc('apply_transaction_rules' as any, { p_family_id: familyId });
      await load();
    })();
    /* eslint-disable-next-line */
  }, [familyId]);

  const updateTx = async (id: string, patch: Partial<Tx>) => {
    const { error } = await supabase.from("transactions").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setTxs((prev) => prev.map((t) => t.id === id ? { ...t, ...patch } : t));
    // Aprender com a ação manual
    const tx = txs.find(t => t.id === id);
    if (tx && familyId && (patch.category_id || patch.account_id)) {
      const updated = { ...tx, ...patch };
      if (updated.category_id || updated.account_id) {
        supabase.rpc('save_transaction_rule' as any, {
          p_family_id: familyId,
          p_description: tx.description,
          p_category_id: updated.category_id ?? null,
          p_account_id: updated.account_id ?? null,
          p_tipo: tx.type,
          p_origem: 'manual',
        }).then(() => {}).catch(() => {});
      }
    }
  };

  const conciliar = async (id: string) => {
    const { error } = await supabase.from("transactions")
      .update({ conciliado: true, conciliado_em: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    setTxs((prev) => prev.filter((t) => t.id !== id));
    setCounts((c) => ({ ...c, pend: c.pend - 1, conc: c.conc + 1 }));
    toast.success("Conciliada");
  };

  const excluir = async (id: string) => {
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setTxs((prev) => prev.filter((t) => t.id !== id));
    setCounts((c) => ({ ...c, pend: c.pend - 1 }));
    toast.success("Excluída");
  };

  const conciliarTodasCompletas = async () => {
    if (!familyId) return;
    setBulkLoading(true);
    const { data, error } = await supabase
      .from("transactions")
      .update({ conciliado: true, conciliado_em: new Date().toISOString() })
      .eq("family_id", familyId)
      .eq("conciliado", false)
      .not("category_id", "is", null)
      .not("account_id", "is", null)
      .select("id");
    setBulkLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`✅ ${data?.length ?? 0} transações conciliadas`);
    await load();
  };

  const catsByTipo = useMemo(() => ({
    receita: cats.filter((c) => c.tipo === "receita"),
    despesa: cats.filter((c) => c.tipo === "despesa"),
  }), [cats]);

  if (authLoading) return <SkeletonPage />;
  if (!user) return null;

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <header className="border-b border-border/60 bg-card/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="font-semibold tracking-tight">🔄 Conciliação</span>
          <Link to="/dashboard"><Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" />Painel</Button></Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">📋 Sem categoria</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{counts.semCat}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">⚪ Pendentes</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{counts.pend}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">✅ Conciliadas</CardTitle></CardHeader><CardContent className="text-2xl font-semibold" style={{ color: "var(--success)" }}>{counts.conc}</CardContent></Card>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={reprocessarTudo} disabled={reprocessando} className="gap-1.5">
            {reprocessando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-primary" />}
            {reprocessando ? reprocessStep || "Processando..." : "✨ Reprocessar tudo"}
          </Button>
          <Button onClick={conciliarTodasCompletas} disabled={bulkLoading} className="gap-2">
            {bulkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Conciliar todas completas
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
            ) : txs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">🎉 Nenhuma transação pendente</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Conta</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {txs.map((t) => {
                      const sourceBadge = t.recorrente_id
                        ? "🔄 Recorrente"
                        : t.source === "importado" ? "📥 CSV" : "🖊️ Manual";
                      const status = !t.category_id
                        ? <Badge className="bg-yellow-500/15 text-yellow-700 font-normal">🟡 Sem categoria</Badge>
                        : !t.account_id
                        ? <Badge className="bg-blue-500/15 text-blue-700 font-normal">🔵 Sem conta</Badge>
                        : <Badge variant="outline" className="font-normal">⚪ Pendente</Badge>;
                      const opts = t.type === "income" ? catsByTipo.receita : catsByTipo.despesa;
                      return (
                        <TableRow key={t.id}>
                          <TableCell className="text-xs whitespace-nowrap">{new Date(t.date + "T00:00:00").toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell className="max-w-[180px] truncate">{t.description}</TableCell>
                          <TableCell>
                            <Select value={t.category_id ?? undefined} onValueChange={(v) => updateTx(t.id, { category_id: v })}>
                              <SelectTrigger className="h-8 w-[140px]"><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                {opts.map((c) => <SelectItem key={c.id} value={c.id}>{c.icone} {c.nome}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select value={t.account_id ?? undefined} onValueChange={(v) => updateTx(t.id, { account_id: v })}>
                              <SelectTrigger className="h-8 w-[140px]"><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                {accs.map((a) => <SelectItem key={a.id} value={a.id}>{a.icone} {a.nome}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium" style={{ color: t.type === "income" ? "var(--success)" : "var(--destructive)" }}>
                            {t.type === "income" ? "+" : "−"} {fmt(Math.abs(t.amount))}
                          </TableCell>
                          <TableCell><Badge variant="outline" className="font-normal text-[10px]">{sourceBadge}</Badge></TableCell>
                          <TableCell>{status}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => conciliar(t.id)} title="Conciliar">
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir transação?</AlertDialogTitle>
                                    <AlertDialogDescription>{t.description} — {fmt(Math.abs(t.amount))}</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => excluir(t.id)}>Excluir</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
