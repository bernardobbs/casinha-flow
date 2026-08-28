import { useEffect, useState } from "react";
import { PluggyConnect } from "react-pluggy-connect";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Landmark, RefreshCw, Link2 } from "lucide-react";
import { toast } from "sonner";

interface PluggyItemRow {
  item_id: string;
  connector_name: string | null;
  status: string | null;
  last_synced_at: string | null;
  last_error: string | null;
}

interface FoundAccount {
  pluggy_account_id: string;
  nome: string;
  tipo: string;
  saldo: number;
  conector: string | null;
  ja_vinculada: boolean;
  vinculada_a: string | null;
}

interface AccountOption {
  id: string;
  nome: string;
}

interface Props {
  familyId: string;
}

async function callPluggy(action: string, extra: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Sessão inválida");
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/pluggy-sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ action, ...extra }),
  });
  const data = await resp.json();
  if (!resp.ok || data.error) throw new Error(data.error ?? `Erro ${resp.status}`);
  return data;
}

export function OpenFinancePanel({ familyId }: Props) {
  const [items, setItems] = useState<PluggyItemRow[]>([]);
  const [foundAccounts, setFoundAccounts] = useState<FoundAccount[]>([]);
  const [accountOptions, setAccountOptions] = useState<AccountOption[]>([]);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [connectToken, setConnectToken] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: itemRows }, { data: accs }] = await Promise.all([
      supabase.from("pluggy_items" as any).select("item_id, connector_name, status, last_synced_at, last_error").eq("family_id", familyId),
      supabase.from("accounts").select("id, nome").eq("family_id", familyId).eq("ativo", true).order("nome"),
    ]);
    setItems((itemRows as any) ?? []);
    setAccountOptions((accs as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (familyId) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId]);

  const handleDiscover = async () => {
    setBusy("discover");
    try {
      const data = await callPluggy("discover_items");
      setItems(data.items ?? []);
      toast.success(`${data.encontrados ?? 0} banco(s) encontrados no Meu Pluggy`);
      await handleListAccounts();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const handleListAccounts = async () => {
    setBusy("list_accounts");
    try {
      const data = await callPluggy("list_accounts");
      setFoundAccounts(data.contas ?? []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const handleLink = async (acc: FoundAccount) => {
    const chosen = selection[acc.pluggy_account_id];
    setBusy(acc.pluggy_account_id);
    try {
      if (chosen === "__nova__" || !chosen) {
        await callPluggy("link_account", { pluggy_account_id: acc.pluggy_account_id, criar_nova: true, nome: acc.nome, tipo: acc.tipo });
      } else {
        await callPluggy("link_account", { pluggy_account_id: acc.pluggy_account_id, account_id: chosen, criar_nova: false });
      }
      toast.success(`${acc.nome} vinculada`);
      await handleListAccounts();
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const handleSync = async () => {
    setBusy("sync");
    try {
      const data = await callPluggy("sync");
      const total = (data.resultados ?? []).reduce((acc: number, r: any) => acc + (r.imported ?? 0), 0);
      toast.success(`Sincronização concluída — ${total} transação(ões) nova(s)`);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const handleConnectSuccess = async (itemData: any) => {
    setConnectToken(null);
    try {
      await callPluggy("register_item", {
        item_id: itemData?.item?.id,
        connector_name: itemData?.item?.connector?.name,
      });
      toast.success("Banco conectado! Buscando contas...");
      await load();
      await handleListAccounts();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleOpenWidget = async () => {
    setBusy("connect_token");
    try {
      const data = await callPluggy("connect_token");
      setConnectToken(data.accessToken);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/60 shadow-[var(--shadow-soft)]">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><Landmark className="h-5 w-5" /> Open Finance (Pluggy)</CardTitle>
              <CardDescription>
                Sincronize extratos direto dos seus bancos, conectados via Meu Pluggy.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDiscover} disabled={busy !== null} className="gap-2">
                {busy === "discover" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Buscar bancos conectados
              </Button>
              <Button size="sm" onClick={handleOpenWidget} disabled={busy !== null} className="gap-2">
                {busy === "connect_token" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                Conectar novo banco
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum banco encontrado ainda. Conecte pelo <a href="https://meupluggy.com.br" target="_blank" rel="noreferrer" className="underline">Meu Pluggy</a> e clique em "Buscar bancos conectados".
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((it) => (
                <li key={it.item_id} className="flex items-center justify-between rounded-md border border-border/60 p-3 text-sm">
                  <div>
                    <span className="font-medium">{it.connector_name ?? it.item_id}</span>
                    {it.last_synced_at && (
                      <span className="text-muted-foreground ml-2">
                        última sync: {new Date(it.last_synced_at).toLocaleString("pt-BR")}
                      </span>
                    )}
                  </div>
                  <Badge variant={it.status === "ERROR" ? "destructive" : "secondary"}>
                    {it.status === "ERROR" ? `Erro: ${it.last_error ?? "?"}` : (it.status ?? "conectado")}
                  </Badge>
                </li>
              ))}
            </ul>
          )}

          {items.length > 0 && (
            <div className="flex justify-end">
              <Button size="sm" onClick={handleSync} disabled={busy !== null} className="gap-2">
                {busy === "sync" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Sincronizar transações agora
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {foundAccounts.length > 0 && (
        <Card className="border-border/60 shadow-[var(--shadow-soft)]">
          <CardHeader>
            <CardTitle>Vincular contas</CardTitle>
            <CardDescription>Escolha a qual conta do Casinha Hub cada conta do banco corresponde.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {foundAccounts.map((acc) => (
              <div key={acc.pluggy_account_id} className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 p-3">
                <div className="flex-1 min-w-[160px]">
                  <div className="font-medium text-sm">{acc.nome}</div>
                  <div className="text-xs text-muted-foreground">{acc.conector} · {acc.tipo}</div>
                </div>
                {acc.ja_vinculada ? (
                  <Badge variant="secondary">Vinculada a {acc.vinculada_a}</Badge>
                ) : (
                  <>
                    <Select
                      value={selection[acc.pluggy_account_id] ?? "__nova__"}
                      onValueChange={(v) => setSelection((s) => ({ ...s, [acc.pluggy_account_id]: v }))}
                    >
                      <SelectTrigger className="h-8 w-[200px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__nova__">➕ Criar nova conta</SelectItem>
                        {accountOptions.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={() => handleLink(acc)} disabled={busy !== null}>
                      {busy === acc.pluggy_account_id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Vincular"}
                    </Button>
                  </>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {connectToken && (
        <PluggyConnect
          connectToken={connectToken}
          includeSandbox={false}
          onSuccess={handleConnectSuccess}
          onError={(err: any) => { toast.error("Falha ao conectar banco"); console.error(err); setConnectToken(null); }}
          onClose={() => setConnectToken(null)}
        />
      )}
    </div>
  );
}
