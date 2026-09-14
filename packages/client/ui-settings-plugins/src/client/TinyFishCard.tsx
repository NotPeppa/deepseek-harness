/**
 * The TinyFish card: the key — written through the credentials domain, never
 * into the settings section — the endpoint, and the switch that points the web
 * seam's search at this provider.
 */

import { Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { SecretField, ValueField } from './fields.tsx'
import { PluginCard } from './PluginCard.tsx'
import css from './fields.module.css'
import { switchText, type TinyFishCardFace } from './tinyfish-card-controller.ts'
import type {} from './slot-contract.ts'

/** Props the renderer binds for the TinyFish card. */
export type TinyFishCardProps =
  PropsRuntime<'settings.plugin.item'>
  & PropsLocale<'settings.plugins'>
  & InjectFace<TinyFishCardFace>

/**
 * Render the TinyFish card.
 * @param props - locale copy, the card snapshot, and its form actions.
 * @returns the card.
 */
export function TinyFishCard(props: TinyFishCardProps) {
  const { t } = props
  const state = props.useTinyFishCard(snapshot => snapshot)
  const disabled = !state.writable
  return (
    <PluginCard
      t={t}
      titleKey="tinyfishTitle"
      descriptionKey="tinyfishDescription"
      state={state}
      onSave={props.save}
      onDiscard={props.discard}
    >
      <SecretField
        id="plugin-config-tinyfish-key"
        label={t('tinyfishApiKey')}
        hint={t('tinyfishApiKeyHint')}
        // The credentials domain accepts a key even when the settings document
        // itself is read-only; they are separate stores with separate refusals.
        disabled={!state.apiKeyWritable}
        text={state.apiKey.text}
        configured={state.apiKeyConfigured}
        stateLabel={state.apiKeyConfigured ? t('tinyfishApiKeySet') : t('tinyfishApiKeyUnset')}
        onEdit={(text) => { props.edit('apiKey', text) }}
      />
      <div className={css.field}>
        <div className={css.head}>
          <span className={css.label}>{t('tinyfishUseForSearch')}</span>
          <Switch
            checked={state.useForSearch}
            label={t('tinyfishUseForSearch')}
            // Selection lives in the web seam's own section: a deployment that
            // does not serve it cannot be switched from here.
            disabled={!state.selectionAvailable || state.saving}
            onChange={(next) => { props.edit('useForSearch', switchText(next)) }}
          />
        </div>
        <p className={css.hint}>{t('tinyfishUseForSearchHint')}</p>
      </div>
      <ValueField
        id="plugin-config-tinyfish-endpoint"
        label={t('tinyfishBaseUrl')}
        hint={t('tinyfishBaseUrlHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidNumber')}
        disabled={disabled}
        {...state.baseURL}
        onEdit={(text) => { props.edit('baseURL', text) }}
        onReset={() => { props.resetField('baseURL') }}
      />
    </PluginCard>
  )
}
