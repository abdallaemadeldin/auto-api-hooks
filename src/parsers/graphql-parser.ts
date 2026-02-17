import {
  buildClientSchema,
  buildSchema,
  isEnumType,
  isInputObjectType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
  isUnionType,
} from 'graphql'
import type {
  GraphQLSchema,
  GraphQLType,
  GraphQLArgument,
  GraphQLObjectType,
  GraphQLInputObjectType,
  IntrospectionQuery,
} from 'graphql'
import type {
  ApiSpec,
  ApiOperation,
  ApiParam,
  ApiRequestBody,
  ApiResponse,
  ApiType,
  ApiProperty,
  OperationMethod,
} from '../ir/types'
import type { SpecParser, ParseOptions } from './types'

// ---------------------------------------------------------------------------
// Introspection type guard
// ---------------------------------------------------------------------------

interface IntrospectionResult {
  __schema: IntrospectionQuery['__schema']
}

interface IntrospectionWrapper {
  data: IntrospectionResult
}

function isIntrospectionResult(input: unknown): input is IntrospectionResult {
  return typeof input === 'object' && input !== null && '__schema' in input
}

function isIntrospectionWrapper(input: unknown): input is IntrospectionWrapper {
  return (
    typeof input === 'object' &&
    input !== null &&
    'data' in input &&
    typeof (input as IntrospectionWrapper).data === 'object' &&
    (input as IntrospectionWrapper).data !== null &&
    '__schema' in (input as IntrospectionWrapper).data
  )
}

// ---------------------------------------------------------------------------
// SDL detection
// ---------------------------------------------------------------------------

const SDL_KEYWORDS = /^\s*(type |schema |input |enum |union |interface |scalar |directive |extend )/

function isSDLString(input: unknown): input is string {
  return typeof input === 'string' && SDL_KEYWORDS.test(input)
}

// ---------------------------------------------------------------------------
// Scalar type mapping
// ---------------------------------------------------------------------------

/**
 * Maps a GraphQL scalar type name to the IR primitive type.
 */
function mapScalarType(
  name: string,
): { type: 'string' | 'number' | 'integer' | 'boolean' | 'unknown'; format?: string } {
  switch (name) {
    case 'String':
      return { type: 'string' }
    case 'Int':
      return { type: 'number', format: 'int32' }
    case 'Float':
      return { type: 'number', format: 'float' }
    case 'Boolean':
      return { type: 'boolean' }
    case 'ID':
      return { type: 'string', format: 'id' }
    case 'DateTime':
      return { type: 'string', format: 'date-time' }
    case 'Date':
      return { type: 'string', format: 'date' }
    case 'JSON':
    case 'JSONObject':
      return { type: 'unknown' }
    default:
      return { type: 'string' }
  }
}

// ---------------------------------------------------------------------------
// GraphQL type -> ApiType conversion
// ---------------------------------------------------------------------------

/**
 * Set to track visited types and avoid infinite recursion with circular references.
 */
const visitedTypes = new Set<string>()

/**
 * Converts a GraphQL type to the IR `ApiType`. Unwraps NonNull and List wrappers.
 * Returns `{ type, required }` where `required` is `true` when the outermost
 * wrapper is `GraphQLNonNull`.
 */
function convertGraphQLType(
  graphqlType: GraphQLType,
): { type: ApiType; required: boolean } {
  let required = false

  // Unwrap NonNull
  let unwrapped = graphqlType
  if (isNonNullType(unwrapped)) {
    required = true
    unwrapped = unwrapped.ofType
  }

  const apiType = convertInnerType(unwrapped)
  return { type: apiType, required }
}

/**
 * Converts the inner (non-null-unwrapped) GraphQL type to ApiType.
 */
