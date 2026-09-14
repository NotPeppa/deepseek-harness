/**
 * The plan-phase card: which model plans, which model executes, and whether
 * leaving plan mode folds the exploration behind the approved plan.
 *
 * Both routes are chosen from the Host's live model catalog — the same
 * directory the Models page reads — so the card offers exactly the routes this
 * deployment can actually serve.
 */

import { Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { SelectField } from './fields.tsx'
import { PluginCard } from './PluginCard.tsx'
import css from './fields.module.css'
import { foldSwitchText } from './plan-model-switch-card-controller.ts'
import type {
  PhaseState, PlanModelSwitchCardFace, PlanPhase,
} from './plan-model-switch-card-controller.ts'
import type {} from './slot-contract.ts'

/** Props the renderer binds for the plan-phase card. */
export type PlanModelSwitchCardProps =
  PropsRuntime<'settings.plugin.item'>
  & PropsLocale<'settings.plugins'>
  & InjectFace<PlanModelSwitchCardFace>

/**
 * Render the plan-phase card.
 * @param props - locale copy, the card snapshot, and its form actions.
 * @returns the card.
 */
export function PlanModelSwitchCard(props: PlanModelSwitchCardProps) {
  const { t } = props
  const state = props.usePlanModelSwitchCard(snapshot => snapshot)
  const disabled = !state.writable

  /**
   * One phase's route and effort controls.
   * @param phase - which phase these controls belong to.
   * @param phaseState - that phase's projected state.
   * @returns the labelled controls.
   */
  const phaseFields = (phase: PlanPhase, phaseState: PhaseState) => (
    <>
      <SelectField
        id={`plugin-config-plan-phase-${phase}-route`}
        label={t('planPhaseModel')}
        hint={t('planPhaseModelHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        disabled={disabled || state.catalogStatus === 'loading'}
        text={phaseState.route.text}
        overridden={phaseState.route.overridden}
        options={phaseState.choices.map(choice => ({
          value: choice.value,
          // The empty choice is the one option the catalog does not name.
          label: choice.value === '' ? t('planPhaseKeepModel') : choice.label,
          ...choice.group === undefined ? {} : { group: choice.group },
        }))}
        onEdit={(value) => { props.selectRoute(phase, value) }}
        onReset={() => { props.selectRoute(phase, '') }}
      />
      <SelectField
        id={`plugin-config-plan-phase-${phase}-effort`}
        label={t('planPhaseReasoningEffort')}
        // The control stays on screen when the chosen model offers no effort —
        // and before any model is chosen — because a control that appears only
        // after another choice reads as a missing feature.
        hint={phaseState.efforts.length === 0
          ? t('planPhaseEffortUnavailable')
          : t('planPhaseReasoningEffortHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        disabled={disabled || phaseState.efforts.length === 0}
        text={phaseState.effort.text}
        overridden={phaseState.effort.overridden}
        options={phaseState.efforts.length === 0
          ? [{ value: '', label: t('planPhaseDefaultEffort') }]
          : phaseState.efforts.map(effort => ({
            value: effort.value,
            label: effort.value === '' ? t('planPhaseDefaultEffort') : effort.label,
          }))}
        onEdit={(value) => { props.edit(`${phase}ReasoningEffort`, value) }}
        onReset={() => { props.edit(`${phase}ReasoningEffort`, '') }}
      />
    </>
  )

  return (
    <PluginCard
      t={t}
      titleKey="planPhaseTitle"
      descriptionKey="planPhaseDescription"
      state={state}
      onSave={props.save}
      onDiscard={props.discard}
    >
      {state.catalogStatus === 'loading'
        ? <p className={css.hint} role="status">{t('planPhaseCatalogLoading')}</p>
        : null}
      {state.catalogStatus === 'error'
        ? (
          <p className={css.invalid} role="alert">
            {t('planPhaseCatalogFailed')}
            {' '}
            <button type="button" className={css.reset} onClick={props.retryCatalog}>
              {t('planPhaseCatalogRetry')}
            </button>
          </p>
        )
        : null}
      {state.catalogPartial
        ? <p className={css.hint} role="status">{t('planPhaseCatalogPartial')}</p>
        : null}
      <p className={css.label}>{t('planPhasePlanningGroup')}</p>
      {phaseFields('planning', state.planning)}
      <p className={css.label}>{t('planPhaseExecutingGroup')}</p>
      {phaseFields('executing', state.executing)}
      <div className={css.field}>
        <div className={css.head}>
          <span className={css.label}>{t('planPhaseFold')}</span>
          <Switch
            checked={state.foldPlanning}
            label={t('planPhaseFold')}
            disabled={disabled || state.saving}
            onChange={(next) => { props.edit('foldPlanning', foldSwitchText(next)) }}
          />
        </div>
        <p className={css.hint}>{t('planPhaseFoldHint')}</p>
      </div>
    </PluginCard>
  )
}
