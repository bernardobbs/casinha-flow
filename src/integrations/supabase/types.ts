export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          ativo: boolean
          cor: string
          created_at: string
          dia_fechamento: number | null
          dia_vencimento: number | null
          family_id: string
          icone: string
          id: string
          limite_credito: number | null
          nome: string
          saldo_atual: number
          saldo_inicial: number
          tipo: Database["public"]["Enums"]["account_type"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor?: string
          created_at?: string
          dia_fechamento?: number | null
          dia_vencimento?: number | null
          family_id: string
          icone?: string
          id?: string
          limite_credito?: number | null
          nome: string
          saldo_atual?: number
          saldo_inicial?: number
          tipo?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor?: string
          created_at?: string
          dia_fechamento?: number | null
          dia_vencimento?: number | null
          family_id?: string
          icone?: string
          id?: string
          limite_credito?: number | null
          nome?: string
          saldo_atual?: number
          saldo_inicial?: number
          tipo?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          created_at: string
          family_id: string
          id: string
          lido: boolean
          mensagem: string
          referencia_id: string | null
          referencia_tipo: string | null
          severidade: Database["public"]["Enums"]["alert_severity"]
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          lido?: boolean
          mensagem: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          severidade?: Database["public"]["Enums"]["alert_severity"]
          tipo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          lido?: boolean
          mensagem?: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          severidade?: Database["public"]["Enums"]["alert_severity"]
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      bills_reminders: {
        Row: {
          account_id: string | null
          category_id: string | null
          created_at: string
          data_vencimento: string
          descricao: string
          family_id: string
          id: string
          observacao: string | null
          status: string
          updated_at: string
          user_id: string | null
          valor: number
        }
        Insert: {
          account_id?: string | null
          category_id?: string | null
          created_at?: string
          data_vencimento: string
          descricao: string
          family_id: string
          id?: string
          observacao?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          valor: number
        }
        Update: {
          account_id?: string | null
          category_id?: string | null
          created_at?: string
          data_vencimento?: string
          descricao?: string
          family_id?: string
          id?: string
          observacao?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          valor?: number
        }
        Relationships: []
      }
      budgets: {
        Row: {
          category_id: string
          created_at: string
          family_id: string
          id: string
          mes: string
          updated_at: string
          valor_planejado: number
        }
        Insert: {
          category_id: string
          created_at?: string
          family_id: string
          id?: string
          mes: string
          updated_at?: string
          valor_planejado?: number
        }
        Update: {
          category_id?: string
          created_at?: string
          family_id?: string
          id?: string
          mes?: string
          updated_at?: string
          valor_planejado?: number
        }
        Relationships: []
      }
      categories: {
        Row: {
          cor: string
          created_at: string
          family_id: string
          icone: string
          id: string
          is_default: boolean
          is_essencial: boolean
          nome: string
          parent_id: string | null
          tipo: Database["public"]["Enums"]["category_type"]
          updated_at: string
        }
        Insert: {
          cor?: string
          created_at?: string
          family_id: string
          icone?: string
          id?: string
          is_default?: boolean
          is_essencial?: boolean
          nome: string
          parent_id?: string | null
          tipo: Database["public"]["Enums"]["category_type"]
          updated_at?: string
        }
        Update: {
          cor?: string
          created_at?: string
          family_id?: string
          icone?: string
          id?: string
          is_default?: boolean
          is_essencial?: boolean
          nome?: string
          parent_id?: string | null
          tipo?: Database["public"]["Enums"]["category_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categorization_rules: {
        Row: {
          category_id: string
          confianca: number
          created_at: string
          family_id: string
          id: string
          origem: Database["public"]["Enums"]["categorization_origin"]
          termo: string
          termo_normalizado: string
          updated_at: string
          usos: number
        }
        Insert: {
          category_id: string
          confianca?: number
          created_at?: string
          family_id: string
          id?: string
          origem?: Database["public"]["Enums"]["categorization_origin"]
          termo: string
          termo_normalizado: string
          updated_at?: string
          usos?: number
        }
        Update: {
          category_id?: string
          confianca?: number
          created_at?: string
          family_id?: string
          id?: string
          origem?: Database["public"]["Enums"]["categorization_origin"]
          termo?: string
          termo_normalizado?: string
          updated_at?: string
          usos?: number
        }
        Relationships: [
          {
            foreignKeyName: "categorization_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_card_bills: {
        Row: {
          account_id: string
          created_at: string
          data_vencimento: string | null
          family_id: string
          id: string
          mes_referencia: string
          status: Database["public"]["Enums"]["credit_card_bill_status"]
          updated_at: string
          valor_pago: number
          valor_total: number
        }
        Insert: {
          account_id: string
          created_at?: string
          data_vencimento?: string | null
          family_id: string
          id?: string
          mes_referencia: string
          status?: Database["public"]["Enums"]["credit_card_bill_status"]
          updated_at?: string
          valor_pago?: number
          valor_total?: number
        }
        Update: {
          account_id?: string
          created_at?: string
          data_vencimento?: string | null
          family_id?: string
          id?: string
          mes_referencia?: string
          status?: Database["public"]["Enums"]["credit_card_bill_status"]
          updated_at?: string
          valor_pago?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_card_bills_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      crisis_events: {
        Row: {
          ativo: boolean
          created_at: string
          criterio_disparado: string | null
          data_fim: string | null
          data_inicio: string
          estagio_atual: number
          family_id: string
          id: string
          motivo_ativacao: string
          plano_saida: Json | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          criterio_disparado?: string | null
          data_fim?: string | null
          data_inicio?: string
          estagio_atual?: number
          family_id: string
          id?: string
          motivo_ativacao: string
          plano_saida?: Json | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          criterio_disparado?: string | null
          data_fim?: string | null
          data_inicio?: string
          estagio_atual?: number
          family_id?: string
          id?: string
          motivo_ativacao?: string
          plano_saida?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      crisis_stage_history: {
        Row: {
          created_at: string
          crisis_id: string
          criterio_avanco: string | null
          data_entrada: string
          data_saida: string | null
          estagio: number
          id: string
        }
        Insert: {
          created_at?: string
          crisis_id: string
          criterio_avanco?: string | null
          data_entrada?: string
          data_saida?: string | null
          estagio: number
          id?: string
        }
        Update: {
          created_at?: string
          crisis_id?: string
          criterio_avanco?: string | null
          data_entrada?: string
          data_saida?: string | null
          estagio?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crisis_stage_history_crisis_id_fkey"
            columns: ["crisis_id"]
            isOneToOne: false
            referencedRelation: "crisis_events"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_ai_runs: {
        Row: {
          created_at: string
          custo_credito: number
          data: string
          family_id: string
          id: string
          modulo: string
          prompt_usado: string
          resposta_ia: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          custo_credito?: number
          data?: string
          family_id: string
          id?: string
          modulo: string
          prompt_usado: string
          resposta_ia?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          custo_credito?: number
          data?: string
          family_id?: string
          id?: string
          modulo?: string
          prompt_usado?: string
          resposta_ia?: Json
          user_id?: string
        }
        Relationships: []
      }
      families: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      family_members: {
        Row: {
          created_at: string
          family_id: string
          id: string
          role: Database["public"]["Enums"]["family_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          role?: Database["public"]["Enums"]["family_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          role?: Database["public"]["Enums"]["family_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      family_settings: {
        Row: {
          chave: string
          created_at: string
          family_id: string
          id: string
          updated_at: string
          valor: string | null
        }
        Insert: {
          chave: string
          created_at?: string
          family_id: string
          id?: string
          updated_at?: string
          valor?: string | null
        }
        Update: {
          chave?: string
          created_at?: string
          family_id?: string
          id?: string
          updated_at?: string
          valor?: string | null
        }
        Relationships: []
      }
      financial_state: {
        Row: {
          created_at: string
          family_id: string
          id: string
          mes: string
          meta_essenciais: number
          meta_estilo_vida: number
          meta_reserva: number
          modo_crise: boolean
          renda_mensal: number
          saldo_atual: number
          total_dividas: number
          total_essenciais: number
          total_estilo_vida: number
          total_reserva: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          mes: string
          meta_essenciais?: number
          meta_estilo_vida?: number
          meta_reserva?: number
          modo_crise?: boolean
          renda_mensal?: number
          saldo_atual?: number
          total_dividas?: number
          total_essenciais?: number
          total_estilo_vida?: number
          total_reserva?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          mes?: string
          meta_essenciais?: number
          meta_estilo_vida?: number
          meta_reserva?: number
          modo_crise?: boolean
          renda_mensal?: number
          saldo_atual?: number
          total_dividas?: number
          total_essenciais?: number
          total_estilo_vida?: number
          total_reserva?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_state_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      installment_plans: {
        Row: {
          account_id: string
          category_id: string | null
          created_at: string
          data_compra: string
          description: string
          family_id: string
          id: string
          is_essencial: boolean
          total_parcelas: number
          updated_at: string
          user_id: string
          valor_total: number
        }
        Insert: {
          account_id: string
          category_id?: string | null
          created_at?: string
          data_compra?: string
          description: string
          family_id: string
          id?: string
          is_essencial?: boolean
          total_parcelas: number
          updated_at?: string
          user_id: string
          valor_total: number
        }
        Update: {
          account_id?: string
          category_id?: string | null
          created_at?: string
          data_compra?: string
          description?: string
          family_id?: string
          id?: string
          is_essencial?: boolean
          total_parcelas?: number
          updated_at?: string
          user_id?: string
          valor_total?: number
        }
        Relationships: []
      }
      installments: {
        Row: {
          created_at: string
          fatura_mes: string
          id: string
          numero: number
          plan_id: string
          transaction_id: string | null
          valor: number
        }
        Insert: {
          created_at?: string
          fatura_mes: string
          id?: string
          numero: number
          plan_id: string
          transaction_id?: string | null
          valor: number
        }
        Update: {
          created_at?: string
          fatura_mes?: string
          id?: string
          numero?: number
          plan_id?: string
          transaction_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "installments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "installment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          family_id: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          family_id?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          family_id?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_transactions: {
        Row: {
          account_id: string | null
          amount: number
          ativo: boolean
          category_id: string | null
          created_at: string
          description: string
          dia_do_mes: number | null
          family_id: string
          frequencia: Database["public"]["Enums"]["recurring_frequency"]
          id: string
          is_essencial: boolean
          proxima_data: string
          type: Database["public"]["Enums"]["transaction_type"]
          ultima_geracao: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          ativo?: boolean
          category_id?: string | null
          created_at?: string
          description: string
          dia_do_mes?: number | null
          family_id: string
          frequencia?: Database["public"]["Enums"]["recurring_frequency"]
          id?: string
          is_essencial?: boolean
          proxima_data?: string
          type: Database["public"]["Enums"]["transaction_type"]
          ultima_geracao?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          ativo?: boolean
          category_id?: string | null
          created_at?: string
          description?: string
          dia_do_mes?: number | null
          family_id?: string
          frequencia?: Database["public"]["Enums"]["recurring_frequency"]
          id?: string
          is_essencial?: boolean
          proxima_data?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          ultima_geracao?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          category: string | null
          category_id: string | null
          created_at: string
          date: string
          description: string
          external_id: string | null
          family_id: string
          id: string
          is_essencial: boolean
          scope: Database["public"]["Enums"]["transaction_scope"]
          source: Database["public"]["Enums"]["transaction_source"]
          tipo_especial: Database["public"]["Enums"]["transaction_special_type"]
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category?: string | null
          category_id?: string | null
          created_at?: string
          date?: string
          description: string
          external_id?: string | null
          family_id: string
          id?: string
          is_essencial?: boolean
          scope?: Database["public"]["Enums"]["transaction_scope"]
          source?: Database["public"]["Enums"]["transaction_source"]
          tipo_especial?: Database["public"]["Enums"]["transaction_special_type"]
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string | null
          category_id?: string | null
          created_at?: string
          date?: string
          description?: string
          external_id?: string | null
          family_id?: string
          id?: string
          is_essencial?: boolean
          scope?: Database["public"]["Enums"]["transaction_scope"]
          source?: Database["public"]["Enums"]["transaction_source"]
          tipo_especial?: Database["public"]["Enums"]["transaction_special_type"]
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_reviews: {
        Row: {
          checklist: Json
          created_at: string
          family_id: string
          fechado_em: string
          id: string
          user_id: string
        }
        Insert: {
          checklist?: Json
          created_at?: string
          family_id: string
          fechado_em?: string
          id?: string
          user_id: string
        }
        Update: {
          checklist?: Json
          created_at?: string
          family_id?: string
          fechado_em?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_crisis: {
        Args: { _criterio: string; _family_id: string; _motivo: string }
        Returns: {
          ativo: boolean
          created_at: string
          criterio_disparado: string | null
          data_fim: string | null
          data_inicio: string
          estagio_atual: number
          family_id: string
          id: string
          motivo_ativacao: string
          plano_saida: Json | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "crisis_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      advance_crisis_stage: {
        Args: { _crisis_id: string }
        Returns: {
          ativo: boolean
          created_at: string
          criterio_disparado: string | null
          data_fim: string | null
          data_inicio: string
          estagio_atual: number
          family_id: string
          id: string
          motivo_ativacao: string
          plano_saida: Json | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "crisis_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      categorize_transaction: {
        Args: { _description: string; _family_id: string }
        Returns: {
          auto_apply: boolean
          category_id: string
          confianca: number
          nivel: number
          origem: Database["public"]["Enums"]["categorization_origin"]
        }[]
      }
      check_bills_alerts: { Args: { p_family_id: string }; Returns: undefined }
      check_credit_card_bill_alerts: {
        Args: { _family_id: string }
        Returns: undefined
      }
      check_crisis_activation: {
        Args: { _family_id: string; _mes: string }
        Returns: {
          criterio: string
          should_activate: boolean
        }[]
      }
      check_transaction_alerts: {
        Args: { _transaction_id: string }
        Returns: undefined
      }
      count_ai_runs_today: { Args: { _family_id: string }; Returns: number }
      create_alert: {
        Args: {
          _family_id: string
          _mensagem: string
          _ref_id: string
          _ref_tipo: string
          _severidade: Database["public"]["Enums"]["alert_severity"]
          _tipo: string
        }
        Returns: string
      }
      create_installment_plan: {
        Args: {
          _account_id: string
          _category_id?: string
          _data_compra: string
          _description: string
          _family_id: string
          _is_essencial?: boolean
          _total_parcelas: number
          _valor_total: number
        }
        Returns: {
          account_id: string
          category_id: string | null
          created_at: string
          data_compra: string
          description: string
          family_id: string
          id: string
          is_essencial: boolean
          total_parcelas: number
          updated_at: string
          user_id: string
          valor_total: number
        }
        SetofOptions: {
          from: "*"
          to: "installment_plans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_transfer: {
        Args: {
          _amount: number
          _date?: string
          _description?: string
          _family_id: string
          _from_account: string
          _to_account: string
        }
        Returns: undefined
      }
      generate_recurring_transactions: {
        Args: { p_family_id: string }
        Returns: number
      }
      get_budget_status: {
        Args: { _family_id: string; _mes: string }
        Returns: {
          budget_id: string
          category_cor: string
          category_icone: string
          category_id: string
          category_nome: string
          is_essencial: boolean
          pct_atingido: number
          status_cor: string
          valor_gasto: number
          valor_planejado: number
        }[]
      }
      get_dashboard_summary: {
        Args: { p_family_id: string }
        Returns: {
          dia_atual: number
          dias_mes: number
          estagio_crise: number
          mes: string
          meta_essenciais: number
          meta_estilo_vida: number
          meta_reserva: number
          modo_crise: boolean
          renda_mensal: number
          saldo_atual: number
          saldo_projetado: number
          score: number
          score_label: string
          total_dividas: number
          total_essenciais: number
          total_estilo_vida: number
        }[]
      }
      get_projecao_categorias: {
        Args: { p_family_id: string }
        Returns: {
          category_id: string
          cor: string
          icone: string
          is_essencial: boolean
          nome: string
          pct_atingido: number
          status_proj: string
          valor_gasto: number
          valor_planejado: number
          valor_projetado: number
        }[]
      }
      get_saldo_total: {
        Args: { p_family_id: string }
        Returns: {
          divida_cartoes: number
          saldo_contas: number
          saldo_total: number
        }[]
      }
      get_user_family_id: { Args: { _user_id: string }; Returns: string }
      is_family_admin: {
        Args: { _family_id: string; _user_id: string }
        Returns: boolean
      }
      learn_categorization_rule: {
        Args: {
          _category_id: string
          _family_id: string
          _origem?: Database["public"]["Enums"]["categorization_origin"]
          _termo: string
        }
        Returns: {
          category_id: string
          confianca: number
          created_at: string
          family_id: string
          id: string
          origem: Database["public"]["Enums"]["categorization_origin"]
          termo: string
          termo_normalizado: string
          updated_at: string
          usos: number
        }
        SetofOptions: {
          from: "*"
          to: "categorization_rules"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      normalize_text: { Args: { _t: string }; Returns: string }
      pay_credit_card_bill: {
        Args: {
          _amount: number
          _bill_id: string
          _date?: string
          _from_account: string
        }
        Returns: undefined
      }
      recalc_account_balance: { Args: { _account_id: string }; Returns: number }
      recalc_financial_state: {
        Args: { _family_id: string; _mes: string; _renda?: number }
        Returns: {
          created_at: string
          family_id: string
          id: string
          mes: string
          meta_essenciais: number
          meta_estilo_vida: number
          meta_reserva: number
          modo_crise: boolean
          renda_mensal: number
          saldo_atual: number
          total_dividas: number
          total_essenciais: number
          total_estilo_vida: number
          total_reserva: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "financial_state"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_crisis: {
        Args: { _crisis_id: string }
        Returns: {
          ativo: boolean
          created_at: string
          criterio_disparado: string | null
          data_fim: string | null
          data_inicio: string
          estagio_atual: number
          family_id: string
          id: string
          motivo_ativacao: string
          plano_saida: Json | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "crisis_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      seed_default_categories: {
        Args: { _family_id: string }
        Returns: undefined
      }
      seed_default_categorization_keywords: {
        Args: { _family_id: string }
        Returns: undefined
      }
    }
    Enums: {
      account_type:
        | "corrente"
        | "poupanca"
        | "carteira"
        | "cartao"
        | "investimento"
      alert_severity: "info" | "warning" | "critical"
      categorization_origin: "manual" | "ia" | "keyword"
      category_type: "despesa" | "receita"
      credit_card_bill_status: "aberta" | "fechada" | "paga"
      family_role: "admin" | "member"
      recurring_frequency: "mensal" | "semanal" | "quinzenal" | "anual"
      transaction_scope: "family" | "personal"
      transaction_source: "manual" | "importado" | "cartao"
      transaction_special_type: "normal" | "transferencia" | "pagamento_fatura"
      transaction_type: "income" | "expense"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_type: [
        "corrente",
        "poupanca",
        "carteira",
        "cartao",
        "investimento",
      ],
      alert_severity: ["info", "warning", "critical"],
      categorization_origin: ["manual", "ia", "keyword"],
      category_type: ["despesa", "receita"],
      credit_card_bill_status: ["aberta", "fechada", "paga"],
      family_role: ["admin", "member"],
      recurring_frequency: ["mensal", "semanal", "quinzenal", "anual"],
      transaction_scope: ["family", "personal"],
      transaction_source: ["manual", "importado", "cartao"],
      transaction_special_type: ["normal", "transferencia", "pagamento_fatura"],
      transaction_type: ["income", "expense"],
    },
  },
} as const
