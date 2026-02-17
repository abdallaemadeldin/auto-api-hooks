import { emitZodSchemas, emitZodType } from '../../src/type-gen/index'
import type { ApiType } from '../../src/ir/types'
import {
  createMockSpec,
  createGetOperation,
  createPostOperation,
  createSpecWithNamedTypes,
} from '../helpers'

describe('emitZodType', () => {
  describe('primitive types', () => {
    it('emits z.string() for string', () => {
      const type: ApiType = { kind: 'primitive', type: 'string' }
      expect(emitZodType(type)).toBe('z.string()')
    })

    it('emits z.number() for number', () => {
      const type: ApiType = { kind: 'primitive', type: 'number' }
      expect(emitZodType(type)).toBe('z.number()')
    })

    it('emits z.number().int() for integer', () => {
      const type: ApiType = { kind: 'primitive', type: 'integer' }
      expect(emitZodType(type)).toBe('z.number().int()')
    })

    it('emits z.boolean() for boolean', () => {
      const type: ApiType = { kind: 'primitive', type: 'boolean' }
      expect(emitZodType(type)).toBe('z.boolean()')
    })

    it('emits z.null() for null', () => {
      const type: ApiType = { kind: 'primitive', type: 'null' }
      expect(emitZodType(type)).toBe('z.null()')
    })

    it('emits z.unknown() for unknown', () => {
      const type: ApiType = { kind: 'primitive', type: 'unknown' }
      expect(emitZodType(type)).toBe('z.unknown()')
    })
  })

  describe('string format refinements', () => {
    it('emits z.string().datetime() for date-time', () => {
      const type: ApiType = { kind: 'primitive', type: 'string', format: 'date-time' }
      expect(emitZodType(type)).toBe('z.string().datetime()')
    })

    it('emits z.string().email() for email', () => {
      const type: ApiType = { kind: 'primitive', type: 'string', format: 'email' }
      expect(emitZodType(type)).toBe('z.string().email()')
    })

    it('emits z.string().uuid() for uuid', () => {
      const type: ApiType = { kind: 'primitive', type: 'string', format: 'uuid' }
      expect(emitZodType(type)).toBe('z.string().uuid()')
    })

    it('emits z.string().url() for uri', () => {
      const type: ApiType = { kind: 'primitive', type: 'string', format: 'uri' }
      expect(emitZodType(type)).toBe('z.string().url()')
    })

    it('emits z.string().url() for url format', () => {
      const type: ApiType = { kind: 'primitive', type: 'string', format: 'url' }
      expect(emitZodType(type)).toBe('z.string().url()')
    })

    it('emits plain z.string() for unknown format', () => {
      const type: ApiType = { kind: 'primitive', type: 'string', format: 'binary' }
      expect(emitZodType(type)).toBe('z.string()')
    })
  })

  describe('object types', () => {
    it('emits z.object({...}) with properties', () => {
      const type: ApiType = {
        kind: 'object',
        properties: [
          { name: 'id', type: { kind: 'primitive', type: 'integer' }, required: true },
          { name: 'name', type: { kind: 'primitive', type: 'string' }, required: true },
        ],
      }
      const result = emitZodType(type)
      expect(result).toContain('z.object(')
      expect(result).toContain('id: z.number().int()')
      expect(result).toContain('name: z.string()')
    })

    it('marks optional properties with .optional()', () => {
      const type: ApiType = {
        kind: 'object',
        properties: [
          { name: 'id', type: { kind: 'primitive', type: 'integer' }, required: true },
          { name: 'tag', type: { kind: 'primitive', type: 'string' }, required: false },
        ],
      }
      const result = emitZodType(type)
      expect(result).toContain('id: z.number().int(),')
      expect(result).toContain('tag: z.string().optional(),')
    })

    it('emits z.record for empty object', () => {
      const type: ApiType = {
        kind: 'object',
        properties: [],
      }
      expect(emitZodType(type)).toBe('z.record(z.string(), z.unknown())')
    })

    it('handles catchall for additionalProperties', () => {
      const type: ApiType = {
        kind: 'object',
        properties: [
          { name: 'id', type: { kind: 'primitive', type: 'integer' }, required: true },
        ],
        additionalProperties: true,
      }
      const result = emitZodType(type)
      expect(result).toContain('.catchall(z.unknown())')
    })
  })

  describe('array types', () => {
    it('emits z.array() for array types', () => {
      const type: ApiType = {
        kind: 'array',
        items: { kind: 'primitive', type: 'string' },
      }
      expect(emitZodType(type)).toBe('z.array(z.string())')
    })

    it('handles nested array of objects', () => {
      const type: ApiType = {
        kind: 'array',
        items: {
          kind: 'object',
          properties: [
            { name: 'id', type: { kind: 'primitive', type: 'integer' }, required: true },
          ],
        },
      }
      const result = emitZodType(type)
      expect(result).toContain('z.array(z.object(')
    })
  })

  describe('enum types', () => {
    it('emits z.enum([...]) for string enums', () => {
      const type: ApiType = {
        kind: 'enum',
        values: ['active', 'inactive', 'pending'],
      }
      expect(emitZodType(type)).toBe("z.enum(['active', 'inactive', 'pending'])")
    })

    it('emits z.union of z.literal for mixed enums', () => {
      const type: ApiType = {
        kind: 'enum',
        values: [1, 'active', 2],
      }
      const result = emitZodType(type)
      expect(result).toContain('z.union([')
      expect(result).toContain('z.literal(1)')
      expect(result).toContain("z.literal('active')")
      expect(result).toContain('z.literal(2)')
    })

    it('emits z.never() for empty enum', () => {
      const type: ApiType = { kind: 'enum', values: [] }
      expect(emitZodType(type)).toBe('z.never()')
    })
  })

  describe('union types', () => {
    it('emits z.union([...]) for multi-variant unions', () => {
      const type: ApiType = {
        kind: 'union',
        variants: [
          { kind: 'primitive', type: 'string' },
          { kind: 'primitive', type: 'number' },
        ],
      }
      expect(emitZodType(type)).toBe('z.union([z.string(), z.number()])')
    })

    it('emits single variant directly for single-variant union', () => {
      const type: ApiType = {
        kind: 'union',
        variants: [{ kind: 'primitive', type: 'string' }],
      }
      expect(emitZodType(type)).toBe('z.string()')
    })

    it('emits z.never() for empty union', () => {
      const type: ApiType = { kind: 'union', variants: [] }
      expect(emitZodType(type)).toBe('z.never()')
    })
  })

  describe('ref types', () => {
    it('emits camelCase schema variable name', () => {
      const type: ApiType = { kind: 'ref', name: 'Pet' }
      expect(emitZodType(type)).toBe('petSchema')
    })
  })
})

