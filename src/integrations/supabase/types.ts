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
          agencia: string | null
          ativo: boolean
          banco: string | null
          bandeira: string | null
          cor: string
          created_at: string
          dia_fechamento: number | null
          dia_vencimento: number | null
          digito: string | null
          family_id: string
          icone: string
          id: string
          limite_cheque_especial: number | null
          limite_credito: number | null
          nome: string
          numero_conta: string | null
          saldo_atual: number
          saldo_inicial: number
          tipo: Database["public"]["Enums"]["account_type"]
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          bandeira?: string | null
          cor?: string
          created_at?: string
          dia_fechamento?: number | null
          dia_vencimento?: number | null
          digito?: string | null
          family_id: string
          icone?: string
          id?: string
          limite_cheque_especial?: number | null
          limite_credito?: number | null
          nome: string
          numero_conta?: string | null
          saldo_atual?: number
          saldo_inicial?: number
          tipo?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          bandeira?: string | null
          cor?: string
          created_at?: string
          dia_fechamento?: number | null
          dia_vencimento?: number | null
          digito?: string | null
          family_id?: string
          icone?: string
          id?: string
          limite_cheque_especial?: number | null
          limite_credito?: number | null
          nome?: string
          numero_conta?: string | null
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
      consumption_history: {
        Row: {
          created_at: string
          family_id: string
          id: string
          mes: string
          product_id: string
          quantidade_consumida: number
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          mes: string
          product_id: string
          quantidade_consumida?: number
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          mes?: string
          product_id?: string
          quantidade_consumida?: number
        }
        Relationships: [
          {
            foreignKeyName: "consumption_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumption_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumption_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_status"
            referencedColumns: ["product_id"]
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
      cycle_config: {
        Row: {
          created_at: string
          family_id: string
          frequencia_dias: number
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          family_id: string
          frequencia_dias?: number
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          family_id?: string
          frequencia_dias?: number
          id?: string
          updated_at?: string
        }
        Relationships: []
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
      fuel_fills: {
        Row: {
          combustivel: Database["public"]["Enums"]["fuel_type"]
          created_at: string
          data: string
          family_id: string
          hodometro: number
          id: string
          litros: number
          posto: string | null
          preco_litro: number
          tanque_cheio: boolean
          transaction_id: string | null
          user_id: string
          valor_pago: number
          vehicle_id: string
        }
        Insert: {
          combustivel: Database["public"]["Enums"]["fuel_type"]
          created_at?: string
          data?: string
          family_id: string
          hodometro: number
          id?: string
          litros: number
          posto?: string | null
          preco_litro: number
          tanque_cheio?: boolean
          transaction_id?: string | null
          user_id: string
          valor_pago: number
          vehicle_id: string
        }
        Update: {
          combustivel?: Database["public"]["Enums"]["fuel_type"]
          created_at?: string
          data?: string
          family_id?: string
          hodometro?: number
          id?: string
          litros?: number
          posto?: string | null
          preco_litro?: number
          tanque_cheio?: boolean
          transaction_id?: string | null
          user_id?: string
          valor_pago?: number
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_fills_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_vehicle_status"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "fuel_fills_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_monthly_goals: {
        Row: {
          created_at: string
          family_id: string
          id: string
          mes: string
          updated_at: string
          valor_meta: number
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          mes: string
          updated_at?: string
          valor_meta?: number
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          mes?: string
          updated_at?: string
          valor_meta?: number
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fuel_monthly_goals_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_vehicle_status"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "fuel_monthly_goals_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
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
      price_history: {
        Row: {
          created_at: string
          data: string
          family_id: string
          id: string
          preco: number
          product_id: string
        }
        Insert: {
          created_at?: string
          data?: string
          family_id: string
          id?: string
          preco: number
          product_id: string
        }
        Update: {
          created_at?: string
          data?: string
          family_id?: string
          id?: string
          preco?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_status"
            referencedColumns: ["product_id"]
          },
        ]
      }
      products: {
        Row: {
          ativo: boolean
          categoria: string | null
          codigo_barras: string | null
          created_at: string
          data_validade: string | null
          family_id: string
          id: string
          localizacao: Database["public"]["Enums"]["stock_location"]
          marca: string | null
          nome: string
          preco_atual: number | null
          quantidade_atual: number
          quantidade_minima: number
          ultima_revisao: string | null
          unidade: Database["public"]["Enums"]["stock_unit"]
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          codigo_barras?: string | null
          created_at?: string
          data_validade?: string | null
          family_id: string
          id?: string
          localizacao?: Database["public"]["Enums"]["stock_location"]
          marca?: string | null
          nome: string
          preco_atual?: number | null
          quantidade_atual?: number
          quantidade_minima?: number
          ultima_revisao?: string | null
          unidade?: Database["public"]["Enums"]["stock_unit"]
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          codigo_barras?: string | null
          created_at?: string
          data_validade?: string | null
          family_id?: string
          id?: string
          localizacao?: Database["public"]["Enums"]["stock_location"]
          marca?: string | null
          nome?: string
          preco_atual?: number | null
          quantidade_atual?: number
          quantidade_minima?: number
          ultima_revisao?: string | null
          unidade?: Database["public"]["Enums"]["stock_unit"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      stock_movements: {
        Row: {
          created_at: string
          data: string
          family_id: string
          id: string
          motivo: string | null
          preco_unitario: number | null
          product_id: string
          quantidade: number
          tipo: Database["public"]["Enums"]["stock_movement_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: string
          family_id: string
          id?: string
          motivo?: string | null
          preco_unitario?: number | null
          product_id: string
          quantidade: number
          tipo: Database["public"]["Enums"]["stock_movement_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          data?: string
          family_id?: string
          id?: string
          motivo?: string | null
          preco_unitario?: number | null
          product_id?: string
          quantidade?: number
          tipo?: Database["public"]["Enums"]["stock_movement_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_status"
            referencedColumns: ["product_id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          category: string | null
          category_id: string | null
          conciliado: boolean
          conciliado_em: string | null
          created_at: string
          date: string
          description: string
          external_id: string | null
          family_id: string
          id: string
          is_essencial: boolean
          recorrente_id: string | null
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
          conciliado?: boolean
          conciliado_em?: string | null
          created_at?: string
          date?: string
          description: string
          external_id?: string | null
          family_id: string
          id?: string
          is_essencial?: boolean
          recorrente_id?: string | null
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
          conciliado?: boolean
          conciliado_em?: string | null
          created_at?: string
          date?: string
          description?: string
          external_id?: string | null
          family_id?: string
          id?: string
          is_essencial?: boolean
          recorrente_id?: string | null
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
          {
            foreignKeyName: "transactions_recorrente_id_fkey"
            columns: ["recorrente_id"]
            isOneToOne: false
            referencedRelation: "recurring_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_maintenance_log: {
        Row: {
          created_at: string
          data: string
          family_id: string
          hodometro: number
          id: string
          local: string | null
          maintenance_type_id: string | null
          nome: string
          observacao: string | null
          tipo_oleo: string | null
          transaction_id: string | null
          user_id: string
          valor: number
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          data?: string
          family_id: string
          hodometro: number
          id?: string
          local?: string | null
          maintenance_type_id?: string | null
          nome: string
          observacao?: string | null
          tipo_oleo?: string | null
          transaction_id?: string | null
          user_id: string
          valor?: number
          vehicle_id: string
        }
        Update: {
          created_at?: string
          data?: string
          family_id?: string
          hodometro?: number
          id?: string
          local?: string | null
          maintenance_type_id?: string | null
          nome?: string
          observacao?: string | null
          tipo_oleo?: string | null
          transaction_id?: string | null
          user_id?: string
          valor?: number
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_maintenance_log_maintenance_type_id_fkey"
            columns: ["maintenance_type_id"]
            isOneToOne: false
            referencedRelation: "vehicle_maintenance_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_maintenance_log_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_vehicle_status"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vehicle_maintenance_log_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_maintenance_types: {
        Row: {
          ativo: boolean
          created_at: string
          family_id: string
          icone: string
          id: string
          intervalo_km: number | null
          intervalo_meses: number | null
          nome: string
          vehicle_id: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          family_id: string
          icone?: string
          id?: string
          intervalo_km?: number | null
          intervalo_meses?: number | null
          nome: string
          vehicle_id?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          family_id?: string
          icone?: string
          id?: string
          intervalo_km?: number | null
          intervalo_meses?: number | null
          nome?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_maintenance_types_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_vehicle_status"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vehicle_maintenance_types_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          ativo: boolean
          capacidade_tanque: number
          combustivel_principal: Database["public"]["Enums"]["fuel_type"]
          consumo_medio_kml: number
          cor: string
          created_at: string
          family_id: string
          flex: boolean
          id: string
          nome: string
          odometro_atual: number
          tipo: Database["public"]["Enums"]["vehicle_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          capacidade_tanque?: number
          combustivel_principal?: Database["public"]["Enums"]["fuel_type"]
          consumo_medio_kml?: number
          cor?: string
          created_at?: string
          family_id: string
          flex?: boolean
          id?: string
          nome: string
          odometro_atual?: number
          tipo?: Database["public"]["Enums"]["vehicle_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          capacidade_tanque?: number
          combustivel_principal?: Database["public"]["Enums"]["fuel_type"]
          consumo_medio_kml?: number
          cor?: string
          created_at?: string
          family_id?: string
          flex?: boolean
          id?: string
          nome?: string
          odometro_atual?: number
          tipo?: Database["public"]["Enums"]["vehicle_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      v_stock_review: {
        Row: {
          categoria: string | null
          data_validade: string | null
          dias_para_vencer: number | null
          dias_restantes: number | null
          dias_sem_revisao: number | null
          family_id: string | null
          id: string | null
          nome: string | null
          quantidade_atual: number | null
          quantidade_minima: number | null
          ultima_revisao: string | null
          unidade: Database["public"]["Enums"]["stock_unit"] | null
          urgencia: string | null
        }
        Insert: {
          categoria?: string | null
          data_validade?: string | null
          dias_para_vencer?: never
          dias_restantes?: never
          dias_sem_revisao?: never
          family_id?: string | null
          id?: string | null
          nome?: string | null
          quantidade_atual?: number | null
          quantidade_minima?: number | null
          ultima_revisao?: string | null
          unidade?: Database["public"]["Enums"]["stock_unit"] | null
          urgencia?: never
        }
        Update: {
          categoria?: string | null
          data_validade?: string | null
          dias_para_vencer?: never
          dias_restantes?: never
          dias_sem_revisao?: never
          family_id?: string | null
          id?: string | null
          nome?: string | null
          quantidade_atual?: number | null
          quantidade_minima?: number | null
          ultima_revisao?: string | null
          unidade?: Database["public"]["Enums"]["stock_unit"] | null
          urgencia?: never
        }
        Relationships: []
      }
      v_stock_status: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          consumo_diario: number | null
          data_validade: string | null
          dias_para_vencer: number | null
          dias_restantes: number | null
          family_id: string | null
          localizacao: Database["public"]["Enums"]["stock_location"] | null
          marca: string | null
          nome: string | null
          preco_anterior: number | null
          preco_atual: number | null
          product_id: string | null
          quantidade_atual: number | null
          quantidade_minima: number | null
          risco_ruptura: boolean | null
          status: string | null
          unidade: Database["public"]["Enums"]["stock_unit"] | null
          variacao_preco_pct: number | null
        }
        Relationships: []
      }
      v_vehicle_status: {
        Row: {
          ativo: boolean | null
          capacidade_tanque: number | null
          consumo_medio_kml: number | null
          cor: string | null
          family_id: string | null
          flex: boolean | null
          gasto_mes: number | null
          km_restantes: number | null
          nome: string | null
          odometro_atual: number | null
          tanque_pct: number | null
          tipo: Database["public"]["Enums"]["vehicle_type"] | null
          ultimo_abastec_combustivel:
            | Database["public"]["Enums"]["fuel_type"]
            | null
          ultimo_abastec_data: string | null
          ultimo_abastec_hodometro: number | null
          ultimo_abastec_litros: number | null
          ultimo_abastec_preco_litro: number | null
          ultimo_abastec_tanque_cheio: boolean | null
          vehicle_id: string | null
        }
        Relationships: []
      }
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
      adjust_account_balance: {
        Args: {
          p_account_id: string
          p_family_id: string
          p_observacao?: string
          p_saldo_real: number
          p_user_id: string
        }
        Returns: undefined
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
      check_duplicate_transaction: {
        Args: {
          p_account_id?: string
          p_amount: number
          p_date: string
          p_description: string
          p_family_id: string
        }
        Returns: {
          amount: number
          date: string
          description: string
          id: string
          similarity_score: number
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
      get_fuel_history: {
        Args: { p_vehicle_id: string }
        Returns: {
          combustivel: Database["public"]["Enums"]["fuel_type"]
          data: string
          hodometro: number
          id: string
          kml: number
          litros: number
          posto: string
          preco_litro: number
          tanque_cheio: boolean
          valor_pago: number
        }[]
      }
      get_maintenance_status: {
        Args: { p_vehicle_id: string }
        Returns: {
          icone: string
          intervalo_km: number
          intervalo_meses: number
          motivo: string
          nome: string
          status: string
          type_id: string
          ultima_data: string
          ultimo_hodometro: number
        }[]
      }
      get_monthly_summary: {
        Args: { p_family_id: string }
        Returns: {
          mes: string
          qtd: number
          total_despesa: number
          total_receita: number
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
      get_transactions_by_month: {
        Args: { p_family_id: string; p_mes: string }
        Returns: {
          account_id: string | null
          amount: number
          category: string | null
          category_id: string | null
          conciliado: boolean
          conciliado_em: string | null
          created_at: string
          date: string
          description: string
          external_id: string | null
          family_id: string
          id: string
          is_essencial: boolean
          recorrente_id: string | null
          scope: Database["public"]["Enums"]["transaction_scope"]
          source: Database["public"]["Enums"]["transaction_source"]
          tipo_especial: Database["public"]["Enums"]["transaction_special_type"]
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: false
          isSetofReturn: true
        }
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
      fuel_type: "gasolina" | "aditivada" | "etanol" | "diesel" | "gnv"
      recurring_frequency: "mensal" | "semanal" | "quinzenal" | "anual"
      stock_location: "geladeira" | "freezer" | "despensa" | "armario" | "outro"
      stock_movement_type: "entrada" | "saida" | "ajuste" | "perda"
      stock_unit: "un" | "kg" | "g" | "L" | "ml" | "pct"
      transaction_scope: "family" | "personal"
      transaction_source: "manual" | "importado" | "cartao"
      transaction_special_type: "normal" | "transferencia" | "pagamento_fatura"
      transaction_type: "income" | "expense"
      vehicle_type: "carro" | "moto" | "caminhao" | "outro"
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
      fuel_type: ["gasolina", "aditivada", "etanol", "diesel", "gnv"],
      recurring_frequency: ["mensal", "semanal", "quinzenal", "anual"],
      stock_location: ["geladeira", "freezer", "despensa", "armario", "outro"],
      stock_movement_type: ["entrada", "saida", "ajuste", "perda"],
      stock_unit: ["un", "kg", "g", "L", "ml", "pct"],
      transaction_scope: ["family", "personal"],
      transaction_source: ["manual", "importado", "cartao"],
      transaction_special_type: ["normal", "transferencia", "pagamento_fatura"],
      transaction_type: ["income", "expense"],
      vehicle_type: ["carro", "moto", "caminhao", "outro"],
    },
  },
} as const
