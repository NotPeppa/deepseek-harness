/**
 * Host owner of the `git` Remote namespace: the branch facts one workspace's
 * checkout reports, and the branch switch the selector performs.
 *
 * Every call names a workspace by its registry id, never by path. The registry
 * record's `path` is the realpath resolved when the workspace was created and
 * is never rewritten, so an id that resolves is by construction a directory the
 * user has already admitted — the browser cannot aim git at an arbitrary
 * directory, and an unknown id is refused rather than defaulted.
 *
 * Git runs through the subprocess seam with fixed argv (never shell-
 * interpreted), so a branch name cannot become an argument or a command.
 */

import { createHash } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { SubprocessHandle, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import type {} from '@deepseek-ai/dsh-subprocess'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { realpathNormalize, WorkspaceId } from '@deepseek-ai/dsh-workspace'
import type {} from '@deepseek-ai/dsh-workspace'
import type {
  GitCheckoutChanged, GitStatus, GitSwitchOutcome,
  GitWorktree, GitWorktreeCreated, GitWorktreeRemoved,
} from './types.ts'
import { registerWorktreeTool } from './worktree-tool.ts'

export type * from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host owner of the `git` Remote namespace. */
    git: GitController
  }
}

/**
 * Branch-name prefix for a harness-created worktree. Git refuses to check one
 * branch out in two checkouts at once, so an isolated worktree must bring its
 * own branch; the prefix keeps those apart from branches a person made.
 */
const MANAGED_BRANCH_PREFIX = 'wt/'

/** Directory under the dsh home holding every harness-created worktree. */
const MANAGED_DIR = 'worktrees'

/** Grace period handed to the subprocess seam for one git invocation. */
const GRACE_MS = 2_000

/** Byte cap per collected stream; a branch listing far below it. */
const OUTPUT_MAX_BYTES = 1024 * 1024

/** One finished git invocation. */
interface GitRun {
  /** Process exit code; `null` when it was signalled. */
  readonly exitCode: number | null
  /** Collected stdout, decoded and trimmed. */
  readonly stdout: string
  /** Collected stderr, decoded and trimmed. */
  readonly stderr: string
}

/**
 * Branch facts and branch switching for registered workspaces.
 */
export class GitController extends TypertRemoteService {
  static inject = ['subprocess', 'workspaceRegistry']

  /** Live followers of the checkout-changed announcement, by their sink. */
  private readonly followers = new Set<(change: GitCheckoutChanged) => void>()

  /**
   * @param ctx - Host context carrying the subprocess seam and the workspace registry.
   */
  constructor(ctx: Context) {
    super(ctx, 'git')
    // Scoped, like every optional collaboration here: a composition without a
    // tools registry still serves the browser, just without the model verb.
    registerWorktreeTool(ctx, this)
  }

  /**
   * Report the checkout state of one registered workspace.
   * @param workspaceId - registry id of the workspace to inspect.
   * @param signal - caller cancellation.
   * @returns the branch facts; `repository: false` when the directory is not a working tree.
   */
  @Remote
  async status(workspaceId: string, signal: AbortSignal): Promise<GitStatus> {
    const cwd = this.workspacePath(workspaceId)
    // `--is-inside-work-tree` is the cheapest question that separates "not a
    // repo" from "a repo with nothing checked out", which need different UI.
    const inside = await this.git(cwd, ['rev-parse', '--is-inside-work-tree'], signal)
    if (inside.exitCode !== 0 || inside.stdout !== 'true') {
      return { repository: false, branches: [], remoteBranches: [] }
    }
    const head = await this.git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'], signal)
    // A detached HEAD answers the literal "HEAD"; that is not a branch name.
    const current = head.exitCode === 0 && head.stdout !== 'HEAD' && head.stdout.length > 0
      ? head.stdout
      : undefined
    const listed = await this.git(cwd, ['branch', '--list', '--format=%(refname:short)'], signal)
    const branches = lines(listed.exitCode === 0 ? listed.stdout : '')
    const remotes = await this.git(cwd, ['branch', '--remotes', '--format=%(refname:short)'], signal)
    // `origin/HEAD` is a symbolic pointer at another entry of this same list;
    // offering it would check out a duplicate under a confusing name.
    const remoteBranches = lines(remotes.exitCode === 0 ? remotes.stdout : '')
      .filter(branch => !branch.endsWith('/HEAD'))
    return { repository: true, branches, remoteBranches, ...current === undefined ? {} : { current } }
  }

