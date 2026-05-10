// ============================================================
// CASINHA FLOW V2 — Tipos centralizados
// ============================================================

// ── AUTH ─────────────────────────────────────────────────────
export interface Profile {
  id: string;
  family_id: string;
  nome: string | null;
  created_at: string;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  user_id: string;
  nome: string;
  icone: string;
  cor: string;
  role: 'admin' | 'member';
  tipo: 'auth' | 'local';
}

// ── FINANCEIRO ────────────────────────────────────────────────
export type TransactionType = 'income' | 'expense';
export type TransactionScope = 'family' | 'personal';

export interface Transaction {
  id: string;
  family_id: string;
  user_id: string;
  account_id: string | null;
  category_id: string | null;
  description: string;
  amount: number;
  type: TransactionType;
  date: string;
  scope: TransactionScope;
  is_essencial: boolean;
  conciliado: boolean;
  external_id: string | null;
  tipo_especial: string | null;
  created_at: string;
}

export interface Account {
  id: string;
  family_id: string;
  nome: string;
  tipo: 'corrente' | 'poupanca' | 'cartao' | 'carteira' | 'investimento';
  saldo_atual: number;
  saldo_inicial: number;
  cor: string;
  icone: string;
  ativo: boolean;
  banco: string | null;
  agencia: string | null;
  numero_conta: string | null;
  digito: string | null;
  bandeira: string | null;
  limite_credito: number | null;
  limite_cheque_especial: number | null;
  dia_fechamento: number | null;
  dia_vencimento: number | null;
}

export interface Category {
  id: string;
  family_id: string;
  nome: string;
  tipo: 'despesa' | 'receita';
  icone: string;
  cor: string;
  is_essencial: boolean;
  parent_id: string | null;
  responsavel_padrao: string | null;
}

export interface Budget {
  id: string;
  family_id: string;
  category_id: string;
  mes: string;
  valor_planejado: number;
  responsavel: string | null;
  conta_origem: string | null;
}

export interface BudgetStatus {
  budget_id: string;
  category_id: string;
  category_nome: string;
  category_cor: string;
  category_icone: string;
  is_essencial: boolean;
  valor_planejado: number;
  valor_gasto: number;
  pct_atingido: number;
  status_cor: 'green' | 'yellow' | 'red' | 'gray';
  responsavel: string | null;
}

export interface RecurringTransaction {
  id: string;
  family_id: string;
  account_id: string | null;
  category_id: string | null;
  description: string;
  amount: number;
  type: TransactionType;
  frequencia: 'mensal' | 'semanal' | 'anual';
  dia_do_mes: number | null;
  proxima_data: string;
  ativo: boolean;
  is_essencial: boolean;
}

export interface BillReminder {
  id: string;
  family_id: string;
  account_id: string | null;
  descricao: string;
  valor_estimado: number | null;
  data_vencimento: string;
  status: 'pendente' | 'pago' | 'cancelado';
  recorrente_id: string | null;
  credit_card_bill_id: string | null;
  mes_referencia: string | null;
  origem?: 'lembrete' | 'fatura_cartao' | 'parcela';
  account_nome?: string | null;
}

// ── ESTOQUE ───────────────────────────────────────────────────
export interface Product {
  id: string;
  family_id: string;
  nome: string;
  categoria: string;
  quantidade_atual: number;
  unidade: string;
  ativo: boolean;
  consumo_medio_diario: number | null;
  estoque_minimo: number;
  custo_medio: number | null;
  validade: string | null;
  dias_restantes: number | null;
  previsao_reposicao: string | null;
  ultima_revisao: string | null;
}

export interface StockMovement {
  id: string;
  product_id: string;
  family_id: string;
  tipo: 'entrada' | 'saida' | 'ajuste';
  quantidade: number;
  observacao: string | null;
  created_at: string;
}

// ── COMPRAS ───────────────────────────────────────────────────
export type ShoppingListStatus = 'aberta' | 'em_andamento' | 'concluida';

