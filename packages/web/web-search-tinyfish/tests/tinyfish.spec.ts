import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import WebRuntime from '@deepseek-ai/dsh-web'
import * as tinyfishPlugin from '@deepseek-ai/dsh-web-search-tinyfish'
import { TINYFISH_PROVIDER_ID, TinyFishSearchProvider } from '@deepseek-ai/dsh-web-search-tinyfish'
import { mapTinyFishResponse, mapTinyFishResult } from '../src/provider.ts'
import type { TinyFishSearchProviderOptions } from '../src/provider.ts'

const options: TinyFishSearchProviderOptions = { apiKey: 'tf-key', baseURL: 'https://search.tinyfish.test' }

/** A provider over a fixed options snapshot. */
function provider(overrides: Partial<TinyFishSearchProviderOptions> = {}): TinyFishSearchProvider {
  return new TinyFishSearchProvider(() => ({ ...options, ...overrides }))
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('TinyFish result mapping', () => {
  it('maps a full result entry', () => {
    expect(mapTinyFishResult({ url: 'https://a.test', title: 'A', snippet: 'salient', date: '2026-01-01' }))
      .toEqual({ url: 'https://a.test', title: 'A', snippet: 'salient', publishedAt: '2026-01-01' })
  })

  it('omits null and blank optional fields rather than emitting them', () => {
    expect(mapTinyFishResult({ url: 'https://a.test', title: null, snippet: '  ', date: '' }))
      .toEqual({ url: 'https://a.test' })
  })

  it('drops an entry with no URL', () => {
    expect(mapTinyFishResult({ url: '' })).toBeUndefined()
    expect(mapTinyFishResult({} as { url: string })).toBeUndefined()
  })

  it('maps a response to a result with no content and filtered sources', () => {
    const result = mapTinyFishResponse({
      results: [
        { url: 'https://a.test', snippet: 'one' },
        { url: '' },
        { url: 'https://c.test', title: 'C' },
      ],
    })
    expect(result).toEqual({
      sources: [{ url: 'https://a.test', snippet: 'one' }, { url: 'https://c.test', title: 'C' }],
      truncated: false,
    })
    expect(result.content).toBeUndefined()
  })

  it('tolerates a missing results array', () => {
    expect(mapTinyFishResponse({}).sources).toEqual([])
  })
})

describe('TinyFishSearchProvider availability', () => {
  it('is unavailable without any key source', () => {
    expect(new TinyFishSearchProvider(() => ({ baseURL: options.baseURL })).available()).toBe(false)
  })

  it('is available with a literal key', () => {
    expect(provider().available()).toBe(true)
  })

  it('is available with a credential resolver', () => {
    expect(new TinyFishSearchProvider(() => ({
      baseURL: options.baseURL,
      resolveApiKey: () => Promise.resolve('tf-key'),
    })).available()).toBe(true)
  })

  it('is misconfigured when the base URL is unparseable', () => {
    expect(provider({ baseURL: 'not a url' }).available()).toBe(false)
  })
})

describe('TinyFishSearchProvider request mapping', () => {
  it('sends the query as a parameter with X-API-Key auth', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ results: [{ url: 'https://a.test', snippet: 'hi' }] }))
    vi.stubGlobal('fetch', fetchMock)

    await provider().search({ query: 'hello world', maxResults: 5 })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit]
    expect(url.toString()).toBe('https://search.tinyfish.test/?query=hello+world')
    expect(init).toMatchObject({ method: 'GET', redirect: 'error' })
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('tf-key')
  })

  it('resolves the key per search when no literal is configured', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ results: [] }))
    vi.stubGlobal('fetch', fetchMock)
    const keys = ['first', 'second']
    const resolving = new TinyFishSearchProvider(() => ({
      baseURL: options.baseURL,
      resolveApiKey: () => Promise.resolve(keys.shift()),
    }))
    await resolving.search({ query: 'a' })
    await resolving.search({ query: 'b' })
    const headers = fetchMock.mock.calls
      .map(call => ((call as unknown as [URL, RequestInit])[1]).headers as Record<string, string>)
    expect(headers.map(header => header['x-api-key'])).toEqual(['first', 'second'])
  })

  it('forwards the abort signal', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ results: [] }))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    await provider().search({ query: 'q' }, controller.signal)
    const [, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit]
    expect(init.signal).toBe(controller.signal)
  })
})

