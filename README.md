# React Hooks Generator from OpenAPI, Swagger & GraphQL | auto-api-hooks

[![npm version](https://img.shields.io/npm/v/auto-api-hooks)](https://www.npmjs.com/package/auto-api-hooks)
[![npm downloads](https://img.shields.io/npm/dm/auto-api-hooks)](https://www.npmjs.com/package/auto-api-hooks)
[![bundle size](https://img.shields.io/bundlephobia/minzip/auto-api-hooks)](https://bundlephobia.com/package/auto-api-hooks)
[![license](https://img.shields.io/npm/l/auto-api-hooks)](https://github.com/abdallaemadeldin/auto-api-hooks/blob/master/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)

Generate React Query hooks from OpenAPI specs. Generate SWR hooks from Swagger. Generate type-safe TypeScript API hooks from GraphQL schemas. One command, fully typed, tree-shakeable output with optional Zod schemas and MSW v2 mocks.

> `auto-api-hooks` -- the OpenAPI to React hooks generator that also supports Swagger 2.0 and GraphQL. Produces TanStack React Query v5 hooks, SWR hooks, or plain fetch hooks with zero config.

`auto-api-hooks` is an API client generator and code generation tool that reads any OpenAPI 3.x, Swagger 2.0, or GraphQL schema and produces ready-to-use React hooks, TypeScript types, Zod validation schemas, and MSW v2 mock handlers -- all from a single `npx` command or programmatic API call.

## Why Use an OpenAPI to React Hooks Generator?

Maintaining hand-written fetch logic, TypeScript interfaces, and data-fetching hooks across dozens of API endpoints doesn't scale. Every backend change means manually updating types, adjusting error handling, and keeping request/response shapes in sync -- across every component that calls the API. Most OpenAPI code generation tools stop at a raw API client, leaving you to wire up React Query, SWR, or custom hooks yourself. `auto-api-hooks` generates idiomatic React hooks directly: `useQuery` for reads, `useMutation` for writes, `useInfiniteQuery` for paginated endpoints -- with full TypeScript types, optional Zod runtime validation, and MSW v2 mock servers.

**Compared to alternatives:**

- **vs orval** -- supports GraphQL schemas in addition to OpenAPI/Swagger, generates MSW v2 handlers (not v1) out of the box
- **vs openapi-codegen** -- single `npx` command with no config file required; programmatic API for CI/CD integration included
- **vs swagger-typescript-api** -- produces React hooks directly (React Query v5, SWR, or plain fetch) rather than a raw API client, with built-in pagination detection and infinite query generation
- **vs openapi-typescript-codegen** -- generates Zod validation schemas from OpenAPI with format-aware refinements and watch mode for development workflows

## Features

- **OpenAPI to TypeScript React hooks** -- Generate React hooks from OpenAPI 3.x, Swagger 2.0, and GraphQL schemas
- **Generate React Query hooks from OpenAPI** -- TanStack React Query v5, SWR, Axios, or plain `fetch`
- **Generate Zod schemas from OpenAPI** -- Format-aware refinements (`email`, `uuid`, `date-time`) for runtime response validation
- **Auto-detect pagination, generate infinite query hooks** -- Cursor-based, offset-limit, and page-number patterns detected automatically
- **Generate MSW v2 mock server from API spec** -- Request handlers, mock data factories, and server/browser setup files
- **CLI tool + programmatic API** -- Use from the terminal or import `generate()` in your build scripts
- **Watch mode** -- File-watching with debounced regeneration for development workflows
- **Fully typed TypeScript output** -- Per-operation params, body, and response types emitted as interfaces
- **One hook per file** -- Maximum tree-shakeability; bundlers only include what you import
- **React Query cache key factories** -- Following TanStack v5 best practices

## Quick Start

Install the package:

```bash
npm install auto-api-hooks
```

Generate React hooks from your OpenAPI specification:

```bash
npx auto-api-hooks generate --spec ./openapi.yaml --fetcher react-query --output ./src/hooks
```

Use the generated hooks in your React components:

```tsx
import { useGetUsers, useCreateUser, configureClient } from './hooks'

// Configure the client once at app startup
configureClient({
  baseUrl: 'https://api.example.com',
  headers: { Authorization: `Bearer ${token}` },
})

function UserList() {
  const { data, error, isLoading } = useGetUsers()

  if (isLoading) return <p>Loading...</p>
  if (error) return <p>Error: {error.message}</p>

  return (
    <ul>
      {data?.map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  )
}
```

## CLI Usage -- Generate React Hooks from OpenAPI, Swagger, or GraphQL

```
auto-api-hooks generate [options]
```

### Flags

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--spec <path>` | Yes | -- | Path to the API spec file (OpenAPI YAML/JSON, Swagger JSON, GraphQL SDL, or introspection JSON) |
| `--fetcher <strategy>` | No | `fetch` | Fetching strategy: `fetch`, `axios`, `react-query`, or `swr` |
| `--output <dir>` | No | `./src/hooks` | Output directory for generated files |
| `--base-url <url>` | No | From spec | Override the base URL defined in the specification |
| `--zod` | No | `false` | Generate Zod validation schemas for response types |
| `--mock` | No | `false` | Generate MSW v2 mock server handlers and data factories |
| `--watch` | No | `false` | Watch the spec file and regenerate on change |
| `--no-infinite` | No | -- | Disable automatic infinite query generation for paginated endpoints |
| `--tag <tags...>` | No | All tags | Filter operations by tag (can specify multiple) |
| `--verbose` | No | `false` | Enable verbose logging output |

### Example Commands

**Plain fetch hooks:**

```bash
npx auto-api-hooks generate \
  --spec ./openapi.yaml \
  --fetcher fetch \
  --output ./src/api
```

**Axios hooks:**

```bash
npx auto-api-hooks generate \
  --spec ./swagger.json \
  --fetcher axios \
  --output ./src/hooks
```

**React Query hooks with Zod validation:**

```bash
npx auto-api-hooks generate \
  --spec ./openapi.yaml \
  --fetcher react-query \
  --zod \
  --output ./src/hooks
```

**SWR hooks with mock server:**

```bash
npx auto-api-hooks generate \
  --spec ./openapi.yaml \
  --fetcher swr \
  --mock \
  --output ./src/hooks
```

**GraphQL hooks filtered by tag:**

```bash
npx auto-api-hooks generate \
  --spec ./schema.graphql \
  --fetcher react-query \
  --tag queries mutations \
  --output ./src/hooks
```

**Watch mode for development:**

```bash
npx auto-api-hooks generate \
  --spec ./openapi.yaml \
  --fetcher react-query \
  --zod \
  --mock \
  --watch \
  --output ./src/hooks
```

## Programmatic API

Import `generate()` directly for use in build scripts, custom tooling, or CI pipelines:

```ts
import { generate } from 'auto-api-hooks'

const files = await generate({
  spec: './openapi.yaml',       // Path to spec file, or a parsed object
  fetcher: 'react-query',       // 'fetch' | 'axios' | 'react-query' | 'swr'
  outputDir: './src/hooks',     // Write files to disk when provided
  baseUrl: 'https://api.example.com',
  zod: true,                    // Generate Zod schemas
  mock: true,                   // Generate MSW mock handlers
  infiniteQueries: true,        // Generate infinite query hooks (default: true)
})

// `files` is an array of { path: string, content: string }
console.log(`Generated ${files.length} files`)
```

### GenerateOptions

```ts
interface GenerateOptions {
  /** Path to the API spec file, or a parsed object. */
  spec: string | object
  /** Fetching strategy. */
  fetcher: 'fetch' | 'axios' | 'react-query' | 'swr'
  /** Output directory. If provided, files are written to disk. */
  outputDir?: string
  /** Override base URL from the spec. */
  baseUrl?: string
  /** Generate Zod validation schemas. */
  zod?: boolean
  /** Generate MSW mock server handlers. */
  mock?: boolean
  /** Generate infinite query hooks for paginated endpoints. Default: true. */
  infiniteQueries?: boolean
}
```

When `outputDir` is omitted, `generate()` returns the generated files in memory without writing to disk. This is useful for testing or piping output to other tools.

### Additional Exports

The package also exports lower-level building blocks:

```ts
import {
  // Parsing
  parseSpec,

  // Generation
  generateHooks,
  createGenerator,

  // Mock generation
  generateMockFiles,

  // Type emission
  emitTypeScriptTypes,
  emitTypeString,
  emitZodSchemas,
  emitZodType,
} from 'auto-api-hooks'
```

## Generated Output Structure

A typical generation with `--fetcher react-query --zod --mock` produces the following directory tree:

```
src/hooks/
  index.ts              # Barrel file re-exporting everything
  client.ts             # API client configuration (configureClient, getClientConfig)
  types.ts              # TypeScript interfaces for all params, bodies, and responses
  schemas.ts            # Zod validation schemas (when --zod is enabled)
  query-keys.ts         # Cache key factories (react-query only)
  users/
    index.ts            # Barrel for the "users" tag group
    get-users.ts        # useGetUsers (useQuery)
    get-users-infinite.ts  # useGetUsersInfinite (useInfiniteQuery, when paginated)
    get-user.ts         # useGetUser (useQuery)
    create-user.ts      # useCreateUser (useMutation)
    update-user.ts      # useUpdateUser (useMutation)
    delete-user.ts      # useDeleteUser (useMutation)
  posts/
    index.ts
    get-posts.ts
    get-post.ts
    create-post.ts
  mocks/
    index.ts            # Mock barrel file
    data.ts             # Mock data factory functions
    handlers.ts         # MSW v2 request handlers
    server.ts           # setupServer() for Node.js (tests, SSR)
    browser.ts          # setupWorker() for browser (development)
```

Operations are grouped by their first tag from the API specification. Each hook lives in its own file for maximum tree-shakeability.

## Fetcher Strategies

### fetch (Plain)

Uses `useState`, `useEffect`, and the native Fetch API. Zero external dependencies beyond React.

**Read operations** return `{ data, error, isLoading, refetch }` and include:
- Built-in `AbortController` support for request cancellation on unmount
- Automatic refetch when parameters change
- Optional `enabled` flag to defer fetching

**Write operations** return `{ data, error, isLoading, mutate, reset }` with an imperative `mutate()` function.

```tsx
import { useGetUsers, useCreateUser } from './hooks'

function Example() {
  // Read hook: fetches automatically
  const { data, error, isLoading, refetch } = useGetUsers(
    { page: 1, limit: 20 },
    { enabled: true }
  )

  // Write hook: call mutate() to execute
  const { mutate, isLoading: isCreating } = useCreateUser()

  const handleCreate = async () => {
    const newUser = await mutate({ name: 'Alice', email: 'alice@example.com' })
    refetch()
  }

  // ...
}
```

**Peer dependencies:** none (only React)

### axios

Uses an Axios instance with shared configuration. Hooks follow the same `useState`/`useEffect` pattern as the plain fetch strategy but use `apiClient.get()`, `apiClient.post()`, etc.

The generated `client.ts` exports a pre-configured Axios instance:

```ts
import { apiClient, configureClient } from './hooks'

// Configure at startup
configureClient({
  baseUrl: 'https://api.example.com',
  headers: { Authorization: `Bearer ${token}` },
})

// Add interceptors directly
apiClient.interceptors.request.use((config) => {
  // Custom request logic
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle auth errors
    }
    return Promise.reject(error)
  }
)
```

**Peer dependencies:** `axios`

### react-query (TanStack React Query v5)

Full integration with TanStack React Query v5 including:

- **`useQuery`** for GET operations with typed query keys
- **`useMutation`** for POST/PUT/PATCH/DELETE operations
- **`useInfiniteQuery`** for paginated endpoints (auto-detected)
- **Cache key factories** per resource following v5 best practices

```tsx
import {
  useGetUsers,
  useGetUsersInfinite,
  useCreateUser,
  userKeys,
} from './hooks'
import { useQueryClient } from '@tanstack/react-query'

function UserList() {
  const queryClient = useQueryClient()

  // Standard query
  const { data, isLoading } = useGetUsers(
    { limit: 20 },
    { staleTime: 5 * 60 * 1000 }
  )

  // Infinite query for pagination
  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
  } = useGetUsersInfinite({ limit: 20 })

  // Mutation with cache invalidation
  const createUser = useCreateUser({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() })
    },
  })

  return (
    // ...
  )
}
```

**Generated cache key factories** (`query-keys.ts`):

```ts
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (params?: Record<string, unknown>) => [...userKeys.lists(), params] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string | number) => [...userKeys.details(), id] as const,
} as const
```

**Peer dependencies:** `@tanstack/react-query` (v5)

### swr

Integration with Vercel's SWR library:

- **`useSWR`** for GET operations with automatic revalidation
- **`useSWRMutation`** for write operations
- **`useSWRInfinite`** for paginated endpoints (auto-detected)

```tsx
import { useGetUsers, useGetUsersInfinite, useCreateUser } from './hooks'

function UserList() {
  // SWR hook with conditional fetching
  const { data, error, isLoading } = useGetUsers(
    { limit: 20 },
    { enabled: true }
  )

  // Infinite loading
  const { data: pages, size, setSize } = useGetUsersInfinite({ limit: 20 })

  // Mutation
  const { trigger, isMutating } = useCreateUser()
  const handleCreate = () => {
    trigger({ body: { name: 'Alice', email: 'alice@example.com' } })
  }

  return (
    // ...
  )
}
```

**Peer dependencies:** `swr`

## Zod Validation

When the `--zod` flag is provided, `auto-api-hooks` generates a `schemas.ts` file containing Zod schemas for every named type and every operation response in the specification.

### What Gets Generated

- **Named type schemas** -- One schema per `components.schemas` entry (OpenAPI) or per named type (GraphQL)
- **Response schemas** -- One schema per operation response, named `<operationId>ResponseSchema`
- **Format-aware refinements** -- String formats like `date-time`, `email`, `uuid`, and `uri` are mapped to their corresponding Zod validators

Example generated schema:

```ts
import { z } from 'zod'

export const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
  role: z.enum(['admin', 'user', 'guest']),
  avatar: z.string().url().optional(),
})