describe('emitZodSchemas', () => {
  it('includes zod import', () => {
    const spec = createMockSpec()
    const result = emitZodSchemas(spec)
    expect(result).toContain("import { z } from 'zod'")
  })

  it('includes file header', () => {
    const spec = createMockSpec()
    const result = emitZodSchemas(spec)
    expect(result).toContain('Auto-generated Zod schemas')
    expect(result).toContain('Test API')
    expect(result).toContain('v1.0.0')
  })

  it('generates per-operation response schemas', () => {
    const spec = createMockSpec()
    const result = emitZodSchemas(spec)
    expect(result).toContain('listPetsResponseSchema')
    expect(result).toContain('createPetResponseSchema')
  })

  it('generates named type schemas', () => {
    const spec = createSpecWithNamedTypes()
    const result = emitZodSchemas(spec)
    expect(result).toContain('petSchema')
    expect(result).toContain('petStatusSchema')
  })

  it('generates z.object for object named types', () => {
    const spec = createSpecWithNamedTypes()
    const result = emitZodSchemas(spec)
    expect(result).toContain('petSchema = z.object(')
  })

  it('generates z.enum for enum named types', () => {
    const spec = createSpecWithNamedTypes()
    const result = emitZodSchemas(spec)
    expect(result).toContain("petStatusSchema = z.enum(['available', 'pending', 'sold'])")
  })

  it('contains eslint/tslint disable comments', () => {
    const spec = createMockSpec()
    const result = emitZodSchemas(spec)
    expect(result).toContain('/* eslint-disable */')
    expect(result).toContain('/* tslint:disable */')
  })
})
