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

export function setVerbose(v: boolean): void {
  _verbose = v
}

export const logger: Logger = {
  info(message: string) {
    console.log(pc.cyan('ℹ'), message)
  },
  success(message: string) {
    console.log(pc.green('✔'), message)
  },
  warn(message: string) {
    console.log(pc.yellow('⚠'), message)
  },
  error(message: string) {
    console.error(pc.red('✖'), message)
  },
  verbose(message: string) {
    if (_verbose) {
      console.log(pc.gray('  ▸'), pc.gray(message))
    }
  },
}
