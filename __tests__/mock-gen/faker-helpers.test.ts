import { emitMockValue, emitMockDataFile, emitMockDataFunction } from '../../src/mock-gen/index'
import type { ApiType, ApiSpec } from '../../src/ir/types'
import {
  createMockSpec,
  createGetOperation,
  createPostOperation,
} from '../helpers'

/** Minimal spec for passing to emitMockValue */
function minimalSpec(): ApiSpec {
  return {
    title: 'Test',
    baseUrl: '',
    version: '1.0.0',
    operations: [],
    types: new Map(),
  }
}

describe('emitMockValue', () => {
  describe('primitive types', () => {
    it('generates string mock value for string type', () => {
      const type: ApiType = { kind: 'primitive', type: 'string' }
      const result = emitMockValue(type, minimalSpec())
      expect(result).toContain('string-value-')
    })

    it('generates number mock value for integer type', () => {
      const type: ApiType = { kind: 'primitive', type: 'integer' }
      const result = emitMockValue(type, minimalSpec())
      expect(result).toMatch(/^\d+$/)
    })

    it('generates number mock value for number type', () => {
      const type: ApiType = { kind: 'primitive', type: 'number' }
      const result = emitMockValue(type, minimalSpec())
      expect(result).toMatch(/^\d+$/)
    })

    it('generates true for boolean type', () => {
      const type: ApiType = { kind: 'primitive', type: 'boolean' }
      expect(emitMockValue(type, minimalSpec())).toBe('true')
    })

    it('generates null for null type', () => {
      const type: ApiType = { kind: 'primitive', type: 'null' }
      expect(emitMockValue(type, minimalSpec())).toBe('null')
    })
  })

  describe('string format handling', () => {
    it('generates email mock for email format', () => {
      const type: ApiType = { kind: 'primitive', type: 'string', format: 'email' }
      expect(emitMockValue(type, minimalSpec())).toBe("'user@example.com'")
    })

    it('generates uuid mock for uuid format', () => {
      const type: ApiType = { kind: 'primitive', type: 'string', format: 'uuid' }
      expect(emitMockValue(type, minimalSpec())).toBe("'00000000-0000-0000-0000-000000000001'")
    })

    it('generates date-time mock for date-time format', () => {
      const type: ApiType = { kind: 'primitive', type: 'string', format: 'date-time' }
      expect(emitMockValue(type, minimalSpec())).toBe("'2024-01-01T00:00:00Z'")
    })

    it('generates url mock for uri format', () => {
      const type: ApiType = { kind: 'primitive', type: 'string', format: 'uri' }
      expect(emitMockValue(type, minimalSpec())).toBe("'https://example.com'")
    })

    it('generates url mock for url format', () => {
      const type: ApiType = { kind: 'primitive', type: 'string', format: 'url' }
      expect(emitMockValue(type, minimalSpec())).toBe("'https://example.com'")
    })

    it('generates date mock for date format', () => {
      const type: ApiType = { kind: 'primitive', type: 'string', format: 'date' }
      expect(emitMockValue(type, minimalSpec())).toBe("'2024-01-01'")
    })
  })

  describe('object mock generation', () => {
    it('generates object mock with properties', () => {
      const type: ApiType = {
        kind: 'object',
        properties: [
          { name: 'id', type: { kind: 'primitive', type: 'integer' }, required: true },
          { name: 'name', type: { kind: 'primitive', type: 'string' }, required: true },
        ],
      }
      const result = emitMockValue(type, minimalSpec())
      expect(result).toContain('{')
      expect(result).toContain('}')
      expect(result).toContain('id:')
      expect(result).toContain('name:')
    })

    it('generates empty object for object with no properties', () => {
      const type: ApiType = {
        kind: 'object',
        properties: [],
      }
      expect(emitMockValue(type, minimalSpec())).toBe('{}')
    })
  })

  describe('array mock generation', () => {
    it('generates single-element array mock', () => {
      const type: ApiType = {
        kind: 'array',
        items: { kind: 'primitive', type: 'string' },
      }
      const result = emitMockValue(type, minimalSpec())
      expect(result).toMatch(/^\[.*\]$/)
    })

    it('generates array of objects', () => {
      const type: ApiType = {
        kind: 'array',
        items: {
          kind: 'object',
          properties: [
            { name: 'id', type: { kind: 'primitive', type: 'integer' }, required: true },
          ],
        },
      }
      const result = emitMockValue(type, minimalSpec())
      expect(result).toContain('[')
      expect(result).toContain(']')
      expect(result).toContain('id:')
    })
  })

  describe('enum mock generation', () => {
    it('returns first string enum value', () => {
      const type: ApiType = {
        kind: 'enum',
        values: ['active', 'inactive'],
      }
      expect(emitMockValue(type, minimalSpec())).toBe("'active'")
    })

    it('returns first numeric enum value', () => {
      const type: ApiType = {
        kind: 'enum',
        values: [42, 99],
      }
      expect(emitMockValue(type, minimalSpec())).toBe('42')
    })

    it('returns null for empty enum', () => {
      const type: ApiType = {
        kind: 'enum',
        values: [],
      }
      expect(emitMockValue(type, minimalSpec())).toBe('null')
    })
  })

  describe('union mock generation', () => {
    it('uses first variant for union', () => {
      const type: ApiType = {
        kind: 'union',
        variants: [
          { kind: 'primitive', type: 'string' },
          { kind: 'primitive', type: 'number' },
        ],
      }
      const result = emitMockValue(type, minimalSpec())
      expect(result).toContain('string-value-')
    })

    it('returns null for empty union', () => {
      const type: ApiType = {
        kind: 'union',
        variants: [],
      }
      expect(emitMockValue(type, minimalSpec())).toBe('null')
    })
  })

  describe('ref mock generation', () => {
    it('resolves ref types from spec.types', () => {
      const spec = minimalSpec()
      spec.types.set('Pet', {
        kind: 'object',
        properties: [
          { name: 'id', type: { kind: 'primitive', type: 'integer' }, required: true },
          { name: 'name', type: { kind: 'primitive', type: 'string' }, required: true },
        ],
      })
      const type: ApiType = { kind: 'ref', name: 'Pet' }
      const result = emitMockValue(type, spec)
      expect(result).toContain('id:')
      expect(result).toContain('name:')
    })

    it('returns empty object for unresolved ref', () => {
      const type: ApiType = { kind: 'ref', name: 'NonExistent' }
      expect(emitMockValue(type, minimalSpec())).toBe('{}')
    })
  })

  describe('depth limiting', () => {
    it('returns null when depth exceeds 5', () => {
      const type: ApiType = { kind: 'primitive', type: 'string' }
      expect(emitMockValue(type, minimalSpec(), 6)).toBe('null')
    })
  })
})

