/**
 * Host-side storage for the custom background image. The picked wallpaper is a
 * bulk blob, so it lives in its own file under the dsh home and the settings
 * document keeps only the route that serves it — the shared settings document
 * stays small enough to read and write on every change.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export { BACKGROUND_ROUTE } from './theme-settings.ts'

/**
 * Ceiling for an accepted upload. The browser re-encodes every pick to a
 * bounded JPEG well under this, so anything larger is not a picture this
 * feature produced.
 */
export const MAX_BACKGROUND_BYTES = 8 * 1024 * 1024

/** The browser always re-encodes to JPEG, so one path and one type suffice. */
const BACKGROUND_FILE = 'theme-background.jpg'

/** Content type stored and served for the wallpaper. */
export const BACKGROUND_CONTENT_TYPE = 'image/jpeg'

/**
 * Absolute path of the stored wallpaper.
 * @param home - resolved dsh home directory.
 * @returns the wallpaper file path inside it.
 */
export function backgroundFilePath(home: string): string {
  return join(home, BACKGROUND_FILE)
}

/**
 * Persist the wallpaper bytes, creating the home directory when absent.
 * @param home - resolved dsh home directory.
 * @param bytes - the JPEG payload to store.
 */
export async function writeBackgroundFile(home: string, bytes: Buffer): Promise<void> {
  const path = backgroundFilePath(home)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, bytes)
}

/**
 * Read the stored wallpaper.
 * @param home - resolved dsh home directory.
 * @returns the stored bytes, or undefined when nothing has been stored.
 */
export async function readBackgroundFile(home: string): Promise<Buffer | undefined> {
  try {
    return await readFile(backgroundFilePath(home))
  } catch {
    // An absent (or unreadable) wallpaper is simply "no custom background".
    return undefined
  }
}
