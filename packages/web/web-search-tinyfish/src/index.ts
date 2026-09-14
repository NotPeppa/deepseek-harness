/**
 * Register a TinyFish-backed provider in `ctx.web`. It calls TinyFish's search
 * REST API, whose key is an `X-API-Key` header resolved per search from the
 * credentials store — so pasting a key in Settings takes effect without a
 * restart.
 *
 * @module @deepseek-ai/dsh-web-search-tinyfish
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-settings'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import type {} from '@deepseek-ai/dsh-web'
import { TinyFishSearchProvider, TINYFISH_DEFAULT_BASE_URL } from './provider.ts'
import type { TinyFishSearchProviderOptions } from './provider.ts'

export {
  TINYFISH_DEFAULT_BASE_URL,
  TINYFISH_PROVIDER_ID,
  TinyFishSearchProvider,
  mapTinyFishResponse,
  mapTinyFishResult,
} from './provider.ts'
export type { TinyFishSearchProviderOptions } from './provider.ts'
export type { TinyFishError, TinyFishResult, TinyFishSearchResponse } from './types.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'web-search-tinyfish'

/** The web seam this provider registers into. */
export const inject = ['web']

/** Credential reference this provider resolves when the section names none. */
const DEFAULT_API_KEY_ENV = 'TINYFISH_API_KEY'

/** Settings namespace carrying this provider's endpoint and key reference. */
export const WEB_SEARCH_TINYFISH_SETTINGS_NAMESPACE = 'web-search-tinyfish'

/** Plugin config (all optional — `apply` fills credential and constant defaults). */
export interface Config {
  /** Literal TinyFish API key; prefer {@link apiKeyEnv} so no secret enters configuration files. */
  apiKey?: string
  /** Credential reference resolved for each search; defaults to `TINYFISH_API_KEY`. */
  apiKeyEnv?: string
  /** Endpoint base; the search operation is its root path. */
  baseURL?: string
}

export const Config: z<Config> = z.object({
  apiKey: z.string().role('secret'),
  apiKeyEnv: z.string().role('credential-ref').default(DEFAULT_API_KEY_ENV),
  // Declared with its default here rather than only at the use site: a
  // configuration surface renders the resolved section, so a default the schema
  // does not carry reads there as no value at all.
  baseURL: z.string().default(TINYFISH_DEFAULT_BASE_URL),
})

/**
 * Project one resolved section into the options the provider serves its next
 * search with. Environment fallbacks stay here rather than in the provider:
 * every value it reads is already fully defaulted.
 * @param ctx - plugin context supplying the credential and environment planes.
 * @param config - the currently authoritative section.
 * @returns options for one search.
 */
function resolveOptions(ctx: Context, config: Config): TinyFishSearchProviderOptions {
  const apiKeyEnv = credentialRef(config.apiKeyEnv ?? DEFAULT_API_KEY_ENV)
  const literalApiKey = config.apiKey !== undefined && config.apiKey.length > 0
    ? config.apiKey
    : undefined
  return {
    ...literalApiKey === undefined ? {} : { apiKey: literalApiKey },
    resolveApiKey: async () => {
      const credentials = ctx.get('credentials')
      if (credentials !== undefined) return (await credentials.resolve(apiKeyEnv))?.value
      // Without the seam the environment is the whole credential plane.
      const ambient = launchEnvironmentOf(ctx).get(apiKeyEnv)
      return ambient !== undefined && ambient.value.length > 0 ? ambient.value : undefined
    },
    apiKeyEnv,
    baseURL: config.baseURL ?? TINYFISH_DEFAULT_BASE_URL,
  }
}

/**
 * Register the TinyFish search provider with `ctx.web`.
 * @param ctx - the plugin context.
 * @param config - the composition entry, which the settings section layers over.
 */
export function apply(ctx: Context, config: Config): void {
  let current: () => Config = () => config
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.installSection(ctx, WEB_SEARCH_TINYFISH_SETTINGS_NAMESPACE, Config, config, {
      setSource: (source) => {
        current = source
      },
      // The registration carries no resolved value: the provider projects the
      // section per search, so a committed change needs no re-registration.
      onChange: () => {},
    })
  })
  ctx.web.registerSearchProvider(new TinyFishSearchProvider(() => resolveOptions(ctx, current())))
}