export const getUsersResponseSchema = z.array(userSchema)
```

### How It Integrates

When Zod is enabled, each generated hook automatically imports its response schema and validates the API response at runtime:

```ts
// Inside a generated hook (react-query example)
queryFn: async () => {
  const config = getClientConfig()
  const res = await fetch(url.toString(), { /* ... */ })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  const json = await res.json()
  return getUsersResponseSchema.parse(json) as GetUsersResponse
}
```

This catches schema mismatches at runtime -- helpful for detecting backend contract drift during development.

**Peer dependency when using `--zod`:** `zod`

## Mock Server (MSW)

The `--mock` flag generates a complete MSW v2 mock server setup, ready for use in tests and browser development.

### Generated Files

| File | Purpose |
|------|---------|
| `mocks/data.ts` | Factory functions that return realistic mock data for each operation |
| `mocks/handlers.ts` | MSW `http.*` request handlers wired to the data factories |
| `mocks/server.ts` | `setupServer()` for Node.js environments (tests, SSR) |
| `mocks/browser.ts` | `setupWorker()` for browser environments (development) |
| `mocks/index.ts` | Barrel file re-exporting handlers and data factories |

### Using in Tests

```ts
import { server } from './hooks/mocks/server'
import { beforeAll, afterEach, afterAll } from 'vitest'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

