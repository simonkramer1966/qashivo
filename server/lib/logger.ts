type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel = process.env.NODE_ENV === 'production' ? 'warn' : 'debug';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatMessage(level: LogLevel, context: string, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] [${context}] ${message}`;
}

function createLogger(context: string) {
  return {
    debug(message: string, ...args: any[]) {
      if (shouldLog('debug')) console.log(formatMessage('debug', context, message), ...args);
    },
    info(message: string, ...args: any[]) {
      if (shouldLog('info')) console.log(formatMessage('info', context, message), ...args);
    },
    warn(message: string, ...args: any[]) {
      if (shouldLog('warn')) console.warn(formatMessage('warn', context, message), ...args);
    },
    error(message: string, ...args: any[]) {
      if (shouldLog('error')) console.error(formatMessage('error', context, message), ...args);
    },
  };
}

export { createLogger, type LogLevel };