  /**
   * Check out a remote-tracking branch, creating the local branch that tracks
   * it. Separate from {@link switchBranch} because this one *creates* a branch:
   * the plain switch deliberately passes `--no-guess` so a typo can never do
   * that implicitly, which leaves the intentional case needing its own verb.
   * @param workspaceId - registry id of the workspace to switch.
   * @param remoteRef - remote-tracking name as listed, such as `origin/topic`.
   * @param signal - caller cancellation.
   * @returns whether the checkout landed, carrying git's refusal when it did not.
   */
  @Remote
  async checkoutRemote(workspaceId: string, remoteRef: string, signal: AbortSignal): Promise<GitSwitchOutcome> {
    const cwd = this.workspacePath(workspaceId)
    // A local branch of that short name already existing is exactly what git
    // refuses here, and its sentence says so better than a local check would.
    return this.settle(workspaceId, await this.git(cwd, ['switch', '--track', '--', remoteRef], signal))
  }

  /**
   * Create a branch at the current HEAD and check it out.
   * @param workspaceId - registry id of the workspace to branch.
   * @param name - new branch name; git validates it and refuses a bad one.
   * @param signal - caller cancellation.
   * @returns whether the branch was created and checked out.
   */
  @Remote
  async createBranch(workspaceId: string, name: string, signal: AbortSignal): Promise<GitSwitchOutcome> {
    const cwd = this.workspacePath(workspaceId)
    // No validation here: git's own ref-name rules are the authority, and its
    // refusal names the offending character better than a local guess.
    return this.settle(workspaceId, await this.git(cwd, ['switch', '--create', '--', name], signal))
  }

  /**
   * Check out an existing local branch in one registered workspace.
   * @param workspaceId - registry id of the workspace to switch.
   * @param branch - existing local branch name.
   * @param signal - caller cancellation.
   * @returns whether the switch landed, carrying git's refusal when it did not.
   */
  @Remote
  async switchBranch(workspaceId: string, branch: string, signal: AbortSignal): Promise<GitSwitchOutcome> {
    const cwd = this.workspacePath(workspaceId)
    // `--no-guess` keeps a typo from silently creating a remote-tracking
    // branch, and `--` ends option parsing so a name like `-f` stays a name.
    return this.settle(workspaceId, await this.git(cwd, ['switch', '--no-guess', '--', branch], signal))
  }

  /**
   * Follow checkout changes this Host makes.
   *
   * Announced rather than polled: every verb here knows exactly when it moved a
   * checkout, so a watcher learns at that moment instead of up to a poll
   * interval later. It is deliberately not a filesystem watch — a branch
   * switched in a terminal is not announced, and the browser's own focus re-read
   * remains the answer for that. What this closes is the case the browser cannot
   * see coming: the model moving the checkout through `git_worktree` while the
   * user watches.
   * @param signal - generation cancellation.
   * @returns each change as it is made, until the signal aborts.
   */
  @Remote({ mode: 'stream' })
  async *checkoutChanges(signal: AbortSignal): AsyncIterable<GitCheckoutChanged> {
    const queue: GitCheckoutChanged[] = []
    let wake: (() => void) | undefined
    const sink = (change: GitCheckoutChanged): void => {
      queue.push(change)
      wake?.()
    }
    this.followers.add(sink)
    try {
      while (!signal.aborted) {
        while (queue.length > 0) {
          const next = queue.shift()
          if (next !== undefined) yield next
        }
        await new Promise<void>((resolve) => {
          wake = resolve
          signal.addEventListener('abort', () => { resolve() }, { once: true })
        })
        wake = undefined
      }
    } finally {
      this.followers.delete(sink)
    }
  }

