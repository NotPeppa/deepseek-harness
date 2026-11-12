/** Browser attention preference stored in the Host settings document. */
import z from '@deepseek-ai/schemastery'

/** Settings namespace owned by the attention plugin's profile entry. */
export const ATTENTION_SETTINGS_NAMESPACE = 'ui-attention'

/** Field carrying the browser-notification choice. */
export const ATTENTION_ENABLED_FIELD = 'enabled'

/** Durable attention section shared by the Host schema and the browser scope. */
export interface AttentionSettings {
  /** Whether browsers raise a notification for an interaction awaiting an answer. */
  enabled: boolean
}

/** New installations stay silent until a user enables notifications in a browser. */
export const AttentionSettingsFields = {
  [ATTENTION_ENABLED_FIELD]: z.boolean().default(false),
}

/** Schema for the shared attention section; also the wire envelope the browser form validates. */
export const AttentionSettingsSchema = z.object(AttentionSettingsFields)
