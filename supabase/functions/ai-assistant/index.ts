import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY');

// Tentar modelos em ordem de preferência
const MODELS = [
  'gemini-3.6-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
];

// Ferramentas que o assistente pode chamar sob demanda: consultas (dados que
// não estão no resumo inicial) e ações (que seguem o fluxo propor -> o
// usuário confirma em texto -> executar_acao). O modelo NUNCA deve chamar
// executar_acao/cancelar_acao na mesma rodada em que chamou um propor_* —
// isso é reforçado no system prompt, não só na descrição de cada tool.
const TOOLS = [{
  functionDeclarations: [
    {
      name: 'consultar_estoque',
      description: 'Busca o estoque atual de um ou mais produtos pelo nome (ex: "leite", "arroz", "sabão"). Use sempre que o usuário perguntar sobre a quantidade de um item que não apareceu no resumo inicial — o resumo só traz itens em situação crítica, baixa ou zerada, então qualquer item com estoque normal precisa ser consultado com esta ferramenta.',
      parameters: {
        type: 'OBJECT',
        properties: {
          termo: { type: 'STRING', description: 'Nome ou parte do nome do produto a buscar' },
        },
        required: ['termo'],
      },
    },
    {
      name: 'consultar_transacoes',
      description: 'Busca transações financeiras recentes por descrição. Use quando o usuário perguntar sobre um gasto específico (ex: "quanto gastei com gasolina") que não esteja no resumo inicial.',
      parameters: {
        type: 'OBJECT',
        properties: {
          termo: { type: 'STRING', description: 'Texto para buscar na descrição da transação' },
          dias: { type: 'NUMBER', description: 'Quantos dias atrás buscar. Padrão 30 se não informado.' },
        },
        required: ['termo'],
      },
    },
    {
      name: 'propor_lancamento',
      description: 'Prepara uma proposta de lançamento (despesa ou receita) para o usuário confirmar. NÃO grava nada de verdade — só monta o resumo e deixa pendente. Use quando o usuário pedir para "lançar", "registrar" ou "anotar" um gasto ou uma entrada. Depois de chamar esta ferramenta, mostre o resumo retornado ao usuário e pergunte se pode confirmar — só chame executar_acao numa mensagem futura, depois que o usuário confirmar explicitamente.',
      parameters: {
        type: 'OBJECT',
        properties: {
          descricao: { type: 'STRING', description: 'Descrição do lançamento' },
          valor: { type: 'NUMBER', description: 'Valor em reais, sempre positivo' },
          tipo: { type: 'STRING', description: '"despesa" ou "receita"' },
          categoria_nome: { type: 'STRING', description: 'Nome da categoria, se o usuário mencionar (opcional)' },
          conta_nome: { type: 'STRING', description: 'Nome da conta/cartão, se o usuário mencionar (opcional)' },
          data: { type: 'STRING', description: 'Data no formato YYYY-MM-DD. Se não informada, usa hoje.' },
        },
        required: ['descricao', 'valor', 'tipo'],
      },
    },
    {
      name: 'propor_estoque',
      description: 'Prepara uma proposta de ajuste de estoque para o usuário confirmar. NÃO grava nada de verdade. Use quando o usuário pedir para atualizar a quantidade de um produto ("acabou o leite", "comprei mais 2 arroz", "define o estoque de X em Y"). Se houver mais de um produto com esse nome (marcas diferentes), a ferramenta devolve as opções — pergunte ao usuário qual é antes de tentar de novo.',
      parameters: {
        type: 'OBJECT',
        properties: {
          produto_nome: { type: 'STRING', description: 'Nome ou parte do nome do produto' },
          quantidade: { type: 'NUMBER', description: 'Quantidade envolvida na operação' },
          operacao: { type: 'STRING', description: '"definir" (novo valor absoluto), "adicionar" ou "remover"' },
        },
        required: ['produto_nome', 'quantidade', 'operacao'],
      },
    },
    {
      name: 'propor_abastecimento',
      description: 'Prepara uma proposta de registro de abastecimento de combustível para o usuário confirmar. NÃO grava nada de verdade. Use quando o usuário disser que abasteceu o carro/moto.',
      parameters: {
        type: 'OBJECT',
        properties: {
          veiculo_apelido: { type: 'STRING', description: 'Apelido do veículo, como cadastrado (ex: "Cronos", "Biz")' },
          litros: { type: 'NUMBER' },
          valor_pago: { type: 'NUMBER', description: 'Valor total pago em reais' },
          hodometro: { type: 'NUMBER', description: 'Quilometragem atual do odômetro' },
          preco_litro: { type: 'NUMBER', description: 'Preço por litro, se informado (senão é calculado)' },
          combustivel_usado: { type: 'STRING', description: 'Ex: gasolina, etanol, diesel' },
          tanque_cheio: { type: 'BOOLEAN', description: 'Se encheu o tanque. Padrão true.' },
          posto: { type: 'STRING', description: 'Nome do posto, se mencionado' },
          data: { type: 'STRING', description: 'Data no formato YYYY-MM-DD. Se não informada, usa hoje.' },
        },
        required: ['veiculo_apelido', 'litros', 'valor_pago', 'hodometro'],
      },
    },
    {
      name: 'executar_acao',
      description: 'Executa de verdade uma ação que já foi proposta (propor_lancamento, propor_estoque ou propor_abastecimento) e que o usuário CONFIRMOU EXPLICITAMENTE em uma mensagem (ex: "confirma", "pode lançar", "sim", "isso mesmo"). NUNCA chame esta ferramenta na mesma rodada em que chamou um propor_* — espere a resposta do usuário primeiro. Use o action_id retornado pela ferramenta propor_* correspondente.',
      parameters: {
        type: 'OBJECT',
        properties: {
          action_id: { type: 'STRING', description: 'O action_id retornado por uma chamada anterior de propor_lancamento, propor_estoque ou propor_abastecimento' },
        },
        required: ['action_id'],
      },
    },
    {
      name: 'cancelar_acao',
      description: 'Cancela uma ação proposta que o usuário recusou ou quer mudar (ex: "não, deixa", "cancela", "muda o valor"). Use o action_id da proposta.',
      parameters: {
        type: 'OBJECT',
        properties: {
          action_id: { type: 'STRING', description: 'O action_id a cancelar' },
        },
        required: ['action_id'],
      },
    },
  ],
}];