  /**
   * Tell every follower that one workspace's checkout may have moved.
   * @param workspaceId - the workspace whose checkout changed.
   */
  private announce(workspaceId: string): void {
    for (const follower of this.followers) follower({ workspaceId })
  }

  /**
   * List every checkout of one workspace's repository.
   * @param workspaceId - registry id of any checkout of the repository.
   * @param signal - caller cancellation.
   * @returns every linked checkout, marked for primacy, management, and registration.
   */
  @Remote
  async worktrees(workspaceId: string, signal: AbortSignal): Promise<readonly GitWorktree[]> {
    const cwd = this.workspacePath(workspaceId)
    const listed = await this.git(cwd, ['worktree', 'list', '--porcelain'], signal)
    if (listed.exitCode !== 0) return []
    const managedRoot = this.managedRoot()
    // Registry paths are already canonical, so one pass indexes every checkout
    // that a session can be opened in.
    const registered = new Map(
      this.ctx.workspaceRegistry.list().map(workspace => [workspace.path, workspace.id as string]),
    )
    return parseWorktrees(listed.stdout).map((entry, index) => {
      const workspaceId2 = registered.get(entry.path)
      return {
        path: entry.path,
        ...entry.branch === undefined ? {} : { branch: entry.branch },
        // git lists the primary checkout first; that is the one this feature
        // must never remove, since removing it would take the repository.
        primary: index === 0,
        managed: contains(managedRoot, entry.path),
        ...workspaceId2 === undefined ? {} : { workspaceId: workspaceId2 },
      }
    })
  }

  /**
   * Create an isolated checkout of one workspace's repository and register it
   * as a workspace, so a session can be opened in it.
   *
   * The new checkout always gets its own `wt/` branch: git refuses to check one
   * branch out twice, so sharing the caller's branch is not available even if it
   * were wanted. The caller's own checkout never moves.
   * @param workspaceId - registry id of the repository to branch from.
   * @param name - worktree name; also the `wt/` branch suffix and directory name.
   * @param base - committish the branch starts at; empty means the current HEAD.
   * @param signal - caller cancellation.
   * @returns the created checkout's path and workspace id, or git's refusal.
   */
  @Remote
  async createWorktree(
    workspaceId: string,
    name: string,
    base: string,
    signal: AbortSignal,
  ): Promise<GitWorktreeCreated> {
    const cwd = this.workspacePath(workspaceId)
    // The name becomes a directory segment: anything that could climb out of
    // the managed root, or name a parent, is refused before git sees it.
    if (!isPlainSegment(name)) {
      return { ok: false, message: `worktree name '${name}' must be a single path segment` }
    }
    const key = await this.repositoryKey(cwd, signal)
    const path = join(this.managedRoot(), key, name)
    const branch = `${MANAGED_BRANCH_PREFIX}${name}`
    const run = await this.git(
      cwd,
      ['worktree', 'add', '-b', branch, '--', path, ...base === '' ? [] : [base]],
      signal,
    )
    if (run.exitCode !== 0) {
      const message = run.stderr.length > 0 ? run.stderr : run.stdout
      return { ok: false, ...message.length === 0 ? {} : { message } }
    }
    // Registering is what makes the checkout reachable: a session opens in a
    // workspace, never in a bare directory.
    const workspace = await this.ctx.workspaceRegistry.create(path)
    this.announce(workspaceId)
    return { ok: true, path: workspace.path, workspaceId: workspace.id as string }
  }

