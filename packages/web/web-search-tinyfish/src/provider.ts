/**
 * `TinyFishSearchProvider`: a `WebSearchProvider` backed by TinyFish's search
 * REST API (`GET /?query=…` with an `X-API-Key` header). It maps each result's
 * `snippet` to `snippet` and `date` to `publishedAt`, and omits `content`
 * because TinyFish returns no generated answer.
 *
 * The key is resolved per search rather than captured at registration: it lives
 * in the credentials store, which the settings surface writes without reloading
 * this plugin.
 *
 * @module @deepseek-ai/dsh-web-search-tinyfish/provider
 */

import type { CredentialRef } from '@deepseek-ai/dsh-credentials'
import { WebError } from '@deepseek-ai/dsh-web'
import type {
  WebSearchProvider,
  WebSearchRequest,
  WebSearchResult,
  WebSearchSource,
} from '@deepseek-ai/dsh-web'
import type { TinyFishError, TinyFishResult, TinyFishSearchResponse } from './types.ts'

/** Stable id this provider registers under. */
export const TINYFISH_PROVIDER_ID = 'tinyfish'

/** Default TinyFish search endpoint; the search operation is the root path. */
export const TINYFISH_DEFAULT_BASE_URL = 'https://api.search.tinyfish.ai'

/** Attribution header sent on every request. */
const USER_AGENT = 'deepseek-harness/0.0.1'

/** Resolved provider options (the plugin's `apply` supplies credential and constant defaults). */
export interface TinyFishSearchProviderOptions {
  /** Literal TinyFish API key; when present it wins over {@link resolveApiKey}. */
  apiKey?: string
  /** Resolve the current TinyFish API key for one search operation. */
  resolveApiKey?: () => Promise<string | undefined>
  /** Credential reference named by missing-credential diagnostics. */
  apiKeyEnv?: CredentialRef
  /** Endpoint base; the search operation is its root path. */
  baseURL: string
}

/**
 * Map one TinyFish result to a normalized source, or `undefined` when it
 * carries no URL (the one field the seam cannot invent).
 *
 * @param result - one entry of TinyFish's `results[]`.
 * @returns the normalized source, or `undefined` when the entry has no URL.
 */
export function mapTinyFishResult(result: TinyFishResult): WebSearchSource | undefined {
  if (typeof result.url !== 'string' || result.url.length === 0) return undefined
  const title = nonBlank(result.title)
  const snippet = nonBlank(result.snippet)
  const publishedAt = nonBlank(result.date)
  return {
    url: result.url,
    ...title === undefined ? {} : { title },
    ...snippet === undefined ? {} : { snippet },
    ...publishedAt === undefined ? {} : { publishedAt },
  }
}

/**
 * Map a TinyFish response envelope to a normalized search result.
 *
 * @param response - the parsed search response body.
 * @returns the normalized result; URL-less entries are dropped.
 */
export function mapTinyFishResponse(response: TinyFishSearchResponse): WebSearchResult {
  const sources = (response.results ?? [])
    .map(mapTinyFishResult)
    .filter((source): source is WebSearchSource => source !== undefined)
  // TinyFish returns no generated answer, so `content` is omitted. The web
  // service owns the final `maxResults` truncation, so `truncated` is false.
  return { sources, truncated: false }
}

/** The TinyFish-backed search provider; HTTP redirects fail as `WEB_PROVIDER_ERROR`. */
export class TinyFishSearchProvider implements WebSearchProvider {
  readonly id = TINYFISH_PROVIDER_ID

  /**
   * @param resolveOptions - reads the currently authoritative section, so a
   *   settings change takes effect on the next search without re-registration.
   */
  constructor(private readonly resolveOptions: () => TinyFishSearchProviderOptions) {}

  available(): boolean {
    const options = this.resolveOptions()
    return ((options.apiKey?.length ?? 0) > 0 || options.resolveApiKey !== undefined)
      && URL.canParse(options.baseURL)
  }

  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    // One snapshot for the whole operation: credential resolution awaits, and a
    // settings write landing inside that await must not send the key resolved
    // from the old section to the endpoint named by the new one.
    const options = this.resolveOptions()
    const apiKey = await this.apiKey(options, signal)
    const endpoint = new URL(options.baseURL)
    endpoint.searchParams.set('query', request.query)

