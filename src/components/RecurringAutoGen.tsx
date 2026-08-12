import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const FLAG = "casinha:recurring-generated";

export function RecurringAutoGen() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(FLAG)) return;

    (async () => {
      const { data: profile } = await supabase
        .from("profiles").select("family_id").eq("id", user.id).maybeSingle();
      const fid = profile?.family_id;
      if (!fid) return;
      try {
        // generate_recurring_transactions foi removido daqui de propósito:
        // ele criava uma transação já "paga" assim que a data do mês
        // chegava, sem nenhuma confirmação — e quando a pessoa confirmava o
        // pagamento de verdade em /contas-a-pagar, uma segunda transação
        // era criada pro mesmo item (contas-a-pagar.tsx's `pagar()`).
        // Resultado: toda conta recorrente confirmada acabava contada duas
        // vezes. Recorrente agora só vira transação real através do fluxo
        // de confirmação de pagamento — generate_bills_reminders cuida só
        // do lembrete pendente, que é o que deve acontecer automaticamente.
        await supabase.rpc("generate_bills_reminders" as any, { p_family_id: fid });
        // Copia o orçamento do mês anterior pro mês atual, categoria por
        // categoria só onde ainda não existe (idempotente — não sobrescreve
        // valor já definido). Antes disso só acontecia manualmente pelo
        // botão "Copiar mês anterior" em /orcamentos.
        const mesAtual = new Date().toISOString().slice(0, 7);
        await supabase.rpc("copy_budget_from_previous_month" as any, {
          p_family_id: fid,
          p_mes_destino: mesAtual,
        });
        sessionStorage.setItem(FLAG, "1");
      } catch {
        /* silencioso */
      }
    })();
  }, [user]);
  return null;
}
