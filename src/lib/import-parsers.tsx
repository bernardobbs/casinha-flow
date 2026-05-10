import React from 'react';
import { CreditCard, FileDown, Receipt } from 'lucide-react';

// ============================================================
// CASINHA HUB — Parsers de extrato bancário + classificação
// Extraído de transactions.tsx para separar lógica de negócio da UI
// ============================================================

export type TxType = 'income' | 'expense';
export type TipoEspecial = 'normal' | 'transferencia' | 'pagamento_fatura';
export type ImportFormat = 'bb' | 'bb_csv' | 'nubank' | 'inter' | 'caixa' | 'csv';

export interface ParsedRow {
  date: string;
  description: string;
  amount: number;
  type: TxType;
  category: string;
  external_id: string;
  selected: boolean;
  tipo_especial?: TipoEspecial;
  error?: string;
  suggested_category_id?: string | null;
  suggested_origem?: 'manual' | 'ia' | 'keyword' | null;
  suggested_nivel?: number | null;
  suggested_confianca?: number | null;
  dup_status?: 'novo' | 'possivel' | 'existe';
  dup_match?: { id: string; description: string; date: string; amount: number } | null;
}

export type TxSource = 'manual' | 'importado' | 'recorrente' | 'compras' | 'cartao';

export const SourceIcon = ({ source }: { source: TxSource }) => {
  if (source === "cartao") return <CreditCard className="h-3.5 w-3.5" />;
  if (source === "importado") return <FileDown className="h-3.5 w-3.5" />;
  return <Receipt className="h-3.5 w-3.5" />;
};

// ---- CSV import helpers ----

const CATEGORY_RULES: { keywords: string[]; category: string }[] = [
  { keywords: ["mercado", "padaria"], category: "Alimentação" },
  { keywords: ["posto", "uber"], category: "Transporte" },
  { keywords: ["farmacia", "farmácia", "drogaria"], category: "Saúde" },
  { keywords: ["aluguel", "energia", "internet"], category: "Moradia" },
  { keywords: ["parcela", "financiamento", "emprestimo", "empréstimo"], category: "Dívidas" },
  { keywords: ["netflix", "spotify", "amazon"], category: "Assinaturas" },
];

export function classifyCategory(description: string): string {
  const d = description.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((k) => d.includes(k))) return rule.category;
  }
  return "Outros";
}

