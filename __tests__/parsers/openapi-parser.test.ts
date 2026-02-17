import path from 'node:path'
import { parseSpec } from '../../src/parsers/index'
import type { ApiSpec, ApiOperation } from '../../src/ir/types'

describe('OpenAPI 3.x Parser', () => {
  const specPath = path.resolve(__dirname, '../../fixtures/petstore-openapi3.yaml')
  let spec: ApiSpec

  beforeAll(async () => {
    spec = await parseSpec(specPath)
  })

  it('parses the spec and returns an ApiSpec', () => {
    expect(spec).toBeDefined()
    expect(spec.operations).toBeDefined()
    expect(spec.types).toBeDefined()
    expect(Array.isArray(spec.operations)).toBe(true)
    expect(spec.types).toBeInstanceOf(Map)
  })

  it('has the correct title', () => {
    expect(spec.title).toBe('Petstore')
  })

  it('has the correct version', () => {
    expect(spec.version).toBe('1.0.0')
  })

  it('has the correct base URL from servers', () => {
    expect(spec.baseUrl).toBe('https://petstore.example.com/api/v1')
  })

  it('creates the expected number of operations', () => {
    // GET /pets, POST /pets, GET /pets/{petId}, PUT /pets/{petId},
    // DELETE /pets/{petId}, GET /pets/{petId}/tags, GET /categories
    expect(spec.operations.length).toBe(7)
  })

  describe('GET /pets (listPets)', () => {
    let op: ApiOperation

    beforeAll(() => {
      op = spec.operations.find((o) => o.operationId === 'listPets')!
    })

    it('exists', () => {
      expect(op).toBeDefined()
    })

    it('has the correct method', () => {
      expect(op.method).toBe('GET')
    })

    it('has the correct path', () => {
      expect(op.path).toBe('/pets')
    })

    it('has no path params', () => {
      expect(op.pathParams).toHaveLength(0)
    })

    it('has query params', () => {
      expect(op.queryParams.length).toBeGreaterThanOrEqual(1)
      const limitParam = op.queryParams.find((p) => p.name === 'limit')
      expect(limitParam).toBeDefined()
      expect(limitParam!.required).toBe(false)
      expect(limitParam!.in).toBe('query')
    })

    it('has a status enum query param', () => {
      const statusParam = op.queryParams.find((p) => p.name === 'status')
      expect(statusParam).toBeDefined()
      expect(statusParam!.type.kind).toBe('enum')
      if (statusParam!.type.kind === 'enum') {
        expect(statusParam!.type.values).toEqual(['available', 'pending', 'sold'])
      }
    })

    it('has response type populated', () => {
      expect(op.response).toBeDefined()
      expect(op.response.statusCode).toBe(200)
      expect(op.response.contentType).toBe('application/json')
      expect(op.response.type.kind).toBe('array')
    })

    it('has tags assigned', () => {
      expect(op.tags).toEqual(['pets'])
    })

    it('is not deprecated', () => {
      expect(op.deprecated).toBe(false)
    })
  })

  describe('POST /pets (createPet)', () => {
    let op: ApiOperation

    beforeAll(() => {
      op = spec.operations.find((o) => o.operationId === 'createPet')!
    })

    it('exists', () => {
      expect(op).toBeDefined()
    })

    it('has the correct method', () => {
      expect(op.method).toBe('POST')
    })

    it('has a requestBody', () => {
      expect(op.requestBody).toBeDefined()
      expect(op.requestBody!.required).toBe(true)
      expect(op.requestBody!.contentType).toBe('application/json')
    })

    it('requestBody has an object type with properties', () => {
      const bodyType = op.requestBody!.type
      expect(bodyType.kind).toBe('object')
      if (bodyType.kind === 'object') {
        const namesProp = bodyType.properties.find((p) => p.name === 'name')
        expect(namesProp).toBeDefined()
        expect(namesProp!.required).toBe(true)
      }
    })

    it('has a 201 response', () => {
      expect(op.response.statusCode).toBe(201)
    })
  })

  describe('GET /pets/{petId} (getPetById)', () => {
    let op: ApiOperation

    beforeAll(() => {
      op = spec.operations.find((o) => o.operationId === 'getPetById')!
    })

    it('exists', () => {
      expect(op).toBeDefined()
    })

    it('has path params extracted correctly', () => {
      expect(op.pathParams).toHaveLength(1)
      expect(op.pathParams[0].name).toBe('petId')
      expect(op.pathParams[0].required).toBe(true)
      expect(op.pathParams[0].in).toBe('path')
    })

    it('has a response type populated as an object', () => {
      expect(op.response.type.kind).toBe('object')
      if (op.response.type.kind === 'object') {
        const idProp = op.response.type.properties.find((p) => p.name === 'id')
        expect(idProp).toBeDefined()
        const nameProp = op.response.type.properties.find((p) => p.name === 'name')
        expect(nameProp).toBeDefined()
      }
    })
  })

  describe('DELETE /pets/{petId} (deletePet)', () => {
    let op: ApiOperation

    beforeAll(() => {
      op = spec.operations.find((o) => o.operationId === 'deletePet')!
    })

    it('exists with DELETE method', () => {
      expect(op).toBeDefined()
      expect(op.method).toBe('DELETE')
    })

    it('has a path param', () => {
      expect(op.pathParams).toHaveLength(1)
      expect(op.pathParams[0].name).toBe('petId')
    })
  })

  describe('named types from components/schemas', () => {
    it('extracts Pet type', () => {
      const petType = spec.types.get('Pet')
      expect(petType).toBeDefined()
      expect(petType!.kind).toBe('object')
      if (petType!.kind === 'object') {
        expect(petType!.name).toBe('Pet')
        const props = petType!.properties.map((p) => p.name)
        expect(props).toContain('id')
        expect(props).toContain('name')
        expect(props).toContain('tag')
        expect(props).toContain('status')
      }
    })

    it('extracts NewPet type', () => {
      const newPetType = spec.types.get('NewPet')
      expect(newPetType).toBeDefined()
      expect(newPetType!.kind).toBe('object')
    })

    it('extracts Category type', () => {
      const catType = spec.types.get('Category')
      expect(catType).toBeDefined()
      expect(catType!.kind).toBe('object')
    })
  })

  describe('tags assignment', () => {
    it('assigns pets tag to pet operations', () => {
      const petOps = spec.operations.filter((o) => o.tags.includes('pets'))
      expect(petOps.length).toBeGreaterThanOrEqual(4)
    })

    it('assigns tags tag to listPetTags', () => {
      const tagOp = spec.operations.find((o) => o.operationId === 'listPetTags')
      expect(tagOp).toBeDefined()
      expect(tagOp!.tags).toEqual(['tags'])
    })

    it('assigns categories tag to listCategories', () => {
      const catOp = spec.operations.find((o) => o.operationId === 'listCategories')
      expect(catOp).toBeDefined()
      expect(catOp!.tags).toEqual(['categories'])
    })
  })

  describe('x-pagination vendor extension', () => {
    it('parses x-pagination into PaginationInfo', async () => {
      const specWithPagination = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/items': {
            get: {
              operationId: 'listItems',
              tags: ['items'],
              'x-pagination': {
                strategy: 'cursor',
                pageParam: 'next_token',
                nextPagePath: 'meta.nextToken',
                itemsPath: 'records',
              },
              parameters: [
                { name: 'next_token', in: 'query', schema: { type: 'string' } },
              ],
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: { type: 'object', properties: { records: { type: 'array', items: { type: 'string' } } } },
                    },
                  },
                },
              },
            },
          },
        },
      }

      const result = await parseSpec(specWithPagination as any)
      const listItems = result.operations.find((o) => o.operationId === 'listItems')
      expect(listItems).toBeDefined()
      expect(listItems!.pagination).toBeDefined()
      expect(listItems!.pagination!.strategy).toBe('cursor')
      expect(listItems!.pagination!.pageParam).toBe('next_token')
      expect(listItems!.pagination!.nextPagePath).toEqual(['meta', 'nextToken'])
      expect(listItems!.pagination!.itemsPath).toEqual(['records'])
    })

    it('x-pagination takes priority over heuristic detection', async () => {
      const specWithBoth = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/items': {
            get: {
              operationId: 'listItems',
              tags: ['items'],
              'x-pagination': {
                strategy: 'page-number',
                pageParam: 'pg',
                nextPagePath: 'pagination.totalPages',
                itemsPath: 'entries',
              },
              parameters: [
                { name: 'pg', in: 'query', schema: { type: 'integer' } },
                { name: 'cursor', in: 'query', schema: { type: 'string' } },
              ],
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: { type: 'object', properties: { entries: { type: 'array', items: { type: 'string' } } } },
                    },
                  },
                },
              },
            },
          },
        },
      }

      const result = await parseSpec(specWithBoth as any)
      const listItems = result.operations.find((o) => o.operationId === 'listItems')
      expect(listItems!.pagination!.strategy).toBe('page-number')
      expect(listItems!.pagination!.pageParam).toBe('pg')
    })
  })
})
