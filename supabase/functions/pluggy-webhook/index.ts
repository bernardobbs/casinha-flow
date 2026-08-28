import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Recebe eventos da Pluggy (item/created, item/updated, item/error). Sem
// verificação de assinatura — a Pluggy não expõe webhook secret no plano
// gratuito do Meu Pluggy — então o único dado que um evento forjado
// conseguiria influenciar é disparar uma sincronização (leitura) pra um
// item_id que precisa bater com um já registrado por um usuário autenticado
// via register_item; não há escrita privilegiada exposta aqui.
const PLUGGY_CLIENT_ID = Deno.env.get('PLUGGY_CLIENT_ID');
const PLUGGY_CLIENT_SECRET = Deno.env.get('PLUGGY_CLIENT_SECRET');
const PLUGGY_BASE = 'https://api.pluggy.ai';

async function getApiKey(): Promise<string> {
  if (!PLUGGY_CLIENT_ID || !PLUGGY_CLIENT_SECRET) throw new Error('PLUGGY_CLIENT_ID/PLUGGY_CLIENT_SECRET não configurados');
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

async function syncAccountTransactions(supabase: any, apiKey: string, familyId: string, account: any) {
  const from = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  let page = 1;
  let totalPages = 1;
  let imported = 0;

  do {
    const data = await pluggyGet(apiKey, `/transactions?accountId=${account.pluggy_account_id}&from=${from}&page=${page}&pageSize=200`);
    totalPages = data.totalPages ?? 1;
    for (const tx of data.results ?? []) {
      const isExpense = tx.type === 'DEBIT';
      const valor = Math.abs(Number(tx.amount));
      const descricao = tx.description || tx.descriptionRaw || 'Transação Open Finance';
      const dataTx = String(tx.date).slice(0, 10);
      const { error } = await supabase.from('transactions').upsert(
        {
          family_id: familyId, account_id: account.id, descricao, description: descricao,
          valor, amount: valor, tipo: isExpense ? 'despesa' : 'receita', type: isExpense ? 'expense' : 'income',
          data: dataTx, date: dataTx, source: 'importado', external_id: `pluggy:${tx.id}`,
        },
        { onConflict: 'family_id,external_id', ignoreDuplicates: true },
      );
      if (!error) imported++;
    }
    page++;
  } while (page <= totalPages);

  await supabase.rpc('recalc_account_balance', { p_account_id: account.id });
  return imported;
}

// Faz o trabalho pesado em background (após responder 2xx pra Pluggy), pra
// não estourar o timeout de 5s que eles exigem na resposta do webhook.
async function processEvent(supabase: any, event: string, itemId: string, error?: unknown) {
  const { data: itemRows } = await supabase.from('pluggy_items').select('family_id, item_id').eq('item_id', itemId);
  if (!itemRows?.length) {
    console.log(`[pluggy-webhook] item_id ${itemId} não registrado ainda (evento ${event}) — ignorando`);
    return;
  }

  for (const row of itemRows) {
    const familyId = (row as any).family_id;
    if (event === 'item/error') {
      await supabase.from('pluggy_items').update({ status: 'ERROR', last_error: JSON.stringify(error ?? {}) }).eq('family_id', familyId).eq('item_id', itemId);
      continue;
    }
    if (event === 'item/created' || event === 'item/updated') {
      await supabase.from('pluggy_items').update({ status: 'UPDATED', last_error: null }).eq('family_id', familyId).eq('item_id', itemId);
      if (event === 'item/updated') {
        try {
          const apiKey = await getApiKey();
          const { data: accounts } = await supabase.from('accounts')
            .select('id, pluggy_account_id').eq('family_id', familyId).eq('pluggy_item_id', itemId).not('pluggy_account_id', 'is', null);
          for (const acc of accounts ?? []) {
            await syncAccountTransactions(supabase, apiKey, familyId, acc);
          }
          await supabase.from('pluggy_items').update({ last_synced_at: new Date().toISOString() }).eq('family_id', familyId).eq('item_id', itemId);
        } catch (e: any) {
          console.error('[pluggy-webhook] erro ao sincronizar após item/updated', e.message);
        }
      }
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok');
  try {
    const body = await req.json();
    const { event, itemId, error } = body ?? {};
    console.log('[pluggy-webhook] evento recebido', event, itemId);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    if (event && itemId) {
      // não bloqueia a resposta — Pluggy exige 2xx em até 5s
      void processEvent(supabase, event, itemId, error).catch((e) => console.error('[pluggy-webhook] processEvent falhou', e.message));
    }

    return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('[pluggy-webhook]', e.message);
    // ainda responde 200 pra Pluggy não ficar re-tentando um payload malformado
    return new Response(JSON.stringify({ received: true, error: e.message }), { headers: { 'Content-Type': 'application/json' } });
  }
});
