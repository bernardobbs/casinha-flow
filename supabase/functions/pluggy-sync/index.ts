import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLUGGY_CLIENT_ID = Deno.env.get('PLUGGY_CLIENT_ID');
const PLUGGY_CLIENT_SECRET = Deno.env.get('PLUGGY_CLIENT_SECRET');
const PLUGGY_BASE = 'https://api.pluggy.ai';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function getApiKey(): Promise<string> {
  if (!PLUGGY_CLIENT_ID || !PLUGGY_CLIENT_SECRET) throw new Error('PLUGGY_CLIENT_ID/PLUGGY_CLIENT_SECRET não configurados nos secrets da function');
  const resp = await fetch(`${PLUGGY_BASE}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: PLUGGY_CLIENT_ID, clientSecret: PLUGGY_CLIENT_SECRET }),
  });
  if (!resp.ok) throw new Error(`Pluggy /auth ${resp.status}: ${await resp.text()}`);
  const d = await resp.json();
  return d.apiKey;
}

async function pluggyGet(apiKey: string, path: string) {
  const resp = await fetch(`${PLUGGY_BASE}${path}`, { headers: { 'X-API-KEY': apiKey } });
  if (!resp.ok) throw new Error(`Pluggy GET ${path} ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

// Mapeia tipo/subtipo de conta da Pluggy pro enum interno de accounts.tipo
function mapAccountTipo(pluggyType: string, subtype?: string): string {
  if (pluggyType === 'CREDIT') return 'cartao';
  if (subtype === 'SAVINGS_ACCOUNT') return 'poupanca';
  return 'corrente';
}

// Sincroniza transações de UMA conta já vinculada (accounts.pluggy_account_id setado).
// Usa o campo "type" (DEBIT/CREDIT) da Pluggy pra decidir despesa/receita — mais
// confiável que o sinal de "amount", que varia entre conta corrente e cartão.
async function syncAccountTransactions(supabase: any, apiKey: string, familyId: string, account: any) {
  // Sempre busca os últimos 90 dias — o índice único em (family_id, external_id)
  // garante que reimportar o mesmo período não duplica nada, então não precisa
  // controlar "desde quando sincronizei" por conta.
  const from = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);

  let page = 1;
  let totalPages = 1;
  let imported = 0;
  let skipped = 0;

  do {
    const data = await pluggyGet(apiKey, `/transactions?accountId=${account.pluggy_account_id}&from=${from}&page=${page}&pageSize=200`);
    totalPages = data.totalPages ?? 1;
    const results = data.results ?? [];

    for (const tx of results) {
      const isExpense = tx.type === 'DEBIT';
      const valor = Math.abs(Number(tx.amount));
      const descricao = tx.description || tx.descriptionRaw || 'Transação Open Finance';
      const dataTx = String(tx.date).slice(0, 10);

      const { error } = await supabase.from('transactions').upsert(
        {
          family_id: familyId,
          account_id: account.id,
          descricao,
          description: descricao,
          valor,
          amount: valor,
          tipo: isExpense ? 'despesa' : 'receita',
          type: isExpense ? 'expense' : 'income',
          data: dataTx,
          date: dataTx,
          source: 'importado',
          external_id: `pluggy:${tx.id}`,
        },
        { onConflict: 'family_id,external_id', ignoreDuplicates: true },
      );
      if (error) { skipped++; console.error('[pluggy-sync] erro ao inserir transação', tx.id, error.message); }
      else imported++;
    }
    page++;
  } while (page <= totalPages);

  await supabase.rpc('recalc_account_balance', { p_account_id: account.id });

  return { imported, skipped };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401);
    const { data: profile } = await supabase.from('profiles').select('family_id').eq('id', user.id).maybeSingle();
    const familyId = (profile as any)?.family_id;
    if (!familyId) return json({ error: 'Sem familia' }, 400);

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ---- connect_token: gera o token que o widget PluggyConnect usa no front ----
    if (action === 'connect_token') {
      const apiKey = await getApiKey();
      const resp = await fetch(`${PLUGGY_BASE}/connect_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
        body: JSON.stringify({ options: { clientUserId: familyId } }),
      });
      if (!resp.ok) throw new Error(`Pluggy /connect_token ${resp.status}: ${await resp.text()}`);
      const d = await resp.json();
      return json({ accessToken: d.accessToken });
    }

    // ---- register_item: chamado pelo onSuccess do widget, com o itemId criado ----
    if (action === 'register_item') {
      const { item_id, connector_name } = body;
      if (!item_id) return json({ error: 'item_id obrigatorio' }, 400);
      const { error } = await supabase.from('pluggy_items').upsert(
        { family_id: familyId, item_id, connector_name: connector_name ?? null, status: 'UPDATED' },
        { onConflict: 'family_id,item_id' },
      );
      if (error) return json({ error: error.message }, 500);
      return json({ sucesso: true });
    }

    // ---- client_error_log: repassa erro que so aconteceu no widget do navegador
    //      pros logs da function, ja que onError da PluggyConnect nunca chega
    //      no servidor por conta propria — sem isso, o unico jeito de ver a causa
    //      seria abrir o devtools do navegador do usuario. ----
    if (action === 'client_error_log') {
      const { context, error, raw } = body;
      console.error('[pluggy-sync][client]', context, error, raw);
      return json({ logged: true });
    }

    // ---- list_accounts: lista contas da Pluggy pros items da familia, marcando vinculadas ----
    if (action === 'list_accounts') {
      const apiKey = await getApiKey();
      const { data: items } = await supabase.from('pluggy_items').select('item_id, connector_name').eq('family_id', familyId);
      const { data: linked } = await supabase.from('accounts').select('id, nome, pluggy_account_id').eq('family_id', familyId).not('pluggy_account_id', 'is', null);
      const linkedIds = new Set((linked ?? []).map((a: any) => a.pluggy_account_id));

      const found: any[] = [];
      for (const it of items ?? []) {
        const data = await pluggyGet(apiKey, `/accounts?itemId=${(it as any).item_id}`);
        for (const acc of data.results ?? []) {
          found.push({
            pluggy_account_id: acc.id,
            nome: acc.name || acc.marketingName || 'Conta',
            tipo: mapAccountTipo(acc.type, acc.subtype),
            saldo: acc.balance,
            conector: (it as any).connector_name,
            ja_vinculada: linkedIds.has(acc.id),
            vinculada_a: (linked ?? []).find((a: any) => a.pluggy_account_id === acc.id)?.nome ?? null,
          });
        }
      }
      return json({ contas: found });
    }

    // ---- link_account: vincula uma conta Pluggy a uma conta existente OU cria nova ----
    if (action === 'link_account') {
      const { pluggy_account_id, pluggy_item_id, account_id, criar_nova, nome, tipo } = body;
      if (!pluggy_account_id) return json({ error: 'pluggy_account_id obrigatorio' }, 400);

      if (criar_nova) {
        const { data, error } = await supabase.from('accounts').insert({
          family_id: familyId, nome: nome ?? 'Conta Open Finance', tipo: tipo ?? 'corrente',
          ativo: true, pluggy_account_id, pluggy_item_id: pluggy_item_id ?? null,
        }).select('id').single();
        if (error) return json({ error: error.message }, 500);
        return json({ sucesso: true, account_id: data.id });
      }

      if (!account_id) return json({ error: 'account_id obrigatorio quando criar_nova=false' }, 400);
      const { error } = await supabase.from('accounts')
        .update({ pluggy_account_id, pluggy_item_id: pluggy_item_id ?? null })
        .eq('id', account_id).eq('family_id', familyId);
      if (error) return json({ error: error.message }, 500);
      return json({ sucesso: true, account_id });
    }

    // ---- sync: puxa transacoes novas de todas as contas ja vinculadas da familia ----
    if (action === 'sync') {
      const apiKey = await getApiKey();
      const { data: accounts } = await supabase.from('accounts')
        .select('id, nome, pluggy_account_id, pluggy_item_id')
        .eq('family_id', familyId).eq('ativo', true).not('pluggy_account_id', 'is', null);

      if (!accounts?.length) return json({ error: 'Nenhuma conta vinculada ao Open Finance ainda. Use list_accounts + link_account primeiro.' }, 400);

      const resultados: any[] = [];
      for (const acc of accounts) {
        try {
          const r = await syncAccountTransactions(supabase, apiKey, familyId, acc as any);
          resultados.push({ conta: (acc as any).nome, ...r });
        } catch (e: any) {
          resultados.push({ conta: (acc as any).nome, erro: e.message });
        }
      }

      await supabase.from('pluggy_items').update({ last_synced_at: new Date().toISOString(), status: 'UPDATED', last_error: null }).eq('family_id', familyId);
      return json({ resultados });
    }

    return json({ error: `action desconhecida: ${action}` }, 400);
  } catch (e: any) {
    console.error('[pluggy-sync]', e.message);
    return json({ error: e.message }, 500);
  }
});