    let response: Response
    try {
      response = await fetch(endpoint, {
        method: 'GET',
        redirect: 'error',
        headers: {
          'x-api-key': apiKey,
          'accept': 'application/json',
          'user-agent': USER_AGENT,
        },
        ...signal !== undefined ? { signal } : {},
      })
    } catch (error: unknown) {
      if (isAbortError(error)) throw aborted(error)
      throw new WebError(`TinyFish search request failed: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error })
    }

    if (!response.ok) throw await httpError(response)

    try {
      return mapTinyFishResponse(await response.json() as TinyFishSearchResponse)
    } catch (error: unknown) {
      if (isAbortError(error)) throw aborted(error)
      throw new WebError(
        `TinyFish returned an unprocessable response body: ${String(error)}`,
        'WEB_PROVIDER_ERROR',
        { cause: error },
      )
    }
  }

  /**
   * Resolve one operation's credential without retaining it on the provider.
   * @param options - the caller's snapshot, so the key and the endpoint it is
   *   sent to come from one section.
   * @param signal - abort signal for the surrounding search.
   * @returns the resolved key.
   */
  private async apiKey(options: TinyFishSearchProviderOptions, signal?: AbortSignal): Promise<string> {
    if (isAborted(signal)) throw aborted(signal?.reason)
    if (options.apiKey !== undefined && options.apiKey.length > 0) return options.apiKey
    let resolved: string | undefined
    try {
      resolved = await options.resolveApiKey?.()
    } catch (error: unknown) {
      if (isAborted(signal) || isAbortError(error)) throw aborted(error)
      throw new WebError(
        `TinyFish search credential resolution failed: ${String(error)}`,
        'WEB_PROVIDER_ERROR',
        { cause: error },
      )
    }
    if (resolved !== undefined && resolved.length > 0) return resolved
    throw new WebError(
      `TinyFish search has no API key for "${options.apiKeyEnv ?? 'TINYFISH_API_KEY'}"; paste one in`
      + ' Settings > Plugins > Plugin configuration > TinyFish web search (create it at'
      + ' https://agent.tinyfish.ai/api-keys), or export it in the launching environment',
      'WEB_PROVIDER_CREDENTIAL_MISSING',
    )
  }
}

/**
 * Read a non-2xx response into the richest `WebError` its body allows.
 * @param response - the failed response, whose body is read once.
 * @returns the error to throw.
 */
async function httpError(response: Response): Promise<WebError> {
  let message = `TinyFish API error (HTTP ${response.status})`
  try {
    const parsed = await response.json() as TinyFishError
    const detail = parsed.error?.message ?? parsed.error?.code
    if (detail !== undefined && detail.length > 0) message = detail
  } catch (error: unknown) {
    // An abort fired mid-body must surface as WEB_ABORTED, not be swallowed
    // into a generic HTTP-error message — cancellation is not a provider error.
    if (isAbortError(error)) return aborted(error)
    // Otherwise the status is already in `message`; a malformed error body
    // (normal for gateway 5xx/429s) can only cost a richer message.
  }
  // 401/402/403 are the key's problem, not the query's: say where the key lives.
  if (response.status === 401 || response.status === 402 || response.status === 403) {
    return new WebError(
      `${message} — check the TinyFish API key in Settings > Plugins > Plugin configuration`
      + ' > TinyFish web search (https://agent.tinyfish.ai/api-keys)',
      'WEB_PROVIDER_CREDENTIAL_MISSING',
    )
  }
  return new WebError(message, 'WEB_PROVIDER_ERROR')
}

/**
 * The seam's cancellation outcome.
 * @param cause - what reported the abort.
 * @returns the `WEB_ABORTED` error.
 */
function aborted(cause: unknown): WebError {
  return new WebError('TinyFish search aborted', 'WEB_ABORTED', { cause })
}

/**
 * Whether the caller already cancelled. Read through a call rather than inline
 * so a check before an `await` does not narrow the reads after it.
 * @param signal - the search's abort signal, when one was passed.
 * @returns whether it is aborted.
 */
function isAborted(signal?: AbortSignal): boolean {
  return signal?.aborted === true
}

/**
 * True for a fetch/`AbortSignal` abort, surfaced as `WEB_ABORTED`.
 * @param error - the caught value.
 * @returns whether it is an abort.
 */
function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

/**
 * A string field that carries something other than whitespace.
 * @param value - the provider-supplied field.
 * @returns the value, or `undefined` when it is absent or blank.
 */
function nonBlank(value: string | null | undefined): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}
