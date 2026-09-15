/**
 * Branch-pill store: a mirror of the last git status the Host reported, plus
 * the in-flight flag the pill disables itself with. The plugin's refresh is
 * the only writer; the component reads through props.useStore.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'
import type { GitWorktree } from '@deepseek-ai/dsh-api-git-controller/types'

/** State mirrored from one workspace's checkout. */
export interface BranchState {
  /** Whether the active workspace is a git working tree. */
  repository: boolean
  /** Checked-out branch, empty on a detached HEAD or before the first read. */
  current: string
  /** Local branches offered by the picker. */
  branches: readonly string[]
  /** Remote-tracking branches, checked out by creating a local tracking branch. */
  remoteBranches: readonly string[]
  /** A switch is in flight; the pill refuses a second one until it settles. */
  busy: boolean
  /** Git's refusal from the last switch, empty when the last one landed. */
  failure: string
  /** Checkouts of this repository, read when the worktree manager opens. */
  worktrees: readonly GitWorktree[]
  /** A worktree create or remove is in flight. */
  worktreeBusy: boolean
  /** Git's refusal from the last worktree operation. */
  worktreeFailure: string
  /**
   * Path whose removal was refused only because it holds uncommitted work.
   * The manager offers that one row a force retry; nothing else may be forced.
   */
  worktreeDirty: string
}

/** Declared action shape giving the exported factory a stable return type. */
type BranchActions = {
  sync: (
    draft: BranchState, repository: boolean, current: string,
    branches: readonly string[], remoteBranches: readonly string[],
  ) => void
  setBusy: (draft: BranchState, busy: boolean) => void
  setFailure: (draft: BranchState, failure: string) => void
  syncWorktrees: (draft: BranchState, worktrees: readonly GitWorktree[]) => void
  setWorktreeBusy: (draft: BranchState, busy: boolean) => void
  setWorktreeOutcome: (draft: BranchState, failure: string, dirtyPath: string) => void
}

/**
 * Declares the branch-pill state and write surface.
 * @returns the store handle.
 */
export function createBranchStore(): EngineStoreHandle<BranchState, BranchActions> {
  return defineStore({
    init: (): BranchState => ({
      repository: false, current: '', branches: [], remoteBranches: [], busy: false, failure: '',
      worktrees: [], worktreeBusy: false, worktreeFailure: '', worktreeDirty: '',
    }),
    actions: {
      sync: (
        d, repository: boolean, current: string,
        branches: readonly string[], remoteBranches: readonly string[],
      ) => {
        d.repository = repository
        d.current = current
        d.branches = branches
        d.remoteBranches = remoteBranches
      },
      setBusy: (d, busy: boolean) => { d.busy = busy },
      setFailure: (d, failure: string) => { d.failure = failure },
      syncWorktrees: (d, worktrees: readonly GitWorktree[]) => { d.worktrees = worktrees },
      setWorktreeBusy: (d, busy: boolean) => { d.worktreeBusy = busy },
      setWorktreeOutcome: (d, failure: string, dirtyPath: string) => {
        d.worktreeFailure = failure
        d.worktreeDirty = dirtyPath
      },
    },
  })
}
