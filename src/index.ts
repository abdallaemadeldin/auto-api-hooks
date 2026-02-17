/**
 * auto-api-hooks — Auto-generate type-safe React hooks from API specs.
 *
 * @example
 * ```ts
 * import { generate } from 'auto-api-hooks'
 *
 * await generate({
 *   spec: './openapi.yaml',
 *   fetcher: 'react-query',
 *   outputDir: './src/hooks',
 *   zod: true,
 *   mock: true,
 * })
 * ```
 */
import { parseSpec } from './parsers/index'
import { generateHooks } from './generators/index'
import { generateMockFiles } from './mock-gen/index'
import { writeFiles } from './utils/file-writer'
import type { FetcherStrategy } from './generators/types'
import type { GeneratedFile } from './utils/file-writer'

export interface GenerateOptions {
  /** Path to the API spec file, or a parsed object. */
  spec: string | object
  /** Fetching strategy. */
  fetcher: FetcherStrategy
  /** Output directory. If provided, files are written to disk. */
  outputDir?: string
  /** Override base URL from the spec. */
  baseUrl?: string
  /** Generate Zod validation schemas. */
  zod?: boolean
  /** Generate MSW mock server handlers. */
  mock?: boolean
  /** Generate infinite query hooks for paginated endpoints. */
  infiniteQueries?: boolean
}

/**
 * Generate type-safe React hooks from an API specification.
 *
 * @param options - Generation options
 * @returns Array of generated files (path + content)
 */
export async function generate(options: GenerateOptions): Promise<GeneratedFile[]> {
  const {
    spec: input,
    fetcher,
    outputDir,
    baseUrl,
    zod = false,
    mock = false,
    infiniteQueries = true,
  } = options

  // 1. Parse spec
  const spec = await parseSpec(input, { baseUrl })

  // 2. Generate hook files
  const hookFiles = generateHooks(spec, {
    fetcher,
    zod,
    mock: false,
    outputDir: outputDir || './src/hooks',
    baseUrl,
    infiniteQueries,
  })

  // 3. Generate mock files (if enabled)
  const mockFiles = mock ? generateMockFiles(spec) : []

  const allFiles = [...hookFiles, ...mockFiles]

  // 4. Write to disk (if outputDir provided)
  if (outputDir) {
    await writeFiles(outputDir, allFiles)
  }

  return allFiles
}

// Re-exports
export { parseSpec } from './parsers/index'
export { generateHooks, createGenerator } from './generators/index'
export { generateMockFiles } from './mock-gen/index'
export { emitTypeScriptTypes, emitTypeString } from './type-gen/index'
export { emitZodSchemas, emitZodType } from './type-gen/index'

// Type re-exports
export type { GeneratedFile } from './utils/file-writer'
export type { FetcherStrategy, GeneratorOptions, HookGenerator } from './generators/types'
export type { ParseOptions } from './parsers/types'
export type {
  ApiSpec,
  ApiOperation,
  ApiType,
  ApiPrimitiveType,
  ApiObjectType,
  ApiArrayType,
  ApiEnumType,
  ApiUnionType,
  ApiRefType,
  ApiParam,
  ApiRequestBody,
  ApiResponse,
  ApiProperty,
  PaginationInfo,
  PaginationStrategy,
  HttpMethod,
  OperationMethod,
} from './ir/types'
