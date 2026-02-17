import {
  emitTypeScriptTypes,
  emitTypeString,
  emitParamsInterface,
  emitRequestBodyType,
  emitResponseType,
} from '../../src/type-gen/index'
import type { ApiType, ApiOperation } from '../../src/ir/types'
import {
  createMockSpec,
  createGetOperation,
  createPostOperation,
  createDetailOperation,
  createSpecWithNamedTypes,
} from '../helpers'

describe('emitTypeString', () => {
  describe('primitive types', () => {
    it('emits string for string primitive', () => {
      const type: ApiType = { kind: 'primitive', type: 'string' }
      expect(emitTypeString(type)).toBe('string')
    })

    it('emits number for number primitive', () => {
      const type: ApiType = { kind: 'primitive', type: 'number' }
      expect(emitTypeString(type)).toBe('number')
    })

    it('emits number for integer primitive', () => {
      const type: ApiType = { kind: 'primitive', type: 'integer' }
      expect(emitTypeString(type)).toBe('number')
    })

    it('emits boolean for boolean primitive', () => {
      const type: ApiType = { kind: 'primitive', type: 'boolean' }
      expect(emitTypeString(type)).toBe('boolean')
    })

    it('emits null for null primitive', () => {
      const type: ApiType = { kind: 'primitive', type: 'null' }
      expect(emitTypeString(type)).toBe('null')
    })

    it('emits unknown for unknown primitive', () => {
      const type: ApiType = { kind: 'primitive', type: 'unknown' }
      expect(emitTypeString(type)).toBe('unknown')
    })
  })

  describe('object types', () => {
    it('emits inline object with properties', () => {
      const type: ApiType = {
        kind: 'object',
        properties: [
          { name: 'id', type: { kind: 'primitive', type: 'integer' }, required: true },
          { name: 'name', type: { kind: 'primitive', type: 'string' }, required: true },
        ],
      }
      const result = emitTypeString(type)
      expect(result).toContain('id: number')
      expect(result).toContain('name: string')
    })

    it('marks optional properties with ?', () => {
      const type: ApiType = {
        kind: 'object',
        properties: [
          { name: 'id', type: { kind: 'primitive', type: 'integer' }, required: true },
          { name: 'tag', type: { kind: 'primitive', type: 'string' }, required: false },
        ],
      }
      const result = emitTypeString(type)
      expect(result).toContain('id: number')
      expect(result).toContain('tag?: string')
    })

    it('emits Record<string, unknown> for empty object', () => {
      const type: ApiType = {
        kind: 'object',
        properties: [],
      }
      expect(emitTypeString(type)).toBe('Record<string, unknown>')
    })

    it('handles nested objects', () => {
      const type: ApiType = {
        kind: 'object',
        properties: [
          {
            name: 'address',
            type: {
              kind: 'object',
              properties: [
                { name: 'street', type: { kind: 'primitive', type: 'string' }, required: true },
                { name: 'city', type: { kind: 'primitive', type: 'string' }, required: true },
              ],
            },
            required: true,
          },
        ],
      }
      const result = emitTypeString(type)
      expect(result).toContain('address:')
      expect(result).toContain('street: string')
      expect(result).toContain('city: string')
    })

    it('handles additionalProperties as true', () => {
      const type: ApiType = {
        kind: 'object',
        properties: [
          { name: 'id', type: { kind: 'primitive', type: 'integer' }, required: true },
        ],
        additionalProperties: true,
      }
      const result = emitTypeString(type)
      expect(result).toContain('[key: string]: unknown')
    })

    it('handles additionalProperties as a type', () => {
      const type: ApiType = {
        kind: 'object',
        properties: [],
        additionalProperties: { kind: 'primitive', type: 'string' },
      }
      const result = emitTypeString(type)
      expect(result).toContain('[key: string]: string')
    })
  })

  describe('array types', () => {
    it('emits T[] for simple array types', () => {
      const type: ApiType = {
        kind: 'array',
        items: { kind: 'primitive', type: 'string' },
      }
      expect(emitTypeString(type)).toBe('string[]')
    })

    it('emits Array<T> for complex inner types', () => {
      const type: ApiType = {
        kind: 'array',
        items: {
          kind: 'union',
          variants: [
            { kind: 'primitive', type: 'string' },
            { kind: 'primitive', type: 'number' },
          ],
        },
      }
      const result = emitTypeString(type)
      expect(result).toBe('Array<string | number>')
    })

    it('emits Array<T> for object inner types', () => {
      const type: ApiType = {
        kind: 'array',
        items: {
          kind: 'object',
          properties: [
            { name: 'id', type: { kind: 'primitive', type: 'integer' }, required: true },
          ],
        },
      }
      const result = emitTypeString(type)
      expect(result).toContain('Array<')
    })
  })

  describe('enum types', () => {
    it('emits string literal union for string enums', () => {
      const type: ApiType = {
        kind: 'enum',
        values: ['active', 'inactive', 'pending'],
      }
      const result = emitTypeString(type)
      expect(result).toBe("'active' | 'inactive' | 'pending'")
    })

    it('emits numeric literal union for number enums', () => {
      const type: ApiType = {
        kind: 'enum',
        values: [1, 2, 3],
      }
      expect(emitTypeString(type)).toBe('1 | 2 | 3')
    })

    it('emits never for empty enum', () => {
      const type: ApiType = {
        kind: 'enum',
        values: [],
      }
      expect(emitTypeString(type)).toBe('never')
    })
  })

  describe('union types', () => {
    it('emits A | B for union types', () => {
      const type: ApiType = {
        kind: 'union',
        variants: [
          { kind: 'primitive', type: 'string' },
          { kind: 'primitive', type: 'number' },
        ],
      }
      expect(emitTypeString(type)).toBe('string | number')
    })

    it('emits single variant directly for single-variant union', () => {
      const type: ApiType = {
        kind: 'union',
        variants: [{ kind: 'primitive', type: 'string' }],
      }
      expect(emitTypeString(type)).toBe('string')
    })

    it('emits never for empty union', () => {
      const type: ApiType = {
        kind: 'union',
        variants: [],
      }
      expect(emitTypeString(type)).toBe('never')
    })
  })

  describe('ref types', () => {
    it('emits PascalCase type name for ref types', () => {
      const type: ApiType = { kind: 'ref', name: 'Pet' }
      expect(emitTypeString(type)).toBe('Pet')
    })

    it('converts to PascalCase', () => {
      const type: ApiType = { kind: 'ref', name: 'pet-status' }
      expect(emitTypeString(type)).toBe('PetStatus')
    })
  })
})

