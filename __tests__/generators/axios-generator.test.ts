import { createGenerator, generateHooks } from '../../src/generators/index'
import { AxiosGenerator } from '../../src/generators/axios-generator'
import type { GeneratorOptions } from '../../src/generators/types'
import {
  createMockSpec,
  createGetOperation,
  createPostOperation,
} from '../helpers'

const defaultOptions: GeneratorOptions = {
  fetcher: 'axios',
  zod: false,
  mock: false,
  outputDir: './out',
  infiniteQueries: false,
}

describe('AxiosGenerator', () => {
  describe('createGenerator', () => {
    it('returns an AxiosGenerator instance for "axios" strategy', () => {
      const generator = createGenerator('axios')
      expect(generator).toBeInstanceOf(AxiosGenerator)
    })
  })

  describe('client.ts', () => {
    it('generates client.ts with axios instance creation', () => {
      const spec = createMockSpec()
      const files = generateHooks(spec, defaultOptions)
      const clientFile = files.find((f) => f.path === 'client.ts')
      expect(clientFile).toBeDefined()
      expect(clientFile!.content).toContain("import axios from 'axios'")
      expect(clientFile!.content).toContain('axios.create')
    })

    it('exports apiClient', () => {
      const spec = createMockSpec()
      const files = generateHooks(spec, defaultOptions)
      const clientFile = files.find((f) => f.path === 'client.ts')
      expect(clientFile!.content).toContain('export const apiClient')
    })

    it('sets baseURL from spec', () => {
      const spec = createMockSpec()
      const files = generateHooks(spec, defaultOptions)
      const clientFile = files.find((f) => f.path === 'client.ts')
      expect(clientFile!.content).toContain(spec.baseUrl)
      expect(clientFile!.content).toContain('baseURL: API_BASE_URL')
    })

    it('includes configureClient function', () => {
      const spec = createMockSpec()
      const files = generateHooks(spec, defaultOptions)
      const clientFile = files.find((f) => f.path === 'client.ts')
      expect(clientFile!.content).toContain('configureClient')
    })
  })

  describe('GET operation hooks', () => {
    it('generates hooks that use apiClient instead of raw fetch', () => {
      const spec = createMockSpec([createGetOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile).toBeDefined()
      expect(hookFile!.content).toContain('apiClient')
      expect(hookFile!.content).toContain("import { apiClient } from '../client'")
    })

    it('uses apiClient.get for GET operations', () => {
      const spec = createMockSpec([createGetOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile!.content).toContain('apiClient.get')
    })

    it('includes useState and useEffect imports', () => {
      const spec = createMockSpec([createGetOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile!.content).toContain('useState')
      expect(hookFile!.content).toContain('useEffect')
      expect(hookFile!.content).toContain('useCallback')
    })

    it('generates the correct hook function name', () => {
      const spec = createMockSpec([createGetOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile!.content).toContain('export function useListPets')
    })
  })

  describe('POST operation hooks', () => {
    it('generates hook with mutate function', () => {
      const spec = createMockSpec([createPostOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile).toBeDefined()
      expect(hookFile!.content).toContain('mutate')
      expect(hookFile!.content).toContain('reset')
    })

    it('uses apiClient.post for POST operations', () => {
      const spec = createMockSpec([createPostOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile!.content).toContain('apiClient.post')
    })

    it('passes body to axios call', () => {
      const spec = createMockSpec([createPostOperation()])
      const files = generateHooks(spec, defaultOptions)
      const hookFile = files.find((f) => f.path.startsWith('pets/') && f.path !== 'pets/index.ts')
      expect(hookFile!.content).toContain('body')
      expect(hookFile!.content).toContain('CreatePetBody')
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

    it('groups hooks by tag', () => {
      const spec = createMockSpec()
      const files = generateHooks(spec, defaultOptions)
      const petFiles = files.filter((f) => f.path.startsWith('pets/'))
      expect(petFiles.length).toBeGreaterThan(0)
    })
  })
})
