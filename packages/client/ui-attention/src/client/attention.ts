/** Best-effort browser attention for Session interactions awaiting an answer. */
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionPendingInteractionBase, SessionStatusSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'
import type { AttentionKey } from './locales.ts'

/** Notification permission as the browser reports it, including absent support. */
export type AttentionPermission = 'granted' | 'denied' | 'default' | 'unsupported'

/** One notification shown on behalf of a pending interaction. */
export interface AttentionMessage {
  /** Heading resolving the interaction domain. */
  readonly title: string
  /** Session or recovery context under the heading. */
  readonly body: string
}

/** Browser surface the notifier drives; tests supply a deterministic stand-in. */
export interface AttentionPlatform {
  /** @returns whether the page is currently hidden from the user. */
  readonly hidden: () => boolean
  /** @returns the browser's current notification permission. */
  readonly permission: () => AttentionPermission
  /**
   * Ask the browser for notification permission, ideally from a user gesture.
   * @returns the permission the browser settled on.
   */
  readonly requestPermission: () => Promise<AttentionPermission>
  /**
   * Show one notification.
   * @param message - localized copy.
   * @param onClick - runs when the user activates the notification.
   */
  readonly show: (message: AttentionMessage, onClick: () => void) => void
  /**
   * Observe page visibility changes.
   * @param listener - called after each change.
   * @returns disposer stopping the observation.
   */
  readonly onVisibilityChange: (listener: () => void) => () => void
}

/** Domains whose notification heading differs from the generic one. */
const NOTICE_KEYS: Readonly<Record<string, AttentionKey>> = {
  approval: 'notice.approval',
  question: 'notice.question',
  'plan-review': 'notice.planReview',
}

/**
 * Map a pending-interaction domain to its notification heading key.
 * @param kind - domain discriminator of the pending interaction.
 * @returns the localized heading key for that domain.
 */
export function noticeKey(kind: string): AttentionKey {
  return NOTICE_KEYS[kind] ?? 'notice.generic'
}

/** Everything the notifier needs from its apply site. */
export interface PendingAttentionOptions {
  /** Browser surface the notifications go through. */
  readonly platform: AttentionPlatform
  /** @returns whether the accepted Host preference enables notifications. */
  readonly enabled: () => boolean
  /**
   * Resolve one interaction's localized notification copy.
   * @param input - Session and domain identity.
   * @returns the heading and body to show.
   */
  readonly describe: (input: { sessionId: SessionId; kind: string }) => AttentionMessage
  /**
   * Bring the user back to the Session that owns the interaction.
   * @param sessionId - Session to reveal.
   */
  readonly open: (sessionId: SessionId) => void
}

/**
 * Raise one browser notification per pending interaction while the page is
 * hidden. An interaction is announced at most once: it is announced when it
 * appears hidden, or when the page becomes hidden while it still waits.
 */
export class PendingAttention {
  private pending: ReadonlyMap<SessionId, SessionPendingInteractionBase> = new Map()
  private readonly notified = new Set<string>()
  private readonly stop: () => void

  /** @param options - preference, copy, navigation, and browser surface. */
  constructor(private readonly options: PendingAttentionOptions) {
    this.stop = options.platform.onVisibilityChange(() => { this.announce() })
  }

  /**
   * Adopt the latest status snapshot and announce interactions the user has not seen.
   * @param snapshot - every Session's independent UI status facts.
   */
  publish(snapshot: SessionStatusSnapshot): void {
    const next = new Map<SessionId, SessionPendingInteractionBase>()
    for (const [sessionId, status] of snapshot) {
      if (status.pendingInteraction !== undefined) next.set(sessionId, status.pendingInteraction)
    }
    this.pending = next
    const live = new Set([...next.values()].map(interaction => interaction.key))
    for (const key of this.notified) {
      if (!live.has(key)) this.notified.delete(key)
    }
    this.announce()
  }

  /** Release the visibility observation and every remembered identity. */
  dispose(): void {
    this.stop()
    this.pending = new Map()
    this.notified.clear()
  }

  private announce(): void {
    if (!this.options.enabled()) return
    if (!this.options.platform.hidden()) return
    if (this.options.platform.permission() !== 'granted') return
    for (const [sessionId, interaction] of this.pending) {
      if (this.notified.has(interaction.key)) continue
      this.notified.add(interaction.key)
      this.options.platform.show(this.options.describe({ sessionId, kind: interaction.kind }), () => {
        this.options.open(sessionId)
      })
    }
  }
}
