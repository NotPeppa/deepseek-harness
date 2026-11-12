/** General Settings row for browser notifications on pending interactions. */
import { Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { AttentionSettings } from '../notification-settings.ts'
import type { AttentionState } from './preference.ts'
import css from './AttentionRow.module.css'

/** Accepted preference, browser permission outcome, and writer supplied by the plugin. */
export interface AttentionInjected {
  hooks: {
    attention: ObservableSnapshot<ConfigFormSnapshot<AttentionSettings>>
    mutation: ObservableSnapshot<AttentionState>
  }
  /**
   * Ask for permission (when enabling) and persist the choice.
   * @param enabled - requested notification state.
   * @returns completion after the request and Host write settle.
   */
  setEnabled(enabled: boolean): Promise<void>
}

type Face = InjectFace<AttentionInjected> & PropsLocale<'attention'>

/**
 * Render the browser-notification preference.
 * @param props - settings hooks, writer, and localized copy.
 * @returns the General Settings row.
 */
export function AttentionRow({ useAttention, useMutation, setEnabled, t }: PropsRuntime<'settings.general.item'> & Face) {
  const settings = useAttention(value => value)
  const mutation = useMutation(value => value)
  const enabled = settings.value?.enabled === true
  const unsupported = mutation.notice === 'unsupported' || mutation.permission === 'unsupported'
  const hint = mutation.notice === 'denied' ? t('row.denied')
    : mutation.notice === 'failed' ? t('row.failed')
      : unsupported ? t('row.unsupported')
        : enabled && mutation.permission !== 'granted' ? t('row.permission')
          : undefined
  return <div className={css.row}>
    <div>
      <div className={css.title}>{t('row.title')}</div>
      <div className={css.description}>{t('row.description')}</div>
      {hint !== undefined && <div className={css.hint} role="alert">{hint}</div>}
    </div>
    <Switch checked={enabled} label={t('row.title')}
      disabled={mutation.busy || unsupported || settings.status !== 'ready' || !settings.writable}
      onChange={(next) => { void setEnabled(next) }} />
  </div>
}
