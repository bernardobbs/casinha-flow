// api/hermes-atualiza.ts
// Vercel Serverless Function (Web Fetch API — mesmo padrão de api/keepalive.ts
// e api/hermes-consulta.ts).
//
// Endpoint de ESCRITA para o Hermes Agent: adicionar item na lista de
// compras, lançar uma transação rápida, registrar abastecimento. Mesma
// autenticação (Bearer HERMES_SECRET_CASINHA) e mesmo family_id fixo via
// env var — nunca vem do payload.
//
// Ao contrário de hermes-consulta.ts, estas ações GRAVAM no banco. A
// responsabilidade de confirmar com a pessoa antes de chamar é do Hermes
// (ver hermes/CASINHA_hermes_skill_atualiza.md) — este endpoint não tem
// etapa de confirmação própria, só executa quando chamado.
//
// Quando uma referência (lista, conta, veículo, categoria) é ambígua ou não
// é encontrada, a resposta NUNCA adivinha: devolve {ok:false, ambiguo:true,
// opcoes:[...]} com uma mensagem_wa pronta pedindo pra especificar.

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

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

// ── helper genérico: resolve por nome (ilike) entre candidatos, ou usa o
// único existente se não houver nome dado. Nunca escolhe "no achismo"
// quando há mais de um. ──
function resolverUnico<T extends { nome: string }>(
  candidatos: T[],
  nomeBuscado: string | undefined,
  rotulo: string
): { item: T } | { ambiguo: true; opcoes: string[]; mensagem_wa: string } | { naoEncontrado: true; mensagem_wa: string } {
  let pool = candidatos;
  if (nomeBuscado) {
    const alvo = nomeBuscado.trim().toLowerCase();
    pool = candidatos.filter((c) => c.nome.toLowerCase().includes(alvo));
    if (pool.length === 0) {
      return {
        naoEncontrado: true,
        mensagem_wa: `Não encontrei ${rotulo} chamado(a) "${nomeBuscado}". Confira o nome ou cadastre no app.`,
      };
    }
  }
  if (pool.length === 1) return { item: pool[0] };
  if (pool.length === 0) {
    return { naoEncontrado: true, mensagem_wa: `Não encontrei nenhum(a) ${rotulo} cadastrado(a).` };
  }
  return {
    ambiguo: true,
    opcoes: pool.map((c) => c.nome),
    mensagem_wa: `Tenho mais de um(a) ${rotulo}: ${pool.map((c) => c.nome).join(", ")}. Qual deles?`,
  };
}

// ── 1. adicionar_item_lista ──────────────────────────────────────────────
async function adicionarItemLista(familyId: string, body: any) {
  const { nome, quantidade, unidade, preco_estimado, lista } = body ?? {};
  if (!nome) return json({ error: "nome é obrigatório" }, 400);

  const { data: listas, error: listasErr } = await supabase
    .from("shopping_lists" as any)
    .select("id, nome, status")
    .eq("family_id", familyId)
    .in("status", ["aberta", "em_andamento"]);
  if (listasErr) throw listasErr;

  let listaId: string;
  let listaNome: string;

  if ((listas ?? []).length === 0 && !lista) {
    const { data: novaLista, error: novaErr } = await supabase
      .from("shopping_lists" as any)
      .insert({ family_id: familyId, nome: "Lista de compras", status: "aberta" })
      .select("id, nome")
      .single();
    if (novaErr) throw novaErr;
    listaId = (novaLista as any).id;
    listaNome = (novaLista as any).nome;
  } else {
    const resolvido = resolverUnico(listas ?? [], lista, "lista aberta");
    if ("ambiguo" in resolvido || "naoEncontrado" in resolvido) return json({ ok: false, ...resolvido });
    listaId = (resolvido.item as any).id;
    listaNome = (resolvido.item as any).nome;
  }

  const qtd = quantidade ?? 1;
  const un = unidade ?? "un";
  const { error: itemErr } = await supabase.from("shopping_items" as any).insert({
    list_id: listaId,
    family_id: familyId,
    nome,
    quantidade: qtd,
    unidade: un,
    preco_estimado: preco_estimado ?? null,
  });
  if (itemErr) throw itemErr;

  // Recalcula total estimado da lista (mesma fórmula usada em compras.tsx)
  const { data: itens } = await supabase
    .from("shopping_items" as any)
    .select("preco_estimado, quantidade")
    .eq("list_id", listaId);
  const totalEstimado = (itens ?? []).reduce(
    (s: number, i: any) => s + Number(i.preco_estimado ?? 0) * Number(i.quantidade ?? 1),
    0
  );
  await supabase
    .from("shopping_lists" as any)
    .update({ total_estimado: totalEstimado })
    .eq("id", listaId);

  return json({
    ok: true,
    lista: listaNome,
    item: { nome, quantidade: qtd, unidade: un, preco_estimado: preco_estimado ?? null },
    resumo_wa: `✅ ${nome} (${qtd} ${un}) adicionado à lista "${listaNome}".`,
  });
}

