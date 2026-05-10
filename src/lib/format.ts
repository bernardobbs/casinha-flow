// ============================================================
// CASINHA HUB — Utilitários de formatação centralizados
// Substitui as 96 definições inline espalhadas pelo projeto
// ============================================================

/** Formata número como moeda BRL: 1234.5 → "R$ 1.234,50" */
export function fmtBRL(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Formata data ISO para pt-BR: "2026-05-10" → "10/05/2026" */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.slice(0, 10) + 'T12:00:00');
  return d.toLocaleDateString('pt-BR');
}

/** Formata data com mês por extenso: "2026-05-10" → "10 de maio de 2026" */
export function fmtDateLong(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

/** Formata mês/ano: "2026-05-01" → "Maio 2026" */
export function fmtMonth(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', {
    month: 'long', year: 'numeric',
  });
}

/** Formata número com separador de milhar: 1234.56 → "1.234,56" */
export function fmtNum(value: number | null | undefined, decimals = 2): string {
  return Number(value ?? 0).toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Formata quantidade com unidade por extenso */
export function fmtQtd(qty: number | null | undefined, unit: string): string {
  const n = Number(qty ?? 0);
  const numStr = Number.isInteger(n)
    ? n.toLocaleString('pt-BR')
    : n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
  const unitLabel: Record<string, [string, string]> = {
    un:  ['unidade', 'unidades'],
    kg:  ['kg', 'kg'],
    g:   ['g', 'g'],
    L:   ['litro', 'litros'],
    ml:  ['ml', 'ml'],
    pct: ['pacote', 'pacotes'],
    cx:  ['caixa', 'caixas'],
    dz:  ['dúzia', 'dúzias'],
  };
  const [sing, plur] = unitLabel[unit] ?? [unit, unit];
  return `${numStr} ${n === 1 ? sing : plur}`;
}

/** Formata variação percentual com sinal: 5.3 → "+5,3%" */
export function fmtPct(value: number | null | undefined, showSign = true): string {
  const n = Number(value ?? 0);
  const sign = showSign && n > 0 ? '+' : '';
  return `${sign}${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/** Retorna cor baseada em valor: positivo=verde, negativo=vermelho */
export function colorByValue(value: number): string {
  return value >= 0 ? 'var(--success)' : 'var(--destructive)';
}
