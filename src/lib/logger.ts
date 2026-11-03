type Level = 'info' | 'warn' | 'error';

const write: Record<Level, (...args: unknown[]) => void> = {
  info: console.log,
  warn: console.warn,
  error: console.error,
};

const emit = (level: Level, scope: string, message: string, extra?: unknown) => {
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} [${scope}] ${message}`;
  if (extra === undefined) write[level](line);
  else write[level](line, extra);
};

/** Scoped console logger. Never pass secrets (API keys, PINs, OTP codes, tokens) to it. */
export const logger = (scope: string) => ({
  info: (message: string, extra?: unknown) => emit('info', scope, message, extra),
  warn: (message: string, extra?: unknown) => emit('warn', scope, message, extra),
  error: (message: string, extra?: unknown) => emit('error', scope, message, extra),
});

/** 9444455555 -> 94••••5555, so logs identify a number without exposing it. */
export const maskPhone = (phone: string) => (phone.length > 6 ? `${phone.slice(0, 2)}••••${phone.slice(-4)}` : '••••');
