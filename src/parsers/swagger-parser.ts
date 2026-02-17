import SwaggerParser from '@apidevtools/swagger-parser'
import type { OpenAPIV2 } from 'openapi-types'
import type {
  ApiSpec,
  ApiOperation,
  ApiParam,
  ApiRequestBody,
  ApiResponse,
  ApiType,
  ApiObjectType,
  ApiArrayType,
  ApiPrimitiveType,
  ApiEnumType,
  ApiUnionType,
  ApiProperty,
  HttpMethod,
} from '../ir/types'
import type { SpecParser, ParseOptions } from './types'

// ---------------------------------------------------------------------------
// Type aliases
// ---------------------------------------------------------------------------

type SchemaObject = OpenAPIV2.SchemaObject
type InBodyParameterObject = OpenAPIV2.InBodyParameterObject
type GeneralParameterObject = OpenAPIV2.GeneralParameterObject
type ResponseObject = OpenAPIV2.ResponseObject
type ReferenceObject = OpenAPIV2.ReferenceObject

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isRef(obj: unknown): obj is ReferenceObject {
  return typeof obj === 'object' && obj !== null && '$ref' in obj
}

function isBodyParam(param: OpenAPIV2.Parameter): param is InBodyParameterObject {
  return param.in === 'body'
}

// ---------------------------------------------------------------------------
// HTTP method mapping
// ---------------------------------------------------------------------------

const HTTP_METHODS: ReadonlySet<string> = new Set([
  'get', 'post', 'put', 'delete', 'patch', 'head', 'options',
])

// ---------------------------------------------------------------------------
// JSON Schema -> ApiType conversion (Swagger 2.0 variant)
// ---------------------------------------------------------------------------

/**
 * Recursively converts a Swagger 2.0 JSON Schema object into the IR `ApiType`.
 */
function convertSchema(schema: SchemaObject | undefined): ApiType {
  if (!schema) {
    return { kind: 'primitive', type: 'unknown' }
  }

  // Handle oneOf / anyOf -> union
  if (schema.oneOf && schema.oneOf.length > 0) {
    const variants = schema.oneOf
      .filter((s): s is SchemaObject => !isRef(s))
      .map((s) => convertSchema(s as SchemaObject))
    return { kind: 'union', variants, description: schema.description } satisfies ApiUnionType
  }
  if (schema.anyOf && schema.anyOf.length > 0) {
    const variants = schema.anyOf
      .filter((s): s is SchemaObject => !isRef(s))
      .map((s) => convertSchema(s as SchemaObject))
    return { kind: 'union', variants, description: schema.description } satisfies ApiUnionType
  }

  // Handle allOf -> merge into object
  if (schema.allOf && schema.allOf.length > 0) {
    const merged = mergeAllOf(
      schema.allOf.filter((s): s is SchemaObject => !isRef(s)),
    )
    const result = convertSchema(merged)
    if (schema.description && result.kind === 'object') {
      return { ...result, description: schema.description }
    }
    return result
  }

  // Handle enum
  if (schema.enum && schema.enum.length > 0) {
    return {
      kind: 'enum',
      values: schema.enum as (string | number)[],
      name: schema.title,
      description: schema.description,
    } satisfies ApiEnumType
  }

  const schemaType = typeof schema.type === 'string' ? schema.type : undefined

  // Handle array
  if (schemaType === 'array') {
    let items: ApiType = { kind: 'primitive', type: 'unknown' }
    if (schema.items && !isRef(schema.items)) {
      items = convertSchema(schema.items as SchemaObject)
    }
    return { kind: 'array', items, description: schema.description } satisfies ApiArrayType
  }

  // Handle object
  if (schemaType === 'object' || schema.properties || (!schemaType && hasObjectShape(schema))) {
    return convertObjectSchema(schema)
  }

  // Handle primitives
  if (schemaType === 'string' || schemaType === 'number' || schemaType === 'integer' || schemaType === 'boolean') {
    const result: ApiPrimitiveType = {
      kind: 'primitive',
      type: schemaType,
      description: schema.description,
    }
    if (schema.format) {
      result.format = schema.format
    }
    return result
  }

  return { kind: 'primitive', type: 'unknown', description: schema.description }
}

