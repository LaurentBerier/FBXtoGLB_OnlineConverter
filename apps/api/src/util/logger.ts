type Level = 'debug' | 'info' | 'warn' | 'error';

const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = order[(process.env.LOG_LEVEL as Level) || 'info'] ?? 20;

function emit(level: Level, msg: string, meta?: unknown) {
  if (order[level] < threshold) return;
  const ts = new Date().toISOString();
  const line = `${ts} ${level.toUpperCase().padEnd(5)} ${msg}`;
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (meta !== undefined) fn(line, typeof meta === 'string' ? meta : JSON.stringify(meta));
  else fn(line);
}

export const logger = {
  debug: (msg: string, meta?: unknown) => emit('debug', msg, meta),
  info: (msg: string, meta?: unknown) => emit('info', msg, meta),
  warn: (msg: string, meta?: unknown) => emit('warn', msg, meta),
  error: (msg: string, meta?: unknown) => emit('error', msg, meta),
  child: (scope: string) => ({
    debug: (m: string, meta?: unknown) => emit('debug', `[${scope}] ${m}`, meta),
    info: (m: string, meta?: unknown) => emit('info', `[${scope}] ${m}`, meta),
    warn: (m: string, meta?: unknown) => emit('warn', `[${scope}] ${m}`, meta),
    error: (m: string, meta?: unknown) => emit('error', `[${scope}] ${m}`, meta),
  }),
};