async function executeTool(supabase: any, familyId: string, userId: string, name: string, args: any) {
  if (name === 'consultar_estoque') {
    const termo = String(args?.termo ?? '').trim();
    if (!termo) return { erro: 'termo de busca vazio' };
    const { data, error } = await supabase
      .from('v_stock_status')
      .select('nome, categoria, estoque_atual, unidade, status, dias_restantes')
      .eq('family_id', familyId)
      .ilike('nome', `%${termo}%`)
      .order('nome')
      .limit(15);
    if (error) return { erro: error.message };
    if (!data?.length) return { itens: [], observacao: 'Nenhum produto encontrado com esse nome no catálogo.' };
    return { itens: data };
  }
  if (name === 'consultar_transacoes') {
    const termo = String(args?.termo ?? '').trim();
    const dias = Number(args?.dias) > 0 ? Number(args.dias) : 30;
    const desde = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
    let q = supabase
      .from('transactions')
      .select('descricao, description, valor, amount, tipo, type, data, date, category')
      .eq('family_id', familyId)
      .gte('data', desde)
      .order('data', { ascending: false })
      .limit(20);
    if (termo) q = q.ilike('descricao', `%${termo}%`);
    const { data, error } = await q;
    if (error) return { erro: error.message };
    const transacoes = (data ?? []).map((t: any) => ({
      descricao: t.descricao ?? t.description,
      valor: t.valor ?? t.amount,
      tipo: t.tipo ?? t.type,
      data: t.data ?? t.date,
      categoria: t.category,
    }));
    if (!transacoes.length) return { transacoes: [], observacao: `Nenhuma transação encontrada nos últimos ${dias} dias com esse termo.` };
    return { transacoes };
  }
  if (name === 'propor_lancamento') {
    const { data, error } = await supabase.rpc('ai_propor_transacao', {
      p_family_id: familyId, p_user_id: userId,
      p_descricao: args?.descricao, p_valor: args?.valor, p_tipo: args?.tipo,
      p_categoria_nome: args?.categoria_nome ?? null, p_conta_nome: args?.conta_nome ?? null,
      p_data: args?.data ?? new Date().toISOString().slice(0, 10),
    });
    if (error) return { erro: error.message };
    return data;
  }
  if (name === 'propor_estoque') {
    const { data, error } = await supabase.rpc('ai_propor_estoque', {
      p_family_id: familyId, p_user_id: userId,
      p_produto_nome: args?.produto_nome, p_quantidade: args?.quantidade, p_operacao: args?.operacao,
    });
    if (error) return { erro: error.message };
    return data;
  }
  if (name === 'propor_abastecimento') {
    const { data, error } = await supabase.rpc('ai_propor_abastecimento', {
      p_family_id: familyId, p_user_id: userId,
      p_veiculo_apelido: args?.veiculo_apelido, p_litros: args?.litros, p_valor_pago: args?.valor_pago,
      p_hodometro: args?.hodometro, p_preco_litro: args?.preco_litro ?? null,
      p_combustivel_usado: args?.combustivel_usado ?? null, p_tanque_cheio: args?.tanque_cheio ?? true,
      p_posto: args?.posto ?? null, p_data: args?.data ?? new Date().toISOString().slice(0, 10),
    });
    if (error) return { erro: error.message };
    return data;
  }
  if (name === 'executar_acao') {
    const { data, error } = await supabase.rpc('ai_executar_acao', {
      p_family_id: familyId, p_user_id: userId, p_action_id: args?.action_id,
    });
    if (error) return { erro: error.message };
    return data;
  }
  if (name === 'cancelar_acao') {
    const { data, error } = await supabase.rpc('ai_cancelar_acao', {
      p_family_id: familyId, p_action_id: args?.action_id,
    });
    if (error) return { erro: error.message };
    return data;
  }
  return { erro: `ferramenta desconhecida: ${name}` };
}

