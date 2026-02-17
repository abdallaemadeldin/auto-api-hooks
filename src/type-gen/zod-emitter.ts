/**
 * Zod schema source code emitter.
 *
 * Converts IR types into Zod schema definitions as plain TypeScript
 * strings. The output can be written directly to a `schemas.ts` file.
 */
import type {
  ApiArrayType,
  ApiEnumType,
  ApiObjectType,
  ApiOperation,
  ApiPrimitiveType,
  ApiProperty,
  ApiRefType,
  ApiSpec,
  ApiType,
  ApiUnionType,
} from '../ir/types'
import { toCamelCase } from '../utils/naming'

// ---------------------------------------------------------------------------
// Circular reference detection
// ---------------------------------------------------------------------------

/** Set of type names involved in cycles — their refs need z.lazy(). */
let _circularTypes: Set<string> = new Set()

/**
 * Build a dependency graph and detect which named types are part of cycles.
 * Any ref to a type in a cycle must use `z.lazy(() => schema)`.
 */
function detectCircularTypes(types: Map<string, ApiType>): Set<string> {
  const deps = new Map<string, Set<string>>()

  // Collect direct ref dependencies for each named type
  for (const [name, type] of types) {
    const refs = new Set<string>()
    collectRefs(type, refs)
    deps.set(name, refs)
  }

  // Find all types that participate in a cycle using DFS
  const circular = new Set<string>()
  const visited = new Set<string>()
  const inStack = new Set<string>()

  function dfs(name: string, path: string[]): void {
    if (inStack.has(name)) {
      // Found a cycle — mark every node in the cycle
      const cycleStart = path.indexOf(name)
      for (let i = cycleStart; i < path.length; i++) {
        circular.add(path[i])
      }
      return
    }
    if (visited.has(name)) return
    visited.add(name)
    inStack.add(name)
    path.push(name)

    for (const dep of deps.get(name) ?? []) {
      if (types.has(dep)) {
        dfs(dep, path)
      }
    }

    path.pop()
    inStack.delete(name)
  }

  for (const name of types.keys()) {
    dfs(name, [])
  }

  return circular
}

