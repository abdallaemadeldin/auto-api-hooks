import { applyPaginationDetection } from '../../src/ir/helpers'
import type { ApiSpec, ApiOperation } from '../../src/ir/types'

function createMockSpec(operations: ApiOperation[]): ApiSpec {
  return {
    title: 'Test API',
    baseUrl: 'https://api.example.com',
    version: '1.0.0',
    operations,
    types: new Map(),
  }
}

function createMockOperation(overrides: Partial<ApiOperation>): ApiOperation {
  return {
    operationId: 'testOp',
    method: 'GET',
    path: '/test',
    tags: ['test'],
    pathParams: [],
    queryParams: [],
    headerParams: [],
    response: {
      statusCode: 200,
      contentType: 'application/json',
      type: { kind: 'primitive', type: 'unknown' },
    },
    deprecated: false,
    ...overrides,
  }
}

describe('applyPaginationDetection', () => {
  it('applies pagination info to GET operations matching heuristics', () => {
    const op = createMockOperation({
      operationId: 'listItems',
      method: 'GET',
      path: '/items',
      queryParams: [
        {
          name: 'cursor',
          required: false,
          type: { kind: 'primitive', type: 'string' },
          in: 'query',
        },
      ],
      response: {
        statusCode: 200,
        contentType: 'application/json',
        type: {
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
      },
    })

    const spec = createMockSpec([op])
    const result = applyPaginationDetection(spec)

    expect(result.operations[0].pagination).toBeDefined()
    expect(result.operations[0].pagination!.strategy).toBe('cursor')
  })

  it('does not apply pagination to POST operations', () => {
    const op = createMockOperation({
      operationId: 'createItem',
      method: 'POST',
      path: '/items',
      queryParams: [
        {
          name: 'cursor',
          required: false,
          type: { kind: 'primitive', type: 'string' },
          in: 'query',
        },
      ],
    })

    const spec = createMockSpec([op])
    const result = applyPaginationDetection(spec)

    expect(result.operations[0].pagination).toBeUndefined()
  })

  it('applies pagination to QUERY operations', () => {
    const op = createMockOperation({
      operationId: 'listItems',
      method: 'QUERY',
      path: 'items',
      queryParams: [
        {
          name: 'after',
          required: false,
          type: { kind: 'primitive', type: 'string' },
          in: 'query',
        },
      ],
      response: {
        statusCode: 200,
        contentType: 'application/json',
        type: {
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
      },
    })

    const spec = createMockSpec([op])
    const result = applyPaginationDetection(spec)

    expect(result.operations[0].pagination).toBeDefined()
    expect(result.operations[0].pagination!.strategy).toBe('cursor')
  })

  it('does not overwrite existing pagination info', () => {
    const op = createMockOperation({
      operationId: 'listItems',
      method: 'GET',
      path: '/items',
      pagination: {
        strategy: 'page-number',
        pageParam: 'p',
        nextPagePath: ['meta', 'nextPage'],
        itemsPath: ['records'],
      },
      queryParams: [
        {
          name: 'cursor',
          required: false,
          type: { kind: 'primitive', type: 'string' },
          in: 'query',
        },
      ],
    })

    const spec = createMockSpec([op])
    const result = applyPaginationDetection(spec)

    expect(result.operations[0].pagination!.strategy).toBe('page-number')
    expect(result.operations[0].pagination!.pageParam).toBe('p')
  })

  it('does not modify operations without pagination signals', () => {
    const op = createMockOperation({
      operationId: 'getItem',
      method: 'GET',
      path: '/items/{id}',
      queryParams: [],
    })

    const spec = createMockSpec([op])
    const result = applyPaginationDetection(spec)

    expect(result.operations[0].pagination).toBeUndefined()
  })

  it('returns a new spec object (does not mutate)', () => {
    const op = createMockOperation({
      operationId: 'listItems',
      method: 'GET',
      path: '/items',
    })

    const spec = createMockSpec([op])
    const result = applyPaginationDetection(spec)

    expect(result).not.toBe(spec)
    expect(result.operations).not.toBe(spec.operations)
  })

  it('handles multiple operations, only applying to relevant ones', () => {
    const getOp = createMockOperation({
      operationId: 'listItems',
      method: 'GET',
      path: '/items',
      queryParams: [
        {
          name: 'offset',
          required: false,
          type: { kind: 'primitive', type: 'integer' },
          in: 'query',
        },
        {
          name: 'limit',
          required: false,
          type: { kind: 'primitive', type: 'integer' },
          in: 'query',
        },
      ],
      response: {
        statusCode: 200,
        contentType: 'application/json',
        type: {
          kind: 'object',
          properties: [
            {
              name: 'items',
              type: { kind: 'array', items: { kind: 'primitive', type: 'unknown' } },
              required: true,
            },
          ],
        },
      },
    })

    const postOp = createMockOperation({
      operationId: 'createItem',
      method: 'POST',
      path: '/items',
    })

    const detailOp = createMockOperation({
      operationId: 'getItem',
      method: 'GET',
      path: '/items/{id}',
      queryParams: [],
    })

    const spec = createMockSpec([getOp, postOp, detailOp])
    const result = applyPaginationDetection(spec)

    expect(result.operations[0].pagination).toBeDefined()
    expect(result.operations[0].pagination!.strategy).toBe('offset-limit')
    expect(result.operations[1].pagination).toBeUndefined()
    expect(result.operations[2].pagination).toBeUndefined()
  })
})
