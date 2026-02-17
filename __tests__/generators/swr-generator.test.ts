import { createGenerator, generateHooks } from '../../src/generators/index'
import { SwrGenerator } from '../../src/generators/swr-generator'
import type { GeneratorOptions } from '../../src/generators/types'
import {
  createMockSpec,
  createGetOperation,
  createPostOperation,
  createPaginatedOperation,
  createSubscriptionOperation,
  createSubscriptionWithArgsOperation,
} from '../helpers'

const defaultOptions: GeneratorOptions = {
  fetcher: 'swr',
  zod: false,
  mock: false,
  outputDir: './out',
  infiniteQueries: false,
}

describe('SwrGenerator', () => {
  describe('createGenerator', () => {
    it('returns a SwrGenerator instance for "swr" strategy', () => {
      const generator = createGenerator('swr')
      expect(generator).toBeInstanceOf(SwrGenerator)
    })
  })

  describe('GET operation hooks', () => {
    it('generates useSWR hooks for GET operations', () => {
      const spec = createMockSpec([createGetOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile).toBeDefined()
      expect(hookFile!.content).toContain('useSWR')
    })

    it('imports from swr package', () => {
      const spec = createMockSpec([createGetOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile!.content).toContain("from 'swr'")
    })

    it('generates hook function with correct name', () => {
      const spec = createMockSpec([createGetOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile!.content).toContain('export function useListPets')
    })

    it('includes key-based enabled logic', () => {
      const spec = createMockSpec([createGetOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile!.content).toContain('enabled === false')
      expect(hookFile!.content).toContain('null')
    })

    it('uses getClientConfig in the fetcher', () => {
      const spec = createMockSpec([createGetOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile!.content).toContain('getClientConfig')
    })
  })

  describe('mutation operation hooks', () => {
    it('generates useSWRMutation hooks for POST operations', () => {
      const spec = createMockSpec([createPostOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile).toBeDefined()
      expect(hookFile!.content).toContain('useSWRMutation')
    })

    it('imports from swr/mutation', () => {
      const spec = createMockSpec([createPostOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile!.content).toContain("from 'swr/mutation'")
    })

    it('includes arg parameter in the mutation fetcher', () => {
      const spec = createMockSpec([createPostOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile!.content).toContain('arg')
    })

    it('includes body in mutation', () => {
      const spec = createMockSpec([createPostOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile!.content).toContain('CreatePetBody')
    })
  })

  describe('infinite query hooks', () => {
    it('generates useSWRInfinite hooks for paginated operations', () => {
      const spec = createMockSpec([createPaginatedOperation()])
      const files = generateHooks(spec, { ...defaultOptions, infiniteQueries: true })
      const infiniteFile = files.find(
        (f) => f.path.includes('infinite') && f.path.startsWith('pets/'),
      )
      expect(infiniteFile).toBeDefined()
      expect(infiniteFile!.content).toContain('useSWRInfinite')
    })

    it('imports from swr/infinite', () => {
      const spec = createMockSpec([createPaginatedOperation()])
      const files = generateHooks(spec, { ...defaultOptions, infiniteQueries: true })
      const infiniteFile = files.find(
        (f) => f.path.includes('infinite') && f.path.startsWith('pets/'),
      )
      expect(infiniteFile!.content).toContain("from 'swr/infinite'")
    })

    it('includes getKey function for pagination', () => {
      const spec = createMockSpec([createPaginatedOperation()])
      const files = generateHooks(spec, { ...defaultOptions, infiniteQueries: true })
      const infiniteFile = files.find(
        (f) => f.path.includes('infinite') && f.path.startsWith('pets/'),
      )
      expect(infiniteFile!.content).toContain('getKey')
      expect(infiniteFile!.content).toContain('pageIndex')
      expect(infiniteFile!.content).toContain('previousPageData')
    })

    it('does not generate infinite hooks when option is disabled', () => {
      const spec = createMockSpec([createPaginatedOperation()])
      const files = generateHooks(spec, { ...defaultOptions, infiniteQueries: false })
      const infiniteFile = files.find(
        (f) => f.path.includes('infinite') && f.path.startsWith('pets/'),
      )
      expect(infiniteFile).toBeUndefined()
    })
  })

  describe('subscription operation hooks', () => {
    it('generates useSWRSubscription hooks for subscription operations', () => {
      const spec = createMockSpec([createSubscriptionOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find(
        (f) => f.path.startsWith('subscriptions/') && f.path !== 'subscriptions/index.ts',
      )
      expect(hookFile).toBeDefined()
      expect(hookFile!.content).toContain('useSWRSubscription')
      expect(hookFile!.content).toContain('usePetCreated')
    })

    it('imports from swr/subscription', () => {
      const spec = createMockSpec([createSubscriptionOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find(
        (f) => f.path.startsWith('subscriptions/') && f.path !== 'subscriptions/index.ts',
      )
      expect(hookFile!.content).toContain("from 'swr/subscription'")
    })

    it('uses WebSocket connection inside the subscribe function', () => {
      const spec = createMockSpec([createSubscriptionOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find(
        (f) => f.path.startsWith('subscriptions/') && f.path !== 'subscriptions/index.ts',
      )
      expect(hookFile!.content).toContain('WebSocket')
    })

    it('calls next() to deliver data to SWR', () => {
      const spec = createMockSpec([createSubscriptionOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find(
        (f) => f.path.startsWith('subscriptions/') && f.path !== 'subscriptions/index.ts',
      )
      expect(hookFile!.content).toContain('next(')
    })

    it('supports enabled option to prevent auto-connect', () => {
      const spec = createMockSpec([createSubscriptionOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find(
        (f) => f.path.startsWith('subscriptions/') && f.path !== 'subscriptions/index.ts',
      )
      expect(hookFile!.content).toContain('enabled === false')
      expect(hookFile!.content).toContain('null')
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

    it('does not generate useSWRMutation for subscriptions', () => {
      const spec = createMockSpec([createSubscriptionOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find(
        (f) => f.path.startsWith('subscriptions/') && f.path !== 'subscriptions/index.ts',
      )
      expect(hookFile!.content).not.toContain('useSWRMutation')
    })

    it('returns cleanup function for WebSocket close', () => {
      const spec = createMockSpec([createSubscriptionOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find(
        (f) => f.path.startsWith('subscriptions/') && f.path !== 'subscriptions/index.ts',
      )
      expect(hookFile!.content).toContain('ws.close()')
    })
  })

  describe('file structure', () => {
    it('generates all expected files', () => {
      const spec = createMockSpec()
      const files = generateHooks(spec, defaultOptions)
      expect(files.find((f) => f.path === 'types.ts')).toBeDefined()
      expect(files.find((f) => f.path === 'client.ts')).toBeDefined()
      expect(files.find((f) => f.path === 'index.ts')).toBeDefined()
      expect(files.find((f) => f.path === 'pets/index.ts')).toBeDefined()
    })
  })
})
