---
description: "The TinyFish-backed search provider for ctx.web: how a deployment turns on TinyFish web search with one API key pasted in Settings."
kind: "package-reference"
---

# @deepseek-ai/dsh-web-search-tinyfish

English | [中文](README.zh.md)

## Summary

With `dsh-web-search-tinyfish`, the harness searches the web through [TinyFish](https://agent.tinyfish.ai), whose search API is free on every TinyFish account. Choose it when a deployment wants web search that costs nothing beyond an API key, or when the user prefers TinyFish's ranking to the shipped provider. TinyFish returns no generated answer, so results carry no `content` — only citeable sources. The key is resolved from the credentials store at each search, so pasting one in Settings takes effect without a restart. The model-facing `web_search` tool lives in `dsh-tool-web`.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount the provider in a composition that already loads the web service; it registers as the `tinyfish` search provider. The shipped `dsh-base` bundle already mounts it, so on those deployments the whole setup is: open **Settings › Plugins › Plugin configuration › TinyFish web search**, paste a key from [agent.tinyfish.ai/api-keys](https://agent.tinyfish.ai/api-keys), turn on **Use TinyFish for web search**, and save. The switch writes `searchProvider: tinyfish` into the `web` section; turning it off clears that field, and search returns to the provider the deployment composed.

### When to choose it

Choose this backend when a deployment holds a TinyFish API key and wants free web search with per-result snippets and, for news results, publication dates. The provider is unavailable — and every search call fails with a structured error — when no key source is configured or the endpoint base does not parse.

### Minimal configuration

Load the web service and the provider, and point the seam at it. The key is a credential reference resolved per search, so no secret enters the composition.

```yaml
- name: '@deepseek-ai/dsh-web'
  config:
    searchProvider: tinyfish
- name: '@deepseek-ai/dsh-web-search-tinyfish'
  config:
    apiKeyEnv: TINYFISH_API_KEY
```

| Field | Default | Meaning |
|---|---|---|
| `apiKeyEnv` | `TINYFISH_API_KEY` | Credential reference resolved at each search through `ctx.credentials`, or the launch environment when no credentials service is mounted |
| `apiKey` | (unset) | Literal key; it wins over `apiKeyEnv`. Prefer the reference so no secret enters a configuration file |
| `baseURL` | `https://api.search.tinyfish.ai` | Endpoint base; the search operation is its root path. An unparseable value makes the provider unavailable |

The generated [configuration catalog](../../../docs/config-catalog.md#deepseek-aidsh-web-search-tinyfish) is the exhaustive source for every accepted field and its JSDoc.

### What a search returns

Each TinyFish result maps to a `WebSearchSource`: `url`, `title`, `snippet`, and — for news and some web results — `date` as `publishedAt`. A result with no URL is dropped; blank optional fields are omitted rather than emitted empty. TinyFish's API carries no result-count control, so the request's `maxResults` is enforced by the service, which truncates and flags. TinyFish returns no generated answer, so the result carries no `content`.

### Failures and recovery

A missing key, or a 401/402/403 from TinyFish, surfaces as `WebError` `WEB_PROVIDER_CREDENTIAL_MISSING` naming where the key is configured. Other provider failures — HTTP errors, network failures, unparseable or wrong-shape bodies — surface as `WEB_PROVIDER_ERROR`; an aborted request surfaces as `WEB_ABORTED`. HTTP redirects are rejected before the `Location` target is contacted. Callers route on the code; the model-facing `web_search` tool surfaces failures to the model under its own error wrapper.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

This section explains the design decisions behind the provider; the observable behavior is fully covered in [Use this package](#use-this-package).

### Design philosophy

The provider is a thin adapter over TinyFish's search API with three deliberate rules:

- **The key is read per search, never captured.** It lives in the credentials store, which a settings surface writes without reloading this plugin, so a pasted key works on the next search rather than the next restart.
- **One section snapshot per operation.** The key and the endpoint it is sent to are read together, so a settings write landing inside credential resolution cannot send one section's key to another section's endpoint.
- **No invented answers.** TinyFish returns no generated answer, so `content` is omitted rather than fabricating provider prose the model might trust.

### Source map

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | Plugin entry: config schema, settings section, credential resolution, provider registration |
| [`src/provider.ts`](src/provider.ts) | The `TinyFishSearchProvider`: request dispatch, abort classification, result mapping |
| [`src/types.ts`](src/types.ts) | TinyFish wire types: `TinyFishSearchResponse`, `TinyFishResult`, `TinyFishError` |
| — | No runtime invariant companion is published; this package exposes no independent event sequence or mutable data relation beyond contracts enforced at its owning seam. |

### Request and mapping flow

`search()` resolves the credential, then sends `GET {baseURL}/?query=…` with an `X-API-Key` header and `redirect: 'error'`, so a redirect fails the request without contacting the target. The parsed `results[]` are mapped one by one, URL-less entries dropped, and the service applies the final `maxResults` bound on the way back. An abort — a `DOMException` named `AbortError`, or a signal already aborted before dispatch — becomes `WEB_ABORTED`; a key-shaped failure becomes `WEB_PROVIDER_CREDENTIAL_MISSING`; anything else becomes `WEB_PROVIDER_ERROR`.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these pages when the package-level contract is not enough. They move from the shared vocabulary to the service, the model-facing tools, and the design rationale.

- [Web subsystem](../../../docs/subsystems/web.md) — the exhaustive search request/result vocabulary and error codes.
- [Web package map](../README.md) — the web family and each role.
- [dsh-web](../web/README.md) — the web service this provider registers into, and the `web` settings section that selects it.
- [dsh-tool-web](../tool-web/README.md) — the model-facing `web_search` tool that renders this provider's sources.
- [Generated configuration catalog](../../../docs/config-catalog.md#deepseek-aidsh-web-search-tinyfish) — every accepted config field and its source declaration.
- [Web capability seam decision](../../../.agents/notes/implemented/architecture/2026-06-24-web-capability-seam.md) — why search and fetch share one provider-selection service.

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through `dsh-tool-web`, which retains this provider's `maxResults`-bounded URLs, titles, snippets, and publication dates or its exact `TinyFish search aborted`, `TinyFish search request failed: <error>`, `TinyFish returned an unprocessable response body: <error>`, and missing-key failures under the consumer's error wrapper.

#### KV Cache effect

No direct invalidation; the named consumer owns any request-prefix changes.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits define when the provider is a poor fit. They are current package constraints.

- **No result-count control is sent** — TinyFish's search API pages results instead, so a request's `maxResults` is enforced only by the service's truncation, and one page's worth of results is fetched regardless.
- **Only the query is sent** — TinyFish's `purpose`, `location`, `language`, domain filters, date filters, and `domain_type` (news, research papers) stay unexposed; they wait on provider-neutral service fields ([seam Agent Note](../../../.agents/notes/implemented/architecture/2026-06-24-web-capability-seam.md)).
- **Search only** — TinyFish's fetch and browser-automation APIs are not wired into `ctx.web`'s fetch side, which keeps the anonymous HTTP provider.
- **Abort classification is error-shape-based** — only a `DOMException` named `AbortError`, or an already-aborted signal, maps to `WEB_ABORTED`; an abort carrying a custom reason surfaces as `WEB_PROVIDER_ERROR`.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

This Dev Note is working context for maintainers: open questions and undecided directions. It is explicitly non-authoritative — shipped behavior, limits, and rationale live in the sections above and the linked Agent Notes.

#### Future: fetch and the wider search surface

TinyFish's fetch API renders JavaScript-heavy pages and returns markdown, which the anonymous HTTP fetch provider cannot do; wiring it as a second `tinyfish` fetch provider is the obvious next step and needs no new seam. The search filters stay unexposed for the same reason as Exa's: the family adds one coordinated control rather than a vendor-specific argument.

</details>
