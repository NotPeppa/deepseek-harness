/**
 * Wire types of the `git` Remote namespace. Types only: the generated Remote
 * imports this module, so it must stay free of runtime imports.
 */

/** What one workspace's checkout looks like right now. */
export interface GitStatus {
  /** Whether the workspace directory is inside a git working tree at all. */
  readonly repository: boolean
  /**
   * Checked-out branch name. Absent on a detached HEAD (and on a non-repo),
   * which the selector shows as "no branch" rather than inventing one.
   */
  readonly current?: string
  /** Local branch names, in git's own listing order. */
  readonly branches: readonly string[]
  /**
   * Remote-tracking branch names (`origin/main`), excluding the symbolic
   * `origin/HEAD` — it is a pointer at another entry in this same list, so
   * offering it would check out a duplicate under a confusing name.
   */
  readonly remoteBranches: readonly string[]
}

/** Outcome of one branch switch, checkout, or creation. */
export interface GitSwitchOutcome {
  /** Whether the checkout now sits on the requested branch. */
  readonly ok: boolean
  /**
   * Why git refused, verbatim from its stderr, when it did. Carried so the
   * selector can name a dirty tree or a branch held by another worktree
   * instead of a generic failure.
   */
  readonly message?: string
}

/** One linked checkout of a repository. */
export interface GitWorktree {
  /** Absolute path of the checkout. */
  readonly path: string
  /** Branch checked out there, absent on a detached HEAD. */
  readonly branch?: string
  /** Whether this is the repository's primary checkout rather than a linked one. */
  readonly primary: boolean
  /** Whether this harness created it, and may therefore remove it. */
  readonly managed: boolean
  /** Registry id when this checkout is a registered workspace. */
  readonly workspaceId?: string
}

/** Outcome of one worktree creation. */
export interface GitWorktreeCreated {
  /** Whether the checkout was created and registered. */
  readonly ok: boolean
  /** Git's refusal when it declined. */
  readonly message?: string
  /** Absolute path of the new checkout, when one was made. */
  readonly path?: string
  /** Registry id of the workspace now pointing at it. */
  readonly workspaceId?: string
}

/** Outcome of one worktree removal. */
export interface GitWorktreeRemoved {
  /** Whether the checkout was removed and unregistered. */
  readonly ok: boolean
  /** Git's refusal when it declined. */
  readonly message?: string
  /**
   * Whether the refusal was only that the checkout holds uncommitted work.
   * A caller may retry with `force`; nothing else may be forced.
   */
  readonly dirty?: boolean
}

/** One announcement that a workspace's checkout may have moved. */
export interface GitCheckoutChanged {
  /** Registry id of the workspace whose checkout changed. */
  readonly workspaceId: string
}