function hasObjectShape(schema: SchemaObject): boolean {
  return !!(schema.properties || schema.additionalProperties)
}

function convertObjectSchema(schema: SchemaObject): ApiObjectType {
  const requiredSet = new Set<string>(schema.required ?? [])
  const properties: ApiProperty[] = []

  if (schema.properties) {
    for (const [name, propSchema] of Object.entries(schema.properties)) {
      if (isRef(propSchema)) continue
      properties.push({
        name,
        type: convertSchema(propSchema as SchemaObject),
        required: requiredSet.has(name),
        description: (propSchema as SchemaObject).description,
      })
    }
  }

  const result: ApiObjectType = {
    kind: 'object',
    properties,
    description: schema.description,
  }

  if (schema.title) {
    result.name = schema.title
  }

  if (schema.additionalProperties !== undefined) {
    if (typeof schema.additionalProperties === 'boolean') {
      result.additionalProperties = schema.additionalProperties
    } else if (!isRef(schema.additionalProperties)) {
      result.additionalProperties = convertSchema(schema.additionalProperties as SchemaObject)
    }
  }

  return result
}

function mergeAllOf(schemas: SchemaObject[]): SchemaObject {
  const merged: SchemaObject = {
    type: 'object',
    properties: {},
    required: [],
  }
  for (const schema of schemas) {
    if (schema.properties) {
      Object.assign(merged.properties!, schema.properties)
    }
    if (schema.required) {
      ;(merged.required as string[]).push(...schema.required)
    }
    if (schema.description && !merged.description) {
      merged.description = schema.description
    }
  }
  return merged
}

// ---------------------------------------------------------------------------
// Parameter conversion (Swagger 2.0)
// ---------------------------------------------------------------------------

/**
 * Converts a non-body Swagger 2.0 parameter to an `ApiParam`.
 * For `in: "body"` parameters, use `convertBodyParam` instead.
 */
function convertGeneralParam(param: GeneralParameterObject): ApiParam {
  const paramType = param.type as string | undefined
  let type: ApiType

  if (param.enum && param.enum.length > 0) {
    type = {
      kind: 'enum',
      values: param.enum as (string | number)[],
    }
  } else if (paramType === 'array' && param.items) {
    const itemSchema = isRef(param.items)
      ? ({ kind: 'primitive', type: 'unknown' } as ApiType)
      : convertItemsToType(param.items)
    type = { kind: 'array', items: itemSchema }
  } else {
    type = {
      kind: 'primitive',
      type: mapSwagger2Type(paramType),
      format: param.format,
    } as ApiPrimitiveType
  }

  return {
    name: param.name,
    required: param.required ?? (param.in === 'path'),
    type,
    description: param.description,
    in: param.in as 'path' | 'query' | 'header',
  }
}

/**
 * Converts a Swagger 2.0 `ItemsObject` to an `ApiType`.
 */
function convertItemsToType(items: OpenAPIV2.ItemsObject): ApiType {
  if (items.enum && items.enum.length > 0) {
    return { kind: 'enum', values: items.enum as (string | number)[] }
  }
  if (items.type === 'array' && items.items && !isRef(items.items)) {
    return {
      kind: 'array',
      items: convertItemsToType(items.items as OpenAPIV2.ItemsObject),
    }
  }
  return {
    kind: 'primitive',
    type: mapSwagger2Type(items.type),
    format: items.format,
  } as ApiPrimitiveType
}

/**
 * Maps a Swagger 2.0 type string to the IR primitive type.
 */
