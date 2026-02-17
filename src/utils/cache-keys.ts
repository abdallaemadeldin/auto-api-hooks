/**
 * Smart cache key derivation for React Query and SWR.
 */
import type { ApiOperation } from '../ir/types'
import { extractResource, toCamelCase, isDetailEndpoint, toPascalCase } from './naming'

/**
 * Represents a cache key factory for a resource group.
 *
 * Example output for "users" resource:
 * ```ts
 * export const userKeys = {
 *   all: ['users'] as const,
 *   lists: () => [...userKeys.all, 'list'] as const,
 *   list: (params?: ListUsersParams) => [...userKeys.lists(), params] as const,
 *   details: () => [...userKeys.all, 'detail'] as const,
 *   detail: (id: string) => [...userKeys.details(), id] as const,
 * }
 * ```
 */
export interface CacheKeyFactory {
  /** Resource name (e.g. 'user') */
  resource: string
  /** Variable name (e.g. 'userKeys') */
  variableName: string
  /** Root key segments (e.g. ['users']) */
  rootKey: string[]
  /** Whether this resource has list operations */
  hasList: boolean
  /** Whether this resource has detail operations */
  hasDetail: boolean
}

/**
 * Derive cache key factories from a group of operations.
 */
export function deriveCacheKeyFactories(
  operations: ApiOperation[],
): CacheKeyFactory[] {
  // Group by primary resource
  const resourceMap = new Map<string, { hasList: boolean; hasDetail: boolean }>()

  for (const op of operations) {
    if (op.method !== 'GET' && op.method !== 'QUERY') continue

    const resource = extractResource(op.path)
    const existing = resourceMap.get(resource) || { hasList: false, hasDetail: false }

    if (isDetailEndpoint(op.path)) {
      existing.hasDetail = true
    } else {
      existing.hasList = true
    }

    resourceMap.set(resource, existing)
  }

  const factories: CacheKeyFactory[] = []

  for (const [resource, info] of resourceMap) {
    const singular = toCamelCase(resource)
    factories.push({
      resource: singular,
      variableName: `${singular}Keys`,
      rootKey: [resource],
      hasList: info.hasList,
      hasDetail: info.hasDetail,
    })
  }

  return factories
}

/**
 * Get the cache key expression for a specific operation.
 * Returns the key factory call expression as a string.
 */
export function getCacheKeyForOperation(op: ApiOperation): string {
  const resource = extractResource(op.path)
  const singular = toCamelCase(resource)
  const keysVar = `${singular}Keys`

  if (isDetailEndpoint(op.path)) {
    // Detail endpoint — extract path param
    const pathParam = op.pathParams[op.pathParams.length - 1]
    if (pathParam) {
      return `${keysVar}.detail(${pathParam.name})`
    }
    return `${keysVar}.details()`
  }

  // List endpoint
  if (op.queryParams.length > 0) {
    return `${keysVar}.list(params)`
  }
  return `${keysVar}.lists()`
}

/**
 * Generate a SWR-style string cache key from an operation.
 */
export function getSwrKey(op: ApiOperation): string {
  const pathParams = op.pathParams.map((p) => p.name)
  let key = op.path

  // Replace {param} with template literal expressions
  for (const param of pathParams) {
    key = key.replace(`{${param}}`, `\${${param}}`)
  }

  if (op.queryParams.length > 0) {
    return `\`${key}?\${new URLSearchParams(params as Record<string, string>).toString()}\``
  }

  if (pathParams.length > 0) {
    return `\`${key}\``
  }

  return `'${op.path}'`
}

/**
 * Get the React Query query key for an operation (as code string).
 */
export function getQueryKey(op: ApiOperation): string {
  const resource = extractResource(op.path)
  const parts: string[] = [`'${resource}'`]

  if (isDetailEndpoint(op.path)) {
    parts.push(`'detail'`)
    for (const p of op.pathParams) {
      parts.push(p.name)
    }
  } else {
    parts.push(`'list'`)
    if (op.queryParams.length > 0) {
      parts.push('params')
    }
  }

  return `[${parts.join(', ')}] as const`
}

/**
 * Get the resource name for a query key factory variable.
 */
export function getKeyFactoryName(tag: string): string {
  return `${toCamelCase(tag)}Keys`
}

/**
 * Get the params type name for a specific operation.
 */
export function getParamsTypeName(operationId: string): string {
  return `${toPascalCase(operationId)}Params`
}
