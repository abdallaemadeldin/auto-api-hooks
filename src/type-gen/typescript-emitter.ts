/**
 * TypeScript source code emitter.
 *
 * Converts IR types into plain TypeScript string output that can be
 * written directly to a `.ts` file. No ts-morph dependency — just
 * fast string concatenation.
 */
import type {
  ApiArrayType,
  ApiEnumType,
  ApiObjectType,
  ApiOperation,
  ApiParam,
  ApiPrimitiveType,
  ApiRefType,
  ApiSpec,
  ApiType,
  ApiUnionType,
} from '../ir/types'
import { toPascalCase } from '../utils/naming'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a complete TypeScript `types.ts` file from the API specification.
 *
 * The output includes:
 * - All named types from `spec.types` as interfaces / type aliases
 * - Per-operation params, request body, and response types
 * - JSDoc comments where descriptions are available
 *
 * Every exported symbol is prefixed with `export`.
 */
export function emitTypeScriptTypes(spec: ApiSpec): string {
  const chunks: string[] = []

  chunks.push(fileHeader(spec))

  // --- Named types ---------------------------------------------------------
  for (const [name, type] of spec.types) {
    chunks.push(emitNamedType(name, type))
  }

  // --- Per-operation types -------------------------------------------------
  for (const op of spec.operations) {
    const params = emitParamsInterface(op)
    if (params) {
      chunks.push(params)
    }

    const body = emitRequestBodyType(op)
    if (body) {
      chunks.push(body)
    }

    chunks.push(emitResponseType(op))
  }

  return chunks.join('\n')
}

/**
 * Convert an {@link ApiType} into its TypeScript string representation.
 *
 * Handles all discriminated union kinds recursively:
 * - `primitive` -> `string`, `number`, `boolean`, `null`, `unknown`
 * - `object`    -> inline `{ ... }` literal
 * - `array`     -> `Array<T>`
 * - `enum`      -> string/number literal union
 * - `union`     -> `A | B | C`
 * - `ref`       -> PascalCase type name
 */
export function emitTypeString(type: ApiType): string {
  switch (type.kind) {
    case 'primitive':
      return emitPrimitive(type)
    case 'object':
      return emitObjectInline(type)
    case 'array':
      return emitArray(type)
    case 'enum':
      return emitEnum(type)
    case 'union':
      return emitUnion(type)
    case 'ref':
      return emitRef(type)
  }
}

/**
 * Emit a params interface for an operation by combining path, query, and
 * header parameters.
 *
 * Returns `null` if the operation has no parameters.
 *
 * The interface is named `{PascalCase(operationId)}Params`.
 */
export function emitParamsInterface(op: ApiOperation): string | null {
  const allParams: ApiParam[] = [
    ...op.pathParams,
    ...op.queryParams,
    ...op.headerParams,
  ]

  if (allParams.length === 0) {
    return null
  }

  const name = `${toPascalCase(op.operationId)}Params`
  const lines: string[] = []

  if (op.summary) {
    lines.push(jsdoc(op.summary))
  }
  lines.push(`export interface ${name} {`)

  for (const param of allParams) {
    if (param.description) {
      lines.push(indent(jsdoc(param.description)))
    }
    const optional = param.required ? '' : '?'
    lines.push(indent(`${safePropName(param.name)}${optional}: ${emitTypeString(param.type)}`))
  }

  lines.push('}')
  lines.push('')
  return lines.join('\n')
}

/**
 * Emit a request body type alias for an operation.
 *
 * Returns `null` if the operation has no request body.
 *
 * The type is named `{PascalCase(operationId)}Body`.
 */
export function emitRequestBodyType(op: ApiOperation): string | null {
  if (!op.requestBody) {
    return null
  }

  const name = `${toPascalCase(op.operationId)}Body`
  const lines: string[] = []

  if (op.requestBody.description) {
    lines.push(jsdoc(op.requestBody.description))
  }
  lines.push(`export type ${name} = ${emitTypeString(op.requestBody.type)}`)
  lines.push('')
  return lines.join('\n')
}

/**
 * Emit a response type alias for an operation.
 *
 * The type is named `{PascalCase(operationId)}Response`.
 */
