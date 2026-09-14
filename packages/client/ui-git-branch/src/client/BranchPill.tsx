/**
 * Branch chip for the blank-session hero: shows the checked-out branch of the
 * chosen workspace and opens a searchable list to switch it.
 *
 * The displayed branch follows the Host's last report, never the click echo —
 * a switch git refuses must leave the pill on the branch the checkout is still
 * on, with git's own sentence explaining why.
 */
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { IconBranchOutline16, IconChevronDownOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { createBranchStore } from './store.ts'
import css from './BranchPill.module.css'

/** The store share, named once for both seats. */
type BranchStoreProps = PropsStore<ReturnType<typeof createBranchStore>>

/** Injected business face: the switch and the refresh (t rides the locale seat). */
export interface BranchPillInjected {
  /** Check out an existing local branch in the active workspace. */
  switchBranch: (branch: string) => void
  /** Check out a remote-tracking branch, creating the local branch that tracks it. */
  checkoutRemote: (remoteRef: string) => void
  /** Create a branch at the current HEAD and check it out. */
  createBranch: (name: string) => void
  /** Re-read the checkout state (chip mount and popover open). */
  refresh: () => void
}

/**
 * What the chip itself renders from: the store, the locale seat, and the
 * business face — free of any runtime share, so the view stays independent of
 * the seat it is mounted in.
 */
export type BranchPillViewProps = BranchStoreProps & PropsLocale<'git'> & BranchPillInjected

/** Hero seat business face: the pill's own, plus the workspace hand-off. */
export interface BranchPillHeroInjected extends BranchPillInjected {
  /**
   * Adopt the workspace the Hero owner names. The blank screen has no session
   * pointing at it, so the owner share is the only place this workspace exists.
   */
  adoptWorkspace: (workspaceId?: string) => void
}

/** Dock seat props: the view's share plus the input dock's runtime share. */
export type BranchPillDockProps =
  PropsRuntime<'conversation.input.dock'> & BranchStoreProps & PropsLocale<'git'> & BranchPillInjected

/**
 * Dock seat: the same chip inside a running conversation, so the branch the
 * work lands on stays visible. Renders nothing while the Hero is showing — the
 * dock renders in that phase too (a blank session is still a session), and the
 * Hero already seats this chip, so without this the chip appeared twice.
 * @param props - dock runtime share plus the chip's own share.
 * @returns the branch chip, or nothing during the Hero phase.
 */
export function DockBranchPill(props: BranchPillDockProps) {
  if (props.hero) return null
  return <BranchPill {...props} />
}

/** Hero seat props: the view's share plus the hero context runtime share. */
export type BranchPillHeroProps =
  PropsRuntime<'conversation.hero.context'> & BranchStoreProps & PropsLocale<'git'> & BranchPillHeroInjected

/**
 * Hero seat: hand the owner's workspace to the plugin, then render the pill.
 * The hand-off runs as an effect rather than during render, so a workspace the
 * user just picked triggers one read after the commit instead of a write while
 * React is rendering.
 * @param props - hero runtime share plus the pill's own share.
 * @returns the branch pill.
 */
export function HeroBranchPill(props: BranchPillHeroProps) {
  const { adoptWorkspace, workspaceId } = props
  useEffect(() => { adoptWorkspace(workspaceId) }, [adoptWorkspace, workspaceId])
  return <BranchPill {...props} />
}

/**
 * Render the branch pill and its popover.
 * @param props - composed slot props.
 * @returns the pill, or nothing when the workspace is not a git repository.
 */
export function BranchPill({
  t, useStore, switchBranch, checkoutRemote, createBranch, refresh,
}: BranchPillViewProps) {
  const repository = useStore(s => s.repository)
  const current = useStore(s => s.current)
  const branches = useStore(s => s.branches)
  const remoteBranches = useStore(s => s.remoteBranches)
  const busy = useStore(s => s.busy)
  const failure = useStore(s => s.failure)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  // A switch moves files under every session of this workspace, and the rows
  // are a dense click target, so a pick arms rather than acts: the armed row
  // asks for one confirming click and any other click disarms it.
  const [armed, setArmed] = useState<string | undefined>(undefined)
  const [drafting, setDrafting] = useState(false)
  const [draft, setDraft] = useState('')
  const seat = useRef<HTMLDivElement>(null)

  // A popover that outlives a click elsewhere would hide the conversation it
  // sits on, so dismissal is owned here rather than left to the next click.
  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event: PointerEvent): void => {
      if (seat.current?.contains(event.target as Node) !== true) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      // Escape steps back one level: it disarms or leaves the draft before it
      // closes the menu, so a mis-pick is undone without losing the list.
      if (armed !== undefined) setArmed(undefined)
      else if (drafting) setDrafting(false)
      else setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, armed, drafting])

  // A workspace that is not a repository has no branch to show; the pill is
  // absent rather than disabled, so a non-git project keeps its input clean.
  if (!repository) return null

  const normalized = query.trim().toLowerCase()
  const match = (branch: string): boolean =>
    normalized.length === 0 || branch.toLowerCase().includes(normalized)
  const visibleLocal = branches.filter(match)
  const visibleRemote = remoteBranches.filter(match)
  const trimmedDraft = draft.trim()

  /** Close the menu and reset every transient step it owns. */
  const dismiss = (): void => {
    setOpen(false)
    setArmed(undefined)
    setDrafting(false)
    setDraft('')
  }

  /**
   * One branch row. A pick arms it; the confirming click acts. `remote` rows
   * check out through the tracking verb, since a plain switch refuses a name
   * the local repository does not have.
   */
  const row = (branch: string, remote: boolean): ReactNode => {
    const isCurrent = !remote && branch === current
    const isArmed = armed === branch
    return (
      <li key={`${remote ? 'r' : 'l'}:${branch}`}>
        <button
          type="button"
          className={isArmed ? `${css.item} ${css.itemArmed}` : css.item}
          role="option"
          aria-selected={isCurrent}
          disabled={busy || isCurrent}
          onClick={() => {
            if (!isArmed) { setArmed(branch); return }
            dismiss()
            if (remote) checkoutRemote(branch)
            else switchBranch(branch)
          }}
        >
          <span className={css.name}>{branch}</span>
          {isCurrent ? <span className={css.check}>✓</span> : null}
          {isArmed ? <span className={css.confirm}>{t('branch.confirm')}</span> : null}
        </button>
      </li>
    )
  }

  return (
    <div className={css.seat} ref={seat}>
      <button
        type="button"
        className={css.pill}
        disabled={busy}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('branch.label')}
        title={current === '' ? t('branch.none') : current}
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next) {
            setQuery('')
            // The checkout can move under us (a terminal switch, another
            // session), so the list is re-read on open rather than trusted.
            refresh()
          }
        }}
      >
        <IconBranchOutline16 className={css.icon} size={16} />
        <span className={css.name}>
          {busy ? t('branch.switching') : current === '' ? t('branch.none') : current}
        </span>
        <IconChevronDownOutline14 className={css.chevron} size={12} />
      </button>
      {open
        ? (
          <div className={css.popover} role="listbox">
            <input
              className={css.search}
              type="search"
              value={query}
              placeholder={t('branch.search')}
              aria-label={t('branch.search')}
              onChange={(event) => { setQuery(event.currentTarget.value) }}
            />
            {failure === '' ? null : <p className={css.failure}>{failure}</p>}
            {visibleLocal.length === 0 && visibleRemote.length === 0
              ? <p className={css.empty}>{t('branch.empty')}</p>
              : (
                <ul className={css.list}>
                  {visibleLocal.length === 0
                    ? null
                    : <li className={css.group} aria-hidden>{t('branch.local')}</li>}
                  {visibleLocal.map(branch => row(branch, false))}
                  {visibleRemote.length === 0
                    ? null
                    : <li className={css.group} aria-hidden>{t('branch.remote')}</li>}
                  {visibleRemote.map(branch => row(branch, true))}
                </ul>
              )}
            {drafting
              ? (
                <form
                  className={css.createForm}
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (trimmedDraft === '') return
                    dismiss()
                    createBranch(trimmedDraft)
                  }}
                >
                  <input
                    className={css.search}
                    type="text"
                    value={draft}
                    autoFocus
                    placeholder={t('branch.createPlaceholder')}
                    aria-label={t('branch.createPlaceholder')}
                    onChange={(event) => { setDraft(event.currentTarget.value) }}
                  />
                  <div className={css.createActions}>
                    <button
                      type="button"
                      className={css.createCancel}
                      onClick={() => { setDrafting(false); setDraft('') }}
                    >
                      {t('branch.cancel')}
                    </button>
                    {/* No name validation here: git's ref rules are the
                        authority, and its refusal names the bad character. */}
                    <button type="submit" className={css.createSubmit} disabled={trimmedDraft === ''}>
                      {t('branch.createSubmit')}
                    </button>
                  </div>
                </form>
              )
              : (
                <button
                  type="button"
                  className={css.createOpen}
                  disabled={busy}
                  onClick={() => { setArmed(undefined); setDrafting(true) }}
                >
                  {t('branch.create')}
                </button>
              )}
          </div>
        )
        : null}
    </div>
  )
}
