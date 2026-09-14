/**
 * Input-modality picker for one catalog row, shared by the curated DeepSeek
 * editor and the generic provider list so both spell the capability the same
 * way.
 *
 * The two adapters spell this capability differently, and the caller states
 * which contract it is under:
 *
 * - llm-deepseek stores `inputModalities`, schema `.min(1).default(['text'])`.
 *   Unset is text-only, and the empty array is refused — so an unset row shows
 *   text selected and the last box cannot be cleared.
 * - llm-pi-ai stores `input`, with no default and no minimum. Absent and empty
 *   mean the same thing there — "no answer at this level", which inherits the
 *   route's `defaultInput` and the installed catalog — so nothing is selected
 *   until the user says otherwise, and clearing back to inherit is allowed.
 *
 * Getting this backwards is silent: the write is dropped by a schema that has
 * no such field, or a row is pinned to text when it meant to inherit.
 */

import type { ReactNode } from 'react'
import type { en } from './locales.ts'
import styles from './ModelsSection.module.css'

/**
 * The modality vocabulary the adapters accept. Mirrors `MODEL_MODALITIES` in
 * llm-deepseek, which validates the write: a value absent there is rejected,
 * so this list stays in step with it rather than inventing options.
 */
export const MODALITIES = ['text', 'image'] as const

/** One accepted input modality. */
export type Modality = typeof MODALITIES[number]

/** Copy key naming each modality. */
const MODALITY_LABEL: Readonly<Record<Modality, keyof typeof en>> = {
  text: 'modalityText',
  image: 'modalityImage',
}

/** What llm-deepseek's schema resolves an unset field to. */
const DEFAULT_MODALITIES: readonly Modality[] = ['text']

/**
 * What an unset (or empty) field means for the adapter holding this row.
 * `text` is llm-deepseek's schema default; `inherit` is llm-pi-ai's "no answer
 * at this level", which is a real state the user may return to.
 */
export type ModalityUnset = 'text' | 'inherit'

/**
 * Read a row's stored modalities, dropping anything outside the vocabulary so
 * a hand-edited profile cannot render an option this control cannot express.
 * @param value - the row's raw modality field.
 * @param unset - what an absent or empty field means for this adapter.
 * @returns the selected modalities; empty only when the adapter can inherit.
 */
export function selectedModalities(value: unknown, unset: ModalityUnset): readonly Modality[] {
  const picked = Array.isArray(value) ? MODALITIES.filter(modality => value.includes(modality)) : []
  // Under `inherit` an empty selection is the inheriting state and is shown as
  // it is; under `text` it is the schema default, which is text-only.
  if (picked.length === 0) return unset === 'inherit' ? [] : DEFAULT_MODALITIES
  return picked
}

/** Props of {@link ModalityField}. */
export interface ModalityFieldProps {
  /** The row's raw modality field, possibly unset. */
  value: unknown
  /** What an absent or empty field means for the adapter holding this row. */
  unset: ModalityUnset
  /** Zero-based row position, for the accessible names. */
  index: number
  /** Disable the control (read-only deployment or a pending write). */
  disabled: boolean
  /** Section copy. */
  t: (key: keyof typeof en) => string
  /** Store the row's new modality array. */
  onChange: (next: Modality[]) => void
}

/**
 * Render the modality checkboxes for one row.
 * @param props - the stored value, position, copy, and write.
 * @returns the modality field.
 */
export function ModalityField(props: ModalityFieldProps): ReactNode {
  const selected = selectedModalities(props.value, props.unset)
  return (
    <div className={styles['modelField']} data-modality-field>
      <span className={styles['modelFieldLabel']}>{props.t('modelModalities')}</span>
      <div className={styles['modalityOptions']}>
        {MODALITIES.map((modality) => {
          const checked = selected.includes(modality)
          // Only the `text` contract refuses an empty array, so only there is
          // the last remaining box pinned; under `inherit`, clearing it is how
          // a user returns the row to the catalog's own capability.
          const last = props.unset === 'text' && checked && selected.length === 1
          return (
            <label key={modality} className={styles['modalityOption']}>
              <input
                type="checkbox"
                checked={checked}
                disabled={props.disabled || last}
                aria-label={`${props.t(MODALITY_LABEL[modality])} ${String(props.index + 1)}`}
                onChange={() => {
                  props.onChange(checked
                    ? selected.filter(kept => kept !== modality)
                    : MODALITIES.filter(option => option === modality || selected.includes(option)))
                }}
              />
              <span>{props.t(MODALITY_LABEL[modality])}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
