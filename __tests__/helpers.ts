/**
 * Shared test helpers for creating mock IR types.
 */
import type { ApiSpec, ApiOperation, ApiType } from '../src/ir/types'

/**
 * Create a minimal ApiSpec for testing.
 */
export function createMockSpec(operations?: ApiOperation[]): ApiSpec {
  return {
    title: 'Test API',
    baseUrl: 'http://localhost:3000/api',
    version: '1.0.0',
    operations: operations ?? [createGetOperation(), createPostOperation()],
    types: new Map(),
  }
}

/**
 * Create a GET list operation.
 */
export function createGetOperation(overrides?: Partial<ApiOperation>): ApiOperation {
  return {
    operationId: 'listPets',
    summary: 'List all pets',
    method: 'GET',
    path: '/pets',
    tags: ['pets'],
    pathParams: [],
    queryParams: [
      { name: 'limit', required: false, type: { kind: 'primitive', type: 'integer' }, in: 'query' },
    ],
    headerParams: [],
    requestBody: undefined,
    response: {
      statusCode: 200,
      contentType: 'application/json',
      type: {
        kind: 'array',
        items: {
          kind: 'object',
          properties: [
            { name: 'id', type: { kind: 'primitive', type: 'integer' }, required: true },
            { name: 'name', type: { kind: 'primitive', type: 'string' }, required: true },
          ],
        },
      },
    },
    deprecated: false,
    ...overrides,
  }
}

/**
 * Create a POST mutation operation.
 */
export function createPostOperation(overrides?: Partial<ApiOperation>): ApiOperation {
  return {
    operationId: 'createPet',
    summary: 'Create a pet',
    method: 'POST',
    path: '/pets',
    tags: ['pets'],
    pathParams: [],
    queryParams: [],
    headerParams: [],
    requestBody: {
      required: true,
      contentType: 'application/json',
      type: {
        kind: 'object',
        properties: [
          { name: 'name', type: { kind: 'primitive', type: 'string' }, required: true },
          { name: 'tag', type: { kind: 'primitive', type: 'string' }, required: false },
        ],
      },
    },
    response: {
      statusCode: 201,
      contentType: 'application/json',
      type: {
        kind: 'object',
        properties: [
          { name: 'id', type: { kind: 'primitive', type: 'integer' }, required: true },
          { name: 'name', type: { kind: 'primitive', type: 'string' }, required: true },
        ],
      },
    },
    deprecated: false,
    ...overrides,
  }
}

/**
 * Create a GET detail (single resource) operation.
 */
export function createDetailOperation(overrides?: Partial<ApiOperation>): ApiOperation {
  return {
    operationId: 'getPet',
    summary: 'Get a pet by ID',
    method: 'GET',
    path: '/pets/{petId}',
    tags: ['pets'],
    pathParams: [
      { name: 'petId', required: true, type: { kind: 'primitive', type: 'string' }, in: 'path' },
    ],
    queryParams: [],
    headerParams: [],
    requestBody: undefined,
    response: {
      statusCode: 200,
      contentType: 'application/json',
      type: {
        kind: 'object',
        properties: [
          { name: 'id', type: { kind: 'primitive', type: 'integer' }, required: true },
          { name: 'name', type: { kind: 'primitive', type: 'string' }, required: true },
        ],
      },
    },
    deprecated: false,
    ...overrides,
  }
}

/**
 * Create a paginated GET operation with cursor-based pagination.
 */