function convertInnerType(graphqlType: GraphQLType): ApiType {
  // List
  if (isListType(graphqlType)) {
    const inner = isNonNullType(graphqlType.ofType)
      ? convertInnerType(graphqlType.ofType.ofType)
      : convertInnerType(graphqlType.ofType)
    return { kind: 'array', items: inner }
  }

  // Scalar
  if (isScalarType(graphqlType)) {
    const mapped = mapScalarType(graphqlType.name)
    return {
      kind: 'primitive',
      type: mapped.type,
      format: mapped.format,
      description: graphqlType.description ?? undefined,
    }
  }

  // Enum
  if (isEnumType(graphqlType)) {
    return {
      kind: 'enum',
      name: graphqlType.name,
      values: graphqlType.getValues().map((v) => v.value as string),
      description: graphqlType.description ?? undefined,
    }
  }

  // Union
  if (isUnionType(graphqlType)) {
    const variants = graphqlType.getTypes().map((t) => convertInnerType(t))
    return {
      kind: 'union',
      variants,
      description: graphqlType.description ?? undefined,
    }
  }

  // Object
  if (isObjectType(graphqlType)) {
    return convertObjectType(graphqlType)
  }

  // InputObject
  if (isInputObjectType(graphqlType)) {
    return convertInputObjectType(graphqlType)
  }

  return { kind: 'primitive', type: 'unknown' }
}

/**
 * Converts a `GraphQLObjectType` to an `ApiObjectType`.
 */
function convertObjectType(objType: GraphQLObjectType): ApiType {
  const name = objType.name

  // Guard against infinite recursion
  if (visitedTypes.has(name)) {
    return { kind: 'ref', name }
  }
  visitedTypes.add(name)

  try {
    const fields = objType.getFields()
    const properties: ApiProperty[] = []

    for (const [fieldName, field] of Object.entries(fields)) {
      const { type, required } = convertGraphQLType(field.type)
      properties.push({
        name: fieldName,
        type,
        required,
        description: field.description ?? undefined,
      })
    }

    return {
      kind: 'object',
      name,
      properties,
      description: objType.description ?? undefined,
    }
  } finally {
    visitedTypes.delete(name)
  }
}

/**
 * Converts a `GraphQLInputObjectType` to an `ApiObjectType`.
 */
function convertInputObjectType(inputType: GraphQLInputObjectType): ApiType {
  const name = inputType.name

  if (visitedTypes.has(name)) {
    return { kind: 'ref', name }
  }
  visitedTypes.add(name)

  try {
    const fields = inputType.getFields()
    const properties: ApiProperty[] = []

    for (const [fieldName, field] of Object.entries(fields)) {
      const { type, required } = convertGraphQLType(field.type)
      properties.push({
        name: fieldName,
        type,
        required,
        description: field.description ?? undefined,
      })
    }

    return {
      kind: 'object',
      name,
      properties,
      description: inputType.description ?? undefined,
    }
  } finally {
    visitedTypes.delete(name)
  }
}

// ---------------------------------------------------------------------------
// Argument -> ApiParam conversion
// ---------------------------------------------------------------------------

function convertArgument(arg: GraphQLArgument): ApiParam {
  const { type, required } = convertGraphQLType(arg.type)
  return {
    name: arg.name,
    required,
    type,
    description: arg.description ?? undefined,
    in: 'query', // GraphQL args are conceptually similar to query params
  }
}

// ---------------------------------------------------------------------------
// Build operations from schema root types
// ---------------------------------------------------------------------------

function buildOperationsFromType(
  rootType: GraphQLObjectType | undefined | null,
  method: OperationMethod,
  tag: string,
): ApiOperation[] {
  if (!rootType) return []

  const fields = rootType.getFields()
  const operations: ApiOperation[] = []

  for (const [fieldName, field] of Object.entries(fields)) {
    const args = field.args ?? []
    const queryParams = args.map(convertArgument)

    // Build request body from arguments if there are any
    let requestBody: ApiRequestBody | undefined
    if (args.length > 0) {
      const argProperties: ApiProperty[] = args.map((arg) => {
        const { type, required } = convertGraphQLType(arg.type)
        return {
          name: arg.name,
          type,
          required,
          description: arg.description ?? undefined,
        }
      })

      requestBody = {
        required: args.some((arg) => isNonNullType(arg.type)),
        contentType: 'application/json',
        type: {
          kind: 'object',
          properties: argProperties,
        },
      }
    }

    // Convert return type
    const { type: responseType } = convertGraphQLType(field.type)

    const response: ApiResponse = {
      statusCode: 200,
      contentType: 'application/json',
      type: responseType,
      description: field.description ?? undefined,
    }

    operations.push({
      operationId: fieldName,
      summary: field.description ?? undefined,
      method,
      path: fieldName,
      tags: [tag],
      pathParams: [],
      queryParams,
      headerParams: [],
      requestBody,
      response,
      deprecated: field.deprecationReason != null,
    })
  }

  return operations
}

