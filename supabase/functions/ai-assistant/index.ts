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

async function callGemini(contents: any[], maxTokens = 1024, jsonMode = false) {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY não configurada nos secrets da function');
  for (const model of MODELS) {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
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
    return { text: (d as any).candidates?.[0]?.content?.parts?.[0]?.text ?? '', model, usage: (d as any).usageMetadata };
  }
  throw new Error('Todos os modelos Gemini indisponíveis (fora do ar ou descontinuados). Tente novamente em alguns minutos.');
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
      ``, `=== ESTOQUE CRITICO ===`,
      ...((estoque.data as any[] ?? []).map((e: any) => `${e.status} ${e.nome}: ${e.estoque_atual} ${e.unidade}`)),
      ``, `=== VEICULOS ===`,
      ...((veiculos.data as any[] ?? []).map((v: any) => `${v.apelido}: ${v.pct_tanque_estimado ?? '?'}% tanque`)),
    ].join('\n');

    const systemPrompt = `Assistente Domestico Casinha Hub. Dados reais da familia. Portugues brasileiro. Conciso.\n\n${context}`;
    const contents = (messages as any[]).map((m: any, i: number) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: i === 0 && m.role === 'user' ? systemPrompt + '\n\n' + m.content : m.content }]
    }));

    const t0 = Date.now();
    const { text, model, usage } = await callGemini(contents, 1024);
    const latency = Date.now() - t0;
    const tokIn = usage?.promptTokenCount ?? 0;
    const tokOut = usage?.candidatesTokenCount ?? 0;

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
