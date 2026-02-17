import type { ApiSpec } from '../ir/types'

export interface ParseOptions {
  baseUrl?: string
  /** @internal Original file path, used to resolve relative $ref pointers */
  filePath?: string
}

export interface SpecParser {
  canParse(input: unknown): boolean
  parse(input: unknown, options?: ParseOptions): Promise<ApiSpec>
}