export interface ShoppingList {
  id: string;
  family_id: string;
  nome: string;
  status: ShoppingListStatus;
  data_prevista: string | null;
  local_preferido: string | null;
  total_estimado: number;
  total_real: number | null;
  created_at: string;
}

export interface ShoppingItem {
  id: string;
  list_id: string;
  family_id: string;
  product_id: string | null;
  nome: string;
  quantidade: number;
  unidade: string;
  preco_estimado: number | null;
  preco_real: number | null;
  comprado: boolean;
  comprado_em: string | null;
}

// ── MANUTENÇÃO ────────────────────────────────────────────────
export type MaintenanceCategory =
  'eletrica' | 'hidraulica' | 'pintura' | 'limpeza' |
  'jardim' | 'eletrodomestico' | 'outros' | 'geral';

export type MaintenancePriority = 'baixa' | 'media' | 'alta' | 'urgente';
export type MaintenanceStatus = 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';

export interface MaintenanceTask {
  id: string;
  family_id: string;
  titulo: string;
  descricao: string | null;
  categoria: MaintenanceCategory;
  prioridade: MaintenancePriority;
  status: MaintenanceStatus;
  responsavel: string | null;
  custo_estimado: number | null;
  custo_real: number | null;
  data_prevista: string | null;
  data_conclusao: string | null;
  recorrente: boolean;
  intervalo_dias: number | null;
  proxima_data: string | null;
}

// ── VEÍCULOS ──────────────────────────────────────────────────
export interface Vehicle {
  id: string;
  family_id: string;
  nome: string;
  placa: string | null;
  tipo: string;
  odometro_atual: number;
  ativo: boolean;
}

export interface FuelFill {
  id: string;
  vehicle_id: string;
  family_id: string;
  data: string;
  litros: number;
  preco_litro: number;
  valor_total: number;
  km_rodado: number;
  combustivel: string;
  posto: string | null;
}

// ── IA ────────────────────────────────────────────────────────
export interface AILog {
  id: string;
  family_id: string;
  user_id: string | null;
  feature: string;
  prompt: string | null;
  response: string | null;
  tokens_input: number;
  tokens_output: number;
  estimated_cost: number;
  latency_ms: number | null;
  success: boolean;
  created_at: string;
}

// ── UTILS ─────────────────────────────────────────────────────
export const fmtBRL = (n: number | null | undefined): string =>
  (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const fmtDate = (d: string | null | undefined): string => {
  if (!d) return '—';
  return new Date(d + 'T12:00').toLocaleDateString('pt-BR');
};

export const mesLabel = (mes: string): string => {
  const d = new Date(mes + '-15');
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

// ============================================================
// TIPOS CONSOLIDADOS — evitar duplicação entre rotas
// ============================================================

export type TxType = 'income' | 'expense';
export type TxSource = 'manual' | 'importado' | 'recorrente' | 'compras';
export type TxScope = 'family' | 'personal';
export type TipoEspecial = 'normal' | 'transferencia' | 'pagamento_fatura';

export interface TransactionBase {
  id: string;
  family_id: string;
  user_id: string;
  date: string;
  description: string;
  amount: number;
  type: TxType;
  source: TxSource;
  scope: TxScope;
  category?: string | null;
  category_id?: string | null;
  account_id?: string | null;
  external_id?: string | null;
  is_essencial?: boolean;
  tipo_especial?: TipoEspecial;
  conciliado?: boolean;
}

export interface FamilyMember {
  id: string;
  user_id: string;
  family_id: string;
  nome: string;
  icone?: string;
  cor?: string;
  role: 'admin' | 'member';
  tipo: 'auth' | 'local';
}

export interface BudgetStatus {
  budget_id: string;
  category_id: string;
  category_nome: string;
  category_icone?: string;
  category_cor?: string;
  is_essencial: boolean;
  valor_planejado: number;
  valor_gasto: number;
  pct_atingido: number;
  status_cor: 'green' | 'yellow' | 'red';
  responsavel?: string;
}
