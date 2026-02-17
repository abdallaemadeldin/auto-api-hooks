import {
  deriveCacheKeyFactories,
  getQueryKey,
  getSwrKey,
  getCacheKeyForOperation,
} from '../../src/utils/cache-keys'
import type { ApiOperation } from '../../src/ir/types'

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

describe('deriveCacheKeyFactories', () => {
  it('creates a factory for list endpoints', () => {
    const ops = [
      createMockOperation({
        operationId: 'listPets',
        method: 'GET',
        path: '/pets',
      }),
    ]

    const factories = deriveCacheKeyFactories(ops)
    expect(factories).toHaveLength(1)
    expect(factories[0].resource).toBe('pets')
    expect(factories[0].variableName).toBe('petsKeys')
    expect(factories[0].rootKey).toEqual(['pets'])
    expect(factories[0].hasList).toBe(true)
    expect(factories[0].hasDetail).toBe(false)
  })

  it('creates a factory for detail endpoints', () => {
    const ops = [
      createMockOperation({
        operationId: 'getPetById',
        method: 'GET',
        path: '/pets/{petId}',
        pathParams: [
          {
            name: 'petId',
            required: true,
            type: { kind: 'primitive', type: 'string' },
            in: 'path',
          },
        ],
      }),
    ]

    const factories = deriveCacheKeyFactories(ops)
    expect(factories).toHaveLength(1)
    expect(factories[0].hasList).toBe(false)
    expect(factories[0].hasDetail).toBe(true)
  })

  it('merges list and detail into single factory', () => {
    const ops = [
      createMockOperation({
        operationId: 'listPets',
        method: 'GET',
        path: '/pets',
      }),
      createMockOperation({
        operationId: 'getPetById',
        method: 'GET',
        path: '/pets/{petId}',
        pathParams: [
          {
            name: 'petId',
            required: true,
            type: { kind: 'primitive', type: 'string' },
            in: 'path',
          },
        ],
      }),
    ]

    const factories = deriveCacheKeyFactories(ops)
    expect(factories).toHaveLength(1)
    expect(factories[0].hasList).toBe(true)
    expect(factories[0].hasDetail).toBe(true)
  })

  it('creates separate factories for different resources', () => {
    const ops = [
      createMockOperation({
        operationId: 'listPets',
        method: 'GET',
        path: '/pets',
      }),
      createMockOperation({
        operationId: 'listUsers',
        method: 'GET',
        path: '/users',
      }),
    ]

    const factories = deriveCacheKeyFactories(ops)
    expect(factories).toHaveLength(2)
    const names = factories.map((f) => f.resource)
    expect(names).toContain('pets')
    expect(names).toContain('users')
  })

  it('ignores non-GET/QUERY operations', () => {
    const ops = [
      createMockOperation({
        operationId: 'createPet',
        method: 'POST',
        path: '/pets',
      }),
      createMockOperation({
        operationId: 'deletePet',
        method: 'DELETE',
        path: '/pets/{petId}',
      }),
    ]

    const factories = deriveCacheKeyFactories(ops)
    expect(factories).toHaveLength(0)
  })

  it('handles QUERY operations (GraphQL)', () => {
    const ops = [
      createMockOperation({
        operationId: 'pets',
        method: 'QUERY',
        path: 'pets',
      }),
    ]

    const factories = deriveCacheKeyFactories(ops)
    expect(factories).toHaveLength(1)
    expect(factories[0].hasList).toBe(true)
  })
})

