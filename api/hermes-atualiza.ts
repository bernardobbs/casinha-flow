// api/hermes-atualiza.ts
// Vercel Serverless Function (Web Fetch API — mesmo padrão de api/keepalive.ts
// e api/hermes-consulta.ts).
//
// Endpoint de ESCRITA para o Hermes Agent: adicionar item na lista de
// compras, lançar uma transação rápida, registrar abastecimento, atualizar
// estoque. Mesma autenticação (Bearer HERMES_SECRET_CASINHA) e mesmo
// family_id fixo via env var — nunca vem do payload.
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

// ── conta de pagamento: por nome explícito, ou por "débito"/"crédito".
// "débito" (ou nada informado) cai na conta corrente padrão (nunca escolhe
// cartão sozinho); "crédito" restringe às contas tipo=cartao — se houver
// mais de um cartão (caso normal aqui: BB visa Black e Nubank Roxinho),
// fica ambíguo e pergunta qual. ──
function resolverConta(
  contas: { id: string; nome: string; tipo: string }[],
  opts: { conta?: string; forma_pagamento?: string }
) {
  if (opts.conta) return resolverUnico(contas, opts.conta, "conta");
  const fp = opts.forma_pagamento?.trim().toLowerCase();
  if (fp === "credito" || fp === "crédito" || fp === "cartao" || fp === "cartão") {
    return resolverUnico(
      contas.filter((c) => c.tipo === "cartao"),
      undefined,
      "cartão de crédito"
    );
  }
  return resolverUnico(
    contas.filter((c) => c.tipo !== "cartao"),
    undefined,
    "conta de débito"
  );
}

type ProdutoEstoque = {
  id: string;
  nome: string;
  parent_id: string | null;
  estoque_atual: number;
  unidade: string;
};

// ── produto de estoque: aqui ~60% dos produtos têm uma "mãe" genérica
// (ex.: "Arroz", "Achocolatado") com "filhos" de marca (ex.: "Arroz Tio
// João 1kg", "Nescau 900g") — é assim que o estoque_atual de verdade é
// guardado e editado (só filhos e mães-sem-filho são editáveis; a mãe com
// filhos é só a soma, recalculada a cada edição de filho). Mas as pessoas
// no grupo falam pelo nome genérico ("acabou o arroz"), quase nunca pela
// marca — então resolve pela mãe primeiro, e só desambigua por marca
// quando a mãe tem mais de um filho cadastrado. ──
function resolverProdutoEstoque(
  produtos: ProdutoEstoque[],
  nomeBuscado: string
):
  | { item: ProdutoEstoque }
  | { ambiguo: true; opcoes: string[]; mensagem_wa: string }
  | { naoEncontrado: true; mensagem_wa: string } {
  const filhosPorMae = new Map<string, ProdutoEstoque[]>();
  for (const p of produtos) {
    if (p.parent_id) {
      const arr = filhosPorMae.get(p.parent_id) ?? [];
      arr.push(p);
      filhosPorMae.set(p.parent_id, arr);
    }
  }

  const maes = produtos.filter((p) => !p.parent_id);
  const rMae = resolverUnico(maes, nomeBuscado, "produto");
  if (!("naoEncontrado" in rMae)) {
    if ("ambiguo" in rMae) return rMae;
    const mae = rMae.item;
    const filhos = filhosPorMae.get(mae.id) ?? [];
    if (filhos.length === 0) return { item: mae };
    if (filhos.length === 1) return { item: filhos[0] };
    return {
      ambiguo: true,
      opcoes: filhos.map((f) => f.nome),
      mensagem_wa: `Tenho mais de uma marca de "${mae.nome}": ${filhos.map((f) => f.nome).join(", ")}. Qual delas?`,
    };
  }

  // Nome genérico não bateu com nenhuma mãe — tenta como nome de marca
  // direto (ex.: alguém falou "Nescau" em vez de "achocolatado").
  const filhos = produtos.filter((p) => p.parent_id);
  return resolverUnico(filhos, nomeBuscado, "produto");
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
  const { descricao, valor, tipo, conta, forma_pagamento, categoria, data } = body ?? {};
  if (!descricao || !valor) return json({ error: "descricao e valor são obrigatórios" }, 400);
  const tipoFinal: "despesa" | "receita" = tipo === "receita" ? "receita" : "despesa";
  const tipoEn = tipoFinal === "receita" ? "income" : "expense";

  const { data: contas, error: contasErr } = await supabase
    .from("accounts")
    .select("id, nome, tipo")
    .eq("family_id", familyId)
    .eq("ativo", true);
  if (contasErr) throw contasErr;

  const rConta = resolverConta(contas ?? [], { conta, forma_pagamento });
  if ("ambiguo" in rConta || "naoEncontrado" in rConta) return json({ ok: false, ...rConta });
  const contaResolvida = rConta.item;

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
  const {
    litros,
    valor_pago,
    preco_litro,
    hodometro,
    veiculo,
    combustivel,
    posto,
    tanque_cheio,
    conta,
    forma_pagamento,
    data,
  } = body ?? {};
  if (!valor_pago || !hodometro || (!litros && !preco_litro)) {
    return json(
      { error: "valor_pago, hodometro e (litros ou preco_litro) são obrigatórios" },
      400
    );
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
  const rConta = resolverConta(contas ?? [], { conta, forma_pagamento });
  if ("ambiguo" in rConta || "naoEncontrado" in rConta) return json({ ok: false, ...rConta });
  const contaResolvida: any = rConta.item;

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
  const litrosFinal = litros ?? Number(valor_pago) / Number(preco_litro);
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
    p_litros: litrosFinal,
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
      litros: litrosFinal,
      preco_litro: precoLitroFinal,
      valor_pago,
      hodometro,
      conta: (contaResolvida as any).nome,
    },
    resultado: result,
    resumo_wa: `⛽ Abastecimento registrado: ${litrosFinal.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}L a ${fmtBRL(precoLitroFinal)}/L (${fmtBRL(valor_pago)}) no ${veiculoResolvido.nome} — hodômetro ${hodometro}km — pago em ${(contaResolvida as any).nome}.`,
  });
}

