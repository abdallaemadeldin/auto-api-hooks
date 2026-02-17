import SwaggerParser from '@apidevtools/swagger-parser'
import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'
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
// Type guards
// ---------------------------------------------------------------------------

type SchemaObject = OpenAPIV3.SchemaObject | OpenAPIV3_1.SchemaObject
type ReferenceObject = OpenAPIV3.ReferenceObject | OpenAPIV3_1.ReferenceObject
type ParameterObject = OpenAPIV3.ParameterObject
type RequestBodyObject = OpenAPIV3.RequestBodyObject
type ResponseObject = OpenAPIV3.ResponseObject
type MediaTypeObject = OpenAPIV3.MediaTypeObject

function isRef(obj: unknown): obj is ReferenceObject {
  return typeof obj === 'object' && obj !== null && '$ref' in obj
}

// ---------------------------------------------------------------------------
// HTTP method mapping
// ---------------------------------------------------------------------------

const HTTP_METHODS: ReadonlySet<string> = new Set([
  'get', 'post', 'put', 'delete', 'patch', 'head', 'options',
])

// ---------------------------------------------------------------------------
// JSON Schema -> ApiType conversion
// ---------------------------------------------------------------------------

/**
 * Recursively converts a JSON Schema (OpenAPI 3.x) object into the IR `ApiType`.
 * After dereferencing, `$ref` values are inlined as objects.
 */
