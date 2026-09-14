/**
 * Wire types for the TinyFish search API (`GET https://api.search.tinyfish.ai/`).
 * Types only — no runtime code. TinyFish returns a flat `results[]`; each entry
 * carries a URL, a title, a snippet, and — for news and some web results — a
 * `date`.
 *
 * @module @deepseek-ai/dsh-web-search-tinyfish/types
 */

/** One entry of TinyFish's flat `results[]`. */
export interface TinyFishResult {
  url: string
  title?: string | null
  snippet?: string | null
  /** Publication date, present for news and some web results. */
  date?: string | null
}

/** TinyFish's search response envelope. */
export interface TinyFishSearchResponse {
  query?: string
  results?: TinyFishResult[]
}

/** TinyFish's error envelope (`{ error: { code, message } }`). */
export interface TinyFishError {
  error?: {
    code?: string
    message?: string
  }
}
