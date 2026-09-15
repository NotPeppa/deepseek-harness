/** Branch reading and the workspace fence, over a scripted subprocess seam. */
import { describe, expect, it } from 'vitest'
import { contains, GitController, isPlainSegment, parseWorktrees } from '../src/index.ts'

/** One scripted git invocation keyed by its argv tail. */
interface ScriptedRun {
  /** Exit code the fake process reports. */
  exitCode: number
  /** Text the fake process wrote to stdout. */
  stdout?: string
  /** Text the fake process wrote to stderr. */
  stderr?: string
}

/**
 * Build a controller over a fake subprocess seam and workspace registry,
 * without loading a cordis composition: the service only reaches `this.ctx`
 * for those two, so a structural stand-in exercises the real logic.
 */
function controller(
  script: (argv: readonly string[]) => ScriptedRun,
  workspaces: Record<string, string> = { ws: '/repo' },
): { git: GitController; calls: string[][]; announced: string[] } {
  const calls: string[][] = []
  const ctx = {
    subprocess: {
      spawn: (spec: { argv: readonly string[] }) => {
        calls.push([...spec.argv])
        const run = script(spec.argv)
        const reader = (text: string) => ({ readFrom: () => ({ text, nextOffset: text.length, lossy: false }) })
        return {
          collected: { stdout: reader(run.stdout ?? ''), stderr: reader(run.stderr ?? '') },
          done: Promise.resolve({ exitCode: run.exitCode, signal: null }),
        }
      },
    },
    workspaceRegistry: {
      get: (id: string) => {
        const path = workspaces[id]
        return path === undefined ? undefined : { id, path }
      },
    },
  }
  // The base Service constructor wants a real Context; the service under test
  // only uses `this.ctx`, so it is installed directly.
  const git = Object.create(GitController.prototype) as GitController
  Object.defineProperty(git, 'ctx', { value: ctx })
  // Field initializers do not run for a prototype-built instance; the change
  // announcement iterates this set on every landed verb.
  const announced: string[] = []
  Object.defineProperty(git, 'followers', {
    value: new Set([(change: { workspaceId: string }) => { announced.push(change.workspaceId) }]),
  })
  return { git, calls, announced }
}

const SIGNAL = new AbortController().signal

/** Line separator git uses between listing entries. */
const NL = String.fromCharCode(10)

