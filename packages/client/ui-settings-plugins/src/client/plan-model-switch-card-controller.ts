/**
 * The plan-phase card's staged form over the `plan-model-switch` settings
 * namespace: one route per phase, chosen from the Host's live model catalog,
 * plus the fold switch.
 *
 * The routes are ordinary section fields — no credential rides here — so the
 * staging is the plain {@link CardForm}. What this controller adds is the
 * catalog: the same `session.modelCatalog()` directory the Models page and the
 * Subagent card read, joined with whatever the section already stores so a
 * saved route the catalog stopped advertising stays visible and removable.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the ctx.remote merge into this program.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { ModelProviderGroup } from '@deepseek-ai/dsh-api-session-controller/types'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  CardForm, textField,
  type CardActions, type CardFieldSpec, type CardFieldState, type CardShell,
} from './card-form.ts'

/**
 * Namespace of the plan-phase routing plugin. Spelled here rather than
 * imported: a client package must not depend on a Host package.
 */
export const PLAN_MODEL_SWITCH_NS = 'plan-model-switch'

/** Staged text of a switch; both states are non-blank so both reach a write. */
const SWITCH_ON = 'on'
const SWITCH_OFF = 'off'

/** The two phases this card routes. */
export type PlanPhase = 'planning' | 'executing'

/** The section fields this card edits. */
export interface PlanModelSwitchSettings {
  planningProvider?: string
  planningModel?: string
  planningReasoningEffort?: string
  executingProvider?: string
  executingModel?: string
  executingReasoningEffort?: string
  foldPlanning?: boolean
}

/** One selectable route, as the card renders it. */
export interface RouteChoice {
  /** Value the control writes: `provider/model`, or empty for "no switch". */
  value: string
  /** Visible model name. */
  label: string
  /** Provider heading this choice groups under; absent for the empty choice. */
  group?: string
}

/** One selectable reasoning effort for the phase's chosen model. */
export interface EffortChoice {
  /** Value the control writes; empty means the model's own default. */
  value: string
  /** Visible effort name. */
  label: string
}

/** What one phase's controls render from. */
export interface PhaseState {
  /** Staged `provider/model`, or empty when this phase does not switch. */
  route: CardFieldState
  /** Routes the user can pick, including one the catalog no longer advertises. */
  choices: readonly RouteChoice[]
  /** Staged effort for the chosen model. */
  effort: CardFieldState
  /** Efforts the chosen model advertises; empty when it advertises none. */
  efforts: readonly EffortChoice[]
}

/** What the plan-phase card renders. */
export interface PlanModelSwitchCardState extends CardShell {
  planning: PhaseState
  executing: PhaseState
  /** Whether saving would leave the planning fold enabled. */
  foldPlanning: boolean
  /** Lifecycle of the model-catalog read. */
  catalogStatus: 'idle' | 'loading' | 'ready' | 'error'
  /** Whether some provider's catalog failed to load; loaded groups stay usable. */
  catalogPartial: boolean
}

/** The registration-side face the plan-phase card's slot entry injects. */
export interface PlanModelSwitchCardFace extends CardActions {
  hooks: {
    /** Card snapshot bound by the renderer as usePlanModelSwitchCard. */
    planModelSwitchCard: SnapshotStore<PlanModelSwitchCardState>
  }
  /** Stage both halves of one phase's route from a single `provider/model` choice. */
  selectRoute: (phase: PlanPhase, value: string) => void
  /** Re-read the Host model catalog after a failure. */
  retryCatalog: () => void
}

/** Field name the fold switch stages under. */
const FOLD_FIELD = 'foldPlanning'

/** Section fields, by phase. */
const FIELDS = {
  planning: { provider: 'planningProvider', model: 'planningModel', effort: 'planningReasoningEffort' },
  executing: { provider: 'executingProvider', model: 'executingModel', effort: 'executingReasoningEffort' },
} as const

/**
 * A boolean field staged as `on`/`off` text, so it shares the form's staging,
 * override, and reset behavior with every other control.
 * @param field - field name inside the namespace section.
 * @returns the field's conversion spec.
 */
function switchField(field: string): CardFieldSpec {
  return {
    field,
    format: value => value === true ? SWITCH_ON : SWITCH_OFF,
    parse: text => text === SWITCH_ON || text === SWITCH_OFF
      ? { kind: 'set', value: text === SWITCH_ON }
      : undefined,
  }
}

/**
 * Join a provider and a model into the one value a route control writes.
 * @param provider - provider route id.
 * @param model - provider-owned model id.
 * @returns the joined value, or the empty string when either half is missing.
 */
export function routeValue(provider: string, model: string): string {
  return provider === '' || model === '' ? '' : `${provider}/${model}`
}

/**
 * Split a route control's value back into its two section fields.
 *
 * Only the FIRST separator splits: a provider id never contains one, while a
 * model id routinely does (`deepseek/v4-flash`).
 * @param value - the control's value.
 * @returns the provider and model halves; both empty for the empty choice.
 */
export function splitRouteValue(value: string): { provider: string; model: string } {
  const separator = value.indexOf('/')
  if (separator === -1) return { provider: '', model: '' }
  return { provider: value.slice(0, separator), model: value.slice(separator + 1) }
}