describe('emitParamsInterface', () => {
  it('returns null for operations with no parameters', () => {
    const op = createPostOperation()
    const result = emitParamsInterface(op)
    expect(result).toBeNull()
  })

  it('generates params interface for query params', () => {
    const op = createGetOperation()
    const result = emitParamsInterface(op)
    expect(result).not.toBeNull()
    expect(result).toContain('export interface ListPetsParams')
    expect(result).toContain('limit')
  })

  it('generates params interface for path params', () => {
    const op = createDetailOperation()
    const result = emitParamsInterface(op)
    expect(result).not.toBeNull()
    expect(result).toContain('export interface GetPetParams')
    expect(result).toContain('petId')
  })

  it('marks required params without ?', () => {
    const op = createDetailOperation()
    const result = emitParamsInterface(op)!
    expect(result).toContain('petId: string')
    expect(result).not.toContain('petId?')
  })

  it('marks optional params with ?', () => {
    const op = createGetOperation()
    const result = emitParamsInterface(op)!
    expect(result).toContain('limit?')
  })
})

describe('emitRequestBodyType', () => {
  it('returns null for operations with no request body', () => {
    const op = createGetOperation()
    const result = emitRequestBodyType(op)
    expect(result).toBeNull()
  })

  it('generates body type for POST operations', () => {
    const op = createPostOperation()
    const result = emitRequestBodyType(op)
    expect(result).not.toBeNull()
    expect(result).toContain('export type CreatePetBody')
    expect(result).toContain('name: string')
    expect(result).toContain('tag?: string')
  })
})

describe('emitResponseType', () => {
  it('generates response type for operations', () => {
    const op = createGetOperation()
    const result = emitResponseType(op)
    expect(result).toContain('export type ListPetsResponse')
  })

  it('generates correct response type for POST', () => {
    const op = createPostOperation()
    const result = emitResponseType(op)
    expect(result).toContain('export type CreatePetResponse')
  })
})

describe('emitTypeScriptTypes', () => {
  it('generates full types file with file header', () => {
    const spec = createMockSpec()
    const result = emitTypeScriptTypes(spec)
    expect(result).toContain('Auto-generated TypeScript types')
    expect(result).toContain('Test API')
    expect(result).toContain('v1.0.0')
  })

  it('includes per-operation param, body, and response types', () => {
    const spec = createMockSpec()
    const result = emitTypeScriptTypes(spec)
    expect(result).toContain('ListPetsParams')
    expect(result).toContain('ListPetsResponse')
    expect(result).toContain('CreatePetBody')
    expect(result).toContain('CreatePetResponse')
  })

  it('includes named types from spec.types', () => {
    const spec = createSpecWithNamedTypes()
    const result = emitTypeScriptTypes(spec)
    expect(result).toContain('export interface Pet')
    expect(result).toContain('PetStatus')
    expect(result).toContain("'available'")
    expect(result).toContain("'pending'")
    expect(result).toContain("'sold'")
  })

  it('contains eslint/tslint disable comments', () => {
    const spec = createMockSpec()
    const result = emitTypeScriptTypes(spec)
    expect(result).toContain('/* eslint-disable */')
    expect(result).toContain('/* tslint:disable */')
  })
})
