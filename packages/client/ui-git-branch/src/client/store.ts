/**
 * Branch-pill store: a mirror of the last git status the Host reported, plus
 * the in-flight flag the pill disables itself with. The plugin's refresh is
 * the only writer; the component reads through props.useStore.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'

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
}

/** Declared action shape giving the exported factory a stable return type. */
type BranchActions = {
  sync: (
    draft: BranchState, repository: boolean, current: string,
    branches: readonly string[], remoteBranches: readonly string[],
  ) => void
  setBusy: (draft: BranchState, busy: boolean) => void
  setFailure: (draft: BranchState, failure: string) => void
}

/**
 * Declares the branch-pill state and write surface.
 * @returns the store handle.
 */
export function createBranchStore(): EngineStoreHandle<BranchState, BranchActions> {
  return defineStore({
    init: (): BranchState => ({
      repository: false, current: '', branches: [], remoteBranches: [], busy: false, failure: '',
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
    },
  })
}
