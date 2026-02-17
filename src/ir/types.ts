/**
 * Intermediate Representation (IR) types.
 *
 * All parsers (OpenAPI, Swagger, GraphQL) produce this IR.
 * All generators (fetch, axios, react-query, swr) consume it.
 */

// ---------------------------------------------------------------------------
// Top-level spec
// ---------------------------------------------------------------------------

/** The complete normalized API specification. */
export interface ApiSpec {
  /** Human-readable title from the spec. */
  title: string
  /** Base URL / server URL. */
  baseUrl: string
  /** API version string. */
  version: string
  /** All operations (endpoints / queries / mutations). */
  operations: ApiOperation[]
  /** All named types referenced by operations. */
  types: Map<string, ApiType>
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'

export type OperationMethod = HttpMethod | 'QUERY' | 'MUTATION' | 'SUBSCRIPTION'

/** A single API operation (REST endpoint or GraphQL field). */
export interface ApiOperation {
  /** Unique operation ID (from spec or auto-generated). */
  operationId: string
  /** Human-readable summary. */
  summary?: string
  /** HTTP method or GraphQL operation type. */
  method: OperationMethod
  /** URL path with parameter placeholders, e.g. `/users/{id}`. */
  path: string
  /** Tags / groups for organizing generated files. */
  tags: string[]
  /** Path parameters. */
  pathParams: ApiParam[]
  /** Query string parameters. */
  queryParams: ApiParam[]
  /** Header parameters. */
  headerParams: ApiParam[]
  /** Request body schema (if any). */
  requestBody?: ApiRequestBody
  /** Response schema (success case). */
  response: ApiResponse
  /** Whether this is a paginated endpoint. */
  pagination?: PaginationInfo
  /** Whether this operation is deprecated. */
  deprecated: boolean
}

// ---------------------------------------------------------------------------
// Parameters & Bodies
// ---------------------------------------------------------------------------

export interface ApiParam {
  name: string
  required: boolean
  type: ApiType
  description?: string
  in: 'path' | 'query' | 'header'
}

export interface ApiRequestBody {
  required: boolean
  contentType: string
  type: ApiType
  description?: string
}

export interface ApiResponse {
  statusCode: number | 'default'
  contentType: string
  type: ApiType
  description?: string
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export type PaginationStrategy = 'cursor' | 'offset-limit' | 'page-number'

export interface PaginationInfo {
  /** Strategy detected. */
  strategy: PaginationStrategy
  /** The query param name for the cursor / offset / page. */
  pageParam: string
  /** Dot-path in the response to find the next page value. */
  nextPagePath: string[]
  /** Dot-path in the response to find the items array. */
  itemsPath: string[]
}

// ---------------------------------------------------------------------------
// Type system
// ---------------------------------------------------------------------------

/**
 * Recursive type representation — a unified schema type system
 * that covers JSON Schema and GraphQL types.
 */
export type ApiType =
  | ApiPrimitiveType
  | ApiObjectType
  | ApiArrayType
  | ApiEnumType
  | ApiUnionType
  | ApiRefType

export interface ApiPrimitiveType {
  kind: 'primitive'
  type: 'string' | 'number' | 'integer' | 'boolean' | 'null' | 'unknown'
  /** e.g. 'date-time', 'email', 'uuid', 'int64', 'uri' */
  format?: string
  description?: string
}

export interface ApiObjectType {
  kind: 'object'
  name?: string
  properties: ApiProperty[]
  additionalProperties?: ApiType | boolean
  description?: string
}

export interface ApiProperty {
  name: string
  type: ApiType
  required: boolean
  description?: string
}

export interface ApiArrayType {
  kind: 'array'
  items: ApiType
  description?: string
}

export interface ApiEnumType {
  kind: 'enum'
  name?: string
  values: (string | number)[]
  description?: string
}

export interface ApiUnionType {
  kind: 'union'
  variants: ApiType[]
  description?: string
}

export interface ApiRefType {
  kind: 'ref'
  /** Reference to a named type in ApiSpec.types. */
  name: string
}