async function callGemini(contents: any[], maxTokens = 1024, jsonMode = false, tools?: any) {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY não configurada nos secrets da function');
  for (const model of MODELS) {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          ...(tools ? { tools } : {}),
          generationConfig: {
            maxOutputTokens: maxTokens, temperature: 0.3,
            ...(jsonMode ? { responseMimeType: 'application/json' } : {})
          }
        }) }
    );
    if (resp.status === 429 || resp.status === 404 || resp.status === 503) {
      console.log(`[ai-assistant] ${model} ${resp.status}, trying next...`);
      continue; // Tentar próximo modelo
    }
    if (!resp.ok) throw new Error(`Gemini ${model} ${resp.status}: ${await resp.text()}`);
    const d = await resp.json();
    const parts = (d as any).candidates?.[0]?.content?.parts ?? [];
    return { parts, model, usage: (d as any).usageMetadata };
  }
  throw new Error('Todos os modelos Gemini indisponíveis (fora do ar ou descontinuados). Tente novamente em alguns minutos.');
}

// Roda o loop de function-calling: manda o prompt, e se o modelo pedir uma
// ferramenta, executa e devolve o resultado até 4 rodadas — depois disso
// força o encerramento com o que já tiver, para não deixar a conversa presa
// em chamadas repetidas.
async function runAssistant(supabase: any, familyId: string, userId: string, contents: any[]) {
  let working = contents;
  let model = '';
  let tokIn = 0, tokOut = 0;
  for (let round = 0; round < 4; round++) {
    const result = await callGemini(working, 1024, false, TOOLS);
    model = result.model;
    tokIn += result.usage?.promptTokenCount ?? 0;
    tokOut += result.usage?.candidatesTokenCount ?? 0;

    const calls = result.parts.filter((p: any) => p.functionCall);
    if (calls.length === 0) {
      const text = result.parts.map((p: any) => p.text ?? '').join('');
      return { text, model, tokIn, tokOut };
    }

    working = [...working, { role: 'model', parts: result.parts }];
    const responseParts = [];
    for (const call of calls) {
      const toolResult = await executeTool(supabase, familyId, userId, call.functionCall.name, call.functionCall.args);
      responseParts.push({ functionResponse: { name: call.functionCall.name, response: toolResult } });
    }
    working = [...working, { role: 'user', parts: responseParts }];
  }
  return { text: 'Não consegui reunir todos os dados pra responder isso agora — tenta reformular a pergunta?', model, tokIn, tokOut };
}

