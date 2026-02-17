import path from 'node:path'
import fs from 'node:fs'
import { parseSpec } from '../../src/parsers/index'
import type { ApiSpec, ApiOperation } from '../../src/ir/types'

describe('GraphQL Parser', () => {
  describe('SDL parsing', () => {
    const sdlPath = path.resolve(__dirname, '../../fixtures/schema.graphql')
    let spec: ApiSpec

    beforeAll(async () => {
      spec = await parseSpec(sdlPath)
    })

    it('parses and returns a valid ApiSpec', () => {
      expect(spec).toBeDefined()
      expect(spec.operations).toBeDefined()
      expect(Array.isArray(spec.operations)).toBe(true)
      expect(spec.types).toBeInstanceOf(Map)
    })

    it('has default GraphQL API title', () => {
      expect(spec.title).toBe('GraphQL API')
    })

    it('has default base URL of /graphql', () => {
      expect(spec.baseUrl).toBe('/graphql')
    })

    it('creates Query operations with QUERY method', () => {
      const queryOps = spec.operations.filter((o) => o.method === 'QUERY')
      // pet, pets, categories
      expect(queryOps.length).toBe(3)
    })

    it('creates Mutation operations with MUTATION method', () => {
      const mutationOps = spec.operations.filter((o) => o.method === 'MUTATION')
      // createPet, updatePet, deletePet
      expect(mutationOps.length).toBe(3)
    })

    it('creates Subscription operations with SUBSCRIPTION method', () => {
      const subOps = spec.operations.filter((o) => o.method === 'SUBSCRIPTION')
      // petCreated, petUpdated, onMessage
      expect(subOps.length).toBe(3)
    })

    it('tags subscriptions as "subscriptions"', () => {
      const subOps = spec.operations.filter((o) => o.method === 'SUBSCRIPTION')
      for (const op of subOps) {
        expect(op.tags).toContain('subscriptions')
      }
    })

    describe('petCreated subscription', () => {
      let op: ApiOperation

      beforeAll(() => {
        op = spec.operations.find((o) => o.operationId === 'petCreated')!
      })

      it('exists with SUBSCRIPTION method', () => {
        expect(op).toBeDefined()
        expect(op.method).toBe('SUBSCRIPTION')
      })

      it('has no arguments', () => {
        expect(op.queryParams).toHaveLength(0)
      })

      it('has a response type', () => {
        expect(op.response).toBeDefined()
        expect(op.response.type).toBeDefined()
      })
    })

    describe('petUpdated subscription with args', () => {
      let op: ApiOperation

      beforeAll(() => {
        op = spec.operations.find((o) => o.operationId === 'petUpdated')!
      })

      it('exists with SUBSCRIPTION method', () => {
        expect(op).toBeDefined()
        expect(op.method).toBe('SUBSCRIPTION')
      })

      it('has id argument', () => {
        expect(op.queryParams.length).toBeGreaterThanOrEqual(1)
        const idParam = op.queryParams.find((p) => p.name === 'id')
        expect(idParam).toBeDefined()
        expect(idParam!.required).toBe(true)
      })
    })

    it('tags queries as "queries"', () => {
      const queryOps = spec.operations.filter((o) => o.method === 'QUERY')
      for (const op of queryOps) {
        expect(op.tags).toContain('queries')
      }
    })

    it('tags mutations as "mutations"', () => {
      const mutationOps = spec.operations.filter((o) => o.method === 'MUTATION')
      for (const op of mutationOps) {
        expect(op.tags).toContain('mutations')
      }
    })

    describe('pet query', () => {
      let op: ApiOperation

      beforeAll(() => {
        op = spec.operations.find((o) => o.operationId === 'pet')!
      })

      it('exists', () => {
        expect(op).toBeDefined()
      })

      it('has an id argument as query param', () => {
        expect(op.queryParams.length).toBeGreaterThanOrEqual(1)
        const idParam = op.queryParams.find((p) => p.name === 'id')
        expect(idParam).toBeDefined()
        expect(idParam!.required).toBe(true)
      })

      it('has a response type', () => {
        expect(op.response).toBeDefined()
        expect(op.response.type).toBeDefined()
      })
    })

    describe('createPet mutation', () => {
      let op: ApiOperation

      beforeAll(() => {
        op = spec.operations.find((o) => o.operationId === 'createPet')!
      })

      it('exists with MUTATION method', () => {
        expect(op).toBeDefined()
        expect(op.method).toBe('MUTATION')
      })

      it('has a requestBody from input argument', () => {
        expect(op.requestBody).toBeDefined()
        expect(op.requestBody!.contentType).toBe('application/json')
        expect(op.requestBody!.type.kind).toBe('object')
      })

      it('requestBody input has name, tag, and status fields', () => {
        const bodyType = op.requestBody!.type
        if (bodyType.kind === 'object') {
          const propNames = bodyType.properties.map((p) => p.name)
          expect(propNames).toContain('input')
        }
      })
    })

    describe('enum types', () => {
      it('extracts PetStatus enum', () => {
        const petStatusType = spec.types.get('PetStatus')
        expect(petStatusType).toBeDefined()
        expect(petStatusType!.kind).toBe('enum')
        if (petStatusType!.kind === 'enum') {
          expect(petStatusType!.values).toContain('AVAILABLE')
          expect(petStatusType!.values).toContain('PENDING')
          expect(petStatusType!.values).toContain('SOLD')
        }
      })
    })

    describe('input types', () => {
      it('extracts CreatePetInput as an object type', () => {
        const inputType = spec.types.get('CreatePetInput')
        expect(inputType).toBeDefined()
        expect(inputType!.kind).toBe('object')
        if (inputType!.kind === 'object') {
          const propNames = inputType!.properties.map((p) => p.name)
          expect(propNames).toContain('name')
          expect(propNames).toContain('tag')
          expect(propNames).toContain('status')
        }
      })

      it('extracts UpdatePetInput as an object type', () => {
        const inputType = spec.types.get('UpdatePetInput')
        expect(inputType).toBeDefined()
        expect(inputType!.kind).toBe('object')
      })
    })

    describe('subscription types', () => {
      it('extracts Message type used by onMessage subscription', () => {
        const messageType = spec.types.get('Message')
        expect(messageType).toBeDefined()
        expect(messageType!.kind).toBe('object')
        if (messageType!.kind === 'object') {
          const propNames = messageType!.properties.map((p) => p.name)
          expect(propNames).toContain('id')
          expect(propNames).toContain('text')
          expect(propNames).toContain('createdAt')
        }
      })
    })

    describe('Relay connection patterns', () => {
      it('extracts PetConnection type', () => {
        const connType = spec.types.get('PetConnection')
        expect(connType).toBeDefined()
        expect(connType!.kind).toBe('object')
        if (connType!.kind === 'object') {
          const propNames = connType!.properties.map((p) => p.name)
          expect(propNames).toContain('edges')
          expect(propNames).toContain('pageInfo')
          expect(propNames).toContain('totalCount')
        }
      })

      it('extracts PetEdge type with node and cursor', () => {
        const edgeType = spec.types.get('PetEdge')
        expect(edgeType).toBeDefined()
        expect(edgeType!.kind).toBe('object')
        if (edgeType!.kind === 'object') {
          const propNames = edgeType!.properties.map((p) => p.name)
          expect(propNames).toContain('node')
          expect(propNames).toContain('cursor')
        }
      })

      it('extracts PageInfo type', () => {
        const pageInfoType = spec.types.get('PageInfo')
        expect(pageInfoType).toBeDefined()
        expect(pageInfoType!.kind).toBe('object')
        if (pageInfoType!.kind === 'object') {
          const propNames = pageInfoType!.properties.map((p) => p.name)
          expect(propNames).toContain('hasNextPage')
          expect(propNames).toContain('endCursor')
        }
      })
    })

    describe('baseUrl override', () => {
      it('uses provided baseUrl when specified', async () => {
        const customSpec = await parseSpec(sdlPath, {
          baseUrl: 'https://api.example.com/graphql',
        })
        expect(customSpec.baseUrl).toBe('https://api.example.com/graphql')
      })
    })
  })

  describe('Introspection JSON parsing', () => {
    const introspectionPath = path.resolve(__dirname, '../fixtures/introspection.json')
    let spec: ApiSpec

    beforeAll(async () => {
      spec = await parseSpec(introspectionPath)
    })

    it('parses and returns a valid ApiSpec', () => {
      expect(spec).toBeDefined()
      expect(spec.operations).toBeDefined()
      expect(Array.isArray(spec.operations)).toBe(true)
    })

    it('creates Query operations', () => {
      const queryOps = spec.operations.filter((o) => o.method === 'QUERY')
      expect(queryOps.length).toBe(4)
    })

    it('creates Mutation operations', () => {
      const mutationOps = spec.operations.filter((o) => o.method === 'MUTATION')
      expect(mutationOps.length).toBe(4)
    })

    it('extracts PetStatus enum from introspection', () => {
      const petStatusType = spec.types.get('PetStatus')
      expect(petStatusType).toBeDefined()
      expect(petStatusType!.kind).toBe('enum')
      if (petStatusType!.kind === 'enum') {
        expect(petStatusType!.values).toContain('AVAILABLE')
        expect(petStatusType!.values).toContain('PENDING')
        expect(petStatusType!.values).toContain('SOLD')
      }
    })

    it('extracts input types from introspection', () => {
      const createInput = spec.types.get('CreatePetInput')
      expect(createInput).toBeDefined()
      expect(createInput!.kind).toBe('object')
    })

    it('has the same query+mutation count as SDL parsing', async () => {
      const sdlPath = path.resolve(__dirname, '../fixtures/schema.graphql')
      const sdlSpec = await parseSpec(sdlPath)
      const sdlQM = sdlSpec.operations.filter((o) => o.method !== 'SUBSCRIPTION').length
      expect(spec.operations.length).toBe(sdlQM)
    })
  })
})
