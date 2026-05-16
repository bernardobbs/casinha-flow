import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFamily } from "@/hooks/use-family";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Bot, Send, Loader2, User, RefreshCw, Lightbulb } from "lucide-react";

export const Route = createFileRoute("/assistente")({
  head: () => ({ meta: [{ title: "Assistente IA — Casinha Hub" }] }),
  component: AssistentePage,
});

interface Message {
  role: "user" | "assistant";
  content: string;
  ts: number;
}

const SUGESTOES = [
  "Quanto gastei este mês?",
  "Quais contas vencem esta semana?",
  "Como está o estoque da casa?",
  "Quanto ainda posso gastar?",
  "Qual categoria gastei mais?",
  "Quando preciso repor o estoque?",
];

const fmtBRL = (n: number) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function buildContext(familyId: string): Promise<string> {
  const hoje = new Date().toISOString().slice(0, 10);
  const mesInicio = hoje.slice(0, 7) + "-01";

  const [summary, previsao, estoque, manutencao] = await Promise.all([
    supabase.rpc("get_dashboard_summary" as any, { p_family_id: familyId }),
    supabase.rpc("get_previsao_mes" as any, { p_family_id: familyId }),
    supabase.rpc("get_previsao_estoque" as any, { p_family_id: familyId }),
    supabase.rpc("get_manutencao_pendente" as any, { p_family_id: familyId }),
  ]);

  const s = (summary.data as any)?.[0];
  const pendentes = (previsao.data ?? []) as any[];
  const estq = (estoque.data ?? []) as any[];
  const manut = (manutencao.data ?? []) as any[];

  const gastoTotal = s
    ? (s.total_essenciais ?? 0) + (s.total_estilo_vida ?? 0) + (s.total_dividas ?? 0)
    : 0;

  const ctx = `
DATA HOJE: ${hoje}

=== SITUAÇÃO FINANCEIRA DO MÊS ===
Renda: ${fmtBRL(s?.renda_mensal ?? 0)}
Gasto até agora: ${fmtBRL(gastoTotal)}
Saldo do mês: ${fmtBRL((s?.renda_mensal ?? 0) - gastoTotal)}
Projeção de fechamento: ${fmtBRL(s?.saldo_projetado ?? 0)}
Score de saúde: ${s?.score ?? 0}/100 (${s?.score_label ?? "—"})
Essenciais: ${fmtBRL(s?.total_essenciais ?? 0)} (meta: ${fmtBRL(s?.meta_essenciais ?? 0)})
Estilo de vida: ${fmtBRL(s?.total_estilo_vida ?? 0)} (meta: ${fmtBRL(s?.meta_estilo_vida ?? 0)})

=== CONTAS PENDENTES DO MÊS (${pendentes.length}) ===
${pendentes.length === 0
  ? "Nenhuma conta pendente."
  : pendentes.slice(0, 8).map((p: any) =>
      `- ${p.descricao}: ${fmtBRL(p.valor)} (vence ${p.data_vencimento}, ${p.origem})`
    ).join("\n")}
Total comprometido: ${fmtBRL(pendentes.reduce((s: number, p: any) => s + Number(p.valor), 0))}

=== ESTOQUE DA CASA (${estq.length} produtos) ===
${estq.length === 0
  ? "Nenhum produto cadastrado."
  : [
      ...estq.filter((e: any) => e.status === "zerado").slice(0, 3).map((e: any) =>
        `🔴 ${e.nome}: ZERADO`),
      ...estq.filter((e: any) => e.status === "critico").slice(0, 3).map((e: any) =>
        `🟠 ${e.nome}: ${e.quantidade_atual} ${e.unidade} (crítico)`),
      ...estq.filter((e: any) => e.dias_restantes !== null && e.dias_restantes <= 7 && e.status === "baixo")
        .slice(0, 3).map((e: any) =>
        `🟡 ${e.nome}: ~${e.dias_restantes} dias restantes`),
    ].join("\n") || "Estoque em dia."}

=== MANUTENÇÃO PENDENTE (${manut.length}) ===
${manut.length === 0
  ? "Nenhuma manutenção pendente."
  : manut.slice(0, 5).map((m: any) =>
      `- [${m.prioridade.toUpperCase()}] ${m.titulo}${m.dias_atraso > 0 ? ` (${m.dias_atraso}d atrasada)` : ""}`
    ).join("\n")}
`.trim();

  return ctx;
}

