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
      transaction_scope: ["family", "personal"],
      transaction_source: ["manual", "importado", "cartao"],
      transaction_special_type: ["normal", "transferencia", "pagamento_fatura"],
      transaction_type: ["income", "expense"],
    },
  },
} as const
