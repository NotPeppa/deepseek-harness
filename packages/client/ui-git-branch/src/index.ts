/**
 * Branch-pill plugin, node half. Pure UI plugin: the empty apply exists so the
 * plugin appears in the host cordis.yml / Loader; the browser half ships via
 * exports["./client"], discovered through the package.json dsh.client
 * declaration. Every git operation lives in the `git` Remote namespace owned
 * by @deepseek-ai/dsh-api-git-controller.
 */

/** Host plugin body — no host-side behavior for this surface plugin. */
export function apply(): void {}
