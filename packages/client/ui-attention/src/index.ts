/** Browser attention preferences shared with every authenticated browser. */
import type {} from '@deepseek-ai/dsh-settings'

import type { Context, Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { ATTENTION_ENABLED_FIELD, AttentionSettingsFields } from './notification-settings.ts'

/** Runtime preferences projected to the browser. */
export interface Config {
  /** Whether browsers raise a notification for an interaction awaiting an answer. */
  enabled: Volatile<boolean>
}

/** Live preferences projected to the browser. */
export const Config = z.object({
  [ATTENTION_ENABLED_FIELD]: AttentionSettingsFields[ATTENTION_ENABLED_FIELD].volatile(),
})

/**
 * Register the browser attention preference.
 * @param ctx - Plugin context used for the optional settings presentation.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (child) => { child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)) })
}
