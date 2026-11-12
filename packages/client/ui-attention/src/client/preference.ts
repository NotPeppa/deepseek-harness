/** Accepted enablement plus the browser permission that makes it effective. */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { AttentionPermission, AttentionPlatform } from './attention.ts'
import type { AttentionSettings } from '../notification-settings.ts'

/** Row-visible outcome of the last attempt to change the preference. */
export interface AttentionState {
  /** Whether a permission request or preference write is in flight. */
  busy: boolean
  /** Last failed attempt, or null when nothing needs reporting. */
  notice: 'denied' | 'unsupported' | 'failed' | null
  /** Browser permission observed at construction or after the last request. */
  permission: AttentionPermission
}

/** Permission request and ordered preference write behind the Settings row. */
export class AttentionPreference {
  /** Observable row state. */
  readonly state = createSnapshotStore<AttentionState>({
    busy: false, notice: null, permission: 'default',
  })

  /**
   * @param form - Host-owned configuration form.
   * @param platform - browser notification surface the permission request uses.
   */
  constructor(private readonly form: ConfigForm<AttentionSettings>, private readonly platform: AttentionPlatform) {
    this.state.set({ busy: false, notice: null, permission: platform.permission() })
  }

  /**
   * Request permission when enabling, then persist the accepted choice.
   * @param enabled - requested notification state.
   * @returns completion after the permission request and Host write settle.
   */
  async setEnabled(enabled: boolean): Promise<void> {
    if (this.state.getSnapshot().busy) return
    this.state.set({ ...this.state.getSnapshot(), busy: true, notice: null })
    const permission = enabled ? await this.platform.requestPermission() : this.state.getSnapshot().permission
    if (enabled && permission !== 'granted') {
      this.state.set({ busy: false, notice: permission === 'unsupported' ? 'unsupported' : 'denied', permission })
      return
    }
    let accepted = false
    try {
      accepted = await this.form.set('enabled', enabled)
    } catch (error) {
      // A refused transport is reported like a refused write: the accepted value stays visible.
      console.warn('[ui-attention] preference write failed:', error)
    }
    this.state.set({ busy: false, notice: accepted ? null : 'failed', permission })
  }
}
