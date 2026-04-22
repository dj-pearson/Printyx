/**
 * Structured logger for edge functions.
 * Emits JSON-per-line to stdout so Coolify's log viewer can parse it.
 *
 * Pattern matches the Express pino logger signature intentionally:
 *   log.info({ context }, 'message')
 *   log.info('message')
 *
 * No external dependencies — uses console.log + native JSON.
 */

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';

const LEVEL_ORDER: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
  silent: 100,
};

function getEnv(name: string, fallback: string): string {
  try {
    return Deno.env.get(name) ?? fallback;
  } catch {
    return fallback;
  }
}

const configured = (getEnv('LOG_LEVEL', 'info').toLowerCase() as LogLevel) || 'info';
const minLevel = LEVEL_ORDER[configured] ?? LEVEL_ORDER.info;

type LogContext = Record<string, unknown>;

interface Logger {
  trace: (objOrMsg: LogContext | string, msg?: string) => void;
  debug: (objOrMsg: LogContext | string, msg?: string) => void;
  info: (objOrMsg: LogContext | string, msg?: string) => void;
  warn: (objOrMsg: LogContext | string, msg?: string) => void;
  error: (objOrMsg: LogContext | string, msg?: string) => void;
  fatal: (objOrMsg: LogContext | string, msg?: string) => void;
  child: (context: LogContext) => Logger;
}

function emit(
  level: LogLevel,
  module: string,
  baseContext: LogContext,
  objOrMsg: LogContext | string,
  msg?: string,
): void {
  if (LEVEL_ORDER[level] < minLevel) return;

  const ts = new Date().toISOString();
  const line: LogContext = { ts, level, module, ...baseContext };

  if (typeof objOrMsg === 'string') {
    line.msg = objOrMsg;
  } else {
    Object.assign(line, objOrMsg);
    if (msg) line.msg = msg;
  }

  // Use stderr for warn/error/fatal so Coolify can separate severity
  const out =
    level === 'error' || level === 'fatal' || level === 'warn' ? console.error : console.log;
  out(JSON.stringify(line));
}

export function createLogger(module: string, baseContext: LogContext = {}): Logger {
  const logger: Logger = {
    trace: (o, m) => emit('trace', module, baseContext, o, m),
    debug: (o, m) => emit('debug', module, baseContext, o, m),
    info: (o, m) => emit('info', module, baseContext, o, m),
    warn: (o, m) => emit('warn', module, baseContext, o, m),
    error: (o, m) => emit('error', module, baseContext, o, m),
    fatal: (o, m) => emit('fatal', module, baseContext, o, m),
    child: (context) => createLogger(module, { ...baseContext, ...context }),
  };
  return logger;
}

export type { Logger, LogContext, LogLevel };
