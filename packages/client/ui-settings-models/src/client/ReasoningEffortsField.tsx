/**
 * Reasoning-level picker for one custom-provider catalog row.
 *
 * The stored field is pi-ai's `reasoningEfforts`, which is three-state: absent
 * inherits whatever the installed catalog knows about the model, `false` says
 * the model does not think, and a dict declares exactly the levels this
 * deployment offers — each mapped to the wire spelling dispatch should send.
 * Only `off` may leave that spelling empty, because "off" is the one level a
 * provider expresses by sending nothing.
 *
 * The control keeps those rules rather than letting a save fail on them: the
 * adapter refuses a dict with no level beyond `off`, and any non-`off` level
 * whose spelling is blank.
 */

import type { ReactNode } from 'react'
import type { en } from './locales.ts'
import styles from './ModelsSection.module.css'

/**
 * The thinking levels a profile may declare, in escalation order. Mirrors
 * `THINKING_LEVELS` in llm-pi-ai, which validates the write: a level absent
 * there is rejected, so this list stays in step with it rather than inventing
 * options.
 */
export const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const

/** One declarable thinking level. */
export type ThinkingLevel = typeof THINKING_LEVELS[number]

/** The stored map: level → wire spelling, or `null` for "send nothing". */
export type ReasoningEfforts = Partial<Record<ThinkingLevel, string | null>>

/** What the row's field says about reasoning. */
export type ReasoningMode = 'inherit' | 'none' | 'custom'

/** Copy key naming each mode. */
const MODE_LABEL: Readonly<Record<ReasoningMode, keyof typeof en>> = {
  inherit: 'reasoningInherit',
  none: 'reasoningNone',
  custom: 'reasoningCustom',
}

/**
 * Classify a row's stored field.
 * @param value - the row's raw `reasoningEfforts` field.
 * @returns which of the three states it carries.
 */
export function reasoningModeOf(value: unknown): ReasoningMode {
  if (value === false) return 'none'
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) return 'custom'
  return 'inherit'
}

/**
 * Read a row's declared levels, dropping anything outside the vocabulary so a
 * hand-edited profile cannot render a level this control cannot express.
 * @param value - the row's raw `reasoningEfforts` field.
 * @returns the declared levels in escalation order.
 */
export function declaredEfforts(value: unknown): ReasoningEfforts {
  if (reasoningModeOf(value) !== 'custom') return {}
  const stored = value as Record<string, unknown>
  const efforts: ReasoningEfforts = {}
  for (const level of THINKING_LEVELS) {
    if (!Object.hasOwn(stored, level)) continue
    const wire = stored[level]
    if (wire === null) efforts[level] = null
    else if (typeof wire === 'string') efforts[level] = wire
  }
  return efforts
}

/**
 * The first row whose declared levels the adapter would refuse.
 *
 * Reported as a row position and a copy key so the caller can name the row the
 * same way the other per-row checks do.
 * @param models - the catalog rows as drafted.
 * @returns the failing row and its reason, or `undefined` when every row is
 *   acceptable.
 */
export function validateReasoningEfforts(
  models: unknown,
): { index: number; key: keyof typeof en } | undefined {
  if (!Array.isArray(models)) return undefined
  for (const [index, model] of models.entries()) {
    if (typeof model !== 'object' || model === null) continue
    const value = (model as Record<string, unknown>)['reasoningEfforts']
    if (reasoningModeOf(value) !== 'custom') continue
    const efforts = declaredEfforts(value)
    const levels = THINKING_LEVELS.filter(level => Object.hasOwn(efforts, level))
    // An empty map and an off-only map are both refused by the adapter: the
    // first declares nothing, the second offers no way to think.
    if (!levels.some(level => level !== 'off')) return { index, key: 'reasoningNeedsLevel' }
    for (const level of levels) {
      if (level === 'off') continue
      const wire = efforts[level]
      if (typeof wire !== 'string' || wire.trim().length === 0) {
        return { index, key: 'reasoningNeedsWire' }
      }
    }
  }
  return undefined
}

