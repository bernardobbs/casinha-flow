import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Sparkles,
  Loader2,
  CalendarClock,
  ListChecks,
  PieChart,
  AlertTriangle,
  CalendarRange,
} from "lucide-react";
import {
  runCrisisAnalysis,
  type CrisisAnalysis,
} from "@/server/crisis-ai.functions";

const COLORS = {
  essenciais: "var(--primary)",
  dividas: "var(--destructive)",
  reserva: "var(--success)",
  estilo_vida: "#06b6d4",
} as const;

const LABELS = {
  essenciais: "Essenciais",
  dividas: "Dívidas",
  reserva: "Reserva",
  estilo_vida: "Estilo de vida",
} as const;

function DonutChart({ data }: { data: CrisisAnalysis["distribuicao_recomendada"] }) {
  const entries = (
    ["essenciais", "dividas", "reserva", "estilo_vida"] as const
  ).map((k) => ({ key: k, value: Number(data[k]) || 0 }));
  const total = entries.reduce((s, e) => s + e.value, 0) || 1;

  // build conic-gradient
  let acc = 0;
  const segments = entries
    .map((e) => {
      const start = (acc / total) * 360;
      acc += e.value;
      const end = (acc / total) * 360;
      return `${COLORS[e.key]} ${start}deg ${end}deg`;
    })
    .join(", ");

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div
        className="relative h-40 w-40 rounded-full shrink-0"
        style={{ background: `conic-gradient(${segments})` }}
        aria-label="Distribuição recomendada"
      >
        <div className="absolute inset-4 rounded-full bg-card flex items-center justify-center">
          <span className="text-xs text-muted-foreground">100%</span>
        </div>
      </div>
      <ul className="grid grid-cols-1 gap-2 text-sm">
        {entries.map((e) => (
          <li key={e.key} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ background: COLORS[e.key] }}
            />
            <span className="font-medium">{LABELS[e.key]}</span>
            <span className="text-muted-foreground tabular-nums ml-auto">
              {e.value}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface Props {
  hasCrisis: boolean;
}

export function CrisisAiAnalysis({ hasCrisis }: Props) {
  const runFn = useServerFn(runCrisisAnalysis);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<CrisisAnalysis | null>(null);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(
    null,
  );

  const handleRun = async () => {
    setLoading(true);
    try {
      const res = await runFn();
      if ("error" in res && res.error) {
        toast.error(res.error);
        if ("used" in res && typeof res.used === "number" && "limit" in res) {
          setUsage({ used: res.used, limit: res.limit });
        }
      } else if ("analysis" in res && res.analysis) {
        setAnalysis(res.analysis);
        setUsage({ used: res.used, limit: res.limit });
        toast.success("Análise concluída");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na análise");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border/60 shadow-[var(--shadow-soft)]">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Análise inteligente
            </CardTitle>
            <CardDescription>
              IA analisa seus últimos 3 meses e sugere um plano de saída.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {usage && (
              <Badge variant="outline" className="font-normal">
                {usage.used}/{usage.limit} hoje
              </Badge>
            )}
            <Button onClick={handleRun} disabled={loading} className="gap-2">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Analisar com IA
            </Button>
          </div>
        </div>
      </CardHeader>

      {!analysis && (
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {hasCrisis
              ? "Gere um plano com prazo estimado, ações prioritárias e distribuição recomendada."
              : "Mesmo sem crise ativa, a IA avalia se há sinais de alerta nos últimos meses."}{" "}
            Limite de 5 análises por dia por família.
          </p>
        </CardContent>
      )}

      {analysis && (
        <CardContent className="space-y-6">
          {/* Top: prazo + retorno */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border/60 p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <CalendarClock className="h-3.5 w-3.5" />
                Prazo estimado de saída
              </div>
              <p className="text-2xl font-semibold tracking-tight">
                {analysis.prazo_estimado_meses}{" "}
                <span className="text-base font-normal text-muted-foreground">
                  {analysis.prazo_estimado_meses === 1 ? "mês" : "meses"}
                </span>
              </p>
            </div>
            <div className="rounded-lg border border-border/60 p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <CalendarRange className="h-3.5 w-3.5" />
                Retorno ao 50/30/20
              </div>
              <p className="text-2xl font-semibold tracking-tight">
                {analysis.previsao_retorno_5030020 || "—"}
              </p>
            </div>
          </div>

          {/* Diagnóstico */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge
              variant="outline"
              className="font-normal"
              style={{
                borderColor: analysis.modo_crise
                  ? "var(--destructive)"
                  : "var(--success)",
                color: analysis.modo_crise
                  ? "var(--destructive)"
                  : "var(--success)",
              }}
            >
              {analysis.modo_crise
                ? "Cenário de crise"
                : "Fora de crise"}
            </Badge>
            {analysis.estagio !== null && (
              <Badge variant="secondary" className="font-normal">
                Estágio sugerido: {analysis.estagio}
              </Badge>
            )}
          </div>

          {/* Ações prioritárias */}
          <div>
            <h4 className="flex items-center gap-2 font-medium mb-3">
              <ListChecks className="h-4 w-4 text-primary" />
              Ações prioritárias
            </h4>
            <ol className="space-y-2">
              {analysis.acoes_prioritarias.map((acao, i) => (
                <li
                  key={i}
                  className="flex gap-3 rounded-md border border-border/60 p-3 text-sm"
                >
                  <span
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                    style={{
                      background: "var(--primary)",
                      color: "var(--primary-foreground)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span>{acao}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Alertas */}
          {analysis.alertas.length > 0 && (
            <div
              className="rounded-lg border border-destructive/40 p-4"
              style={{
                background:
                  "color-mix(in oklab, var(--destructive) 6%, transparent)",
              }}
            >
              <h4 className="flex items-center gap-2 font-medium mb-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Alertas
              </h4>
              <ul className="space-y-1 text-sm">
                {analysis.alertas.map((a, i) => (
                  <li key={i}>• {a}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Distribuição */}
          <div>
            <h4 className="flex items-center gap-2 font-medium mb-3">
              <PieChart className="h-4 w-4 text-primary" />
              Distribuição recomendada
            </h4>
            <DonutChart data={analysis.distribuicao_recomendada} />
          </div>
        </CardContent>
      )}
    </Card>
  );
}
