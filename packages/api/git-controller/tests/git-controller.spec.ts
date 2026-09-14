/** Branch reading and the workspace fence, over a scripted subprocess seam. */
import { describe, expect, it } from 'vitest'
import { GitController } from '../src/index.ts'

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
): { git: GitController; calls: string[][] } {
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
  return { git, calls }
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
})
