import path from 'node:path'
import { generate } from '../../src/index'

describe('E2E: OpenAPI 3.x -> React Query', () => {
  const specPath = path.resolve(__dirname, '../fixtures/petstore-openapi3.yaml')

  it('generates complete hook output', async () => {
    const files = await generate({
      spec: specPath,
      fetcher: 'react-query',
    })

    expect(files.length).toBeGreaterThan(0)

    // Should have types.ts
    const typesFile = files.find(f => f.path === 'types.ts')
    expect(typesFile).toBeDefined()
    expect(typesFile!.content).toContain('interface')

    // Should have client.ts with getClientConfig
    const clientFile = files.find(f => f.path === 'client.ts')
    expect(clientFile).toBeDefined()
    expect(clientFile!.content).toContain('getClientConfig')
    expect(clientFile!.content).toContain('API_BASE_URL')
    // Should contain the base URL from the spec servers
    expect(clientFile!.content).toContain('localhost')

    // Should have index.ts barrel
    const indexFile = files.find(f => f.path === 'index.ts')
    expect(indexFile).toBeDefined()
    expect(indexFile!.content).toContain("export * from './types'")
    expect(indexFile!.content).toContain("export * from './client'")
    expect(indexFile!.content).toContain("export * from './query-keys'")

    // Should have query-keys.ts (react-query specific)
    const keysFile = files.find(f => f.path === 'query-keys.ts')
    expect(keysFile).toBeDefined()
    expect(keysFile!.content).toContain('as const')

    // Should have hook files in tag directories (pets/, users/)
    const petsDir = files.filter(f => f.path.startsWith('pets/'))
    expect(petsDir.length).toBeGreaterThan(0)
    const usersDir = files.filter(f => f.path.startsWith('users/'))
    expect(usersDir.length).toBeGreaterThan(0)

    // Should have tag barrel indexes
    const petsIndex = files.find(f => f.path === 'pets/index.ts')
    expect(petsIndex).toBeDefined()
    const usersIndex = files.find(f => f.path === 'users/index.ts')
    expect(usersIndex).toBeDefined()

    // Check a useQuery hook (GET operations -> useQuery)
    const hookFiles = files.filter(f => f.path.includes('/') && !f.path.endsWith('index.ts'))
    const getHook = hookFiles.find(f => f.content.includes('useQuery'))
    expect(getHook).toBeDefined()
    expect(getHook!.content).toContain("@tanstack/react-query")
    expect(getHook!.content).toContain('queryKey')
    expect(getHook!.content).toContain('queryFn')
    expect(getHook!.content).toContain('getClientConfig')

    // Check a useMutation hook (POST/PUT/DELETE -> useMutation)
    const mutationHook = hookFiles.find(f => f.content.includes('useMutation'))
    expect(mutationHook).toBeDefined()
    expect(mutationHook!.content).toContain('mutationFn')
    expect(mutationHook!.content).toContain("@tanstack/react-query")
  })

  it('generates expected hook names from operationIds', async () => {
    const files = await generate({
      spec: specPath,
      fetcher: 'react-query',
    })

    // operationId: listPets -> useListPets
    const listPetsHook = files.find(f => f.content.includes('function useListPets'))
    expect(listPetsHook).toBeDefined()

    // operationId: createPet -> useCreatePet
    const createPetHook = files.find(f => f.content.includes('function useCreatePet'))
    expect(createPetHook).toBeDefined()

    // operationId: getPet -> useGetPet
    const getPetHook = files.find(f => f.content.includes('function useGetPet'))
    expect(getPetHook).toBeDefined()

    // operationId: updatePet -> useUpdatePet
    const updatePetHook = files.find(f => f.content.includes('function useUpdatePet'))
    expect(updatePetHook).toBeDefined()

    // operationId: deletePet -> useDeletePet
    const deletePetHook = files.find(f => f.content.includes('function useDeletePet'))
    expect(deletePetHook).toBeDefined()

    // operationId: listUsers -> useListUsers
    const listUsersHook = files.find(f => f.content.includes('function useListUsers'))
    expect(listUsersHook).toBeDefined()

    // operationId: createUser -> useCreateUser
    const createUserHook = files.find(f => f.content.includes('function useCreateUser'))
    expect(createUserHook).toBeDefined()
  })

  it('generates with Zod validation', async () => {
    const files = await generate({
      spec: specPath,
      fetcher: 'react-query',
      zod: true,
    })

    // Should have schemas.ts
    const schemasFile = files.find(f => f.path === 'schemas.ts')
    expect(schemasFile).toBeDefined()
    expect(schemasFile!.content).toContain("import { z } from 'zod'")
    // Should have named type schemas (e.g., petSchema, userSchema, errorSchema)
    expect(schemasFile!.content).toContain('petSchema')
    expect(schemasFile!.content).toContain('userSchema')
    expect(schemasFile!.content).toContain('errorSchema')
    // Should have per-operation response schemas
    expect(schemasFile!.content).toContain('listPetsResponseSchema')
    expect(schemasFile!.content).toContain('getPetResponseSchema')

    // Index barrel should export schemas
    const indexFile = files.find(f => f.path === 'index.ts')
    expect(indexFile).toBeDefined()
    expect(indexFile!.content).toContain("export * from './schemas'")

    // Hook files should import from schemas when zod is enabled
    const hookFiles = files.filter(
      f => f.path.includes('/') && !f.path.endsWith('index.ts') && !f.path.startsWith('mocks/')
    )
    const hookWithSchema = hookFiles.find(f => f.content.includes("from '../schemas'"))
    expect(hookWithSchema).toBeDefined()
    // The hook should use .parse() for validation
    expect(hookWithSchema!.content).toContain('.parse(')
  })

  it('generates with mock server', async () => {
    const files = await generate({
      spec: specPath,
      fetcher: 'react-query',
      mock: true,
    })

    // Should have mock files in mocks/ directory
    const mockFiles = files.filter(f => f.path.startsWith('mocks/'))
    expect(mockFiles.length).toBe(5) // data.ts, handlers.ts, server.ts, browser.ts, index.ts

    const handlersFile = mockFiles.find(f => f.path === 'mocks/handlers.ts')
    expect(handlersFile).toBeDefined()
    expect(handlersFile!.content).toContain("import { http, HttpResponse } from 'msw'")
    expect(handlersFile!.content).toContain('http.get')
    expect(handlersFile!.content).toContain('http.post')
    expect(handlersFile!.content).toContain('http.put')
    expect(handlersFile!.content).toContain('http.delete')
    expect(handlersFile!.content).toContain('HttpResponse.json')

    const serverFile = mockFiles.find(f => f.path === 'mocks/server.ts')
    expect(serverFile).toBeDefined()
    expect(serverFile!.content).toContain("setupServer")

    const browserFile = mockFiles.find(f => f.path === 'mocks/browser.ts')
    expect(browserFile).toBeDefined()
    expect(browserFile!.content).toContain("setupWorker")

    const dataFile = mockFiles.find(f => f.path === 'mocks/data.ts')
    expect(dataFile).toBeDefined()

    const mockIndex = mockFiles.find(f => f.path === 'mocks/index.ts')
    expect(mockIndex).toBeDefined()
    expect(mockIndex!.content).toContain("export { handlers }")
  })

  it('respects baseUrl override', async () => {
    const files = await generate({
      spec: specPath,
      fetcher: 'react-query',
      baseUrl: 'https://custom-api.example.com',
    })

    const clientFile = files.find(f => f.path === 'client.ts')
    expect(clientFile).toBeDefined()
    expect(clientFile!.content).toContain('https://custom-api.example.com')
  })

  it('does not generate schemas.ts or query-keys export when zod is disabled', async () => {
    const files = await generate({
      spec: specPath,
      fetcher: 'react-query',
      zod: false,
    })

    const schemasFile = files.find(f => f.path === 'schemas.ts')
    expect(schemasFile).toBeUndefined()

    const indexFile = files.find(f => f.path === 'index.ts')
    expect(indexFile).toBeDefined()
    expect(indexFile!.content).not.toContain("export * from './schemas'")
  })

  it('does not generate mock files when mock is disabled', async () => {
    const files = await generate({
      spec: specPath,
      fetcher: 'react-query',
      mock: false,
    })

    const mockFiles = files.filter(f => f.path.startsWith('mocks/'))
    expect(mockFiles.length).toBe(0)
  })

  it('writes files to disk when outputDir is provided', async () => {
    const fs = await import('node:fs')
    const os = await import('node:os')
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-api-hooks-rq-test-'))

    try {
      const files = await generate({
        spec: specPath,
        fetcher: 'react-query',
        outputDir: tmpDir,
      })

      // Verify files were written to disk
      expect(fs.existsSync(path.join(tmpDir, 'types.ts'))).toBe(true)
      expect(fs.existsSync(path.join(tmpDir, 'client.ts'))).toBe(true)
      expect(fs.existsSync(path.join(tmpDir, 'index.ts'))).toBe(true)
      expect(fs.existsSync(path.join(tmpDir, 'query-keys.ts'))).toBe(true)

      // Verify content matches
      const clientContent = fs.readFileSync(path.join(tmpDir, 'client.ts'), 'utf-8')
      const clientFile = files.find(f => f.path === 'client.ts')
      expect(clientContent).toBe(clientFile!.content)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})
