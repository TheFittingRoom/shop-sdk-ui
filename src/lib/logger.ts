let sourceRegExp: RegExp | false = false

export function _init(debug: boolean | string | string[] | RegExp) {
  // Parse debug param
  if (debug) {
    function escapeRegExp(string: string) {
      return string
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')
    }
    if (debug === true) {
      sourceRegExp = /.*/
    } else if (debug instanceof RegExp) {
      sourceRegExp = debug
    } else if (Array.isArray(debug)) {
      sourceRegExp = new RegExp(debug.map((s) => escapeRegExp(s)).join('|'))
    } else if (typeof debug === 'string') {
      sourceRegExp = new RegExp(escapeRegExp(debug))
    }
  }
}

export function isDebugSource(source: string): boolean {
  if (!sourceRegExp) {
    return false
  }
  return sourceRegExp.test(source)
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug'
export interface LogEntry {
  source: string
  level: LogLevel
  message: string
  data: unknown[]
}

export function log(entry: LogEntry): void {
  const { source, level, message, data } = entry

  const logMessage = `[TFR ${source}][${level.toUpperCase()}] ${message}`
  switch (level) {
    case 'error':
      console.error(logMessage, ...data)
      break
    case 'warn':
      console.warn(logMessage, ...data)
      break
    case 'info':
      console.info(logMessage, ...data)
      break
    case 'debug':
      if (isDebugSource(source)) {
        console.debug(logMessage, ...data)
      }
      break
    default:
      console.log(logMessage, ...data)
  }
}

export function logError(source: string, message: string, ...data: unknown[]): void {
  log({ source, level: 'error', message, data })
}

export function logWarn(source: string, message: string, ...data: unknown[]): void {
  log({ source, level: 'warn', message, data })
}

export function logInfo(source: string, message: string, ...data: unknown[]): void {
  log({ source, level: 'info', message, data })
}

export function logDebug(source: string, message: string, ...data: unknown[]): void {
  log({ source, level: 'debug', message, data })
}

export class Logger {
  private source: string

  constructor(source: string) {
    this.source = source
  }

  error(message: string, ...data: unknown[]): void {
    logError(this.source, message, ...data)
  }

  warn(message: string, ...data: unknown[]): void {
    logWarn(this.source, message, ...data)
  }

  info(message: string, ...data: unknown[]): void {
    logInfo(this.source, message, ...data)
  }

  debug(message: string, ...data: unknown[]): void {
    logDebug(this.source, message, ...data)
  }
}

export function getLogger(source: string): Logger {
  return new Logger(source)
}
