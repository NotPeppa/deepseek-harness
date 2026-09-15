/**
 * Branch chip: keeps a store in step with a workspace's checkout, and seats the
 * chip twice — beside the blank-session workspace chip, and inside a running
 * conversation's input dock.
 *
 * Both seats share one behaviour, differing only in where the workspace comes
 * from: the Hero names it in its owner share (nothing points at it yet), while
 * a dock seat belongs to a session and resolves it from the workspace list.
 *
 * Refresh is event-driven rather than polled: a seat reads on mount, on popover
 * open, after any checkout-moving call, and on window focus (throttled). A
 * checkout moved from a terminal is picked up the next time the window is
 * looked at, which is the moment a stale branch would mislead.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { BoundActions } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the SlotRegistry service merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the conversation slot declarations (both seats).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls ctx.workspaces.
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client'
// Merges the generated `git` namespace into the Remote face.
import type {} from '@deepseek-ai/dsh-api-git-controller/remote'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { BranchPillHeroInjected, BranchPillInjected } from './BranchPill.tsx'
import { BranchPill, HeroBranchPill } from './BranchPill.tsx'
import { createBranchStore } from './store.ts'
import { en, zh, type GitKey } from './locales.ts'

export type { BranchPillDockProps, BranchPillHeroProps, BranchPillInjected } from './BranchPill.tsx'
export type { BranchState } from './store.ts'

/** Namespace owning this feature's copy. */
export const GIT_LOCALE_NS = 'git'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The branch chip's copy. */
    git: GitKey
  }
}

/** Shortest gap between two focus-driven reads. */
const FOCUS_THROTTLE_MS = 5_000

/** One store's write face, as both seats use it. */
type BranchActions = BoundActions<ReturnType<typeof createBranchStore>>

/** What one checkout-moving Remote call answers, for the shared settle path. */
type CallResult =
  | { ok: true; value: { ok: boolean; message?: string } }
  | { ok: false; error: { message: string } }

/**
 * Required services: the Remote transport AND the generated `git` namespace on
 * it — a namespace is injected by name, or `ctx.remote.git` is simply not
 * there — the workspace list a dock seat resolves its session through, plus
 * slots/locale for the chip.
 */
export const inject = ['slots', 'locale', 'remote', 'remote.git', 'workspaces']

