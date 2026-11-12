// @vitest-environment jsdom
/** The switch reflects accepted state, permission outcomes, and read-only settings. */
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { ComponentProps } from 'react'
import { AttentionRow } from '../src/client/AttentionRow.tsx'
import type { AttentionState } from '../src/client/preference.ts'
import type { AttentionSettings } from '../src/notification-settings.ts'
import { en, zh } from '../src/client/locales.ts'

afterEach(cleanup)

function fixture(options: {
  enabled?: boolean
  writable?: boolean
  status?: 'ready' | 'loading' | 'unavailable'
  mutation?: Partial<AttentionState>
} = {}) {
  const settings = createSnapshotStore<ConfigFormSnapshot<AttentionSettings>>({
    status: options.status ?? 'ready',
    value: { enabled: options.enabled ?? false },
    base: {},
    user: {},
    revision: 0,
    writable: options.writable ?? true,
  })
  const mutation = createSnapshotStore<AttentionState>({
    busy: options.mutation?.busy ?? false,
    notice: options.mutation?.notice ?? null,
    permission: options.mutation?.permission ?? 'granted',
  })
  const setEnabled = vi.fn(async (_enabled: boolean) => {})
  const props = {
    useAttention: bindSnapshotSelector(settings),
    useMutation: bindSnapshotSelector(mutation),
    setEnabled,
    t: (key: keyof typeof en) => en[key],
  } as ComponentProps<typeof AttentionRow>
  return { mutation, setEnabled, props }
}

it('asks for the change the user picks', () => {
  const f = fixture()
  render(<AttentionRow {...f.props} />)
  fireEvent.click(screen.getByRole('switch', { name: en['row.title'] }))
  expect(f.setEnabled).toHaveBeenCalledExactlyOnceWith(true)
})

it('shows the accepted value', () => {
  render(<AttentionRow {...fixture({ enabled: true }).props} />)
  expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true')
})

it('explains a refused permission', () => {
  render(<AttentionRow {...fixture({ mutation: { notice: 'denied', permission: 'denied' } }).props} />)
  expect(screen.getByRole('alert').textContent).toBe(en['row.denied'])
})

it('explains a failed write', () => {
  render(<AttentionRow {...fixture({ mutation: { notice: 'failed' } }).props} />)
  expect(screen.getByRole('alert').textContent).toBe(en['row.failed'])
})

it('disables the switch in a browser without notification support', () => {
  render(<AttentionRow {...fixture({ mutation: { permission: 'unsupported' } }).props} />)
  expect(screen.getByRole('alert').textContent).toBe(en['row.unsupported'])
  expect(screen.getByRole('switch').hasAttribute('disabled')).toBe(true)
})

it('asks this browser for permission while notifications are enabled elsewhere', () => {
  render(<AttentionRow {...fixture({ enabled: true, mutation: { permission: 'default' } }).props} />)
  expect(screen.getByRole('alert').textContent).toBe(en['row.permission'])
  expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true')
})

it.each([
  { status: 'loading' as const, writable: true },
  { status: 'ready' as const, writable: false },
])('refuses input while the accepted value is not writable', (options) => {
  render(<AttentionRow {...fixture(options).props} />)
  expect(screen.getByRole('switch').hasAttribute('disabled')).toBe(true)
})

it('renders the Chinese row', async () => {
  const translated: Record<string, string> = zh
  const { container } = render(
    <AttentionRow {...fixture({ mutation: { busy: true } }).props} t={key => translated[key] ?? key} />,
  )
  await expect(container.textContent + '\n').toMatchFileSnapshot('./expected/attention-row.zh.txt')
})
