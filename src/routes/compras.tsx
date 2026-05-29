import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, ShoppingCart, Plus, Trash2, Pencil, ChevronDown, ChevronUp, Loader2, ListChecks, Wallet, CheckCircle2, Package, Upload, FileText, AlertCircle, Sparkles } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFamily } from "@/hooks/use-family";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export const Route = createFileRoute("/compras")({
  head: () => ({ meta: [{ title: "Compras — Casinha Hub" }] }),
  component: ComprasPage,
});

type Status = "aberta" | "em_andamento" | "concluida";
type ShoppingList = {
  id: string; nome: string; status: Status;
  data_prevista: string | null; local_preferido: string | null;
  total_estimado: number; total_real: number; created_at: string;
};
type ShoppingItem = {
  id: string; list_id: string; nome: string;
  quantidade: number; unidade: string;
  preco_estimado: number | null; preco_real: number | null;
  comprado: boolean; comprado_em: string | null;
};

const UNITS = ["un", "kg", "g", "L", "ml", "cx", "pct"] as const;
const LOCAIS = ["Supermercado Mateus", "Sam's Club", "Atacadão", "Outro"] as const;

const STATUS_LABEL: Record<Status, string> = {
  aberta: "Aberta", em_andamento: "Em andamento", concluida: "Concluída",
};
const STATUS_VARIANT: Record<Status, string> = {
  aberta: "bg-muted text-muted-foreground",
  em_andamento: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  concluida: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

const fmtBRL = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ComprasPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { familyId } = useFamily();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [itemsByList, setItemsByList] = useState<Record<string, ShoppingItem[]>>({});
  const [pendingByList, setPendingByList] = useState<Record<string, { total: number; pendentes: number }>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<Status>("aberta");
  const [loading, setLoading] = useState(true);
  const [productNames, setProductNames] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; nome: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; nome: string }[]>([]);

  const [listDialog, setListDialog] = useState<{ open: boolean; editing?: ShoppingList }>({ open: false });
  const [importDialog, setImportDialog] = useState(false);
  const [importTexto, setImportTexto] = useState("");
  const [importData, setImportData] = useState("");
  const [importConta, setImportConta] = useState("");
  const [importNome, setImportNome] = useState("");
  const [importItens, setImportItens] = useState<any[]>([]);
  const [importStep, setImportStep] = useState<"input"|"review"|"done">("input");
  const [importLoading, setImportLoading] = useState(false);
  const [locations, setLocations] = useState<{id:string;nome:string;tipo:string}[]>([]);
  const [importLocalId, setImportLocalId] = useState('');
  const [localDialog, setLocalDialog] = useState(false);
  const [localForm, setLocalForm] = useState({nome:'',tipo:'supermercado',endereco:'',cnpj:''});
  const [localSaving, setLocalSaving] = useState(false);
  const [criandoProduto, setCriandoProduto] = useState<number | null>(null); // índice do item
  const [sugerindoIA, setSugerindoIA] = useState(false);
  const [sugestoes, setSugestoes] = useState<Record<number, {nome:string;categoria:string}>>({});
  const [modoImportIA, setModoImportIA] = useState(false);
  const [respostaIA, setRespostaIA] = useState('');
  const [novaCategoria, setNovaCategoria] = useState('Mercearia');
  const CATS_ESTOQUE = ['Mercearia','Laticínios','Bebidas','Bebidas Quentes','Carnes','Frios','Temperos','Higiene','Limpeza'];
  const [itemDialog, setItemDialog] = useState<{ open: boolean; listId?: string }>({ open: false });
  const [deleteList, setDeleteList] = useState<ShoppingList | null>(null);
  const [completeAsk, setCompleteAsk] = useState<ShoppingList | null>(null);
  // Estado para finalizar compra com integração financeira
  const [finalizarDialog, setFinalizarDialog] = useState<{ open: boolean; list: ShoppingList | null }>({ open: false, list: null });
  const [finalizarAccount, setFinalizarAccount] = useState<string>("");
  const [finalizarCategory, setFinalizarCategory] = useState<string>("");
  const [finalizarLoading, setFinalizarLoading] = useState(false);
  const [finalizarResult, setFinalizarResult] = useState<{ total: number; estoque: number; itens: number } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  const reload = async () => {
    if (!familyId) return;
    setLoading(true);

    const [{ data }, { data: prods }, { data: accs }, { data: cats }] = await Promise.all([
      supabase.from("shopping_lists" as any).select("*")
        .eq("family_id", familyId).order("created_at", { ascending: false }),
      supabase.from("products").select("nome").eq("family_id", familyId).eq("ativo", true),
      supabase.from("accounts").select("id, nome").eq("family_id", familyId).eq("ativo", true).order("nome"),
      supabase.from("categories").select("id, nome").eq("family_id", familyId).eq("tipo", "despesa").order("nome"),
    ]);

    const ls = ((data as any) ?? []) as ShoppingList[];
    setLists(ls);
    setProductNames(((prods as any) ?? []).map((p: { nome: string }) => p.nome));
    setAccounts((accs as any) ?? []);
    setCategories((cats as any) ?? []);

    if (ls.length) {
      const ids = ls.map(l => l.id);
      const { data: itemsAll } = await supabase
        .from("shopping_items" as any).select("list_id, comprado").in("list_id", ids);
      const counts: Record<string, { total: number; pendentes: number }> = {};
      ((itemsAll as any) ?? []).forEach((it: { list_id: string; comprado: boolean }) => {
        const c = counts[it.list_id] ?? { total: 0, pendentes: 0 };
        c.total++; if (!it.comprado) c.pendentes++;
        counts[it.list_id] = c;
      });
      setPendingByList(counts);
    }
    setLoading(false);
  };
  useEffect(() => { reload(); }, [familyId]);

  const loadItems = async (listId: string) => {
    const { data, error } = await supabase
      .from("shopping_items" as any)
      .select("*")
      .eq("list_id", listId)
      .order("comprado")
      .order("nome");
    if (error) { toast.error("Erro ao carregar itens"); return; }
    setItemsByList(prev => ({ ...prev, [listId]: ((data as any) ?? []) as ShoppingItem[] }));
  };

  const toggleExpand = async (listId: string) => {
    const next = new Set(expanded);
    if (next.has(listId)) next.delete(listId);
    else { next.add(listId); if (!itemsByList[listId]) await loadItems(listId); }
    setExpanded(next);
  };

  const recalcTotals = async (listId: string) => {
    const { data } = await supabase
      .from("shopping_items" as any)
      .select("preco_estimado, preco_real, quantidade, comprado")
      .eq("list_id", listId);
    let est = 0, real = 0;
    ((data as any) ?? []).forEach((it: any) => {
      const q = Number(it.quantidade) || 0;
      est += (Number(it.preco_estimado) || 0) * q;
      if (it.comprado) real += (Number(it.preco_real) || Number(it.preco_estimado) || 0) * q;
    });
    await supabase.from("shopping_lists" as any).update({ total_estimado: est, total_real: real }).eq("id", listId);
    setLists(prev => prev.map(l => l.id === listId ? { ...l, total_estimado: est, total_real: real } : l));
  };

  const filtered = useMemo(() => lists.filter(l => l.status === tab), [lists, tab]);
  const summary = useMemo(() => {
    const abertas = lists.filter(l => l.status !== "concluida");
    const pendentes = abertas.reduce((s, l) => s + (pendingByList[l.id]?.pendentes ?? 0), 0);
    const estimado = abertas.reduce((s, l) => s + Number(l.total_estimado || 0), 0);
    return { abertasCount: abertas.length, pendentes, estimado };
  }, [lists, pendingByList]);

  // ── ações ────────────────────────────────────────────
  const saveList = async (form: { nome: string; data_prevista: Date | undefined; local_preferido: string }) => {
    if (!familyId) return;
    if (!form.nome.trim()) { toast.error("Informe o nome da lista"); return; }
    const payload = {
      nome: form.nome.trim(),
      data_prevista: form.data_prevista ? format(form.data_prevista, "yyyy-MM-dd") : null,
      local_preferido: form.local_preferido || null,
    };
    if (listDialog.editing) {
      const { error } = await supabase.from("shopping_lists" as any).update(payload).eq("id", listDialog.editing.id);
      if (error) { toast.error("Erro ao salvar"); return; }
      toast.success("Lista atualizada");
    } else {
      const { error } = await supabase.from("shopping_lists" as any).insert({ ...payload, family_id: familyId, status: "aberta" });
      if (error) { toast.error("Erro ao criar lista"); return; }
      toast.success("Lista criada");
    }
    setListDialog({ open: false });
    await reload();
  };

  const removeList = async (l: ShoppingList) => {
    await supabase.from("shopping_items" as any).delete().eq("list_id", l.id);
    const { error } = await supabase.from("shopping_lists" as any).delete().eq("id", l.id);
    if (error) toast.error("Erro ao excluir"); else toast.success("Lista excluída");
    setDeleteList(null);
    await reload();
  };

  const saveItem = async (form: { nome: string; quantidade: number; unidade: string; preco_estimado: number | null }) => {
    if (!familyId || !itemDialog.listId) return;
    if (!form.nome.trim()) { toast.error("Informe o nome do item"); return; }
    const { error } = await supabase.from("shopping_items" as any).insert({
      list_id: itemDialog.listId,
      family_id: familyId,
      nome: form.nome.trim(),
      quantidade: form.quantidade || 1,
      unidade: form.unidade,
      preco_estimado: form.preco_estimado,
    });
    if (error) { toast.error("Erro ao adicionar item"); return; }
    toast.success("Item adicionado");
    const lid = itemDialog.listId;
    setItemDialog({ open: false });
    await loadItems(lid);
    await recalcTotals(lid);
    await refreshCounts(lid);
  };

  const refreshCounts = async (listId: string) => {
    const { data } = await supabase.from("shopping_items" as any).select("comprado").eq("list_id", listId);
    const arr = (data as any) ?? [];
    setPendingByList(prev => ({ ...prev, [listId]: { total: arr.length, pendentes: arr.filter((i: any) => !i.comprado).length } }));
  };

  const toggleItem = async (item: ShoppingItem) => {
    const novo = !item.comprado;
    const { error } = await supabase.from("shopping_items" as any).update({
      comprado: novo,
      comprado_em: novo ? new Date().toISOString() : null,
    }).eq("id", item.id);
    if (error) { toast.error("Erro"); return; }
    setItemsByList(prev => ({
      ...prev,
      [item.list_id]: (prev[item.list_id] ?? []).map(i => i.id === item.id ? { ...i, comprado: novo, comprado_em: novo ? new Date().toISOString() : null } : i),
    }));
    await recalcTotals(item.list_id);
    await refreshCounts(item.list_id);

    // se todos comprados → perguntar concluir
    const items = (itemsByList[item.list_id] ?? []).map(i => i.id === item.id ? { ...i, comprado: novo } : i);
    if (novo && items.length > 0 && items.every(i => i.comprado)) {
      const list = lists.find(l => l.id === item.list_id);
      if (list && list.status !== "concluida") setCompleteAsk(list);
    }
  };

  const updateItemPrice = async (item: ShoppingItem, preco: number) => {
    await supabase.from("shopping_items" as any).update({ preco_real: preco }).eq("id", item.id);
    setItemsByList(prev => ({
      ...prev,
      [item.list_id]: (prev[item.list_id] ?? []).map(i => i.id === item.id ? { ...i, preco_real: preco } : i),
    }));
    await recalcTotals(item.list_id);
  };

  const removeItem = async (item: ShoppingItem) => {
    await supabase.from("shopping_items" as any).delete().eq("id", item.id);
    setItemsByList(prev => ({ ...prev, [item.list_id]: (prev[item.list_id] ?? []).filter(i => i.id !== item.id) }));
    await recalcTotals(item.list_id);
    await refreshCounts(item.list_id);
  };

  const concluirLista = async (l: ShoppingList) => {
    // Abrir dialog de finalização com integração financeira
    setCompleteAsk(null);
    setFinalizarResult(null);
    setFinalizarAccount(accounts[0]?.id ?? "");
    // Tentar auto-detectar categoria supermercado
    const catSuper = categories.find(c =>
      c.nome.toLowerCase().includes("supermercado") || c.nome.toLowerCase().includes("alimenta")
    );
    setFinalizarCategory(catSuper?.id ?? categories[0]?.id ?? "");
    setFinalizarDialog({ open: true, list: l });
  };

  const handleFinalizarCompra = async () => {
    const l = finalizarDialog.list;
    if (!l || !familyId || !user) return;
    if (!finalizarAccount) { toast.error("Selecione a conta"); return; }

    setFinalizarLoading(true);
    try {
      const { data, error } = await supabase.rpc("finalizar_compra" as any, {
        p_list_id: l.id,
        p_family_id: familyId,
        p_user_id: user.id,
        p_account_id: finalizarAccount,
        p_category_id: finalizarCategory || null,
        p_data: new Date().toISOString().slice(0, 10),
      });
      if (error) { toast.error(error.message); return; }
      const result = data as any;
      setFinalizarResult({
        total: result.total,
        estoque: result.estoque_atualizado,
        itens: result.itens_comprados,
      });
      toast.success(`✅ Compra finalizada! ${result.itens_comprados} itens, R$ ${Number(result.total).toFixed(2)}`);
      await reload();
    } finally {
      setFinalizarLoading(false);
    }
  };

  // ── UI ────────────────────────────────────────────────
  // Parsear texto do SoftList
  const detectarFormato = (texto: string): 'softlist' | 'nfce' => {
    const linhas = texto.split('\n').filter(l => l.trim());
    // NFC-e: tem tabs E pelo menos uma linha com código alfanumérico seguido de tab
    const temTab = linhas.some(l => l.includes('\t'));
    const temCodigo = linhas.some(l => /^[A-Z0-9]+\t/.test(l.trim()));
    return (temTab && temCodigo) ? 'nfce' : 'softlist';
  };

  const parseNFCe = (texto: string) => {
    const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean);
    const itens: any[] = [];
    // Encontrar onde começa a tabela de itens (após cabeçalho "Código Descrição...")
    let iniciou = false;
    for (const linha of linhas) {
      // Detectar cabeçalho da tabela
      if (/^c.{0,3}digo.*descri/i.test(linha)) { iniciou = true; continue; }
      if (!iniciou) continue;
      // Parar no rodapé
      if (/^qtd.*total|^valor.*total|^forma.*pag|^informa/i.test(linha)) break;
      const cols = linha.split('\t').map((c: string) => c.trim());
      if (cols.length < 4) continue;
      // Código: alfanumérico (ex: S255176, 94721, etc.)
      if (!/^[A-Z0-9]+$/i.test(cols[0])) continue;
      const nome = cols[1] ?? '';
      if (!nome || nome.length < 3) continue;
      // Quantidade: pode ter vírgula decimal
      const qtd = parseFloat((cols[2] ?? '1').replace(',', '.')) || 0;
      if (qtd <= 0) continue;
      // Unidade em cols[3]: UN, UNID, KG, etc.
      // Preço unitário em cols[4], total em cols[5]
      const preco = parseFloat((cols[4] ?? cols[3] ?? '0').replace(',', '.')) || 0;
      const total = parseFloat((cols[5] ?? cols[4] ?? '0').replace(',', '.')) || qtd * preco;
      itens.push({ nome_original: nome, qtd, preco_unitario: preco, total, vinculado: null, sub_produto_id: null });
    }
    // Se não detectou com cabeçalho, tentar heurística direta
    if (!itens.length) {
      for (const linha of linhas) {
        const cols = linha.split('\t').map((c: string) => c.trim());
        if (cols.length < 5) continue;
        if (!/^[A-Z0-9]+$/i.test(cols[0])) continue;
        const nome = cols[1] ?? '';
        const qtd = parseFloat((cols[2] ?? '1').replace(',', '.')) || 0;
        const preco = parseFloat((cols[4] ?? '0').replace(',', '.')) || 0;
        if (!nome || nome.length < 3 || qtd <= 0) continue;
        itens.push({ nome_original: nome, qtd, preco_unitario: preco, total: qtd * preco, vinculado: null, sub_produto_id: null });
      }
    }
    return itens;
  };

    const parseSoftList = (texto: string) => {
    const linhas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const itens: any[] = [];
    let i = 0;
    while (i < linhas.length) {
      const nome = linhas[i];
      // Próxima linha: "N un" ou "N unidades"
      if (i + 1 < linhas.length && /^\d+\s*(un|unidades?|kg|g|ml|l|lt|litros?)$/i.test(linhas[i+1])) {
        const [qtdStr, ...restUnd] = linhas[i+1].split(/\s+/);
        const qtd = parseFloat(qtdStr);
        // Próxima linha: preço "R$ X,XX"
        const precoLinha = linhas[i+2] ?? "";
        const precoMatch = precoLinha.match(/R\$\s*([\d.,]+)/);
        const preco = precoMatch ? parseFloat(precoMatch[1].replace(".", "").replace(",", ".")) : 0;
        if (qtd > 0 && nome.length > 2) {
          itens.push({ nome_original: nome, qtd, preco_unitario: preco, total: qtd * preco, vinculado: null, sub_produto_id: null });
        }
        i += precoMatch ? 3 : 2;
      } else {
        i++;
      }
    }
    return itens;
  };

  const vincularProdutos = async (itens: any[]) => {
    if (!familyId) return itens;
    // Buscar todos os sub-produtos
    const { data: prods } = await supabase.from("products" as any)
      .select("id, nome, parent_id, quantidade_por_embalagem, unidade_embalagem")
      .eq("family_id", familyId).not("parent_id", "is", null);
    const produtos = (prods ?? []) as any[];

    return itens.map(item => {
      const nomeNorm = item.nome_original.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
      // Tentar match por substring
      let melhor: any = null;
      let melhorScore = 0;
      for (const p of produtos) {
        const pNorm = p.nome.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
        // Contar palavras em comum
        const palavrasItem = nomeNorm.split(" ").filter((w: string) => w.length > 2);
        const palavrasProd = pNorm.split(" ").filter((w: string) => w.length > 2);
        const comuns = palavrasItem.filter((w: string) => palavrasProd.includes(w)).length;
        const score = comuns / Math.max(palavrasItem.length, palavrasProd.length);
        if (score > melhorScore && score >= 0.3) {
          melhorScore = score;
          melhor = p;
        }
      }
      return { ...item, vinculado: melhor?.nome ?? null, sub_produto_id: melhor?.id ?? null, qtd_emb: melhor ? melhor.quantidade_por_embalagem : 1 };
    });
  };

  const processarImport = async () => {
    if (!importTexto.trim()) { toast.error("Cole o texto da lista"); return; }
    setImportLoading(true);
    const formato = detectarFormato(importTexto);
    const itens = formato === 'nfce' ? parseNFCe(importTexto) : parseSoftList(importTexto);
    if (!itens.length) { toast.error("Nenhum item encontrado. Verifique o formato."); setImportLoading(false); return; }
    const vinculados = await vincularProdutos(itens);
    setImportItens(vinculados);
    setImportStep("review");
    setImportLoading(false);
  };

  const salvarLocal = async () => {
    if (!localForm.nome.trim()) { toast.error('Nome obrigatorio'); return; }
    setLocalSaving(true);
    const { data, error } = await supabase.from('shopping_locations' as any).insert({
      family_id: familyId, nome: localForm.nome.trim(), tipo: localForm.tipo,
      endereco: localForm.endereco || null, cnpj: localForm.cnpj || null,
    }).select('id, nome, tipo').single();
    if (error) { toast.error(error.message); }
    else {
      setLocations(prev => [...prev, data as any]);
      setImportLocalId((data as any).id);
      toast.success('Local criado!');
      setLocalDialog(false);
      setLocalForm({nome:'',tipo:'supermercado',endereco:'',cnpj:''});
    }
    setLocalSaving(false);
  };

  const callIA = async (prompt: string): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Sessao invalida — faca login novamente');
    const resp = await fetch('https://mmqoyozyeidxbgbxqnda.supabase.co/functions/v1/ai-assistant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + session.access_token,
        'apikey': 'sb_publishable_UvQKkzE7smFYlWpeOxnv6A_MEYtwUYX',
      },
      body: JSON.stringify({ feature: 'assistente', messages: [{ role: 'user', content: prompt }] }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error('Erro ' + resp.status + ': ' + body.slice(0, 100));
    }
    const data = await resp.json();
    return (data.text ?? '') as string;
  };

  const sugerirComIA = async () => {
    const naoId = importItens.map((item, i) => ({ i, nome: item.nome_original }))
      .filter(x => !importItens[x.i].sub_produto_id);
    if (!naoId.length) return;
    setSugerindoIA(true);
    try {
      const cats = CATS_ESTOQUE.join(', ');
      const lista = naoId.map(x => x.i + ':' + x.nome).join('\n');
      const prompt = 'Classifique estes produtos de supermercado. Para cada um, sugira um nome curto para o produto mae e a categoria. Categorias disponiveis: ' + cats + '. Responda SOMENTE com array JSON sem markdown: [{"indice":0,"nome_mae":"nome curto","categoria":"Categoria"}]\n\nProdutos (indice:nome):\n' + lista;
      const raw = await callIA(prompt);
      let resultados: {indice:number;nome_mae:string;categoria:string}[] = [];
      try { resultados = JSON.parse(raw); } catch { /* */ }
      if (!resultados.length) {
        const m = raw.match(/\[[\s\S]*\]/);
        if (m) { try { resultados = JSON.parse(m[0]); } catch { /* */ } }
      }
      if (!resultados.length) {
        const objs = [...raw.matchAll(/\{[^{}]+\}/g)];
        for (const o of objs) { try { resultados.push(JSON.parse(o[0])); } catch { /* */ } }
      }
      if (!resultados.length) throw new Error('IA nao retornou JSON. Resposta: ' + raw.slice(0, 150));
      const novas: Record<number, {nome:string;categoria:string}> = {};
      resultados.forEach(r => {
        const idx = Number(r.indice);
        if (!isNaN(idx)) novas[idx] = { nome: r.nome_mae || '', categoria: r.categoria || 'Mercearia' };
      });
      setSugestoes(novas);
      toast.success('IA sugeriu ' + Object.keys(novas).length + ' classificacoes');
    } catch (e: any) { toast.error('Erro IA: ' + e.message); }
    setSugerindoIA(false);
  };

    const criarProdutoParaItem = async (idx: number, nomeMae: string, categoria: string) => {
    if (!familyId || !nomeMae.trim()) return;
    // Criar produto mãe
    const { data: mae } = await supabase.from('products' as any).insert({
      family_id: familyId, nome: nomeMae.trim(), categoria,
      unidade: 'un', estoque_minimo: 0, estoque_atual: 0, ativo: true,
    }).select('id').single();
    if (!mae) { toast.error('Erro ao criar produto'); return; }
    // Criar sub-produto com nome original da nota
    const item = importItens[idx];
    const { data: filho } = await supabase.from('products' as any).insert({
      family_id: familyId, nome: item.nome_original, categoria,
      unidade: 'un', estoque_minimo: 0, estoque_atual: 0, ativo: true,
      parent_id: (mae as any).id, quantidade_por_embalagem: 1, unidade_embalagem: 'un',
    }).select('id').single();
    if (!filho) { toast.error('Erro ao criar sub-produto'); return; }
    // Vincular item ao novo sub-produto
    setImportItens(prev => prev.map((it, i) => i === idx
      ? { ...it, sub_produto_id: (filho as any).id, vinculado: nomeMae.trim(), qtd_emb: 1 }
      : it
    ));
    setCriandoProduto(null);
    toast.success(`✅ "${nomeMae}" criado e vinculado`);
  };

  const confirmarImport = async () => {
    if (!familyId || !user) return;
    const naoVinculados = importItens.filter(i => !i.sub_produto_id).length;
    const vinculados = importItens.filter(i => i.sub_produto_id).length;
    if (naoVinculados > vinculados) {
      const ok = confirm(`⚠️ Atenção: ${naoVinculados} de ${importItens.length} itens NÃO foram vinculados ao estoque e serão ignorados.

Deseja continuar mesmo assim?`);
      if (!ok) return;
    }
    setImportLoading(true);
    const dataCompra = importData || new Date().toISOString().slice(0, 10);
    const total = importItens.reduce((s, i) => s + (i.total || 0), 0);
    const localNome = locations.find(l => l.id === importLocalId)?.nome ?? '';
    const nomeAuto = importNome || (localNome
      ? localNome + ' ' + new Date(dataCompra + 'T12:00').toLocaleDateString('pt-BR')
      : 'Compras ' + new Date(dataCompra + 'T12:00').toLocaleDateString('pt-BR'));

    // 1. Criar lista de compras
    const { data: lista, error: listaErr } = await supabase.from("shopping_lists" as any).insert({
      family_id: familyId, created_by: user?.id,
      nome: nomeAuto,
      status: "concluida", data_prevista: dataCompra,
      location_id: importLocalId || null,
    }).select("id").single();
    if (listaErr) {
      toast.error("Erro ao criar lista: " + listaErr.message);
      setImportLoading(false);
      return;
    }

    // 2. Inserir itens na lista
    if ((lista as any)?.id) {
      const listaId = (lista as any).id;
      const itemInserts = importItens.map(item => ({
        list_id: listaId, family_id: familyId,
        nome: item.nome_original, quantidade: item.qtd,
        unidade: 'UN', preco_estimado: item.preco_unitario,
        preco_real: item.preco_unitario,
        product_id: item.sub_produto_id || null,
        comprado: true, comprado_em: new Date().toISOString(),
      }));
      await supabase.from('shopping_items' as any).insert(itemInserts);
      // Atualizar total da lista
      await supabase.from('shopping_lists' as any)
        .update({ total_real: total, total_estimado: total })
        .eq('id', listaId);
    }

    // 3. Dar entrada no estoque dos vinculados
    for (const item of importItens) {
      if (!item.sub_produto_id) continue;
      const novaQtd = item.qtd * item.qtd_emb;
      const { data: prod } = await supabase.from("products" as any)
        .select("estoque_atual, parent_id, quantidade_por_embalagem").eq("id", item.sub_produto_id).maybeSingle();
      if (prod) {
        const novo = Number((prod as any).estoque_atual) + novaQtd;
        await supabase.from("products" as any).update({ estoque_atual: novo }).eq("id", item.sub_produto_id);
        // Salvar regra de categorização pelo nome
        await supabase.rpc("save_transaction_rule" as any, {
          p_family_id: familyId, p_description: item.nome_original,
          p_category_id: "c931bce9-bb3e-4335-8891-dea9488b0b90", // Alimentação — Supermercado
          p_account_id: importConta || null, p_tipo: "expense", p_origem: "importacao",
        }).then(() => {}).catch(() => {});
      }
    }

    // 3. Criar transação financeira
    if (total > 0 && importConta) {
      await supabase.from("transactions").insert({
        family_id: familyId, user_id: user.id,
        description: importNome || "Compras Supermercado",
        amount: -total, type: "expense",
        category_id: "c931bce9-bb3e-4335-8891-dea9488b0b90",
        account_id: importConta, date: dataCompra,
        tipo_especial: "normal",
      });
    }

    // Salvar histórico de preços
    if (importLocalId) {
      const priceInserts = importItens
        .filter(i => i.sub_produto_id && i.preco_unitario > 0)
        .map(i => ({
          family_id: familyId, product_id: i.sub_produto_id,
          location_id: importLocalId, preco_unitario: i.preco_unitario,
          quantidade: i.qtd, data: dataCompra,
        }));
      if (priceInserts.length) {
        await supabase.from('product_price_history' as any).insert(priceInserts);
      }
      // Vincular lista ao local
      if ((lista as any)?.id) {
        await supabase.from('shopping_lists' as any).update({ location_id: importLocalId }).eq('id', (lista as any).id);
      }
    }

    toast.success(`✅ ${importItens.filter(i => i.sub_produto_id).length} itens no estoque + transação R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
    setImportStep("done");
    setImportLoading(false);
    await reload();
    setTab("concluida" as any);
  };

  return (
    <div className="min-h-screen p-4" style={{ background: "var(--gradient-subtle)" }}>
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
              <ShoppingCart className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">🛒 Compras</h1>
              <p className="text-sm text-muted-foreground">Listas e itens da família</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setImportStep("input"); setImportTexto(""); setImportItens([]); setImportData(""); setImportNome(""); setImportDialog(true); }}>
              <Upload className="h-4 w-4 mr-1" /> Importar
            </Button>
            <Button onClick={() => setListDialog({ open: true })} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Nova lista
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <SummaryCard icon={<ListChecks className="h-4 w-4" />} label="Listas abertas" value={String(summary.abertasCount)} />
          <SummaryCard icon={<ShoppingCart className="h-4 w-4" />} label="Itens pendentes" value={String(summary.pendentes)} />
          <SummaryCard icon={<Wallet className="h-4 w-4" />} label="Estimado" value={fmtBRL(summary.estimado)} />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Status)}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="aberta">Abertas</TabsTrigger>
            <TabsTrigger value="em_andamento">Em andamento</TabsTrigger>
            <TabsTrigger value="concluida">Concluídas</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map(i => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">
            <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Nenhuma lista nesta aba</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(l => {
              const counts = pendingByList[l.id] ?? { total: 0, pendentes: 0 };
              const comprados = counts.total - counts.pendentes;
              const pct = counts.total > 0 ? (comprados / counts.total) * 100 : 0;
              const isOpen = expanded.has(l.id);
              const items = itemsByList[l.id];
              return (
                <Card key={l.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-lg">🛒</span>
                          <h3 className="font-semibold truncate">{l.nome}</h3>
                          <Badge className={cn("border-0", STATUS_VARIANT[l.status])}>{STATUS_LABEL[l.status]}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {counts.total} itens · {comprados} comprados · {fmtBRL(l.status === "concluida" ? l.total_real : l.total_estimado)}
                        </p>
                        {(l.data_prevista || l.local_preferido) && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {l.data_prevista && <>📅 {format(new Date(l.data_prevista + "T00:00:00"), "dd MMM", { locale: ptBR })}</>}
                            {l.data_prevista && l.local_preferido && " · "}
                            {l.local_preferido && <>📍 {l.local_preferido}</>}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" onClick={() => setListDialog({ open: true, editing: l })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteList(l)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => toggleExpand(l.id)}>
                        {isOpen ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                        {isOpen ? "Ocultar itens" : "Ver itens"}
                      </Button>
                      {l.status !== "concluida" && counts.total > 0 && counts.pendentes === 0 && (
                        <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => concluirLista(l)}>
                          <CheckCircle2 className="h-4 w-4" />
                          Finalizar
                        </Button>
                      )}
                    </div>

                    {isOpen && (
                      <div className="space-y-2 pt-2 border-t">
                        {!items ? (
                          <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                        ) : items.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-2">Nenhum item ainda</p>
                        ) : (
                          items.map(it => (
                            <ItemRow key={it.id} item={it} onToggle={() => toggleItem(it)} onPrice={(v) => updateItemPrice(it, v)} onRemove={() => removeItem(it)} />
                          ))
                        )}
                        <Button variant="ghost" size="sm" className="w-full" onClick={() => setItemDialog({ open: true, listId: l.id })}>
                          <Plus className="h-4 w-4 mr-1" /> Adicionar item
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* DIALOG: Lista */}
      <ListDialog
        key={listDialog.editing?.id ?? "new"}
        open={listDialog.open}
        editing={listDialog.editing}
        onClose={() => setListDialog({ open: false })}
        onSave={saveList}
      />

      {/* DIALOG: Item */}
      <ItemDialog
        open={itemDialog.open}
        productNames={productNames}
        onClose={() => setItemDialog({ open: false })}
        onSave={saveItem}
      />

      {/* CONFIRM excluir */}
      <AlertDialog open={!!deleteList} onOpenChange={(o) => !o && setDeleteList(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lista?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteList?.nome}" e todos os seus itens serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteList && removeList(deleteList)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CONFIRM concluir */}
      <AlertDialog open={!!completeAsk} onOpenChange={(o) => !o && setCompleteAsk(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar compra?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os itens de "{completeAsk?.nome}" foram marcados. Deseja finalizar e registrar no financeiro?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Agora não</AlertDialogCancel>
            <AlertDialogAction onClick={() => completeAsk && concluirLista(completeAsk)}>Finalizar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DIALOG: Finalizar compra com integração financeira */}
      <Dialog open={finalizarDialog.open} onOpenChange={(o) => { if (!finalizarLoading) setFinalizarDialog({ open: o, list: finalizarDialog.list }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Finalizar compra
            </DialogTitle>
          </DialogHeader>

          {finalizarResult ? (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 p-4 space-y-2">
                <p className="font-semibold text-emerald-700 dark:text-emerald-400">✅ Compra finalizada com sucesso!</p>
                <div className="text-sm space-y-1 text-emerald-600 dark:text-emerald-400">
                  <p>💰 Transação criada: <strong>{fmtBRL(finalizarResult.total)}</strong></p>
                  <p>📦 Estoque atualizado: <strong>{finalizarResult.estoque} produtos</strong></p>
                  <p>🛒 Itens comprados: <strong>{finalizarResult.itens}</strong></p>
                </div>
              </div>
              <Button className="w-full" onClick={() => setFinalizarDialog({ open: false, list: null })}>
                Fechar
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Ao finalizar, o sistema irá automaticamente:
              </p>
              <ul className="text-sm space-y-1 text-muted-foreground list-none">
                <li className="flex items-center gap-2"><span className="text-emerald-600">✓</span> Criar lançamento financeiro</li>
                <li className="flex items-center gap-2"><span className="text-emerald-600">✓</span> Atualizar estoque dos produtos vinculados</li>
                <li className="flex items-center gap-2"><span className="text-emerald-600">✓</span> Registrar movimentação de estoque</li>
              </ul>

              <div className="space-y-2">
                <Label>Conta bancária <span className="text-destructive">*</span></Label>
                <Select value={finalizarAccount} onValueChange={setFinalizarAccount}>
                  <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Categoria financeira</Label>
                <Select value={finalizarCategory} onValueChange={setFinalizarCategory}>
                  <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={() => setFinalizarDialog({ open: false, list: null })} disabled={finalizarLoading}>
                  Cancelar
                </Button>
                <Button onClick={handleFinalizarCompra} disabled={finalizarLoading || !finalizarAccount} className="gap-2">
                  {finalizarLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Finalizar compra
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Novo Local */}
      <Dialog open={localDialog} onOpenChange={setLocalDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Novo local de compra</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Nome *</Label>
              <Input value={localForm.nome} onChange={e => setLocalForm(p => ({...p, nome: e.target.value}))} placeholder="Ex: Atacadão" /></div>
            <div><Label>Tipo</Label>
              <Select value={localForm.tipo} onValueChange={v => setLocalForm(p => ({...p, tipo: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="supermercado">🛒 Supermercado</SelectItem>
                  <SelectItem value="atacado">📦 Atacado</SelectItem>
                  <SelectItem value="feira">🥕 Feira</SelectItem>
                  <SelectItem value="online">🌐 Online</SelectItem>
                  <SelectItem value="outro">📍 Outro</SelectItem>
                </SelectContent>
              </Select></div>
            <div><Label>Endereço</Label>
              <Input value={localForm.endereco} onChange={e => setLocalForm(p => ({...p, endereco: e.target.value}))} placeholder="Opcional" /></div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setLocalDialog(false)}>Cancelar</Button>
              <Button onClick={salvarLocal} disabled={localSaving}>{localSaving ? 'Salvando...' : 'Salvar'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Importar SoftList */}
      <Dialog open={importDialog} onOpenChange={v => { if (!v) { setImportDialog(false); if (importStep === "done") setTab("concluida" as Status); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Importar lista de compras
            </DialogTitle>
          </DialogHeader>

          {importStep === "input" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Cole o texto do <strong>SoftList</strong> ou da <strong>NFC-e SEFAZ</strong> (selecione tudo na nota e cole aqui). O formato é detectado automaticamente.</p>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nome da compra</Label>
                  <Input value={importNome} onChange={e => setImportNome(e.target.value)} placeholder="Gerado automaticamente" /></div>
                <div><Label>Data</Label>
                  <Input type="date" value={importData} onChange={e => setImportData(e.target.value)} /></div>
              </div>
              <div><Label>Local de compra</Label>
                <div className="flex gap-2">
                  <Select value={importLocalId} onValueChange={setImportLocalId}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setLocalDialog(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div><Label>Conta de pagamento</Label>
                <Select value={importConta} onValueChange={setImportConta}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><Label>Texto da lista (SoftList)</Label>
                <Textarea value={importTexto} onChange={e => setImportTexto(e.target.value)}
                  rows={10} placeholder={"SoftList: Nome\nQtd un\nR$ X,XX\n\nNFC-e SEFAZ: Cole o conteúdo com colunas (Código, Descrição, Qtde...)"} className="font-mono text-xs" /></div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setImportDialog(false)}>Cancelar</Button>
                <Button onClick={processarImport} disabled={importLoading} className="gap-1.5">
                  {importLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Processar
                </Button>
              </div>
            </div>
          )}

          {importStep === "review" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm flex-wrap gap-2">
                <span className="font-medium">{importItens.length} itens encontrados</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {importItens.filter(i => i.sub_produto_id).length} ✅ ·{" "}
                    {importItens.filter(i => !i.sub_produto_id).length} ⚠️
                  </span>
                  {importItens.some(i => !i.sub_produto_id) && (
                    <>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                        onClick={sugerirComIA} disabled={sugerindoIA}>
                        {sugerindoIA ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-primary" />}
                        {sugerindoIA ? 'Analisando...' : '✨ IA'}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"
                        onClick={() => {
                          const cats = CATS_ESTOQUE.join(', ');
                          const naoId = importItens.filter(i => !i.sub_produto_id);
                          const nl = '\n';
                          const texto = 'Para cada produto abaixo, sugira um nome curto para o produto mae e a categoria.' + nl +
                            'Categorias: ' + cats + nl +
                            'Responda em JSON: [{"indice":0,"nome_mae":"...","categoria":"..."}]' + nl + nl +
                            'Produtos:' + nl + naoId.map((it, i) => i + ':' + it.nome_original).join(nl);
                          navigator.clipboard.writeText(texto);
                          toast.success('Copiado! Cole em qualquer IA e depois cole a resposta abaixo');
                          setModoImportIA(true);
                        }}>
                        📋 Copiar prompt
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {modoImportIA && (
                <div className="border rounded-md p-3 bg-primary/5 space-y-2">
                  <p className="text-xs font-medium">Cole aqui a resposta JSON da IA externa:</p>
                  <textarea
                    className="w-full h-24 text-xs font-mono border rounded-md p-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder={'[{"indice":0,"nome_mae":"Desinfetante Pastilha","categoria":"Limpeza"},...]'}
                    value={respostaIA}
                    onChange={e => setRespostaIA(e.target.value)}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setModoImportIA(false); setRespostaIA(''); }}>Cancelar</Button>
                    <Button size="sm" className="h-7 text-xs" onClick={() => {
                      try {
                        const raw = respostaIA.trim();
                        let resultados: {indice:number;nome_mae:string;categoria:string}[] = [];
                        try { resultados = JSON.parse(raw); } catch { /* */ }
                        if (!resultados.length) {
                          const m = raw.match(/\[[\s\S]*\]/);
                          if (m) resultados = JSON.parse(m[0]);
                        }
                        const novas: Record<number, {nome:string;categoria:string}> = {};
                        // Mapear por índice ou por posição na lista de não identificados
                        const naoId = importItens.map((it, i) => ({i, it})).filter(x => !x.it.sub_produto_id);
                        resultados.forEach((r, pos) => {
                          const idx = r.indice !== undefined ? Number(r.indice) : (naoId[pos]?.i ?? -1);
                          if (idx >= 0) novas[idx] = { nome: r.nome_mae || '', categoria: r.categoria || 'Mercearia' };
                        });
                        setSugestoes(novas);
                        setModoImportIA(false);
                        setRespostaIA('');
                        toast.success(Object.keys(novas).length + ' sugestoes aplicadas');
                      } catch (e: any) { toast.error('JSON invalido: ' + e.message); }
                    }}>Aplicar sugestões</Button>
                  </div>
                </div>
              )}
              <div className="max-h-[340px] overflow-y-auto space-y-1 border rounded-md p-2">
                {importItens.map((item, i) => (
                  <div key={i} className="text-xs py-1.5 border-b last:border-0">
                    <div className="flex items-start gap-2">
                      {item.sub_produto_id
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        : <AlertCircle className="h-3.5 w-3.5 text-orange-400 shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.nome_original}</p>
                        {item.vinculado && <p className="text-muted-foreground">→ {item.vinculado}</p>}
                      {!item.vinculado && sugestoes[i] && <p className="text-primary text-xs">✨ {sugestoes[i].nome} ({sugestoes[i].categoria})</p>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-muted-foreground">{item.qtd}un · R${item.preco_unitario.toFixed(2)}</span>
                        {!item.sub_produto_id && criandoProduto !== i && (
                          <Button size="sm" variant={sugestoes[i] ? "default" : "outline"} className="h-6 text-xs px-2 gap-1"
                            onClick={() => { setCriandoProduto(i); setNovaCategoria(sugestoes[i]?.categoria || 'Mercearia'); }}>
                            {sugestoes[i] ? <><Sparkles className="h-3 w-3" />Criar</> : '+ Criar'}
                          </Button>
                        )}
                      </div>
                    </div>
                    {/* Form de criação de produto */}
                    {criandoProduto === i && (
                      <div className="mt-2 ml-5 p-2 bg-muted/50 rounded-md space-y-2">
                        <p className="text-xs text-muted-foreground font-medium">Criar produto no estoque:</p>
                        <div className="flex gap-2">
                          <Input
                            className="h-7 text-xs flex-1"
                            placeholder="Nome do produto mãe"
                            defaultValue={sugestoes[i]?.nome || item.nome_original.split(' ').slice(0,3).join(' ')}
                            id={`novo-nome-${i}`}
                          />
                          <Select value={novaCategoria} onValueChange={setNovaCategoria}>
                            <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {CATS_ESTOQUE.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-1.5 justify-end">
                          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setCriandoProduto(null)}>Cancelar</Button>
                          <Button size="sm" className="h-6 text-xs gap-1" onClick={() => {
                            const input = document.getElementById(`novo-nome-${i}`) as HTMLInputElement;
                            criarProdutoParaItem(i, input?.value || item.nome_original, novaCategoria);
                          }}>
                            <Plus className="h-3 w-3" /> Criar e vincular
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Total: R$ {importItens.reduce((s, i) => s + (i.total||0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setImportStep("input")}>← Voltar</Button>
                  <Button size="sm" onClick={confirmarImport} disabled={importLoading} className="gap-1.5">
                    {importLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Confirmar importação
                  </Button>
                </div>
              </div>
            </div>
          )}

          {importStep === "done" && (
            <div className="text-center py-6 space-y-3">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
              <p className="font-medium">Importação concluída!</p>
              <p className="text-sm text-muted-foreground">Estoque atualizado e transação registrada.</p>
              <Button onClick={() => { setImportDialog(false); setTab("concluida" as Status); }}>Ver em Concluídas</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">{icon}<span>{label}</span></div>
        <div className="text-base font-bold mt-1 truncate">{value}</div>
      </CardContent>
    </Card>
  );
}

function ItemRow({ item, onToggle, onPrice, onRemove }: {
  item: ShoppingItem;
  onToggle: () => void;
  onPrice: (v: number) => void;
  onRemove: () => void;
}) {
  const [priceInput, setPriceInput] = useState<string>(item.preco_real != null ? String(item.preco_real) : "");
  return (
    <div className="flex items-center gap-2 text-sm">
      <Checkbox checked={item.comprado} onCheckedChange={onToggle} />
      <div className="flex-1 min-w-0">
        <div className={cn("truncate", item.comprado && "line-through text-muted-foreground")}>{item.nome}</div>
        <div className="text-[11px] text-muted-foreground">
          {item.quantidade} {item.unidade}
          {item.preco_estimado != null && <> · est. {fmtBRL(Number(item.preco_estimado) * Number(item.quantidade))}</>}
        </div>
      </div>
      {item.comprado && (
        <Input
          type="number" step="0.01" placeholder="R$ real"
          className="h-8 w-24 text-xs"
          value={priceInput}
          onChange={(e) => setPriceInput(e.target.value)}
          onBlur={() => {
            const n = parseFloat(priceInput);
            if (!isNaN(n) && n !== Number(item.preco_real)) onPrice(n);
          }}
        />
      )}
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onRemove}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function ListDialog({ open, editing, onClose, onSave }: {
  open: boolean; editing?: ShoppingList; onClose: () => void;
  onSave: (form: { nome: string; data_prevista: Date | undefined; local_preferido: string }) => void;
}) {
  const initialLocal = editing?.local_preferido && !LOCAIS.includes(editing.local_preferido as any) ? "Outro" : (editing?.local_preferido ?? "");
  const [nome, setNome] = useState(editing?.nome ?? "");
  const [data, setData] = useState<Date | undefined>(editing?.data_prevista ? new Date(editing.data_prevista + "T00:00:00") : undefined);
  const [localSel, setLocalSel] = useState<string>(initialLocal);
  const [localOutro, setLocalOutro] = useState<string>(initialLocal === "Outro" ? (editing?.local_preferido ?? "") : "");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Editar lista" : "Nova lista"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Compra do mês" />
          </div>
          <div>
            <Label>Data prevista</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !data && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {data ? format(data, "PPP", { locale: ptBR }) : "Escolher data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={data} onSelect={setData} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Local preferido</Label>
            <Select value={localSel} onValueChange={setLocalSel}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                {LOCAIS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            {localSel === "Outro" && (
              <Input className="mt-2" value={localOutro} onChange={(e) => setLocalOutro(e.target.value)} placeholder="Nome do local" />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave({
            nome,
            data_prevista: data,
            local_preferido: localSel === "Outro" ? localOutro : localSel,
          })}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function ItemDialog({ open, productNames, onClose, onSave }: {
  open: boolean; productNames: string[]; onClose: () => void;
  onSave: (form: { nome: string; quantidade: number; unidade: string; preco_estimado: number | null }) => void;
}) {
  const [nome, setNome] = useState("");
  const [quantidade, setQuantidade] = useState<string>("1");
  const [unidade, setUnidade] = useState<string>("un");
  const [preco, setPreco] = useState<string>("");

  useEffect(() => {
    if (open) { setNome(""); setQuantidade("1"); setUnidade("un"); setPreco(""); }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo item</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome *</Label>
            <Input list="produtos-sugestoes" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Arroz 5kg" />
            <datalist id="produtos-sugestoes">
              {productNames.map(n => <option key={n} value={n} />)}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Quantidade</Label>
              <Input type="number" step="0.01" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
            </div>
            <div>
              <Label>Unidade</Label>
              <Select value={unidade} onValueChange={setUnidade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Preço estimado (R$)</Label>
            <Input type="number" step="0.01" value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="0,00" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave({
            nome,
            quantidade: parseFloat(quantidade) || 1,
            unidade,
            preco_estimado: preco ? parseFloat(preco) : null,
          })}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