// ---------------------------------------------------------------------------
// Extract named types
// ---------------------------------------------------------------------------

function extractNamedTypes(schema: GraphQLSchema): Map<string, ApiType> {
  const types = new Map<string, ApiType>()
  const typeMap = schema.getTypeMap()

  for (const [name, graphqlType] of Object.entries(typeMap)) {
    // Skip introspection types
    if (name.startsWith('__')) continue

    // Skip built-in scalars
    if (isScalarType(graphqlType)) {
      const builtins = new Set(['String', 'Int', 'Float', 'Boolean', 'ID'])
      if (builtins.has(name)) continue
    }

    if (isObjectType(graphqlType)) {
      // Skip root types
      const queryType = schema.getQueryType()
      const mutationType = schema.getMutationType()
      const subscriptionType = schema.getSubscriptionType()
      if (
        graphqlType === queryType ||
        graphqlType === mutationType ||
        graphqlType === subscriptionType
      ) {
        continue
      }
      types.set(name, convertObjectType(graphqlType))
    } else if (isInputObjectType(graphqlType)) {
      types.set(name, convertInputObjectType(graphqlType))
    } else if (isEnumType(graphqlType)) {
      types.set(name, {
        kind: 'enum',
        name,
        values: graphqlType.getValues().map((v) => v.value as string),
        description: graphqlType.description ?? undefined,
      })
    } else if (isUnionType(graphqlType)) {
      types.set(name, {
        kind: 'union',
        variants: graphqlType.getTypes().map((t) => convertInnerType(t)),
        description: graphqlType.description ?? undefined,
      })
    }
  }

  return types
}

// ---------------------------------------------------------------------------
// GraphQL Parser
// ---------------------------------------------------------------------------

/**
 * Parser for GraphQL schemas.
 *
 * Accepts either:
 * - An introspection JSON result (has `__schema` or `data.__schema`)
 * - An SDL string (starts with `type `, `schema `, `input `, etc.)
 *
 * Uses the `graphql` package to build a schema, then maps Query fields
 * to `QUERY` operations, Mutation fields to `MUTATION` operations, and
 * Subscription fields to `SUBSCRIPTION` operations.
 */
export const graphqlParser: SpecParser = {
  canParse(input: unknown): boolean {
    if (isIntrospectionResult(input)) return true
    if (isIntrospectionWrapper(input)) return true
    if (isSDLString(input)) return true
    return false
  },

  async parse(input: unknown, options?: ParseOptions): Promise<ApiSpec> {
    let schema: GraphQLSchema

    if (isIntrospectionWrapper(input)) {
      schema = buildClientSchema(input.data as unknown as IntrospectionQuery)
    } else if (isIntrospectionResult(input)) {
      schema = buildClientSchema(input as unknown as IntrospectionQuery)
    } else if (typeof input === 'string') {
      schema = buildSchema(input)
    } else {
      throw new Error('GraphQL parser: unsupported input format')
    }

    // Clear the recursion guard between parse calls
    visitedTypes.clear()

    const operations: ApiOperation[] = [
      ...buildOperationsFromType(schema.getQueryType(), 'QUERY', 'queries'),
      ...buildOperationsFromType(schema.getMutationType(), 'MUTATION', 'mutations'),
      ...buildOperationsFromType(schema.getSubscriptionType(), 'SUBSCRIPTION', 'subscriptions'),
    ]

    const types = extractNamedTypes(schema)

    // Clear again after use
    visitedTypes.clear()

    return {
      title: 'GraphQL API',
      baseUrl: options?.baseUrl ?? '/graphql',
      version: '0.0.0',
      operations,
      types,
    }
  },
}
