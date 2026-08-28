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
          ativo: boolean | null
          banco: string | null
          bandeira: string | null
          cor: string | null
          created_at: string | null
          dia_fechamento: number | null
          dia_vencimento: number | null
          digito: string | null
          family_id: string
          icone: string | null
          id: string
          limite_cheque_especial: number | null
          limite_credito: number | null
          nome: string
          numero_conta: string | null
          saldo_atual: number | null
          saldo_inicial: number | null
          tipo: string
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean | null
          banco?: string | null
          bandeira?: string | null
          cor?: string | null
          created_at?: string | null
          dia_fechamento?: number | null
          dia_vencimento?: number | null
          digito?: string | null
          family_id: string
          icone?: string | null
          id?: string
          limite_cheque_especial?: number | null
          limite_credito?: number | null
          nome: string
          numero_conta?: string | null
          saldo_atual?: number | null
          saldo_inicial?: number | null
          tipo: string
        }
        Update: {
          agencia?: string | null
          ativo?: boolean | null
          banco?: string | null
          bandeira?: string | null
          cor?: string | null
          created_at?: string | null
          dia_fechamento?: number | null
          dia_vencimento?: number | null
          digito?: string | null
          family_id?: string
          icone?: string | null
          id?: string
          limite_cheque_especial?: number | null
          limite_credito?: number | null
          nome?: string
          numero_conta?: string | null
          saldo_atual?: number | null
          saldo_inicial?: number | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_logs: {
        Row: {
          created_at: string | null
          error_msg: string | null
          estimated_cost: number | null
          family_id: string | null
          feature: string
          id: string
          latency_ms: number | null
          prompt: string | null
          response: string | null
          success: boolean | null
          tokens_input: number | null
          tokens_output: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_msg?: string | null
          estimated_cost?: number | null
          family_id?: string | null
          feature: string
          id?: string
          latency_ms?: number | null
          prompt?: string | null
          response?: string | null
          success?: boolean | null
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_msg?: string | null
          estimated_cost?: number | null
          family_id?: string | null
          feature?: string
          id?: string
          latency_ms?: number | null
          prompt?: string | null
          response?: string | null
          success?: boolean | null
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_logs_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          created_at: string | null
          family_id: string
          id: string
          lido: boolean | null
          mensagem: string
          referencia_id: string | null
          referencia_tipo: string | null
          severidade: string | null
          tipo: string
        }
        Insert: {
          created_at?: string | null
          family_id: string
          id?: string
          lido?: boolean | null
          mensagem: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          severidade?: string | null
          tipo: string
        }
        Update: {
          created_at?: string | null
          family_id?: string
          id?: string
          lido?: boolean | null
          mensagem?: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          severidade?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      bills_reminders: {
        Row: {
          account_id: string | null
          created_at: string | null
          credit_card_bill_id: string | null
          data_vencimento: string
          descricao: string
          dias_antecedencia_alerta: number | null
          family_id: string
          id: string
          mes_referencia: string | null
          recorrente_id: string | null
          status: string | null
          transaction_id: string | null
          valor: number | null
          valor_estimado: number | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          credit_card_bill_id?: string | null
          data_vencimento: string
          descricao: string
          dias_antecedencia_alerta?: number | null
          family_id: string
          id?: string
          mes_referencia?: string | null
          recorrente_id?: string | null
          status?: string | null
          transaction_id?: string | null
          valor?: number | null
          valor_estimado?: number | null
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          credit_card_bill_id?: string | null
          data_vencimento?: string
          descricao?: string
          dias_antecedencia_alerta?: number | null
          family_id?: string
          id?: string
          mes_referencia?: string | null
          recorrente_id?: string | null
          status?: string | null
          transaction_id?: string | null
          valor?: number | null
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bills_reminders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_reminders_credit_card_bill_id_fkey"
            columns: ["credit_card_bill_id"]
            isOneToOne: true
            referencedRelation: "credit_card_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_reminders_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_reminders_recorrente_id_fkey"
            columns: ["recorrente_id"]
            isOneToOne: false
            referencedRelation: "recurring_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_reminders_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          category_id: string
          conta_origem: string | null
          created_at: string | null
          family_id: string
          id: string
          mes: string
          responsavel: string | null
          valor_planejado: number
        }
        Insert: {
          category_id: string
          conta_origem?: string | null
          created_at?: string | null
          family_id: string
          id?: string
          mes: string
          responsavel?: string | null
          valor_planejado: number
        }
        Update: {
          category_id?: string
          conta_origem?: string | null
          created_at?: string | null
          family_id?: string
          id?: string
          mes?: string
          responsavel?: string | null
          valor_planejado?: number
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          cor: string | null
          created_at: string | null
          family_id: string | null
          icone: string | null
          id: string
          is_essencial: boolean | null
          nome: string
          parent_id: string | null
          responsavel_padrao: string | null
          tipo: string
        }
        Insert: {
          cor?: string | null
          created_at?: string | null
          family_id?: string | null
          icone?: string | null
          id?: string
          is_essencial?: boolean | null
          nome: string
          parent_id?: string | null
          responsavel_padrao?: string | null
          tipo: string
        }
        Update: {
          cor?: string | null
          created_at?: string | null
          family_id?: string | null
          icone?: string | null
          id?: string
          is_essencial?: boolean | null
          nome?: string
          parent_id?: string | null
          responsavel_padrao?: string | null
          tipo?: string
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
          account_id: string | null
          category_id: string
          confianca: number | null
          created_at: string | null
          family_id: string
          id: string
          origem: string | null
          termo: string
          termo_normalizado: string
          updated_at: string | null
          usos: number | null
        }
        Insert: {
          account_id?: string | null
          category_id: string
          confianca?: number | null
          created_at?: string | null
          family_id: string
          id?: string
          origem?: string | null
          termo: string
          termo_normalizado: string
          updated_at?: string | null
          usos?: number | null
        }
        Update: {
          account_id?: string | null
          category_id?: string
          confianca?: number | null
          created_at?: string | null
          family_id?: string
          id?: string
          origem?: string | null
          termo?: string
          termo_normalizado?: string
          updated_at?: string | null
          usos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "categorization_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categorization_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categorization_rules_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      consumption_history: {
        Row: {
          confirmado_pelo_usuario: boolean | null
          consumo_calculado: number
          created_at: string | null
          data_fim: string
          data_inicio: string
          family_id: string
          id: string
          origem: string | null
          periodo_dias: number
          product_id: string
        }
        Insert: {
          confirmado_pelo_usuario?: boolean | null
          consumo_calculado: number
          created_at?: string | null
          data_fim: string
          data_inicio: string
          family_id: string
          id?: string
          origem?: string | null
          periodo_dias: number
          product_id: string
        }
        Update: {
          confirmado_pelo_usuario?: boolean | null
          consumo_calculado?: number
          created_at?: string | null
          data_fim?: string
          data_inicio?: string
          family_id?: string
          id?: string
          origem?: string | null
          periodo_dias?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumption_history_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
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
            referencedColumns: ["id"]
          },
        ]
      }
      credit_card_bills: {
        Row: {
          account_id: string
          created_at: string | null
          data_fechamento: string | null
          data_vencimento: string | null
          family_id: string
          id: string
          mes_referencia: string
          status: string | null
          valor_pago: number | null
          valor_total: number | null
        }
        Insert: {
          account_id: string
          created_at?: string | null
          data_fechamento?: string | null
          data_vencimento?: string | null
          family_id: string
          id?: string
          mes_referencia: string
          status?: string | null
          valor_pago?: number | null
          valor_total?: number | null
        }
        Update: {
          account_id?: string
          created_at?: string | null
          data_fechamento?: string | null
          data_vencimento?: string | null
          family_id?: string
          id?: string
          mes_referencia?: string
          status?: string | null
          valor_pago?: number | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_card_bills_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_card_bills_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      crisis_events: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          criterio_disparado: string | null
          data_fim: string | null
          data_inicio: string
          estagio_atual: number | null
          family_id: string
          id: string
          motivo_ativacao: string
          plano_saida: Json | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          criterio_disparado?: string | null
          data_fim?: string | null
          data_inicio: string
          estagio_atual?: number | null
          family_id: string
          id?: string
          motivo_ativacao: string
          plano_saida?: Json | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          criterio_disparado?: string | null
          data_fim?: string | null
          data_inicio?: string
          estagio_atual?: number | null
          family_id?: string
          id?: string
          motivo_ativacao?: string
          plano_saida?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "crisis_events_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      crisis_stage_history: {
        Row: {
          created_at: string | null
          crisis_id: string
          criterio_avanco: string | null
          data_entrada: string
          data_saida: string | null
          estagio: number
          id: string
        }
        Insert: {
          created_at?: string | null
          crisis_id: string
          criterio_avanco?: string | null
          data_entrada: string
          data_saida?: string | null
          estagio: number
          id?: string
        }
        Update: {
          created_at?: string | null
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
          created_at: string | null
          data_inicio: string
          data_proxima_compra: string
          family_id: string
          frequencia_dias: number | null
          id: string
        }
        Insert: {
          created_at?: string | null
          data_inicio: string
          data_proxima_compra: string
          family_id: string
          frequencia_dias?: number | null
          id?: string
        }
        Update: {
          created_at?: string | null
          data_inicio?: string
          data_proxima_compra?: string
          family_id?: string
          frequencia_dias?: number | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycle_config_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_ai_runs: {
        Row: {
          created_at: string | null
          custo_credito: number | null
          data: string | null
          family_id: string | null
          id: string
          modulo: string | null
          prompt_usado: string | null
          resposta_ia: Json | null
        }
        Insert: {
          created_at?: string | null
          custo_credito?: number | null
          data?: string | null
          family_id?: string | null
          id?: string
          modulo?: string | null
          prompt_usado?: string | null
          resposta_ia?: Json | null
        }
        Update: {
          created_at?: string | null
          custo_credito?: number | null
          data?: string | null
          family_id?: string | null
          id?: string
          modulo?: string | null
          prompt_usado?: string | null
          resposta_ia?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_ai_runs_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      family_invites: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string | null
          expires_at: string | null
          family_id: string | null
          id: string
          invited_by: string | null
          status: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          family_id?: string | null
          id?: string
          invited_by?: string | null
          status?: string | null
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          family_id?: string | null
          id?: string
          invited_by?: string | null
          status?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_invites_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          cor: string | null
          created_at: string | null
          family_id: string | null
          icone: string | null
          id: string
          nome: string | null
          role: string | null
          tipo: string | null
          user_id: string | null
        }
        Insert: {
          cor?: string | null
          created_at?: string | null
          family_id?: string | null
          icone?: string | null
          id?: string
          nome?: string | null
          role?: string | null
          tipo?: string | null
          user_id?: string | null
        }
        Update: {
          cor?: string | null
          created_at?: string | null
          family_id?: string | null
          icone?: string | null
          id?: string
          nome?: string | null
          role?: string | null
          tipo?: string | null
          user_id?: string | null
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
          created_at: string | null
          family_id: string
          id: string
          updated_at: string | null
          valor: string | null
        }
        Insert: {
          chave: string
          created_at?: string | null
          family_id: string
          id?: string
          updated_at?: string | null
          valor?: string | null
        }
        Update: {
          chave?: string
          created_at?: string | null
          family_id?: string
          id?: string
          updated_at?: string | null
          valor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_settings_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_state: {
        Row: {
          created_at: string | null
          family_id: string
          id: string
          mes: string
          meta_essenciais: number | null
          meta_estilo_vida: number | null
          meta_reserva: number | null
          modo_crise: boolean | null
          renda_mensal: number
          saldo_atual: number | null
          total_dividas: number | null
          total_essenciais: number | null
          total_estilo_vida: number | null
          total_reserva: number | null
        }
        Insert: {
          created_at?: string | null
          family_id: string
          id?: string
          mes: string
          meta_essenciais?: number | null
          meta_estilo_vida?: number | null
          meta_reserva?: number | null
          modo_crise?: boolean | null
          renda_mensal: number
          saldo_atual?: number | null
          total_dividas?: number | null
          total_essenciais?: number | null
          total_estilo_vida?: number | null
          total_reserva?: number | null
        }
        Update: {
          created_at?: string | null
          family_id?: string
          id?: string
          mes?: string
          meta_essenciais?: number | null
          meta_estilo_vida?: number | null
          meta_reserva?: number | null
          modo_crise?: boolean | null
          renda_mensal?: number
          saldo_atual?: number | null
          total_dividas?: number | null
          total_essenciais?: number | null
          total_estilo_vida?: number | null
          total_reserva?: number | null
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
          combustivel_usado: string
          created_at: string | null
          data: string
          family_id: string
          hodometro: number | null
          id: string
          litros: number | null
          litros_calculado: boolean | null
          observacao: string | null
          odometro: number
          posto: string | null
          preco_litro: number
          tanque_cheio: boolean | null
          transaction_id: string | null
          valor_pago: number
          vehicle_id: string
        }
        Insert: {
          combustivel_usado: string
          created_at?: string | null
          data: string
          family_id: string
          hodometro?: number | null
          id?: string
          litros?: number | null
          litros_calculado?: boolean | null
          observacao?: string | null
          odometro: number
          posto?: string | null
          preco_litro: number
          tanque_cheio?: boolean | null
          transaction_id?: string | null
          valor_pago: number
          vehicle_id: string
        }
        Update: {
          combustivel_usado?: string
          created_at?: string | null
          data?: string
          family_id?: string
          hodometro?: number | null
          id?: string
          litros?: number | null
          litros_calculado?: boolean | null
          observacao?: string | null
          odometro?: number
          posto?: string | null
          preco_litro?: number
          tanque_cheio?: boolean | null
          transaction_id?: string | null
          valor_pago?: number
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_fills_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_fills_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_fills_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_flex_comparison"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "fuel_fills_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_vehicle_status"
            referencedColumns: ["id"]
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
          created_at: string | null
          family_id: string
          gasto_planejado: number | null
          id: string
          km_planejado: number | null
          mes: string
          modo_crise: boolean | null
          vehicle_id: string
        }
        Insert: {
          created_at?: string | null
          family_id: string
          gasto_planejado?: number | null
          id?: string
          km_planejado?: number | null
          mes: string
          modo_crise?: boolean | null
          vehicle_id: string
        }
        Update: {
          created_at?: string | null
          family_id?: string
          gasto_planejado?: number | null
          id?: string
          km_planejado?: number | null
          mes?: string
          modo_crise?: boolean | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_monthly_goals_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_monthly_goals_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_flex_comparison"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "fuel_monthly_goals_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_vehicle_status"
            referencedColumns: ["id"]
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
          account_id: string | null
          ativo: boolean | null
          category_id: string | null
          created_at: string | null
          data_primeira_parcela: string
          descricao: string
          family_id: string
          id: string
          num_parcelas: number
          parcelas_pagas: number | null
          valor_parcela: number
          valor_total: number
        }
        Insert: {
          account_id?: string | null
          ativo?: boolean | null
          category_id?: string | null
          created_at?: string | null
          data_primeira_parcela: string
          descricao: string
          family_id: string
          id?: string
          num_parcelas: number
          parcelas_pagas?: number | null
          valor_parcela: number
          valor_total: number
        }
        Update: {
          account_id?: string | null
          ativo?: boolean | null
          category_id?: string | null
          created_at?: string | null
          data_primeira_parcela?: string
          descricao?: string
          family_id?: string
          id?: string
          num_parcelas?: number
          parcelas_pagas?: number | null
          valor_parcela?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "installment_plans_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installment_plans_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installment_plans_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      installments: {
        Row: {
          account_id: string | null
          created_at: string | null
          credit_card_bill_id: string | null
          family_id: string
          id: string
          mes_competencia: string
          numero_parcela: number
          plan_id: string
          status: string | null
          transaction_id: string | null
          valor: number
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          credit_card_bill_id?: string | null
          family_id: string
          id?: string
          mes_competencia: string
          numero_parcela: number
          plan_id: string
          status?: string | null
          transaction_id?: string | null
          valor: number
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          credit_card_bill_id?: string | null
          family_id?: string
          id?: string
          mes_competencia?: string
          numero_parcela?: number
          plan_id?: string
          status?: string | null
          transaction_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "installments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_credit_card_bill_id_fkey"
            columns: ["credit_card_bill_id"]
            isOneToOne: false
            referencedRelation: "credit_card_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "installment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      keep_alive_log: {
        Row: {
          executado_em: string | null
          id: string
          status: string | null
        }
        Insert: {
          executado_em?: string | null
          id?: string
          status?: string | null
        }
        Update: {
          executado_em?: string | null
          id?: string
          status?: string | null
        }
        Relationships: []
      }
      maintenance_tasks: {
        Row: {
          categoria: string | null
          created_at: string | null
          custo_estimado: number | null
          custo_real: number | null
          data_conclusao: string | null
          data_prevista: string | null
          descricao: string | null
          family_id: string | null
          fotos: string[] | null
          id: string
          intervalo_dias: number | null
          prioridade: string | null
          proxima_data: string | null
          recorrente: boolean | null
          responsavel: string | null
          status: string | null
          titulo: string
          updated_at: string | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string | null
          custo_estimado?: number | null
          custo_real?: number | null
          data_conclusao?: string | null
          data_prevista?: string | null
          descricao?: string | null
          family_id?: string | null
          fotos?: string[] | null
          id?: string
          intervalo_dias?: number | null
          prioridade?: string | null
          proxima_data?: string | null
          recorrente?: boolean | null
          responsavel?: string | null
          status?: string | null
          titulo: string
          updated_at?: string | null
        }
        Update: {
          categoria?: string | null
          created_at?: string | null
          custo_estimado?: number | null
          custo_real?: number | null
          data_conclusao?: string | null
          data_prevista?: string | null
          descricao?: string | null
          family_id?: string | null
          fotos?: string[] | null
          id?: string
          intervalo_dias?: number | null
          prioridade?: string | null
          proxima_data?: string | null
          recorrente?: boolean | null
          responsavel?: string | null
          status?: string | null
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tasks_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          created_at: string | null
          data: string
          family_id: string
          id: string
          local_compra: string | null
          preco: number
          product_id: string
        }
        Insert: {
          created_at?: string | null
          data?: string
          family_id: string
          id?: string
          local_compra?: string | null
          preco: number
          product_id: string
        }
        Update: {
          created_at?: string | null
          data?: string
          family_id?: string
          id?: string
          local_compra?: string | null
          preco?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_history_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
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
            referencedColumns: ["id"]
          },
        ]
      }
      product_category_rules: {
        Row: {
          categoria_financeira_id: string | null
          categoria_financeira_nome: string | null
          confianca: number | null
          created_at: string | null
          family_id: string | null
          id: string
          origem: string | null
          termo: string
          usos: number | null
        }
        Insert: {
          categoria_financeira_id?: string | null
          categoria_financeira_nome?: string | null
          confianca?: number | null
          created_at?: string | null
          family_id?: string | null
          id?: string
          origem?: string | null
          termo: string
          usos?: number | null
        }
        Update: {
          categoria_financeira_id?: string | null
          categoria_financeira_nome?: string | null
          confianca?: number | null
          created_at?: string | null
          family_id?: string | null
          id?: string
          origem?: string | null
          termo?: string
          usos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_category_rules_categoria_financeira_id_fkey"
            columns: ["categoria_financeira_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_category_rules_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_history: {
        Row: {
          created_at: string | null
          data: string
          family_id: string | null
          id: string
          location_id: string | null
          preco_unitario: number
          product_id: string | null
          quantidade: number | null
          shopping_list_id: string | null
        }
        Insert: {
          created_at?: string | null
          data: string
          family_id?: string | null
          id?: string
          location_id?: string | null
          preco_unitario: number
          product_id?: string | null
          quantidade?: number | null
          shopping_list_id?: string | null
        }
        Update: {
          created_at?: string | null
          data?: string
          family_id?: string | null
          id?: string
          location_id?: string | null
          preco_unitario?: number
          product_id?: string | null
          quantidade?: number | null
          shopping_list_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_price_history_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_history_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "shopping_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_status"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          codigo_barras: string | null
          consumo_diario_medio: number | null
          consumo_medio_diario: number | null
          created_at: string | null
          custo_medio: number | null
          data_ultima_compra: string | null
          data_ultima_compra_preco: string | null
          data_validade: string | null
          dias_restantes: number | null
          duracao_estimativa_dias: number | null
          estoque_atual: number | null
          estoque_minimo: number | null
          estoque_minimo_auto: boolean | null
          family_id: string
          id: string
          is_variant: boolean | null
          localizacao: string | null
          marca: string | null
          nome: string
          parent_id: string | null
          preco_anterior: number | null
          preco_atual: number | null
          preco_ultima_compra: number | null
          previsao_reposicao: string | null
          produto_base: string | null
          quantidade_atual: number | null
          quantidade_minima: number | null
          quantidade_por_embalagem: number | null
          revisao_status: string | null
          softlist_id: string | null
          ultima_revisao: string | null
          unidade: string | null
          unidade_embalagem: string | null
          user_id: string | null
          validade: string | null
          volume_embalagem: number | null
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          codigo_barras?: string | null
          consumo_diario_medio?: number | null
          consumo_medio_diario?: number | null
          created_at?: string | null
          custo_medio?: number | null
          data_ultima_compra?: string | null
          data_ultima_compra_preco?: string | null
          data_validade?: string | null
          dias_restantes?: number | null
          duracao_estimativa_dias?: number | null
          estoque_atual?: number | null
          estoque_minimo?: number | null
          estoque_minimo_auto?: boolean | null
          family_id: string
          id?: string
          is_variant?: boolean | null
          localizacao?: string | null
          marca?: string | null
          nome: string
          parent_id?: string | null
          preco_anterior?: number | null
          preco_atual?: number | null
          preco_ultima_compra?: number | null
          previsao_reposicao?: string | null
          produto_base?: string | null
          quantidade_atual?: number | null
          quantidade_minima?: number | null
          quantidade_por_embalagem?: number | null
          revisao_status?: string | null
          softlist_id?: string | null
          ultima_revisao?: string | null
          unidade?: string | null
          unidade_embalagem?: string | null
          user_id?: string | null
          validade?: string | null
          volume_embalagem?: number | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          codigo_barras?: string | null
          consumo_diario_medio?: number | null
          consumo_medio_diario?: number | null
          created_at?: string | null
          custo_medio?: number | null
          data_ultima_compra?: string | null
          data_ultima_compra_preco?: string | null
          data_validade?: string | null
          dias_restantes?: number | null
          duracao_estimativa_dias?: number | null
          estoque_atual?: number | null
          estoque_minimo?: number | null
          estoque_minimo_auto?: boolean | null
          family_id?: string
          id?: string
          is_variant?: boolean | null
          localizacao?: string | null
          marca?: string | null
          nome?: string
          parent_id?: string | null
          preco_anterior?: number | null
          preco_atual?: number | null
          preco_ultima_compra?: number | null
          previsao_reposicao?: string | null
          produto_base?: string | null
          quantidade_atual?: number | null
          quantidade_minima?: number | null
          quantidade_por_embalagem?: number | null
          revisao_status?: string | null
          softlist_id?: string | null
          ultima_revisao?: string | null
          unidade?: string | null
          unidade_embalagem?: string | null
          user_id?: string | null
          validade?: string | null
          volume_embalagem?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v_stock_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v_stock_status"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          family_id: string | null
          id: string
          nome: string | null
        }
        Insert: {
          created_at?: string | null
          family_id?: string | null
          id: string
          nome?: string | null
        }
        Update: {
          created_at?: string | null
          family_id?: string | null
          id?: string
          nome?: string | null
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
          amount: number | null
          antecedencia_dias: number | null
          ativo: boolean | null
          category_id: string | null
          created_at: string | null
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          description: string | null
          dia_do_mes: number | null
          dia_vencimento: number | null
          family_id: string
          frequencia: string | null
          gerar_lembrete: boolean | null
          id: string
          proxima_data: string | null
          tipo: string
          type: string | null
          ultima_geracao: string | null
          user_id: string | null
          valor: number
        }
        Insert: {
          account_id?: string | null
          amount?: number | null
          antecedencia_dias?: number | null
          ativo?: boolean | null
          category_id?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          description?: string | null
          dia_do_mes?: number | null
          dia_vencimento?: number | null
          family_id: string
          frequencia?: string | null
          gerar_lembrete?: boolean | null
          id?: string
          proxima_data?: string | null
          tipo: string
          type?: string | null
          ultima_geracao?: string | null
          user_id?: string | null
          valor: number
        }
        Update: {
          account_id?: string | null
          amount?: number | null
          antecedencia_dias?: number | null
          ativo?: boolean | null
          category_id?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          description?: string | null
          dia_do_mes?: number | null
          dia_vencimento?: number | null
          family_id?: string
          frequencia?: string | null
          gerar_lembrete?: boolean | null
          id?: string
          proxima_data?: string | null
          tipo?: string
          type?: string | null
          ultima_geracao?: string | null
          user_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "recurring_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_items: {
        Row: {
          category_id: string | null
          comprado: boolean | null
          comprado_em: string | null
          created_at: string | null
          estoque_atualizado: boolean | null
          family_id: string | null
          id: string
          list_id: string | null
          nome: string
          observacao: string | null
          preco_estimado: number | null
          preco_real: number | null
          product_id: string | null
          produto_base: string | null
          quantidade: number | null
          unidade: string | null
        }
        Insert: {
          category_id?: string | null
          comprado?: boolean | null
          comprado_em?: string | null
          created_at?: string | null
          estoque_atualizado?: boolean | null
          family_id?: string | null
          id?: string
          list_id?: string | null
          nome: string
          observacao?: string | null
          preco_estimado?: number | null
          preco_real?: number | null
          product_id?: string | null
          produto_base?: string | null
          quantidade?: number | null
          unidade?: string | null
        }
        Update: {
          category_id?: string | null
          comprado?: boolean | null
          comprado_em?: string | null
          created_at?: string | null
          estoque_atualizado?: boolean | null
          family_id?: string | null
          id?: string
          list_id?: string | null
          nome?: string
          observacao?: string | null
          preco_estimado?: number | null
          preco_real?: number | null
          product_id?: string | null
          produto_base?: string | null
          quantidade?: number | null
          unidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopping_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_items_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "shopping_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_status"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_lists: {
        Row: {
          account_id: string | null
          category_id: string | null
          created_at: string | null
          created_by: string | null
          data_prevista: string | null
          family_id: string | null
          id: string
          local_preferido: string | null
          location_id: string | null
          nome: string
          observacao: string | null
          status: string | null
          total_estimado: number | null
          total_real: number | null
          transaction_id: string | null
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_prevista?: string | null
          family_id?: string | null
          id?: string
          local_preferido?: string | null
          location_id?: string | null
          nome?: string
          observacao?: string | null
          status?: string | null
          total_estimado?: number | null
          total_real?: number | null
          transaction_id?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_prevista?: string | null
          family_id?: string | null
          id?: string
          local_preferido?: string | null
          location_id?: string | null
          nome?: string
          observacao?: string | null
          status?: string | null
          total_estimado?: number | null
          total_real?: number | null
          transaction_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopping_lists_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_lists_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_lists_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_lists_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "shopping_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_lists_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_locations: {
        Row: {
          ativo: boolean | null
          cnpj: string | null
          created_at: string | null
          endereco: string | null
          family_id: string | null
          id: string
          nome: string
          tipo: string | null
        }
        Insert: {
          ativo?: boolean | null
          cnpj?: string | null
          created_at?: string | null
          endereco?: string | null
          family_id?: string | null
          id?: string
          nome: string
          tipo?: string | null
        }
        Update: {
          ativo?: boolean | null
          cnpj?: string | null
          created_at?: string | null
          endereco?: string | null
          family_id?: string | null
          id?: string
          nome?: string
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopping_locations_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_consumption_log: {
        Row: {
          created_at: string | null
          custo_total: number | null
          family_id: string | null
          id: string
          mes: string
          product_id: string | null
          quantidade_comprada: number | null
          quantidade_consumida: number | null
        }
        Insert: {
          created_at?: string | null
          custo_total?: number | null
          family_id?: string | null
          id?: string
          mes: string
          product_id?: string | null
          quantidade_comprada?: number | null
          quantidade_consumida?: number | null
        }
        Update: {
          created_at?: string | null
          custo_total?: number | null
          family_id?: string | null
          id?: string
          mes?: string
          product_id?: string | null
          quantidade_comprada?: number | null
          quantidade_consumida?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_consumption_log_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_consumption_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_consumption_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_consumption_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock_status"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string | null
          data: string | null
          family_id: string | null
          id: string
          motivo: string | null
          origem: string | null
          preco_pago: number | null
          preco_unitario: number | null
          product_id: string
          quantidade: number
          shopping_item_id: string | null
          shopping_list_id: string | null
          tipo: string
          transaction_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          data?: string | null
          family_id?: string | null
          id?: string
          motivo?: string | null
          origem?: string | null
          preco_pago?: number | null
          preco_unitario?: number | null
          product_id: string
          quantidade: number
          shopping_item_id?: string | null
          shopping_list_id?: string | null
          tipo: string
          transaction_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          data?: string | null
          family_id?: string | null
          id?: string
          motivo?: string | null
          origem?: string | null
          preco_pago?: number | null
          preco_unitario?: number | null
          product_id?: string
          quantidade?: number
          shopping_item_id?: string | null
          shopping_list_id?: string | null
          tipo?: string
          transaction_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
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
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_shopping_item_id_fkey"
            columns: ["shopping_item_id"]
            isOneToOne: false
            referencedRelation: "shopping_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_shopping_list_id_fkey"
            columns: ["shopping_list_id"]
            isOneToOne: false
            referencedRelation: "shopping_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_rules: {
        Row: {
          account_id: string | null
          category_id: string | null
          created_at: string | null
          family_id: string | null
          id: string
          origem: string | null
          pattern: string
          tipo: string | null
          updated_at: string | null
          usos: number | null
        }
        Insert: {
          account_id?: string | null
          category_id?: string | null
          created_at?: string | null
          family_id?: string | null
          id?: string
          origem?: string | null
          pattern: string
          tipo?: string | null
          updated_at?: string | null
          usos?: number | null
        }
        Update: {
          account_id?: string | null
          category_id?: string | null
          created_at?: string | null
          family_id?: string | null
          id?: string
          origem?: string | null
          pattern?: string
          tipo?: string | null
          updated_at?: string | null
          usos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_rules_family_id_fkey"
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
          amount: number | null
          category: string | null
          category_id: string | null
          competencia: string | null
          conciliado: boolean | null
          conciliado_em: string | null
          created_at: string | null
          data: string
          date: string | null
          descricao: string
          descricao_normalizada: string | null
          description: string | null
          external_id: string | null
          family_id: string
          id: string
          is_essencial: boolean | null
          observacao: string | null
          recorrente_id: string | null
          scope: string | null
          source: string | null
          tipo: string
          tipo_especial: string | null
          type: string | null
          user_id: string | null
          valor: number
        }
        Insert: {
          account_id?: string | null
          amount?: number | null
          category?: string | null
          category_id?: string | null
          competencia?: string | null
          conciliado?: boolean | null
          conciliado_em?: string | null
          created_at?: string | null
          data: string
          date?: string | null
          descricao: string
          descricao_normalizada?: string | null
          description?: string | null
          external_id?: string | null
          family_id: string
          id?: string
          is_essencial?: boolean | null
          observacao?: string | null
          recorrente_id?: string | null
          scope?: string | null
          source?: string | null
          tipo: string
          tipo_especial?: string | null
          type?: string | null
          user_id?: string | null
          valor: number
        }
        Update: {
          account_id?: string | null
          amount?: number | null
          category?: string | null
          category_id?: string | null
          competencia?: string | null
          conciliado?: boolean | null
          conciliado_em?: string | null
          created_at?: string | null
          data?: string
          date?: string | null
          descricao?: string
          descricao_normalizada?: string | null
          description?: string | null
          external_id?: string | null
          family_id?: string
          id?: string
          is_essencial?: boolean | null
          observacao?: string | null
          recorrente_id?: string | null
          scope?: string | null
          source?: string | null
          tipo?: string
          tipo_especial?: string | null
          type?: string | null
          user_id?: string | null
          valor?: number
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
            foreignKeyName: "transactions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
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
          created_at: string | null
          custo: number | null
          data_realizado: string | null
          descricao: string | null
          family_id: string | null
          id: string
          km_realizado: number | null
          observacao: string | null
          oficina: string | null
          proxima_data: string | null
          proximo_km: number | null
          tipo_id: string | null
          user_id: string | null
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string | null
          custo?: number | null
          data_realizado?: string | null
          descricao?: string | null
          family_id?: string | null
          id?: string
          km_realizado?: number | null
          observacao?: string | null
          oficina?: string | null
          proxima_data?: string | null
          proximo_km?: number | null
          tipo_id?: string | null
          user_id?: string | null
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string | null
          custo?: number | null
          data_realizado?: string | null
          descricao?: string | null
          family_id?: string | null
          id?: string
          km_realizado?: number | null
          observacao?: string | null
          oficina?: string | null
          proxima_data?: string | null
          proximo_km?: number | null
          tipo_id?: string | null
          user_id?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_maintenance_log_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_maintenance_log_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "v_maintenance_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_maintenance_log_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "vehicle_maintenance_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_maintenance_log_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_flex_comparison"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vehicle_maintenance_log_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_vehicle_status"
            referencedColumns: ["id"]
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
          ativo: boolean | null
          created_at: string | null
          family_id: string | null
          id: string
          intervalo_km: number | null
          intervalo_meses: number | null
          is_global: boolean | null
          nome: string
          ultima_data: string | null
          ultimo_km: number | null
          vehicle_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          family_id?: string | null
          id?: string
          intervalo_km?: number | null
          intervalo_meses?: number | null
          is_global?: boolean | null
          nome: string
          ultima_data?: string | null
          ultimo_km?: number | null
          vehicle_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          family_id?: string | null
          id?: string
          intervalo_km?: number | null
          intervalo_meses?: number | null
          is_global?: boolean | null
          nome?: string
          ultima_data?: string | null
          ultimo_km?: number | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_maintenance_types_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_maintenance_types_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_flex_comparison"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vehicle_maintenance_types_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_vehicle_status"
            referencedColumns: ["id"]
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
          ano: number | null
          apelido: string
          ativo: boolean | null
          combustivel: string | null
          consumo_medio_km_l: number | null
          created_at: string | null
          family_id: string
          id: string
          marca: string | null
          modelo: string | null
          nome: string | null
          odometro_atual: number | null
          tanque_capacidade: number | null
          tipo: string | null
        }
        Insert: {
          ano?: number | null
          apelido: string
          ativo?: boolean | null
          combustivel?: string | null
          consumo_medio_km_l?: number | null
          created_at?: string | null
          family_id: string
          id?: string
          marca?: string | null
          modelo?: string | null
          nome?: string | null
          odometro_atual?: number | null
          tanque_capacidade?: number | null
          tipo?: string | null
        }
        Update: {
          ano?: number | null
          apelido?: string
          ativo?: boolean | null
          combustivel?: string | null
          consumo_medio_km_l?: number | null
          created_at?: string | null
          family_id?: string
          id?: string
          marca?: string | null
          modelo?: string | null
          nome?: string | null
          odometro_atual?: number | null
          tanque_capacidade?: number | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_reviews: {
        Row: {
          checklist: Json | null
          created_at: string | null
          family_id: string
          id: string
          semana_inicio: string | null
          user_id: string | null
        }
        Insert: {
          checklist?: Json | null
          created_at?: string | null
          family_id: string
          id?: string
          semana_inicio?: string | null
          user_id?: string | null
        }
        Update: {
          checklist?: Json | null
          created_at?: string | null
          family_id?: string
          id?: string
          semana_inicio?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_reviews_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_budget_status: {
        Row: {
          categoria_nome: string | null
          category_id: string | null
          family_id: string | null
          is_essencial: boolean | null
          mes: string | null
          pct_atingido: number | null
          status_cor: string | null
          valor_gasto: number | null
          valor_planejado: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      v_contas_pendentes_mes: {
        Row: {
          family_id: string | null
          faturas_cartao: number | null
          recorrentes: number | null
          total_pendentes: number | null
          total_valor: number | null
          valor_faturas_cartao: number | null
          valor_recorrentes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bills_reminders_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      v_flex_comparison: {
        Row: {
          apelido: string | null
          consumo_medio_etanol: number | null
          consumo_medio_gasolina: number | null
          data_etanol: string | null
          data_gasolina: string | null
          etanol_vale: boolean | null
          family_id: string | null
          posto_etanol: string | null
          posto_gasolina: string | null
          razao_etanol_gasolina: number | null
          ultimo_preco_etanol: number | null
          ultimo_preco_gasolina: number | null
          vehicle_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      v_fuel_consumption: {
        Row: {
          combustivel_usado: string | null
          consumo_real_km_l: number | null
          custo_por_km: number | null
          data: string | null
          family_id: string | null
          id: string | null
          km_rodados: number | null
          litros: number | null
          odometro: number | null
          posto: string | null
          preco_litro: number | null
          valor_pago: number | null
          vehicle_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fuel_fills_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_fills_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_flex_comparison"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "fuel_fills_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_vehicle_status"
            referencedColumns: ["id"]
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
      v_fuel_monthly_summary: {
        Row: {
          consumo_esperado: number | null
          consumo_real_medio: number | null
          custo_medio_por_km: number | null
          family_id: string | null
          mes: string | null
          preco_medio_litro: number | null
          qtd_abastecimentos: number | null
          total_gasto: number | null
          total_km_mes: number | null
          total_litros: number | null
          vehicle_id: string | null
          veiculo: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fuel_fills_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_fills_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_flex_comparison"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "fuel_fills_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_vehicle_status"
            referencedColumns: ["id"]
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
      v_gastos_categoria_mes: {
        Row: {
          categoria_nome: string | null
          category_id: string | null
          family_id: string | null
          is_essencial: boolean | null
          mes: string | null
          qtd_transacoes: number | null
          total_gasto: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      v_maintenance_status: {
        Row: {
          ativo: boolean | null
          id: string | null
          intervalo_km: number | null
          intervalo_meses: number | null
          km_faltando: number | null
          nome: string | null
          odometro_atual: number | null
          proxima_data: string | null
          proximo_km: number | null
          status_manut: string | null
          ultima_data: string | null
          ultimo_km: number | null
          vehicle_id: string | null
          veiculo_apelido: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_maintenance_types_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_flex_comparison"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vehicle_maintenance_types_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "v_vehicle_status"
            referencedColumns: ["id"]
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
      v_stock_consolidated: {
        Row: {
          categoria: string | null
          consumo_total_diario: number | null
          dias_restantes_total: number | null
          estoque_minimo: number | null
          estoque_total: number | null
          family_id: string | null
          maior_preco: number | null
          menor_preco: number | null
          num_marcas: number | null
          produto_base: string | null
          status: string | null
          unidade: string | null
          variacao_preco_pct: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
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
          unidade: string | null
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
          quantidade_atual?: never
          quantidade_minima?: never
          ultima_revisao?: string | null
          unidade?: string | null
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
          quantidade_atual?: never
          quantidade_minima?: never
          ultima_revisao?: string | null
          unidade?: string | null
          urgencia?: never
        }
        Relationships: [
          {
            foreignKeyName: "products_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      v_stock_status: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          consumo_diario_medio: number | null
          data_validade: string | null
          dias_para_vencer: number | null
          dias_restantes: number | null
          estoque_atual: number | null
          estoque_minimo: number | null
          family_id: string | null
          id: string | null
          localizacao: string | null
          nome: string | null
          parent_id: string | null
          preco_ultima_compra: number | null
          qtd_subprodutos: number | null
          quantidade_por_embalagem: number | null
          risco_ruptura: boolean | null
          status: string | null
          sugestao_compra: number | null
          unidade: string | null
          unidade_embalagem: string | null
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          consumo_diario_medio?: number | null
          data_validade?: string | null
          dias_para_vencer?: never
          dias_restantes?: never
          estoque_atual?: number | null
          estoque_minimo?: number | null
          family_id?: string | null
          id?: string | null
          localizacao?: string | null
          nome?: string | null
          parent_id?: string | null
          preco_ultima_compra?: never
          qtd_subprodutos?: never
          quantidade_por_embalagem?: number | null
          risco_ruptura?: never
          status?: never
          sugestao_compra?: never
          unidade?: string | null
          unidade_embalagem?: string | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          consumo_diario_medio?: number | null
          data_validade?: string | null
          dias_para_vencer?: never
          dias_restantes?: never
          estoque_atual?: number | null
          estoque_minimo?: number | null
          family_id?: string | null
          id?: string | null
          localizacao?: string | null
          nome?: string | null
          parent_id?: string | null
          preco_ultima_compra?: never
          qtd_subprodutos?: never
          quantidade_por_embalagem?: number | null
          risco_ruptura?: never
          status?: never
          sugestao_compra?: never
          unidade?: string | null
          unidade_embalagem?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v_stock_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v_stock_status"
            referencedColumns: ["id"]
          },
        ]
      }
      v_vehicle_status: {
        Row: {
          apelido: string | null
          combustivel: string | null
          consumo_medio_km_l: number | null
          data_ultimo_abastecimento: string | null
          family_id: string | null
          gasto_mes: number | null
          id: string | null
          km_estimados_restantes: number | null
          litros_estimados_restantes: number | null
          odometro_atual: number | null
          pct_tanque_estimado: number | null
          tanque_capacidade: number | null
          tipo: string | null
          ultimo_combustivel: string | null
          ultimo_litros: number | null
          ultimo_posto: string | null
          ultimo_preco_litro: number | null
          ultimo_tanque_cheio: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _filho: {
        Args: {
          cat: string
          estq?: number
          fid: string
          nome: string
          pid: string
          qtd_emb: number
          und_emb: string
        }
        Returns: string
      }
      _mae: {
        Args: {
          cat: string
          emin?: number
          fid: string
          nome: string
          und: string
        }
        Returns: string
      }
      accept_invite: { Args: { p_token: string }; Returns: Json }
      activate_crisis: {
        Args: { p_family_id: string; p_motivo?: string }
        Returns: string
      }
      adjust_account_balance: {
        Args: {
          p_account_id: string
          p_family_id: string
          p_observacao?: string
          p_saldo_real: number
          p_user_id: string
        }
        Returns: string
      }
      advance_crisis_stage: { Args: { p_crisis_id: string }; Returns: number }
      apply_transaction_rules: {
        Args: { p_family_id: string }
        Returns: number
      }
      categorizar_produto: {
        Args: { p_family_id: string; p_nome: string }
        Returns: {
          categoria_id: string
          categoria_nome: string
          confianca: number
          origem: string
        }[]
      }
      categorize_transaction:
        | {
            Args: { _description: string; _dummy?: boolean; _family_id: string }
            Returns: {
              category_id: string
              confianca: number
              nivel: number
              origem: string
            }[]
          }
        | {
            Args: { p_descricao: string; p_family_id: string }
            Returns: string
          }
      check_ai_credits: { Args: { p_family_id: string }; Returns: Json }
      check_bills_alerts: { Args: { p_family_id: string }; Returns: undefined }
      check_credit_card_bill_alerts: {
        Args: { p_family_id: string }
        Returns: undefined
      }
      check_crisis_activation: {
        Args: { p_family_id: string; p_mes: string }
        Returns: boolean
      }
      check_crisis_stage: { Args: { p_family_id: string }; Returns: number }
      check_crisis_trigger: {
        Args: { p_family_id: string; p_mes: string }
        Returns: Json
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
          account_id: string
          amount: number
          date: string
          description: string
          id: string
          similarity_score: number
        }[]
      }
      check_fuel_alerts: { Args: { p_family_id: string }; Returns: undefined }
      check_stock_alerts: { Args: { p_family_id: string }; Returns: undefined }
      check_transaction_alerts: {
        Args: { _transaction_id: string }
        Returns: undefined
      }
      copy_budget_from_previous_month: {
        Args: { p_family_id: string; p_mes_destino: string }
        Returns: number
      }
      count_ai_runs_today: { Args: { _family_id: string }; Returns: number }
      create_installment_plan: {
        Args: {
          p_account_id: string
          p_category_id: string
          p_data_compra?: string
          p_descricao: string
          p_family_id: string
          p_num_parcelas: number
          p_valor_total: number
        }
        Returns: string
      }
      finalizar_compra: {
        Args: {
          p_account_id: string
          p_category_id: string
          p_data?: string
          p_family_id: string
          p_list_id: string
          p_user_id: string
        }
        Returns: Json
      }
      generate_bills_reminders: {
        Args: { p_family_id: string }
        Returns: number
      }
      generate_recurring_transactions: {
        Args: { p_family_id: string }
        Returns: number
      }
      gerar_lembretes_recorrentes: {
        Args: { p_family_id: string; p_mes?: string }
        Returns: number
      }
      gerar_lista_reposicao: {
        Args: { p_family_id: string }
        Returns: {
          custo_estimado: number
          dias_restantes: number
          estoque_atual: number
          estoque_minimo: number
          nome: string
          product_id: string
          quantidade_sugerida: number
          unidade: string
          urgencia: string
        }[]
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
          responsavel: string
          status_cor: string
          valor_gasto: number
          valor_planejado: number
        }[]
      }
      get_comparativo_marcas: {
        Args: { p_family_id: string; p_produto_base: string }
        Returns: {
          custo_medio: number
          dias_restantes: number
          eh_mais_barata: boolean
          id: string
          marca: string
          nome: string
          preco_por_unidade: number
          quantidade_atual: number
          ultima_revisao: string
          unidade: string
        }[]
      }
      get_dashboard_domestico: { Args: { p_family_id: string }; Returns: Json }
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
          combustivel_usado: string
          consumo_kml: number
          data: string
          id: string
          km_rodado: number
          litros: number
          posto: string
          preco_litro: number
          tanque_cheio: boolean
          transaction_id: string
          valor_pago: number
        }[]
      }
      get_maintenance_status: {
        Args: { p_vehicle_id: string }
        Returns: {
          id: string
          intervalo_km: number
          intervalo_meses: number
          km_atual: number
          km_restante: number
          meses_restante: number
          nome: string
          status: string
          ultima_data: string
          ultimo_km: number
        }[]
      }
      get_manutencao_pendente: {
        Args: { p_family_id: string }
        Returns: {
          categoria: string
          custo_estimado: number
          data_prevista: string
          dias_atraso: number
          id: string
          prioridade: string
          titulo: string
        }[]
      }
      get_monthly_summary:
        | {
            Args: { p_family_id: string }
            Returns: {
              mes: string
              saldo: number
              total_despesas: number
              total_receitas: number
              total_transacoes: number
            }[]
          }
        | {
            Args: { p_family_id: string; p_months?: number }
            Returns: {
              despesa: number
              mes: string
              receita: number
              saldo: number
            }[]
          }
      get_previsao_estoque: {
        Args: { p_family_id: string }
        Returns: {
          categoria: string
          consumo_medio_diario: number
          custo_medio: number
          dias_restantes: number
          estoque_minimo: number
          nome: string
          previsao_reposicao: string
          product_id: string
          quantidade_atual: number
          status_estoque: string
          unidade: string
        }[]
      }
      get_previsao_mes: {
        Args: { p_family_id: string }
        Returns: {
          account_id: string
          account_nome: string
          category_id: string
          data_vencimento: string
          descricao: string
          id: string
          origem: string
          status: string
          tipo: string
          valor: number
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
      get_situacao_atual: { Args: { p_family_id: string }; Returns: Json }
      get_stock_review_summary: {
        Args: { p_family_id: string }
        Returns: {
          categoria: string
          consumo_diario: number
          dias_restantes: number
          estoque_atual: number
          estoque_minimo: number
          produto_id: string
          produto_nome: string
          status: string
          sugestao_compra: number
          unidade: string
        }[]
      }
      get_sugestoes_compras: {
        Args: { p_family_id: string }
        Returns: {
          custo_medio: number
          nome: string
          product_id: string
          quantidade_sugerida: number
          unidade: string
          urgencia: string
        }[]
      }
      get_transactions_by_month: {
        Args: { p_family_id: string; p_mes: string }
        Returns: {
          account_id: string
          account_nome: string
          amount: number
          category_icone: string
          category_id: string
          category_nome: string
          date: string
          description: string
          external_id: string
          id: string
          is_essencial: boolean
          recorrente_id: string
          source: string
          tipo_especial: string
          type: string
        }[]
      }
      get_user_family_id: { Args: { p_user_id: string }; Returns: string }
      insert_produto_mae: {
        Args: {
          p_categoria: string
          p_estoque_minimo?: number
          p_family_id: string
          p_nome: string
          p_unidade: string
        }
        Returns: string
      }
      insert_subproduto: {
        Args: {
          p_categoria: string
          p_estoque_atual?: number
          p_family_id: string
          p_nome: string
          p_parent_id: string
          p_qtd_embalagem: number
          p_unidade_embalagem: string
        }
        Returns: string
      }
      keep_alive: { Args: never; Returns: string }
      learn_categorization_rule: {
        Args: {
          p_category_id: string
          p_family_id: string
          p_origem?: string
          p_termo: string
        }
        Returns: undefined
      }
      normalize_description: { Args: { p_text: string }; Returns: string }
      normalize_text: { Args: { p_text: string }; Returns: string }
      pay_credit_card_bill: {
        Args: {
          p_account_pagamento_id: string
          p_bill_id: string
          p_valor?: number
        }
        Returns: string
      }
      recalc_account_balance: {
        Args: { p_account_id: string }
        Returns: undefined
      }
      recalc_consumo_medio: {
        Args: { p_product_id: string }
        Returns: undefined
      }
      recalc_financial_state: {
        Args: { p_family_id: string; p_mes: string }
        Returns: undefined
      }
      recalc_financial_state_safe: {
        Args: { p_family_id: string; p_mes: string }
        Returns: undefined
      }
      recalcular_consumo_estoque: {
        Args: { p_product_id: string }
        Returns: undefined
      }
      register_stock_entry: {
        Args: {
          p_family_id: string
          p_local_compra?: string
          p_preco_pago?: number
          p_product_id: string
          p_quantidade: number
          p_transaction_id?: string
        }
        Returns: undefined
      }
      registrar_abastecimento: {
        Args: {
          p_account_id: string
          p_category_id: string
          p_combustivel_usado: string
          p_data: string
          p_family_id: string
          p_hodometro: number
          p_litros: number
          p_posto?: string
          p_preco_litro: number
          p_tanque_cheio?: boolean
          p_user_id: string
          p_valor_pago: number
          p_vehicle_id: string
        }
        Returns: Json
      }
      reset_family_data: {
        Args: { p_family_id: string; p_keep_config?: boolean }
        Returns: Json
      }
      resolve_crisis: { Args: { p_crisis_id: string }; Returns: undefined }
      save_transaction_rule: {
        Args: {
          p_account_id: string
          p_category_id: string
          p_description: string
          p_family_id: string
          p_origem?: string
          p_tipo: string
        }
        Returns: undefined
      }
      seed_default_categorization_keywords: {
        Args: { p_family_id: string }
        Returns: undefined
      }
      seed_default_products: {
        Args: { p_family_id: string }
        Returns: undefined
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
