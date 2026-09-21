/**
 * Route each plan phase to its own model: the planning phase to a model chosen
 * for design, the execution phase to a model chosen for throughput, with the
 * switch landing exactly where the user approved the plan.
 *
 * Leaving plan mode optionally folds the exploration that produced the plan
 * into one summary, so the execution phase pays for the deliverable rather than
 * for the whole transcript behind it. The reviewed plan itself is never folded.
 *
 * This is an agent-plane plugin: a preset mounts it once and every joined
 * session keys its own phase state here.
 *
 * @module @deepseek-ai/dsh-plan-model-switch
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { installModelSelection } from '@deepseek-ai/dsh-agent'
import type { Agent, ModelSelection, ModelSelectionRef } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-compaction'
import { EXIT_PLAN_MODE } from '@deepseek-ai/dsh-plan-mode'
import type {} from '@deepseek-ai/dsh-plan-mode/types'
import type { Session, SessionSeq } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session-projection'
import type {} from '@deepseek-ai/dsh-settings'
import { deliverableNodeSeq, planningSpan } from './fold.ts'
import { routeFor, sameRoute } from './routes.ts'
import type { PhaseRoutes } from './routes.ts'

export { deliverableNodeSeq, planningSpan } from './fold.ts'
export type { FoldSpan } from './fold.ts'
export { routeFor, sameRoute } from './routes.ts'
export type { PhaseRoutes, PlanPhase } from './routes.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'plan-model-switch'

/** Plan state is this plugin's whole input; compaction is optional. */
export const inject = ['planMode', 'sessionProjections']

/** Settings namespace carrying both phase routes and the fold switch. */
export const PLAN_MODEL_SWITCH_SETTINGS_NAMESPACE = 'plan-model-switch'

/** Smallest planning span worth replacing with a summary. */
const MINIMUM_FOLD_NODES = 4

/** Plugin config; the settings section layers over it. */
export interface Config extends PhaseRoutes {}

export const Config: z<Config> = z.object({
  planningProvider: z.string(),
  planningModel: z.string(),
  planningReasoningEffort: z.string(),
  executingProvider: z.string(),
  executingModel: z.string(),
  executingReasoningEffort: z.string(),
  // Declared with its default here rather than only at the use site: a
  // configuration surface renders the resolved section, so a default the schema
  // does not carry reads there as no value at all.
  foldPlanning: z.boolean().default(true),
})

/** What this plugin remembers about one session's journey through plan mode. */
interface PhaseState {
  /** Plan-mode state as of the last boundary this plugin observed. */
  active: boolean
  /** Last surface seq before planning began; the fold's leading edge. */
  mark?: SessionSeq
}

/**
 * Mount phase routing for every session that joins this composition.
 * @param ctx - the plugin context, standing for every joined agent.
 * @param config - fallback routes used when no Host settings owner is mounted.
 */
