import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
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

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Casinha Flow" },
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
  user_id: string;
  role: "admin" | "member";
  full_name: string | null;
  email: string | null;
}

function ConfigPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiToday, setAiToday] = useState(0);
  const [rules, setRules] = useState<Rule[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");

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
      setFamilyId(fid);
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
    const { data: rows } = await supabase.from("family_members")
      .select("user_id, role").eq("family_id", fid);
    const ids = (rows ?? []).map(r => r.user_id);
    if (ids.length === 0) { setMembers([]); return; }
    const { data: profs } = await supabase.from("profiles")
      .select("id, full_name, email").in("id", ids);
    const map = new Map((profs ?? []).map(p => [p.id, p]));
    setMembers((rows ?? []).map(r => ({
      user_id: r.user_id, role: r.role,
      full_name: map.get(r.user_id)?.full_name ?? null,
      email: map.get(r.user_id)?.email ?? null,
    })));
  };

  const handleInviteMember = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) { toast.error("E-mail inválido"); return; }
    const link = `${window.location.origin}/auth?invite=${encodeURIComponent(email)}`;
    try { await navigator.clipboard.writeText(link); } catch { /* noop */ }
    toast.success("Link de convite copiado! Envie ao novo membro.");
    setInviteEmail("");
  };

  const loadRules = async (fid: string) => {
    const { data } = await supabase
      .from("categorization_rules")
      .select("id, termo, category_id, origem, confianca, usos, categories(nome)")
      .eq("family_id", fid)
      .order("usos", { ascending: false })
      .limit(500);
    const rs: Rule[] = (data ?? []).map((r) => {
      const cat = (r as unknown as { categories?: { nome?: string } }).categories;
      return {
        id: r.id,
        termo: r.termo,
        category_id: r.category_id,
        origem: r.origem,
        confianca: Number(r.confianca),
        usos: r.usos,
        category_nome: cat?.nome,
      };
    });
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
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition">
            <div
              className="h-9 w-9 rounded-lg flex items-center justify-center"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">Casinha Flow</span>
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

        <Tabs defaultValue="geral">
          <TabsList>
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="ia">IA</TabsTrigger>
            <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
            <TabsTrigger value="categorias">Categorias</TabsTrigger>
          </TabsList>

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
              </CardContent>
            </Card>
          </TabsContent>

          {/* IA */}
          <TabsContent value="ia" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Inteligência artificial</CardTitle>
                <CardDescription>
                  Provedor e limite diário de execuções da IA do Módulo Crise.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Provedor</Label>
                    <Input value="Gemini (via Lovable AI Gateway)" disabled />
                    <p className="text-xs text-muted-foreground">
                      Modelo atual: <code>google/gemini-3-flash-preview</code>
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Limite diário de análises</Label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={values.ai_daily_limit}
                      onChange={(e) => setVal("ai_daily_limit", e.target.value)}
                    />
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 p-4 bg-card/40">
                  <p className="text-sm">
                    Uso de hoje:{" "}
                    <span className="font-semibold tabular-nums">
                      {aiToday}/{aiLimit}
                    </span>{" "}
                    análises usadas
                  </p>
                </div>
                <Button
                  disabled={saving}
                  onClick={() => handleSave(["ai_provider", "ai_daily_limit"])}
                >
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