function convertSchema(schema: SchemaObject | undefined): ApiType {
  if (!schema) {
    return { kind: 'primitive', type: 'unknown' }
  }

  // Handle oneOf / anyOf -> union
  if (schema.oneOf && schema.oneOf.length > 0) {
    const variants = schema.oneOf
      .filter((s): s is SchemaObject => !isRef(s))
      .map((s) => convertSchema(s))
    return { kind: 'union', variants, description: schema.description } satisfies ApiUnionType
  }
  if (schema.anyOf && schema.anyOf.length > 0) {
    const variants = schema.anyOf
      .filter((s): s is SchemaObject => !isRef(s))
      .map((s) => convertSchema(s))
    return { kind: 'union', variants, description: schema.description } satisfies ApiUnionType
  }

  // Handle allOf -> merge into single object
  if (schema.allOf && schema.allOf.length > 0) {
    const merged = mergeAllOf(schema.allOf.filter((s): s is SchemaObject => !isRef(s)))
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

  // Handle array
  if (schema.type === 'array') {
    const arraySchema = schema as OpenAPIV3.ArraySchemaObject
    const items = isRef(arraySchema.items)
      ? ({ kind: 'primitive', type: 'unknown' } as ApiType)
      : convertSchema(arraySchema.items as SchemaObject)
    return { kind: 'array', items, description: schema.description } satisfies ApiArrayType
  }

  // Handle object (explicit or has properties)
  if (schema.type === 'object' || schema.properties || (!schema.type && hasObjectShape(schema))) {
    return convertObjectSchema(schema)
  }

  // Handle primitives
  if (schema.type === 'string' || schema.type === 'number' || schema.type === 'integer' || schema.type === 'boolean') {
    const result: ApiPrimitiveType = {
      kind: 'primitive',
      type: schema.type,
      description: schema.description,
    }
    if (schema.format) {
      result.format = schema.format
    }
    return result
  }

  // Nullable shorthand in OpenAPI 3.0
  if ((schema as OpenAPIV3.SchemaObject).nullable && schema.type) {
    const inner = convertSchema({ ...schema, nullable: undefined } as SchemaObject)
    return {
      kind: 'union',
      variants: [inner, { kind: 'primitive', type: 'null' }],
      description: schema.description,
    } satisfies ApiUnionType
  }

  return { kind: 'primitive', type: 'unknown', description: schema.description }
}

/**
 * Checks whether a schema object has properties that suggest it's an object type.
 */
function hasObjectShape(schema: SchemaObject): boolean {
  return !!(schema.properties || schema.additionalProperties)
}

/**
 * Converts an object-type JSON Schema into an `ApiObjectType`.
 */
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

/**
 * Merges multiple schemas from an `allOf` composition into a single schema.
 */
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
// Parameter conversion
// ---------------------------------------------------------------------------

function convertParameter(param: ParameterObject): ApiParam {
  const schema = param.schema && !isRef(param.schema)
    ? (param.schema as SchemaObject)
    : undefined

  return {
    name: param.name,
    required: param.required ?? (param.in === 'path'),
    type: convertSchema(schema),
    description: param.description,
    in: param.in as 'path' | 'query' | 'header',
  }
}

// ---------------------------------------------------------------------------
// Request body conversion
// ---------------------------------------------------------------------------

function convertRequestBody(body: RequestBodyObject): ApiRequestBody | undefined {
  const jsonContent = body.content['application/json'] ?? body.content['*/*']
  if (!jsonContent) {
    // Try to find any content type
    const firstKey = Object.keys(body.content)[0]
    if (!firstKey) return undefined
    const mediaType = body.content[firstKey]
    return convertMediaTypeToBody(mediaType, firstKey, body)
  }

  return convertMediaTypeToBody(jsonContent, 'application/json', body)
}

function convertMediaTypeToBody(
  media: MediaTypeObject,
  contentType: string,
  body: RequestBodyObject,
): ApiRequestBody {
  const schema = media.schema && !isRef(media.schema)
    ? (media.schema as SchemaObject)
    : undefined

  return {
    required: body.required ?? false,
    contentType,
    type: convertSchema(schema),
    description: body.description,
  }
}

// ---------------------------------------------------------------------------
// Response conversion
// ---------------------------------------------------------------------------

/**
 * Finds the success response (200, 201, or first 2xx) from the responses object.
 */
function convertResponse(
  responses: Record<string, ResponseObject | ReferenceObject>,
): ApiResponse {
  // Priority order: 200, 201, first 2xx, default
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
    // Look for first 2xx
    for (const [code, value] of Object.entries(responses)) {
      if (code.startsWith('2') && !isRef(value)) {
        responseObj = value as ResponseObject
        statusCode = parseInt(code, 10)
        break
      }
    }
  }

  if (!responseObj) {
    // Fallback to default
    const defaultResp = responses['default']
    if (defaultResp && !isRef(defaultResp)) {
      responseObj = defaultResp as ResponseObject
      statusCode = 'default'
    }
  }

  if (!responseObj) {
    return {
      statusCode: 200,
      contentType: 'application/json',
      type: { kind: 'primitive', type: 'unknown' },
    }
  }

  const content = responseObj.content
  if (!content) {
    return {
      statusCode,
      contentType: 'application/json',
      type: { kind: 'primitive', type: 'unknown' },
      description: responseObj.description,
    }
  }

  const jsonMedia = content['application/json'] ?? content['*/*']
  if (jsonMedia) {
    const schema = jsonMedia.schema && !isRef(jsonMedia.schema)
      ? (jsonMedia.schema as SchemaObject)
      : undefined

    return {
      statusCode,
      contentType: 'application/json',
      type: convertSchema(schema),
      description: responseObj.description,
    }
  }

  // Fallback to first content type
  const firstKey = Object.keys(content)[0]
  if (firstKey) {
    const media = content[firstKey]
    const schema = media.schema && !isRef(media.schema)
      ? (media.schema as SchemaObject)
      : undefined

    return {
      statusCode,
      contentType: firstKey,
      type: convertSchema(schema),
      description: responseObj.description,
    }
  }

  return {
    statusCode,
    contentType: 'application/json',
    type: { kind: 'primitive', type: 'unknown' },
    description: responseObj.description,
  }
}

// ---------------------------------------------------------------------------
// Operation ID generation
// ---------------------------------------------------------------------------

/**
 * Generates an operationId from the HTTP method and path when one is not
 * provided by the spec.
 *
 * @example generateOperationId('get', '/users/{id}/posts') => 'getUsersIdPosts'
 */
