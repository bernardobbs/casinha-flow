// Sistema de log para debug de importação
interface ImportLog {
  ts: string;
  level: 'info' | 'warn' | 'error' | 'success';
  msg: string;
  data?: unknown;
}

const logs: ImportLog[] = [];

export function importLog(level: ImportLog['level'], msg: string, data?: unknown) {
  const entry = { ts: new Date().toISOString(), level, msg, data };
  logs.push(entry);
  const emoji = { info: '📋', warn: '⚠️', error: '❌', success: '✅' }[level];
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
    `[Import ${emoji}] ${msg}`, data ?? ''
  );
}

export function getImportLogs() { return [...logs]; }
export function clearImportLogs() { logs.length = 0; }
