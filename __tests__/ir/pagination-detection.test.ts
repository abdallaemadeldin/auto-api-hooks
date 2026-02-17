import { detectPagination } from '../../src/ir/helpers'
import type { ApiOperation, ApiObjectType, ApiType } from '../../src/ir/types'

/**
 * Creates a minimal mock ApiOperation for pagination detection testing.
 */
function createMockOperation(overrides: {
  queryParams?: Array<{ name: string }>
  responseType?: ApiType
}): ApiOperation {
  return {
    operationId: 'testOp',
    method: 'GET',
    path: '/test',
    tags: ['test'],
    pathParams: [],
    queryParams: (overrides.queryParams ?? []).map((p) => ({
      name: p.name,
      required: false,
      type: { kind: 'primitive' as const, type: 'string' as const },
      in: 'query' as const,
    })),
    headerParams: [],
    response: {
      statusCode: 200,
      contentType: 'application/json',
      type: overrides.responseType ?? { kind: 'primitive', type: 'unknown' },
    },
    deprecated: false,
  }
}

describe('detectPagination', () => {
  describe('cursor-based pagination', () => {
    it('detects cursor param named "cursor"', () => {
      const op = createMockOperation({
        queryParams: [{ name: 'cursor' }],
        responseType: {
          kind: 'object',
          properties: [
            {
              name: 'items',
              type: { kind: 'array', items: { kind: 'primitive', type: 'unknown' } },
              required: true,
            },
            {
              name: 'nextCursor',
              type: { kind: 'primitive', type: 'string' },
              required: false,
            },
          ],
        },
      })

      const result = detectPagination(op)
      expect(result).toBeDefined()
      expect(result!.strategy).toBe('cursor')
      expect(result!.pageParam).toBe('cursor')
      expect(result!.nextPagePath).toEqual(['nextCursor'])
      expect(result!.itemsPath).toEqual(['items'])
    })

    it('detects cursor param named "after"', () => {
      const op = createMockOperation({
        queryParams: [{ name: 'after' }, { name: 'first' }],
        responseType: {
          kind: 'object',
          properties: [
            {
              name: 'edges',
              type: { kind: 'array', items: { kind: 'primitive', type: 'unknown' } },
              required: true,
            },
            {
              name: 'endCursor',
              type: { kind: 'primitive', type: 'string' },
              required: false,
            },
          ],
        },
      })

      const result = detectPagination(op)
      expect(result).toBeDefined()
      expect(result!.strategy).toBe('cursor')
      expect(result!.pageParam).toBe('after')
    })

    it('detects cursor param named "pageToken"', () => {
      const op = createMockOperation({
        queryParams: [{ name: 'pageToken' }],
        responseType: {
          kind: 'object',
          properties: [
            {
              name: 'data',
              type: { kind: 'array', items: { kind: 'primitive', type: 'unknown' } },
              required: true,
            },
            {
              name: 'nextPageToken',
              type: { kind: 'primitive', type: 'string' },
              required: false,
            },
          ],
        },
      })

      const result = detectPagination(op)
      expect(result).toBeDefined()
      expect(result!.strategy).toBe('cursor')
      expect(result!.pageParam).toBe('pageToken')
    })

    it('finds cursor in nested pageInfo object', () => {
      const op = createMockOperation({
        queryParams: [{ name: 'after' }],
        responseType: {
          kind: 'object',
          properties: [
            {
              name: 'edges',
              type: { kind: 'array', items: { kind: 'primitive', type: 'unknown' } },
              required: true,
            },
            {
              name: 'pageInfo',
              type: {
                kind: 'object',
                properties: [
                  {
                    name: 'endCursor',
                    type: { kind: 'primitive', type: 'string' },
                    required: false,
                  },
                  {
                    name: 'hasNextPage',
                    type: { kind: 'primitive', type: 'boolean' },
                    required: true,
                  },
                ],
              } satisfies ApiObjectType,
              required: true,
            },
          ],
        },
      })

      const result = detectPagination(op)
      expect(result).toBeDefined()
      expect(result!.strategy).toBe('cursor')
      expect(result!.nextPagePath).toEqual(['pageInfo', 'endCursor'])
    })
  })

  describe('offset-limit pagination', () => {
    it('detects offset + limit params', () => {
      const op = createMockOperation({
        queryParams: [{ name: 'offset' }, { name: 'limit' }],
        responseType: {
          kind: 'object',
          properties: [
            {
              name: 'items',
              type: { kind: 'array', items: { kind: 'primitive', type: 'unknown' } },
              required: true,
            },
          ],
        },
      })

      const result = detectPagination(op)
      expect(result).toBeDefined()
      expect(result!.strategy).toBe('offset-limit')
      expect(result!.pageParam).toBe('offset')
      expect(result!.itemsPath).toEqual(['items'])
    })

    it('detects skip + size params', () => {
      const op = createMockOperation({
        queryParams: [{ name: 'skip' }, { name: 'size' }],
        responseType: {
          kind: 'object',
          properties: [
            {
              name: 'results',
              type: { kind: 'array', items: { kind: 'primitive', type: 'unknown' } },
              required: true,
            },
          ],
        },
      })

      const result = detectPagination(op)
      expect(result).toBeDefined()
      expect(result!.strategy).toBe('offset-limit')
      expect(result!.pageParam).toBe('skip')
    })

    it('does not detect offset without limit', () => {
      const op = createMockOperation({
        queryParams: [{ name: 'offset' }],
        responseType: { kind: 'primitive', type: 'unknown' },
      })

      const result = detectPagination(op)
      // Should not match offset-limit without a limit param
      expect(result).toBeUndefined()
    })
  })

  describe('page-number pagination', () => {
    it('detects page param with totalPages in response', () => {
      const op = createMockOperation({
        queryParams: [{ name: 'page' }, { name: 'size' }],
        responseType: {
          kind: 'object',
          properties: [
            {
              name: 'data',
              type: { kind: 'array', items: { kind: 'primitive', type: 'unknown' } },
              required: true,
            },
            {
              name: 'totalPages',
              type: { kind: 'primitive', type: 'integer' },
              required: true,
            },
          ],
        },
      })

      const result = detectPagination(op)
      expect(result).toBeDefined()
      expect(result!.strategy).toBe('page-number')
      expect(result!.pageParam).toBe('page')
      expect(result!.nextPagePath).toEqual(['totalPages'])
      expect(result!.itemsPath).toEqual(['data'])
    })

    it('detects pageNumber param', () => {
      const op = createMockOperation({
        queryParams: [{ name: 'pageNumber' }],
        responseType: {
          kind: 'object',
          properties: [
            {
              name: 'items',
              type: { kind: 'array', items: { kind: 'primitive', type: 'unknown' } },
              required: true,
            },
          ],
        },
      })

      const result = detectPagination(op)
      expect(result).toBeDefined()
      expect(result!.strategy).toBe('page-number')
      expect(result!.pageParam).toBe('pageNumber')
    })

    it('finds total in nested pagination object', () => {
      const op = createMockOperation({
        queryParams: [{ name: 'page' }],
        responseType: {
          kind: 'object',
          properties: [
            {
              name: 'items',
              type: { kind: 'array', items: { kind: 'primitive', type: 'unknown' } },
              required: true,
            },
            {
              name: 'pagination',
              type: {
                kind: 'object',
                properties: [
                  {
                    name: 'totalPages',
                    type: { kind: 'primitive', type: 'integer' },
                    required: true,
                  },
                ],
              } satisfies ApiObjectType,
              required: true,
            },
          ],
        },
      })

      const result = detectPagination(op)
      expect(result).toBeDefined()
      expect(result!.strategy).toBe('page-number')
      expect(result!.nextPagePath).toEqual(['pagination', 'totalPages'])
    })
  })

  describe('non-paginated endpoints', () => {
    it('returns undefined for operations with no pagination params', () => {
      const op = createMockOperation({
        queryParams: [{ name: 'filter' }, { name: 'sort' }],
        responseType: {
          kind: 'object',
          properties: [
            {
              name: 'id',
              type: { kind: 'primitive', type: 'string' },
              required: true,
            },
            {
              name: 'name',
              type: { kind: 'primitive', type: 'string' },
              required: true,
            },
          ],
        },
      })

      const result = detectPagination(op)
      expect(result).toBeUndefined()
    })

    it('returns undefined for operations with no query params', () => {
      const op = createMockOperation({
        queryParams: [],
        responseType: { kind: 'primitive', type: 'unknown' },
      })

      const result = detectPagination(op)
      expect(result).toBeUndefined()
    })

    it('returns undefined for primitive response types', () => {
      const op = createMockOperation({
        queryParams: [],
        responseType: { kind: 'primitive', type: 'string' },
      })

      const result = detectPagination(op)
      expect(result).toBeUndefined()
    })
  })
})