function mapSwagger2Type(
  t: string | undefined,
): 'string' | 'number' | 'integer' | 'boolean' | 'null' | 'unknown' {
  switch (t) {
    case 'string':
      return 'string'
    case 'number':
    case 'float':
    case 'double':
      return 'number'
    case 'integer':
    case 'long':
      return 'integer'
    case 'boolean':
      return 'boolean'
    default:
      return 'unknown'
  }
}

/**
 * Converts a `in: "body"` parameter to `ApiRequestBody`.
 */
function convertBodyParam(
  param: InBodyParameterObject,
  produces: string[],
): ApiRequestBody {
  const schema = isRef(param.schema)
    ? undefined
    : (param.schema as SchemaObject | undefined)

  return {
    required: param.required ?? false,
    contentType: produces.includes('application/json')
      ? 'application/json'
      : (produces[0] ?? 'application/json'),
    type: convertSchema(schema),
    description: param.description,
  }
}

// ---------------------------------------------------------------------------
// Response conversion (Swagger 2.0)
// ---------------------------------------------------------------------------

function convertResponse(
  responses: OpenAPIV2.ResponsesObject,
  produces: string[],
): ApiResponse {
  const successCodes = ['200', '201']
  let responseObj: ResponseObject | undefined
  let statusCode: number | 'default' = 200

  for (const code of successCodes) {
    const candidate = responses[code]
    if (candidate && !isRef(candidate)) {
      responseObj = candidate as ResponseObject
      statusCode = parseInt(code, 10)
      break
    }
  }

  if (!responseObj) {
    for (const [code, value] of Object.entries(responses)) {
      if (code.startsWith('2') && value && !isRef(value)) {
        responseObj = value as ResponseObject
        statusCode = parseInt(code, 10)
        break
      }
    }
  }

  if (!responseObj) {
    const defaultResp = responses['default']
    if (defaultResp && !isRef(defaultResp)) {
      responseObj = defaultResp as ResponseObject
      statusCode = 'default'
    }
  }

  if (!responseObj || !responseObj.schema) {
    return {
      statusCode,
      contentType: produces[0] ?? 'application/json',
      type: { kind: 'primitive', type: 'unknown' },
      description: responseObj?.description,
    }
  }

  const schema = isRef(responseObj.schema)
    ? undefined
    : (responseObj.schema as SchemaObject)

  const contentType = produces.includes('application/json')
    ? 'application/json'
    : (produces[0] ?? 'application/json')

  return {
    statusCode,
    contentType,
    type: convertSchema(schema),
    description: responseObj.description,
  }
}

// ---------------------------------------------------------------------------
// Operation ID generation
// ---------------------------------------------------------------------------

function generateOperationId(method: string, path: string): string {
  const segments = path
    .split('/')
    .filter(Boolean)
    .map((seg) => {
      const clean = seg.replace(/[{}]/g, '')
      return clean.charAt(0).toUpperCase() + clean.slice(1)
    })
  return method.toLowerCase() + segments.join('')
}

// ---------------------------------------------------------------------------
// Swagger 2.0 Parser
// ---------------------------------------------------------------------------

/**
 * Parser for Swagger 2.0 specifications.
 *
 * Uses `@apidevtools/swagger-parser` to dereference the spec. Schemas are
 * read from `definitions` (not `components.schemas`), body parameters become
 * `requestBody`, and `host` + `basePath` form the base URL.
 */
