// @vitest-environment jsdom
/** The composed plugin registers its row and notifies over the real settings forms. */
import { Context } from '@deepseek-ai/cordis'
import { afterEach, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { TestRemote } from '@deepseek-ai/dsh-client-test-runtime'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { apply as settingsApply, inject as settingsInject } from '@deepseek-ai/dsh-client-ui-settings/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SessionStatus, SessionStatusSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { apply, inject } from '../src/client/index.ts'
import { createAttentionFace } from '../src/client/face.ts'
import { AttentionPreference } from '../src/client/preference.ts'
import type { AttentionPlatform } from '../src/client/attention.ts'
import { ATTENTION_SETTINGS_NAMESPACE, AttentionSettingsSchema, type AttentionSettings } from '../src/notification-settings.ts'

const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState')

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  if (originalVisibility === undefined) Reflect.deleteProperty(document, 'visibilityState')
  else Object.defineProperty(document, 'visibilityState', originalVisibility)
})

interface Shown {
  title: string
  options?: NotificationOptions | undefined
  onclick: (() => void) | null
  close: () => void
}

function pendingStatus(sessionId: SessionId, kind: string, key: string): SessionStatus {
  return { running: false, pendingInteraction: { key, kind, sessionId } as never, completionUnread: false }
}

it('registers the Settings row and notifies for a hidden pending approval', async () => {
  const shown: Shown[] = []
  class StubNotification {
    static permission: NotificationPermission = 'granted'
    static requestPermission = async (): Promise<NotificationPermission> => 'granted'
    onclick: (() => void) | null = null
    close = vi.fn()
    constructor(public title: string, public options?: NotificationOptions) {
      shown.push(this)
    }
  }
  vi.stubGlobal('Notification', StubNotification)
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
  const focus = vi.spyOn(window, 'focus').mockImplementation(() => {})

  const sessionId = SessionId('session-1')
  const status = createSnapshotStore<SessionStatusSnapshot>(new Map())
  const openSession = vi.fn()
  const ctx = new Context()
  try {
    await ctx.plugin(SlotRegistry)
    ctx.provide('locale', new LocaleRuntime(ctx))
    const describe = vi.fn(async () => ({
      ok: true as const,
      value: {
        writable: true,
        hasDocument: false,
        namespaces: [{
          ns: ATTENTION_SETTINGS_NAMESPACE,
          schema: AttentionSettingsSchema.toJSON(),
          value: { enabled: true },
          revision: 1,
          applies: 'live' as const,
          secrets: [] as never[],
        }],
      },
    }))
    new TestRemote(ctx, {
      settings: {
        describe,
        mutate: vi.fn(async () => ({ ok: true as const, value: { revision: 2 } })),
      },
    })
    await ctx.plugin({ inject: [...settingsInject], apply: settingsApply }).await()
    const slots = ctx.get('slots') as SlotRegistry
    slots.register({ name: 'root', children: {
      'settings.general.item': { kind: 'list', scope: 'root' },
    } } as never, () => null)
    ctx.provide('sessions', { list: { getSnapshot: () => ({ byId: { [sessionId]: { displayTitle: 'Work' } } }) } } as never)
    ctx.provide('uiSession', {
      sessionStatus: {
        getSnapshot: () => status.getSnapshot(),
        subscribe: (listener: () => void) => status.subscribe(listener),
      },
    } as never)
    ctx.provide('uiWorkspace', { openSession } as never)
    const fiber = ctx.plugin({ inject, apply })
    await fiber.await()
    await ctx.configForms.describe().ensure()
    await vi.waitFor(() => {
      expect(slots.entries('settings.general.item').map(entry => entry.options.id)).toEqual([ATTENTION_SETTINGS_NAMESPACE])
    })
    expect(slots.entries('settings.general.item')[0]!.options).toMatchObject({ order: 25 })

    const form = ctx.configForms.get<AttentionSettings>(ATTENTION_SETTINGS_NAMESPACE)
    const platform: AttentionPlatform = {
      hidden: () => true,
      permission: () => 'granted',
      requestPermission: async () => 'granted',
      show: () => {},
      onVisibilityChange: () => () => {},
    }
    const face = createAttentionFace(form, new AttentionPreference(form, platform))
    expect(face.hooks.attention).toBe(form)
    await face.setEnabled(false)
    const injected = slots.entries('settings.general.item')[0]!.inject!()
    expect(typeof injected['setEnabled']).toBe('function')

    const first = new Map<SessionId, SessionStatus>([[sessionId, pendingStatus(sessionId, 'approval', 'a1')]])
    status.set(first)
    expect(shown).toHaveLength(1)
    expect(shown[0]!.title).toBe('Approval needed')
    expect(shown[0]!.options).toEqual({ body: 'Session: Work' })
    shown[0]!.onclick?.()
    expect(focus).toHaveBeenCalled()
    expect(openSession).toHaveBeenCalledExactlyOnceWith(sessionId)

    const unknown = SessionId('session-2')
    status.set(new Map<SessionId, SessionStatus>([
      [sessionId, first.get(sessionId)!],
      [unknown, pendingStatus(unknown, 'question', 'q1')],
    ]))
    expect(shown).toHaveLength(2)
    expect(shown[1]!.title).toBe('Waiting for your answer')
    expect(shown[1]!.options).toEqual({ body: 'Click to return to DeepSeek Harness' })

    status.set(new Map())
    await fiber.dispose()
    expect(slots.entries('settings.general.item')).toHaveLength(0)
  } finally {
    await ctx.fiber.dispose()
  }
})
