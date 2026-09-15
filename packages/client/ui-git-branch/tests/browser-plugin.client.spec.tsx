// @vitest-environment jsdom
/**
 * ui-git-branch browser half on a real cordis Context with a scripted `git`
 * Remote namespace: the plugin registers the hero seat, adopts the workspace
 * the Hero owner names, and — the part the view cannot show — re-reads the
 * checkout after a switch whether git accepted it or refused it.
 */
import { Context, Service } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import type { BranchPillHeroInjected } from '../src/client/BranchPill.tsx'
import type { BranchState } from '../src/client/store.ts'
import { apply, inject } from '../src/client/index.ts'
import { apply as nodeApply } from '../src/index.ts'

afterEach(cleanup)

const STATUS = {
  repository: true, current: 'main', branches: ['main', 'dev'], remoteBranches: ['origin/topic'],
}

/** Mount the plugin over a scripted git namespace. */
async function bench(options: {
  switchOutcome?: { ok: boolean; message?: string }
  switchFails?: string
  removeOutcome?: { ok: boolean; message?: string; dirty?: boolean }
} = {}) {
  const ctx = new Context()
  const calls: string[] = []
  // The Host announcement, as the plugin consumes it: one supervised stream
  // whose items each carry `accept`.
  let announce: ((workspaceId: string) => void) | undefined
  class RemoteService extends Service {
    constructor(serviceCtx: Context) { super(serviceCtx, 'remote') }

    $stream<T>(): AsyncIterable<{ value: T; accept: () => void }> & { dispose: () => Promise<void> } {
      const queue: Array<{ value: T; accept: () => void }> = []
      let wake: (() => void) | undefined
      announce = (workspaceId: string) => {
        queue.push({ value: { workspaceId } as T, accept: () => {} })
        wake?.()
      }
      let open = true
      return {
        dispose: () => { open = false; wake?.(); return Promise.resolve() },
        async *[Symbol.asyncIterator]() {
          while (open) {
            while (queue.length > 0) {
              const next = queue.shift()
              if (next !== undefined) yield next
            }
            if (!open) return
            await new Promise<void>((resolve) => { wake = resolve })
          }
        },
      }
    }
  }
  void new RemoteService(ctx)
  ctx.provide('remote.git', {
    checkoutChanges: () => ({ [Symbol.asyncIterator]: () => ({ next: () => new Promise<never>(() => {}) }) }),
    status: (workspaceId: string) => {
      calls.push(`status:${workspaceId}`)
      return Promise.resolve({ ok: true, value: STATUS })
    },
    checkoutRemote: (workspaceId: string, remoteRef: string) => {
      calls.push(`track:${workspaceId}:${remoteRef}`)
      return Promise.resolve({ ok: true, value: { ok: true } })
    },
    createBranch: (workspaceId: string, name: string) => {
      calls.push(`create:${workspaceId}:${name}`)
      return Promise.resolve({ ok: true, value: { ok: true } })
    },
    worktrees: (workspaceId: string) => {
      calls.push(`worktrees:${workspaceId}`)
      return Promise.resolve({ ok: true, value: [] })
    },
    createWorktree: (workspaceId: string, name: string) => {
      calls.push(`wt-create:${workspaceId}:${name}`)
      return Promise.resolve({ ok: true, value: { ok: true } })
    },
    removeWorktree: (workspaceId: string, path: string, force: boolean) => {
      calls.push(`wt-remove:${workspaceId}:${path}:${String(force)}`)
      return Promise.resolve({ ok: true, value: options.removeOutcome ?? { ok: true } })
    },
    switchBranch: (workspaceId: string, branch: string) => {
      calls.push(`switch:${workspaceId}:${branch}`)
      if (options.switchFails !== undefined) {
        return Promise.resolve({ ok: false, error: { message: options.switchFails } })
      }
      return Promise.resolve({ ok: true, value: options.switchOutcome ?? { ok: true } })
    },
  })
  ctx.provide('workspaces', {
    list: { getSnapshot: () => ({ items: [{ workspaceId: 'ws-session', sessionIds: ['s-1'] }] }) },
  })
  await ctx.plugin(SlotRegistry).await()
  ctx.slots.register({
    name: 'root', children: {
      'conversation.hero.context': { kind: 'list', scope: 'root' },
      'conversation.input.left': { kind: 'list', scope: 'session' },
    },
  } as never, (() => null) as never)
  ctx.provide('locale', new LocaleRuntime(ctx))
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  const entry = ctx.slots.entries('conversation.hero.context')[0]
  const state: BranchState = {
    repository: false, current: '', branches: [], remoteBranches: [], busy: false, failure: '',
    worktrees: [], worktreeBusy: false, worktreeFailure: '', worktreeDirty: '',
  }
  const actions = {
    sync: (
      repository: boolean, current: string,
      branches: readonly string[], remoteBranches: readonly string[],
    ) => {
      state.repository = repository
      state.current = current
      state.branches = [...branches]
      state.remoteBranches = [...remoteBranches]
    },
    setBusy: (busy: boolean) => { state.busy = busy },
    setFailure: (failure: string) => { state.failure = failure },
    syncWorktrees: (worktrees: BranchState['worktrees']) => { state.worktrees = worktrees },
    setWorktreeBusy: (busy: boolean) => { state.worktreeBusy = busy },
    setWorktreeOutcome: (failure: string, dirtyPath: string) => {
      state.worktreeFailure = failure
      state.worktreeDirty = dirtyPath
    },
  }
  const face = (entry?.inject as unknown as (a: typeof actions) => BranchPillHeroInjected)(actions)
  return { ctx, calls, state, face, entry, announce: (id: string) => { announce?.(id) } }
}

