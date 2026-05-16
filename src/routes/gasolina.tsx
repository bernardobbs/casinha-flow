import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFamily } from "@/hooks/use-family";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Fuel, Plus, Wrench, Loader2, Pencil, Trash2 } from "lucide-react";
import { SkeletonGasolina } from "@/components/skeletons";

export const Route = createFileRoute("/gasolina")({
  head: () => ({
    meta: [
      { title: "Combustível — Casinha Hub" },
      { name: "description", content: "Controle de combustível, abastecimentos e manutenção dos veículos da família." },
    ],
  }),
  component: GasolinaPage,
});

type VehicleStatus = {
  id: string;
  vehicle_id?: string; // alias de id
  family_id: string;
  apelido: string;
  nome?: string; // alias para compatibilidade
  tipo: string;
  combustivel: string;
  tanque_capacidade: number;
  consumo_medio_km_l: number;
  odometro_atual: number;
  data_ultimo_abastecimento: string | null;
  ultimo_preco_litro: number | null;
  ultimo_posto: string | null;
  ultimo_combustivel: string | null;
  litros_estimados_restantes: number | null;
  km_estimados_restantes: number | null;
  pct_tanque_estimado: number | null;
  gasto_mes: number;
};

const TIPO_ICON: Record<string, string> = { carro: "🚗", moto: "🏍️", caminhao: "🚛", outro: "🚙" };
const FUEL_LABEL: Record<string, string> = {
  gasolina: "⛽ Gasolina", gasolina_aditivada: "⛽ Aditivada",
  etanol: "🌿 Etanol", diesel: "🚛 Diesel", gnv: "💨 GNV",
};
const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function GasolinaPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { familyId, loading: familyLoading } = useFamily();
  const [vehicles, setVehicles] = useState<VehicleStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const [openFill, setOpenFill] = useState(false);
  const [editingFill, setEditingFill] = useState<any>(null);
  const [deletingFill, setDeletingFill] = useState<any>(null);

  const handleDeleteFill = async () => {
    if (!deletingFill) return;
    const { error } = await supabase.from("fuel_fills" as any).delete().eq("id", deletingFill.id);
    if (error) { toast.error(error.message); return; }
    if (deletingFill.transaction_id) {
      await supabase.from("transactions").delete().eq("id", deletingFill.transaction_id);
    }
    toast.success("Abastecimento apagado");
    setDeletingFill(null);
    reload();
  };
  const [openVehicle, setOpenVehicle] = useState<{ open: boolean; editing?: VehicleStatus | null }>({ open: false });
  const [openMaint, setOpenMaint] = useState<{ open: boolean; vehicleId?: string }>({ open: false });

  const deactivateVehicle = async (id: string, nome: string) => {
    if (!confirm(`Desativar veículo "${nome}"? Ele ficará oculto mas o histórico será preservado.`)) return;
    const { error } = await supabase.from("vehicles" as any).update({ ativo: false }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Veículo desativado");
    reload();
  };

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  const reload = async () => {
    if (!user || !familyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("v_vehicle_status" as any)
      .select("*")
      .eq("family_id", familyId)
      .order("apelido");
    if (error) toast.error("Erro ao carregar veículos");
    setVehicles((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [user, familyId]);

  if (authLoading || familyLoading || loading) return <SkeletonGasolina />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Link to="/dashboard"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Painel</Button></Link>
            <h1 className="text-lg sm:text-xl font-semibold flex items-center gap-2 truncate"><Fuel className="h-5 w-5" /> Combustível</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpenVehicle({ open: true, editing: null })}>+ Veículo</Button>
            <Button size="sm" onClick={() => setOpenFill(true)} disabled={vehicles.length === 0}>
              <Plus className="h-4 w-4 mr-1" /> Abastecer
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {vehicles.length === 0 ? (
          <Card><CardContent className="py-10 text-center space-y-3">
            <p className="text-muted-foreground">Nenhum veículo cadastrado ainda.</p>
            <Button onClick={() => setOpenVehicle({ open: true, editing: null })}>Cadastrar primeiro veículo</Button>
          </CardContent></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {vehicles.map((v) => (
              <VehicleCard
                key={v.id}
                v={v}
                onMaint={() => setOpenMaint({ open: true, vehicleId: v.id })}
                onEdit={() => setOpenVehicle({ open: true, editing: v })}
                onDeactivate={() => deactivateVehicle(v.id, v.apelido)}
              />
            ))}
          </div>
        )}

        <FlexCalculator />

        {vehicles.length > 0 && (
          <Tabs defaultValue={vehicles[0].id ?? ""} className="w-full">
            <TabsList className="flex flex-wrap h-auto">
              {vehicles.map(v => <TabsTrigger key={v.id} value={v.id}>{TIPO_ICON[v.tipo]} {v.apelido}</TabsTrigger>)}
            </TabsList>
            {vehicles.map(v => (
              <TabsContent key={v.id} value={v.id} className="space-y-4">
                <FuelHistory vehicleId={v.id} onEditFill={(row) => { setEditingFill(row); setOpenFill(true); }} onDeleteFill={setDeletingFill} />
                <MaintenanceList vehicleId={v.id} onRegister={() => setOpenMaint({ open: true, vehicleId: v.id })} />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </main>

      <FillDialog open={openFill} onOpenChange={(o) => { setOpenFill(o); if (!o) setEditingFill(null); }} familyId={familyId} userId={user?.id ?? ""} vehicles={vehicles} editing={editingFill} onSaved={reload} />

      <AlertDialog open={!!deletingFill} onOpenChange={(o) => !o && setDeletingFill(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar abastecimento?</AlertDialogTitle>
            <AlertDialogDescription>
              Abastecimento de {deletingFill && fmtBRL(deletingFill.valor_pago)} em {deletingFill && new Date(deletingFill.data + "T12:00").toLocaleDateString("pt-BR")}.
              {deletingFill?.transaction_id && " A transação financeira vinculada também será apagada."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFill} className="bg-destructive hover:bg-destructive/90">Apagar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <VehicleDialog
        open={openVehicle.open}
        onOpenChange={(o: boolean) => setOpenVehicle({ open: o, editing: o ? openVehicle.editing : null })}
        familyId={familyId}
        userId={user?.id ?? ""}
        editing={openVehicle.editing}
        onSaved={reload}
      />
      <MaintDialog
        open={openMaint.open}
        onOpenChange={(o: boolean) => setOpenMaint({ open: o, vehicleId: o ? openMaint.vehicleId : undefined })}
        familyId={familyId}
        userId={user?.id ?? ""}
        vehicleId={openMaint.vehicleId ?? null}
        onSaved={reload}
      />
    </div>
  );
}

function VehicleCard({ v, onMaint, onEdit, onDeactivate }: { v: VehicleStatus; onMaint: () => void; onEdit: () => void; onDeactivate: () => void }) {
  const pct = v.pct_tanque_estimado ?? 0;
  const tankColor = pct > 50 ? "bg-green-500" : pct > 20 ? "bg-yellow-500" : "bg-red-500";
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 min-w-0 truncate">{TIPO_ICON[v.tipo]} {v.apelido}</span>
          <div className="flex items-center gap-1 shrink-0">
            {false && <Badge variant="outline">Flex</Badge>}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} title="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onDeactivate} title="Desativar"><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Tanque estimado</span>
            <span className="font-medium">{v.pct_tanque_estimado !== null ? `${v.pct_tanque_estimado}%` : "—"}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div className={`h-full ${tankColor} transition-all`} style={{ width: `${pct}%` }} />
          </div>
          {v.km_estimados_restantes !== null && <p className="text-xs text-muted-foreground mt-1">~{v.km_estimados_restantes} km restantes</p>}
        </div>
        <div className="text-sm space-y-1 border-t pt-3">
          <div className="flex justify-between"><span className="text-muted-foreground">Hodômetro</span><span>{v.odometro_atual.toLocaleString("pt-BR")} km</span></div>
          {v.data_ultimo_abastecimento ? (
            <>
              <div className="flex justify-between"><span className="text-muted-foreground">Último abast.</span>
                <span>{new Date(v.data_ultimo_abastecimento + "T12:00").toLocaleDateString("pt-BR")} • {FUEL_LABEL[v.ultimo_combustivel ?? ""] ?? ""}</span>
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">Preço/L</span><span>{fmtBRL(v.ultimo_preco_litro ?? 0)}</span></div>
            </>
          ) : <p className="text-muted-foreground text-xs">Sem abastecimentos registrados</p>}
          <div className="flex justify-between font-medium"><span>Gasto do mês</span><span>{fmtBRL(Number(v.gasto_mes ?? 0))}</span></div>
        </div>
        <Button variant="outline" size="sm" onClick={onMaint} className="w-full">
          <Wrench className="h-4 w-4 mr-1" /> Manutenção
        </Button>
      </CardContent>
    </Card>
  );
}

function FlexCalculator() {
  const [g, setG] = useState("");
  const [e, setE] = useState("");
  const razao = useMemo(() => {
    const gv = parseFloat(g.replace(",", "."));
    const ev = parseFloat(e.replace(",", "."));
    if (!gv || !ev) return null;
    return ev / gv;
  }, [g, e]);
  return (
    <Card className="border-border/60">
      <CardHeader><CardTitle className="text-base">🧮 Calculadora Flex</CardTitle></CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3 items-end">
        <div><Label>Gasolina (R$/L)</Label><Input value={g} onChange={(e) => setG(e.target.value)} placeholder="6,29" inputMode="decimal" /></div>
        <div><Label>Etanol (R$/L)</Label><Input value={e} onChange={(ev) => setE(ev.target.value)} placeholder="4,19" inputMode="decimal" /></div>
        <div className="text-center sm:text-left">
          {razao === null ? <p className="text-muted-foreground text-sm">Preencha os preços</p> : (
            <div>
              <p className="text-xs text-muted-foreground">Razão E/G: {razao.toFixed(3)}</p>
              {razao <= 0.7
                ? <p className="text-lg font-semibold text-green-600">🌿 Use Etanol ✅</p>
                : <p className="text-lg font-semibold text-orange-600">⛽ Use Gasolina ❌</p>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FuelHistory({ vehicleId, onEditFill, onDeleteFill }: { vehicleId: string; onEditFill?: (row: any) => void; onDeleteFill?: (row: any) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_fuel_history" as any, { p_vehicle_id: vehicleId });
      if (error) toast.error("Erro ao carregar histórico");
      setRows((data as any) ?? []);
      setLoading(false);
    })();
  }, [vehicleId]);
  return (
    <Card className="border-border/60">
      <CardHeader><CardTitle className="text-base">Histórico de abastecimentos</CardTitle></CardHeader>
      <CardContent>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem abastecimentos.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-muted-foreground border-b">
                <th className="text-left py-2">Data</th><th className="text-left">Combustível</th>
                <th className="text-right">Litros</th><th className="text-right">R$/L</th>
                <th className="text-right">Total</th><th className="text-right">km/L</th>
                {(onEditFill || onDeleteFill) && <th />}
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2">{new Date(r.data + "T12:00").toLocaleDateString("pt-BR")}</td>
                    <td>{FUEL_LABEL[r.combustivel_usado] ?? r.combustivel_usado ?? "—"}</td>
                    <td className="text-right">{Number(r.litros).toFixed(2)}</td>
                    <td className="text-right">{fmtBRL(Number(r.preco_litro))}</td>
                    <td className="text-right">{fmtBRL(Number(r.valor_pago))}</td>
                    <td className="text-right">{r.kml ? Number(r.kml).toFixed(1) : "—"}</td>
                    {(onEditFill || onDeleteFill) && (
                      <td className="text-right flex gap-1 justify-end">
                        {onEditFill && <Button variant="ghost" size="sm" onClick={() => onEditFill(r)}><Pencil className="h-3.5 w-3.5" /></Button>}
                        {onDeleteFill && <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onDeleteFill(r)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MaintenanceList({ vehicleId, onRegister }: { vehicleId: string; onRegister: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_maintenance_status" as any, { p_vehicle_id: vehicleId });
      if (error) toast.error("Erro ao carregar manutenções");
      setRows((data as any) ?? []);
      setLoading(false);
    })();
  }, [vehicleId]);
  const statusBadge = (s: string) => {
    if (s === "vencido") return <Badge variant="destructive">🔴 Vencido</Badge>;
    if (s === "em_breve") return <Badge variant="secondary">⚠️ Em breve</Badge>;
    if (s === "pendente") return <Badge variant="outline">Sem registro</Badge>;
    return <Badge variant="secondary">✅ OK</Badge>;
  };
  return (
    <Card className="border-border/60">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Manutenções</CardTitle>
        <Button size="sm" variant="outline" onClick={onRegister}><Wrench className="h-4 w-4 mr-1" />Registrar</Button>
      </CardHeader>
      <CardContent>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum tipo de manutenção configurado.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.type_id} className="flex items-center justify-between border-b last:border-0 pb-2">
                <div>
                  <p className="font-medium">{r.icone} {r.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.intervalo_km ? `${r.intervalo_km} km` : ""}
                    {r.intervalo_km && r.intervalo_meses ? " / " : ""}
                    {r.intervalo_meses ? `${r.intervalo_meses} meses` : ""}
                    {" — "}{r.motivo}
                  </p>
                </div>
                {statusBadge(r.status)}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// -------- Dialogs --------
function FillDialog({ open, onOpenChange, familyId, userId, vehicles, editing, onSaved }: any) {
  const [vehicleId, setVehicleId] = useState<string>("");
  const [combustivel, setCombustivel] = useState<string>("gasolina");
  const [valor, setValor] = useState("");
  const [preco, setPreco] = useState("");
  const [hodometro, setHodometro] = useState("");
  const [posto, setPosto] = useState("");
  const [tanqueCheio, setTanqueCheio] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<{ id: string; nome: string; tipo: string }[]>([]);
  const [accountId, setAccountId] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (open && editing) {
      setVehicleId(editing.vehicle_id ?? editing.id ?? "");
      setCombustivel(editing.combustivel_usado ?? "gasolina");
      setValor(String(editing.valor_pago ?? ""));
      setPreco(String(editing.preco_litro ?? ""));
      setHodometro(String(editing.hodometro ?? ""));
      setPosto(editing.posto ?? "");
      setTanqueCheio(editing.tanque_cheio ?? true);
      setData(editing.data ?? new Date().toISOString().slice(0, 10));
    } else if (open && vehicles.length && !vehicleId) {
      setVehicleId(vehicles[0].id ?? "");
      setHodometro(String(vehicles[0].odometro_atual ?? ""));
      setCombustivel(vehicles[0].ultimo_combustivel ?? "gasolina");
    }
    if (open && familyId) {
      supabase.from("accounts").select("id, nome, tipo")
        .eq("family_id", familyId).eq("ativo", true).order("nome")
        .then(({ data: accsData }) => {
          const accs = (accsData ?? []) as { id: string; nome: string; tipo: string }[];
          setAccounts(accs);
          if (!accountId && accs.length) setAccountId(accs[0].id);
        });
    }
    if (!open) {
      setValor(""); setPreco(""); setPosto(""); setVehicleId(""); setAccountId("");
      setData(new Date().toISOString().slice(0, 10));
    }
  }, [open]);

  const litros = useMemo(() => {
    const v = parseFloat(valor.replace(",", ".")); const p = parseFloat(preco.replace(",", "."));
    if (!v || !p) return 0;
    return v / p;
  }, [valor, preco]);

  const submit = async () => {
    if (!familyId || !userId || !vehicleId) return;
    const v = parseFloat(valor.replace(",", ".")); const p = parseFloat(preco.replace(",", "."));
    const h = parseFloat(hodometro.replace(",", "."));
    if (!v || !p || !h) { toast.error("Preencha valor, preço/L e hodômetro"); return; }
    setSaving(true);
    try {
      const [{ data: cat }] = await Promise.all([
        supabase.from("categories").select("id")
          .eq("family_id", familyId).ilike("nome", "%gasolina%").maybeSingle(),
      ]);

      if (editing?.id) {
        const { error } = await supabase.from("fuel_fills" as any).update({
          data, combustivel_usado: combustivel, valor_pago: v, preco_litro: p,
          litros: Number(litros.toFixed(3)), hodometro: h,
          posto: posto || null, tanque_cheio: tanqueCheio,
        }).eq("id", editing.id);
        if (error) throw error;
        if (editing.transaction_id)
          await supabase.from("transactions").update({ amount: v, date: data }).eq("id", editing.transaction_id);
        toast.success("✅ Abastecimento atualizado");
      } else {
        const { data: result, error } = await supabase.rpc("registrar_abastecimento" as any, {
          p_family_id: familyId, p_user_id: userId, p_vehicle_id: vehicleId,
          p_account_id: accountId || null, p_category_id: cat?.id ?? null,
          p_data: data, p_valor_pago: v, p_preco_litro: p,
          p_litros: Number(litros.toFixed(3)), p_hodometro: h,
          p_combustivel_usado: combustivel, p_posto: posto || null, p_tanque_cheio: tanqueCheio,
        });
        if (error) throw error;
        toast.success(`✅ Abastecimento registrado — ${(result as any).valor?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`);
      }
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>⛽ {editing?.id ? "Editar" : "Novo"} abastecimento</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Veículo</Label>
            <Select value={vehicleId} onValueChange={(id) => {
              setVehicleId(id);
              const v = vehicles.find((vv: any) => vv.id === id);
              if (v) setHodometro(String(v.odometro_atual ?? ""));
            }}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{TIPO_ICON[v.tipo]} {v.apelido}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Combustível</Label>
            <Select value={combustivel} onValueChange={setCombustivel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(FUEL_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Valor pago (R$)</Label><Input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="150,00" /></div>
            <div><Label>Preço/L</Label><Input value={preco} onChange={(e) => setPreco(e.target.value)} inputMode="decimal" placeholder="6,29" /></div>
          </div>
          <p className="text-sm text-muted-foreground">✨ Litros: <span className="font-semibold text-foreground">{litros.toFixed(2)} L</span></p>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Hodômetro (km)</Label><Input value={hodometro} onChange={(e) => setHodometro(e.target.value)} inputMode="decimal" /></div>
            <div><Label>Data</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
            <div><Label>Posto (opcional)</Label><Input value={posto} onChange={(e) => setPosto(e.target.value)} /></div>
            <div>
              <Label>Pagamento <span className="text-destructive">*</span></Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                <SelectContent>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nome} {a.tipo === "cartao" ? "💳" : "🏦"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between border rounded-md p-2">
            <Label>Tanque cheio?</Label><Switch checked={tanqueCheio} onCheckedChange={setTanqueCheio} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VehicleDialog({ open, onOpenChange, familyId, userId, editing, onSaved }: any) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"carro" | "moto" | "caminhao" | "outro">("carro");
  const [combustivel, setCombustivel] = useState<string>("gasolina");
  const [flex, setFlex] = useState(true); // flex é controlado pelo combustivel selecionado
  const [tanque, setTanque] = useState("50");
  const [consumo, setConsumo] = useState("10");
  const [odometro, setOdometro] = useState("0");
  const [saving, setSaving] = useState(false);
  const isEdit = !!editing;

  useEffect(() => {
    if (!open) { setNome(""); setTanque("50"); setConsumo("10"); setOdometro("0"); setFlex(true); setTipo("carro"); setCombustivel("gasolina"); return; }
    if (editing) {
      setNome(editing.apelido ?? "");
      setTipo(editing.tipo ?? "carro");
      setCombustivel(editing.ultimo_abastec_combustivel ?? "gasolina");
      setFlex(!!editing.flex);
      setTanque(String(editing.capacidade_tanque ?? "50"));
      setConsumo(String(editing.consumo_medio_kml ?? "10"));
      setOdometro(String(editing.odometro_atual ?? "0"));
    }
  }, [open, editing]);

  const submit = async () => {
    if (!familyId || !userId || !nome) { toast.error("Informe o nome"); return; }
    setSaving(true);
    const payload = {
      apelido: nome, tipo,
      combustivel: combustivel,
      tanque_capacidade: parseFloat(tanque.replace(",", ".")) || 50,
      consumo_medio_km_l: parseFloat(consumo.replace(",", ".")) || 10,
      odometro_atual: parseFloat(odometro.replace(",", ".")) || 0,
    };
    const { error } = isEdit
      ? await supabase.from("vehicles" as any).update(payload).eq("id", editing.id)
      : await supabase.from("vehicles" as any).insert({ ...payload, family_id: familyId });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isEdit ? "✅ Veículo atualizado" : "✅ Veículo cadastrado");
    onOpenChange(false); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEdit ? "✏️ Editar veículo" : "+ Novo veículo"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Civic, CG 160..." /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="carro">🚗 Carro</SelectItem>
                  <SelectItem value="moto">🏍️ Moto</SelectItem>
                  <SelectItem value="caminhao">🚛 Caminhão</SelectItem>
                  <SelectItem value="outro">🚙 Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Combustível principal</Label>
              <Select value={combustivel} onValueChange={setCombustivel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(FUEL_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Tanque (L)</Label><Input value={tanque} onChange={(e) => setTanque(e.target.value)} inputMode="decimal" /></div>
            <div><Label>Consumo (km/L)</Label><Input value={consumo} onChange={(e) => setConsumo(e.target.value)} inputMode="decimal" /></div>
            <div><Label>Hodômetro</Label><Input value={odometro} onChange={(e) => setOdometro(e.target.value)} inputMode="decimal" /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MaintDialog({ open, onOpenChange, familyId, userId, vehicleId, onSaved }: any) {
  const [types, setTypes] = useState<any[]>([]);
  const [typeId, setTypeId] = useState<string>("");
  const [hodometro, setHodometro] = useState("");
  const [valor, setValor] = useState("");
  const [local, setLocal] = useState("");
  const [tipoOleo, setTipoOleo] = useState("");
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));

  const [proximoKm, setProximoKm] = useState("");
  const [proximaData, setProximaData] = useState("");

  useEffect(() => {
    if (!open || !vehicleId) return;
    (async () => {
      const { data: t } = await supabase.from("vehicle_maintenance_types" as any)
        .select("id, nome, intervalo_km, intervalo_meses").eq("vehicle_id", vehicleId).eq("ativo", true).order("nome");
      setTypes((t as any) ?? []);
      if (t && (t as any).length) setTypeId((t as any)[0].id);
      const { data: vRow } = await supabase.from("vehicles" as any).select("odometro_atual").eq("id", vehicleId).maybeSingle();
      if (vRow) setHodometro(String((vRow as any).odometro_atual ?? ""));
    })();
    if (!open) { setValor(""); setLocal(""); setTipoOleo(""); setProximoKm(""); setProximaData(""); }
  }, [open, vehicleId]);

  const selectedType = types.find((t: any) => t.id === typeId) as any;
  const isOleo = (selectedType?.nome ?? "").toLowerCase().includes("óleo") || (selectedType?.nome ?? "").toLowerCase().includes("oleo");

  // Auto-calcular próxima manutenção ao trocar tipo ou hodômetro
  useEffect(() => {
    if (!selectedType || !hodometro) return;
    const h = parseFloat(hodometro.replace(",", "."));
    if (isNaN(h)) return;
    if (selectedType.intervalo_km) setProximoKm(String(h + selectedType.intervalo_km));
    if (selectedType.intervalo_meses) {
      const d = new Date();
      d.setMonth(d.getMonth() + selectedType.intervalo_meses);
      setProximaData(d.toISOString().slice(0, 10));
    }
  }, [typeId, hodometro]);

  const submit = async () => {
    if (!familyId || !userId || !vehicleId || !typeId) return;
    const h = parseFloat(hodometro.replace(",", "."));
    const v = parseFloat(valor.replace(",", ".")) || 0;
    if (!h) { toast.error("Informe o hodômetro"); return; }
    setSaving(true);
    try {
      let txId: string | null = null;
      if (v > 0) {
        const { data: cat } = await supabase.from("categories").select("id")
          .eq("family_id", familyId).eq("nome", "Transporte").maybeSingle();
        const { data: acc } = await supabase.from("accounts").select("id")
          .eq("family_id", familyId).eq("ativo", true).neq("tipo", "cartao").limit(1).maybeSingle();
        const { data: tx, error: txErr } = await supabase.from("transactions").insert({
          family_id: familyId, user_id: userId,
          account_id: acc?.id ?? null, category_id: cat?.id ?? null,
          type: "expense", amount: v,
          description: `Manutenção: ${selectedType?.nome ?? ""}`,
          date: data, is_essencial: true, source: "manual", tipo_especial: "normal",
        }).select("id").single();
        if (txErr) throw txErr;
        txId = tx?.id ?? null;
        if (acc?.id) await supabase.rpc("recalc_account_balance", { _account_id: acc.id });
      }
      const { error } = await supabase.from("vehicle_maintenance_log" as any).insert({
        family_id: familyId, user_id: userId, vehicle_id: vehicleId,
        tipo_id: typeId, descricao: selectedType?.nome ?? "Manutenção",
        data_realizado: data, km_realizado: h, custo: v, oficina: local || null,
        observacao: isOleo ? (tipoOleo || null) : null,
        proximo_km: proximoKm ? parseFloat(proximoKm) : null,
        proxima_data: proximaData || null,
      });
      if (error) throw error;
      // Hodômetro só é atualizado por abastecimento, não por manutenção
      toast.success("✅ Manutenção registrada");
      onOpenChange(false); onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>🔧 Registrar manutenção</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Tipo</Label>
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{types.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Data</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
            <div><Label>Hodômetro</Label><Input value={hodometro} onChange={(e) => setHodometro(e.target.value)} inputMode="decimal" /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Valor (R$)</Label><Input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="0,00" /></div>
            <div><Label>Local</Label><Input value={local} onChange={(e) => setLocal(e.target.value)} /></div>
          </div>
          {isOleo && <div><Label>Tipo de óleo</Label><Input value={tipoOleo} onChange={(e) => setTipoOleo(e.target.value)} placeholder="5W30 sintético..." /></div>}
          <div className="rounded-lg bg-muted/50 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Próxima manutenção (calculado automaticamente)</p>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Próximo km</Label><Input value={proximoKm} onChange={(e) => setProximoKm(e.target.value)} placeholder="82.850" /></div>
              <div><Label className="text-xs">Próxima data</Label><Input type="date" value={proximaData} onChange={(e) => setProximaData(e.target.value)} /></div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
