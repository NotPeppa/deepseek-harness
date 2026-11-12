/** Pending interactions raise one notification each while the page is hidden. */
import { describe, expect, it, vi } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionStatus, SessionStatusSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'
import { PendingAttention, noticeKey, type AttentionMessage, type AttentionPlatform } from '../src/client/attention.ts'
import { en } from '../src/client/locales.ts'

interface Pending {
  key: string
  kind: string
}

function snapshot(rows: Record<string, Pending | undefined>): SessionStatusSnapshot {
  const map = new Map<SessionId, SessionStatus>()
  for (const [id, pending] of Object.entries(rows)) {
    const sessionId = SessionId(id)
    map.set(sessionId, {
      running: false,
      pendingInteraction: pending === undefined ? undefined : { ...pending, sessionId } as never,
      completionUnread: false,
    })
  }
  return map
}

function fixture(options: { enabled?: boolean; permission?: 'granted' | 'denied' } = {}) {
  let hidden = false
  let listener: (() => void) | undefined
  const show = vi.fn<(message: AttentionMessage, onClick: () => void) => void>()
  const open = vi.fn()
  const platform: AttentionPlatform = {
    hidden: () => hidden,
    permission: () => options.permission ?? 'granted',
    requestPermission: async () => options.permission ?? 'granted',
    show,
    onVisibilityChange: (next) => {
      listener = next
      return () => { listener = undefined }
    },
  }
  const attention = new PendingAttention({
    platform,
    enabled: () => options.enabled ?? true,
    describe: ({ sessionId, kind }) => ({ title: `${kind}:${sessionId}`, body: 'body' }),
    open,
  })
  return {
    attention,
    show,
    open,
    hide: () => { hidden = true },
    reveal: () => { hidden = false },
    fireVisibility: () => { listener?.() },
    observing: () => listener !== undefined,
  }
}

describe('noticeKey', () => {
  it('names every domain heading and falls back to the generic one', () => {
    expect(noticeKey('approval')).toBe('notice.approval')
    expect(noticeKey('question')).toBe('notice.question')
    expect(noticeKey('plan-review')).toBe('notice.planReview')
    expect(noticeKey('background-task')).toBe('notice.generic')
  })
})

describe('PendingAttention', () => {
  it('announces a hidden interaction once and opens its Session on click', () => {
    const f = fixture()
    f.hide()
    f.attention.publish(snapshot({ s1: { key: 'a1', kind: 'approval' } }))
    f.attention.publish(snapshot({ s1: { key: 'a1', kind: 'approval' } }))
    expect(f.show).toHaveBeenCalledExactlyOnceWith({ title: 'approval:s1', body: 'body' }, expect.any(Function))
    const onClick = f.show.mock.calls[0]![1]
    onClick()
    expect(f.open).toHaveBeenCalledExactlyOnceWith(SessionId('s1'))
  })

  it('stays silent while visible and announces once the page hides', () => {
    const f = fixture()
    f.attention.publish(snapshot({ s1: { key: 'a1', kind: 'question' } }))
    expect(f.show).not.toHaveBeenCalled()
    f.hide()
    f.fireVisibility()
    expect(f.show).toHaveBeenCalledTimes(1)
  })

  it('respects the preference and the browser permission', () => {
    const disabled = fixture({ enabled: false })
    disabled.hide()
    disabled.attention.publish(snapshot({ s1: { key: 'a1', kind: 'approval' } }))
    expect(disabled.show).not.toHaveBeenCalled()

    const denied = fixture({ permission: 'denied' })
    denied.hide()
    denied.attention.publish(snapshot({ s1: { key: 'a1', kind: 'approval' } }))
    expect(denied.show).not.toHaveBeenCalled()
  })

  it('re-announces a replaced request and forgets the answered one', () => {
    const f = fixture()
    f.hide()
    f.attention.publish(snapshot({ s1: { key: 'a1', kind: 'approval' } }))
    f.attention.publish(snapshot({ s1: undefined }))
    f.attention.publish(snapshot({ s1: { key: 'a2', kind: 'approval' } }))
    expect(f.show).toHaveBeenCalledTimes(2)
  })

  it('stops observing and forgets everything after disposal', () => {
    const f = fixture()
    f.hide()
    f.attention.publish(snapshot({ s1: { key: 'a1', kind: 'approval' } }))
    f.attention.dispose()
    expect(f.observing()).toBe(false)
    f.fireVisibility()
    expect(f.show).toHaveBeenCalledTimes(1)
  })

  it('keeps Sessions without a pending interaction silent', () => {
    const f = fixture()
    f.hide()
    f.attention.publish(snapshot({ s1: undefined, s2: { key: 'q1', kind: 'question' } }))
    expect(f.show).toHaveBeenCalledExactlyOnceWith(
      { title: `question:${SessionId('s2')}`, body: 'body' },
      expect.any(Function),
    )
  })
})

it('uses the English dictionary for its headings', () => {
  expect(en['notice.approval']).toBe('Approval needed')
})
