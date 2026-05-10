// ============================================================
// CASINHA HUB — Nomes de tabelas tipados
// Elimina os 88 'as any' nas chamadas ao Supabase
// Uso: supabase.from(T.transactions) em vez de from("transactions" as any)
// ============================================================

export const T = {
  // Core
  profiles:          'profiles',
  families:          'families',
  family_members:    'family_members',
  family_invites:    'family_invites',

  // Financeiro
  accounts:          'accounts',
  categories:        'categories',
  transactions:      'transactions',
  budgets:           'budgets',
  recurring:         'recurring_transactions',
  bills:             'bills_reminders',

  // Estoque & Compras
  products:          'products',
  stock_movements:   'stock_movements',
  shopping_lists:    'shopping_lists',
  shopping_items:    'shopping_items',

  // Casa
  maintenance_tasks: 'maintenance_tasks',
  vehicles:          'vehicles',
  vehicle_maint_types: 'vehicle_maintenance_types',
  vehicle_maint_log: 'vehicle_maintenance_log',
  fuel_fills:        'fuel_fills',

  // Sistema
  ai_logs:           'ai_logs',
  categorization_keywords: 'categorization_keywords',

  // Views (read-only)
  v_stock_status:    'v_stock_status',
  v_vehicle_status:  'v_vehicle_status',
} as const;

export type TableName = typeof T[keyof typeof T];

// RPCs tipadas
export const RPC = {
  get_dashboard_summary:           'get_dashboard_summary',
  get_saldo_total:                 'get_saldo_total',
  get_projecao_categorias:         'get_projecao_categorias',
  get_budget_status:               'get_budget_status',
  get_previsao_mes:                'get_previsao_mes',
  get_previsao_estoque:            'get_previsao_estoque',
  get_sugestoes_compras:           'get_sugestoes_compras',
  get_manutencao_pendente:         'get_manutencao_pendente',
  finalizar_compra:                'finalizar_compra',
  copy_budget_from_previous_month: 'copy_budget_from_previous_month',
  recalc_account_balance:          'recalc_account_balance',
  recalc_consumo_medio:            'recalc_consumo_medio',
  generate_bills_reminders:        'generate_bills_reminders',
  accept_invite:                   'accept_invite',
  categorize_transaction:          'categorize_transaction',
  learn_categorization_rule:       'learn_categorization_rule',
  count_ai_runs_today:             'count_ai_runs_today',
  check_duplicate_transaction:     'check_duplicate_transaction',
  get_monthly_summary:             'get_monthly_summary',
  gerar_lista_reposicao:           'gerar_lista_reposicao',
} as const;

export type RpcName = typeof RPC[keyof typeof RPC];
