import { createGenerator, generateHooks } from '../../src/generators/index'
import { ReactQueryGenerator } from '../../src/generators/react-query-generator'
import type { GeneratorOptions } from '../../src/generators/types'
import {
  createMockSpec,
  createGetOperation,
  createPostOperation,
  createDetailOperation,
  createPaginatedOperation,
  createSubscriptionOperation,
  createSubscriptionWithArgsOperation,
} from '../helpers'

const defaultOptions: GeneratorOptions = {
  fetcher: 'react-query',
  zod: false,
  mock: false,
  outputDir: './out',
  infiniteQueries: false,
}

describe('ReactQueryGenerator', () => {
  describe('createGenerator', () => {
    it('returns a ReactQueryGenerator instance for "react-query" strategy', () => {
      const generator = createGenerator('react-query')
      expect(generator).toBeInstanceOf(ReactQueryGenerator)
    })
  })

  describe('generated files', () => {
    it('includes query-keys.ts in generated files', () => {
      const spec = createMockSpec()
      const files = generateHooks(spec, defaultOptions)
      const queryKeysFile = files.find((f) => f.path === 'query-keys.ts')
      expect(queryKeysFile).toBeDefined()
      expect(queryKeysFile!.content).toContain('as const')
    })

    it('barrel index exports query-keys', () => {
      const spec = createMockSpec()
      const files = generateHooks(spec, defaultOptions)
      const indexFile = files.find((f) => f.path === 'index.ts')
      expect(indexFile!.content).toContain("export * from './query-keys'")
    })

    it('generates types.ts, client.ts, index.ts, and tag group files', () => {
      const spec = createMockSpec()
      const files = generateHooks(spec, defaultOptions)
      expect(files.find((f) => f.path === 'types.ts')).toBeDefined()
      expect(files.find((f) => f.path === 'client.ts')).toBeDefined()
      expect(files.find((f) => f.path === 'index.ts')).toBeDefined()
      expect(files.find((f) => f.path === 'pets/index.ts')).toBeDefined()
    })
  })

  describe('GET operation hooks', () => {
    it('generates useQuery hooks for GET operations', () => {
      const spec = createMockSpec([createGetOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile).toBeDefined()
      expect(hookFile!.content).toContain('useQuery')
      expect(hookFile!.content).toContain('useListPets')
    })

    it('imports from @tanstack/react-query', () => {
      const spec = createMockSpec([createGetOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile!.content).toContain("from '@tanstack/react-query'")
    })

    it('includes UseQueryOptions import', () => {
      const spec = createMockSpec([createGetOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile!.content).toContain('UseQueryOptions')
    })

    it('generates queryKey using resource-based key', () => {
      const spec = createMockSpec([createGetOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile!.content).toContain('queryKey:')
      expect(hookFile!.content).toContain("'pets'")
    })

    it('generates queryFn with fetch logic', () => {
      const spec = createMockSpec([createGetOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile!.content).toContain('queryFn:')
      expect(hookFile!.content).toContain('getClientConfig')
      expect(hookFile!.content).toContain('fetch')
    })
  })

  describe('POST operation hooks', () => {
    it('generates useMutation hooks for POST operations', () => {
      const spec = createMockSpec([createPostOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile).toBeDefined()
      expect(hookFile!.content).toContain('useMutation')
      expect(hookFile!.content).toContain('useCreatePet')
    })

    it('imports UseMutationOptions', () => {
      const spec = createMockSpec([createPostOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile!.content).toContain('UseMutationOptions')
    })

    it('includes mutationFn', () => {
      const spec = createMockSpec([createPostOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile!.content).toContain('mutationFn:')
    })

    it('includes request body in the mutation variables', () => {
      const spec = createMockSpec([createPostOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile!.content).toContain('CreatePetBody')
      expect(hookFile!.content).toContain('body')
    })
  })

  describe('query key factories', () => {
    it('generates key factories for GET resources', () => {
      const spec = createMockSpec([createGetOperation(), createDetailOperation()])
      const files = generateHooks(spec, defaultOptions)
      const queryKeysFile = files.find((f) => f.path === 'query-keys.ts')
      expect(queryKeysFile).toBeDefined()
      expect(queryKeysFile!.content).toContain('petsKeys')
      expect(queryKeysFile!.content).toContain("all:")
    })

    it('includes list methods when list operations exist', () => {
      const spec = createMockSpec([createGetOperation()])
      const files = generateHooks(spec, defaultOptions)
      const queryKeysFile = files.find((f) => f.path === 'query-keys.ts')
      expect(queryKeysFile!.content).toContain('lists:')
      expect(queryKeysFile!.content).toContain('list:')
    })

    it('includes detail methods when detail operations exist', () => {
      const spec = createMockSpec([createDetailOperation()])
      const files = generateHooks(spec, defaultOptions)
      const queryKeysFile = files.find((f) => f.path === 'query-keys.ts')
      expect(queryKeysFile!.content).toContain('details:')
      expect(queryKeysFile!.content).toContain('detail:')
    })
  })

  describe('zod integration', () => {
    it('imports from schemas when zod option is true', () => {
      const spec = createMockSpec([createGetOperation()])
      const files = generateHooks(spec, { ...defaultOptions, zod: true })
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile!.content).toContain("from '../schemas'")
    })

    it('uses schema.parse in queryFn when zod is enabled', () => {
      const spec = createMockSpec([createGetOperation()])
      const files = generateHooks(spec, { ...defaultOptions, zod: true })
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile!.content).toContain('ResponseSchema.parse')
    })
  })

  describe('infinite query hooks', () => {
    it('generates useInfiniteQuery hook for paginated operations', () => {
      const spec = createMockSpec([createPaginatedOperation()])
      const files = generateHooks(spec, { ...defaultOptions, infiniteQueries: true })
      const infiniteFile = files.find(
        (f) => f.path.includes('infinite') && f.path.startsWith('pets/'),
      )
      expect(infiniteFile).toBeDefined()
      expect(infiniteFile!.content).toContain('useInfiniteQuery')
      expect(infiniteFile!.content).toContain('UseInfiniteQueryOptions')
    })

    it('includes getNextPageParam in infinite query', () => {
      const spec = createMockSpec([createPaginatedOperation()])
      const files = generateHooks(spec, { ...defaultOptions, infiniteQueries: true })
      const infiniteFile = files.find(
        (f) => f.path.includes('infinite') && f.path.startsWith('pets/'),
      )
      expect(infiniteFile!.content).toContain('getNextPageParam')
    })

    it('includes initialPageParam in infinite query', () => {
      const spec = createMockSpec([createPaginatedOperation()])
      const files = generateHooks(spec, { ...defaultOptions, infiniteQueries: true })
      const infiniteFile = files.find(
        (f) => f.path.includes('infinite') && f.path.startsWith('pets/'),
      )
      expect(infiniteFile!.content).toContain('initialPageParam')
    })

    it('does not generate infinite hooks when infiniteQueries is false', () => {
      const spec = createMockSpec([createPaginatedOperation()])
      const files = generateHooks(spec, { ...defaultOptions, infiniteQueries: false })
      const infiniteFile = files.find(
        (f) => f.path.includes('infinite') && f.path.startsWith('pets/'),
      )
      expect(infiniteFile).toBeUndefined()
    })
  })

  describe('subscription operation hooks', () => {
    it('generates a subscription hook with WebSocket and queryClient', () => {
      const spec = createMockSpec([createSubscriptionOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find(
        (f) => f.path.startsWith('subscriptions/') && f.path !== 'subscriptions/index.ts',
      )
      expect(hookFile).toBeDefined()
      expect(hookFile!.content).toContain('WebSocket')
      expect(hookFile!.content).toContain('useQueryClient')
      expect(hookFile!.content).toContain('usePetCreated')
    })

    it('has status field with connection states', () => {
      const spec = createMockSpec([createSubscriptionOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find(
        (f) => f.path.startsWith('subscriptions/') && f.path !== 'subscriptions/index.ts',
      )
      expect(hookFile!.content).toContain("'connecting'")
      expect(hookFile!.content).toContain("'connected'")
      expect(hookFile!.content).toContain("'disconnected'")
    })

    it('includes unsubscribe function', () => {
      const spec = createMockSpec([createSubscriptionOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find(
        (f) => f.path.startsWith('subscriptions/') && f.path !== 'subscriptions/index.ts',
      )
      expect(hookFile!.content).toContain('unsubscribe')
    })

    it('invalidates queries when subscription data arrives', () => {
      const spec = createMockSpec([createSubscriptionOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find(
        (f) => f.path.startsWith('subscriptions/') && f.path !== 'subscriptions/index.ts',
      )
      expect(hookFile!.content).toContain('invalidateQueries')
    })

    it('supports enabled option to prevent auto-connect', () => {
      const spec = createMockSpec([createSubscriptionOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find(
        (f) => f.path.startsWith('subscriptions/') && f.path !== 'subscriptions/index.ts',
      )
      expect(hookFile!.content).toContain('enabled')
    })

    it('accepts variables for subscriptions with args', () => {
      const spec = createMockSpec([createSubscriptionWithArgsOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find(
        (f) => f.path.startsWith('subscriptions/') && f.path !== 'subscriptions/index.ts',
      )
      expect(hookFile!.content).toContain('variables')
      expect(hookFile!.content).toContain('OnMessageParams')
    })

    it('does not generate useMutation for subscriptions', () => {
      const spec = createMockSpec([createSubscriptionOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find(
        (f) => f.path.startsWith('subscriptions/') && f.path !== 'subscriptions/index.ts',
      )
      expect(hookFile!.content).not.toContain('useMutation')
    })
  })

  describe('deprecated operations', () => {
    it('adds @deprecated JSDoc tag', () => {
      const spec = createMockSpec([createGetOperation({ deprecated: true })])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile!.content).toContain('@deprecated')
    })
  })
})
