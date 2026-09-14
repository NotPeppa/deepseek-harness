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

import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { SubprocessHandle, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import type {} from '@deepseek-ai/dsh-subprocess'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import type {} from '@deepseek-ai/dsh-workspace'
import type { GitStatus, GitSwitchOutcome } from './types.ts'

export type * from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host owner of the `git` Remote namespace. */
    git: GitController
  }
}

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

  /**
   * @param ctx - Host context carrying the subprocess seam and the workspace registry.
   */
  constructor(ctx: Context) {
    super(ctx, 'git')
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
    return this.outcome(await this.git(cwd, ['switch', '--track', '--', remoteRef], signal))
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
    return this.outcome(await this.git(cwd, ['switch', '--create', '--', name], signal))
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
    return this.outcome(await this.git(cwd, ['switch', '--no-guess', '--', branch], signal))
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
