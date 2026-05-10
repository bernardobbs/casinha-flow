import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFamily } from "@/hooks/use-family";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Users, UserPlus, Crown, Copy } from "lucide-react";
import { SkeletonPage } from "@/components/skeletons";

export const Route = createFileRoute("/membros")({
  head: () => ({ meta: [{ title: "Membros — Casinha Hub" }] }),
  component: MembrosPage,
});

type Membro = {
  id: string; user_id: string; nome: string;
  icone: string; cor: string; role: string; tipo: string;
};

function MembrosPage() {
  const { user, loading: authLoading } = useAuth();
  const { familyId, familyName, loading: familyLoading } = useFamily();
  const navigate = useNavigate();
  const [membros, setMembros] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoNome, setNovoNome] = useState("");
  const [convidandoNome, setConvidandoNome] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!familyId) return;
    load();
  }, [familyId]);

  const load = async () => {
    if (!familyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("family_members")
      .select("id, user_id, nome, icone, cor, role, tipo")
      .eq("family_id", familyId)
      .order("nome");
    setMembros((data as any) ?? []);
    setLoading(false);
  };

  const adicionarLocal = async () => {
    if (!novoNome.trim() || !familyId) return;
    setSalvando(true);
    const { error } = await supabase.from("family_members").insert({
      family_id: familyId,
      user_id: crypto.randomUUID(),
      nome: novoNome.trim(),
      icone: "👤", cor: "#6366F1",
      role: "member", tipo: "local",
    });
    setSalvando(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`✅ ${novoNome} adicionado`);
    setNovoNome("");
    await load();
  };

  const gerarConvite = async () => {
    if (!convidandoNome.trim() || !familyId) return;
    setSalvando(true);
    const { data, error } = await supabase
      .from("family_invites" as any)
      .insert({ family_id: familyId, invited_by: user?.id, email: convidandoNome })
      .select("token").single();
    setSalvando(false);
    if (error) { toast.error("Erro ao criar convite"); return; }
    const link = `${window.location.origin}/auth?invite=${(data as any).token}`;
    await navigator.clipboard.writeText(link).catch(() => {});
    toast.success(`✅ Link copiado! Envie para ${convidandoNome}.`, {
      description: "Válido por 7 dias.",
    });
    setConvidandoNome("");
  };

  if (authLoading || familyLoading || loading) return <SkeletonPage />;

  return (
    <div className="min-h-screen p-4" style={{ background: "var(--gradient-subtle)" }}>
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
            <Users className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Membros</h1>
            <p className="text-sm text-muted-foreground">{familyName ?? "Sua família"} · {membros.length} membro{membros.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {/* Lista */}
        <Card>
          <CardHeader><CardTitle className="text-base">Membros da família</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {membros.map(m => (
              <div key={m.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                <div className="h-9 w-9 rounded-full flex items-center justify-center text-lg shrink-0"
                  style={{ background: (m.cor ?? "#6366F1") + "22", border: `2px solid ${m.cor ?? "#6366F1"}` }}>
                  {m.icone ?? "👤"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {m.nome}
                    {m.user_id === user?.id && <span className="text-muted-foreground font-normal text-sm"> (você)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{m.tipo === "local" ? "Membro local" : "Conta ativa"}</p>
                </div>
                <Badge variant={m.role === "admin" ? "default" : "secondary"} className="gap-1 shrink-0">
                  {m.role === "admin" && <Crown className="h-3 w-3" />}
                  {m.role === "admin" ? "Admin" : "Membro"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Convidar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Convidar membro</CardTitle>
            <CardDescription>Gera um link válido por 7 dias. A pessoa cria a conta e entra automaticamente na família.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="Nome do convidado (ex: Daniella)"
                value={convidandoNome} onChange={e => setConvidandoNome(e.target.value)}
                onKeyDown={e => e.key === "Enter" && gerarConvite()} />
              <Button onClick={gerarConvite} disabled={salvando || !convidandoNome.trim()} className="gap-1 shrink-0">
                <Copy className="h-4 w-4" /> Copiar link
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">💡 O link será copiado — envie pelo WhatsApp ou email.</p>
          </CardContent>
        </Card>

        {/* Membro local */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Adicionar membro local</CardTitle>
            <CardDescription>Membros locais aparecem como responsáveis no orçamento mas não têm acesso ao app.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="Nome (ex: Pedro)"
                value={novoNome} onChange={e => setNovoNome(e.target.value)}
                onKeyDown={e => e.key === "Enter" && adicionarLocal()} />
              <Button variant="outline" onClick={adicionarLocal} disabled={salvando || !novoNome.trim()} className="gap-1 shrink-0">
                <UserPlus className="h-4 w-4" /> Adicionar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