// ── 4. atualizar_estoque ─────────────────────────────────────────────────
const fmtQtd = (n: number, und: string) =>
  `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${und}`;

async function atualizarEstoque(familyId: string, userId: string, body: any) {
  const { produto, quantidade, modo } = body ?? {};
  if (!produto) return json({ error: "produto é obrigatório" }, 400);
  const modoFinal: "acabou" | "entrada" | "consumo" | "definir" =
    modo === "entrada" || modo === "definir" || modo === "acabou"
      ? modo
      : quantidade == null
        ? "acabou"
        : "consumo";
  if (modoFinal !== "acabou" && (quantidade == null || Number(quantidade) < 0)) {
    return json({ error: "quantidade (>= 0) é obrigatória para modo diferente de 'acabou'" }, 400);
  }

  const { data: produtos, error: prodErr } = await supabase
    .from("products" as any)
    .select("id, nome, parent_id, estoque_atual, unidade")
    .eq("family_id", familyId)
    .eq("ativo", true);
  if (prodErr) throw prodErr;

  const r = resolverProdutoEstoque((produtos ?? []) as any, produto);
  if ("ambiguo" in r || "naoEncontrado" in r) return json({ ok: false, ...r });
  const item = r.item;

  const atual = Number(item.estoque_atual);
  let novo: number;
  if (modoFinal === "acabou") novo = 0;
  else if (modoFinal === "entrada") novo = atual + Number(quantidade);
  else if (modoFinal === "definir") novo = Number(quantidade);
  else novo = Math.max(0, atual - Number(quantidade)); // consumo

  const delta = novo - atual;
  if (delta === 0) {
    return json({
      ok: true,
      produto: item.nome,
      estoque_atual: atual,
      alterado: false,
      resumo_wa: `${item.nome} já está em ${fmtQtd(atual, item.unidade)} — nada mudou.`,
    });
  }

  const { error: updErr } = await supabase
    .from("products" as any)
    .update({ estoque_atual: novo })
    .eq("id", item.id);
  if (updErr) throw updErr;

  await supabase.from("stock_movements" as any).insert({
    product_id: item.id,
    family_id: familyId,
    user_id: userId,
    tipo: delta > 0 ? "entrada" : "saida",
    quantidade: Math.abs(delta),
  });

  // Item é "filho" (variante de marca) — recalcula a mãe como soma dos filhos,
  // mesma regra do app (estoque.tsx / revisão semanal).
  if (item.parent_id) {
    const irmaos = ((produtos ?? []) as any[]).filter(
      (p) => p.parent_id === item.parent_id && p.id !== item.id
    );
    const totalMae = irmaos.reduce((s, p) => s + Number(p.estoque_atual), 0) + novo;
    await supabase.from("products" as any).update({ estoque_atual: totalMae }).eq("id", item.parent_id);
  }

  // Recalcular consumo médio / dias restantes com o novo histórico de movimentos.
  await supabase.rpc("recalcular_consumo_estoque" as any, { p_product_id: item.id });

  const emoji = modoFinal === "acabou" ? "🔴" : modoFinal === "entrada" ? "📥" : modoFinal === "definir" ? "📝" : "📤";
  return json({
    ok: true,
    produto: item.nome,
    estoque_anterior: atual,
    estoque_atual: novo,
    modo: modoFinal,
    alterado: true,
    resumo_wa: `${emoji} ${item.nome}: ${fmtQtd(atual, item.unidade)} → ${fmtQtd(novo, item.unidade)}.`,
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
    if (acao === "atualizar_estoque") return await atualizarEstoque(familyId, userId, body);
    return json(
      {
        error:
          "acao é obrigatória (adicionar_item_lista|lancar_transacao|registrar_abastecimento|atualizar_estoque)",
      },
      400
    );
  } catch (err: any) {
    console.error("Erro em hermes-atualiza:", err);
    return json({ error: "Erro interno", detalhe: err.message }, 500);
  }
}
