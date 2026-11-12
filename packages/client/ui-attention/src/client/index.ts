/** Browser notification for Session interactions awaiting an answer. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { ATTENTION_SETTINGS_NAMESPACE, type AttentionSettings } from '../notification-settings.ts'
import { AttentionPreference } from './preference.ts'
import { AttentionRow, type AttentionInjected } from './AttentionRow.tsx'
import { createAttentionFace } from './face.ts'
import { PendingAttention, noticeKey, type AttentionMessage } from './attention.ts'
import { browserAttentionPlatform } from './platform.ts'
import { en, es, fr, de, ja, pt, ru, zh, type AttentionKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Browser notification row and notice copy. */
    attention: AttentionKey
  }
}

/** Services used by the browser notification watcher and its Settings row. */
export const inject = ['slots', 'locale', 'configForms', 'sessions', 'uiSession']

/** Copy namespace owned by this plugin. */
const NS = 'attention'

/**
 * Resolve one interaction's notification copy from the Session's current title.
 * @param t - attention dictionary lookup.
 * @param ctx - Client context supplying the Session list.
 * @param sessionId - Session owning the pending interaction.
 * @param kind - domain discriminator of the pending interaction.
 * @returns localized heading and body.
 */
function describeNotice(
  t: (key: AttentionKey, params?: Record<string, unknown>) => string,
  ctx: Context,
  sessionId: SessionId,
  kind: string,
): AttentionMessage {
  const title = ctx.sessions.list.getSnapshot().byId[sessionId]?.displayTitle
  return {
    title: t(noticeKey(kind)),
    body: title === undefined ? t('notice.body') : t('notice.session', { title }),
  }
}

/**
 * Install the notification watcher and its General Settings row.
 * @param ctx - Client plugin context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en, ja, es, fr, de, ru, pt }), 'ui-attention: dictionaries')
  const t = ctx.locale.bind(NS)
  const form = ctx.configForms.get<AttentionSettings>(ATTENTION_SETTINGS_NAMESPACE)
  const platform = browserAttentionPlatform()
  const preference = new AttentionPreference(form, platform)
  const attention = new PendingAttention({
    platform,
    enabled: () => form.getSnapshot().value?.enabled === true,
    describe: ({ sessionId, kind }) => describeNotice(t, ctx, sessionId, kind),
    open: (sessionId) => { ctx.get('uiWorkspace')?.openSession(sessionId) },
  })
  ctx.effect(() => {
    const publish = (): void => { attention.publish(ctx.uiSession.sessionStatus.getSnapshot()) }
    const off = ctx.uiSession.sessionStatus.subscribe(publish)
    publish()
    return () => {
      off()
      attention.dispose()
    }
  }, 'ui-attention: pending interaction watch')
  const face = (): AttentionInjected => createAttentionFace(form, preference)
  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item', id: ATTENTION_SETTINGS_NAMESPACE, order: 25, locale: NS, inject: face,
  }, AttentionRow))
}
