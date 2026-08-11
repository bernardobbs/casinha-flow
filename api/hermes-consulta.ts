// api/hermes-consulta.ts
// Vercel Serverless Function (Web Fetch API — mesmo padrão de api/keepalive.ts)
//
// Endpoint de LEITURA para o Hermes Agent (agente de WhatsApp rodando fora,
// iniciando a conexão — mesmo modelo do projeto Sime: ver
// bernardobbs/sime/hermes/README.md e /api/hermes-mesarios.js por lá).
//
// Autenticação: Bearer <HERMES_SECRET_CASINHA>, mesmo segredo configurado no
// Hermes. Este app é de uma família só, então family_id vem direto de
// HERMES_FAMILY_ID (env var) — não do payload, pra ninguém conseguir pedir
// dado de outra família mesmo tendo o segredo certo (que também não existe
// mais de um aqui, mas por clareza/consistência com o padrão do Sime).
//
// Ações:
//   acao='saldo_categorias' → orçamento vs. gasto do mês por categoria
//   acao='estoque'          → itens com estoque baixo/crítico (ou todos, se todos=true)
//   acao='lista_compras'    → listas de compras abertas/em andamento e seus itens pendentes
//
// Cada resposta inclui `resumo_wa`: texto pronto pra mandar no WhatsApp, além
// dos dados estruturados — mesmo espírito do mensagem_wa do Sime.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL ?? "https://mmqoyozyeidxbgbxqnda.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const fmtBRL = (n: number) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function autenticado(req: Request): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.HERMES_SECRET_CASINHA;
  return !!secret && auth === `Bearer ${secret}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function saldoCategorias(familyId: string, mesInput?: string) {
  const mes = (mesInput ?? new Date().toISOString().slice(0, 7)).slice(0, 7);
  const { data, error } = await supabase.rpc("get_budget_status", {
    _family_id: familyId,
    _mes: mes,
  });
  if (error) throw error;

  const categorias = (data ?? []).map((c: any) => ({
    nome: c.category_nome,
    planejado: Number(c.valor_planejado),
    gasto: Number(c.valor_gasto),
    saldo: Number(c.valor_planejado) - Number(c.valor_gasto),
    pct_atingido: Number(c.pct_atingido),
    essencial: c.is_essencial,
  }));

  const linhas = categorias
    .sort((a, b) => a.saldo - b.saldo)
    .map((c) => {
      const alerta = c.saldo < 0 ? "🔴" : c.pct_atingido >= 90 ? "🟡" : "🟢";
      return `${alerta} ${c.nome}: ${fmtBRL(c.saldo)} restante de ${fmtBRL(c.planejado)} (${Math.round(c.pct_atingido)}% usado)`;
    });

  const resumo_wa = categorias.length
    ? `💰 Saldo por categoria (${mes}):\n${linhas.join("\n")}`
    : `Nenhum orçamento cadastrado para ${mes}.`;

  return { ok: true, mes, categorias, resumo_wa };
}

async function estoque(familyId: string, todos: boolean) {
  let q = supabase
    .from("v_stock_status" as any)
    .select(
      "nome, categoria, unidade, estoque_atual, estoque_minimo, status, dias_restantes, sugestao_compra"
    )
    .eq("family_id", familyId)
    .eq("ativo", true);
  if (!todos) q = q.in("status", ["baixo", "critico"]);
  const { data, error } = await q.order("dias_restantes", { ascending: true, nullsFirst: false });
  if (error) throw error;

  const itens = (data ?? []).map((p: any) => ({
    nome: p.nome,
    categoria: p.categoria,
    estoque_atual: Number(p.estoque_atual),
    unidade: p.unidade,
    status: p.status,
    dias_restantes: p.dias_restantes != null ? Number(p.dias_restantes) : null,
    sugestao_compra: p.sugestao_compra != null ? Number(p.sugestao_compra) : null,
  }));

  const linhas = itens.map((i) => {
    const alerta = i.status === "critico" ? "🔴" : i.status === "baixo" ? "🟡" : "⚪";
    const dias = i.dias_restantes != null ? ` (~${Math.round(i.dias_restantes)} dias)` : "";
    const sugestao = i.sugestao_compra ? ` — repor ${i.sugestao_compra} ${i.unidade}` : "";
    return `${alerta} ${i.nome}: ${i.estoque_atual} ${i.unidade}${dias}${sugestao}`;
  });

  const resumo_wa = itens.length
    ? `📦 Estoque${todos ? "" : " (baixo/crítico)"}:\n${linhas.join("\n")}`
    : todos
      ? "Nenhum item cadastrado no estoque."
      : "Nada em falta — estoque OK. ✅";

  return { ok: true, itens, resumo_wa };
}

async function listaCompras(familyId: string) {
  const { data: listas, error } = await supabase
    .from("shopping_lists" as any)
    .select("id, nome, status, total_estimado, data_prevista")
    .eq("family_id", familyId)
    .in("status", ["aberta", "em_andamento"])
    .order("created_at", { ascending: false });
  if (error) throw error;

  const listaIds = (listas ?? []).map((l: any) => l.id);
  let itensPorLista = new Map<string, any[]>();
  if (listaIds.length) {
    const { data: itens, error: itensErr } = await supabase
      .from("shopping_items" as any)
      .select("list_id, nome, quantidade, unidade, comprado")
      .in("list_id", listaIds)
      .eq("comprado", false);
    if (itensErr) throw itensErr;
    for (const it of itens ?? []) {
      const arr = itensPorLista.get((it as any).list_id) ?? [];
      arr.push(it);
      itensPorLista.set((it as any).list_id, arr);
    }
  }

  const resultado = (listas ?? []).map((l: any) => ({
    nome: l.nome,
    status: l.status,
    total_estimado: Number(l.total_estimado ?? 0),
    itens_pendentes: (itensPorLista.get(l.id) ?? []).map(
      (i: any) => `${i.nome} (${i.quantidade} ${i.unidade})`
    ),
  }));

  const blocos = resultado.map((l) => {
    const itens = l.itens_pendentes.length
      ? l.itens_pendentes.map((i) => `  • ${i}`).join("\n")
      : "  (sem itens pendentes)";
    return `🛒 ${l.nome} (${l.status}):\n${itens}\n  Total estimado: ${fmtBRL(l.total_estimado)}`;
  });

  const resumo_wa = resultado.length
    ? blocos.join("\n\n")
    : "Nenhuma lista de compras aberta no momento.";

  return { ok: true, listas: resultado, resumo_wa };
}

export default async function handler(req: Request) {
  if (!autenticado(req)) return json({ error: "Unauthorized" }, 401);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const familyId = process.env.HERMES_FAMILY_ID;
  if (!familyId) return json({ error: "HERMES_FAMILY_ID não configurado" }, 500);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const { acao } = body ?? {};

  try {
    if (acao === "saldo_categorias") {
      return json(await saldoCategorias(familyId, body?.mes));
    }
    if (acao === "estoque") {
      return json(await estoque(familyId, !!body?.todos));
    }
    if (acao === "lista_compras") {
      return json(await listaCompras(familyId));
    }
    return json(
      { error: "acao é obrigatória (saldo_categorias|estoque|lista_compras)" },
      400
    );
  } catch (err: any) {
    console.error("Erro em hermes-consulta:", err);
    return json({ error: "Erro interno", detalhe: err.message }, 500);
  }
}
