import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://mmqoyozyeidxbgbxqnda.supabase.co",
  "sb_publishable_UvQKkzE7smFYlWpeOxnv6A_MEYtwUYX"
);

export default async function handler(req: Request) {
  try {
    const { count } = await supabase
      .from("families")
      .select("id", { count: "exact", head: true });
    return new Response(
      JSON.stringify({ ok: true, timestamp: new Date().toISOString(), count }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
