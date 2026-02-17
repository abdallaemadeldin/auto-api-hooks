import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { parse as parseYaml } from 'yaml'
import type { ApiSpec } from '../ir/types'
import { applyPaginationDetection } from '../ir/helpers'
import { openApiParser } from './openapi-parser'
import { swaggerParser } from './swagger-parser'
import { graphqlParser } from './graphql-parser'
import type { ParseOptions, SpecParser } from './types'

export type { ParseOptions, SpecParser } from './types'

// ---------------------------------------------------------------------------
// Parse error
// ---------------------------------------------------------------------------

/**
 * Error thrown when no parser can handle the given input, or when the input
 * file format is not recognized.
 */
export class ParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParseError'
  }
}

// ---------------------------------------------------------------------------
// Supported parsers (tried in order)
// ---------------------------------------------------------------------------

const parsers: SpecParser[] = [openApiParser, swaggerParser, graphqlParser]

// ---------------------------------------------------------------------------
// File extension handling
// ---------------------------------------------------------------------------

const YAML_EXTENSIONS = new Set(['.yaml', '.yml'])
const JSON_EXTENSIONS = new Set(['.json'])
const GRAPHQL_EXTENSIONS = new Set(['.graphql', '.gql'])

/**
 * Reads a file and returns the parsed content as an object or string.
 * Supports YAML, JSON, and GraphQL SDL files.
 */
async function loadFile(filePath: string): Promise<unknown> {
  const content = await readFile(filePath, 'utf-8')
  const ext = extname(filePath).toLowerCase()

  if (YAML_EXTENSIONS.has(ext)) {
    return parseYaml(content)
  }

  if (JSON_EXTENSIONS.has(ext)) {
    return JSON.parse(content)
  }

  if (GRAPHQL_EXTENSIONS.has(ext)) {
    return content // Return raw SDL string
  }

  // Try JSON first, then YAML, then treat as raw string
  try {
    return JSON.parse(content)
  } catch {
    try {
      return parseYaml(content)
    } catch {
      return content
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parses an API specification from a file path, URL, or in-memory object.
 *
 * Supports OpenAPI 3.x, Swagger 2.0, and GraphQL (introspection JSON or SDL).
 * File formats: `.yaml`, `.yml`, `.json`, `.graphql`, `.gql`.
 *
 * After parsing, automatic pagination detection is applied to all GET/QUERY
 * operations.
 *
 * @param input - A file path string, or an already-parsed object (JSON/YAML content or introspection result).
 * @param options - Optional parse configuration (e.g. base URL override).
 * @returns The parsed API specification in the IR format.
 * @throws {ParseError} If the input format is not recognized or no parser can handle it.
 *
 * @example
 * ```ts
 * // From file
 * const spec = await parseSpec('./openapi.yaml')
 *
 * // From object
 * const spec = await parseSpec(openapiDocument, { baseUrl: 'https://api.example.com' })
 *
 * // From GraphQL SDL
 * const spec = await parseSpec('./schema.graphql')
 * ```
 */
export async function parseSpec(
  input: string | object,
  options?: ParseOptions,
): Promise<ApiSpec> {
  let resolved: unknown

  if (typeof input === 'string') {
    // Check if it looks like a file path (not SDL)
    const looksLikeFile = /\.[a-z]{2,10}$/i.test(input) && !input.includes('\n')
    if (looksLikeFile) {
      try {
        resolved = await loadFile(input)
      } catch (err) {
        throw new ParseError(
          `Failed to read spec file "${input}": ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    } else {
      // Could be inline SDL or JSON/YAML string
      try {
        resolved = JSON.parse(input)
      } catch {
        try {
          const parsed = parseYaml(input)
          // If YAML parsed to a plain string, it's likely SDL
          resolved = typeof parsed === 'string' ? input : parsed
        } catch {
          resolved = input
        }
      }
    }
  } else {
    resolved = input
  }

  // Build options with filePath so parsers can resolve relative $refs
  const resolvedOptions: ParseOptions = { ...options }
  if (typeof input === 'string' && /\.[a-z]{2,10}$/i.test(input) && !input.includes('\n')) {
    const { resolve } = await import('node:path')
    resolvedOptions.filePath = resolve(input)
  }

  // Try each parser in order
  for (const parser of parsers) {
    if (parser.canParse(resolved)) {
      const spec = await parser.parse(resolved, resolvedOptions)
      return applyPaginationDetection(spec)
    }
  }

  // Build a descriptive error message
  const inputType = typeof resolved
  let hint = ''
  if (inputType === 'object' && resolved !== null) {
    const keys = Object.keys(resolved as Record<string, unknown>).slice(0, 5)
    hint = ` Object keys: [${keys.join(', ')}].`
  } else if (inputType === 'string') {
    const preview = (resolved as string).slice(0, 80)
    hint = ` String starts with: "${preview}...".`
  }

  throw new ParseError(
    `Unable to detect API specification format.${hint} ` +
      'Expected an OpenAPI 3.x document (with "openapi" field starting with "3"), ' +
      'a Swagger 2.0 document (with "swagger": "2.0"), ' +
      'or a GraphQL schema (introspection JSON with "__schema", or SDL string).',
  )
}