### Using in the Browser (Development)

```ts
// src/main.tsx
async function enableMocking() {
  if (process.env.NODE_ENV !== 'development') return
  const { worker } = await import('./hooks/mocks/browser')
  return worker.start()
}

enableMocking().then(() => {
  // Render your app
})
```

### Overriding Individual Handlers

```ts
import { http, HttpResponse } from 'msw'
import { server } from './hooks/mocks/server'

test('handles server error', async () => {
  server.use(
    http.get('https://api.example.com/users', () => {
      return HttpResponse.json({ message: 'Internal error' }, { status: 500 })
    })
  )
  // Test error handling...
})
```

**Peer dependency when using `--mock`:** `msw` (v2)

## Pagination Detection

`auto-api-hooks` automatically analyzes GET and QUERY operations to detect pagination patterns. When pagination is detected, an additional infinite query hook is generated alongside the standard hook (for `react-query` and `swr` strategies).

### Detection Heuristics

The detection engine inspects both query parameters and response body shape:

**Cursor-based pagination:**
- Query params: `cursor`, `after`, `before`, `page_token`, `pageToken`, `next_token`, `nextToken`, `starting_after`, `startingAfter`, `ending_before`, `endingBefore`
- Response fields: `nextCursor`, `next_cursor`, `cursor`, `nextPageToken`, `next_page_token`, `nextToken`, `next_token`, `endCursor`, `end_cursor`, `hasMore`, `has_more`

