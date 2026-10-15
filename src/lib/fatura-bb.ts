// Parser da fatura do Banco do Brasil (Ourocard) em PDF.
//
// O texto chega como linhas já reconstruídas (ver pdf-text.ts). Cada lançamento
// tem o formato:
//
//   23/09   JIM.COM OLIVEIRA SILVA CAMPO MAIOR      BR    R$ 79,95
//   27/02   COLEGIO INTEL PARC 08/10 CAMPO MAIOR    BR    R$ 95,00
//
// A fatura agrupa os lançamentos sob cabeçalhos de categoria do próprio BB
// ("Restaurantes", "Saúde", ...), que aproveitamos como dica de categoria.

export interface FaturaParcela {
  numero: number;
  total: number;
}

export interface FaturaLancamento {
  date: string; // ISO
  description: string;
  valor: number; // positivo = compra, negativo = pagamento/crédito
  secao: string | null;
  parcela: FaturaParcela | null;
}

export interface FaturaMeta {
  vencimento: string | null; // ISO
  cartaoFinal: string | null;
  total: number | null;
}

export interface FaturaParsed {
  meta: FaturaMeta;
  rows: FaturaLancamento[];
}

// Cabeçalhos de seção usados pelo BB na listagem de lançamentos.
const SECOES = [
  "Pagamentos/Créditos",
  "Restaurantes",
  "Saúde",
  "Serviços",
  "Supermercados",
  "Vestuário",
  "Compras parceladas",
  "Transporte",
  "Lazer",
  "Educação",
  "Outros",
];

function brl(s: string): number {
  return parseFloat(s.replace(/\./g, "").replace(",", "."));
}

/** Detecta se o texto extraído é mesmo uma fatura do BB. */
export function isFaturaBB(text: string): boolean {
  return /OUROCARD/i.test(text) || /Lançamentos nesta fatura/i.test(text);
}

export function parseFaturaBB(text: string): FaturaParsed {
  const lines = text.split(/\r?\n/);

  // O vencimento é a primeira data completa do documento (cabeçalho da fatura).
  const vm = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const vencimento = vm ? `${vm[3]}-${vm[2]}-${vm[1]}` : null;

  const fm = text.match(/Final\s+(\d{4})/);
  const tm = text.match(/Total da Fatura\s+R\$\s*([\d.]+,\d{2})/i);

  const meta: FaturaMeta = {
    vencimento,
    cartaoFinal: fm ? fm[1] : null,
    total: tm ? brl(tm[1]) : null,
  };

  const anoVenc = vencimento ? Number(vencimento.slice(0, 4)) : new Date().getFullYear();
  const mesVenc = vencimento ? Number(vencimento.slice(5, 7)) : new Date().getMonth() + 1;

  const rows: FaturaLancamento[] = [];
  let secao: string | null = null;

  for (const raw of lines) {
    const t = raw.trim();
    if (!t) continue;

    const hit = SECOES.find((s) => t === s);
    if (hit) {
      secao = hit;
      continue;
    }

    const m = t.match(/^(\d{2})\/(\d{2})\s+(.+?)\s+BR\s+R\$\s*(-?[\d.]+,\d{2})$/);
    if (!m) continue;

    const [, dd, mo, descRaw, valorRaw] = m;
    const valor = brl(valorRaw);

    // A fatura mostra só dia/mês. Um mês maior que o do vencimento só pode ser
    // do ano anterior — vale inclusive para parcelas antigas de planos longos.
    const ano = Number(mo) > mesVenc ? anoVenc - 1 : anoVenc;
    const date = `${ano}-${mo}-${dd}`;

    let description = descRaw.trim();
    let parcela: FaturaParcela | null = null;

    const pm = description.match(/\bPARC\s+(\d{1,2})\/(\d{1,2})\b/i);
    if (pm) {
      parcela = { numero: Number(pm[1]), total: Number(pm[2]) };
      description = description.replace(/\bPARC\s+\d{1,2}\/\d{1,2}\b/i, " ");
    }
    description = description.replace(/\s{2,}/g, " ").trim();

    rows.push({ date, description, valor, secao, parcela });
  }

  return { meta, rows };
}
