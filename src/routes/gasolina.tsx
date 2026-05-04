import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Fuel, Plus, Wrench, Loader2 } from "lucide-react";

export const Route = createFileRoute("/gasolina")({
  head: () => ({
    meta: [
      { title: "Gasolina — Casinha Flow" },
      { name: "description", content: "Controle de combustível, abastecimentos e manutenção dos veículos da família." },
    ],
  }),
  component: GasolinaPage,
});

type VehicleStatus = {
  vehicle_id: string;
  family_id: string;
  nome: string;
  tipo: "carro" | "moto" | "caminhao" | "outro";
  cor: string;
  flex: boolean;
  capacidade_tanque: number;
  consumo_medio_kml: number;
  odometro_atual: number;
  ativo: boolean;
  ultimo_abastec_data: string | null;
  ultimo_abastec_combustivel: string | null;
  ultimo_abastec_preco_litro: number | null;
  ultimo_abastec_litros: number | null;
  ultimo_abastec_hodometro: number | null;
  ultimo_abastec_tanque_cheio: boolean | null;
  tanque_pct: number | null;
  km_restantes: number | null;
  gasto_mes: number;
};

const TIPO_ICON: Record<string, string> = { carro: "🚗", moto: "🏍️", caminhao: "🚛", outro: "🚙" };
const FUEL_LABEL: Record<string, string> = {
  gasolina: "⛽ Gasolina", aditivada: "⛽ Aditivada", etanol: "🌿 Etanol", diesel: "🚛 Diesel", gnv: "💨 GNV",
};
const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function GasolinaPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<VehicleStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const [openFill, setOpenFill] = useState(false);
  const [openVehicle, setOpenVehicle] = useState(false);
  const [openMaint, setOpenMaint] = useState<{ open: boolean; vehicleId?: string }>({ open: false });

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  const reload = async () => {
    if (!user) return;
    setLoading(true);
    const { data: profile } = await supabase.from("profiles").select("family_id").eq("id", user.id).maybeSingle();
    if (!profile?.family_id) { setLoading(false); return; }
    setFamilyId(profile.family_id);
    const { data, error } = await supabase
      .from("v_vehicle_status" as any)
      .select("*")
      .eq("family_id", profile.family_id)
      .eq("ativo", true)
      .order("nome");
    if (error) toast.error("Erro ao carregar veículos");
    setVehicles((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [user]);

  if (authLoading || loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="container max-w-6xl py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/dashboard"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Button></Link>
            <h1 className="text-xl font-semibold flex items-center gap-2"><Fuel className="h-5 w-5" /> Gasolina</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpenVehicle(true)}>+ Veículo</Button>
            <Button size="sm" onClick={() => setOpenFill(true)} disabled={vehicles.length === 0}>
              <Plus className="h-4 w-4 mr-1" /> Abastecer
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-6 space-y-6">
        {vehicles.length === 0 ? (
          <Card><CardContent className="py-10 text-center space-y-3">
            <p className="text-muted-foreground">Nenhum veículo cadastrado ainda.</p>
            <Button onClick={() => setOpenVehicle(true)}>Cadastrar primeiro veículo</Button>
          </CardContent></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {vehicles.map((v) => <VehicleCard key={v.vehicle_id} v={v} onMaint={() => setOpenMaint({ open: true, vehicleId: v.vehicle_id })} />)}
          </div>
        )}

        <FlexCalculator />

        {vehicles.length > 0 && (
          <Tabs defaultValue={vehicles[0].vehicle_id} className="w-full">
            <TabsList className="flex flex-wrap h-auto">
              {vehicles.map(v => <TabsTrigger key={v.vehicle_id} value={v.vehicle_id}>{TIPO_ICON[v.tipo]} {v.nome}</TabsTrigger>)}
            </TabsList>
            {vehicles.map(v => (
              <TabsContent key={v.vehicle_id} value={v.vehicle_id} className="space-y-4">
                <FuelHistory vehicleId={v.vehicle_id} />
                <MaintenanceList vehicleId={v.vehicle_id} onRegister={() => setOpenMaint({ open: true, vehicleId: v.vehicle_id })} />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </main>

      <FillDialog open={openFill} onOpenChange={setOpenFill} familyId={familyId} userId={user?.id ?? ""} vehicles={vehicles} onSaved={reload} />
      <VehicleDialog open={openVehicle} onOpenChange={setOpenVehicle} familyId={familyId} userId={user?.id ?? ""} onSaved={reload} />
      <MaintDialog
        open={openMaint.open}
        onOpenChange={(o) => setOpenMaint({ open: o, vehicleId: o ? openMaint.vehicleId : undefined })}
        familyId={familyId}
        userId={user?.id ?? ""}
        vehicleId={openMaint.vehicleId ?? null}
        onSaved={reload}
      />
    </div>
  );
}

function VehicleCard({ v, onMaint }: { v: VehicleStatus; onMaint: () => void }) {
  const pct = v.tanque_pct ?? 0;
  const tankColor = pct > 50 ? "bg-green-500" : pct > 20 ? "bg-yellow-500" : "bg-red-500";
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">{TIPO_ICON[v.tipo]} {v.nome}</span>
          {v.flex && <Badge variant="outline">Flex</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Tanque estimado</span>
            <span className="font-medium">{v.tanque_pct !== null ? `${v.tanque_pct}%` : "—"}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div className={`h-full ${tankColor} transition-all`} style={{ width: `${pct}%` }} />
          </div>
          {v.km_restantes !== null && <p className="text-xs text-muted-foreground mt-1">~{v.km_restantes} km restantes</p>}
        </div>
        <div className="text-sm space-y-1 border-t pt-3">
          <div className="flex justify-between"><span className="text-muted-foreground">Hodômetro</span><span>{v.odometro_atual.toLocaleString("pt-BR")} km</span></div>
          {v.ultimo_abastec_data ? (
            <>
              <div className="flex justify-between"><span className="text-muted-foreground">Último abast.</span>
                <span>{new Date(v.ultimo_abastec_data + "T12:00").toLocaleDateString("pt-BR")} • {FUEL_LABEL[v.ultimo_abastec_combustivel ?? ""] ?? ""}</span>
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">Preço/L</span><span>{fmtBRL(v.ultimo_abastec_preco_litro ?? 0)}</span></div>
            </>
          ) : <p className="text-muted-foreground text-xs">Sem abastecimentos registrados</p>}
          <div className="flex justify-between font-medium"><span>Gasto do mês</span><span>{fmtBRL(v.gasto_mes)}</span></div>
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

function FuelHistory({ vehicleId }: { vehicleId: string }) {
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
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2">{new Date(r.data + "T12:00").toLocaleDateString("pt-BR")}</td>
                    <td>{FUEL_LABEL[r.combustivel] ?? r.combustivel}</td>
                    <td className="text-right">{Number(r.litros).toFixed(2)}</td>
                    <td className="text-right">{fmtBRL(Number(r.preco_litro))}</td>
                    <td className="text-right">{fmtBRL(Number(r.valor_pago))}</td>
                    <td className="text-right">{r.kml ? Number(r.kml).toFixed(1) : "—"}</td>
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
function FillDialog({ open, onOpenChange, familyId, userId, vehicles, onSaved }: any) {
  const [vehicleId, setVehicleId] = useState<string>("");
  const [combustivel, setCombustivel] = useState<string>("gasolina");
  const [valor, setValor] = useState("");
  const [preco, setPreco] = useState("");
  const [hodometro, setHodometro] = useState("");
  const [posto, setPosto] = useState("");
  const [tanqueCheio, setTanqueCheio] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && vehicles.length && !vehicleId) {
      setVehicleId(vehicles[0].vehicle_id);
      setHodometro(String(vehicles[0].odometro_atual ?? ""));
      setCombustivel(vehicles[0].ultimo_abastec_combustivel ?? "gasolina");
    }
    if (!open) {
      setValor(""); setPreco(""); setPosto(""); setVehicleId("");
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
      // Categoria Transporte
      const { data: cat } = await supabase.from("categories").select("id")
        .eq("family_id", familyId).eq("nome", "Transporte").maybeSingle();
      // Conta padrão (primeira ativa não-cartão)
      const { data: acc } = await supabase.from("accounts").select("id")
        .eq("family_id", familyId).eq("ativo", true).neq("tipo", "cartao").limit(1).maybeSingle();

      const veiculo = vehicles.find((vv: any) => vv.vehicle_id === vehicleId);
      const desc = `Abastecimento ${veiculo?.nome ?? ""} (${FUEL_LABEL[combustivel] ?? combustivel})`;
      const { data: tx, error: txErr } = await supabase.from("transactions").insert({
        family_id: familyId, user_id: userId,
        account_id: acc?.id ?? null, category_id: cat?.id ?? null,
        type: "expense", amount: v, description: desc,
        date: new Date().toISOString().slice(0, 10),
        is_essencial: true, source: "manual", tipo_especial: "normal",
      }).select("id").single();
      if (txErr) throw txErr;

      const { error: fillErr } = await supabase.from("fuel_fills" as any).insert({
        family_id: familyId, user_id: userId, vehicle_id: vehicleId,
        combustivel, valor_pago: v, preco_litro: p, litros: Number(litros.toFixed(3)),
        hodometro: h, posto: posto || null, tanque_cheio: tanqueCheio,
        transaction_id: tx?.id ?? null,
      });
      if (fillErr) throw fillErr;

      await supabase.from("vehicles" as any).update({ odometro_atual: h }).eq("id", vehicleId);
      if (acc?.id) await supabase.rpc("recalc_account_balance", { _account_id: acc.id });
      toast.success("✅ Abastecimento registrado");
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>⛽ Novo abastecimento</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Veículo</Label>
            <Select value={vehicleId} onValueChange={(id) => {
              setVehicleId(id);
              const v = vehicles.find((vv: any) => vv.vehicle_id === id);
              if (v) setHodometro(String(v.odometro_atual ?? ""));
            }}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{vehicles.map((v: any) => <SelectItem key={v.vehicle_id} value={v.vehicle_id}>{TIPO_ICON[v.tipo]} {v.nome}</SelectItem>)}</SelectContent>
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
            <div><Label>Posto (opcional)</Label><Input value={posto} onChange={(e) => setPosto(e.target.value)} /></div>
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

function VehicleDialog({ open, onOpenChange, familyId, userId, onSaved }: any) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"carro" | "moto" | "caminhao" | "outro">("carro");
  const [combustivel, setCombustivel] = useState<string>("gasolina");
  const [flex, setFlex] = useState(true);
  const [tanque, setTanque] = useState("50");
  const [consumo, setConsumo] = useState("10");
  const [odometro, setOdometro] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!open) { setNome(""); setTanque("50"); setConsumo("10"); setOdometro("0"); } }, [open]);

  const submit = async () => {
    if (!familyId || !userId || !nome) { toast.error("Informe o nome"); return; }
    setSaving(true);
    const { error } = await supabase.from("vehicles" as any).insert({
      family_id: familyId, user_id: userId, nome, tipo,
      combustivel_principal: combustivel, flex,
      capacidade_tanque: parseFloat(tanque.replace(",", ".")) || 50,
      consumo_medio_kml: parseFloat(consumo.replace(",", ".")) || 10,
      odometro_atual: parseFloat(odometro.replace(",", ".")) || 0,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("✅ Veículo cadastrado");
    onOpenChange(false); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>+ Novo veículo</DialogTitle></DialogHeader>
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
          <div className="flex items-center justify-between border rounded-md p-2">
            <Label>Flex (gasolina + etanol)</Label><Switch checked={flex} onCheckedChange={setFlex} />
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
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [hodometro, setHodometro] = useState("");
  const [valor, setValor] = useState("");
  const [local, setLocal] = useState("");
  const [tipoOleo, setTipoOleo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !vehicleId) return;
    (async () => {
      const { data: t } = await supabase.from("vehicle_maintenance_types" as any)
        .select("id, nome").eq("vehicle_id", vehicleId).eq("ativo", true);
      setTypes((t as any) ?? []);
      if (t && t.length) setTypeId((t as any)[0].id);
      const { data: vRow } = await supabase.from("vehicles" as any).select("odometro_atual").eq("id", vehicleId).maybeSingle();
      if (vRow) setHodometro(String((vRow as any).odometro_atual ?? ""));
    })();
    if (!open) { setValor(""); setLocal(""); setTipoOleo(""); }
  }, [open, vehicleId]);

  const selectedType = types.find(t => t.id === typeId);
  const isOleo = (selectedType?.nome ?? "").toLowerCase().includes("óleo") || (selectedType?.nome ?? "").toLowerCase().includes("oleo");

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
        maintenance_type_id: typeId, nome: selectedType?.nome ?? "Manutenção",
        data, hodometro: h, valor: v, local: local || null,
        tipo_oleo: isOleo ? (tipoOleo || null) : null, transaction_id: txId,
      });
      if (error) throw error;
      await supabase.from("vehicles" as any).update({ odometro_atual: h }).eq("id", vehicleId);
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
