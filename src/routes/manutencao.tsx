import { createFileRoute } from "@tanstack/react-router";
import { Wrench } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/manutencao")({
  head: () => ({ meta: [{ title: "Manutenção — Casinha Hub" }] }),
  component: ManutencaoPage,
});

function ManutencaoPage() {
  return (
    <div className="min-h-screen p-4" style={{ background: "var(--gradient-subtle)" }}>
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
            <Wrench className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Manutenção Doméstica</h1>
            <p className="text-sm text-muted-foreground">Controle tarefas e reparos da casa</p>
          </div>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Wrench className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Módulo de Manutenção</p>
            <p className="text-sm mt-1">Em implementação — em breve disponível</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
