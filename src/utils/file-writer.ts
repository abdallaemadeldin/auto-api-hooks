/**
 * Write generated files to disk.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { FileWriteError } from './errors'
import { logger } from './logger'

export interface GeneratedFile {
  /** Relative path from output directory. */
  path: string
  /** Generated source code. */
  content: string
}

/**
 * Write an array of generated files to the output directory.
 */
export async function writeFiles(
  outputDir: string,
  files: GeneratedFile[],
): Promise<void> {
  for (const file of files) {
    const fullPath = join(outputDir, file.path)
    const dir = dirname(fullPath)

    try {
      await mkdir(dir, { recursive: true })
      await writeFile(fullPath, file.content, 'utf-8')
      logger.verbose(`Wrote ${file.path}`)
    } catch (err) {
      throw new FileWriteError(
        `Failed to write ${fullPath}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }
}