/** Props of {@link ReasoningEffortsField}. */
export interface ReasoningEffortsFieldProps {
  /** The row's raw `reasoningEfforts` field, possibly unset. */
  value: unknown
  /** Zero-based row position, for the accessible names. */
  index: number
  /** Disable the control (read-only deployment or a pending write). */
  disabled: boolean
  /** Section copy. */
  t: (key: keyof typeof en) => string
  /** Store the row's new field: the declared map, `false`, or unset. */
  onChange: (next: ReasoningEfforts | false | undefined) => void
}

/**
 * Render the reasoning-level picker for one row.
 * @param props - the stored value, position, copy, and write.
 * @returns the reasoning field.
 */
export function ReasoningEffortsField(props: ReasoningEffortsFieldProps): ReactNode {
  const mode = reasoningModeOf(props.value)
  const efforts = declaredEfforts(props.value)
  const label = (key: keyof typeof en): string => `${props.t(key)} ${String(props.index + 1)}`

  /**
   * Switch between the three states, seeding a fresh custom map with the
   * levels a reasoning model almost always has.
   * @param next - the mode the user chose.
   */
  const setMode = (next: ReasoningMode): void => {
    if (next === 'inherit') props.onChange(undefined)
    else if (next === 'none') props.onChange(false)
    // A seeded map is a map the adapter accepts; an empty one it refuses, and
    // an empty list of checkboxes reads as a broken control.
    else props.onChange(Object.keys(efforts).length > 0 ? efforts : { off: null, high: '' })
  }

  return (
    <div className={styles['modelField']} data-reasoning-field>
      <span className={styles['modelFieldLabel']}>{props.t('modelReasoning')}</span>
      <select
        className={`${styles['input']} ${styles['selectInput']}`}
        value={mode}
        aria-label={label('modelReasoning')}
        disabled={props.disabled}
        onChange={(event) => { setMode(event.target.value as ReasoningMode) }}
      >
        {(['inherit', 'none', 'custom'] as const).map(option => (
          <option key={option} value={option}>{props.t(MODE_LABEL[option])}</option>
        ))}
      </select>
      {mode === 'custom'
        ? (
          <div className={styles['reasoningLevels']}>
            {THINKING_LEVELS.map((level) => {
              const declared = Object.hasOwn(efforts, level)
              const wire = efforts[level]
              return (
                <div key={level} className={styles['reasoningLevel']}>
                  <label className={styles['modalityOption']}>
                    <input
                      type="checkbox"
                      checked={declared}
                      disabled={props.disabled}
                      aria-label={`${level} ${String(props.index + 1)}`}
                      onChange={() => {
                        // Rebuilt rather than deleted from: a declared level is
                        // dropped by leaving it out, which also keeps the map in
                        // escalation order however the boxes were clicked.
                        const next: ReasoningEfforts = {}
                        for (const kept of THINKING_LEVELS) {
                          if (kept === level) {
                            // `off` is the one level whose wire value may stay
                            // empty, so it is the one that starts as null.
                            if (!declared) next[kept] = kept === 'off' ? null : ''
                          } else if (Object.hasOwn(efforts, kept)) {
                            next[kept] = efforts[kept] ?? null
                          }
                        }
                        props.onChange(next)
                      }}
                    />
                    <span>{level}</span>
                  </label>
                  {declared
                    ? (
                      <input
                        className={`${styles['input']} ${styles['reasoningWire']}`}
                        type="text"
                        value={wire ?? ''}
                        placeholder={props.t(level === 'off' ? 'reasoningWireOff' : 'reasoningWire')}
                        aria-label={`${props.t('reasoningWire')} ${level} ${String(props.index + 1)}`}
                        disabled={props.disabled}
                        onChange={(event) => {
                          const text = event.target.value
                          props.onChange({
                            ...efforts,
                            // Only `off` may store the empty spelling, and it
                            // stores it as null — the shape the adapter reads
                            // as "send nothing".
                            [level]: text === '' && level === 'off' ? null : text,
                          })
                        }}
                      />
                    )
                    : null}
                </div>
              )
            })}
          </div>
        )
        : null}
    </div>
  )
}