/** Bridges the `plan-model-switch` scope and the Host model catalog onto the card. */
export class PlanModelSwitchCardController {
  private readonly form: CardForm<PlanModelSwitchSettings>
  private readonly store: SnapshotStore<PlanModelSwitchCardState>
  private groups: readonly ModelProviderGroup[] = []
  private status: PlanModelSwitchCardState['catalogStatus'] = 'idle'
  private partial = false
  private generation = 0
  private disposed = false

  /**
   * @param scope - the bound settings scope for the `plan-model-switch` namespace.
   * @param ctx - the card plugin's context, whose `remote.session` namespace
   *   answers the Host model catalog.
   */
  constructor(
    scope: SettingsScope<PlanModelSwitchSettings>,
    private readonly ctx: ClientContext,
  ) {
    this.form = new CardForm(scope, [
      ...Object.values(FIELDS).flatMap(fields => [
        textField(fields.provider), textField(fields.model), textField(fields.effort),
      ]),
      switchField(FOLD_FIELD),
    ])
    this.store = this.form.bind(() => this.projection())
    void this.loadCatalog()
  }

  /**
   * Build the face the card's slot registration injects.
   * @returns the card's snapshot, its form actions, and the route helpers.
   */
  inject(): PlanModelSwitchCardFace {
    const actions = this.form.actions()
    return {
      hooks: { planModelSwitchCard: this.store },
      ...actions,
      selectRoute: (phase, value) => {
        const { provider, model } = splitRouteValue(value)
        const fields = FIELDS[phase]
        // Both halves move together: a route that named only one of them would
        // resolve the other from the session's own model, which is a model the
        // user did not pick.
        actions.edit(fields.provider, provider)
        actions.edit(fields.model, model)
        // A different model advertises different efforts, so a stale effort
        // would be sent to a model that never offered it.
        actions.edit(fields.effort, '')
      },
      retryCatalog: () => {
        this.status = 'idle'
        void this.loadCatalog()
      },
    }
  }

  /** Re-read the catalog after the Host reports adapter or settings changes. */
  refreshCatalog(): void {
    this.status = 'idle'
    void this.loadCatalog()
  }

  /** Drop a catalog read that belongs to a previous connection generation. */
  resetConnection(): void {
    this.generation += 1
    this.groups = []
    this.status = 'idle'
    this.partial = false
    // The new connection serves its own catalog. Publishing the empty groups
    // without re-reading would strand both selects on the no-switch choice
    // until some later invalidation happened to fire — and `connection/reset`
    // fires on the FIRST connect too, right after the constructor's read.
    void this.loadCatalog()
  }

  /** Stop publishing after the card's plugin unloads. */
  dispose(): void {
    this.disposed = true
    this.generation += 1
  }

  private async loadCatalog(): Promise<void> {
    if (this.disposed || this.status === 'loading') return
    const generation = this.generation
    this.status = 'loading'
    this.partial = false
    this.store.set(this.projection())
    const response = await this.ctx.remote.session.modelCatalog()
    if (this.disposed || generation !== this.generation) return
    if (response.ok) {
      this.groups = response.value.groups
      this.partial = response.value.failures.length > 0
      this.status = 'ready'
    } else {
      this.status = 'error'
    }
    this.store.set(this.projection())
  }

  private projection(): PlanModelSwitchCardState {
    return {
      ...this.form.shell(),
      planning: this.phase('planning'),
      executing: this.phase('executing'),
      foldPlanning: this.form.field(FOLD_FIELD).text === SWITCH_ON,
      catalogStatus: this.status,
      catalogPartial: this.partial,
    }
  }

  /**
   * Project one phase: its staged route, the choices it can take, and the
   * efforts the chosen model advertises.
   * @param phase - the phase to project.
   * @returns the controls' state.
   */
  private phase(phase: PlanPhase): PhaseState {
    const fields = FIELDS[phase]
    const provider = this.form.field(fields.provider)
    const model = this.form.field(fields.model)
    const value = routeValue(provider.text, model.text)
    const choices: RouteChoice[] = [{ value: '', label: '' }]
    for (const group of this.groups) {
      for (const entry of group.models) {
        choices.push({ value: routeValue(group.id, entry.id), label: entry.name, group: group.name })
      }
    }
    // A stored route the catalog stopped advertising is still the route in
    // force; dropping it from the control would silently re-point the phase.
    if (value !== '' && !choices.some(choice => choice.value === value)) {
      choices.push({ value, label: model.text, group: provider.text })
    }
    const efforts = this.effortsFor(provider.text, model.text)
    return {
      // Route presence is what marks the phase overridden; the two halves are
      // always written together, so either one answers for both.
      route: { text: value, overridden: provider.overridden, invalid: false },
      choices,
      effort: this.form.field(fields.effort),
      efforts: efforts.length === 0 ? [] : [{ value: '', label: '' }, ...efforts],
    }
  }

  /**
   * Efforts advertised by one exact route.
   * @param provider - provider route id.
   * @param model - provider-owned model id.
   * @returns the advertised efforts, or an empty list.
   */
  private effortsFor(provider: string, model: string): EffortChoice[] {
    const entry = this.groups
      .find(group => group.id === provider)
      ?.models.find(candidate => candidate.id === model)
    return (entry?.reasoning?.efforts ?? []).map(effort => ({ value: effort.id, label: effort.name }))
  }
}

/**
 * Staged text for a switch position, so the card and the form agree on both states.
 * @param on - the position the user chose.
 * @returns the text to stage.
 */
export function foldSwitchText(on: boolean): string {
  return on ? SWITCH_ON : SWITCH_OFF
}
