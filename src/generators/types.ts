/**
 * Generator interfaces and types.
 */
import type { ApiSpec } from '../ir/types'
import type { GeneratedFile } from '../utils/file-writer'

export type FetcherStrategy = 'fetch' | 'axios' | 'react-query' | 'swr'

export interface GeneratorOptions {
  /** Which fetcher strategy to generate. */
  fetcher: FetcherStrategy
  /** Generate Zod validation schemas for response validation. */
  zod: boolean
  /** Generate MSW mock server handlers. */
  mock: boolean
  /** Output directory path. */
  outputDir: string
  /** Base URL override. */
  baseUrl?: string
  /** Whether to generate infinite query hooks for paginated endpoints. */
  infiniteQueries: boolean
}

export interface HookGenerator {
  /** Generate all files for the given spec. */
  generate(spec: ApiSpec, options: GeneratorOptions): GeneratedFile[]
}
