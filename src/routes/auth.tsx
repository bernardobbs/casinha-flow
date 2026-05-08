import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Wallet, Loader2, ArrowLeft, Mail, Lock } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Casinha Flow" },
      { name: "description", content: "Casinha Flow — controle e liberdade andando juntos." },
    ],
  }),
  component: AuthPage,
});

const signInSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(72),
});

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Nome muito curto").max(80),
  familyName: z.string().trim().min(2, "Nome da família muito curto").max(80),
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(8, "Mínimo 8 caracteres").max(72),
});

const resetSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
});

const newPasswordSchema = z.object({
  password: z.string().min(8, "Mínimo 8 caracteres").max(72),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, {
  message: "As senhas não coincidem",
  path: ["confirm"],
});

type View = "auth" | "reset" | "reset-sent" | "new-password";

// Ícone Google
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View>("auth");
  const [passwordDone, setPasswordDone] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteAccepted, setInviteAccepted] = useState(false);

  // Aceitar convite após autenticação
  const acceptInvite = async (token: string) => {
    const { data, error } = await supabase.rpc("accept_invite" as any, { p_token: token });
    if (error) {
      toast.error("Convite inválido ou expirado");
      return false;
    }
    const result = data as any;
    toast.success(`✅ Bem-vindo à família ${result.family_name}!`);
    setInviteAccepted(true);
    return true;
  };

  useEffect(() => {
    // Detectar recovery token
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || hash.includes("type=email_change")) {
      setView("new-password");
      return;
    }

    // Detectar token de convite na URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get("invite");
    if (token) setInviteToken(token);

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        if (token) {
          await acceptInvite(token);
        }
        navigate({ to: "/dashboard" });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY") { setView("new-password"); return; }
      if (session && event !== "PASSWORD_RECOVERY") {
        if (inviteToken) await acceptInvite(inviteToken);
        navigate({ to: "/dashboard" });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate, inviteToken]);

  // ── Nova senha (recovery) ─────────────────────────────────
  const handleNewPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = newPasswordSchema.safeParse({
      password: form.get("password"),
      confirm: form.get("confirm"),
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setPasswordDone(true);
    toast.success("✅ Senha atualizada com sucesso!");
    setTimeout(() => navigate({ to: "/dashboard" }), 1500);
  };

  // ── Google OAuth ──────────────────────────────────────────
  const handleGoogle = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
        queryParams: { prompt: "select_account" },
      },
    });
    setLoading(false);
    if (error) toast.error("Erro ao conectar com Google: " + error.message);
  };

  // ── Login com email ───────────────────────────────────────
  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = signInSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) {
      toast.error(
        error.message === "Invalid login credentials"
          ? "Email ou senha incorretos"
          : error.message
      );
    }
  };

  // ── Cadastro ──────────────────────────────────────────────
  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = signUpSchema.safeParse({
      fullName: form.get("fullName"),
      familyName: form.get("familyName"),
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          full_name: parsed.data.fullName,
          family_name: parsed.data.familyName,
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(
        error.message.includes("already registered")
          ? "Esse email já está cadastrado"
          : error.message
      );
      return;
    }
    toast.success("Conta criada! Verifique seu email para confirmar.");
  };

  // ── Recuperar senha ───────────────────────────────────────
  const handleReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = resetSchema.safeParse({ email: form.get("email") });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setView("reset-sent");
  };

  // ── TELA DE NOVA SENHA (vinda do link do email) ───────────
  if (view === "new-password") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12"
        style={{ background: "var(--gradient-subtle)" }}>
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center"
              style={{ background: "var(--gradient-primary)" }}>
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg tracking-tight">Casinha Flow</span>
          </div>
          <Card className="border-border/60 shadow-[var(--shadow-elevated)]">
            {passwordDone ? (
              <CardHeader className="text-center space-y-2">
                <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                  <span className="text-2xl">✅</span>
                </div>
                <CardTitle>Senha atualizada!</CardTitle>
                <CardDescription>Redirecionando para o painel...</CardDescription>
              </CardHeader>
            ) : (
              <>
                <CardHeader>
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                    <Lock className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle>Criar nova senha</CardTitle>
                  <CardDescription>Escolha uma senha segura para sua conta.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleNewPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-password">Nova senha</Label>
                      <Input id="new-password" name="password" type="password"
                        required minLength={8} maxLength={72}
                        placeholder="Mínimo 8 caracteres" autoFocus />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirmar senha</Label>
                      <Input id="confirm-password" name="confirm" type="password"
                        required minLength={8} maxLength={72}
                        placeholder="Repita a senha" />
                    </div>
                    <Button type="submit" className="w-full h-11" disabled={loading}>
                      {loading
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : "Salvar nova senha"}
                    </Button>
                  </form>
                </CardContent>
              </>
            )}
          </Card>
        </div>
      </div>
    );
  }

  // ── TELA DE RECUPERAÇÃO DE SENHA ──────────────────────────
  if (view === "reset" || view === "reset-sent") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12"
        style={{ background: "var(--gradient-subtle)" }}>
        <div className="w-full max-w-md">
          <Link to="/auth" className="flex items-center justify-center gap-2 mb-8 text-foreground hover:opacity-80 transition">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg tracking-tight">Casinha Flow</span>
          </Link>

          <Card className="border-border/60 shadow-[var(--shadow-elevated)]">
            {view === "reset-sent" ? (
              <>
                <CardHeader className="text-center space-y-2">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Email enviado!</CardTitle>
                  <CardDescription>
                    Enviamos um link para redefinir sua senha.
                    Verifique sua caixa de entrada e spam.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full" onClick={() => setView("auth")}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Voltar ao login
                  </Button>
                </CardContent>
              </>
            ) : (
              <>
                <CardHeader>
                  <button onClick={() => setView("auth")}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors">
                    <ArrowLeft className="h-3.5 w-3.5" /> Voltar
                  </button>
                  <CardTitle>Recuperar senha</CardTitle>
                  <CardDescription>
                    Informe seu email e enviaremos um link para redefinir sua senha.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleReset} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reset-email">Email</Label>
                      <Input id="reset-email" name="email" type="email"
                        placeholder="voce@email.com" required maxLength={255} autoFocus />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : "Enviar link de recuperação"}
                    </Button>
                  </form>
                </CardContent>
              </>
            )}
          </Card>
        </div>
      </div>
    );
  }

  // ── TELA PRINCIPAL DE AUTH ────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "var(--gradient-subtle)" }}>
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8 text-foreground hover:opacity-80 transition">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
            <Wallet className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col items-start leading-tight">
            <span className="font-semibold text-lg tracking-tight">Casinha Flow</span>
            <span className="text-[11px] text-muted-foreground">controle e liberdade andando juntos</span>
          </div>
        </Link>

        <Card className="border-border/60 shadow-[var(--shadow-elevated)]">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl tracking-tight">Acesse sua conta</CardTitle>
            <CardDescription>Gerencie as finanças da sua família em um só lugar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Banner de convite */}
            {inviteToken && (
              <div className="rounded-lg bg-primary/10 border border-primary/20 px-4 py-3 flex items-start gap-2">
                <span className="text-lg">🎉</span>
                <div>
                  <p className="text-sm font-medium">Você foi convidado!</p>
                  <p className="text-xs text-muted-foreground">
                    Crie sua conta ou entre para se juntar à família.
                  </p>
                </div>
              </div>
            )}
            <Button variant="outline" className="w-full gap-2 h-11" onClick={handleGoogle} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
              Continuar com Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">ou continue com email</span>
              </div>
            </div>

            {/* Tabs Email/Cadastro */}
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>

              {/* LOGIN */}
              <TabsContent value="signin" className="mt-4">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input id="signin-email" name="email" type="email"
                      placeholder="voce@email.com" required maxLength={255} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signin-password">Senha</Label>
                      <button type="button" onClick={() => setView("reset")}
                        className="text-xs text-primary hover:underline">
                        Esqueci a senha
                      </button>
                    </div>
                    <Input id="signin-password" name="password" type="password"
                      required minLength={6} maxLength={72} />
                  </div>
                  <Button type="submit" className="w-full h-11" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
                  </Button>
                </form>
              </TabsContent>

              {/* CADASTRO */}
              <TabsContent value="signup" className="mt-4">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Seu nome</Label>
                      <Input id="signup-name" name="fullName" type="text"
                        placeholder="Bernardo" required maxLength={80} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-family">Nome da família</Label>
                      <Input id="signup-family" name="familyName" type="text"
                        placeholder="Família Silva" required maxLength={80} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" name="email" type="email"
                      placeholder="voce@email.com" required maxLength={255} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Senha</Label>
                    <Input id="signup-password" name="password" type="password"
                      required minLength={8} maxLength={72} />
                    <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
                  </div>
                  <Button type="submit" className="w-full h-11" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar conta grátis"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Ao continuar, você concorda com os termos de uso.
        </p>
      </div>
    </div>
  );
}