export function createPaginatedOperation(overrides?: Partial<ApiOperation>): ApiOperation {
  return {
    operationId: 'listPetsPaginated',
    summary: 'List pets with pagination',
    method: 'GET',
    path: '/pets',
    tags: ['pets'],
    pathParams: [],
    queryParams: [
      { name: 'cursor', required: false, type: { kind: 'primitive', type: 'string' }, in: 'query' },
      { name: 'limit', required: false, type: { kind: 'primitive', type: 'integer' }, in: 'query' },
    ],
    headerParams: [],
    requestBody: undefined,
    response: {
      statusCode: 200,
      contentType: 'application/json',
      type: {
        kind: 'object',
        properties: [
          {
            name: 'items',
            type: {
              kind: 'array',
              items: {
                kind: 'object',
                properties: [
                  { name: 'id', type: { kind: 'primitive', type: 'integer' }, required: true },
                  { name: 'name', type: { kind: 'primitive', type: 'string' }, required: true },
                ],
              },
            },
            required: true,
          },
          { name: 'nextCursor', type: { kind: 'primitive', type: 'string' }, required: false },
        ],
      },
    },
    pagination: {
      strategy: 'cursor',
      pageParam: 'cursor',
      nextPagePath: ['nextCursor'],
      itemsPath: ['items'],
    },
    deprecated: false,
    ...overrides,
  }
}

/**
 * Create a DELETE operation.
 */
export function createDeleteOperation(overrides?: Partial<ApiOperation>): ApiOperation {
  return {
    operationId: 'deletePet',
    summary: 'Delete a pet',
    method: 'DELETE',
    path: '/pets/{petId}',
    tags: ['pets'],
    pathParams: [
      { name: 'petId', required: true, type: { kind: 'primitive', type: 'string' }, in: 'path' },
    ],
    queryParams: [],
    headerParams: [],
    requestBody: undefined,
    response: {
      statusCode: 204,
      contentType: 'application/json',
      type: { kind: 'primitive', type: 'null' },
    },
    deprecated: false,
    ...overrides,
  }
}

/**
 * Create a GraphQL SUBSCRIPTION operation (no arguments).
 */
export function createSubscriptionOperation(overrides?: Partial<ApiOperation>): ApiOperation {
  return {
    operationId: 'petCreated',
    summary: 'Notified when a pet is created',
    method: 'SUBSCRIPTION',
    path: 'petCreated',
    tags: ['subscriptions'],
    pathParams: [],
    queryParams: [],
    headerParams: [],
    requestBody: undefined,
    response: {
      statusCode: 200,
      contentType: 'application/json',
      type: {
        kind: 'object',
        properties: [
          { name: 'id', type: { kind: 'primitive', type: 'integer' }, required: true },
          { name: 'name', type: { kind: 'primitive', type: 'string' }, required: true },
        ],
      },
    },
    deprecated: false,
    ...overrides,
  }
}

/**
 * Create a GraphQL SUBSCRIPTION operation with arguments.
 */
export function createSubscriptionWithArgsOperation(overrides?: Partial<ApiOperation>): ApiOperation {
  return {
    operationId: 'onMessage',
    summary: 'Subscribe to messages on a channel',
    method: 'SUBSCRIPTION',
    path: 'onMessage',
    tags: ['subscriptions'],
    pathParams: [],
    queryParams: [
      { name: 'channel', required: true, type: { kind: 'primitive', type: 'string' }, in: 'query' },
    ],
    headerParams: [],
    requestBody: undefined,
    response: {
      statusCode: 200,
      contentType: 'application/json',
      type: {
        kind: 'object',
        properties: [
          { name: 'id', type: { kind: 'primitive', type: 'string' }, required: true },
          { name: 'text', type: { kind: 'primitive', type: 'string' }, required: true },
        ],
      },
    },
    deprecated: false,
    ...overrides,
  }
}

/**
 * Create a spec that has named types.
 */
export function createSpecWithNamedTypes(): ApiSpec {
  const types = new Map<string, ApiType>()
  types.set('Pet', {
    kind: 'object',
    name: 'Pet',
    properties: [
      { name: 'id', type: { kind: 'primitive', type: 'integer' }, required: true },
      { name: 'name', type: { kind: 'primitive', type: 'string' }, required: true },
      { name: 'tag', type: { kind: 'primitive', type: 'string' }, required: false },
    ],
  })
  types.set('PetStatus', {
    kind: 'enum',
    values: ['available', 'pending', 'sold'],
  })

  return {
    title: 'Pet Store API',
    baseUrl: 'http://localhost:3000/api',
    version: '2.0.0',
    operations: [createGetOperation(), createPostOperation()],
    types,
  }
}