**Offset-limit pagination:**
- Query params: `offset` or `skip` combined with `limit`, `count`, `size`, `per_page`, `perPage`, `page_size`, or `pageSize`

**Page-number pagination:**
- Query params: `page`, `page_number`, `pageNumber`, or `p`
- Response fields: `totalPages`, `total_pages`, `totalCount`, `total_count`, `total`, `pageCount`, `page_count`, `lastPage`, `last_page`

**Response items detection:**
- Array fields named: `items`, `data`, `results`, `records`, `edges`, `nodes`, `entries`, `list`, `rows`, `content`, `hits`
- Nested pagination metadata in `pagination`, `meta`, `page_info`, or `pageInfo` objects

**GraphQL Relay connections:**
- Detected via `edges`/`nodes` array fields in the response type

### Disabling Pagination Detection

To disable infinite query generation entirely:

```bash
npx auto-api-hooks generate --spec ./openapi.yaml --fetcher react-query --no-infinite
```

Or via the programmatic API:

```ts
await generate({
  spec: './openapi.yaml',
  fetcher: 'react-query',
  infiniteQueries: false,
})
```

## Supported Spec Formats

### OpenAPI 3.x

Full support for OpenAPI 3.0 and 3.1 specifications, including:

- `$ref` resolution across the document, including multi-file specs with external `$ref` paths (e.g. `$ref: './paths/users.yaml'`)
- `components.schemas` mapped to TypeScript types and optional Zod schemas
- `servers[0].url` used as the default base URL
- All HTTP methods: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- Path parameters, query parameters, and header parameters
- Request bodies (`application/json`)
- Response schemas with status codes
- `deprecated` flag on operations
- Tag-based grouping of generated hooks
- `x-pagination` vendor extension for explicit pagination hints