export function parseDate(raw: string): string | null {
  const s = raw.trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

export function parseAmount(raw: string): number | null {
  let s = raw.trim().replace(/[R$\s]/gi, "");
  if (!s) return null;
  // If has comma, treat as decimal separator (BR format)
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function splitCsvLine(line: string): string[] {
  // simple CSV with optional quoted fields
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === "," || c === ";") {
        out.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}


export function parseBBExtrato(text: string): ParsedRow[] {
  const ignorar = ["Saldo Anterior", "Saldo do dia", "00/00/0000"];
  const rows: ParsedRow[] = [];
  const lines = text.split(/\r?\n/).slice(1);
  for (const line of lines) {
    if (ignorar.some((x) => line.includes(x))) continue;
    const dateMatch = line.match(/^(\d{2}\/\d{2}\/\d{4})/);
    if (!dateMatch) continue;
    const valorMatch = line.match(/(-?[\d.]+,\d{2})\s+(Entrada|Saída)\s*$/);
    if (!valorMatch) continue;
    const [d, m, a] = dateMatch[1].split("/");
    const dateIso = `${a}-${m}-${d}`;
    let valor = parseFloat(valorMatch[1].replace(/\./g, "").replace(",", "."));
    if (valorMatch[2] === "Saída" && valor > 0) valor = -valor;
    if (valorMatch[2] === "Entrada" && valor < 0) valor = Math.abs(valor);
    let desc = line.slice(dateMatch[1].length).trim();
    desc = desc.replace(/-?[\d.]+,\d{2}\s+(Entrada|Saída)?\s*$/, "").trim();
    desc = desc.replace(/\s+\d{5,}\s*$/, "").trim();
    desc = desc.replace(/\s{2,}/g, " — ").replace(/^[— ]+|[— ]+$/g, "");
    const type: TxType = valor >= 0 ? "income" : "expense";
    rows.push({
      date: dateIso,
      description: desc.slice(0, 120),
      amount: valor,
      type,
      category: classifyCategory(desc),
      external_id: `${dateIso}|${desc.toLowerCase().trim().slice(0, 40)}|${valor.toFixed(2)}|${rows.length}`,
      selected: true,
    });
  }
  return rows;
}

export function parseNubank(text: string): ParsedRow[] {
  // Nubank CSV: Data,Valor,Identificador,Descrição
  // ou: date,title,amount
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return [];

  const header = lines[0].toLowerCase();
  const cols = splitCsvLine(header);

  // Detectar colunas
  const idxDate = cols.findIndex(c => c.includes('data') || c === 'date');
  const idxDesc = cols.findIndex(c => c.includes('descri') || c.includes('title') || c.includes('estabelec'));
  const idxAmount = cols.findIndex(c => c.includes('valor') || c === 'amount');

  if (idxDate < 0 || idxDesc < 0 || idxAmount < 0) return parseCsv(text);

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = splitCsvLine(lines[i]);
    if (c.length < 3) continue;
    const date = parseDate(c[idxDate]);
    const description = c[idxDesc]?.trim();
    const amount = parseAmount(c[idxAmount]);
    if (!date || !description || amount === null) continue;

    // Nubank: despesas são positivas no CSV mas são saídas
    // Créditos têm valor negativo
    const type: TxType = amount <= 0 ? "income" : "expense";
    const valor = amount <= 0 ? Math.abs(amount) : -amount;

    rows.push({
      date, description,
      amount: valor,
      type,
      category: classifyCategory(description),
      external_id: `${date}|${description.toLowerCase().slice(0, 40)}|${valor.toFixed(2)}|${rows.length}`,
      selected: true,
    });
  }
  return rows;
}

export function parseInter(text: string): ParsedRow[] {
  // Inter CSV: Data;Tipo;Descrição;Valor
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return [];

  const header = lines[0].toLowerCase();
  const sep = header.includes(';') ? ';' : ',';
  const cols = header.split(sep).map(c => c.trim().replace(/"/g, ''));

  const idxDate = cols.findIndex(c => c.includes('data'));
  const idxTipo = cols.findIndex(c => c.includes('tipo') || c.includes('categoria'));
  const idxDesc = cols.findIndex(c => c.includes('descri') || c.includes('hist'));
  const idxAmount = cols.findIndex(c => c.includes('valor'));

  if (idxDate < 0 || idxAmount < 0) return parseCsv(text);

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(sep).map(x => x.trim().replace(/"/g, ''));
    if (c.length < 3) continue;
    const date = parseDate(c[idxDate]);
    const description = idxDesc >= 0 ? c[idxDesc] : c[idxTipo] ?? '';
    const amount = parseAmount(c[idxAmount]);
    if (!date || !description || amount === null) continue;

    const tipo = idxTipo >= 0 ? c[idxTipo].toLowerCase() : '';
    const isDebito = tipo.includes('debito') || tipo.includes('saída') || tipo.includes('pgto');
    const type: TxType = isDebito ? "expense" : amount < 0 ? "expense" : "income";
    const valor = Math.abs(amount) * (type === "expense" ? -1 : 1);

    rows.push({
      date, description: description.slice(0, 120),
      amount: valor, type,
      category: classifyCategory(description),
      external_id: `${date}|${description.toLowerCase().slice(0, 40)}|${valor.toFixed(2)}|${rows.length}`,
      selected: true,
    });
  }
  return rows;
}

export function parseCaixaExtrato(text: string): ParsedRow[] {
  // Caixa: formato similar ao BB com largura fixa
  // Data       Histórico                          Docto     Crédito      Débito    Saldo
  const lines = text.split(/\r?\n/).slice(1);
  const rows: ParsedRow[] = [];

  for (const line of lines) {
    if (!line.trim() || line.includes('Saldo') || line.includes('Data')) continue;
    const dateMatch = line.match(/^(\d{2}\/\d{2}\/\d{4})/);
    if (!dateMatch) continue;

    // Tentar capturar crédito e débito
    const numeros = [...line.matchAll(/(\d{1,3}(?:\.\d{3})*,\d{2})/g)].map(m => m[1]);
    if (numeros.length < 2) continue;

    const [d, m, a] = dateMatch[1].split('/');
    const dateIso = `${a}-${m}-${d}`;

    // Extrair descrição
    let desc = line.slice(10, 50).trim();
    desc = desc.replace(/\s{2,}/g, ' ').trim();

    // Último número é saldo, penúltimo é débito se negativo, antepenúltimo é crédito
    const credito = parseFloat(numeros[numeros.length - 3]?.replace(/\./g, '').replace(',', '.') ?? '0');
    const debito = parseFloat(numeros[numeros.length - 2]?.replace(/\./g, '').replace(',', '.') ?? '0');

    const valor = credito > 0 ? credito : debito > 0 ? -debito : 0;
    if (valor === 0) continue;

    const type: TxType = valor > 0 ? "income" : "expense";

    rows.push({
      date: dateIso, description: desc.slice(0, 120),
      amount: valor, type,
      category: classifyCategory(desc),
      external_id: `${dateIso}|${desc.toLowerCase().slice(0, 40)}|${valor.toFixed(2)}|${rows.length}`,
      selected: true,
    });
  }
  return rows;
}

// Detectar tipo especial baseado na descrição
export function detectTipoEspecial(desc: string): "normal" | "transferencia" | "pagamento_fatura" {
  const d = desc.toLowerCase();
  // Transferências e investimentos — não são receita nem despesa real
  if (
    d.includes("rende fácil") || d.includes("rende facil") ||
    d.includes("bb rende") || d.includes("aplicacao") || d.includes("aplicação") ||
    d.includes("resgate") || d.includes("poupança") || d.includes("poupanca") ||
    d.includes("transferência") || d.includes("transferencia recebida") ||
    d.includes("pix - rejeitado") || d.includes("pix rejeitado") ||
    d.includes("estorno") || d.includes("devoluç") || d.includes("devoluc")
  ) return "transferencia";
  // Pagamento de fatura de cartão
  if (
    d.includes("pagto cartão") || d.includes("pagto cartao") ||
    d.includes("pagamento cartão") || d.includes("fatura") ||
    d.includes("pagto cart")
  ) return "pagamento_fatura";
  return "normal";
}

export function parseBBCSV(text: string): ParsedRow[] {
  const ignorar = ['Saldo Anterior', 'S A L D O', 'SALDO'];
  const rows: ParsedRow[] = [];
  const lines = text.split(/\r?\n/).filter(l => l.trim());

  for (let i = 1; i < lines.length; i++) {
    // Extrair colunas entre aspas (robusto a encoding)
    const cols = lines[i].match(/"([^"]*)"/g)
      ?.map(c => c.slice(1, -1).trim()) ?? [];

    if (cols.length < 5) continue;

    const dataRaw = cols[0];
    const lancamento = cols[1];
    const detalhe = cols[2];
    // cols[3] = nº documento — ignorar
    const valorRaw = cols[4];
    const tipoLanc = cols[5] ?? '';

    // Ignorar linhas de saldo
    if (ignorar.some(x => lancamento.includes(x))) continue;
    // Ignorar linhas sem tipo (saldo inicial/final)
    if (!tipoLanc) continue;

    // Parse data DD/MM/YYYY
    const dateParts = dataRaw.split('/');
    if (dateParts.length !== 3) continue;
    const dateIso = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;

    // Parse valor: "-1.100,00" → -1100.00
    const valor = parseFloat(valorRaw.replace(/\./g, '').replace(',', '.'));
    if (isNaN(valor)) continue;

    // Descrição: Lançamento + Detalhes sem data/hora do início
    let desc = lancamento;
    if (detalhe) {
      const semDataHora = detalhe.replace(/^\d{2}\/\d{2}\s+\d{2}:\d{2}\s+/, '').trim();
      if (semDataHora) desc = `${lancamento} — ${semDataHora}`;
    }

    // Normalizar acentos quebrados na descrição
    desc = desc.replace(/\uFFFD/g, '');

    const tipoEspecial = detectTipoEspecial(desc);
    const type: TxType = valor < 0 ? 'expense' : 'income';
    const amount = Math.abs(valor) * (type === 'expense' ? -1 : 1);

    rows.push({
      date: dateIso,
      description: desc.slice(0, 120),
      amount,
      type,
      tipo_especial: tipoEspecial,
      category: tipoEspecial === 'transferencia' ? 'Transferência' :
                tipoEspecial === 'pagamento_fatura' ? 'Extra — Banco / Taxas' :
                classifyCategory(desc),
      external_id: `${dateIso}|${desc.toLowerCase().slice(0, 40)}|${valor.toFixed(2)}|${rows.length}`,
      // Desmarcar automaticamente transferências positivas (entrada do Rende Fácil)
      selected: !(tipoEspecial === 'transferencia' && valor > 0),
    });
  }
  return rows;
}
export function detectFormat(text: string, filename: string): 'bb' | 'bb_csv' | 'nubank' | 'inter' | 'caixa' | 'csv' {
  const lower = text.toLowerCase().slice(0, 500);
  const fname = filename.toLowerCase();

  // BB CSV: primeira linha tem "Data" + "Valor" + "Tipo"
  const _primeiraLinha = text.split('\n')[0] ?? '';
  if (/^"data"/i.test(_primeiraLinha) && /valor/i.test(_primeiraLinha) && /tipo/i.test(_primeiraLinha)) return 'bb_csv';
  // BB CSV alternativo: 6 colunas entre aspas
  if (/^"[^"]+","[^"]*","[^"]*","[^"]*","[^"]*","[^"]*"/i.test(_primeiraLinha)) return 'bb_csv';
  // BB fixo: largura fixa com Entrada/Saída no final
  if (/tipo lan[cç]amento|entrada\s*$|sa[ií]da\s*$/m.test(text)) return 'bb';
  if (fname.includes('nubank') || lower.includes('nubank') || lower.includes('nu pagamentos')) return 'nubank';
  if (fname.includes('inter') || lower.includes('banco inter')) return 'inter';
  if (fname.includes('caixa') || lower.includes('caixa economica')) return 'caixa';
  if (/data.*valor.*ident|identificador/i.test(text.slice(0, 200))) return 'nubank';
  if (/data.*tipo.*descri.*valor/i.test(text.slice(0, 200))) return 'inter';

  return 'csv';
}

export function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  // Detect header (skip if first row contains 'data' keyword)
  const startIdx =
    /data/i.test(lines[0]) && /(descri|valor)/i.test(lines[0]) ? 1 : 0;

  const rows: ParsedRow[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length < 3) continue;
    const date = parseDate(cols[0]);
    const description = cols[1];
    const amount = parseAmount(cols[2]);

    if (!date || !description || amount === null) {
      rows.push({
        date: cols[0] ?? "",
        description: description ?? "",
        amount: 0,
        type: "expense",
        category: "Outros",
        external_id: "",
        selected: false,
        error: "Linha inválida",
      });
      continue;
    }

    const type: TxType = amount < 0 ? "expense" : "income";
    rows.push({
      date,
      description,
      amount,
      type,
      category: classifyCategory(description),
      external_id: `${date}|${description.toLowerCase().trim()}|${amount.toFixed(2)}|${rows.length}`,
      selected: true,
    });
  }
  return rows;
}
