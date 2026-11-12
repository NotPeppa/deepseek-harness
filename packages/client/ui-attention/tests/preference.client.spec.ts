/** Permission and Host write outcomes drive the Settings row state. */
import { expect, it, vi } from 'vitest'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ConfigForm, ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import { AttentionPreference } from '../src/client/preference.ts'
import type { AttentionPermission, AttentionPlatform } from '../src/client/attention.ts'
import type { AttentionSettings } from '../src/notification-settings.ts'

function fixture(options: {
  permission?: AttentionPermission
  set?: (field: string, value: unknown) => Promise<boolean>
} = {}) {
  const settings = createSnapshotStore<ConfigFormSnapshot<AttentionSettings>>({
    status: 'ready', value: { enabled: false }, base: {}, user: {}, revision: 0, writable: true,
  })
  const set = vi.fn(options.set ?? (async (_field: string, _value: unknown) => true))
  const form: ConfigForm<AttentionSettings> = {
    getSnapshot: () => settings.getSnapshot(),
    subscribe: listener => settings.subscribe(listener),
    set,
    unset: vi.fn(),
    mutate: vi.fn(),
  }
  let permission: AttentionPermission = options.permission ?? 'default'
  const requestPermission = vi.fn(async (): Promise<AttentionPermission> => permission)
  const platform: AttentionPlatform = {
    hidden: () => true,
    permission: () => permission,
    requestPermission,
    show: () => {},
    onVisibilityChange: () => () => {},
  }
  return {
    preference: new AttentionPreference(form, platform),
    set,
    requestPermission,
    grant: (next: AttentionPermission) => { permission = next },
  }
}

it('starts from the permission the browser already reported', () => {
  expect(fixture({ permission: 'denied' }).preference.state.getSnapshot()).toEqual({
    busy: false, notice: null, permission: 'denied',
  })
})

it('asks for permission before saving an enabled choice', async () => {
  const f = fixture()
  f.grant('granted')
  await f.preference.setEnabled(true)
  expect(f.requestPermission).toHaveBeenCalledOnce()
  expect(f.set).toHaveBeenCalledExactlyOnceWith('enabled', true)
  expect(f.preference.state.getSnapshot()).toEqual({ busy: false, notice: null, permission: 'granted' })
})

it('reports a refused permission without writing the preference', async () => {
  const f = fixture()
  f.grant('denied')
  await f.preference.setEnabled(true)
  expect(f.set).not.toHaveBeenCalled()
  expect(f.preference.state.getSnapshot()).toEqual({ busy: false, notice: 'denied', permission: 'denied' })
})

it('reports a browser without notification support', async () => {
  const f = fixture()
  f.grant('unsupported')
  await f.preference.setEnabled(true)
  expect(f.set).not.toHaveBeenCalled()
  expect(f.preference.state.getSnapshot()).toEqual({ busy: false, notice: 'unsupported', permission: 'unsupported' })
})

it('disables without asking for permission', async () => {
  const f = fixture({ permission: 'granted' })
  await f.preference.setEnabled(false)
  expect(f.requestPermission).not.toHaveBeenCalled()
  expect(f.set).toHaveBeenCalledExactlyOnceWith('enabled', false)
  expect(f.preference.state.getSnapshot()).toEqual({ busy: false, notice: null, permission: 'granted' })
})

it.each(['refused', 'rejected'] as const)('reports a %s Host write', async (failure) => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const f = fixture({
    permission: 'granted',
    set: failure === 'refused'
      ? async () => false
      : async () => { throw new Error('Disconnected') },
  })
  await f.preference.setEnabled(true)
  expect(f.preference.state.getSnapshot().notice).toBe('failed')
  expect(f.preference.state.getSnapshot().busy).toBe(false)
  if (failure === 'rejected') expect(warn).toHaveBeenCalledOnce()
})

it('ignores a second request while the first is in flight', async () => {
  const pending = Promise.withResolvers<boolean>()
  const f = fixture({ permission: 'granted', set: () => pending.promise })
  const first = f.preference.setEnabled(true)
  await f.preference.setEnabled(true)
  expect(f.set).toHaveBeenCalledOnce()
  pending.resolve(true)
  await first
  expect(f.preference.state.getSnapshot().notice).toBeNull()
})
