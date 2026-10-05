import { getRequestId } from './request-context.js';

type Level = 'debug' | 'info' | 'warn' | 'error';
type Meta = Record<string, unknown>;

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

/** Reduce an unknown thrown value to loggable, secret-free fields. */
export function serializeError(err: unknown): Meta {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      // Stack traces only outside production, and never sent to clients.
      ...(isProd ? {} : { stack: err.stack }),
    };
  }
  return { message: String(err) };
}

function write(level: Level, message: string, meta: Meta = {}): void {
  if (isTest && level !== 'error') return;

  const entry = {
    time: new Date().toISOString(),
    level,
    message,
    requestId: getRequestId(),
    ...meta,
  };

  const line = isProd
    ? JSON.stringify(entry)
    : `[${entry.level}] ${message} ${JSON.stringify({ ...meta, requestId: entry.requestId })}`;

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (m: string, meta?: Meta) => !isProd && write('debug', m, meta),
  info: (m: string, meta?: Meta) => write('info', m, meta),
  warn: (m: string, meta?: Meta) => write('warn', m, meta),
  error: (m: string, meta?: Meta) => write('error', m, meta),
};