  /**
   * Remove one harness-created checkout and unregister its workspace.
   * @param workspaceId - registry id of any checkout of the repository.
   * @param path - the checkout to remove; must be one this harness created.
   * @param force - remove even though the checkout holds uncommitted work.
   * @param signal - caller cancellation.
   * @returns the outcome; `dirty` marks the one refusal `force` may retry.
   */
  @Remote
  async removeWorktree(
    workspaceId: string,
    path: string,
    force: boolean,
    signal: AbortSignal,
  ): Promise<GitWorktreeRemoved> {
    const cwd = this.workspacePath(workspaceId)
    // Containment is checked on canonical paths at both ends, so neither a
    // symlink nor a `..` segment can aim removal outside the managed root.
    const canonical = await realpathNormalize(path).catch(() => resolve(path))
    if (!contains(this.managedRoot(), canonical)) {
      return { ok: false, message: `'${path}' is not a worktree this harness created` }
    }
    const run = await this.git(
      cwd,
      ['worktree', 'remove', ...force ? ['--force'] : [], '--', canonical],
      signal,
    )
    if (run.exitCode !== 0) {
      const message = run.stderr.length > 0 ? run.stderr : run.stdout
      // Only uncommitted work is offered a retry; every other refusal stands.
      const dirty = /contains modified or untracked files/i.test(message)
      return { ok: false, ...message.length === 0 ? {} : { message }, ...dirty ? { dirty: true } : {} }
    }
    // git leaves the directory behind when it was already gone from its own
    // metadata; the registry entry must go either way or it points at nothing.
    await rm(canonical, { recursive: true, force: true })
    const registered = this.ctx.workspaceRegistry.list().find(workspace => workspace.path === canonical)
    if (registered !== undefined) await this.ctx.workspaceRegistry.delete(registered.id)
    this.announce(workspaceId)
    return { ok: true }
  }

  /** Directory holding every harness-created worktree. */
  private managedRoot(): string {
    return join(resolveDshHome(), MANAGED_DIR)
  }

