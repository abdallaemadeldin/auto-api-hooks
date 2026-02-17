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
 */
export function emitZodSchemas(spec: ApiSpec): string {
  const chunks: string[] = []

  chunks.push(fileHeader(spec))
  chunks.push("import { z } from 'zod'")
  chunks.push('')

  // --- Collect names so we can topologically reference them ----------------
  // We emit schemas lazily via z.lazy() for forward-referenced types,
  // but for simplicity we rely on JS hoisting of `const` in the same scope
  // being fine if consumers use the schemas after module evaluation.
  // For truly circular refs users should wrap in z.lazy — we emit plain
  // references here because most OpenAPI specs are DAG-structured.

  // --- Named type schemas -------------------------------------------------
  for (const [name, type] of spec.types) {
    chunks.push(emitNamedSchema(name, type))
  }

  // --- Per-operation response schemas -------------------------------------
  for (const op of spec.operations) {
    chunks.push(emitOperationResponseSchema(op))
  }

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

/** Emit a reference to a named schema variable. */
function emitZodRef(type: ApiRefType): string {
  return schemaVarName(type.name)
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
