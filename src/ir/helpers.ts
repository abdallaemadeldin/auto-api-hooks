import type {
  ApiOperation,
  ApiSpec,
  ApiType,
  ApiObjectType,
  PaginationInfo,
  PaginationStrategy,
} from './types'

// ---------------------------------------------------------------------------
// Cursor-based pagination indicators
// ---------------------------------------------------------------------------

const CURSOR_PARAM_NAMES = new Set([
  'cursor',
  'after',
  'before',
  'page_token',
  'pageToken',
  'next_token',
  'nextToken',
  'starting_after',
  'startingAfter',
  'ending_before',
  'endingBefore',
])

// ---------------------------------------------------------------------------
// Offset/limit pagination indicators
// ---------------------------------------------------------------------------

const OFFSET_PARAM_NAMES = new Set([
  'offset',
  'skip',
])

const LIMIT_PARAM_NAMES = new Set([
  'limit',
  'count',
  'size',
  'per_page',
  'perPage',
  'page_size',
  'pageSize',
])

// ---------------------------------------------------------------------------
// Page-number pagination indicators
// ---------------------------------------------------------------------------

const PAGE_NUMBER_PARAM_NAMES = new Set([
  'page',
  'page_number',
  'pageNumber',
  'p',
])

// ---------------------------------------------------------------------------
// Response field indicators for cursor-based pagination
// ---------------------------------------------------------------------------

const CURSOR_RESPONSE_FIELDS = new Set([
  'next_cursor',
  'nextCursor',
  'cursor',
  'next_page_token',
  'nextPageToken',
  'next_token',
  'nextToken',
  'endCursor',
  'end_cursor',
  'has_more',
  'hasMore',
])

// ---------------------------------------------------------------------------
// Response field indicators for items
// ---------------------------------------------------------------------------

const ITEMS_FIELDS = new Set([
  'items',
  'data',
  'results',
  'records',
  'edges',
  'nodes',
  'entries',
  'list',
  'rows',
  'content',
  'hits',
])

/**
 * Attempts to find an array property in an object type that likely represents
 * the list of items in a paginated response.
 */
function findItemsPath(type: ApiType): string[] | undefined {
  if (type.kind !== 'object') return undefined
  for (const prop of type.properties) {
    if (ITEMS_FIELDS.has(prop.name) && prop.type.kind === 'array') {
      return [prop.name]
    }
  }
  // Fallback: if the response itself is an array, items are at root
  return undefined
}

/**
 * Attempts to find a cursor/next-page field in an object response type.
 * Returns the dot-path to the next-page value.
 */
function findNextPagePath(type: ApiType): string[] | undefined {
  if (type.kind !== 'object') return undefined
  for (const prop of type.properties) {
    if (CURSOR_RESPONSE_FIELDS.has(prop.name)) {
      return [prop.name]
    }
    // Check nested "pagination" or "meta" objects
    if (
      (prop.name === 'pagination' || prop.name === 'meta' || prop.name === 'page_info' || prop.name === 'pageInfo') &&
      prop.type.kind === 'object'
    ) {
      for (const nested of (prop.type as ApiObjectType).properties) {
        if (CURSOR_RESPONSE_FIELDS.has(nested.name)) {
          return [prop.name, nested.name]
        }
      }
    }
  }
  return undefined
}

/**
 * Attempts to find total-count or total-pages fields in a response that
 * would confirm page-number pagination.
 */
function findPageCountPath(type: ApiType): string[] | undefined {
  if (type.kind !== 'object') return undefined

  const PAGE_COUNT_FIELDS = new Set([
    'total_pages', 'totalPages', 'total_count', 'totalCount',
    'total', 'page_count', 'pageCount', 'last_page', 'lastPage',
  ])

  for (const prop of type.properties) {
    if (PAGE_COUNT_FIELDS.has(prop.name)) {
      return [prop.name]
    }
    if (
      (prop.name === 'pagination' || prop.name === 'meta') &&
      prop.type.kind === 'object'
    ) {
      for (const nested of (prop.type as ApiObjectType).properties) {
        if (PAGE_COUNT_FIELDS.has(nested.name)) {
          return [prop.name, nested.name]
        }
      }
    }
  }
  return undefined
}

/**
 * Detects whether an API operation uses pagination based on heuristic
 * analysis of its query parameters and response shape.
 *
 * @param op - The API operation to analyze.
 * @returns Pagination info if detected, or `undefined` if the operation does not appear paginated.
 */
export function detectPagination(op: ApiOperation): PaginationInfo | undefined {
  const queryParamNames = new Set(op.queryParams.map((p) => p.name))
  const responseType = op.response.type

  // --- Strategy 1: Cursor-based pagination ---
  for (const name of CURSOR_PARAM_NAMES) {
    if (queryParamNames.has(name)) {
      const nextPagePath = findNextPagePath(responseType) ?? [name]
      const itemsPath = findItemsPath(responseType) ?? []
      return {
        strategy: 'cursor' as PaginationStrategy,
        pageParam: name,
        nextPagePath,
        itemsPath,
      }
    }
  }

  // --- Strategy 2: Offset/limit pagination ---
  for (const offsetName of OFFSET_PARAM_NAMES) {
    if (queryParamNames.has(offsetName)) {
      const hasLimit = [...LIMIT_PARAM_NAMES].some((n) => queryParamNames.has(n))
      if (hasLimit) {
        const itemsPath = findItemsPath(responseType) ?? []
        return {
          strategy: 'offset-limit' as PaginationStrategy,
          pageParam: offsetName,
          nextPagePath: [offsetName],
          itemsPath,
        }
      }
    }
  }

  // --- Strategy 3: Page-number pagination ---
  for (const pageName of PAGE_NUMBER_PARAM_NAMES) {
    if (queryParamNames.has(pageName)) {
      const itemsPath = findItemsPath(responseType) ?? []
      const nextPagePath = findPageCountPath(responseType) ?? [pageName]
      return {
        strategy: 'page-number' as PaginationStrategy,
        pageParam: pageName,
        nextPagePath,
        itemsPath,
      }
    }
  }

  // --- Fallback: check response shape for cursor fields even without matching query params ---
  if (responseType.kind === 'object') {
    const cursorPath = findNextPagePath(responseType)
    const items = findItemsPath(responseType)
    if (cursorPath && items) {
      // There's a cursor in the response but we need to guess the param name
      const likelyCursorParam = [...CURSOR_PARAM_NAMES].find((n) => queryParamNames.has(n))
        ?? [...PAGE_NUMBER_PARAM_NAMES].find((n) => queryParamNames.has(n))
      if (likelyCursorParam) {
        return {
          strategy: 'cursor',
          pageParam: likelyCursorParam,
          nextPagePath: cursorPath,
          itemsPath: items,
        }
      }
    }
  }

  return undefined
}

/**
 * Runs pagination detection on all GET operations in the spec and attaches
 * `PaginationInfo` to each operation that appears to be paginated.
 *
 * @param spec - The API spec to process.
 * @returns A new API spec with pagination info attached to detected operations.
 */
export function applyPaginationDetection(spec: ApiSpec): ApiSpec {
  const operations = spec.operations.map((op) => {
    // Only detect pagination on GET / QUERY operations
    if (op.method !== 'GET' && op.method !== 'QUERY') {
      return op
    }
    // Don't overwrite existing pagination info
    if (op.pagination) {
      return op
    }
    const pagination = detectPagination(op)
    if (pagination) {
      return { ...op, pagination }
    }
    return op
  })

  return { ...spec, operations }
}
