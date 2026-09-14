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