/** Recursively collect all ref names from a type. */
function collectRefs(type: ApiType, refs: Set<string>): void {
  switch (type.kind) {
    case 'ref':
      refs.add(type.name)
      break
    case 'object':
      for (const prop of type.properties) {
        collectRefs(prop.type, refs)
      }
      if (type.additionalProperties && typeof type.additionalProperties !== 'boolean') {
        collectRefs(type.additionalProperties, refs)
      }
      break
    case 'array':
      collectRefs(type.items, refs)
      break
    case 'union':
      for (const v of type.variants) {
        collectRefs(v, refs)
      }
      break
    // primitive and enum have no refs
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a complete Zod `schemas.ts` file from the API specification.
 *
 * The output includes:
 * - `import { z } from 'zod'`
 * - A `const …Schema = z.…` for every named type in `spec.types`
 * - A response schema for every operation
 * - Re-exports of all schemas
 *
 * Circular type references are automatically wrapped with `z.lazy()`.
 */
export function emitZodSchemas(spec: ApiSpec): string {
  const chunks: string[] = []

  // Detect circular types before emitting
  _circularTypes = detectCircularTypes(spec.types)

  chunks.push(fileHeader(spec))
  chunks.push("import { z } from 'zod'")
  chunks.push('')

  // --- Named type schemas -------------------------------------------------
  for (const [name, type] of spec.types) {
    chunks.push(emitNamedSchema(name, type))
  }

  // --- Per-operation response schemas -------------------------------------
  for (const op of spec.operations) {
    chunks.push(emitOperationResponseSchema(op))
  }

  // Reset module-level state
  _circularTypes = new Set()

  return chunks.join('\n')
}

/**
 * Convert an {@link ApiType} into its Zod schema string representation.
 *
 * Handles every discriminated union kind recursively:
 * - `primitive` -> `z.string()`, `z.number()`, etc. with format refinements
 * - `object`    -> `z.object({ ... })`
 * - `array`     -> `z.array(...)`
 * - `enum`      -> `z.enum([...])` for strings, `z.union([z.literal(...), ...])` for mixed
 * - `union`     -> `z.union([...])`
 * - `ref`       -> camelCase schema variable name
 */
export function emitZodType(type: ApiType): string {
  switch (type.kind) {
    case 'primitive':
      return emitZodPrimitive(type)
    case 'object':
      return emitZodObject(type)
    case 'array':
      return emitZodArray(type)
    case 'enum':
      return emitZodEnum(type)
    case 'union':
      return emitZodUnion(type)
    case 'ref':
      return emitZodRef(type)
  }
}

// ---------------------------------------------------------------------------
// Internal — per-kind emitters
// ---------------------------------------------------------------------------

/**
 * Map an IR primitive to the corresponding Zod schema, including
 * format-specific refinements for common string formats.
 */
function emitZodPrimitive(type: ApiPrimitiveType): string {
  switch (type.type) {
    case 'string':
      return applyStringFormat('z.string()', type.format)
    case 'number':
      return 'z.number()'
    case 'integer':
      return 'z.number().int()'
    case 'boolean':
      return 'z.boolean()'
    case 'null':
      return 'z.null()'
    case 'unknown':
      return 'z.unknown()'
  }
}

/** Apply format-specific Zod refinements to a `z.string()` base. */
function applyStringFormat(base: string, format: string | undefined): string {
  if (!format) {
    return base
  }
  switch (format) {
    case 'date-time':
      return `${base}.datetime()`
    case 'email':
      return `${base}.email()`
    case 'uuid':
      return `${base}.uuid()`
    case 'uri':
    case 'url':
      return `${base}.url()`
    default:
      // Unknown formats are left as plain z.string().
      return base
  }
}

/** Emit `z.object({ ... })` with optional properties wrapped in `.optional()`. */
function emitZodObject(type: ApiObjectType): string {
  if (type.properties.length === 0 && !type.additionalProperties) {
    return 'z.record(z.string(), z.unknown())'
  }

  const members = type.properties.map((prop) => emitZodProperty(prop))

  // Handle additionalProperties as a passthrough / catchall.
  let suffix = ''
  if (type.additionalProperties !== undefined) {
    if (type.additionalProperties === true) {
      suffix = '.catchall(z.unknown())'
    } else if (type.additionalProperties !== false) {
      suffix = `.catchall(${emitZodType(type.additionalProperties)})`
    }
  }

  if (members.length === 0) {
    return `z.object({})${suffix}`
  }

  const body = members.map((m) => indent(m)).join('\n')
  return `z.object({\n${body}\n})${suffix}`
}

/** Emit a single object property as `name: schema` or `name: schema.optional()`. */
function emitZodProperty(prop: ApiProperty): string {
  const schema = emitZodType(prop.type)
  const optionalSuffix = prop.required ? '' : '.optional()'
  const comment = prop.description ? ` ${inlineComment(prop.description)}` : ''
  return `${safePropName(prop.name)}: ${schema}${optionalSuffix},${comment}`
}

/** Emit `z.array(...)`. */
function emitZodArray(type: ApiArrayType): string {
  return `z.array(${emitZodType(type.items)})`
}

/**
 * Emit a Zod enum schema.
 *
 * - All-string values: `z.enum(['a', 'b', 'c'])`
 * - Mixed or numeric values: `z.union([z.literal(1), z.literal('a')])`
 */
function emitZodEnum(type: ApiEnumType): string {
  if (type.values.length === 0) {
    return 'z.never()'
  }

  const allStrings = type.values.every((v) => typeof v === 'string')
  if (allStrings) {
    const items = type.values
      .map((v) => `'${escapeString(String(v))}'`)
      .join(', ')
    return `z.enum([${items}])`
  }

  // Mixed types — use z.union of z.literal
  const literals = type.values
    .map((v) =>
      typeof v === 'string' ? `z.literal('${escapeString(v)}')` : `z.literal(${v})`,
    )
    .join(', ')
  return `z.union([${literals}])`
}

/** Emit `z.union([...])`. */
function emitZodUnion(type: ApiUnionType): string {
  if (type.variants.length === 0) {
    return 'z.never()'
  }
  if (type.variants.length === 1) {
    return emitZodType(type.variants[0])
  }
  const members = type.variants.map((v) => emitZodType(v)).join(', ')
  return `z.union([${members}])`
}

/**
 * Emit a reference to a named schema variable.
 * Circular refs are wrapped with `z.lazy()` to avoid runtime errors.
 */
function emitZodRef(type: ApiRefType): string {
  const varName = schemaVarName(type.name)
  if (_circularTypes.has(type.name)) {
    return `z.lazy(() => ${varName})`
  }
  return varName
}

// ---------------------------------------------------------------------------
// Named type & operation schema helpers
// ---------------------------------------------------------------------------

/**
 * Emit a named schema declaration:
 * ```
 * export const userSchema = z.object({ ... })
 * ```
 */
function emitNamedSchema(name: string, type: ApiType): string {
  const varName = schemaVarName(name)
  const lines: string[] = []

  if (type.kind !== 'ref' && type.description) {
    lines.push(jsdoc(type.description))
  }

  lines.push(`export const ${varName} = ${emitZodType(type)}`)
  lines.push('')
  return lines.join('\n')
}

/**
 * Emit a response schema for an operation:
 * ```
 * export const getUserResponseSchema = z.object({ ... })
 * ```
 */
function emitOperationResponseSchema(op: ApiOperation): string {
  const varName = `${toCamelCase(op.operationId)}ResponseSchema`
  const lines: string[] = []

  if (op.response.description) {
    lines.push(jsdoc(op.response.description))
  }

  lines.push(`export const ${varName} = ${emitZodType(op.response.type)}`)
  lines.push('')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Formatting utilities
// ---------------------------------------------------------------------------

/** Derive the schema variable name from a type name: `User` -> `userSchema`. */
function schemaVarName(name: string): string {
  return `${toCamelCase(name)}Schema`
}

/** Produce the file header comment. */
function fileHeader(spec: ApiSpec): string {
  const lines = [
    '/* eslint-disable */',
    '/* tslint:disable */',
    `/**`,
    ` * Auto-generated Zod schemas for ${spec.title} (v${spec.version}).`,
    ` * DO NOT EDIT — this file is regenerated on every run.`,
    ` */`,
    '',
  ]
  return lines.join('\n')
}

/** Wrap text in a JSDoc comment block. */
function jsdoc(text: string): string {
  const trimmed = text.trim()
  if (!trimmed.includes('\n')) {
    return `/** ${trimmed} */`
  }
  const lines = trimmed.split('\n')
  return ['/**', ...lines.map((l) => ` * ${l.trimEnd()}`), ' */'].join('\n')
}

/** Produce a short inline JSDoc comment. */
function inlineComment(text: string): string {
  const single = text.replace(/\n/g, ' ').trim()
  return `/** ${single} */`
}

/** Indent a string by two spaces. */
function indent(str: string): string {
  return str
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n')
}

/**
 * Ensure a property name is safe as a JS identifier in an object literal.
 *
 * Names containing characters other than `[a-zA-Z0-9_$]` or starting with
 * a digit are quoted.
 */
function safePropName(name: string): string {
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
    return name
  }
  return `'${escapeString(name)}'`
}

/** Escape single-quote characters inside a string literal. */
function escapeString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}
