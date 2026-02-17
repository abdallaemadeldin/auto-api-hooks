/**
 * Colored console logger using picocolors.
 */
import pc from 'picocolors'

export interface Logger {
  info(message: string): void
  success(message: string): void
  warn(message: string): void
  error(message: string): void
  verbose(message: string): void
}

let _verbose = false
let _silent = false

export function setVerbose(v: boolean): void {
  _verbose = v
}

export function setSilent(v: boolean): void {
  _silent = v
}

export const logger: Logger = {
  info(message: string) {
    if (!_silent) console.log(pc.cyan('ℹ'), message)
  },
  success(message: string) {
    if (!_silent) console.log(pc.green('✔'), message)
  },
  warn(message: string) {
    if (!_silent) console.log(pc.yellow('⚠'), message)
  },
  error(message: string) {
    console.error(pc.red('✖'), message)
  },
  verbose(message: string) {
    if (_verbose && !_silent) {
      console.log(pc.gray('  ▸'), pc.gray(message))
    }
  },
}