describe('getQueryKey', () => {
  it('produces list key for collection endpoints', () => {
    const op = createMockOperation({
      operationId: 'listPets',
      method: 'GET',
      path: '/pets',
    })

    const key = getQueryKey(op)
    expect(key).toBe("['pets', 'list'] as const")
  })

  it('includes params for list endpoints with query params', () => {
    const op = createMockOperation({
      operationId: 'listPets',
      method: 'GET',
      path: '/pets',
      queryParams: [
        {
          name: 'status',
          required: false,
          type: { kind: 'primitive', type: 'string' },
          in: 'query',
        },
      ],
    })

    const key = getQueryKey(op)
    expect(key).toBe("['pets', 'list', params] as const")
  })

  it('produces detail key with path params', () => {
    const op = createMockOperation({
      operationId: 'getPetById',
      method: 'GET',
      path: '/pets/{petId}',
      pathParams: [
        {
          name: 'petId',
          required: true,
          type: { kind: 'primitive', type: 'string' },
          in: 'path',
        },
      ],
    })

    const key = getQueryKey(op)
    expect(key).toBe("['pets', 'detail', petId] as const")
  })

  it('handles nested resource detail endpoints', () => {
    const op = createMockOperation({
      operationId: 'getUserPost',
      method: 'GET',
      path: '/users/{userId}/posts/{postId}',
      pathParams: [
        {
          name: 'userId',
          required: true,
          type: { kind: 'primitive', type: 'string' },
          in: 'path',
        },
        {
          name: 'postId',
          required: true,
          type: { kind: 'primitive', type: 'string' },
          in: 'path',
        },
      ],
    })

    const key = getQueryKey(op)
    expect(key).toBe("['posts', 'detail', userId, postId] as const")
  })
})

describe('getSwrKey', () => {
  it('returns static string for simple path', () => {
    const op = createMockOperation({
      operationId: 'listPets',
      method: 'GET',
      path: '/pets',
    })

    const key = getSwrKey(op)
    expect(key).toBe("'/pets'")
  })

  it('returns template literal for paths with params', () => {
    const op = createMockOperation({
      operationId: 'getPetById',
      method: 'GET',
      path: '/pets/{petId}',
      pathParams: [
        {
          name: 'petId',
          required: true,
          type: { kind: 'primitive', type: 'string' },
          in: 'path',
        },
      ],
    })

    const key = getSwrKey(op)
    expect(key).toBe('`/pets/${petId}`')
  })

  it('includes query params via URLSearchParams', () => {
    const op = createMockOperation({
      operationId: 'listPets',
      method: 'GET',
      path: '/pets',
      queryParams: [
        {
          name: 'status',
          required: false,
          type: { kind: 'primitive', type: 'string' },
          in: 'query',
        },
      ],
    })

    const key = getSwrKey(op)
    expect(key).toContain('/pets?')
    expect(key).toContain('URLSearchParams')
  })

  it('handles both path and query params', () => {
    const op = createMockOperation({
      operationId: 'listUserPosts',
      method: 'GET',
      path: '/users/{userId}/posts',
      pathParams: [
        {
          name: 'userId',
          required: true,
          type: { kind: 'primitive', type: 'string' },
          in: 'path',
        },
      ],
      queryParams: [
        {
          name: 'page',
          required: false,
          type: { kind: 'primitive', type: 'integer' },
          in: 'query',
        },
      ],
    })

    const key = getSwrKey(op)
    expect(key).toContain('${userId}')
    expect(key).toContain('URLSearchParams')
  })
})

describe('getCacheKeyForOperation', () => {
  it('returns list key for collection endpoints', () => {
    const op = createMockOperation({
      operationId: 'listPets',
      method: 'GET',
      path: '/pets',
    })

    const key = getCacheKeyForOperation(op)
    expect(key).toBe('petsKeys.lists()')
  })

  it('returns list key with params for filtered list', () => {
    const op = createMockOperation({
      operationId: 'listPets',
      method: 'GET',
      path: '/pets',
      queryParams: [
        {
          name: 'status',
          required: false,
          type: { kind: 'primitive', type: 'string' },
          in: 'query',
        },
      ],
    })

    const key = getCacheKeyForOperation(op)
    expect(key).toBe('petsKeys.list(params)')
  })

  it('returns detail key with param name for detail endpoints', () => {
    const op = createMockOperation({
      operationId: 'getPetById',
      method: 'GET',
      path: '/pets/{petId}',
      pathParams: [
        {
          name: 'petId',
          required: true,
          type: { kind: 'primitive', type: 'string' },
          in: 'path',
        },
      ],
    })

    const key = getCacheKeyForOperation(op)
    expect(key).toBe('petsKeys.detail(petId)')
  })

  it('returns details() for detail endpoints without path params', () => {
    const op = createMockOperation({
      operationId: 'getPetById',
      method: 'GET',
      path: '/pets/{petId}',
      pathParams: [],
    })

    const key = getCacheKeyForOperation(op)
    expect(key).toBe('petsKeys.details()')
  })
})
