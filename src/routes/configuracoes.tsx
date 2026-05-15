import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFamily } from "@/hooks/use-family";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Settings as SettingsIcon, Trash2, Wallet, Crown, UserPlus } from "lucide-react";
import { SkeletonPage } from "@/components/skeletons";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Casinha Hub" },
      { name: "description", content: "Preferências da família, IA, notificações e regras de categorização." },
    ],
  }),
  component: ConfigPage,
});

const SETTING_KEYS = [
  "family_name",
  "renda_padrao",
  "dia_fechamento",
  "num_adultos",
  "num_criancas",
  "ai_provider",
  "ai_daily_limit",
  "notif_orcamento",
  "notif_estoque",
  "notif_combustivel",
  "notif_contas",
] as const;
type SettingKey = (typeof SETTING_KEYS)[number];

interface Rule {
  id: string;
  termo: string;
  category_id: string;
  origem: "manual" | "ia" | "keyword";
  confianca: number;
  usos: number;
  category_nome?: string;
}

interface MemberRow {
  id?: string;
  user_id: string;
  role: "admin" | "member";
  full_name: string | null;
  email: string | null;
  icone?: string;
  cor?: string;
}

function ConfigPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { familyId, loading: familyLoading } = useFamily();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiToday, setAiToday] = useState(0);
  const [rules, setRules] = useState<Rule[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);

  const handleResetData = async () => {
    if (!familyId || confirmText !== "CONFIRMAR") return;
    setResetting(true);
    const { data, error } = await (supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>)("reset_family_data", {
      p_family_id: familyId,
      p_keep_config: true,
    });
    setResetting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const apagados = (data as { apagados?: Record<string, number> } | null)?.apagados ?? {};
    toast.success("✅ Dados resetados", {
      description: `${apagados.transacoes ?? 0} transações, ${apagados.veiculos ?? 0} veículos removidos.`,
    });
    setResetOpen(false);
    setConfirmText("");
    navigate({ to: "/dashboard" });
  };

  const [values, setValues] = useState<Record<SettingKey, string>>({
    family_name: "",
    renda_padrao: "",
    dia_fechamento: "1",
    num_adultos: "2",
    num_criancas: "0",
    ai_provider: "gemini",
    ai_daily_limit: "5",
    notif_orcamento: "true",
    notif_estoque: "true",
    notif_combustivel: "true",
    notif_contas: "true",
  });

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: profile } = await supabase
        .from("profiles")
        .select("family_id, families(name)")
        .eq("id", user.id)
        .maybeSingle();
      const fid = profile?.family_id ?? null;
      if (!fid) {
        setLoading(false);
        return;
      }
      const famName =
        (profile as unknown as { families?: { name?: string } })?.families?.name ?? "";

      const { data: settings } = await supabase
        .from("family_settings")
        .select("chave, valor")
        .eq("family_id", fid);

      const map = new Map((settings ?? []).map((s) => [s.chave, s.valor ?? ""]));
      setValues((prev) => ({
        ...prev,
        family_name: map.get("family_name") ?? famName,
        renda_padrao: map.get("renda_padrao") ?? "",
        dia_fechamento: map.get("dia_fechamento") ?? "1",
        num_adultos: map.get("num_adultos") ?? "2",
        num_criancas: map.get("num_criancas") ?? "0",
        ai_provider: map.get("ai_provider") ?? "gemini",
        ai_daily_limit: map.get("ai_daily_limit") ?? "5",
        notif_orcamento: map.get("notif_orcamento") ?? "true",
        notif_estoque: map.get("notif_estoque") ?? "true",
        notif_combustivel: map.get("notif_combustivel") ?? "true",
        notif_contas: map.get("notif_contas") ?? "true",
      }));

      const { data: count } = await supabase.rpc("count_ai_runs_today", { _family_id: fid });
      setAiToday(Number(count ?? 0));

      await loadRules(fid);
      await loadMembers(fid);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadMembers = async (fid: string) => {
    const { data: rows } = await supabase
      .from("family_members")
      .select("id, user_id, nome, icone, cor, role, tipo")
      .eq("family_id", fid)
      .order("nome");
    setMembers((rows ?? []).map((r: any) => ({
      user_id: r.user_id,
      role: r.role,
      full_name: r.nome ?? null,
      email: r.tipo === 'auth' ? r.user_id : null,
      icone: r.icone ?? '👤',
      cor: r.cor ?? '#6366F1',
      id: r.id,
    })));
  };

  const handleInviteMember = async () => {
    const nome = inviteEmail.trim();
    if (!nome) { toast.error("Informe o nome do membro"); return; }
    if (!familyId) return;

    // Criar convite no banco
    const { data: invite, error } = await supabase
      .from("family_invites" as any)
      .insert({ family_id: familyId, invited_by: user?.id, email: nome })
      .select("token")
      .single();

    if (error) { toast.error("Erro ao criar convite"); return; }

    const token = (invite as any)?.token;
    const link = `${window.location.origin}/auth?invite=${token}`;

    // Copiar para clipboard
    try { await navigator.clipboard.writeText(link); } catch {}

    toast.success(`✅ Link de convite para ${nome} copiado!`, {
      description: "Válido por 7 dias. Envie pelo WhatsApp ou email.",
    });
    setInviteEmail("");
    await loadMembers(familyId);
  };

  const loadRules = async (fid: string) => {
    const { data, error } = await supabase
      .from("categorization_rules" as any)
      .select("id, termo, category_id, origem, confianca, usos")
      .eq("family_id", fid)
      .order("usos", { ascending: false })
      .limit(500);
    if (error) console.error("loadRules error:", error);
    // Buscar nomes das categorias separadamente
    const { data: cats } = await supabase
      .from("categories")
      .select("id, nome")
      .eq("family_id", fid);
    const catMap = new Map((cats ?? []).map((c: any) => [c.id, c.nome]));
    const rs: Rule[] = (data ?? []).map((r: any) => ({
      id: r.id,
      termo: r.termo,
      category_id: r.category_id,
      origem: r.origem,
      confianca: Number(r.confianca),
      usos: r.usos,
      category_nome: r.category_id ? catMap.get(r.category_id) : undefined,
    }));
    setRules(rs);
  };

  const setVal = (k: SettingKey, v: string) => setValues((p) => ({ ...p, [k]: v }));

  const handleSave = async (keys: SettingKey[]) => {
    if (!familyId) return;
    setSaving(true);
    const rows = keys.map((k) => ({
      family_id: familyId,
      chave: k,
      valor: values[k],
    }));
    const { error } = await supabase
      .from("family_settings")
      .upsert(rows, { onConflict: "family_id,chave" });

    // Se nome mudou, atualiza tabela families
    if (keys.includes("family_name") && values.family_name) {
      await supabase.from("families").update({ name: values.family_name }).eq("id", familyId);
    }

    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Configurações salvas");
  };

  const handleDeleteRule = async (id: string) => {
    const { error } = await supabase.from("categorization_rules").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRules((rs) => rs.filter((r) => r.id !== id));
    toast.success("Regra removida");
  };

  const handleRestoreKeywords = async () => {
    if (!familyId) return;
    const { error } = await supabase.rpc("seed_default_categorization_keywords", {
      _family_id: familyId,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    await loadRules(familyId);
    toast.success("Palavras-chave padrão restauradas");
  };

  const aiLimit = useMemo(() => {
    const n = parseInt(values.ai_daily_limit || "5", 10);
    return Number.isFinite(n) && n > 0 ? n : 5;
  }, [values.ai_daily_limit]);

  if (authLoading || familyLoading || loading) return <SkeletonPage />;
  if (!user) return null;

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <header className="border-b border-border/60 bg-card/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition">
            <div
              className="h-9 w-9 rounded-lg flex items-center justify-center"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">Casinha Hub</span>
          </Link>
          <Link to="/dashboard">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Painel
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-center gap-3">
          <SettingsIcon className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-3xl font-semibold tracking-tight">Configurações</h1>
        </div>

        <Tabs defaultValue="familia">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="familia">Família</TabsTrigger>
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="ia">IA</TabsTrigger>
            <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
            <TabsTrigger value="categorias">Categorias</TabsTrigger>
          </TabsList>

          {/* FAMÍLIA */}
          <TabsContent value="familia" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Família</CardTitle>
                <CardDescription>Nome, renda esperada e composição.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome da família</Label>
                    <Input value={values.family_name} onChange={(e) => setVal("family_name", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Renda mensal esperada (R$)</Label>
                    <Input inputMode="decimal" value={values.renda_padrao}
                      onChange={(e) => setVal("renda_padrao", e.target.value.replace(/[^0-9.,]/g, ""))} placeholder="0,00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Adultos</Label>
                    <Input type="number" min={0} value={values.num_adultos}
                      onChange={(e) => setVal("num_adultos", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Crianças</Label>
                    <Input type="number" min={0} value={values.num_criancas}
                      onChange={(e) => setVal("num_criancas", e.target.value)} />
                  </div>
                </div>
                <Button disabled={saving} onClick={() => handleSave(["family_name", "renda_padrao", "num_adultos", "num_criancas"])}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Membros</CardTitle>
                <CardDescription>{members.length} pessoa(s) compartilhando esta família.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="divide-y divide-border">
                  {members.map((m) => (
                    <li key={m.user_id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0"
                          style={{ background: m.cor ?? '#6366F1' + '22', border: `2px solid ${m.cor ?? '#6366F1'}` }}
                        >
                          {m.icone ?? '👤'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {m.full_name ?? "Sem nome"}
                            {m.user_id === user.id && <span className="text-muted-foreground font-normal"> (você)</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">{m.role === 'admin' ? 'Administrador' : 'Membro'}</p>
                        </div>
                      </div>
                      <Badge variant={m.role === "admin" ? "default" : "secondary"} className="gap-1 shrink-0">
                        {m.role === "admin" && <Crown className="h-3 w-3" />}
                        {m.role === "admin" ? "Admin" : "Membro"}
                      </Badge>
                    </li>
                  ))}
                </ul>
                <div className="border-t pt-4 space-y-3">
                  <div>
                    <Label>Convidar membro</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Gera um link válido por 7 dias. A pessoa cria a conta e entra na sua família automaticamente.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Input type="text" placeholder="Nome (ex: Daniella)" value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleInviteMember()} />
                    <Button onClick={handleInviteMember}>
                      <UserPlus className="h-4 w-4 mr-1" />Convidar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    💡 Link copiado automaticamente — envie pelo WhatsApp ou email.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* GERAL */}
          <TabsContent value="geral" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Família</CardTitle>
                <CardDescription>
                  Informações usadas pela IA e cálculos do Módulo Crise.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome da família</Label>
                    <Input
                      value={values.family_name}
                      onChange={(e) => setVal("family_name", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Renda mensal padrão (R$)</Label>
                    <Input
                      inputMode="decimal"
                      value={values.renda_padrao}
                      onChange={(e) =>
                        setVal("renda_padrao", e.target.value.replace(/[^0-9.,]/g, ""))
                      }
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Dia de fechamento do mês</Label>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      value={values.dia_fechamento}
                      onChange={(e) => setVal("dia_fechamento", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Adultos</Label>
                    <Input
                      type="number"
                      min={0}
                      value={values.num_adultos}
                      onChange={(e) => setVal("num_adultos", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Crianças</Label>
                    <Input
                      type="number"
                      min={0}
                      value={values.num_criancas}
                      onChange={(e) => setVal("num_criancas", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Button
                    disabled={saving}
                    onClick={() =>
                      handleSave([
                        "family_name",
                        "renda_padrao",
                        "dia_fechamento",
                        "num_adultos",
                        "num_criancas",
                      ])
                    }
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                  </Button>
                </div>

                <Separator className="my-6" />

                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-destructive">
                    Zona de perigo
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Apaga todas as transações, veículos, estoque e histórico
                    da família. Categorias e orçamentos são mantidos.
                  </p>
                  <Button
                    variant="outline"
                    className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => setResetOpen(true)}
                  >
                    🗑️ Resetar dados da família
                  </Button>
                </div>
              </CardContent>
            </Card>

            <AlertDialog
              open={resetOpen}
              onOpenChange={(o) => {
                setResetOpen(o);
                if (!o) setConfirmText("");
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Resetar dados da família?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. Serão apagados: transações,
                    recorrentes, veículos, estoque, histórico financeiro e alertas.
                    Categorias e orçamentos serão mantidos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                  <Label>Digite CONFIRMAR para continuar:</Label>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="CONFIRMAR"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={resetting}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={confirmText !== "CONFIRMAR" || resetting}
                    onClick={(e) => {
                      e.preventDefault();
                      handleResetData();
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Resetar"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TabsContent>

          {/* IA */}
          <TabsContent value="ia" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Inteligência Artificial</CardTitle>
                <CardDescription>
                  O assistente usa <strong>Gemini 2.0 Flash</strong> via servidor seguro — a chave não fica no browser.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border/60 p-4 bg-card/40 space-y-2">
                  <p className="text-sm flex justify-between">
                    <span className="text-muted-foreground">Modelo</span>
                    <code className="text-xs">gemini-2.0-flash</code>
                  </p>
                  <p className="text-sm flex justify-between">
                    <span className="text-muted-foreground">Uso hoje</span>
                    <span className="font-semibold tabular-nums">{aiToday} / {aiLimit} mensagens</span>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Limite diário de mensagens</Label>
                  <Input
                    type="number" min={1} max={50}
                    value={values.ai_daily_limit}
                    onChange={(e) => setVal("ai_daily_limit", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Padrão: 20 mensagens/dia</p>
                </div>
                <Button disabled={saving} onClick={() => handleSave(["ai_daily_limit"])}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* NOTIFICAÇÕES */}
          <TabsContent value="notificacoes" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Notificações</CardTitle>
                <CardDescription>Quais alertas você quer receber.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { k: "notif_orcamento" as const, label: "Alertas de orçamento" },
                  { k: "notif_estoque" as const, label: "Alertas de estoque" },
                  { k: "notif_combustivel" as const, label: "Alertas de combustível" },
                  { k: "notif_contas" as const, label: "Lembretes de contas" },
                ].map(({ k, label }) => (
                  <div
                    key={k}
                    className="flex items-center justify-between border-b border-border/60 pb-3 last:border-0 last:pb-0"
                  >
                    <Label htmlFor={k} className="cursor-pointer">
                      {label}
                    </Label>
                    <Switch
                      id={k}
                      checked={values[k] === "true"}
                      onCheckedChange={(c) => setVal(k, c ? "true" : "false")}
                    />
                  </div>
                ))}
                <Button
                  disabled={saving}
                  onClick={() =>
                    handleSave([
                      "notif_orcamento",
                      "notif_estoque",
                      "notif_combustivel",
                      "notif_contas",
                    ])
                  }
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CATEGORIAS */}
          <TabsContent value="categorias" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Regras de categorização</CardTitle>
                  <CardDescription>
                    {rules.length} regras aprendidas. A confiança aumenta a cada uso.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleRestoreKeywords}>
                  Restaurar palavras-chave padrão
                </Button>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Termo</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead className="text-right">Usos</TableHead>
                        <TableHead className="text-right">Confiança</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rules.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                            Nenhuma regra ainda.
                          </TableCell>
                        </TableRow>
                      )}
                      {rules.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-xs">{r.termo}</TableCell>
                          <TableCell>{r.category_nome ?? "—"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                r.origem === "manual"
                                  ? "default"
                                  : r.origem === "ia"
                                    ? "secondary"
                                    : "outline"
                              }
                              className="font-normal"
                            >
                              {r.origem}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{r.usos}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {(r.confianca * 100).toFixed(0)}%
                          </TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteRule(r.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
