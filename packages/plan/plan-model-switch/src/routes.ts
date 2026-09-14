/**
 * Route vocabulary shared by the plugin entry and its settings section: one
 * flat provider/model/effort triple per phase, plus the reads that decide
 * whether a phase is configured at all.
 *
 * The shape is deliberately flat (`planningProvider`, `planningModel`, …)
 * rather than nested objects: a settings surface edits one scalar field per
 * control, and a nested section would need path-addressed controls to say the
 * same thing.
 *
 * @module @deepseek-ai/dsh-plan-model-switch/routes
 */

import type { ModelSelection } from '@deepseek-ai/dsh-agent'

/** The plan phases this plugin routes. */
export type PlanPhase = 'planning' | 'executing'

/** Flat settings/config shape: one provider/model/effort triple per phase. */
export interface PhaseRoutes {
  /** LLM provider serving the planning phase; empty leaves planning unrouted. */
  planningProvider?: string
  /** Model serving the planning phase; empty leaves planning unrouted. */
  planningModel?: string
  /** Adapter-owned reasoning effort for the planning route. */
  planningReasoningEffort?: string
  /** LLM provider serving the execution phase; empty leaves execution unrouted. */
  executingProvider?: string
  /** Model serving the execution phase; empty leaves execution unrouted. */
  executingModel?: string
  /** Adapter-owned reasoning effort for the execution route. */
  executingReasoningEffort?: string
  /** Whether leaving plan mode folds the planning span into one summary. */
  foldPlanning?: boolean
}

/**
 * Read one phase's route, or `undefined` when it is not fully configured.
 *
 * Both a provider and a model are required: a half-named route would silently
 * resolve the other half from the session's current selection, which is a
 * different model than the one the user asked for.
 *
 * @param routes - the currently authoritative section.
 * @param phase - which phase to read.
 * @returns the selection to install, or `undefined` to leave routing alone.
 */
export function routeFor(routes: PhaseRoutes, phase: PlanPhase): ModelSelection | undefined {
  const provider = trimmed(phase === 'planning' ? routes.planningProvider : routes.executingProvider)
  const model = trimmed(phase === 'planning' ? routes.planningModel : routes.executingModel)
  if (provider === undefined || model === undefined) return undefined
  const effort = trimmed(
    phase === 'planning' ? routes.planningReasoningEffort : routes.executingReasoningEffort,
  )
  const route: ModelSelection = { provider, model }
  // Cast: the adapter owns which effort ids it accepts, and the live route
  // preflight — not this projection — is what rejects an unknown one.
  return effort === undefined
    ? route
    : { ...route, reasoningEffort: effort as NonNullable<ModelSelection['reasoningEffort']> }
}

/**
 * Whether two selections name the same route, so an unchanged phase transition
 * installs nothing and appends no model-change notice.
 * @param left - one selection, or none.
 * @param right - the other selection, or none.
 * @returns true when both are absent or name the same provider/model/effort.
 */
export function sameRoute(left: ModelSelection | undefined, right: ModelSelection | undefined): boolean {
  if (left === undefined || right === undefined) return left === right
  return left.provider === right.provider
    && left.model === right.model
    && left.reasoningEffort === right.reasoningEffort
}

/**
 * A configured string field, or `undefined` when blank.
 * @param value - the raw section value.
 * @returns the trimmed value, or `undefined` when it carries nothing.
 */
function trimmed(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  const text = value.trim()
  return text.length > 0 ? text : undefined
}
