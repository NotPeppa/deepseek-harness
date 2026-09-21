/**
 * Host-owned settings registration for plan-phase model routing.
 *
 * The runtime plugin is mounted only by agent presets that perform phase
 * routing. This companion stays on the Host so the configuration exists before
 * such a session starts and remains available after its last session closes.
 *
 * @module @deepseek-ai/dsh-plan-model-switch/settings
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-settings'
import {
  Config as PlanModelSwitchConfig,
  PLAN_MODEL_SWITCH_SETTINGS_NAMESPACE,
  type Config as PlanModelSwitchConfigValue,
} from './index.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'plan-model-switch-settings'

/** The settings provider owns the registered namespace. */
export const inject = ['settings']

/** Host-level defaults for every plan/execute runtime. */
export type Config = PlanModelSwitchConfigValue

/** Schema shared with the agent runtime. */
export const Config = PlanModelSwitchConfig

/**
 * Keep the phase-routing settings namespace registered for the Host lifetime.
 * @param ctx - Host plugin context carrying the settings provider.
 * @param config - Host defaults layered below saved user choices.
 */
export function apply(ctx: Context, config: Config): void {
  ctx.settings.register<
    typeof PLAN_MODEL_SWITCH_SETTINGS_NAMESPACE,
    Config
  >(PLAN_MODEL_SWITCH_SETTINGS_NAMESPACE, Config, { base: config })
}
