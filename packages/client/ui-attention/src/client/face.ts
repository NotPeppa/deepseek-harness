/** Registration-side injection face shared by the apply site and its tests. */
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { AttentionSettings } from '../notification-settings.ts'
import type { AttentionInjected } from './AttentionRow.tsx'
import type { AttentionPreference } from './preference.ts'

/**
 * Build the Settings row's injection face.
 * @param form - Host-owned configuration form.
 * @param preference - permission request and write queue.
 * @returns the row hooks and its writer.
 */
export function createAttentionFace(
  form: ConfigForm<AttentionSettings>,
  preference: AttentionPreference,
): AttentionInjected {
  return {
    hooks: { attention: form, mutation: preference.state },
    setEnabled: enabled => preference.setEnabled(enabled),
  }
}
