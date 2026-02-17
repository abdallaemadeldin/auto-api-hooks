/**
 * Generator factory and public API.
 */
import type { ApiSpec } from '../ir/types'
import type { FetcherStrategy, GeneratorOptions, HookGenerator } from './types'
import type { GeneratedFile } from '../utils/file-writer'
import { FetchGenerator } from './fetch-generator'
import { AxiosGenerator } from './axios-generator'
import { ReactQueryGenerator } from './react-query-generator'
import { SwrGenerator } from './swr-generator'
import { GeneratorError } from '../utils/errors'

/**
 * Create a hook generator for the specified fetcher strategy.
 */
export function createGenerator(strategy: FetcherStrategy): HookGenerator {
  switch (strategy) {
    case 'fetch':
      return new FetchGenerator()
    case 'axios':
      return new AxiosGenerator()
    case 'react-query':
      return new ReactQueryGenerator()
    case 'swr':
      return new SwrGenerator()
    default:
      throw new GeneratorError(`Unknown fetcher strategy: ${strategy as string}`)
  }
}

/**
 * Generate hooks from a parsed API spec.
 */
export function generateHooks(
  spec: ApiSpec,
  options: GeneratorOptions,
): GeneratedFile[] {
  const generator = createGenerator(options.fetcher)
  return generator.generate(spec, options)
}

export type { FetcherStrategy, GeneratorOptions, HookGenerator } from './types'