function generateOperationId(method: string, path: string): string {
  const segments = path
    .split('/')
    .filter(Boolean)
    .map((seg) => {
      // Remove curly braces from path params
      const clean = seg.replace(/[{}]/g, '')
      return clean.charAt(0).toUpperCase() + clean.slice(1)
    })

  return method.toLowerCase() + segments.join('')
}

// ---------------------------------------------------------------------------
// OpenAPI 3.x Parser
// ---------------------------------------------------------------------------

/**
 * Parser for OpenAPI 3.x specifications.
 *
 * Uses `@apidevtools/swagger-parser` to dereference the spec, then walks
 * the `paths` object to build the IR `ApiOperation[]`. Named schemas from
 * `components.schemas` are extracted into `ApiSpec.types`.
 */
export const openApiParser: SpecParser = {
  canParse(input: unknown): boolean {
    if (typeof input !== 'object' || input === null) return false
    const doc = input as Record<string, unknown>
    return typeof doc.openapi === 'string' && doc.openapi.startsWith('3')
  },

  async parse(input: unknown, options?: ParseOptions): Promise<ApiSpec> {
    // Dereference the spec to inline all $ref pointers
    // Use the original file path when available so relative $ref paths resolve correctly
    const derefed = await SwaggerParser.dereference(
      (options?.filePath ?? input) as OpenAPIV3.Document,
      { dereference: { circular: 'ignore' } },
    )

    const doc = derefed as OpenAPIV3.Document
    const types = new Map<string, ApiType>()

    // Extract named schemas from components.schemas
    if (doc.components?.schemas) {
      for (const [name, schema] of Object.entries(doc.components.schemas)) {
        if (!isRef(schema)) {
          const converted = convertSchema(schema as SchemaObject)
          // Attach the schema name if it's an object or enum type
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
    const baseUrl = options?.baseUrl
      ?? (doc.servers && doc.servers.length > 0 ? doc.servers[0].url : '')

    // Build operations from paths
    const operations: ApiOperation[] = []

    if (doc.paths) {
      for (const [path, pathItem] of Object.entries(doc.paths)) {
        if (!pathItem) continue

        // Gather path-level parameters
        const pathLevelParams: ParameterObject[] = (pathItem.parameters ?? [])
          .filter((p): p is ParameterObject => !isRef(p))

        for (const method of HTTP_METHODS) {
          const operationObj = (pathItem as Record<string, unknown>)[method] as
            | OpenAPIV3.OperationObject
            | undefined

          if (!operationObj) continue

          // Merge path-level + operation-level parameters (operation overrides)
          const opParams: ParameterObject[] = (operationObj.parameters ?? [])
            .filter((p): p is ParameterObject => !isRef(p))

          const mergedParams = mergeParameters(pathLevelParams, opParams)

          const pathParams: ApiParam[] = []
          const queryParams: ApiParam[] = []
          const headerParams: ApiParam[] = []

          for (const param of mergedParams) {
            const converted = convertParameter(param)
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
            }
          }

          // Request body
          let requestBody: ApiRequestBody | undefined
          if (operationObj.requestBody && !isRef(operationObj.requestBody)) {
            requestBody = convertRequestBody(operationObj.requestBody as RequestBodyObject)
          }

          // Response
          const response = convertResponse(
            operationObj.responses as Record<string, ResponseObject | ReferenceObject>,
          )

          // Tags
          const tags = operationObj.tags && operationObj.tags.length > 0
            ? operationObj.tags
            : ['default']

          // Operation ID
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
 * with the same `name` and `in` override path-level parameters.
 */
function mergeParameters(
  pathParams: ParameterObject[],
  opParams: ParameterObject[],
): ParameterObject[] {
  const opParamKeys = new Set(opParams.map((p) => `${p.in}:${p.name}`))
  const filtered = pathParams.filter((p) => !opParamKeys.has(`${p.in}:${p.name}`))
  return [...filtered, ...opParams]
}
