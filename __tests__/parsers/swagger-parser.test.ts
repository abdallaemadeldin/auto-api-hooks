import path from 'node:path'
import { parseSpec } from '../../src/parsers/index'
import type { ApiSpec, ApiOperation } from '../../src/ir/types'

describe('Swagger 2.0 Parser', () => {
  const specPath = path.resolve(__dirname, '../../fixtures/petstore-swagger2.json')
  let spec: ApiSpec

  beforeAll(async () => {
    spec = await parseSpec(specPath)
  })

  it('parses and returns a valid ApiSpec', () => {
    expect(spec).toBeDefined()
    expect(spec.operations).toBeDefined()
    expect(Array.isArray(spec.operations)).toBe(true)
    expect(spec.types).toBeInstanceOf(Map)
  })

  it('has the correct title', () => {
    expect(spec.title).toBe('Petstore')
  })

  it('has the correct version', () => {
    expect(spec.version).toBe('1.0.0')
  })

  it('constructs base URL from host + basePath', () => {
    expect(spec.baseUrl).toBe('https://petstore.example.com/api/v1')
  })

  it('creates the expected number of operations', () => {
    // GET /pets, POST /pets, GET /pets/{petId}, DELETE /pets/{petId}
    expect(spec.operations.length).toBe(4)
  })

  describe('GET /pets (listPets)', () => {
    let op: ApiOperation

    beforeAll(() => {
      op = spec.operations.find((o) => o.operationId === 'listPets')!
    })

    it('has the correct method and path', () => {
      expect(op.method).toBe('GET')
      expect(op.path).toBe('/pets')
    })

    it('has a query param for limit', () => {
      const limitParam = op.queryParams.find((p) => p.name === 'limit')
      expect(limitParam).toBeDefined()
      expect(limitParam!.required).toBe(false)
      expect(limitParam!.type.kind).toBe('primitive')
    })

    it('has a response with array type', () => {
      expect(op.response.statusCode).toBe(200)
      expect(op.response.type.kind).toBe('array')
    })

    it('has the pets tag', () => {
      expect(op.tags).toEqual(['pets'])
    })
  })

  describe('POST /pets (createPet)', () => {
    let op: ApiOperation

    beforeAll(() => {
      op = spec.operations.find((o) => o.operationId === 'createPet')!
    })

    it('has the correct method', () => {
      expect(op.method).toBe('POST')
    })

    it('converts body parameter to requestBody', () => {
      expect(op.requestBody).toBeDefined()
      expect(op.requestBody!.required).toBe(true)
      expect(op.requestBody!.contentType).toBe('application/json')
    })

    it('requestBody has object type with properties', () => {
      const bodyType = op.requestBody!.type
      expect(bodyType.kind).toBe('object')
      if (bodyType.kind === 'object') {
        const nameProp = bodyType.properties.find((p) => p.name === 'name')
        expect(nameProp).toBeDefined()
        expect(nameProp!.required).toBe(true)
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

    it('has path params', () => {
      expect(op.pathParams).toHaveLength(1)
      expect(op.pathParams[0].name).toBe('petId')
      expect(op.pathParams[0].required).toBe(true)
    })

    it('has an object response type', () => {
      expect(op.response.type.kind).toBe('object')
    })
  })

  describe('definitions become types', () => {
    it('extracts Pet definition', () => {
      const petType = spec.types.get('Pet')
      expect(petType).toBeDefined()
      expect(petType!.kind).toBe('object')
      if (petType!.kind === 'object') {
        expect(petType!.name).toBe('Pet')
        const propNames = petType!.properties.map((p) => p.name)
        expect(propNames).toContain('id')
        expect(propNames).toContain('name')
        expect(propNames).toContain('tag')
        expect(propNames).toContain('status')
      }
    })

    it('extracts NewPet definition', () => {
      const newPetType = spec.types.get('NewPet')
      expect(newPetType).toBeDefined()
      expect(newPetType!.kind).toBe('object')
    })

    it('Pet status is an enum type', () => {
      const petType = spec.types.get('Pet')
      if (petType?.kind === 'object') {
        const statusProp = petType.properties.find((p) => p.name === 'status')
        expect(statusProp).toBeDefined()
        expect(statusProp!.type.kind).toBe('enum')
        if (statusProp!.type.kind === 'enum') {
          expect(statusProp!.type.values).toEqual(['available', 'pending', 'sold'])
        }
      }
    })
  })

  describe('baseUrl option override', () => {
    it('uses provided baseUrl when specified', async () => {
      const customSpec = await parseSpec(specPath, {
        baseUrl: 'https://custom.api.com/v2',
      })
      expect(customSpec.baseUrl).toBe('https://custom.api.com/v2')
    })
  })
})