  /**
   * Stable directory name for one repository, so two repositories of the same
   * folder name cannot collide under the managed root.
   * @param cwd - any checkout of the repository.
   * @param signal - caller cancellation.
   * @returns a filesystem-safe key derived from the repository's common dir.
   */
  private async repositoryKey(cwd: string, signal: AbortSignal): Promise<string> {
    const common = await this.git(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir'], signal)
    const identity = common.exitCode === 0 && common.stdout.length > 0 ? common.stdout : cwd
    return createHash('sha256').update(identity).digest('hex').slice(0, 12)
  }

  /**
   * Read one git run as a switch outcome.
   * @param run - the finished invocation.
   * @returns success, or the failure carrying git's own sentence — it explains
   * a dirty tree or a branch held by another worktree better than any message
   * invented here.
   */
  private outcome(run: GitRun): GitSwitchOutcome {
    if (run.exitCode === 0) return { ok: true }
    const message = run.stderr.length > 0 ? run.stderr : run.stdout
    return { ok: false, ...message.length === 0 ? {} : { message } }
  }

  /**
   * Read one git run as a switch outcome, announcing the move when it landed.
   * A refusal changed nothing, so it is not announced — a watcher re-reading
   * then would learn only what it already shows.
   * @param workspaceId - the workspace whose checkout the run targeted.
   * @param run - the finished invocation.
   * @returns the outcome.
   */
  private settle(workspaceId: string, run: GitRun): GitSwitchOutcome {
    const outcome = this.outcome(run)
    if (outcome.ok) this.announce(workspaceId)
    return outcome
  }

  /**
   * Resolve a workspace id to the directory git may run in.
   * @param workspaceId - id received on the wire.
   * @returns the registry record's canonical path.
   * @throws when no registered workspace carries the id — the fence that keeps
   * the browser from naming a directory of its own.
   */
  private workspacePath(workspaceId: string): string {
    const workspace = this.ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
    if (workspace === undefined) throw new Error(`git: no registered workspace '${workspaceId}'`)
    return workspace.path
  }

  /**
   * Run one git invocation and collect its output.
   * @param cwd - registry-resolved working directory.
   * @param args - argv after the program; never shell-interpreted.
   * @param signal - caller cancellation.
   * @returns the exit code and both collected streams.
   */
  private async git(cwd: string, args: readonly string[], signal: AbortSignal): Promise<GitRun> {
    let handle: SubprocessHandle
    try {
      handle = this.ctx.subprocess.spawn({
        argv: ['git', ...args],
        cwd,
        stdio: {
          stdin: 'ignore',
          stdout: { maxBytes: OUTPUT_MAX_BYTES },
          stderr: { maxBytes: OUTPUT_MAX_BYTES },
        },
        graceMs: GRACE_MS,
        signal,
      } satisfies SubprocessSpawnSpec)
    } catch (error: unknown) {
      // A machine without git on PATH fails here; that is a normal answer for
      // this feature ("not a repo"), not a fault to propagate to the browser.
      return { exitCode: null, stdout: '', stderr: String(error) }
    }
    const outcome = await handle.done
    return {
      exitCode: outcome.exitCode,
      stdout: decode(handle, 'stdout'),
      stderr: decode(handle, 'stderr'),
    }
  }
}

/**
 * Whether a name is usable as one directory segment. A worktree name becomes a
 * path under the managed root, so anything that could climb out of it — a
 * separator, a drive letter, `.` or `..` — is refused before git sees it.
 * @param name - candidate worktree name.
 * @returns whether it names exactly one new directory.
 */
export function isPlainSegment(name: string): boolean {
  if (name.length === 0 || name === '.' || name === '..') return false
  return !/[\\/:]/.test(name)
}

/**
 * Whether a canonical path sits inside a directory. Compared with a trailing
 * separator so a sibling whose name merely starts the same — `worktrees-old`
 * beside `worktrees` — is not mistaken for a child.
 * @param root - containing directory.
 * @param candidate - canonical path to test.
 * @returns whether `candidate` is `root` itself or below it.
 */
export function contains(root: string, candidate: string): boolean {
  const base = resolve(root)
  const target = resolve(candidate)
  return target === base || target.startsWith(base.endsWith(sep) ? base : base + sep)
}

/**
 * Read `git worktree list --porcelain` into entries. The format is record
 * blocks separated by blank lines, each opening with `worktree <path>`; a
 * detached checkout carries no `branch` line, which is what leaves the branch
 * absent rather than invented.
 * @param stdout - the porcelain listing.
 * @returns one entry per checkout, in git's order (the primary first).
 */
export function parseWorktrees(stdout: string): Array<{ path: string; branch?: string }> {
  const entries: Array<{ path: string; branch?: string }> = []
  for (const line of stdout.split('\n')) {
    const text = line.trim()
    if (text.startsWith('worktree ')) entries.push({ path: text.slice('worktree '.length) })
    else if (text.startsWith('branch ')) {
      const last = entries.at(-1)
      // `refs/heads/topic` is the stored form; the short name is what a person
      // reads and what every other verb in this service takes.
      if (last !== undefined) last.branch = text.slice('branch '.length).replace(/^refs\/heads\//, '')
    }
  }
  return entries
}

/**
 * Split a git listing into trimmed, non-empty lines.
 * @param stdout - the collected listing.
 * @returns one entry per line.
 */
function lines(stdout: string): string[] {
  return stdout.split('\n').map(line => line.trim()).filter(line => line.length > 0)
}

/**
 * Read one collected stream as trimmed text.
 * @param handle - the finished subprocess handle.
 * @param stream - which collected stream to read.
 * @returns the text, empty when the stream was not collected.
 */
function decode(handle: SubprocessHandle, stream: 'stdout' | 'stderr'): string {
  return handle.collected[stream]?.readFrom(0).text.trim() ?? ''
}

export default GitController
