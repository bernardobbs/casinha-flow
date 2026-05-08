// ============================================================
// CASINHA FLOW V2 — Services
// ============================================================
import { supabase } from '@/integrations/supabase/client';

// ── FAMÍLIA ───────────────────────────────────────────────────
export async function getFamilyId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('id', userId)
    .maybeSingle();
  return data?.family_id ?? null;
}

export async function getFamilyMembers(familyId: string) {
  const { data } = await supabase
    .from('family_members')
    .select('id, nome, icone, cor, role, tipo')
    .eq('family_id', familyId)
    .order('nome');
  return data ?? [];
}

// ── CATEGORIAS ────────────────────────────────────────────────
export async function getCategories(familyId: string) {
  const { data } = await supabase
    .from('categories')
    .select('id, nome, tipo, icone, cor, is_essencial, parent_id, responsavel_padrao')
    .eq('family_id', familyId)
    .order('nome');
  return data ?? [];
}

// ── TRANSAÇÕES ────────────────────────────────────────────────
export async function categorizeTransaction(
  familyId: string,
  description: string
): Promise<string | null> {
  const { data } = await supabase.rpc('categorize_transaction' as any, {
    _family_id: familyId,
    _description: description,
    _dummy: false,
  });
  return (data as any)?.[0]?.category_id ?? null;
}

export async function learnCategorizationRule(
  familyId: string,
  termo: string,
  categoryId: string
): Promise<void> {
  await supabase.rpc('learn_categorization_rule' as any, {
    _family_id: familyId,
    _termo: termo.toLowerCase().slice(0, 60),
    _category_id: categoryId,
  });
}

// ── ESTOQUE ───────────────────────────────────────────────────
export async function getEstoquePrevisao(familyId: string) {
  const { data } = await supabase.rpc('get_previsao_estoque' as any, {
    p_family_id: familyId,
  });
  return data ?? [];
}

export async function getSugestoesCompras(familyId: string) {
  const { data } = await supabase.rpc('get_sugestoes_compras' as any, {
    p_family_id: familyId,
  });
  return data ?? [];
}

export async function recalcConsumoMedio(productId: string): Promise<void> {
  await supabase.rpc('recalc_consumo_medio' as any, {
    p_product_id: productId,
  });
}

// ── COMPRAS ───────────────────────────────────────────────────
export async function createShoppingList(
  familyId: string,
  nome: string,
  dataPrevisita?: string
) {
  const { data, error } = await supabase
    .from('shopping_lists' as any)
    .insert({ family_id: familyId, nome, data_prevista: dataPrevisita })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function addShoppingItem(
  listId: string,
  familyId: string,
  item: { nome: string; quantidade: number; unidade: string; preco_estimado?: number; product_id?: string }
) {
  const { data, error } = await supabase
    .from('shopping_items' as any)
    .insert({ list_id: listId, family_id: familyId, ...item })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function toggleShoppingItem(
  itemId: string,
  comprado: boolean,
  precoReal?: number
) {
  const { error } = await supabase
    .from('shopping_items' as any)
    .update({
      comprado,
      comprado_em: comprado ? new Date().toISOString() : null,
      preco_real: precoReal ?? null,
    })
    .eq('id', itemId);
  if (error) throw error;
}

// ── MANUTENÇÃO ────────────────────────────────────────────────
export async function createMaintenanceTask(
  familyId: string,
  task: {
    titulo: string;
    descricao?: string;
    categoria?: string;
    prioridade?: string;
    responsavel?: string;
    custo_estimado?: number;
    data_prevista?: string;
    recorrente?: boolean;
    intervalo_dias?: number;
  }
) {
  const { data, error } = await supabase
    .from('maintenance_tasks' as any)
    .insert({ family_id: familyId, ...task })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMaintenanceStatus(
  taskId: string,
  status: string,
  custoReal?: number
) {
  const { error } = await supabase
    .from('maintenance_tasks' as any)
    .update({
      status,
      custo_real: custoReal,
      data_conclusao: status === 'concluida' ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq('id', taskId);
  if (error) throw error;
}

// ── IA ────────────────────────────────────────────────────────
export async function logAI(entry: {
  familyId: string;
  userId?: string;
  feature: string;
  prompt?: string;
  response?: string;
  tokensInput?: number;
  tokensOutput?: number;
  estimatedCost?: number;
  latencyMs?: number;
  success?: boolean;
  errorMsg?: string;
}) {
  await supabase.from('ai_logs' as any).insert({
    family_id: entry.familyId,
    user_id: entry.userId,
    feature: entry.feature,
    prompt: entry.prompt,
    response: entry.response,
    tokens_input: entry.tokensInput ?? 0,
    tokens_output: entry.tokensOutput ?? 0,
    estimated_cost: entry.estimatedCost ?? 0,
    latency_ms: entry.latencyMs,
    success: entry.success ?? true,
    error_msg: entry.errorMsg,
  });
}

// ── DASHBOARD ─────────────────────────────────────────────────
export async function getDashboardDomestico(familyId: string) {
  const { data } = await supabase.rpc('get_dashboard_domestico' as any, {
    p_family_id: familyId,
  });
  return data as {
    estoque_critico: number;
    estoque_zerado: number;
    listas_abertas: number;
    itens_pendentes: number;
    manutencao_urgente: number;
    manutencao_vencida: number;
    contas_pendentes: number;
    valor_pendente: number;
    km_mes: number;
    gasto_combustivel_mes: number;
  } | null;
}
