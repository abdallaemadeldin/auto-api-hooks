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
  .option('--dry-run', 'Preview files that would be generated without writing to disk', false)
  .option('--clean', 'Remove stale files from output directory that are no longer generated', false)
  .option('--prettier', 'Format generated files with Prettier (uses your project config)', false)
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
      dryRun,
      clean,
      prettier,
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
        dryRun: !!dryRun,
        clean: !!clean,
        prettier: !!prettier,
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
          dryRun: !!dryRun,
          clean: !!clean,
          prettier: !!prettier,
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
  dryRun: boolean
  clean: boolean
  prettier: boolean
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

  // 4. Collect all files
  const allFiles = [...hookFiles, ...mockFiles]

  // Dry run mode: show what would be generated without writing
  if (config.dryRun) {
    const duration = Date.now() - startTime
    logger.success(
      `Dry run: ${pc.bold(String(allFiles.length))} files would be generated in ${pc.bold(config.outputDir)} (${duration}ms)`,
    )
    for (const file of allFiles) {
      logger.info(`  ${pc.gray('→')} ${file.path}`)
    }
    return
  }

  // 5. Clean stale files (if enabled)
  if (config.clean) {
    await cleanStaleFiles(config.outputDir, allFiles)
  }

  // 6. Write all files
  await writeFiles(config.outputDir, allFiles)

  // 7. Format with Prettier (if enabled)
  if (config.prettier) {
    await formatWithPrettier(config.outputDir, allFiles)
  }

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

/**
 * Format generated files with Prettier using the project's config.
 * Requires `prettier` to be installed in the user's project.
 */
async function formatWithPrettier(
  outputDir: string,
  files: { path: string }[],
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prettier: any
  try {
    // Dynamic import — prettier is an optional peer dependency
    const mod = 'prettier'
    prettier = await import(/* webpackIgnore: true */ mod)
  } catch {
    logger.warn(
      'Prettier not found in your project. Install it with: npm install -D prettier',
    )
    return
  }

  const { join } = await import('node:path')
  const { readFile, writeFile } = await import('node:fs/promises')

  let formatted = 0
  for (const file of files) {
    const fullPath = join(outputDir, file.path)
    try {
      const content = await readFile(fullPath, 'utf-8')
      const config = await prettier.resolveConfig(fullPath)
      const result = await prettier.format(content, {
        ...config,
        filepath: fullPath,
      })
      if (result !== content) {
        await writeFile(fullPath, result, 'utf-8')
        formatted++
      }
    } catch {
      // Skip files that fail to format
      logger.verbose(`Failed to format: ${file.path}`)
    }
  }

  if (formatted > 0) {
    logger.info(`Formatted ${pc.bold(String(formatted))} files with Prettier`)
  }
}

/**
 * Remove files from the output directory that are no longer generated.
 * Only removes `.ts` files that have the auto-generated header.
 */
async function cleanStaleFiles(
  outputDir: string,
  freshFiles: { path: string }[],
): Promise<void> {
  const { readdir, readFile, unlink } = await import('node:fs/promises')
  const { join, relative } = await import('node:path')

  const freshSet = new Set(freshFiles.map((f) => f.path))
  let removedCount = 0

  async function walk(dir: string): Promise<void> {
    let entries: import('node:fs').Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return // Directory doesn't exist yet
    }

    for (const entry of entries) {
      const name = String(entry.name)
      const fullPath = join(dir, name)
      if (entry.isDirectory()) {
        await walk(fullPath)
      } else if (name.endsWith('.ts')) {
        const relPath = relative(outputDir, fullPath)
        if (!freshSet.has(relPath)) {
          // Only remove files that were generated by us
          try {
            const content = await readFile(fullPath, 'utf-8')
            if (content.startsWith('// Auto-generated by auto-api-hooks')) {
              await unlink(fullPath)
              logger.verbose(`Removed stale file: ${relPath}`)
              removedCount++
            }
          } catch {
            // Ignore read errors
          }
        }
      }
    }
  }

  await walk(outputDir)
  if (removedCount > 0) {
    logger.info(`Cleaned ${pc.bold(String(removedCount))} stale file${removedCount === 1 ? '' : 's'}`)
  }
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