**Supported file formats:** `.yaml`, `.yml`, `.json` (single-file or multi-file with relative `$ref` references)

### Swagger 2.0

Full support for Swagger 2.0 specifications, including:

- `definitions` mapped to TypeScript types
- `host` + `basePath` combined into the base URL
- All standard Swagger features (parameters, responses, tags)
- Multi-file specs with external `$ref` paths

**Supported file formats:** `.yaml`, `.yml`, `.json` (single-file or multi-file with relative `$ref` references)

### GraphQL

Support for GraphQL schemas via two input methods:

- **SDL schema files** (`.graphql`, `.gql`) -- Parsed with `graphql-js` `buildSchema()`
- **Introspection JSON** -- Supports both `{ __schema: ... }` and `{ data: { __schema: ... } }` formats

Mapping rules:

| GraphQL Concept | Generated Hook Type |
|----------------|---------------------|
| Query fields | `useQuery` / `useSWR` (GET-equivalent) |
| Mutation fields | `useMutation` / `useSWRMutation` (POST-equivalent) |
| Subscription fields | Included in operations (tagged as `subscriptions`) |
| Object types | TypeScript interfaces |
| Input types | TypeScript interfaces (used for arguments) |
| Enum types | TypeScript string unions + Zod enums |
| Union types | TypeScript union types |
| Scalar types | Mapped to primitives (`String` -> `string`, `Int` -> `number`, `ID` -> `string`, `DateTime` -> `string` with `date-time` format) |

Relay-style connection patterns (`edges`/`nodes`) are detected for automatic infinite query generation.

## API Reference

### Core Types

```ts
/** Fetcher strategy identifier. */
type FetcherStrategy = 'fetch' | 'axios' | 'react-query' | 'swr'

/** Options for the generate() function. */
interface GenerateOptions {
  spec: string | object
  fetcher: FetcherStrategy
  outputDir?: string
  baseUrl?: string
  zod?: boolean
  mock?: boolean
  infiniteQueries?: boolean
}

/** A generated file ready to be written to disk. */
interface GeneratedFile {
  /** Relative path from the output directory. */
  path: string
  /** Generated source code content. */
  content: string
}

/** Options for the parseSpec() function. */
interface ParseOptions {
  baseUrl?: string
}

/** Generator options passed to hook generators. */
interface GeneratorOptions {
  fetcher: FetcherStrategy
  zod: boolean
  mock: boolean
  outputDir: string
  baseUrl?: string
  infiniteQueries: boolean
}

/** Interface implemented by all hook generators. */
interface HookGenerator {
  generate(spec: ApiSpec, options: GeneratorOptions): GeneratedFile[]
}
```

### Intermediate Representation (IR) Types

All parsers produce and all generators consume these types:

