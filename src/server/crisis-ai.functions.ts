import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DAILY_LIMIT = 5;

interface FinancialStateRow {
  mes: string;
  renda_mensal: number;
  total_essenciais: number;
  total_dividas: number;
  total_reserva: number;
  total_estilo_vida: number;
  saldo_atual: number;
  meta_essenciais: number;
  meta_estilo_vida: number;
  meta_reserva: number;
  modo_crise: boolean;
}

interface CrisisRow {
  id: string;
  estagio_atual: number;
  data_inicio: string;
  criterio_disparado: string | null;
  motivo_ativacao: string;
}

const aiTool = {
  type: "function" as const,
  function: {
    name: "analise_crise",
    description:
      "Retorna análise estruturada do estado de crise financeira da família.",
    parameters: {
      type: "object",
      properties: {
        modo_crise: { type: "boolean" },
        estagio: {
          anyOf: [{ type: "integer", enum: [1, 2, 3] }, { type: "null" }],
        },
        prazo_estimado_meses: { type: "number" },
        acoes_prioritarias: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 6,
        },
        alertas: { type: "array", items: { type: "string" } },
        previsao_retorno_5030020: {
          type: "string",
          description: "Data estimada no formato MM/YYYY",
        },
        distribuicao_recomendada: {
          type: "object",
          properties: {
            essenciais: { type: "number" },
            dividas: { type: "number" },
            reserva: { type: "number" },
            estilo_vida: { type: "number" },
          },
          required: ["essenciais", "dividas", "reserva", "estilo_vida"],
          additionalProperties: false,
        },
      },
      required: [
        "modo_crise",
        "estagio",
        "prazo_estimado_meses",
        "acoes_prioritarias",
        "alertas",
        "previsao_retorno_5030020",
        "distribuicao_recomendada",
      ],
      additionalProperties: false,
    },
  },
};

function buildPrompt(args: {
  states: FinancialStateRow[];
  crisis: CrisisRow | null;
}) {
  const { states, crisis } = args;
  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const linhas = states
    .map((s) => {
      const mes = new Date(s.mes + "T00:00:00").toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      });
      return `- ${mes}: renda ${fmt(Number(s.renda_mensal))}, essenciais ${fmt(Number(s.total_essenciais))}, dívidas ${fmt(Number(s.total_dividas))}, estilo de vida ${fmt(Number(s.total_estilo_vida))}, reserva ${fmt(Number(s.total_reserva))}, saldo ${fmt(Number(s.saldo_atual))}${s.modo_crise ? " (modo crise)" : ""}`;
    })
    .join("\n");

  const crisePart = crisis
    ? `\nCrise ativa:\n- Estágio atual: ${crisis.estagio_atual} de 3\n- Início: ${crisis.data_inicio}\n- Motivo: ${crisis.motivo_ativacao}\n- Critério disparado: ${crisis.criterio_disparado ?? "não informado"}`
    : "\nNenhuma crise ativa registrada.";

  return `Você é um assistente financeiro brasileiro especializado em famílias em situação de crise. Analise o estado financeiro abaixo (últimos 3 meses) e produza uma avaliação estruturada via a função analise_crise.

Estado financeiro recente:
${linhas || "(sem dados)"}
${crisePart}

Instruções:
- Considere a regra 50/30/20 como meta saudável (essenciais 50%, estilo de vida 30%, reserva 20%).
- Em crise, priorize essenciais e quitação/contenção de dívidas.
- Estágios: 1 Estabilização (estilo de vida 0%), 2 Recuperação (estilo até 10%), 3 Retorno (volta gradual).
- "prazo_estimado_meses" é o tempo estimado para sair da crise (0 se não há crise).
- "previsao_retorno_5030020" no formato MM/YYYY.
- "distribuicao_recomendada" usa percentuais que somam 100 (ex.: 60, 25, 10, 5).
- "acoes_prioritarias": 3 a 5 ações concretas, em português, no imperativo.`;
}

export const runCrisisAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // 1) family
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("family_id")
      .eq("id", userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    const familyId = profile?.family_id;
    if (!familyId) {
      return { error: "Família não encontrada." as const };
    }

    // 2) daily limit
    const { data: countData, error: cErr } = await supabase.rpc(
      "count_ai_runs_today",
      { _family_id: familyId },
    );
    if (cErr) throw new Error(cErr.message);
    const used = Number(countData ?? 0);
    if (used >= DAILY_LIMIT) {
      return {
        error: "Limite de análises atingido. Tente amanhã." as const,
        used,
        limit: DAILY_LIMIT,
      };
    }

    // 3) collect last 3 months of financial_state
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      .toISOString()
      .slice(0, 10);
    const { data: states } = await supabase
      .from("financial_state")
      .select(
        "mes, renda_mensal, total_essenciais, total_dividas, total_reserva, total_estilo_vida, saldo_atual, meta_essenciais, meta_estilo_vida, meta_reserva, modo_crise",
      )
      .eq("family_id", familyId)
      .gte("mes", start)
      .order("mes", { ascending: true });

    const { data: crisis } = await supabase
      .from("crisis_events")
      .select("id, estagio_atual, data_inicio, criterio_disparado, motivo_ativacao")
      .eq("family_id", familyId)
      .eq("ativo", true)
      .maybeSingle();

    const prompt = buildPrompt({
      states: (states ?? []) as FinancialStateRow[],
      crisis: (crisis ?? null) as CrisisRow | null,
    });

    // 4) call Lovable AI Gateway
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { error: "LOVABLE_API_KEY não configurada." as const };
    }

    const aiResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content:
                "Você é um conselheiro financeiro objetivo e empático. Sempre responda chamando a função analise_crise.",
            },
            { role: "user", content: prompt },
          ],
          tools: [aiTool],
          tool_choice: {
            type: "function",
            function: { name: "analise_crise" },
          },
        }),
      },
    );

    if (aiResp.status === 429) {
      return {
        error:
          "Muitas requisições à IA. Aguarde alguns segundos e tente de novo." as const,
      };
    }
    if (aiResp.status === 402) {
      return {
        error:
          "Créditos de IA esgotados. Adicione créditos no workspace." as const,
      };
    }
    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, txt);
      return { error: "Falha na análise de IA." as const };
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = toolCall?.function?.arguments;
    if (!argsStr) {
      return { error: "Resposta da IA sem dados estruturados." as const };
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(argsStr);
    } catch {
      return { error: "Resposta da IA inválida." as const };
    }

    // 5) persist run
    const { error: insErr } = await supabase.from("daily_ai_runs").insert([
      {
        family_id: familyId,
        user_id: userId,
        modulo: "crisis",
        prompt_usado: prompt,
        resposta_ia: parsed as never,
        custo_credito: 1,
      },
    ]);
    if (insErr) {
      console.error("daily_ai_runs insert error:", insErr.message);
    }

    return {
      analysis: parsed as Record<string, unknown>,
      used: used + 1,
      limit: DAILY_LIMIT,
    };
  });
