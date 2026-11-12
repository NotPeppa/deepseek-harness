// @vitest-environment jsdom
/** The browser platform reports availability, shows, and focuses on click. */
import { afterEach, expect, it, vi } from 'vitest'
import { browserAttentionPlatform } from '../src/client/platform.ts'

const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState')

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  if (originalVisibility === undefined) Reflect.deleteProperty(document, 'visibilityState')
  else Object.defineProperty(document, 'visibilityState', originalVisibility)
})

function hideDocument(): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
}

it('reports an unsupported browser when Notification is absent', async () => {
  vi.stubGlobal('Notification', undefined)
  const platform = browserAttentionPlatform()
  expect(platform.permission()).toBe('unsupported')
  await expect(platform.requestPermission()).resolves.toBe('unsupported')
  expect(() => { platform.show({ title: 't', body: 'b' }, () => {}) }).not.toThrow()
})

it('passes permission queries through to the browser', async () => {
  class StubNotification {
    static permission: NotificationPermission = 'granted'
    static requestPermission = async (): Promise<NotificationPermission> => 'granted'
    onclick: (() => void) | null = null
    close = (): void => {}
  }
  vi.stubGlobal('Notification', StubNotification)
  const platform = browserAttentionPlatform()
  expect(platform.permission()).toBe('granted')
  await expect(platform.requestPermission()).resolves.toBe('granted')
})

it('shows a notification and opens the Session when the user clicks it', () => {
  const created: {
    title: string
    options?: NotificationOptions | undefined
    onclick: (() => void) | null
    close: () => void
  }[] = []
  class StubNotification {
    static permission: NotificationPermission = 'granted'
    static requestPermission = async (): Promise<NotificationPermission> => 'granted'
    onclick: (() => void) | null = null
    close = vi.fn()
    constructor(public title: string, public options?: NotificationOptions) {
      created.push(this)
    }
  }
  vi.stubGlobal('Notification', StubNotification)
  const focus = vi.spyOn(window, 'focus').mockImplementation(() => {})
  const opened = vi.fn()
  const platform = browserAttentionPlatform()
  platform.show({ title: 'Approval needed', body: 'Session: work' }, opened)
  expect(created).toHaveLength(1)
  expect(created[0]!.title).toBe('Approval needed')
  expect(created[0]!.options).toEqual({ body: 'Session: work' })
  created[0]!.onclick?.()
  expect(created[0]!.close).toHaveBeenCalledOnce()
  expect(focus).toHaveBeenCalledOnce()
  expect(opened).toHaveBeenCalledOnce()
})

it('reports the document visibility and observes changes', () => {
  hideDocument()
  const platform = browserAttentionPlatform()
  expect(platform.hidden()).toBe(true)
  const listener = vi.fn()
  const stop = platform.onVisibilityChange(listener)
  document.dispatchEvent(new Event('visibilitychange'))
  expect(listener).toHaveBeenCalledOnce()
  stop()
  document.dispatchEvent(new Event('visibilitychange'))
  expect(listener).toHaveBeenCalledOnce()
})

it('contains a browser that refuses to construct the notification', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  class RefusingNotification {
    static permission: NotificationPermission = 'granted'
    static requestPermission = async (): Promise<NotificationPermission> => 'granted'
    constructor() { throw new Error('blocked') }
  }
  vi.stubGlobal('Notification', RefusingNotification)
  const platform = browserAttentionPlatform()
  expect(() => { platform.show({ title: 't', body: 'b' }, () => {}) }).not.toThrow()
  expect(warn).toHaveBeenCalledWith('[ui-attention] notification unavailable:', expect.any(Error))
})
