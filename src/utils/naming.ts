/**
 * Naming conventions for generated hooks, types, and files.
 */

/**
 * Simple pluralization rules (good enough for API resource names).
 */
const IRREGULAR_PLURALS: Record<string, string> = {
  person: 'people',
  child: 'children',
  man: 'men',
  woman: 'women',
  mouse: 'mice',
  goose: 'geese',
  tooth: 'teeth',
  foot: 'feet',
  datum: 'data',
  medium: 'media',
  criterion: 'criteria',
  analysis: 'analyses',
  status: 'statuses',
}

const IRREGULAR_SINGULARS: Record<string, string> = Object.fromEntries(
  Object.entries(IRREGULAR_PLURALS).map(([s, p]) => [p, s]),
)

/**
 * Attempt to singularize a word.
 */
export function singularize(word: string): string {
  const lower = word.toLowerCase()
  if (IRREGULAR_SINGULARS[lower]) {
    return preserveCase(word, IRREGULAR_SINGULARS[lower])
  }
  if (lower.endsWith('ies') && lower.length > 4) {
    return word.slice(0, -3) + 'y'
  }
  if (lower.endsWith('ses') || lower.endsWith('xes') || lower.endsWith('zes') || lower.endsWith('ches') || lower.endsWith('shes')) {
    return word.slice(0, -2)
  }
  if (lower.endsWith('s') && !lower.endsWith('ss') && !lower.endsWith('us') && lower.length > 2) {
    return word.slice(0, -1)
  }
  return word
}

function preserveCase(original: string, replacement: string): string {
  if (original[0] === original[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1)
  }
  return replacement
}

/**
 * Convert a string to PascalCase.
 */
export function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, char: string) => char.toUpperCase())
    .replace(/^[a-z]/, (char) => char.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '')
}

/**
 * Convert a string to camelCase.
 */
export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str)
  return pascal[0].toLowerCase() + pascal.slice(1)
}

/**
 * Extract the primary resource name from a URL path.
 * `/api/v1/users/{id}/posts` → 'posts'
 * `/users` → 'users'
 * `/users/{id}` → 'users'
 */
export function extractResource(path: string): string {
  const segments = path.split('/').filter((s) => s && !s.startsWith('{'))
  // Skip common prefixes like 'api', 'v1', 'v2', etc.
  const meaningful = segments.filter((s) => !/^(api|v\d+)$/i.test(s))
  return meaningful[meaningful.length - 1] || segments[segments.length - 1] || 'unknown'
}

/**
 * Determine if a path is a detail (single resource) endpoint.
 * `/users/{id}` → true
 * `/users` → false
 * `/users/{id}/posts/{postId}` → true
 */
export function isDetailEndpoint(path: string): boolean {
  const segments = path.split('/').filter(Boolean)
  const last = segments[segments.length - 1]
  return !!last && last.startsWith('{')
}

/**
 * Generate a hook name from an operation.
 *
 * Priority:
 *  1. If operationId is provided → `use` + PascalCase(operationId)
 *  2. Otherwise derive from method + path
 */
export function getHookName(
  operationId: string | undefined,
  method: string,
  path: string,
): string {
  if (operationId) {
    const name = toPascalCase(operationId)
    return `use${name}`
  }

  const resource = extractResource(path)
  const isDetail = isDetailEndpoint(path)
  const resourceName = isDetail ? singularize(resource) : resource

  const methodMap: Record<string, string> = {
    GET: isDetail ? 'Get' : 'Get',
    POST: 'Create',
    PUT: 'Update',
    PATCH: 'Patch',
    DELETE: 'Delete',
    QUERY: 'Get',
    MUTATION: '',
    SUBSCRIPTION: 'Subscribe',
  }

  const prefix = methodMap[method.toUpperCase()] || method
  return `use${prefix}${toPascalCase(resourceName)}`
}

/**
 * Generate a TypeScript interface name from a type name.
 */
export function getTypeName(name: string): string {
  return toPascalCase(name)
}

/**
 * Generate a file-safe name from a string (kebab-case).
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

/**
 * Generate a unique name by appending a suffix if needed.
 */
export function uniqueName(name: string, existing: Set<string>): string {
  if (!existing.has(name)) {
    existing.add(name)
    return name
  }
  let i = 2
  while (existing.has(`${name}${i}`)) {
    i++
  }
  const unique = `${name}${i}`
  existing.add(unique)
  return unique
}
