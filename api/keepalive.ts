export default async function handler(req: Request) {
  try {
    // Usar service role para garantir que conta como atividade
    const res = await fetch(
      "https://mmqoyozyeidxbgbxqnda.supabase.co/rest/v1/families?select=id&limit=1",
      {
        headers: {
          "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY ?? "sb_publishable_UvQKkzE7smFYlWpeOxnv6A_MEYtwUYX",
          "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? "sb_publishable_UvQKkzE7smFYlWpeOxnv6A_MEYtwUYX"}`,
        },
      }
    );
    const ts = new Date().toISOString();
    return new Response(
      JSON.stringify({ ok: res.ok, status: res.status, timestamp: ts }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
