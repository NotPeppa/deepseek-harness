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
import { DockBranchPill } from '../src/client/BranchPill.tsx'
import { apply as nodeApply } from '../src/index.ts'

afterEach(cleanup)

const STATUS = {
  repository: true, current: 'main', branches: ['main', 'dev'], remoteBranches: ['origin/topic'],
}

/** Mount the plugin over a scripted git namespace. */
async function bench(options: {
  switchOutcome?: { ok: boolean; message?: string }
  switchFails?: string
} = {}) {
  const ctx = new Context()
  const calls: string[] = []
  class RemoteService extends Service {
    constructor(serviceCtx: Context) { super(serviceCtx, 'remote') }
  }
  void new RemoteService(ctx)
  ctx.provide('remote.git', {
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
      'conversation.input.dock': { kind: 'list', scope: 'session' },
    },
  } as never, (() => null) as never)
  ctx.provide('locale', new LocaleRuntime(ctx))
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  const entry = ctx.slots.entries('conversation.hero.context')[0]
  const state: BranchState = {
    repository: false, current: '', branches: [], remoteBranches: [], busy: false, failure: '',
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
  }
  const face = (entry?.inject as unknown as (a: typeof actions) => BranchPillHeroInjected)(actions)
  return { ctx, calls, state, face, entry }
}

/** Let the plugin's queued Remote reads settle. */
const settle = async (): Promise<void> => { await Promise.resolve(); await Promise.resolve() }

describe('ui-git-branch browser plugin', () => {
  it('seats the chip in the hero and in the input dock', async () => {
    const { ctx, entry } = await bench()
    expect(entry).toBeDefined()
    expect(ctx.slots.entries('conversation.input.dock')).toHaveLength(1)
  })

  it('withdraws the dock seat during the Hero phase, so one screen shows one chip', () => {
    // The dock renders in the Hero phase too — a blank session is still a
    // session — and the Hero already seats this chip.
    expect(DockBranchPill({ hero: true } as never)).toBeNull()
    expect(DockBranchPill({ hero: false, useStore: (() => false) } as never)).not.toBeNull()
  })

  it('resolves a dock seat’s workspace from its own session', async () => {
    const { ctx, calls } = await bench()
    const dock = ctx.slots.entries('conversation.input.dock')[0]
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

  it('keeps the node half inert', () => {
    expect(nodeApply()).toBeUndefined()
  })
})
