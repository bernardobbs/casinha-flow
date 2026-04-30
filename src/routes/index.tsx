import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Wallet, Users, Shield, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Finança Família — Finanças compartilhadas, simples" },
      { name: "description", content: "Sistema financeiro com famílias compartilhadas. Cadastre-se, convide sua família e organize tudo em um só lugar." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
            <Wallet className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-semibold tracking-tight">Finança Família</span>
        </div>
        <Link to="/auth">
          <Button variant="ghost" size="sm">Entrar</Button>
        </Link>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-16 pb-24">
        <section className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Compartilhe finanças com quem importa
          </div>
          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
            Finanças da família,<br />
            <span className="text-primary">simples e compartilhadas.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto">
            Crie uma conta, monte sua família e tenha todos os dados financeiros sincronizados entre todos os membros.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="gap-2">
                Começar grátis <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>

        <section className="mt-24 grid md:grid-cols-3 gap-6">
          {[
            { icon: Users, title: "Família compartilhada", desc: "Todos os membros veem os mesmos dados em tempo real." },
            { icon: Shield, title: "Seguro por padrão", desc: "Cada família tem seus dados isolados e protegidos." },
            { icon: Wallet, title: "Pronto para crescer", desc: "Base sólida para receitas, despesas e relatórios." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-6 rounded-xl bg-card border border-border/60 shadow-[var(--shadow-soft)]">
              <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center mb-4">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold tracking-tight">{title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{desc}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
