import { createGenerator, generateHooks } from '../../src/generators/index'
import { FetchGenerator } from '../../src/generators/fetch-generator'
import type { GeneratorOptions } from '../../src/generators/types'
import {
  createMockSpec,
  createGetOperation,
  createPostOperation,
  createDetailOperation,
  createSubscriptionOperation,
  createSubscriptionWithArgsOperation,
} from '../helpers'

const defaultOptions: GeneratorOptions = {
  fetcher: 'fetch',
  zod: false,
  mock: false,
  outputDir: './out',
  infiniteQueries: false,
}

describe('FetchGenerator', () => {
  describe('createGenerator', () => {
    it('returns a FetchGenerator instance for "fetch" strategy', () => {
      const generator = createGenerator('fetch')
      expect(generator).toBeInstanceOf(FetchGenerator)
    })
  })

  describe('generateHooks', () => {
    it('returns an array of generated files', () => {
      const spec = createMockSpec()
      const files = generateHooks(spec, defaultOptions)
      expect(Array.isArray(files)).toBe(true)
      expect(files.length).toBeGreaterThan(0)
    })

    it('generates types.ts', () => {
      const spec = createMockSpec()
      const files = generateHooks(spec, defaultOptions)
      const typesFile = files.find((f) => f.path === 'types.ts')
      expect(typesFile).toBeDefined()
      expect(typesFile!.content).toContain('ListPetsResponse')
      expect(typesFile!.content).toContain('CreatePetResponse')
    })

    it('generates client.ts with getClientConfig', () => {
      const spec = createMockSpec()
      const files = generateHooks(spec, defaultOptions)
      const clientFile = files.find((f) => f.path === 'client.ts')
      expect(clientFile).toBeDefined()
      expect(clientFile!.content).toContain('getClientConfig')
      expect(clientFile!.content).toContain('configureClient')
      expect(clientFile!.content).toContain(spec.baseUrl)
    })

    it('generates index.ts barrel file', () => {
      const spec = createMockSpec()
      const files = generateHooks(spec, defaultOptions)
      const indexFile = files.find((f) => f.path === 'index.ts')
      expect(indexFile).toBeDefined()
      expect(indexFile!.content).toContain("export * from './types'")
      expect(indexFile!.content).toContain("export * from './client'")
      expect(indexFile!.content).toContain("export * from './pets'")
    })

    it('organizes hook files by tag directory', () => {
      const spec = createMockSpec()
      const files = generateHooks(spec, defaultOptions)
      const petFiles = files.filter((f) => f.path.startsWith('pets/'))
      expect(petFiles.length).toBeGreaterThan(0)
      // Should have a barrel index for the tag group
      const tagIndex = petFiles.find((f) => f.path === 'pets/index.ts')
      expect(tagIndex).toBeDefined()
    })
  })

  describe('GET operation hooks', () => {
    it('generates hooks using useState and useEffect', () => {
      const spec = createMockSpec([createGetOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile).toBeDefined()
      expect(hookFile!.content).toContain('useState')
      expect(hookFile!.content).toContain('useEffect')
      expect(hookFile!.content).toContain('useCallback')
    })

    it('generates useListPets hook function', () => {
      const spec = createMockSpec([createGetOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile).toBeDefined()
      expect(hookFile!.content).toContain('export function useListPets')
    })

    it('includes React import for hooks', () => {
      const spec = createMockSpec([createGetOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile!.content).toContain("import { useState, useEffect, useCallback, useRef } from 'react'")
    })

    it('imports getClientConfig from client module', () => {
      const spec = createMockSpec([createGetOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile!.content).toContain("import { getClientConfig } from '../client'")
    })

    it('includes data, error, isLoading, and refetch in the result', () => {
      const spec = createMockSpec([createGetOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile!.content).toContain('data')
      expect(hookFile!.content).toContain('error')
      expect(hookFile!.content).toContain('isLoading')
      expect(hookFile!.content).toContain('refetch')
    })

    it('generates a buildUrl function for query parameters', () => {
      const spec = createMockSpec([createGetOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile!.content).toContain('buildUrl')
      expect(hookFile!.content).toContain('URLSearchParams')
    })
  })

  describe('POST operation hooks', () => {
    it('generates a hook with mutate function', () => {
      const spec = createMockSpec([createPostOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile).toBeDefined()
      expect(hookFile!.content).toContain('mutate')
      expect(hookFile!.content).toContain('reset')
    })

    it('generates useCreatePet hook function', () => {
      const spec = createMockSpec([createPostOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile!.content).toContain('export function useCreatePet')
    })

    it('includes body parameter in mutate', () => {
      const spec = createMockSpec([createPostOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile!.content).toContain('body: CreatePetBody')
      expect(hookFile!.content).toContain('JSON.stringify(body)')
    })

    it('uses POST method in fetch call', () => {
      const spec = createMockSpec([createPostOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile!.content).toContain("method: 'POST'")
    })
  })

  describe('detail operation with path params', () => {
    it('generates hook for path-parameterized endpoint', () => {
      const spec = createMockSpec([createDetailOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile).toBeDefined()
      expect(hookFile!.content).toContain('useGetPet')
      expect(hookFile!.content).toContain('GetPetParams')
    })
  })

  describe('deprecated operations', () => {
    it('adds @deprecated JSDoc tag for deprecated operations', () => {
      const spec = createMockSpec([createGetOperation({ deprecated: true })])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile).toBeDefined()
      expect(hookFile!.content).toContain('@deprecated')
    })
  })

  describe('hook name collision detection', () => {
    it('warns when two operations produce the same hook name', () => {
      const warnSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const spec = createMockSpec([
        createGetOperation({ operationId: 'listPets' }),
        createGetOperation({ operationId: 'listPets', path: '/v2/pets' }),
      ])
      generateHooks(spec, defaultOptions)

      const warningCalls = warnSpy.mock.calls
        .map((args) => args.join(' '))
        .filter((msg) => msg.includes('collision'))

      expect(warningCalls.length).toBeGreaterThan(0)
      expect(warningCalls[0]).toContain('useListPets')

      warnSpy.mockRestore()
    })

    it('does not warn when all hook names are unique', () => {
      const warnSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const spec = createMockSpec([
        createGetOperation({ operationId: 'listPets' }),
        createPostOperation({ operationId: 'createPet' }),
      ])
      generateHooks(spec, defaultOptions)

      const warningCalls = warnSpy.mock.calls
        .map((args) => args.join(' '))
        .filter((msg) => msg.includes('collision'))

      expect(warningCalls.length).toBe(0)

      warnSpy.mockRestore()
    })
  })

  describe('subscription operation hooks', () => {
    it('generates a subscription hook with WebSocket connection', () => {
      const spec = createMockSpec([createSubscriptionOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find(
        (f) => f.path.startsWith('subscriptions/') && f.path !== 'subscriptions/index.ts',
      )
      expect(hookFile).toBeDefined()
      expect(hookFile!.content).toContain('WebSocket')
      expect(hookFile!.content).toContain('usePetCreated')
    })

    it('includes data, error, isConnected, and unsubscribe in the result', () => {
      const spec = createMockSpec([createSubscriptionOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find(
        (f) => f.path.startsWith('subscriptions/') && f.path !== 'subscriptions/index.ts',
      )
      expect(hookFile!.content).toContain('data')
      expect(hookFile!.content).toContain('error')
      expect(hookFile!.content).toContain('isConnected')
      expect(hookFile!.content).toContain('unsubscribe')
    })

    it('includes variables parameter for subscriptions with args', () => {
      const spec = createMockSpec([createSubscriptionWithArgsOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find(
        (f) => f.path.startsWith('subscriptions/') && f.path !== 'subscriptions/index.ts',
      )
      expect(hookFile!.content).toContain('variables')
      expect(hookFile!.content).toContain('OnMessageParams')
    })

    it('does not generate mutation hooks for subscription operations', () => {
      const spec = createMockSpec([createSubscriptionOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find(
        (f) => f.path.startsWith('subscriptions/') && f.path !== 'subscriptions/index.ts',
      )
      expect(hookFile!.content).not.toContain('mutate')
    })
  })

  describe('zod integration', () => {
    it('imports from schemas when zod is enabled', () => {
      const spec = createMockSpec([createGetOperation()])
      const files = generateHooks(spec, { ...defaultOptions, zod: true })
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile!.content).toContain("from '../schemas'")
    })

    it('generates schemas.ts file when zod is enabled', () => {
      const spec = createMockSpec()
      const files = generateHooks(spec, { ...defaultOptions, zod: true })
      const schemasFile = files.find((f) => f.path === 'schemas.ts')
      expect(schemasFile).toBeDefined()
    })

    it('barrel index includes schemas export when zod is enabled', () => {
      const spec = createMockSpec()
      const files = generateHooks(spec, { ...defaultOptions, zod: true })
      const indexFile = files.find((f) => f.path === 'index.ts')
      expect(indexFile!.content).toContain("export * from './schemas'")
    })
  })
})