export const swaggerParser: SpecParser = {
  canParse(input: unknown): boolean {
    if (typeof input !== 'object' || input === null) return false
    const doc = input as Record<string, unknown>
    return doc.swagger === '2.0'
  },

  async parse(input: unknown, options?: ParseOptions): Promise<ApiSpec> {
    // Use the original file path when available so relative $ref paths resolve correctly
    const derefed = await SwaggerParser.dereference(
      (options?.filePath ?? input) as OpenAPIV2.Document,
      { dereference: { circular: 'ignore' } },
    )

    const doc = derefed as OpenAPIV2.Document
    const types = new Map<string, ApiType>()

    // Extract named schemas from definitions
    if (doc.definitions) {
      for (const [name, schema] of Object.entries(doc.definitions)) {
        if (!isRef(schema)) {
          const converted = convertSchema(schema as SchemaObject)
          if (converted.kind === 'object' && !converted.name) {
            ;(converted as ApiObjectType).name = name
          } else if (converted.kind === 'enum' && !converted.name) {
            ;(converted as ApiEnumType).name = name
          }
          types.set(name, converted)
        }
      }
    }

    // Determine base URL
    let baseUrl = options?.baseUrl ?? ''
    if (!baseUrl) {
      const scheme = doc.schemes && doc.schemes.length > 0
        ? doc.schemes[0]
        : 'https'
      const host = doc.host ?? ''
      const basePath = doc.basePath ?? ''
      if (host) {
        baseUrl = `${scheme}://${host}${basePath}`
      } else {
        baseUrl = basePath
      }
    }

    // Global produces
    const globalProduces = doc.produces ?? ['application/json']

    // Build operations from paths
    const operations: ApiOperation[] = []

    for (const [path, pathItem] of Object.entries(doc.paths)) {
      if (!pathItem) continue

      // Path-level parameters
      const pathLevelParams = (pathItem.parameters ?? [])
        .filter((p): p is OpenAPIV2.Parameter => !isRef(p))

      for (const method of HTTP_METHODS) {
        const operationObj = (pathItem as Record<string, unknown>)[method] as
          | OpenAPIV2.OperationObject
          | undefined

        if (!operationObj) continue

        // Merge path-level + operation-level parameters
        const opRawParams = (operationObj.parameters ?? [])
          .filter((p): p is OpenAPIV2.Parameter => !isRef(p))

        const mergedParams = mergeParameters(pathLevelParams, opRawParams)

        // Determine content type for this operation
        const produces = operationObj.produces ?? globalProduces

        const pathParams: ApiParam[] = []
        const queryParams: ApiParam[] = []
        const headerParams: ApiParam[] = []
        let requestBody: ApiRequestBody | undefined

        for (const param of mergedParams) {
          if (isBodyParam(param)) {
            requestBody = convertBodyParam(param, produces)
          } else {
            const generalParam = param as GeneralParameterObject
            const converted = convertGeneralParam(generalParam)
            switch (param.in) {
              case 'path':
                pathParams.push(converted)
                break
              case 'query':
                queryParams.push(converted)
                break
              case 'header':
                headerParams.push(converted)
                break
              // 'formData' params are not mapped to path/query/header
            }
          }
        }

        const response = convertResponse(operationObj.responses, produces)

        const tags = operationObj.tags && operationObj.tags.length > 0
          ? operationObj.tags
          : ['default']

        const operationId = operationObj.operationId
          ?? generateOperationId(method, path)

        operations.push({
          operationId,
          summary: operationObj.summary,
          method: method.toUpperCase() as HttpMethod,
          path,
          tags,
          pathParams,
          queryParams,
          headerParams,
          requestBody,
          response,
          deprecated: operationObj.deprecated ?? false,
        })
      }
    }

    return {
      title: doc.info?.title ?? 'Untitled API',
      baseUrl,
      version: doc.info?.version ?? '0.0.0',
      operations,
      types,
    }
  },
}

/**
 * Merges path-level and operation-level parameters. Operation-level parameters
 * with the same `name` and `in` override path-level ones.
 */
function mergeParameters(
  pathParams: OpenAPIV2.Parameter[],
  opParams: OpenAPIV2.Parameter[],
): OpenAPIV2.Parameter[] {
  const opParamKeys = new Set(opParams.map((p) => `${p.in}:${p.name}`))
  const filtered = pathParams.filter((p) => !opParamKeys.has(`${p.in}:${p.name}`))
  return [...filtered, ...opParams]
}
