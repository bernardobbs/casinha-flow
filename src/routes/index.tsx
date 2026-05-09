import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Wallet, Users, ShoppingCart, Package, Wrench, BarChart3, ArrowRight, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Casinha Hub — O centro de controle da sua casa" },
      { name: "description", content: "Casinha Hub é o sistema de gestão doméstica que integra finanças, compras, estoque, manutenção e planejamento da sua casa." },
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

  const features = [
    { icon: Wallet, title: "Finanças familiares", desc: "Controle receitas, despesas, orçamentos e contas em tempo real." },
    { icon: ShoppingCart, title: "Listas de compras", desc: "Crie listas, marque itens e o estoque atualiza automaticamente." },
    { icon: Package, title: "Estoque inteligente", desc: "Acompanhe o consumo e receba alertas antes de acabar." },
    { icon: Wrench, title: "Manutenção da casa", desc: "Nunca esqueça uma tarefa ou conserto pendente." },
    { icon: Users, title: "Família compartilhada", desc: "Todos os membros veem os mesmos dados em tempo real." },
    { icon: BarChart3, title: "Planejamento", desc: "Revisões semanais, situação financeira e modo crise." },
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      {/* Header */}
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold tracking-tight">Casinha Hub</span>
            <span className="text-[10px] text-muted-foreground hidden sm:block">O centro de controle da sua casa</span>
          </div>
        </div>
        <Link to="/auth">
          <Button variant="ghost" size="sm">Entrar</Button>
        </Link>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-16 pb-24">
        {/* Hero */}
        <section className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Gestão doméstica completa
          </div>
          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
            O centro de controle<br />
            <span className="text-primary">da sua casa.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto">
            Finanças, compras, estoque, manutenção e planejamento familiar integrados em um único lugar. Sua casa organizada de verdade.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="gap-2">
                Começar grátis <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <p className="text-sm text-muted-foreground">Gratuito para uso pessoal.</p>
          </div>
        </section>

        {/* Slogans secundários */}
        <section className="mt-16 flex flex-wrap justify-center gap-3">
          {[
            "Sua casa organizada em um só lugar",
            "Finanças, compras e rotina integradas",
            "O sistema operacional da sua casa",
          ].map(s => (
            <span key={s} className="px-4 py-2 rounded-full border border-border/60 text-sm text-muted-foreground bg-card/60">
              {s}
            </span>
          ))}
        </section>

        {/* Features */}
        <section className="mt-20 grid sm:grid-cols-2 md:grid-cols-3 gap-5">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-6 rounded-xl bg-card border border-border/60 shadow-[var(--shadow-soft)]">
              <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center mb-4">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold tracking-tight">{title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{desc}</p>
            </div>
          ))}
        </section>

        {/* CTA Final */}
        <section className="mt-24 text-center">
          <div className="rounded-2xl p-10 border border-border/60 bg-card/60">
            <h2 className="text-3xl font-semibold tracking-tight">Pronto para organizar sua casa?</h2>
            <p className="mt-3 text-muted-foreground max-w-md mx-auto">
              Crie sua conta em segundos e comece a gerenciar tudo em um só lugar.
            </p>
            <Link to="/auth">
              <Button size="lg" className="mt-6 gap-2">
                Criar conta grátis <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
