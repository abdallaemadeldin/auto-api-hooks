import path from 'node:path'
import fs from 'node:fs'
import { parseSpec, ParseError } from '../../src/parsers/index'

describe('Parser Factory (parseSpec)', () => {
  describe('error handling', () => {
    it('throws ParseError on empty object', async () => {
      await expect(parseSpec({})).rejects.toThrow(ParseError)
    })

    it('throws ParseError on null-ish input', async () => {
      await expect(parseSpec({} as any)).rejects.toThrow(ParseError)
    })

    it('throws ParseError on unrecognized object structure', async () => {
      await expect(
        parseSpec({ foo: 'bar', baz: 123 }),
      ).rejects.toThrow('Unable to detect API specification format')
    })

    it('throws ParseError for nonexistent file', async () => {
      await expect(parseSpec('/does/not/exist.yaml')).rejects.toThrow(ParseError)
    })
  })

  describe('auto-detection: OpenAPI 3.x', () => {
    it('detects OpenAPI 3.x from object with openapi field', async () => {
      const specPath = path.resolve(__dirname, '../fixtures/petstore-openapi3.yaml')
      const spec = await parseSpec(specPath)
      expect(spec.title).toBe('Petstore')
      expect(spec.operations.length).toBeGreaterThan(0)
    })

    it('detects OpenAPI 3.x from inline object', async () => {
      const spec = await parseSpec({
        openapi: '3.0.0',
        info: { title: 'Inline API', version: '1.0.0' },
        paths: {},
      })
      expect(spec.title).toBe('Inline API')
    })
  })

  describe('auto-detection: Swagger 2.0', () => {
    it('detects Swagger 2.0 from object with swagger field', async () => {
      const specPath = path.resolve(__dirname, '../fixtures/petstore-swagger2.json')
      const spec = await parseSpec(specPath)
      expect(spec.title).toBe('Petstore')
      expect(spec.operations.length).toBeGreaterThan(0)
    })

    it('detects Swagger 2.0 from inline object', async () => {
      const spec = await parseSpec({
        swagger: '2.0',
        info: { title: 'Inline Swagger', version: '2.0.0' },
        paths: {},
      })
      expect(spec.title).toBe('Inline Swagger')
    })
  })

  describe('auto-detection: GraphQL SDL', () => {
    it('detects GraphQL SDL from .graphql file', async () => {
      const specPath = path.resolve(__dirname, '../fixtures/schema.graphql')
      const spec = await parseSpec(specPath)
      expect(spec.title).toBe('GraphQL API')
      expect(spec.operations.length).toBeGreaterThan(0)
    })

    it('detects GraphQL introspection from .json file', async () => {
      const specPath = path.resolve(__dirname, '../fixtures/introspection.json')
      const spec = await parseSpec(specPath)
      expect(spec.title).toBe('GraphQL API')
    })

    it('detects GraphQL SDL from inline string', async () => {
      const sdl = `
        type Query {
          hello: String
        }
      `
      const spec = await parseSpec(sdl)
      expect(spec.title).toBe('GraphQL API')
      expect(spec.operations.length).toBe(1)
      expect(spec.operations[0].operationId).toBe('hello')
    })
  })

  describe('baseUrl option override', () => {
    it('overrides OpenAPI server URL', async () => {
      const specPath = path.resolve(__dirname, '../fixtures/petstore-openapi3.yaml')
      const spec = await parseSpec(specPath, {
        baseUrl: 'https://override.example.com',
      })
      expect(spec.baseUrl).toBe('https://override.example.com')
    })

    it('overrides Swagger host+basePath', async () => {
      const specPath = path.resolve(__dirname, '../fixtures/petstore-swagger2.json')
      const spec = await parseSpec(specPath, {
        baseUrl: 'https://override.example.com/v3',
      })
      expect(spec.baseUrl).toBe('https://override.example.com/v3')
    })

    it('overrides GraphQL default baseUrl', async () => {
      const specPath = path.resolve(__dirname, '../fixtures/schema.graphql')
      const spec = await parseSpec(specPath, {
        baseUrl: 'https://api.example.com/gql',
      })
      expect(spec.baseUrl).toBe('https://api.example.com/gql')
    })
  })
})