describe('emitMockDataFunction', () => {
  it('generates a named function for an operation', () => {
    const op = createGetOperation()
    const spec = createMockSpec()
    const result = emitMockDataFunction(op, spec)
    expect(result).toContain('export function generateListPetsMock()')
    expect(result).toContain('return')
  })

  it('generates function with correct name for POST operation', () => {
    const op = createPostOperation()
    const spec = createMockSpec()
    const result = emitMockDataFunction(op, spec)
    expect(result).toContain('export function generateCreatePetMock()')
  })
})

describe('emitMockDataFile', () => {
  it('generates full mock data file with header', () => {
    const spec = createMockSpec()
    const result = emitMockDataFile(spec)
    expect(result).toContain('Mock data generators')
    expect(result).toContain('Generated by auto-api-hooks')
  })

  it('includes mock functions for all operations', () => {
    const spec = createMockSpec()
    const result = emitMockDataFile(spec)
    expect(result).toContain('generateListPetsMock')
    expect(result).toContain('generateCreatePetMock')
  })

  it('produces deterministic mock data (counters reset per operation)', () => {
    const spec = createMockSpec([createGetOperation()])
    const result1 = emitMockDataFile(spec)
    const result2 = emitMockDataFile(spec)
    expect(result1).toBe(result2)
  })
})
