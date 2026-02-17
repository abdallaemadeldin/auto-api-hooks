import path from 'node:path'
import { generate } from '../../src/index'

describe('E2E: GraphQL -> SWR', () => {
  const specPath = path.resolve(__dirname, '../fixtures/schema.graphql')

  it('generates complete hook output from SDL', async () => {
    const files = await generate({
      spec: specPath,
      fetcher: 'swr',
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
    // GraphQL default base URL is /graphql
    expect(clientFile!.content).toContain('/graphql')

    // Should have index.ts barrel
    const indexFile = files.find(f => f.path === 'index.ts')
    expect(indexFile).toBeDefined()
    expect(indexFile!.content).toContain("export * from './types'")
    expect(indexFile!.content).toContain("export * from './client'")

    // SWR should NOT have query-keys.ts (that's react-query specific)
    const keysFile = files.find(f => f.path === 'query-keys.ts')
    expect(keysFile).toBeUndefined()

    // GraphQL parser uses tags: 'queries' for Query fields, 'mutations' for Mutation fields
    const queriesFiles = files.filter(f => f.path.startsWith('queries/'))
    expect(queriesFiles.length).toBeGreaterThan(0)
    const mutationsFiles = files.filter(f => f.path.startsWith('mutations/'))
    expect(mutationsFiles.length).toBeGreaterThan(0)

    // Hook files for queries should use useSWR
    const hookFiles = files.filter(
      f => f.path.includes('/') && !f.path.endsWith('index.ts')
    )

    // Query operations -> useSWR
    const swrHook = hookFiles.find(f => f.content.includes("from 'swr'"))
    expect(swrHook).toBeDefined()
    expect(swrHook!.content).toContain('useSWR')

    // Mutation operations -> useSWRMutation
    const mutationHook = hookFiles.find(f => f.content.includes("from 'swr/mutation'"))
    expect(mutationHook).toBeDefined()
    expect(mutationHook!.content).toContain('useSWRMutation')
  })

  it('generates expected hook names from GraphQL fields', async () => {
    const files = await generate({
      spec: specPath,
      fetcher: 'swr',
    })

    // GraphQL field: pets (Query) -> usePets
    expect(files.some(f => f.content.includes('function usePets'))).toBe(true)
    // GraphQL field: pet (Query) -> usePet
    expect(files.some(f => f.content.includes('function usePet'))).toBe(true)
    // GraphQL field: users (Query) -> useUsers
    expect(files.some(f => f.content.includes('function useUsers'))).toBe(true)
    // GraphQL field: user (Query) -> useUser
    expect(files.some(f => f.content.includes('function useUser'))).toBe(true)

    // GraphQL field: createPet (Mutation) -> useCreatePet
    expect(files.some(f => f.content.includes('function useCreatePet'))).toBe(true)
    // GraphQL field: updatePet (Mutation) -> useUpdatePet
    expect(files.some(f => f.content.includes('function useUpdatePet'))).toBe(true)
    // GraphQL field: deletePet (Mutation) -> useDeletePet
    expect(files.some(f => f.content.includes('function useDeletePet'))).toBe(true)
    // GraphQL field: createUser (Mutation) -> useCreateUser
    expect(files.some(f => f.content.includes('function useCreateUser'))).toBe(true)
  })

  it('generates types for GraphQL object types and enums', async () => {
    const files = await generate({
      spec: specPath,
      fetcher: 'swr',
    })

    const typesFile = files.find(f => f.path === 'types.ts')
    expect(typesFile).toBeDefined()
    // Should have Pet, User, PetStatus types from the GraphQL schema
    expect(typesFile!.content).toContain('Pet')
    expect(typesFile!.content).toContain('User')
    expect(typesFile!.content).toContain('PetStatus')
  })

  it('generates barrel indexes for query and mutation groups', async () => {
    const files = await generate({
      spec: specPath,
      fetcher: 'swr',
    })

    const queriesIndex = files.find(f => f.path === 'queries/index.ts')
    expect(queriesIndex).toBeDefined()
    // Should export query hooks
    expect(queriesIndex!.content).toContain('export')

    const mutationsIndex = files.find(f => f.path === 'mutations/index.ts')
    expect(mutationsIndex).toBeDefined()
    // Should export mutation hooks
    expect(mutationsIndex!.content).toContain('export')

    // Main index should re-export tag groups
    const indexFile = files.find(f => f.path === 'index.ts')
    expect(indexFile).toBeDefined()
    expect(indexFile!.content).toContain("export * from './queries'")
    expect(indexFile!.content).toContain("export * from './mutations'")
  })

  it('generates with Zod validation for GraphQL specs', async () => {
    const files = await generate({
      spec: specPath,
      fetcher: 'swr',
      zod: true,
    })

    const schemasFile = files.find(f => f.path === 'schemas.ts')
    expect(schemasFile).toBeDefined()
    expect(schemasFile!.content).toContain("import { z } from 'zod'")

    const indexFile = files.find(f => f.path === 'index.ts')
    expect(indexFile).toBeDefined()
    expect(indexFile!.content).toContain("export * from './schemas'")

    // Hook files should import from schemas when zod is enabled
    const hookFiles = files.filter(
      f => f.path.includes('/') && !f.path.endsWith('index.ts')
    )
    const hookWithSchema = hookFiles.find(f => f.content.includes("from '../schemas'"))
    expect(hookWithSchema).toBeDefined()
    expect(hookWithSchema!.content).toContain('.parse(')
  })

  it('generates with custom baseUrl override', async () => {
    const files = await generate({
      spec: specPath,
      fetcher: 'swr',
      baseUrl: 'https://api.example.com/graphql',
    })

    const clientFile = files.find(f => f.path === 'client.ts')
    expect(clientFile).toBeDefined()
    expect(clientFile!.content).toContain('https://api.example.com/graphql')
  })

  it('generates SWR mutation hooks with proper structure', async () => {
    const files = await generate({
      spec: specPath,
      fetcher: 'swr',
    })

    // Find a mutation hook
    const createPetHook = files.find(f => f.content.includes('function useCreatePet'))
    expect(createPetHook).toBeDefined()
    // SWR mutation hooks use useSWRMutation from 'swr/mutation'
    expect(createPetHook!.content).toContain("from 'swr/mutation'")
    expect(createPetHook!.content).toContain('useSWRMutation')
    // Should have the mutation key
    expect(createPetHook!.content).toContain('MUTATION')
  })

  it('does not generate schemas when zod is disabled', async () => {
    const files = await generate({
      spec: specPath,
      fetcher: 'swr',
      zod: false,
    })

    const schemasFile = files.find(f => f.path === 'schemas.ts')
    expect(schemasFile).toBeUndefined()
  })
})
