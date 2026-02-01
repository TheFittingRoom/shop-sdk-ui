let debugSource: RegExp | boolean = false

export function _init(debug: boolean | string | string[] | RegExp) {
  // Parse debug param
  if (debug) {
    function escapeRegExp(string: string) {
      return (
        '^' +
        string
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.') +
        '$'
      )
    }
    if (debug === true) {
      debugSource = true
    } else if (debug instanceof RegExp) {
      debugSource = debug
    } else if (Array.isArray(debug)) {
      debugSource = new RegExp(debug.map((s) => escapeRegExp(s)).join('|'))
    } else if (typeof debug === 'string') {
      debugSource = new RegExp(escapeRegExp(debug))
    }
  }
}

export function isDebugSource(source: string): boolean {
  if (typeof debugSource === 'boolean') {
    return debugSource
  }
  return debugSource.test(source)
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug'
export type LogData = Record<string, unknown> | null
export interface LogEntry {
  source: string
  level: LogLevel
  message: string
  data?: LogData
  duration?: number
}

export function log(entry: LogEntry): void {
  const { source, level, message, data, duration } = entry

  if (level === 'debug' && !isDebugSource(source)) {
    return
  }

  let finalMessage = message
  if (finalMessage.includes('{{')) {
    finalMessage = finalMessage.replace(/{{ts}}/g, new Date().toISOString())
  }
  finalMessage = `[TFR ${source}][${level.toUpperCase()}] ${finalMessage}`

  const logData: unknown[] = [finalMessage]
  if (duration !== undefined) {
    logData.push(`${duration.toFixed(2)} ms`)
  }
  if (data) {
    logData.push(data)
  }
  switch (level) {
    case 'error':
      console.error(...logData)
      break
    case 'warn':
      console.warn(...logData)
      break
    case 'info':
      console.info(...logData)
      break
    case 'debug':
      console.debug(...logData)
      break
    default:
      console.log(...logData)
  }
}

export class Logger {
  source: string
  timers: Record<string, [number, number | null]> = {}

  constructor(source: string) {
    this.source = source
  }

  logError(message: string, data: LogData = null): void {
    log({ source: this.source, level: 'error', message, data })
  }

  logWarn(message: string, data: LogData = null): void {
    log({ source: this.source, level: 'warn', message, data })
  }

  logInfo(message: string, data: LogData = null): void {
    log({ source: this.source, level: 'info', message, data })
  }

  logDebug(message: string, data: LogData = null): void {
    log({ source: this.source, level: 'debug', message, data })
  }

  logTimer(timerName: string, message: string, data: LogData = null): void {
    const duration = this.getTimerDuration(timerName)
    log({ source: this.source, level: 'debug', message, data, duration: duration ?? undefined })
  }

  clearTimers(): void {
    this.timers = {}
  }

  timerStart(name: string): void {
    this.timers[name] = [performance.now(), null]
  }

  timerEnd(name: string): void {
    const timer = this.timers[name]
    if (timer && timer[1] === null) {
      timer[1] = performance.now()
    }
  }

  getTimers(): Record<string, number | null> {
    const result: Record<string, number | null> = {}
    for (const name in this.timers) {
      result[name] = this.getTimerDuration(name)
    }
    return result
  }

  getTimerDuration(name: string): number | null {
    const timer = this.timers[name]
    if (timer && timer[1] !== null) {
      return timer[1] - timer[0]
    }
    return null
  }

  isDebugEnabled(): boolean {
    return isDebugSource(this.source)
  }
}

export function getLogger(source: string): Logger {
  return new Logger(source)
}