// ── 2. lancar_transacao ──────────────────────────────────────────────────
async function lancarTransacao(familyId: string, userId: string, body: any) {
  const { descricao, valor, tipo, conta, categoria, data } = body ?? {};
  if (!descricao || !valor) return json({ error: "descricao e valor são obrigatórios" }, 400);
  const tipoFinal: "despesa" | "receita" = tipo === "receita" ? "receita" : "despesa";
  const tipoEn = tipoFinal === "receita" ? "income" : "expense";

  const { data: contas, error: contasErr } = await supabase
    .from("accounts")
    .select("id, nome, tipo")
    .eq("family_id", familyId)
    .eq("ativo", true);
  if (contasErr) throw contasErr;

  let contaResolvida;
  if (conta) {
    const r = resolverUnico(contas ?? [], conta, "conta");
    if ("ambiguo" in r || "naoEncontrado" in r) return json({ ok: false, ...r });
    contaResolvida = r.item;
  } else {
    const naoCartao = (contas ?? []).filter((c: any) => c.tipo !== "cartao");
    if (naoCartao.length === 0) {
      return json({
        ok: false,
        naoEncontrado: true,
        mensagem_wa: "Não encontrei uma conta padrão (não-cartão). Diga o nome da conta.",
      });
    }
    contaResolvida = naoCartao[0];
  }

  let categoryId: string | null = null;
  let categoriaNome: string | null = null;
  if (categoria) {
    const { data: cats } = await supabase
      .from("categories")
      .select("id, nome")
      .eq("family_id", familyId)
      .eq("tipo", tipoFinal);
    const r = resolverUnico(cats ?? [], categoria, "categoria");
    if ("ambiguo" in r || "naoEncontrado" in r) return json({ ok: false, ...r });
    categoryId = (r.item as any).id;
    categoriaNome = (r.item as any).nome;
  } else {
    // Sem categoria explícita: tenta a regra aprendida (mesmo padrão do
    // QuickAddButton no app — só aplica automático quando nivel===1).
    const { data: sug } = await supabase.rpc("categorize_transaction", {
      _family_id: familyId,
      _description: descricao,
      _dummy: false,
    });
    const first = Array.isArray(sug) ? sug[0] : null;
    if (first?.nivel === 1) {
      categoryId = first.category_id;
      const { data: cat } = await supabase
        .from("categories")
        .select("nome")
        .eq("id", categoryId)
        .maybeSingle();
      categoriaNome = cat?.nome ?? null;
    }
  }

  const dataFinal = data ?? hoje();
  const { error: txErr } = await supabase.from("transactions").insert({
    family_id: familyId,
    user_id: userId,
    account_id: (contaResolvida as any).id,
    category_id: categoryId,
    description: descricao,
    amount: valor,
    type: tipoEn,
    date: dataFinal,
    descricao,
    valor,
    tipo: tipoFinal,
    data: dataFinal,
    source: "manual",
    tipo_especial: "normal",
  });
  if (txErr) throw txErr;

  await supabase.rpc("recalc_account_balance", { p_account_id: (contaResolvida as any).id });

  const rotuloTipo = tipoFinal === "receita" ? "Receita" : "Despesa";
  const catTexto = categoriaNome ? ` (${categoriaNome})` : " — sem categoria, classifique no app";
  return json({
    ok: true,
    transacao: {
      descricao,
      valor,
      tipo: tipoFinal,
      conta: (contaResolvida as any).nome,
      categoria: categoriaNome,
      data: dataFinal,
    },
    resumo_wa: `✅ ${rotuloTipo} de ${fmtBRL(valor)} — "${descricao}" — lançada na conta ${(contaResolvida as any).nome}${catTexto}.`,
  });
}