```ts
/** The complete normalized API specification. */
interface ApiSpec {
  title: string
  baseUrl: string
  version: string
  operations: ApiOperation[]
  types: Map<string, ApiType>
}

/** A single API operation. */
interface ApiOperation {
  operationId: string
  summary?: string
  method: OperationMethod
  path: string
  tags: string[]
  pathParams: ApiParam[]
  queryParams: ApiParam[]
  headerParams: ApiParam[]
  requestBody?: ApiRequestBody
  response: ApiResponse
  pagination?: PaginationInfo
  deprecated: boolean
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'
type OperationMethod = HttpMethod | 'QUERY' | 'MUTATION' | 'SUBSCRIPTION'

/** Recursive type system covering JSON Schema and GraphQL types. */
type ApiType =
  | ApiPrimitiveType   // { kind: 'primitive', type: 'string' | 'number' | ... }
  | ApiObjectType      // { kind: 'object', properties: ApiProperty[] }
  | ApiArrayType       // { kind: 'array', items: ApiType }
  | ApiEnumType        // { kind: 'enum', values: (string | number)[] }
  | ApiUnionType       // { kind: 'union', variants: ApiType[] }
  | ApiRefType         // { kind: 'ref', name: string }

type PaginationStrategy = 'cursor' | 'offset-limit' | 'page-number'

interface PaginationInfo {
  strategy: PaginationStrategy
  pageParam: string
  nextPagePath: string[]
  itemsPath: string[]
}
```

## Configuration

### Client Configuration (fetch, react-query, swr)

The generated `client.ts` file exports `configureClient()` for setting the base URL and default headers:

```ts
import { configureClient } from './hooks'

// Set at app startup
configureClient({
  baseUrl: 'https://api.example.com/v1',
  headers: {
    Authorization: `Bearer ${getToken()}`,
    'X-Request-ID': crypto.randomUUID(),
  },
})
```

To update headers dynamically (e.g., after login):

```ts
function onLogin(token: string) {
  configureClient({
    headers: { Authorization: `Bearer ${token}` },
  })
}
```

### Client Configuration (axios)

The Axios strategy generates a shared `apiClient` Axios instance. Use it for advanced configuration:

```ts
import { apiClient, configureClient } from './hooks'

// Simple configuration
configureClient({
  baseUrl: 'https://api.example.com/v1',
  headers: { Authorization: `Bearer ${token}` },
})

// Advanced: use Axios interceptors
apiClient.interceptors.request.use((config) => {
  config.headers.Authorization = `Bearer ${getLatestToken()}`
  return config
})
```

### Base URL Override

You can override the base URL from the spec at generation time:

```bash
npx auto-api-hooks generate \
  --spec ./openapi.yaml \
  --fetcher react-query \
  --base-url https://staging-api.example.com
```

Or at runtime using `configureClient()` as shown above.

## Watch Mode

Watch mode monitors your spec file for changes and automatically regenerates hooks. It uses `chokidar` with write-finish stabilization (300ms threshold) to avoid regenerating during partial writes.

```bash
npx auto-api-hooks generate \
  --spec ./openapi.yaml \
  --fetcher react-query \
  --zod \
  --watch
```

Watch mode:
1. Performs an initial generation
2. Watches the spec file for changes
3. Debounces rapid file system events (stabilization threshold: 300ms, poll interval: 100ms)
4. Regenerates all hooks on each detected change
5. Logs errors without crashing if the spec is temporarily invalid
6. Stops cleanly on `SIGINT` (Ctrl+C)

## Examples

### Basic React Query Setup

**1. Start with an OpenAPI spec (`openapi.yaml`):**

```yaml
openapi: 3.0.3
info:
  title: Todo API
  version: 1.0.0
servers:
  - url: https://api.todo.app
paths:
  /todos:
    get:
      operationId: getTodos
      tags: [todos]
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [pending, completed]
      responses:
        '200':
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Todo'
    post:
      operationId: createTodo
      tags: [todos]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateTodoInput'
      responses:
        '201':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Todo'
  /todos/{id}:
    get:
      operationId: getTodo
      tags: [todos]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Todo'
components:
  schemas:
    Todo:
      type: object
      required: [id, title, status]
      properties:
        id:
          type: string
          format: uuid
        title:
          type: string
        status:
          type: string
          enum: [pending, completed]
        createdAt:
          type: string
          format: date-time
    CreateTodoInput:
      type: object
      required: [title]
      properties:
        title:
          type: string
```

**2. Generate hooks:**

```bash
npx auto-api-hooks generate \
  --spec ./openapi.yaml \
  --fetcher react-query \
  --output ./src/hooks
```