describe('GitController', () => {
  it('reports a branch, both listings, and the argv it used', async () => {
    const { git, calls } = controller((argv) => {
      if (argv[1] === 'rev-parse' && argv[2] === '--is-inside-work-tree') return { exitCode: 0, stdout: 'true' }
      if (argv[1] === 'rev-parse') return { exitCode: 0, stdout: 'main' }
      if (argv.includes('--remotes')) return { exitCode: 0, stdout: ['origin/HEAD', 'origin/main', 'origin/topic'].join(NL) }
      return { exitCode: 0, stdout: ['main', 'feature/x'].join(NL) }
    })
    expect(await git.status('ws', SIGNAL)).toEqual({
      repository: true,
      current: 'main',
      branches: ['main', 'feature/x'],
      // origin/HEAD points at another entry of this same list, so it is not offered.
      remoteBranches: ['origin/main', 'origin/topic'],
    })
    // Fixed argv, never a shell string.
    expect(calls[0]?.[0]).toBe('git')
  })

  it('treats a detached HEAD as no branch rather than a branch named HEAD', async () => {
    const { git } = controller((argv) => {
      if (argv[2] === '--is-inside-work-tree') return { exitCode: 0, stdout: 'true' }
      if (argv[1] === 'rev-parse') return { exitCode: 0, stdout: 'HEAD' }
      return { exitCode: 0, stdout: '' }
    })
    const status = await git.status('ws', SIGNAL)
    expect(status.repository).toBe(true)
    expect(status.current).toBeUndefined()
  })

  it('reports a directory that is not a working tree as no repository', async () => {
    const { git } = controller(() => ({ exitCode: 128, stderr: 'not a git repository' }))
    expect(await git.status('ws', SIGNAL)).toEqual({ repository: false, branches: [], remoteBranches: [] })
  })

  it('refuses a workspace id the registry does not carry', async () => {
    const { git, calls } = controller(() => ({ exitCode: 0 }))
    await expect(git.status('intruder', SIGNAL)).rejects.toThrow('no registered workspace')
    // The fence holds before git runs at all.
    expect(calls).toHaveLength(0)
  })

  it('creates a branch at HEAD and checks it out', async () => {
    const { git, calls } = controller(() => ({ exitCode: 0 }))
    expect(await git.createBranch('ws', 'feature/y', SIGNAL)).toEqual({ ok: true })
    // `--` keeps a name like `-f` a name; git's own ref rules judge the rest.
    expect(calls[0]).toEqual(['git', 'switch', '--create', '--', 'feature/y'])
  })

  it('checks out a remote branch through --track, not the plain switch', async () => {
    const { git, calls } = controller(() => ({ exitCode: 0 }))
    expect(await git.checkoutRemote('ws', 'origin/topic', SIGNAL)).toEqual({ ok: true })
    // The plain switch passes --no-guess precisely so this cannot happen by
    // typo; the intentional case gets its own verb and an explicit --track.
    expect(calls[0]).toEqual(['git', 'switch', '--track', '--', 'origin/topic'])
  })

  it('refuses creation and remote checkout through the same fence', async () => {
    const { git, calls } = controller(() => ({ exitCode: 0 }))
    await expect(git.createBranch('intruder', 'x', SIGNAL)).rejects.toThrow('no registered workspace')
    await expect(git.checkoutRemote('intruder', 'origin/x', SIGNAL)).rejects.toThrow('no registered workspace')
    expect(calls).toHaveLength(0)
  })

  it('carries git’s refusal back instead of a generic failure', async () => {
    const { git, calls } = controller(() => ({ exitCode: 1, stderr: 'error: local changes would be overwritten' }))
    expect(await git.switchBranch('ws', 'main', SIGNAL)).toEqual({
      ok: false, message: 'error: local changes would be overwritten',
    })
    // `--no-guess` and the `--` terminator both survive into the argv.
    expect(calls[0]).toEqual(['git', 'switch', '--no-guess', '--', 'main'])
  })

  it('parses the porcelain worktree listing and shortens branch refs', () => {
    const listing = [
      'worktree /repo', 'HEAD abc', 'branch refs/heads/main', '',
      'worktree /home/.dsh/worktrees/k/topic', 'HEAD def', 'branch refs/heads/wt/topic', '',
      // A detached checkout carries no branch line.
      'worktree /repo/detached', 'HEAD 123', 'detached', '',
    ].join(NL)
    expect(parseWorktrees(listing)).toEqual([
      { path: '/repo', branch: 'main' },
      { path: '/home/.dsh/worktrees/k/topic', branch: 'wt/topic' },
      { path: '/repo/detached' },
    ])
  })

  it('contains a child but not a sibling whose name merely starts the same', () => {
    expect(contains('/home/worktrees', '/home/worktrees/k/topic')).toBe(true)
    expect(contains('/home/worktrees', '/home/worktrees')).toBe(true)
    // The prefix test alone would call this one a child.
    expect(contains('/home/worktrees', '/home/worktrees-old/k')).toBe(false)
    expect(contains('/home/worktrees', '/home/elsewhere')).toBe(false)
  })

  it('refuses a worktree name that is not one plain directory segment', () => {
    expect(isPlainSegment('topic')).toBe(true)
    for (const bad of ['', '.', '..', 'a/b', 'a' + String.fromCharCode(92) + 'b', 'C:x']) {
      expect(isPlainSegment(bad)).toBe(false)
    }
  })

  it('refuses to remove a path outside the managed root, without running git', async () => {
    const { git, calls } = controller(() => ({ exitCode: 0 }))
    const outcome = await git.removeWorktree('ws', '/etc', false, SIGNAL)
    expect(outcome.ok).toBe(false)
    expect(outcome.message).toContain('not a worktree this harness created')
    // The fence holds before git is asked to remove anything.
    expect(calls).toHaveLength(0)
  })

  it('refuses a climbing worktree name before git sees it', async () => {
    const { git, calls } = controller(() => ({ exitCode: 0 }))
    const created = await git.createWorktree('ws', '../escape', '', SIGNAL)
    expect(created.ok).toBe(false)
    expect(calls).toHaveLength(0)
  })

  it('announces a landed move, and stays quiet on a refusal', async () => {
    const landed = controller(() => ({ exitCode: 0 }))
    await landed.git.switchBranch('ws', 'dev', SIGNAL)
    expect(landed.announced).toEqual(['ws'])
    // A refusal changed nothing; a watcher re-reading then would learn only
    // what it already shows.
    const refused = controller(() => ({ exitCode: 1, stderr: 'dirty' }))
    await refused.git.switchBranch('ws', 'dev', SIGNAL)
    expect(refused.announced).toEqual([])
  })
})