describe('TinyFishSearchProvider error handling', () => {
  it('reports a missing key as WEB_PROVIDER_CREDENTIAL_MISSING without calling out', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ results: [] }))
    vi.stubGlobal('fetch', fetchMock)
    const keyless = new TinyFishSearchProvider(() => ({
      baseURL: options.baseURL,
      resolveApiKey: () => Promise.resolve(undefined),
    }))
    await expect(keyless.search({ query: 'q' }))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_PROVIDER_CREDENTIAL_MISSING' }))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps an auth failure to WEB_PROVIDER_CREDENTIAL_MISSING with the provider message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(
      { error: { code: 'INVALID_API_KEY', message: 'invalid key' } }, { status: 401 })))
    await expect(provider().search({ query: 'q' }))
      .rejects.toThrow(expect.objectContaining({
        code: 'WEB_PROVIDER_CREDENTIAL_MISSING',
        message: expect.stringContaining('invalid key') as unknown as string,
      }))
  })

  it('keeps a status-line message when the error body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('gateway down', { status: 502 })))
    await expect(provider().search({ query: 'q' }))
      .rejects.toThrow(expect.objectContaining({
        code: 'WEB_PROVIDER_ERROR',
        message: 'TinyFish API error (HTTP 502)',
      }))
  })

  it('maps a network failure to WEB_PROVIDER_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('connection refused'))))
    await expect(provider().search({ query: 'q' }))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_PROVIDER_ERROR' }))
  })

  it('maps an abort to WEB_ABORTED', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new DOMException('aborted', 'AbortError'))))
    await expect(provider().search({ query: 'q' }))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_ABORTED' }))
  })

  it('refuses a search whose signal already aborted', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ results: [] }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(provider().search({ query: 'q' }, AbortSignal.abort()))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_ABORTED' }))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps an unparseable success body to WEB_PROVIDER_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not json', { status: 200 })))
    await expect(provider().search({ query: 'q' }))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_PROVIDER_ERROR' }))
  })

  it('surfaces an abort during error-body parse as WEB_ABORTED', async () => {
    const body = { json: () => Promise.reject(new DOMException('aborted', 'AbortError')), ok: false, status: 500 }
    vi.stubGlobal('fetch', vi.fn(async () => body as unknown as Response))
    await expect(provider().search({ query: 'q' }))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_ABORTED' }))
  })
})

describe('web-search-tinyfish plugin registration', () => {
  it('registers the provider into ctx.web (HMR-safe)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ results: [] })))
    const ctx = new Context()
    await ctx.plugin(WebRuntime, { searchProvider: TINYFISH_PROVIDER_ID })
    const fiber = await ctx.plugin(tinyfishPlugin, { apiKey: 'tf-key' })
    await expect(ctx.web.search({ query: 'q' })).resolves.toMatchObject({ sources: [], truncated: false })
    await fiber.dispose()
    await expect(ctx.web.search({ query: 'q' }))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_PROVIDER_CONFIGURED_MISSING' }))
  })

  it('has no default export (namespace plugin export shape)', () => {
    expect('default' in tinyfishPlugin).toBe(false)
  })

  it('falls back to $TINYFISH_API_KEY and the default endpoint when config omits them', async () => {
    const previous = process.env.TINYFISH_API_KEY
    process.env.TINYFISH_API_KEY = 'env-key'
    try {
      const fetchMock = vi.fn(async () => jsonResponse({ results: [] }))
      vi.stubGlobal('fetch', fetchMock)
      const ctx = new Context()
      await ctx.plugin(WebRuntime, { searchProvider: TINYFISH_PROVIDER_ID })
      const fiber = await ctx.plugin(tinyfishPlugin, {})
      await ctx.web.search({ query: 'q' })
      const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit]
      expect(url.origin).toBe('https://api.search.tinyfish.ai')
      expect((init.headers as Record<string, string>)['x-api-key']).toBe('env-key')
      await fiber.dispose()
    } finally {
      if (previous === undefined) delete process.env.TINYFISH_API_KEY
      else process.env.TINYFISH_API_KEY = previous
    }
  })

  it('fails with a key-shaped error when neither config nor env supplies one', async () => {
    const previous = process.env.TINYFISH_API_KEY
    delete process.env.TINYFISH_API_KEY
    try {
      const ctx = new Context()
      await ctx.plugin(WebRuntime, { searchProvider: TINYFISH_PROVIDER_ID })
      await ctx.plugin(tinyfishPlugin, {})
      await expect(ctx.web.search({ query: 'q' }))
        .rejects.toThrow(expect.objectContaining({ code: 'WEB_PROVIDER_CREDENTIAL_MISSING' }))
    } finally {
      if (previous !== undefined) process.env.TINYFISH_API_KEY = previous
    }
  })
})
