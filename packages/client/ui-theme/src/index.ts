/** Host registration for the browser theme preference and pre-plugin palette. */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-settings'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { bootThemeInjection } from './boot-theme.ts'
import {
  BACKGROUND_CONTENT_TYPE, BACKGROUND_ROUTE, MAX_BACKGROUND_BYTES,
  readBackgroundFile, writeBackgroundFile,
} from './background-file.ts'
import {
  DEFAULT_FONT_SIZE, DEFAULT_PREFERENCE, THEME_SETTINGS_NAMESPACE, ThemeSettingsSchema,
  type ThemePreference, type ThemeSettings,
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
      const home = resolveDshHome()
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

const THEME_NAMESPACE = THEME_SETTINGS_NAMESPACE

/** Read the registered theme section or the schema defaults without a settings provider. */
function readSection(ctx: Context): { preference: ThemePreference; fontSize: number } {
  const fallback = { preference: DEFAULT_PREFERENCE, fontSize: DEFAULT_FONT_SIZE }
  const settings = ctx.get('settings')
  if (settings === undefined) return fallback
  const section = settings.get(THEME_NAMESPACE) as ThemeSettings | undefined
  if (section === undefined) return fallback
  return section
}

/**
 * Register the durable theme section when the optional settings service is
 * composed, and answer every index injection collection with the current
 * theme bootstrap row.
 * @param ctx - Host context that may acquire the settings service.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(THEME_NAMESPACE, ThemeSettingsSchema)
  })
  // Scoped like the settings registration: a composition without a webserver
  // (or its connection guard) still loads the theme, just without the routes.
  ctx.inject(['webServer', 'connection'], (webCtx) => { installBackgroundRoutes(webCtx) })
  ctx.on('webserver/index-inject', (table) => {
    const section = readSection(ctx)
    table.push(bootThemeInjection(section.preference, section.fontSize))
  })
}
