/**
 * Mock generation public API.
 */
import type { ApiSpec } from '../ir/types'
import type { GeneratedFile } from '../utils/file-writer'
import { emitMockDataFile } from './faker-helpers'
import { emitMswHandlers, emitMswServerSetup, emitMswBrowserSetup, emitMockIndex } from './handler-emitter'

/**
 * Generate all mock-related files.
 */
export function generateMockFiles(spec: ApiSpec): GeneratedFile[] {
  return [
    { path: 'mocks/data.ts', content: emitMockDataFile(spec) },
    { path: 'mocks/handlers.ts', content: emitMswHandlers(spec) },
    { path: 'mocks/server.ts', content: emitMswServerSetup() },
    { path: 'mocks/browser.ts', content: emitMswBrowserSetup() },
    { path: 'mocks/index.ts', content: emitMockIndex() },
  ]
}

export { emitMockDataFile, emitMockDataFunction, emitMockValue } from './faker-helpers'
export { emitMswHandlers, emitMswServerSetup, emitMswBrowserSetup, emitMockIndex } from './handler-emitter'
