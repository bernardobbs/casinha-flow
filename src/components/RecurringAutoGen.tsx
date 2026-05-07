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
        await supabase.rpc("generate_recurring_transactions", { p_family_id: fid });
        await supabase.rpc("generate_bills_reminders" as any, { p_family_id: fid });
        sessionStorage.setItem(FLAG, "1");
      } catch {
        /* silencioso */
      }
    })();
  }, [user]);
  return null;
}
