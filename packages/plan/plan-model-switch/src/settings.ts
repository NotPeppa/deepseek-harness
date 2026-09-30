/** Host-owned, live plan and execution model choices. */
import type { Context, Volatile } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import type { PhaseRoutes } from './routes.ts'

/** Cordis plugin name. */
export const name = 'plan-model-switch-settings'
/** Services used to register the custom configuration page. */
export const inject = ['settings']
/** Live host choices shared by plan/execute sessions. */
export type Config = { [K in keyof Required<PhaseRoutes>]: Volatile<Required<PhaseRoutes>[K]> }
/** Live routing fields projected by the settings service. */
export const Config = z.object({
  planningProvider: z.string().default('').volatile(),
  planningModel: z.string().default('').volatile(),
  planningReasoningEffort: z.string().default('').volatile(),
  executingProvider: z.string().default('').volatile(),
  executingModel: z.string().default('').volatile(),
  executingReasoningEffort: z.string().default('').volatile(),
  foldPlanning: z.boolean().default(true).volatile(),
})
/** Supply the custom page policy.
 * @param ctx Host context.
 * @param _config Live routing choices exposed through the settings service.
 */
export function apply(ctx: Context, _config: Config): void {
  ctx.effect(() => ctx.settings.configure({ auto: false }, ctx.fiber))
}