export function apply(ctx: Context, config: Config): void {
  let current: () => Config = () => config
  ctx.inject(['settings'], (settingsCtx) => {
    current = () => {
      const descriptor = settingsCtx.settings.describe()
        .find(candidate => candidate.ns === PLAN_MODEL_SWITCH_SETTINGS_NAMESPACE)
      return descriptor === undefined ? config : descriptor.value as Config
    }
    settingsCtx.effect(() => () => { current = () => config }, 'plan-model-switch: settings source')
  })

  // One ref per agent, installed into the agent's own scope on first sight:
  // `installModelSelection` owns request routing, the `{{model}}` prompt
  // variable, and the durable "[model changed: …]" notice, so this plugin only
  // decides WHICH route each phase gets.
  const selections = new WeakMap<Agent, ModelSelectionRef>()
  const phases = new WeakMap<Session, PhaseState>()

  ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next()
    // Plan mode commits its own state in this same waterfall, so reading after
    // `next()` observes the boundary the step is about to run under.
    try {
      await observeBoundary(payload.agent, payload.signal)
    } catch (error: unknown) {
      // Phase routing is a convenience over a working session: a failure here
      // must never take the turn down with it.
      ctx.logger.warn('dsh-plan-model-switch: phase boundary not applied: %o', error)
    }
    return decision
  })

  /**
   * Apply the phase this step runs under, switching routes and folding the
   * planning span when the phase changed.
   * @param agent - the agent whose step is about to run.
   * @param signal - the step's cancellation signal.
   * @returns settlement after the route is installed and any fold has landed.
   */
  async function observeBoundary(agent: Agent, signal: AbortSignal): Promise<void> {
    // Install before any transition can land: a ref installed mid-step would
    // race the step that is supposed to run under the new route.
    ensureSelection(agent)
    const routes = current()
    const active = planActive(ctx, agent.session)
    const previous = phases.get(agent.session)
    if (previous?.active === active) return

    const state: PhaseState = { active, ...previous?.mark === undefined ? {} : { mark: previous.mark } }
    if (active) {
      // Planning starts after everything already on the surface; that is the
      // fold's leading edge. An empty surface leaves the edge unknown, which
      // the fold reads as "nothing safe to fold".
      const tail = agent.session.surface.nodes.at(-1)
      if (tail === undefined) delete state.mark
      else state.mark = tail
    }
    phases.set(agent.session, state)

    // First sight of a session that is not planning is a starting state, not a
    // transition: a session that never plans must keep the route it was
    // created with rather than silently adopting the execution model.
    if (!active && previous === undefined) return

    // Route first: a fold that fails must still leave the session on the phase
    // the user just moved into.
    select(agent, routeFor(routes, active ? 'planning' : 'executing'))
    // Awaited, not fired and forgotten: the step this boundary opens is the
    // first step of the execution phase, and it is exactly the step that must
    // not carry the exploration. A session already mid-plan when this plugin
    // first saw it (a resume, or a fork) carries no leading edge and folds
    // nothing.
    if (!active && routes.foldPlanning !== false) await foldPlanning(ctx, agent, state.mark, signal)
  }

  /**
   * Install one phase's route for the agent's next request.
   * @param agent - the agent to route.
   * @param route - the selection to install, or `undefined` to leave the
   *   session's current route alone.
   */
  function select(agent: Agent, route: ModelSelection | undefined): void {
    const ref = ensureSelection(agent)
    // An unconfigured phase leaves the session on the route it already has,
    // and an unchanged route appends no model-change notice.
    if (route === undefined || sameRoute(ref.current, route)) return
    ref.current = route
    // Prompt assembly already ran for this step (the loop assembles, then opens
    // the pre-step waterfall plan mode commits in), so the captured selection is
    // set here too: the step that carries the approved plan is the first step
    // the new route serves, not the one after it.
    ref.assembled = route
  }

  /**
   * The agent's selection ref, installing it into the agent's own scope on
   * first sight.
   * @param agent - the agent to route.
   * @returns the ref whose `current` decides that agent's next request.
   */
  function ensureSelection(agent: Agent): ModelSelectionRef {
    const existing = selections.get(agent)
    if (existing !== undefined) return existing
    const ref: ModelSelectionRef = { current: undefined, assembled: undefined }
    selections.set(agent, ref)
    installModelSelection(agent.ctx, ref)
    return ref
  }
}

/**
 * Read the logged plan-mode state for one session.
 * @param ctx - context owning the projection registry.
 * @param session - the session to read.
 * @returns whether plan mode is logged active.
 */
function planActive(ctx: Context, session: Session): boolean {
  const state = ctx.sessionProjections.stateOf(session, 'plan')
  if (state === undefined) throw new Error('plan-model-switch requires the plan session projection')
  return state.active
}

/**
 * Replace the planning span with one summary, keeping the reviewed plan.
 *
 * Every failure is swallowed by design: the fold is a cost optimization, and a
 * session that cannot fold is still a correct session running the execution
 * route.
 * @param ctx - context that may carry a compaction engine.
 * @param agent - the agent whose session is folded.
 * @param mark - last surface seq before planning began.
 * @param signal - the step's cancellation signal.
 * @returns settlement after the fold lands, or immediately when there is
 *   nothing to fold.
 */
async function foldPlanning(
  ctx: Context,
  agent: Agent,
  mark: SessionSeq | undefined,
  signal: AbortSignal,
): Promise<void> {
  const compaction = ctx.get('compaction')
  if (compaction === undefined) return
  const span = planningSpan(
    agent.session,
    mark,
    deliverableNodeSeq(agent.session, EXIT_PLAN_MODE),
    MINIMUM_FOLD_NODES,
  )
  if (span === undefined) return
  try {
    await compaction.compactRegion(
      span.start, span.end, { session: agent.session, options: agent.options }, signal)
  } catch (error: unknown) {
    ctx.logger.warn('dsh-plan-model-switch: planning span was not folded: %o', error)
  }
}
