/**
 * The TinyFish card's staged form over the `web-search-tinyfish` settings
 * namespace, plus the one switch that decides whether the web seam searches
 * through it.
 *
 * Two values on this card do not live in its own section: the key, whose
 * literal never rides a response and is written through the credentials
 * domain, and the selection, which belongs to the `web` seam's namespace. Both
 * are staged with the rest of the form, so one save covers everything the card
 * shows.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the ctx.remote merge into this program.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  CardForm, textField,
  type CardActions, type CardFieldState, type CardShell,
} from './card-form.ts'

/**
 * Namespace of the TinyFish search provider. Spelled here rather than
 * imported: a client package must not depend on a Host package.
 */
export const TINYFISH_NS = 'web-search-tinyfish'

/** Namespace of the web seam, which owns provider selection. */
export const WEB_NS = 'web'

/** Provider id the web seam selects when this card's switch is on. */
const TINYFISH_PROVIDER_ID = 'tinyfish'

/** Credential reference the provider resolves when the section names none. */
const DEFAULT_API_KEY_REF = 'TINYFISH_API_KEY'

/** Form field the credential control stages under. */
const API_KEY_FIELD = 'apiKey'

/** Form field the selection switch stages under. */
const USE_FOR_SEARCH_FIELD = 'useForSearch'

/** Staged text of the switch; both states are non-blank so both reach a write. */
const SWITCH_ON = 'on'
const SWITCH_OFF = 'off'

/** The TinyFish fields this card edits. */
export interface TinyFishSettings {
  /** Credential reference naming the environment key. */
  apiKeyEnv?: string
  /** Provider endpoint; blank inherits the provider default. */
  baseURL?: string
}

/** The web-seam fields this card's switch writes. */
export interface WebSelectionSettings {
  /** Search provider id the seam resolves at each search. */
  searchProvider?: string
}

/** What the credentials domain last reported, and for which reference. */
interface CredentialState {
  /** Reference this answer describes; a stale response for another one is dropped. */
  ref: string
  /** Whether any layer supplies a value for it. */
  configured: boolean
  /** Whether `credentials/set` can affect it; false disables the control. */
  writable: boolean
}

/** What the TinyFish card renders. */
export interface TinyFishCardState extends CardShell {
  /** Provider endpoint. */
  baseURL: CardFieldState
  /** The staged credential, which starts blank on every load. */
  apiKey: CardFieldState
  /** Whether the Host reports a credential configured for the referenced key. */
  apiKeyConfigured: boolean
  /** Whether the credentials domain accepts a write for it; false disables the control. */
  apiKeyWritable: boolean
  /** Whether saving would leave TinyFish selected as the search provider. */
  useForSearch: boolean
  /** False while the web seam does not serve its namespace, which disables the switch. */
  selectionAvailable: boolean
}

/** The registration-side face the TinyFish card's slot entry injects. */
export interface TinyFishCardFace extends CardActions {
  hooks: {
    /** Card snapshot bound by the renderer as useTinyFishCard. */
    tinyFishCard: SnapshotStore<TinyFishCardState>
  }
}

/** Bridges the TinyFish scope, the web seam's scope, and the credentials domain onto the card. */
export class TinyFishCardController {
  private readonly form: CardForm<TinyFishSettings>
  private readonly store: SnapshotStore<TinyFishCardState>
  private credential: CredentialState = { ref: '', configured: false, writable: true }

  /**
   * @param scope - the bound settings scope for the `web-search-tinyfish` namespace.
   * @param web - the bound settings scope for the `web` namespace, which owns selection.
   * @param ctx - the card plugin's context, whose `remote.credentials` namespace
   *   answers for the credential the section references.
   */
  constructor(
    private readonly scope: SettingsScope<TinyFishSettings>,
    private readonly web: SettingsScope<WebSelectionSettings>,
    private readonly ctx: ClientContext,
  ) {
    this.form = new CardForm(
      scope,
      [textField('baseURL')],
      [
        { field: API_KEY_FIELD, write: text => this.writeKey(text) },
        { field: USE_FOR_SEARCH_FIELD, write: text => this.writeSelection(text) },
      ],
    )
    this.store = this.form.bind(() => this.projection())
    scope.subscribe(() => { void this.readCredential() })
    // The switch renders the seam's current selection, so a change made
    // elsewhere — another surface, another client — must repaint this card.
    web.subscribe(() => { this.store.set(this.projection()) })
    void this.readCredential()
  }

