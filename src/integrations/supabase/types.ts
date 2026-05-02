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
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
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
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
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
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
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
      check_crisis_activation: {
        Args: { _family_id: string; _mes: string }
        Returns: {
          criterio: string
          should_activate: boolean
        }[]
      }
      count_ai_runs_today: { Args: { _family_id: string }; Returns: number }
      get_user_family_id: { Args: { _user_id: string }; Returns: string }
      is_family_admin: {
        Args: { _family_id: string; _user_id: string }
        Returns: boolean
      }
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
    }
    Enums: {
      category_type: "despesa" | "receita"
      family_role: "admin" | "member"
      transaction_scope: "family" | "personal"
      transaction_source: "manual" | "importado" | "cartao"
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
      category_type: ["despesa", "receita"],
      family_role: ["admin", "member"],
      transaction_scope: ["family", "personal"],
      transaction_source: ["manual", "importado", "cartao"],
      transaction_type: ["income", "expense"],
    },
  },
} as const
