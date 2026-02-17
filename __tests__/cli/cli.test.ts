import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

describe('CLI', () => {
  let tmpDir: string
  const cliPath = path.resolve(__dirname, '../../src/cli.ts')
  const cwd = path.resolve(__dirname, '../..')
  const specPath = path.resolve(__dirname, '../fixtures/petstore-openapi3.yaml')

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-api-hooks-cli-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('generates hooks from OpenAPI spec via CLI', () => {
    execSync(
      `npx tsx ${cliPath} generate --spec ${specPath} --fetcher react-query --output ${tmpDir}`,
      { cwd, encoding: 'utf-8' }
    )

    // Check that the core output files exist
    expect(fs.existsSync(path.join(tmpDir, 'types.ts'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'client.ts'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'index.ts'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'query-keys.ts'))).toBe(true)

    // Check that tag directories were created
    expect(fs.existsSync(path.join(tmpDir, 'pets'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'users'))).toBe(true)

    // Verify content of a generated file
    const clientContent = fs.readFileSync(path.join(tmpDir, 'client.ts'), 'utf-8')
    expect(clientContent).toContain('getClientConfig')
    expect(clientContent).toContain('API_BASE_URL')
  })

  it('generates with --zod flag', () => {
    execSync(
      `npx tsx ${cliPath} generate --spec ${specPath} --fetcher react-query --output ${tmpDir} --zod`,
      { cwd, encoding: 'utf-8' }
    )

    expect(fs.existsSync(path.join(tmpDir, 'schemas.ts'))).toBe(true)

    const schemasContent = fs.readFileSync(path.join(tmpDir, 'schemas.ts'), 'utf-8')
    expect(schemasContent).toContain("import { z } from 'zod'")
    expect(schemasContent).toContain('petSchema')

    // Index should re-export schemas
    const indexContent = fs.readFileSync(path.join(tmpDir, 'index.ts'), 'utf-8')
    expect(indexContent).toContain("export * from './schemas'")
  })

  it('generates with --mock flag', () => {
    execSync(
      `npx tsx ${cliPath} generate --spec ${specPath} --fetcher react-query --output ${tmpDir} --mock`,
      { cwd, encoding: 'utf-8' }
    )

    expect(fs.existsSync(path.join(tmpDir, 'mocks'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'mocks/handlers.ts'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'mocks/data.ts'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'mocks/server.ts'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'mocks/browser.ts'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'mocks/index.ts'))).toBe(true)

    const handlersContent = fs.readFileSync(path.join(tmpDir, 'mocks/handlers.ts'), 'utf-8')
    expect(handlersContent).toContain("import { http, HttpResponse } from 'msw'")
    expect(handlersContent).toContain('http.get')
  })

  it('supports fetch strategy', () => {
    execSync(
      `npx tsx ${cliPath} generate --spec ${specPath} --fetcher fetch --output ${tmpDir}`,
      { cwd, encoding: 'utf-8' }
    )

    expect(fs.existsSync(path.join(tmpDir, 'types.ts'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'client.ts'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'index.ts'))).toBe(true)

    // Fetch strategy should NOT have query-keys.ts
    expect(fs.existsSync(path.join(tmpDir, 'query-keys.ts'))).toBe(false)

    // Verify fetch hooks use useState/useEffect
    const petsDir = path.join(tmpDir, 'pets')
    expect(fs.existsSync(petsDir)).toBe(true)
    const petsFiles = fs.readdirSync(petsDir).filter(f => f !== 'index.ts')
    expect(petsFiles.length).toBeGreaterThan(0)
    const firstHook = fs.readFileSync(path.join(petsDir, petsFiles[0]), 'utf-8')
    expect(firstHook).toContain("from 'react'")
  })

  it('supports axios strategy', () => {
    const axiosDir = path.join(tmpDir, 'axios')
    fs.mkdirSync(axiosDir, { recursive: true })

    execSync(
      `npx tsx ${cliPath} generate --spec ${specPath} --fetcher axios --output ${axiosDir}`,
      { cwd, encoding: 'utf-8' }
    )

    expect(fs.existsSync(path.join(axiosDir, 'types.ts'))).toBe(true)
    expect(fs.existsSync(path.join(axiosDir, 'client.ts'))).toBe(true)

    // Axios client should import axios
    const clientContent = fs.readFileSync(path.join(axiosDir, 'client.ts'), 'utf-8')
    expect(clientContent).toContain("import axios from 'axios'")
    expect(clientContent).toContain('apiClient')
  })

  it('supports swr strategy', () => {
    const swrDir = path.join(tmpDir, 'swr')
    fs.mkdirSync(swrDir, { recursive: true })

    execSync(
      `npx tsx ${cliPath} generate --spec ${specPath} --fetcher swr --output ${swrDir}`,
      { cwd, encoding: 'utf-8' }
    )

    expect(fs.existsSync(path.join(swrDir, 'types.ts'))).toBe(true)
    expect(fs.existsSync(path.join(swrDir, 'client.ts'))).toBe(true)
    expect(fs.existsSync(path.join(swrDir, 'index.ts'))).toBe(true)

    // SWR hooks should use swr imports
    const petsDir = path.join(swrDir, 'pets')
    expect(fs.existsSync(petsDir)).toBe(true)
  })

  it('supports --base-url flag', () => {
    execSync(
      `npx tsx ${cliPath} generate --spec ${specPath} --fetcher fetch --output ${tmpDir} --base-url https://custom.example.com`,
      { cwd, encoding: 'utf-8' }
    )

    const clientContent = fs.readFileSync(path.join(tmpDir, 'client.ts'), 'utf-8')
    expect(clientContent).toContain('https://custom.example.com')
  })

  it('works with Swagger 2.0 specs', () => {
    const swaggerSpec = path.resolve(__dirname, '../fixtures/petstore-swagger2.json')

    execSync(
      `npx tsx ${cliPath} generate --spec ${swaggerSpec} --fetcher react-query --output ${tmpDir}`,
      { cwd, encoding: 'utf-8' }
    )

    expect(fs.existsSync(path.join(tmpDir, 'types.ts'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'client.ts'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'index.ts'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'pets'))).toBe(true)
  })

  it('works with GraphQL SDL specs', () => {
    const graphqlSpec = path.resolve(__dirname, '../fixtures/schema.graphql')

    execSync(
      `npx tsx ${cliPath} generate --spec ${graphqlSpec} --fetcher swr --output ${tmpDir}`,
      { cwd, encoding: 'utf-8' }
    )

    expect(fs.existsSync(path.join(tmpDir, 'types.ts'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'client.ts'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'index.ts'))).toBe(true)
    // GraphQL uses 'queries' and 'mutations' as tag names
    expect(fs.existsSync(path.join(tmpDir, 'queries'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'mutations'))).toBe(true)
  })

  it('fails with missing --spec option', () => {
    expect(() => {
      execSync(
        `npx tsx ${cliPath} generate`,
        { cwd, encoding: 'utf-8', stdio: 'pipe' }
      )
    }).toThrow()
  })

  it('fails with invalid spec file path', () => {
    expect(() => {
      execSync(
        `npx tsx ${cliPath} generate --spec /nonexistent/spec.yaml --output ${tmpDir}`,
        { cwd, encoding: 'utf-8', stdio: 'pipe' }
      )
    }).toThrow()
  })

  it('uses default fetcher (fetch) when --fetcher is omitted', () => {
    execSync(
      `npx tsx ${cliPath} generate --spec ${specPath} --output ${tmpDir}`,
      { cwd, encoding: 'utf-8' }
    )

    expect(fs.existsSync(path.join(tmpDir, 'types.ts'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'client.ts'))).toBe(true)

    // Default fetcher is 'fetch', so hooks should use React useState/useEffect
    const petsDir = path.join(tmpDir, 'pets')
    expect(fs.existsSync(petsDir)).toBe(true)
    const petsFiles = fs.readdirSync(petsDir).filter(f => f !== 'index.ts')
    const firstHook = fs.readFileSync(path.join(petsDir, petsFiles[0]), 'utf-8')
    expect(firstHook).toContain("from 'react'")
    // Should NOT have query-keys.ts (that's react-query only)
    expect(fs.existsSync(path.join(tmpDir, 'query-keys.ts'))).toBe(false)
  })

  it('suppresses output with --silent flag', () => {
    const result = execSync(
      `npx tsx ${cliPath} generate --spec ${specPath} --fetcher fetch --output ${tmpDir} --silent`,
      { cwd, encoding: 'utf-8' }
    )

    // Silent mode should produce no stdout
    expect(result.trim()).toBe('')

    // But files should still be generated
    expect(fs.existsSync(path.join(tmpDir, 'types.ts'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'client.ts'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'index.ts'))).toBe(true)
  })

  it('generates with both --zod and --mock flags together', () => {
    execSync(
      `npx tsx ${cliPath} generate --spec ${specPath} --fetcher react-query --output ${tmpDir} --zod --mock`,
      { cwd, encoding: 'utf-8' }
    )

    // All core files
    expect(fs.existsSync(path.join(tmpDir, 'types.ts'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'client.ts'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'index.ts'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'query-keys.ts'))).toBe(true)

    // Zod schemas
    expect(fs.existsSync(path.join(tmpDir, 'schemas.ts'))).toBe(true)

    // Mock files
    expect(fs.existsSync(path.join(tmpDir, 'mocks/handlers.ts'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, 'mocks/data.ts'))).toBe(true)
  })
}, { timeout: 60_000 })
