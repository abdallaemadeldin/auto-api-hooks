import path from 'node:path'
import { generate } from '../../src/index'

describe('E2E: Swagger 2.0 -> Fetch', () => {
  const specPath = path.resolve(__dirname, '../fixtures/petstore-swagger2.json')

  it('generates complete hook output', async () => {
    const files = await generate({
      spec: specPath,
      fetcher: 'fetch',
    })

    expect(files.length).toBeGreaterThan(0)

    // Should have types.ts
    const typesFile = files.find(f => f.path === 'types.ts')
    expect(typesFile).toBeDefined()
    expect(typesFile!.content).toContain('interface')

    // Should have client.ts with getClientConfig (fetch strategy uses the base client)
    const clientFile = files.find(f => f.path === 'client.ts')
    expect(clientFile).toBeDefined()
    expect(clientFile!.content).toContain('getClientConfig')
    expect(clientFile!.content).toContain('API_BASE_URL')

    // Should have index.ts barrel
    const indexFile = files.find(f => f.path === 'index.ts')
    expect(indexFile).toBeDefined()
    expect(indexFile!.content).toContain("export * from './types'")
    expect(indexFile!.content).toContain("export * from './client'")

    // Fetch strategy should NOT have query-keys.ts (that's react-query specific)
    const keysFile = files.find(f => f.path === 'query-keys.ts')
    expect(keysFile).toBeUndefined()

    // Hook files should use useState/useEffect pattern (fetch strategy)
    const hookFiles = files.filter(
      f => f.path.includes('/') && !f.path.endsWith('index.ts')
    )
    expect(hookFiles.length).toBeGreaterThan(0)

    // Read hooks (GET) use useState + useEffect
    const readHook = hookFiles.find(f => f.content.includes('useState'))
    expect(readHook).toBeDefined()
    expect(readHook!.content).toContain('useEffect')
    expect(readHook!.content).toContain('useState')
    expect(readHook!.content).toContain('useCallback')
    expect(readHook!.content).toContain("from 'react'")

    // Write hooks (POST/PUT/DELETE) should have mutate function
    const writeHook = hookFiles.find(f => f.content.includes('mutate'))
    expect(writeHook).toBeDefined()
    expect(writeHook!.content).toContain('mutate')
    expect(writeHook!.content).toContain('reset')
  })

  it('constructs base URL from host and basePath', async () => {
    const files = await generate({
      spec: specPath,
      fetcher: 'fetch',
    })

    const clientFile = files.find(f => f.path === 'client.ts')
    expect(clientFile).toBeDefined()
    // Swagger 2.0 spec has host: localhost:3000 and basePath: /api/v1
    // The parser should derive baseUrl from scheme + host + basePath
    expect(clientFile!.content).toContain('localhost')
  })

  it('generates hook files organized by tags', async () => {
    const files = await generate({
      spec: specPath,
      fetcher: 'fetch',
    })

    // Swagger fixture has tags: pets, users
    const petsFiles = files.filter(f => f.path.startsWith('pets/'))
    expect(petsFiles.length).toBeGreaterThan(0)
    const usersFiles = files.filter(f => f.path.startsWith('users/'))
    expect(usersFiles.length).toBeGreaterThan(0)

    // Each tag group should have a barrel index
    const petsIndex = files.find(f => f.path === 'pets/index.ts')
    expect(petsIndex).toBeDefined()
    const usersIndex = files.find(f => f.path === 'users/index.ts')
    expect(usersIndex).toBeDefined()
  })

  it('generates expected hook names from Swagger operationIds', async () => {
    const files = await generate({
      spec: specPath,
      fetcher: 'fetch',
    })

    // operationId: listPets -> useListPets
    expect(files.some(f => f.content.includes('function useListPets'))).toBe(true)
    // operationId: createPet -> useCreatePet
    expect(files.some(f => f.content.includes('function useCreatePet'))).toBe(true)
    // operationId: getPet -> useGetPet
    expect(files.some(f => f.content.includes('function useGetPet'))).toBe(true)
    // operationId: updatePet -> useUpdatePet
    expect(files.some(f => f.content.includes('function useUpdatePet'))).toBe(true)
    // operationId: deletePet -> useDeletePet
    expect(files.some(f => f.content.includes('function useDeletePet'))).toBe(true)
  })

  it('generates read hooks with AbortController support', async () => {
    const files = await generate({
      spec: specPath,
      fetcher: 'fetch',
    })

    // The fetch generator uses AbortController for request cancellation
    const readHook = files.find(f => f.content.includes('function useListPets'))
    expect(readHook).toBeDefined()
    expect(readHook!.content).toContain('AbortController')
    expect(readHook!.content).toContain('abortRef')
    expect(readHook!.content).toContain('signal')
  })

  it('generates write hooks with proper method', async () => {
    const files = await generate({
      spec: specPath,
      fetcher: 'fetch',
    })

    // POST hook
    const createHook = files.find(f => f.content.includes('function useCreatePet'))
    expect(createHook).toBeDefined()
    expect(createHook!.content).toContain("method: 'POST'")

    // PUT hook
    const updateHook = files.find(f => f.content.includes('function useUpdatePet'))
    expect(updateHook).toBeDefined()
    expect(updateHook!.content).toContain("method: 'PUT'")

    // DELETE hook
    const deleteHook = files.find(f => f.content.includes('function useDeletePet'))
    expect(deleteHook).toBeDefined()
    expect(deleteHook!.content).toContain("method: 'DELETE'")
  })

  it('generates with Zod validation for Swagger specs', async () => {
    const files = await generate({
      spec: specPath,
      fetcher: 'fetch',
      zod: true,
    })

    const schemasFile = files.find(f => f.path === 'schemas.ts')
    expect(schemasFile).toBeDefined()
    expect(schemasFile!.content).toContain("import { z } from 'zod'")
    expect(schemasFile!.content).toContain('petSchema')

    const indexFile = files.find(f => f.path === 'index.ts')
    expect(indexFile!.content).toContain("export * from './schemas'")
  })

  it('generates with mock server for Swagger specs', async () => {
    const files = await generate({
      spec: specPath,
      fetcher: 'fetch',
      mock: true,
    })

    const handlersFile = files.find(f => f.path === 'mocks/handlers.ts')
    expect(handlersFile).toBeDefined()
    expect(handlersFile!.content).toContain("import { http, HttpResponse } from 'msw'")
    expect(handlersFile!.content).toContain('http.get')
  })

  it('respects baseUrl override for Swagger specs', async () => {
    const files = await generate({
      spec: specPath,
      fetcher: 'fetch',
      baseUrl: 'https://override.example.com/v2',
    })

    const clientFile = files.find(f => f.path === 'client.ts')
    expect(clientFile).toBeDefined()
    expect(clientFile!.content).toContain('https://override.example.com/v2')
  })
})