/** Let the plugin's queued Remote reads settle. */
const settle = async (): Promise<void> => { await Promise.resolve(); await Promise.resolve() }

describe('ui-git-branch browser plugin', () => {
  it('seats the chip in the hero and in the input bar, never in the card dock', async () => {
    const { ctx, entry } = await bench()
    expect(entry).toBeDefined()
    expect(ctx.slots.entries('conversation.input.left')).toHaveLength(1)
    // The dock above the input stacks full-width cards; a lone chip there
    // floats far from the box it belongs to.
    expect(ctx.slots.entries('conversation.input.dock')).toHaveLength(0)
  })

  it('resolves the input-bar seat’s workspace from its own session', async () => {
    const { ctx, calls } = await bench()
    const dock = ctx.slots.entries('conversation.input.left')[0]
    const noop = { sync: () => {}, setBusy: () => {}, setFailure: () => {} }
    ;(dock?.inject as unknown as (id: string, a: typeof noop) => unknown)('s-1', noop)
    await settle()
    // Not "the current workspace": the chip names the checkout its own session
    // runs in.
    expect(calls).toContain('status:ws-session')
  })

  it('reads the checkout only once the Hero names a workspace', async () => {
    const { calls, state, face } = await bench()
    // Nothing to ask about before the owner share arrives.
    expect(calls).toEqual([])
    face.adoptWorkspace('ws-1')
    await settle()
    expect(calls).toEqual(['status:ws-1'])
    expect(state).toMatchObject({ repository: true, current: 'main', branches: ['main', 'dev'] })
  })

  it('ignores a repeated workspace and follows a change', async () => {
    const { calls, face } = await bench()
    face.adoptWorkspace('ws-1')
    face.adoptWorkspace('ws-1')
    await settle()
    expect(calls).toEqual(['status:ws-1'])
    face.adoptWorkspace('ws-2')
    await settle()
    expect(calls).toEqual(['status:ws-1', 'status:ws-2'])
  })

  it('re-reads after an accepted switch and clears the previous refusal', async () => {
    const { calls, state, face } = await bench()
    face.adoptWorkspace('ws-1')
    await settle()
    face.switchBranch('dev')
    await settle()
    expect(calls).toEqual(['status:ws-1', 'switch:ws-1:dev', 'status:ws-1'])
    expect(state.busy).toBe(false)
    expect(state.failure).toBe('')
  })

  it('carries git’s refusal and still re-reads, so the label returns to the real branch', async () => {
    const { calls, state, face } = await bench({ switchOutcome: { ok: false, message: 'dirty tree' } })
    face.adoptWorkspace('ws-1')
    await settle()
    face.switchBranch('dev')
    await settle()
    expect(state.failure).toBe('dirty tree')
    // The re-read is what repaints the branch the checkout is still on.
    expect(calls).toContain('status:ws-1')
    expect(calls.filter(call => call.startsWith('status')).length).toBe(2)
    expect(state.busy).toBe(false)
  })

  it('reports a transport failure the same way as a refusal', async () => {
    const { state, face } = await bench({ switchFails: 'connection lost' })
    face.adoptWorkspace('ws-1')
    await settle()
    face.switchBranch('dev')
    await settle()
    expect(state.failure).toBe('connection lost')
    expect(state.busy).toBe(false)
  })

  it('re-reads the checkout after a remote checkout and after a creation too', async () => {
    const { calls, face } = await bench()
    face.adoptWorkspace('ws-1')
    await settle()
    face.checkoutRemote('origin/topic')
    await settle()
    face.createBranch('feature/z')
    await settle()
    // Every checkout-moving verb settles the same way: act, then re-read.
    expect(calls).toEqual([
      'status:ws-1',
      'track:ws-1:origin/topic', 'status:ws-1',
      'create:ws-1:feature/z', 'status:ws-1',
    ])
  })

  it('re-reads on a Host announcement, without waiting for focus', async () => {
    const { calls, face, announce } = await bench()
    face.adoptWorkspace('ws-1')
    await settle()
    expect(calls).toEqual(['status:ws-1'])
    // The model moving the checkout through git_worktree is exactly the change
    // the browser cannot see coming.
    announce('ws-1')
    await settle()
    expect(calls).toEqual(['status:ws-1', 'status:ws-1'])
  })

  it('arms a force retry only for the dirty refusal, and only for that path', async () => {
    const { state, face } = await bench({
      removeOutcome: { ok: false, message: 'contains modified or untracked files', dirty: true },
    })
    face.adoptWorkspace('ws-1')
    await settle()
    face.removeWorktree('/wt/topic', false)
    await settle()
    // Force is reachable only after git refused for uncommitted work, so it
    // can never be a first click.
    expect(state.worktreeDirty).toBe('/wt/topic')
    expect(state.worktreeFailure).toContain('modified or untracked')
  })

  it('leaves every other worktree refusal unforceable', async () => {
    const { state, face } = await bench({ removeOutcome: { ok: false, message: 'is a main working tree' } })
    face.adoptWorkspace('ws-1')
    await settle()
    face.removeWorktree('/repo', false)
    await settle()
    expect(state.worktreeDirty).toBe('')
    expect(state.worktreeFailure).toContain('main working tree')
  })

  it('keeps the node half inert', () => {
    expect(nodeApply()).toBeUndefined()
  })
})