**3. Use in your application:**

```tsx
// src/App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { configureClient } from './hooks'
import { TodoList } from './components/TodoList'

const queryClient = new QueryClient()

configureClient({ baseUrl: 'https://api.todo.app' })

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TodoList />
    </QueryClientProvider>
  )
}
```

```tsx
// src/components/TodoList.tsx
import { useGetTodos, useCreateTodo, todoKeys } from '../hooks'
import { useQueryClient } from '@tanstack/react-query'

export function TodoList() {
  const queryClient = useQueryClient()
  const { data: todos, isLoading } = useGetTodos({ status: 'pending' })

  const createTodo = useCreateTodo({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: todoKeys.lists() })
    },
  })

  const handleAdd = () => {
    createTodo.mutate({
      body: { title: 'New task' },
    })
  }

  if (isLoading) return <p>Loading todos...</p>

  return (
    <div>
      <button onClick={handleAdd} disabled={createTodo.isPending}>
        Add Todo
      </button>
      <ul>
        {todos?.map((todo) => (
          <li key={todo.id}>{todo.title} ({todo.status})</li>
        ))}
      </ul>
    </div>
  )
}
```

### Using with Zod + Mock Server

This example demonstrates the full development workflow with runtime validation and mocked API responses.

**1. Generate with all options:**

```bash
npx auto-api-hooks generate \
  --spec ./openapi.yaml \
  --fetcher react-query \
  --zod \
  --mock \
  --output ./src/hooks
```

**2. Enable mocking in development:**

```ts
// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'

async function main() {
  if (process.env.NODE_ENV === 'development') {
    const { worker } = await import('./hooks/mocks/browser')
    await worker.start({ onUnhandledRequest: 'bypass' })
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

main()
```

**3. Write tests with the mock server:**

```ts
// src/components/__tests__/TodoList.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { server } from '../../hooks/mocks/server'
import { TodoList } from '../TodoList'
import { beforeAll, afterEach, afterAll, test, expect } from 'vitest'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  )
}

test('renders todo list from mock data', async () => {
  renderWithClient(<TodoList />)

  await waitFor(() => {
    expect(screen.queryByText('Loading todos...')).not.toBeInTheDocument()
  })

  // Mock data from generated factories is rendered
  expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0)
})
```

**4. Zod catches contract drift:**

If the backend returns data that does not match the schema, the Zod `.parse()` call inside the hook throws a `ZodError` with a detailed path to the invalid field. This surfaces API contract violations immediately during development rather than silently producing incorrect UI state.

## FAQ

**Does auto-api-hooks support OpenAPI 3.1?**
Yes. Both OpenAPI 3.0 and 3.1 are fully supported, including multi-file specs with external `$ref` references.

**Can I use it with Swagger 2.0?**
Yes. Swagger 2.0 YAML and JSON files are supported alongside OpenAPI 3.x and GraphQL SDL/introspection.

**Which React data-fetching libraries does it support?**
Plain `fetch` (no extra dependencies), Axios, TanStack React Query v5, and SWR. Each generates idiomatic hooks for that library.

**Does it generate TypeScript types automatically?**
Yes. Every generated hook is fully typed -- path params, query params, request body, and response types are all emitted as TypeScript interfaces.

**Can I generate Zod schemas from my OpenAPI spec?**
Yes. Pass `--zod` to generate a `schemas.ts` file with Zod schemas for every named type and operation response, including format-aware refinements (`email`, `uuid`, `date-time`, `uri`).

**Does it generate MSW mocks?**
Yes. Pass `--mock` to generate a complete MSW v2 mock server with request handlers, data factories, and `setupServer`/`setupWorker` setup files.

**How is this different from orval or openapi-typescript-codegen?**
`auto-api-hooks` uniquely combines OpenAPI, Swagger, and GraphQL support in one tool, generates MSW v2 handlers (not v1), produces one hook per file for maximum tree-shakeability, and includes smart pagination detection with automatic infinite query hook generation.

**Can I use it programmatically in a build script?**
Yes. Import `generate()` directly from `auto-api-hooks` and pass a parsed spec object or file path. It returns generated file contents in memory when `outputDir` is omitted.

## Support

If you find this package useful, consider buying me a coffee!

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-yellow?style=flat&logo=buy-me-a-coffee)](https://buymeacoffee.com/aemadeldin)

---

## License

MIT