async function askAI(
  messages: Message[],
  familyId: string
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Sessão inválida");

  const SUPABASE_ANON = SUPABASE_PUBLISHABLE_KEY;
  const resp = await fetch(
    `${SUPABASE_URL}/functions/v1/ai-assistant`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
        "apikey": SUPABASE_ANON,
      },
      body: JSON.stringify({ messages, feature: "assistente" }),
    }
  );

  if (resp.status === 429) {
    const d = await resp.json();
    throw new Error(d.error ?? "Limite diário atingido");
  }
  if (!resp.ok) throw new Error(`Erro ${resp.status}`);
  const data = await resp.json();
  if (data.error) throw new Error(data.error);
  return data.text ?? "Não consegui gerar uma resposta.";
}


function AssistentePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { familyId, loading: familyLoading } = useFamily();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState("");
  const [contextLoaded, setContextLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!familyId || contextLoaded) return;
    buildContext(familyId).then(ctx => {
      setContext(ctx);
      setContextLoaded(true);
    });
  }, [familyId, contextLoaded]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (texto?: string) => {
    const msg = (texto ?? input).trim();
    if (!msg || loading || !familyId) return;
    setInput("");

    const userMsg: Message = { role: "user", content: msg, ts: Date.now() };
    const history = [...messages, userMsg];
    setMessages(history);
    setLoading(true);

    try {
      const resposta = await askAI(history, familyId);
      setMessages(prev => [...prev, { role: "assistant", content: resposta, ts: Date.now() }]);
    } catch (e: any) {
      toast.error("Erro ao consultar IA: " + (e?.message ?? ""));
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const hasApiKey = true; // Gemini via Edge Function

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--gradient-subtle)" }}>
      {/* Header */}
      <header className="border-b border-border/60 bg-card/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "var(--gradient-primary)" }}>
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight">Assistente Doméstico</p>
              <p className="text-[10px] text-muted-foreground leading-tight">
                {contextLoaded ? "✅ Dados carregados" : "⏳ Carregando dados..."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setMessages([])}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Mensagens */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-4 pt-4">
            <div className="text-center space-y-2">
              <div className="h-16 w-16 rounded-2xl mx-auto flex items-center justify-center"
                style={{ background: "var(--gradient-primary)" }}>
                <Bot className="h-8 w-8 text-primary-foreground" />
              </div>
              <h2 className="text-lg font-semibold">Olá! Sou o assistente da sua casa 👋</h2>
              <p className="text-sm text-muted-foreground">
                Posso responder sobre finanças, estoque, contas e muito mais.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {SUGESTOES.map((s) => (
                <button key={s} onClick={() => send(s)} disabled={!contextLoaded}
                  className="text-left text-xs p-3 rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-1"
                style={{ background: "var(--gradient-primary)" }}>
                <Bot className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
              m.role === "user"
                ? "bg-primary text-primary-foreground rounded-br-sm"
                : "bg-card border border-border/60 rounded-bl-sm"
            }`}>
              {m.content}
            </div>
            {m.role === "user" && (
              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
                <User className="h-3.5 w-3.5" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "var(--gradient-primary)" }}>
              <Bot className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <div className="bg-card border border-border/60 rounded-2xl rounded-bl-sm px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* Input fixo no rodapé */}
      <div className="sticky bottom-0 bg-card/95 backdrop-blur border-t border-border/60 p-3">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            placeholder={contextLoaded ? "Pergunte algo sobre sua casa..." : "Carregando dados..."}
            disabled={loading || !contextLoaded}
            className="flex-1"
          />
          <Button onClick={() => send()} disabled={loading || !input.trim() || !contextLoaded} size="icon">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