export function emitResponseType(op: ApiOperation): string {
  const name = `${toPascalCase(op.operationId)}Response`
  const lines: string[] = []

  if (op.response.description) {
    lines.push(jsdoc(op.response.description))
  }
  lines.push(`export type ${name} = ${emitTypeString(op.response.type)}`)
  lines.push('')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Produce the file header comment. */
function fileHeader(spec: ApiSpec): string {
  const lines: string[] = [
    '/* eslint-disable */',
    '/* tslint:disable */',
    `/**`,
    ` * Auto-generated TypeScript types for ${spec.title} (v${spec.version}).`,
    ` * DO NOT EDIT — this file is regenerated on every run.`,
    ` */`,
    '',
  ]
  return lines.join('\n')
}

/** Map an IR primitive to its TypeScript equivalent. */
function emitPrimitive(type: ApiPrimitiveType): string {
  switch (type.type) {
    case 'string':
      return 'string'
    case 'number':
    case 'integer':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'null':
      return 'null'
    case 'unknown':
      return 'unknown'
  }
}

/** Emit an inline object literal type: `{ prop: Type; ... }`. */
function emitObjectInline(type: ApiObjectType): string {
  if (type.properties.length === 0 && !type.additionalProperties) {
    return 'Record<string, unknown>'
  }

  const members: string[] = []

  for (const prop of type.properties) {
    const optional = prop.required ? '' : '?'
    const comment = prop.description ? ` ${inlineComment(prop.description)}` : ''
    members.push(
      `${safePropName(prop.name)}${optional}: ${emitTypeString(prop.type)}${comment}`,
    )
  }

  if (type.additionalProperties !== undefined) {
    if (type.additionalProperties === true) {
      members.push('[key: string]: unknown')
    } else if (type.additionalProperties !== false) {
      members.push(`[key: string]: ${emitTypeString(type.additionalProperties)}`)
    }
  }

  return `{\n${members.map((m) => indent(m)).join('\n')}\n}`
}

/** Emit `Array<T>`. */
function emitArray(type: ApiArrayType): string {
  const inner = emitTypeString(type.items)
  // Use Array<T> form for complex inner types to avoid ambiguity.
  if (inner.includes('|') || inner.includes('{')) {
    return `Array<${inner}>`
  }
  return `${inner}[]`
}

/** Emit a string/number literal union for enums. */
function emitEnum(type: ApiEnumType): string {
  if (type.values.length === 0) {
    return 'never'
  }
  return type.values
    .map((v) => (typeof v === 'string' ? `'${escapeString(v)}'` : String(v)))
    .join(' | ')
}

/** Emit `A | B | C`. */
function emitUnion(type: ApiUnionType): string {
  if (type.variants.length === 0) {
    return 'never'
  }
  if (type.variants.length === 1) {
    return emitTypeString(type.variants[0])
  }
  return type.variants.map((v) => emitTypeString(v)).join(' | ')
}

/** Emit a reference to a named type. */
function emitRef(type: ApiRefType): string {
  return toPascalCase(type.name)
}

/**
 * Emit a named type as either an `interface` (for objects) or a `type` alias.
 */
function emitNamedType(name: string, type: ApiType): string {
  const tsName = toPascalCase(name)
  const lines: string[] = []

  if (type.kind !== 'ref' && type.description) {
    lines.push(jsdoc(type.description))
  }

  if (type.kind === 'object') {
    lines.push(...emitInterface(tsName, type))
  } else {
    lines.push(`export type ${tsName} = ${emitTypeString(type)}`)
  }

  lines.push('')
  return lines.join('\n')
}

/** Emit a full `export interface` block. */
function emitInterface(name: string, type: ApiObjectType): string[] {
  const lines: string[] = []
  lines.push(`export interface ${name} {`)

  for (const prop of type.properties) {
    if (prop.description) {
      lines.push(indent(jsdoc(prop.description)))
    }
    const optional = prop.required ? '' : '?'
    lines.push(indent(`${safePropName(prop.name)}${optional}: ${emitTypeString(prop.type)}`))
  }

  if (type.additionalProperties !== undefined) {
    if (type.additionalProperties === true) {
      lines.push(indent('[key: string]: unknown'))
    } else if (type.additionalProperties !== false) {
      lines.push(indent(`[key: string]: ${emitTypeString(type.additionalProperties)}`))
    }
  }

  lines.push('}')
  return lines
}

// ---------------------------------------------------------------------------
// Formatting utilities
// ---------------------------------------------------------------------------

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
 * Ensure a property name is safe for TypeScript.
 *
 * Names that contain characters other than `[a-zA-Z0-9_$]` or that start
 * with a digit are wrapped in quotes.
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