  private projection(): TinyFishCardState {
    const staged = this.form.field(USE_FOR_SEARCH_FIELD).text
    const webSnapshot = this.web.getSnapshot()
    return {
      ...this.form.shell(),
      baseURL: this.form.field('baseURL'),
      apiKey: this.form.field(API_KEY_FIELD),
      apiKeyConfigured: this.credential.configured,
      apiKeyWritable: this.credential.writable,
      // A staged toggle answers for itself; with none staged the seam does.
      useForSearch: staged === '' ? selectsTinyFish(webSnapshot) : staged === SWITCH_ON,
      selectionAvailable: webSnapshot.status === 'ready' && webSnapshot.writable,
    }
  }

  /**
   * Ask the credentials domain about the reference the section currently names.
   *
   * The answer is stored with the reference it describes: `apiKeyEnv` can
   * change between the request and its response, and two reads can settle out
   * of order, so a response is published only while it still answers for the
   * reference in force.
   */
  private async readCredential(): Promise<void> {
    const ref = refOf(this.scope.getSnapshot())
    if (ref !== this.credential.ref) {
      // A new reference knows nothing yet; keeping the old answer would claim
      // the key is configured under a name nobody has checked.
      this.credential = { ref, configured: false, writable: true }
      this.store.set(this.projection())
    }
    const response = await this.ctx.remote.credentials.describe([ref])
    if (!response.ok || ref !== refOf(this.scope.getSnapshot())) return
    const view = response.value[ref]
    const next: CredentialState = {
      ref,
      configured: view?.configured ?? false,
      // An unknown reference is treated as writable: the control stays usable
      // and the Host is what refuses, rather than the card guessing a refusal.
      writable: view?.writable ?? true,
    }
    if (next.configured === this.credential.configured && next.writable === this.credential.writable) return
    this.credential = next
    this.store.set(this.projection())
  }

  /**
   * Re-read after the Host reports a change to the reference this card watches.
   * @param ref - the reference the Host reports as changed.
   */
  refreshCredential(ref: string): void {
    if (ref !== this.credential.ref) return
    void this.readCredential()
  }

  /**
   * Build the face the card's slot registration injects.
   * @returns the card's snapshot and its form actions.
   */
  inject(): TinyFishCardFace {
    return { hooks: { tinyFishCard: this.store }, ...this.form.actions() }
  }

  /**
   * Write the staged key, then re-read whether the Host now holds one.
   * @param value - the staged credential literal.
   * @returns whether the Host reports a configured credential afterwards.
   */
  private async writeKey(value: string): Promise<boolean> {
    // Refusals surface through the re-read below: the Host is the only
    // authority on whether the key now exists.
    await this.ctx.remote.credentials.set(refOf(this.scope.getSnapshot()), value)
    await this.readCredential()
    return this.credential.configured
  }

  /**
   * Point the web seam at TinyFish, or release it.
   *
   * Switching off clears the field rather than naming another provider: the
   * seam then re-inherits whatever backend the deployment composed, which is
   * not this card's to know.
   * @param text - the staged switch state.
   * @returns whether the seam's selection matches the staged state afterwards.
   */
  private async writeSelection(text: string): Promise<boolean> {
    const on = text === SWITCH_ON
    if (on) await this.web.set('searchProvider', TINYFISH_PROVIDER_ID)
    else await this.web.unset('searchProvider')
    return selectsTinyFish(this.web.getSnapshot()) === on
  }
}

/**
 * The credential reference the section names, or the provider's default.
 * @param snapshot - the current scope snapshot.
 * @returns the reference to address.
 */
function refOf(snapshot: SettingsScopeSnapshot<TinyFishSettings>): string {
  const declared = snapshot.value?.apiKeyEnv
  return declared !== undefined && declared.length > 0 ? declared : DEFAULT_API_KEY_REF
}

/**
 * Whether the web seam currently searches through TinyFish.
 * @param snapshot - the `web` namespace snapshot.
 * @returns true when its resolved selection names this provider.
 */
function selectsTinyFish(snapshot: SettingsScopeSnapshot<WebSelectionSettings>): boolean {
  return snapshot.value?.searchProvider === TINYFISH_PROVIDER_ID
}

/** Staged text for a switch position, so the card and the form agree on both states. */
export function switchText(on: boolean): string {
  return on ? SWITCH_ON : SWITCH_OFF
}