// ── 3. registrar_abastecimento ───────────────────────────────────────────
async function registrarAbastecimento(familyId: string, userId: string, body: any) {
  const { litros, valor_pago, preco_litro, hodometro, veiculo, combustivel, posto, tanque_cheio, conta, data } =
    body ?? {};
  if (!litros || !valor_pago || !hodometro) {
    return json({ error: "litros, valor_pago e hodometro são obrigatórios" }, 400);
  }

  const { data: veiculos, error: veicErr } = await supabase
    .from("vehicles" as any)
    .select("id, apelido, tipo")
    .eq("family_id", familyId)
    .eq("ativo", true);
  if (veicErr) throw veicErr;
  const veiculosNomeado = (veiculos ?? []).map((v: any) => ({ ...v, nome: v.apelido }));
  const rVeic = resolverUnico(veiculosNomeado, veiculo, "veículo");
  if ("ambiguo" in rVeic || "naoEncontrado" in rVeic) return json({ ok: false, ...rVeic });
  const veiculoResolvido: any = rVeic.item;

  const { data: contas, error: contasErr } = await supabase
    .from("accounts")
    .select("id, nome, tipo")
    .eq("family_id", familyId)
    .eq("ativo", true);
  if (contasErr) throw contasErr;
  let contaResolvida: any;
  if (conta) {
    const r = resolverUnico(contas ?? [], conta, "conta");
    if ("ambiguo" in r || "naoEncontrado" in r) return json({ ok: false, ...r });
    contaResolvida = r.item;
  } else {
    const naoCartao = (contas ?? []).filter((c: any) => c.tipo !== "cartao");
    if (naoCartao.length === 0) {
      return json({ ok: false, naoEncontrado: true, mensagem_wa: "Não encontrei uma conta padrão. Diga o nome da conta." });
    }
    contaResolvida = naoCartao[0];
  }

  // Categoria: precisa bater com "gasolina" E o tipo do veículo (esta
  // família tem "Transporte — Gasolina Carro" e "... Moto" separadas — um
  // ilike só em "gasolina" é ambíguo com mais de um veículo).
  const { data: cats, error: catsErr } = await supabase
    .from("categories")
    .select("id, nome")
    .eq("family_id", familyId)
    .eq("tipo", "despesa")
    .ilike("nome", "%gasolina%");
  if (catsErr) throw catsErr;
  let categoriaEscolhida = (cats ?? []).find((c: any) =>
    c.nome.toLowerCase().includes(String(veiculoResolvido.tipo).toLowerCase())
  );
  if (!categoriaEscolhida && (cats ?? []).length === 1) categoriaEscolhida = cats![0];
  if (!categoriaEscolhida) {
    return json({
      ok: false,
      naoEncontrado: true,
      mensagem_wa: `Não achei uma categoria de combustível específica para "${veiculoResolvido.nome}". Cadastre uma categoria com "gasolina" e "${veiculoResolvido.tipo}" no nome, ou informe a categoria.`,
    });
  }

  const precoLitroFinal = preco_litro ?? Number(valor_pago) / Number(litros);
  const dataFinal = data ?? hoje();

  const { data: result, error } = await supabase.rpc("registrar_abastecimento" as any, {
    p_family_id: familyId,
    p_user_id: userId,
    p_vehicle_id: veiculoResolvido.id,
    p_account_id: (contaResolvida as any).id,
    p_category_id: (categoriaEscolhida as any).id,
    p_data: dataFinal,
    p_valor_pago: valor_pago,
    p_preco_litro: precoLitroFinal,
    p_litros: litros,
    p_hodometro: hodometro,
    p_combustivel_usado: combustivel ?? "gasolina",
    p_posto: posto ?? null,
    p_tanque_cheio: tanque_cheio ?? true,
  });
  if (error) throw error;

  return json({
    ok: true,
    abastecimento: {
      veiculo: veiculoResolvido.nome,
      litros,
      preco_litro: precoLitroFinal,
      valor_pago,
      hodometro,
      conta: (contaResolvida as any).nome,
    },
    resultado: result,
    resumo_wa: `⛽ Abastecimento registrado: ${litros}L a ${fmtBRL(precoLitroFinal)}/L (${fmtBRL(valor_pago)}) no ${veiculoResolvido.nome} — hodômetro ${hodometro}km.`,
  });
}

// ─────────────────────────────────────────────────────────────────────────
export default async function handler(req: Request) {
  if (!autenticado(req)) return json({ error: "Unauthorized" }, 401);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const familyId = process.env.HERMES_FAMILY_ID;
  const userId = process.env.HERMES_USER_ID;
  if (!familyId || !userId) {
    return json({ error: "HERMES_FAMILY_ID / HERMES_USER_ID não configurados" }, 500);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const { acao } = body ?? {};

  try {
    if (acao === "adicionar_item_lista") return await adicionarItemLista(familyId, body);
    if (acao === "lancar_transacao") return await lancarTransacao(familyId, userId, body);
    if (acao === "registrar_abastecimento") return await registrarAbastecimento(familyId, userId, body);
    return json(
      { error: "acao é obrigatória (adicionar_item_lista|lancar_transacao|registrar_abastecimento)" },
      400
    );
  } catch (err: any) {
    console.error("Erro em hermes-atualiza:", err);
    return json({ error: "Erro interno", detalhe: err.message }, 500);
  }
}
