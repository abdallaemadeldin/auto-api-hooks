/**
 * CLI entry point for auto-api-hooks.
 *
 * Usage:
 *   npx auto-api-hooks generate --spec openapi.yaml --fetcher react-query --output ./src/hooks
 */
import { Command } from 'commander'
import pc from 'picocolors'
import { logger, setVerbose, setSilent } from './utils/logger'
import { parseSpec } from './parsers/index'
import { generateHooks } from './generators/index'
import { generateMockFiles } from './mock-gen/index'
import { writeFiles } from './utils/file-writer'
import type { FetcherStrategy } from './generators/types'

const program = new Command()

program
  .name('auto-api-hooks')
  .description('Auto-generate type-safe React hooks from OpenAPI, Swagger, or GraphQL specs.')
  .version('1.0.0')

program
  .command('generate')
  .description('Generate React hooks from an API specification')
  .requiredOption('--spec <path>', 'Path to API spec file (OpenAPI, Swagger, or GraphQL)')
  .option('--fetcher <strategy>', 'Fetching strategy: fetch | axios | react-query | swr', 'fetch')
  .option('--output <dir>', 'Output directory', './src/hooks')
  .option('--base-url <url>', 'Override base URL from spec')
  .option('--zod', 'Generate Zod validation schemas', false)
  .option('--mock', 'Generate MSW mock server', false)
  .option('--watch', 'Watch spec file and regenerate on change', false)
  .option('--no-infinite', 'Disable infinite query generation for paginated endpoints')
  .option('--tag <tags...>', 'Only generate hooks for specific tags')
  .option('--verbose', 'Enable verbose logging', false)
  .option('--silent', 'Suppress all output except errors (ideal for CI)', false)
  .action(async (opts) => {
    const {
      spec: specPath,
      fetcher,
      output,
      baseUrl,
      zod,
      mock,
      watch,
      infinite,
      tag: tags,
      verbose,
      silent,
    } = opts

    if (silent) setSilent(true)
    if (verbose && !silent) setVerbose(true)

    // Validate fetcher strategy
    const validStrategies: FetcherStrategy[] = ['fetch', 'axios', 'react-query', 'swr']
    if (!validStrategies.includes(fetcher)) {
      logger.error(`Invalid fetcher strategy: ${pc.bold(fetcher)}`)
      logger.info(`Valid options: ${validStrategies.join(', ')}`)
      process.exit(1)
    }

    try {
      await runGenerate({
        specPath,
        fetcher: fetcher as FetcherStrategy,
        outputDir: output,
        baseUrl,
        zod: !!zod,
        mock: !!mock,
        infiniteQueries: infinite !== false,
        tags,
      })

      if (watch) {
        await startWatchMode(specPath, {
          specPath,
          fetcher: fetcher as FetcherStrategy,
          outputDir: output,
          baseUrl,
          zod: !!zod,
          mock: !!mock,
          infiniteQueries: infinite !== false,
          tags,
        })
      }
    } catch (err) {
      logger.error(err instanceof Error ? err.message : String(err))
      process.exit(1)
    }
  })

interface GenerateConfig {
  specPath: string
  fetcher: FetcherStrategy
  outputDir: string
  baseUrl?: string
  zod: boolean
  mock: boolean
  infiniteQueries: boolean
  tags?: string[]
}

async function runGenerate(config: GenerateConfig): Promise<void> {
  const startTime = Date.now()

  // 1. Parse spec
  logger.info(`Parsing ${pc.bold(config.specPath)}...`)
  const spec = await parseSpec(config.specPath, { baseUrl: config.baseUrl })

  // Filter by tags if specified
  if (config.tags && config.tags.length > 0) {
    const tagSet = new Set(config.tags)
    spec.operations = spec.operations.filter((op) =>
      op.tags.some((t) => tagSet.has(t)),
    )
  }

  logger.verbose(`Found ${spec.operations.length} operations, ${spec.types.size} types`)

  // 2. Generate hooks
  logger.info(`Generating ${pc.bold(config.fetcher)} hooks...`)
  const hookFiles = generateHooks(spec, {
    fetcher: config.fetcher,
    zod: config.zod,
    mock: false, // Mock files are generated separately
    outputDir: config.outputDir,
    baseUrl: config.baseUrl,
    infiniteQueries: config.infiniteQueries,
  })

  // 3. Generate mock files (if enabled)
  let mockFiles: { path: string; content: string }[] = []
  if (config.mock) {
    logger.info('Generating MSW mock server...')
    mockFiles = generateMockFiles(spec)
  }

  // 4. Write all files
  const allFiles = [...hookFiles, ...mockFiles]
  await writeFiles(config.outputDir, allFiles)

  const duration = Date.now() - startTime
  logger.success(
    `Generated ${pc.bold(String(allFiles.length))} files in ${pc.bold(config.outputDir)} (${duration}ms)`,
  )

  // Summary
  const hookCount = hookFiles.filter((f) => f.path.includes('use')).length
  logger.info(
    `  ${pc.cyan('Hooks:')} ${hookCount} | ${pc.cyan('Types:')} ${spec.types.size} | ${pc.cyan('Strategy:')} ${config.fetcher}${config.zod ? ` | ${pc.cyan('Zod:')} ✔` : ''}${config.mock ? ` | ${pc.cyan('Mocks:')} ✔` : ''}`,
  )
}

async function startWatchMode(specPath: string, config: GenerateConfig): Promise<void> {
  // Dynamic import to avoid loading chokidar when not in watch mode
  const { watch } = await import('chokidar')

  logger.info(`\n${pc.yellow('👀 Watching')} ${pc.bold(specPath)} for changes...\n`)

  const watcher = watch(specPath, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  })

  watcher.on('change', async () => {
    logger.info(`\n${pc.yellow('↻')} Spec changed, regenerating...`)
    try {
      await runGenerate(config)
    } catch (err) {
      logger.error(err instanceof Error ? err.message : String(err))
    }
  })

  // Keep the process alive
  process.on('SIGINT', () => {
    logger.info('\nStopping watch mode...')
    watcher.close()
    process.exit(0)
  })
}

program.parse()
