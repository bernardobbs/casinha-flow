import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Wallet, LogOut, Users, Home, Loader2, Crown, ShieldAlert, Target, Settings, Banknote, TrendingUp } from "lucide-react";
import { CrisisBanner } from "@/components/crisis-banner";
import { AlertsBell } from "@/components/alerts-bell";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel — Casinha Flow" },
      { name: "description", content: "Casinha Flow — controle e liberdade andando juntos. Painel financeiro compartilhado da sua família." },
    ],
  }),
  component: Dashboard,
});

interface Family {
  id: string;
  name: string;
}

interface Member {
  user_id: string;
  role: "admin" | "member";
  full_name: string | null;
  email: string | null;
}

function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/auth" });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      setLoading(true);
      const { data: profile } = await supabase
        .from("profiles")
        .select("family_id, families(id, name)")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.families) {
        const fam = profile.families as Family;
        setFamily(fam);

        const { data: memberRows } = await supabase
          .from("family_members")
          .select("user_id, role")
          .eq("family_id", fam.id);

        const userIds = (memberRows ?? []).map((m) => m.user_id);
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);

        const profilesById = new Map(
          (profileRows ?? []).map((p) => [p.id, p])
        );

        setMembers(
          (memberRows ?? []).map((m) => ({
            user_id: m.user_id,
            role: m.role,
            full_name: profilesById.get(m.user_id)?.full_name ?? null,
            email: profilesById.get(m.user_id)?.email ?? null,
          }))
        );
      }
      setLoading(false);
    };

    loadData();
  }, [user]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Sessão encerrada.");
    navigate({ to: "/auth" });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  const myMember = members.find((m) => m.user_id === user.id);

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      {/* Header */}
      <header className="border-b border-border/60 bg-card/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-semibold tracking-tight">Casinha Flow</span>
              <span className="text-[10px] text-muted-foreground hidden sm:block">controle e liberdade andando juntos</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AlertsBell />
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <CrisisBanner />

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        {/* Welcome */}
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Olá, {user.user_metadata?.full_name?.split(" ")[0] ?? "bem-vindo"}.
          </h1>
          <p className="text-muted-foreground mt-1">
            Bem-vindo ao painel financeiro compartilhado.
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="border-border/60 shadow-[var(--shadow-soft)]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Família</CardTitle>
              <Home className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-tight">{family?.name ?? "—"}</div>
              {myMember?.role === "admin" && (
                <Badge variant="secondary" className="mt-2 gap-1">
                  <Crown className="h-3 w-3" />
                  Admin
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-[var(--shadow-soft)]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Membros</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-tight">{members.length}</div>
              <p className="text-xs text-muted-foreground mt-1">pessoa(s) compartilhando dados</p>
            </CardContent>
          </Card>
        </div>

        {/* Members list */}
        <Card className="border-border/60 shadow-[var(--shadow-soft)]">
          <CardHeader>
            <CardTitle>Membros da família</CardTitle>
            <CardDescription>Todos os dados financeiros são compartilhados entre estes membros.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {members.map((m) => (
                <li key={m.user_id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {m.full_name ?? "Sem nome"}
                      {m.user_id === user.id && (
                        <span className="text-muted-foreground font-normal"> (você)</span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">{m.email}</p>
                  </div>
                  <Badge variant={m.role === "admin" ? "default" : "secondary"} className="gap-1">
                    {m.role === "admin" && <Crown className="h-3 w-3" />}
                    {m.role === "admin" ? "Admin" : "Membro"}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="grid sm:grid-cols-2 gap-4">
          <Card className="border-border/60 shadow-[var(--shadow-soft)] sm:col-span-2">
            <CardContent className="py-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center"
                  style={{ background: "color-mix(in oklab, var(--primary) 14%, transparent)", color: "var(--primary)" }}>
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold tracking-tight">📈 Situação atual</h3>
                  <p className="text-sm text-muted-foreground">Score de saúde, projeções, alertas e contas a pagar.</p>
                </div>
              </div>
              <Link to="/situacao"><Button>Abrir</Button></Link>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-[var(--shadow-soft)]">
            <CardContent className="py-6 flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold tracking-tight">Transações</h3>
                <p className="text-sm text-muted-foreground">Registre receitas, despesas e acompanhe o saldo.</p>
              </div>
              <Link to="/transactions">
                <Button>Abrir</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-[var(--shadow-soft)]">
            <CardContent className="py-6 flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold tracking-tight">Estado financeiro</h3>
                <p className="text-sm text-muted-foreground">Painel mensal 50/30/20 e renda do mês.</p>
              </div>
              <Link to="/financial-state">
                <Button>Abrir</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-[var(--shadow-soft)] sm:col-span-2">
            <CardContent className="py-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-lg flex items-center justify-center"
                  style={{
                    background: "color-mix(in oklab, var(--primary) 14%, transparent)",
                    color: "var(--primary)",
                  }}
                >
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold tracking-tight">Orçamentos</h3>
                  <p className="text-sm text-muted-foreground">
                    Limites por categoria + alertas automáticos.
                  </p>
                </div>
              </div>
              <Link to="/budgets">
                <Button variant="outline">Abrir</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-[var(--shadow-soft)] sm:col-span-2">
            <CardContent className="py-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-lg flex items-center justify-center"
                  style={{
                    background:
                      "color-mix(in oklab, var(--destructive) 14%, transparent)",
                    color: "var(--destructive)",
                  }}
                >
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold tracking-tight">Módulo Crise</h3>
                  <p className="text-sm text-muted-foreground">
                    Detecção automática + plano de saída em 3 estágios.
                  </p>
                </div>
              </div>
              <Link to="/crisis">
                <Button variant="outline">Abrir</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-[var(--shadow-soft)]">
            <CardContent className="py-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Banknote className="h-5 w-5 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold tracking-tight">Contas</h3>
                  <p className="text-sm text-muted-foreground">Bancos, carteiras e cartões.</p>
                </div>
              </div>
              <Link to="/contas"><Button variant="outline">Abrir</Button></Link>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-[var(--shadow-soft)]">
            <CardContent className="py-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold tracking-tight">Configurações</h3>
                  <p className="text-sm text-muted-foreground">Família, IA, notificações e regras.</p>
                </div>
              </div>
              <Link to="/configuracoes"><Button variant="outline">Abrir</Button></Link>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