function extractJSON(text: string): any[] {
  try { const r = JSON.parse(text); return Array.isArray(r) ? r : [r]; } catch { /* */ }
  const m = text.match(/\[[\s\S]*?\]/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* */ } }
  const objs: any[] = [];
  for (const m2 of text.matchAll(/\{[^{}]+\}/g)) {
    try { objs.push(JSON.parse(m2[0])); } catch { /* */ }
  }
  return objs;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const auth = req.headers.get('Authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    const { data: profile } = await supabase.from('profiles').select('family_id').eq('id', user.id).maybeSingle();
    const familyId = (profile as any)?.family_id;
    if (!familyId) return new Response(JSON.stringify({ error: 'Sem familia' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json();
    const { messages, feature = 'assistente' } = body;

    // CATEGORIZACAO
    if (feature === 'categorizacao') {
      const { txs, categories, accounts } = body;
      if (!txs?.length) return new Response(JSON.stringify({ results: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const prompt = `Voce e um classificador financeiro brasileiro. Categorize cada transacao.\nResponda SOMENTE com array JSON: [{"id":"uuid","category_id":"uuid","account_id":"uuid_ou_null"}]\n\nTransacoes:\n${JSON.stringify(txs.map((t: any) => ({ id: t.id, desc: t.description, valor: Math.abs(t.amount), tipo: t.type === 'income' ? 'receita' : 'despesa' })))}\n\nCategorias:\n${JSON.stringify((categories ?? []).map((c: any) => ({ id: c.id, nome: c.nome, tipo: c.tipo })))}\n\nContas:\n${JSON.stringify(((accounts ?? []).map((a: any) => ({ id: a.id, nome: a.nome, tipo: a.tipo }))))}` ;
      const { text } = await callGemini([{ role: 'user', parts: [{ text: prompt }] }], 2048, true);
      const results = extractJSON(text);
      return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ASSISTENTE
    const today = new Date().toISOString().slice(0, 10);
    const [{ count }, { data: limitSetting }] = await Promise.all([
      supabase.from('ai_logs').select('id', { count: 'exact', head: true })
        .eq('family_id', familyId).gte('created_at', today + 'T00:00:00Z'),
      supabase.from('family_settings').select('valor').eq('family_id', familyId).eq('chave', 'ai_daily_limit').maybeSingle(),
    ]);
    const dailyLimit = parseInt((limitSetting as any)?.valor ?? '20', 10) || 20;
    if ((count ?? 0) >= dailyLimit) return new Response(JSON.stringify({ error: `Limite de ${dailyLimit} usos/dia atingido` }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const [summary, accs, budget, estoque, veiculos, contas, recorrentes] = await Promise.all([
      supabase.rpc('get_dashboard_summary', { p_family_id: familyId }),
      supabase.from('accounts').select('nome, tipo, saldo_atual').eq('family_id', familyId).eq('ativo', true),
      supabase.rpc('get_budget_status', { p_family_id: familyId, p_mes: new Date().toISOString().slice(0, 7) + '-01' }),
      supabase.from('v_stock_status').select('nome, status, estoque_atual, unidade, dias_restantes').eq('family_id', familyId).is('parent_id', null).in('status', ['zerado', 'critico', 'baixo']).limit(8),
      supabase.from('v_vehicle_status').select('apelido, pct_tanque_estimado, km_estimados_restantes, gasto_mes').eq('family_id', familyId),
      supabase.from('bills_reminders').select('descricao, valor_estimado, data_vencimento').eq('family_id', familyId).eq('status', 'pendente').order('data_vencimento').limit(5),
      supabase.from('recurring_transactions').select('descricao, valor, tipo').eq('family_id', familyId).eq('ativo', true).limit(10),
    ]);

    const s = Array.isArray(summary.data) ? summary.data[0] : (summary.data as any);
    const fmt = (n: number) => `R$ ${Number(n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    const mes = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const context = [
      `=== FAMILIA - ${mes.toUpperCase()} ===`,
      `Score: ${s?.score ?? 0}/100 | Renda: ${fmt(s?.renda_mensal ?? 0)} | Gasto: ${fmt((s?.total_essenciais ?? 0) + (s?.total_estilo_vida ?? 0))}`,
      `Saldo: ${fmt(s?.saldo_atual ?? 0)} | Projecao: ${fmt(s?.saldo_projetado ?? 0)}`,
      ``, `=== CONTAS ===`,
      ...((accs.data as any[] ?? []).map((a: any) => `${a.nome}: ${fmt(a.saldo_atual)}`)),
      ``, `=== ORCAMENTO (>50%) ===`,
      ...((budget.data as any[] ?? []).filter((b: any) => b.pct_atingido > 50).slice(0, 6).map((b: any) => `${b.category_nome}: ${fmt(b.valor_gasto)}/${fmt(b.valor_planejado)} (${b.pct_atingido?.toFixed(0)}%)`)),
      ``, `=== A PAGAR ===`,
      ...((contas.data as any[] ?? []).map((c: any) => `${c.descricao}: ${fmt(c.valor_estimado)}`)),
      ``, `=== ESTOQUE CRITICO (apenas o pior — use a ferramenta consultar_estoque para qualquer outro item) ===`,
      ...((estoque.data as any[] ?? []).map((e: any) => `${e.status} ${e.nome}: ${e.estoque_atual} ${e.unidade}`)),
      ``, `=== VEICULOS ===`,
      ...((veiculos.data as any[] ?? []).map((v: any) => `${v.apelido}: ${v.pct_tanque_estimado ?? '?'}% tanque`)),
    ].join('\n');

    const systemPrompt = `Assistente Domestico Casinha Hub. Dados reais da familia. Portugues brasileiro. Conciso.

Voce tem ferramentas de CONSULTA (consultar_estoque, consultar_transacoes) para buscar dados que NAO estao no resumo abaixo — o resumo so traz o essencial (ex: estoque critico), nao o catalogo/historico completo. SEMPRE use a ferramenta antes de dizer que um item "nao esta cadastrado" ou "nao aparece" — so responda isso se a ferramenta realmente nao encontrar nada.

Voce tambem tem ferramentas de ACAO (propor_lancamento, propor_estoque, propor_abastecimento, executar_acao, cancelar_acao) para registrar coisas de verdade no sistema. O fluxo e SEMPRE em duas etapas:
1. Quando o usuario pedir para lancar/registrar/anotar algo, chame o propor_* correspondente. Ele NAO grava nada — so monta um resumo. Mostre esse resumo ao usuario e pergunte se pode confirmar.
2. So chame executar_acao numa mensagem FUTURA, depois que o usuario confirmar explicitamente (ex: "confirma", "sim", "pode lancar", "isso mesmo"). NUNCA chame executar_acao na mesma rodada em que chamou um propor_* — isso pularia a confirmacao do usuario, o que e proibido.
Se o usuario recusar ou quiser mudar algo, chame cancelar_acao. Se um propor_* retornar "opcoes" (mais de um produto encontrado) ou um "aviso" de possivel duplicata, pergunte ao usuario antes de prosseguir em vez de escolher por conta propria.

${context}`;
    const contents = (messages as any[]).map((m: any, i: number) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: i === 0 && m.role === 'user' ? systemPrompt + '\n\n' + m.content : m.content }]
    }));

    const t0 = Date.now();
    const { text, model, tokIn, tokOut } = await runAssistant(supabase, familyId, user.id, contents);
    const latency = Date.now() - t0;

    await supabase.from('ai_logs').insert({
      family_id: familyId, user_id: user.id, feature,
      prompt: (messages as any[])[messages.length - 1]?.content?.slice(0, 500),
      response: text.slice(0, 500), tokens_input: tokIn, tokens_output: tokOut,
      estimated_cost: tokIn * 0.000000075 + tokOut * 0.0000003,
      latency_ms: latency, success: true,
    }).then(() => {}).catch(console.error);

    return new Response(JSON.stringify({ text, model, tokIn, tokOut, latency }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('[ai-assistant]', e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