/**
 * Client plugin body: mirror each seat's workspace checkout into its store and
 * mount the two seats.
 * @param ctx - client cordis context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(GIT_LOCALE_NS, { zh, en }), 'ui-git-branch: chip dictionaries')

  /** Every mounted seat's re-read, so one focus event can settle all of them. */
  const seats = new Set<() => void>()

  /**
   * Build one seat's behaviour over its store and its workspace source.
   * @param actions - the seat's bound store writes.
   * @param workspaceId - reads the workspace this seat speaks for, or undefined.
   * @returns the seat's injected face.
   */
  const seat = (actions: BranchActions, workspaceId: () => string | undefined): BranchPillInjected => {
    const refresh = (): void => {
      const id = workspaceId()
      // No workspace resolved is the same answer as "not a repository": the
      // chip is absent rather than naming a branch nothing can verify.
      if (id === undefined) { actions.sync(false, '', [], []); return }
      void ctx.remote.git.status(id).then(
        (response) => {
          if (!response.ok) { actions.sync(false, '', [], []); return }
          const status = response.value
          actions.sync(status.repository, status.current ?? '', status.branches, status.remoteBranches)
        },
        () => { actions.sync(false, '', [], []) },
      )
    }
    seats.add(refresh)

    /**
     * Run one checkout-moving call and settle the chip from its outcome. Every
     * verb shares this: a transport refusal and git's own refusal read the same
     * to the user — the branch did not change, and this sentence says why — and
     * either way the checkout is re-read, so an accepted move repaints the new
     * branch and a refused one repaints the old.
     */
    const run = (call: (id: string) => Promise<CallResult>): void => {
      const id = workspaceId()
      if (id === undefined) return
      actions.setBusy(true)
      actions.setFailure('')
      void call(id).then(
        (response) => {
          actions.setBusy(false)
          if (!response.ok) actions.setFailure(response.error.message)
          else if (!response.value.ok) actions.setFailure(response.value.message ?? '')
          refresh()
        },
        (reason: unknown) => {
          actions.setBusy(false)
          actions.setFailure(String(reason))
        },
      )
    }

    const refreshWorktrees = (): void => {
      const id = workspaceId()
      if (id === undefined) { actions.syncWorktrees([]); return }
      void ctx.remote.git.worktrees(id).then(
        (response) => { actions.syncWorktrees(response.ok ? response.value : []) },
        () => { actions.syncWorktrees([]) },
      )
    }

    /**
     * Run one worktree call and settle the manager from its outcome. The dirty
     * refusal is kept apart from every other: it is the only one the manager
     * may retry with force, so it arms exactly that row and nothing else.
     */
    const worktreeRun = (
      call: (id: string) => Promise<
        { ok: true; value: { ok: boolean; message?: string; dirty?: boolean } }
        | { ok: false; error: { message: string } }
      >,
      dirtyCandidate: string,
    ): void => {
      const id = workspaceId()
      if (id === undefined) return
      actions.setWorktreeBusy(true)
      actions.setWorktreeOutcome('', '')
      void call(id).then(
        (response) => {
          actions.setWorktreeBusy(false)
          if (!response.ok) actions.setWorktreeOutcome(response.error.message, '')
          else if (!response.value.ok) {
            actions.setWorktreeOutcome(
              response.value.message ?? '',
              response.value.dirty === true ? dirtyCandidate : '',
            )
          }
          // The listing moved either way: a creation added a row, a removal
          // took one, and a refusal may still have changed what git reports.
          refreshWorktrees()
          refresh()
        },
        (reason: unknown) => {
          actions.setWorktreeBusy(false)
          actions.setWorktreeOutcome(String(reason), '')
        },
      )
    }

    return {
      switchBranch: (branch) => { run(id => ctx.remote.git.switchBranch(id, branch)) },
      checkoutRemote: (remoteRef) => { run(id => ctx.remote.git.checkoutRemote(id, remoteRef)) },
      createBranch: (name) => { run(id => ctx.remote.git.createBranch(id, name)) },
      refresh,
      refreshWorktrees,
      createWorktree: (name, base) => {
        worktreeRun(id => ctx.remote.git.createWorktree(id, name, base), '')
      },
      removeWorktree: (path, force) => {
        worktreeRun(id => ctx.remote.git.removeWorktree(id, path, force), path)
      },
    }
  }

  // The Host announces every checkout it moves, so a change the browser could
  // not see coming — the model calling git_worktree, or another tab switching
  // a branch — lands immediately instead of waiting for the next focus.
  ctx.effect(() => {
    const stream = ctx.remote.$stream({
      name: 'git checkout changes',
      open: signal => ctx.remote.git.checkoutChanges(signal),
      ended: () => new Error('git checkout changes ended'),
    })
    void (async () => {
      for await (const item of stream) {
        item.accept()
        // Which workspace moved is not consulted: a seat re-reads its own
        // workspace anyway, and a repository-wide change (a worktree added or
        // removed) touches more than the announced one.
        for (const refresh of seats) refresh()
      }
    })().catch(() => {
      // A stream that will not stay open leaves the focus re-read in charge.
    })
    return () => { void stream.dispose() }
  }, 'ui-git-branch: checkout change stream')

  // A checkout moved outside this Host — a terminal switch — is not announced,
  // so every seat also re-reads when the window is looked at again, which is
  // the moment a stale branch would mislead.
  ctx.effect(() => {
    let lastRead = 0
    const onFocus = (): void => {
      const now = Date.now()
      if (now - lastRead < FOCUS_THROTTLE_MS) return
      lastRead = now
      for (const refresh of seats) refresh()
    }
    window.addEventListener('focus', onFocus)
    return () => { window.removeEventListener('focus', onFocus) }
  }, 'ui-git-branch: focus refresh')

  // Hero seat: the blank-session screen, where a branch is chosen before the
  // work starts. Root-scoped, so one store, and the workspace arrives from the
  // owner share — the Hero has already settled which workspace a New Session
  // would open in, including a pick no session references yet.
  const heroStore = createBranchStore()
  let heroWorkspaceId: string | undefined
  ctx.slots.inject('conversation.hero.context', () => ctx.slots.register({
    name: 'conversation.hero.context',
    id: 'git-branch',
    order: 10,
    store: heroStore,
    locale: GIT_LOCALE_NS,
    inject: (actions: BranchActions): BranchPillHeroInjected => {
      const face = seat(actions, () => heroWorkspaceId)
      return {
        ...face,
        adoptWorkspace: (workspaceId) => {
          if (workspaceId === heroWorkspaceId) return
          heroWorkspaceId = workspaceId
          face.refresh()
        },
      }
    },
  }, HeroBranchPill))

  // Input-bar seat: the same chip inside a running conversation, so the branch
  // the work lands on stays visible. It rides the accessory row beside the
  // access-mode chip — a row of controls of exactly this shape — rather than
  // the dock above the input, which stacks full-width cards and leaves a lone
  // chip floating far from the box it belongs to. That row is absent in the
  // Hero phase, so the two seats cannot both appear on one screen.
  const dockStore = createBranchStore()
  ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
    name: 'conversation.input.left',
    id: 'git-branch',
    order: 10,
    store: dockStore,
    locale: GIT_LOCALE_NS,
    inject: (sessionId: SessionId, actions: BranchActions): BranchPillInjected => {
      // Resolved from the session rather than from "the current workspace", so
      // a chip always names the checkout its own session runs in.
      const face = seat(actions, () => ctx.workspaces.list.getSnapshot().items
        .find(item => item.sessionIds.includes(sessionId))?.workspaceId)
      face.refresh()
      return face
    },
  }, BranchPill))
}
