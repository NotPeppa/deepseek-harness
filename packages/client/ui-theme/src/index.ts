/** Host registration for the browser theme preference and pre-plugin palette. */
import type {} from '@deepseek-ai/dsh-settings'

import type { Volatile } from '@deepseek-ai/cordis'
import type { ThemePreference } from './theme-settings.ts'
import z from '@deepseek-ai/schemastery'

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-app-boot'
import { BACKGROUND_CONTENT_TYPE, BACKGROUND_ROUTE, MAX_BACKGROUND_BYTES, readBackgroundFile, writeBackgroundFile } from './background-file.ts'
import { BACKGROUND_BLUR_MIN, BACKGROUND_BLUR_MAX, DEFAULT_BACKGROUND_BLUR, DEFAULT_BACKGROUND_IMAGE, DEFAULT_BACKGROUND_OPACITY, BACKGROUND_OPACITY_MIN, BACKGROUND_OPACITY_MAX } from './theme-settings.ts'
import { bootThemeInjections } from './boot-theme.ts'
import {
  DEFAULT_FONT_SIZE, DEFAULT_PREFERENCE, FONT_SIZE_MIN, FONT_SIZE_MAX, THEME_PREFERENCES,
} from './theme-settings.ts'

export {
  DEFAULT_FONT_SIZE, DEFAULT_PREFERENCE, FONT_SIZE_FIELD, FONT_SIZE_MAX, FONT_SIZE_MIN,
  THEME_PREFERENCE_FIELD, THEME_PREFERENCES, THEME_SETTINGS_NAMESPACE,
  type ThemePreference, type ThemeSettings,
} from './theme-settings.ts'
export { BACKGROUND_ROUTE, MAX_BACKGROUND_BYTES } from './background-file.ts'

/** Trust surface consumed here; the browser-side connection package owns the full type. */
interface ThemeConnection {
  requestRejection(request: { readonly headers: IncomingMessage['headers'] }): 401 | 403 | undefined
}

/** The composition's connection service (typed locally: its package is browser-side). */
function connectionOf(ctx: Context): ThemeConnection {
  return Reflect.get(ctx, 'connection') as ThemeConnection
}

/** Collect a bounded request body; undefined past the ceiling (stream drained). */
async function readBoundedBody(req: IncomingMessage): Promise<Buffer | undefined> {
  const chunks: Buffer[] = []
  let total = 0
  let overflowed = false
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    total += buffer.length
    if (total > MAX_BACKGROUND_BYTES) {
      // Keep draining so the client sees the status rather than a reset socket.
      overflowed = true
      continue
    }
    chunks.push(buffer)
  }
  return overflowed ? undefined : Buffer.concat(chunks)
}

/**
 * Register the wallpaper routes: GET serves the stored image, POST replaces it.
 * Both ride the same request-rejection guard as every other browser-facing
 * route, so a non-loopback or unauthenticated page cannot read or overwrite it.
 * @param ctx - Host context owning the webserver service.
 */
function installBackgroundRoutes(ctx: Context): void {
  const rejected = (req: IncomingMessage, res: ServerResponse): boolean => {
    const rejection = connectionOf(ctx).requestRejection(req)
    if (rejection === undefined) return false
    res.statusCode = rejection
    res.end()
    return true
  }
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: BACKGROUND_ROUTE,
    handler: async (req, res) => {
      if (rejected(req, res)) return
      const home = ctx.profileContext.home
      if (req.method === 'GET') {
        const bytes = await readBackgroundFile(home)
        if (bytes === undefined) {
          res.statusCode = 404
          res.end()
          return
        }
        res.statusCode = 200
        res.setHeader('content-type', BACKGROUND_CONTENT_TYPE)
        // The settings value carries a version query, so each stored image is
        // addressed by its own URL and may be cached hard.
        res.setHeader('cache-control', 'public, max-age=31536000, immutable')
        res.end(bytes)
        return
      }
      if (req.method === 'POST') {
        const bytes = await readBoundedBody(req)
        if (bytes === undefined) {
          res.statusCode = 413
          res.end()
          return
        }
        await writeBackgroundFile(home, bytes)
        res.statusCode = 204
        res.end()
        return
      }
      res.statusCode = 405
      res.setHeader('allow', 'GET, POST')
      res.end()
    },
  }), `ui-theme: ${BACKGROUND_ROUTE}`)
}

/** Runtime preferences projected to the browser. */
export interface Config {
  /** Browser palette preference. */
  preference: Volatile<ThemePreference>
  /** Browser font size in pixels. */
  fontSize: Volatile<number>
  /** Wallpaper URL; empty disables it. */
  backgroundImage: Volatile<string>
  /** Wallpaper blur in pixels. */
  backgroundBlur: Volatile<number>
  /** Wallpaper opacity percentage. */
  backgroundOpacity: Volatile<number>
}

/** Live theme and typography preferences. */
export const Config = z.object({
  backgroundImage: z.string().default(DEFAULT_BACKGROUND_IMAGE).volatile(),
  backgroundBlur: z.number().step(1).min(BACKGROUND_BLUR_MIN).max(BACKGROUND_BLUR_MAX).default(DEFAULT_BACKGROUND_BLUR).volatile(),
  backgroundOpacity: z.number().step(1).min(BACKGROUND_OPACITY_MIN).max(BACKGROUND_OPACITY_MAX)
    .default(DEFAULT_BACKGROUND_OPACITY).volatile(),
  preference: z.union([...THEME_PREFERENCES]).default(DEFAULT_PREFERENCE).volatile(),
  fontSize: z.number().step(1).min(FONT_SIZE_MIN).max(FONT_SIZE_MAX).default(DEFAULT_FONT_SIZE).volatile(),
})

/** Supply the current palette before browser plugins start.
 * @param ctx Host plugin context.
 * @param config Validated live theme preferences.
 */
export function apply(ctx: Context, config: Config): void {
  ctx.inject(['webServer', 'connection', 'profileContext'], (webCtx) => { installBackgroundRoutes(webCtx) })
  ctx.inject(['settings'], (child) => { child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)) })
  ctx.on('webserver/index-inject', (table) => {
    table.push(...bootThemeInjections(config.preference.get(), config.fontSize.get()))
  }, { prepend: true })
}
