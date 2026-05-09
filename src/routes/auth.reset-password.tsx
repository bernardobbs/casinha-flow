import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Lock, CheckCircle2 } from "lucide-react";
import { Wallet } from "lucide-react";

export const Route = createFileRoute("/auth/reset-password")({
  head: () => ({ meta: [{ title: "Nova senha — Casinha Hub" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [session, setSession] = useState(false);

  useEffect(() => {
    // Supabase injeta a sessão automaticamente via hash na URL
    supabase.auth.getSession().then(({ data }) => {
      setSession(!!data.session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setSession(true);
      if (event === "SIGNED_IN" && s) setSession(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = form.get("password") as string;
    const confirm = form.get("confirm") as string;

    if (password.length < 8) {
      toast.error("Mínimo 8 caracteres");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setDone(true);
    setTimeout(() => navigate({ to: "/dashboard" }), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "var(--gradient-subtle)" }}>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center"
            style={{ background: "var(--gradient-primary)" }}>
            <Wallet className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg tracking-tight">Casinha Hub</span>
        </div>

        <Card className="border-border/60 shadow-[var(--shadow-elevated)]">
          {done ? (
            <>
              <CardHeader className="text-center space-y-2">
                <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                </div>
                <CardTitle>Senha atualizada!</CardTitle>
                <CardDescription>Redirecionando para o painel...</CardDescription>
              </CardHeader>
            </>
          ) : !session ? (
            <>
              <CardHeader className="text-center">
                <CardTitle>Link inválido</CardTitle>
                <CardDescription>
                  Este link expirou ou já foi utilizado.
                  Solicite um novo link de recuperação.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => navigate({ to: "/auth" })}>
                  Voltar ao login
                </Button>
              </CardContent>
            </>
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
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Nova senha</Label>
                    <Input id="password" name="password" type="password"
                      required minLength={8} maxLength={72}
                      placeholder="Mínimo 8 caracteres" autoFocus />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm">Confirmar senha</Label>
                    <Input id="confirm" name="confirm" type="password"
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
