/** ui-subagent browser half: catalog actions and read-only composer routing. */
import { Context } from '@deepseek-ai/cordis'
import { stubSettingsScope } from '@deepseek-ai/dsh-client-test-runtime'
import { describe, expect, it } from 'vitest'
import type {
  SessionListState, SessionSnapshot, SessionSummary,
} from '@deepseek-ai/dsh-api-session-controller/client'
import type { SubagentAddress } from '@deepseek-ai/dsh-subagent/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ComposerChainProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { apply as applyLocale, inject as localeInject } from '@deepseek-ai/dsh-client-locale/client'
import {
  SubagentHeaderLineage, type SubagentCatalogInjected,
} from '../src/client/SubagentHeaderLineage.tsx'
import {
  SubagentReadOnlyComposer, type SubagentReadOnlyMatch,
} from '../src/client/SubagentReadOnlyComposer.tsx'
import { apply, inject } from '../src/client/index.ts'
import { SUBAGENTS_ID } from '../src/client/subagents-definition.tsx'

function summary(partial: Partial<SessionSummary> & { id: SessionId }): SessionSummary {
  return {
    displayTitle: partial.id,
    running: false,
    updatedAt: 0,
    ...partial,
  } as SessionSummary
}

const sid = (id: string) => id as SessionId

/** Fake root sessions face for catalog actions. */
function sessionsWith(sessions: SessionSummary[]) {
  const byId: Record<string, SessionSummary> = {}
  for (const s of sessions) byId[s.id] = s
  const snapshot = { ids: sessions.map(s => s.id), byId, current: undefined } as unknown as SessionListState
  const actionCalls: { method: string; args: unknown[] }[] = []
  return {
    list: {
      getSnapshot: () => snapshot,
      subscribe: () => () => {},
    },
    actionCalls,
    openSubagent: (address: SubagentAddress) => {
      actionCalls.push({ method: 'openSubagent', args: [address] })
    },
    refreshSubagents: (parentSessionId: SessionId) => {
      actionCalls.push({ method: 'refreshSubagents', args: [parentSessionId] })
      return Promise.resolve()
    },
    setSubagentCatalogOpen: (parentSessionId: SessionId, open: boolean) => {
      actionCalls.push({ method: 'setSubagentCatalogOpen', args: [parentSessionId, open] })
    },
  }
}

async function provideSlotFaces(ctx: Context): Promise<void> {
  await ctx.plugin(SlotRegistry).await()
  ctx.slots.register({
    name: 'root',
    children: {
      'conversation.session.header.lineage': { kind: 'single', scope: 'session' },
      'conversation.composer': { kind: 'chain', scope: 'session' },
      'sidebar.right.pane.tab': { kind: 'keyed', scope: 'session' },
      'sidebar.right.pane.tab.title': { kind: 'keyed', scope: 'session' },
    },
  } as never, () => null)
}

/** Boot the plugin over fake sessions and slot faces. */
async function fullBench(sessions: SessionSummary[], sidebar = true) {
  const ctx = new Context()
  const face = sessionsWith(sessions)
  const registered: string[] = []
  ctx.provide('sessions', face)
  ctx.provide('remote', { $on: () => () => {} } as never)
  ctx.provide('settingsScope', { bind: () => stubSettingsScope().scope } as never)
  if (sidebar) {
    ctx.provide('sidebarRightTabs', {
      register: (definition: { id: string }) => {
        registered.push(definition.id)
        return () => { registered.splice(registered.indexOf(definition.id), 1) }
      },
    } as never)
  }
  await provideSlotFaces(ctx)
  await ctx.plugin({ inject: localeInject, apply: applyLocale }).await()
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { face, ctx, fiber, registered }
}

const FAMILY: SessionSummary[] = [
  summary({ id: sid('parent'), displayTitle: 'parent', running: true }),
  summary({ id: sid('c1'), parentId: sid('parent'), displayTitle: 'worker-1', running: true }),
  summary({ id: sid('c2'), parentId: sid('parent'), displayTitle: 'worker-2', running: true }),
  // Filtered out: not running / other parent / label miss.
  summary({ id: sid('c3'), parentId: sid('parent'), displayTitle: 'worker-3', running: false }),
  summary({ id: sid('c4'), parentId: sid('other'), displayTitle: 'worker-4', running: true }),
  summary({ id: sid('c5'), parentId: sid('parent'), displayTitle: 'scout', running: true }),
]

describe('apply', () => {
  it('registers the Sidebar tab type, body, and title, and releases them with the fiber', async () => {
    const { ctx, fiber, registered } = await fullBench(FAMILY)
    expect(registered).toEqual([SUBAGENTS_ID])
    const keys = (name: 'sidebar.right.pane.tab' | 'sidebar.right.pane.tab.title'): unknown[] =>
      ctx.slots.entries(name).map(entry => entry.options.key)
    expect(keys('sidebar.right.pane.tab')).toContain(SUBAGENTS_ID)
    expect(keys('sidebar.right.pane.tab.title')).toContain(SUBAGENTS_ID)

    await fiber.dispose()
    expect(registered).toEqual([])
    expect(keys('sidebar.right.pane.tab')).not.toContain(SUBAGENTS_ID)
  })

  it('keeps the conversation seats when no right Sidebar is composed', async () => {
    const { ctx } = await fullBench(FAMILY, false)
    expect(ctx.slots.entries('conversation.session.header.lineage')).toHaveLength(1)
    expect(ctx.slots.entries('sidebar.right.pane.tab')).toHaveLength(0)
  })

  it('declares the services it binds', () => {
    expect(inject).toEqual(['sessions', 'slots', 'locale'])
  })

  it('registers catalog actions and selects read-only subagent composers from session facts', async () => {
    const { ctx, face } = await fullBench(FAMILY)
    const catalogEntry = ctx.slots.entries('conversation.session.header.lineage')
      .find(entry => entry.component === SubagentHeaderLineage)!
    const actions = (catalogEntry.inject as unknown as (id: SessionId) => SubagentCatalogInjected)(sid('parent'))
    const address: SubagentAddress = {
      parentSessionId: sid('parent'),
      childSessionId: sid('c1'),
      mode: 'continuable',
    }
    actions.openChild(address)
    actions.refresh(sid('parent'))
    actions.setCatalogOpen(sid('parent'), true)
    expect(face.actionCalls).toEqual([
      { method: 'openSubagent', args: [address] },
      { method: 'refreshSubagents', args: [sid('parent')] },
      { method: 'setSubagentCatalogOpen', args: [sid('parent'), true] },
    ])

    const composerEntry = ctx.slots.entries('conversation.composer')
      .find(entry => entry.component === SubagentReadOnlyComposer)!
    const select = composerEntry.select as (owner: ComposerChainProps) => SubagentReadOnlyMatch | null
    const owner = (
      subagent: SessionSnapshot['subagent'] | undefined,
      running = false,
    ): ComposerChainProps => ({
      sessionId: subagent?.address.childSessionId,
      session: subagent === undefined
        ? undefined
        : ({ subagent, running } as SessionSnapshot),
      pendingInteraction: undefined,
    })
    expect(select(owner(undefined))).toBeNull()
    expect(select(owner(null))).toBeNull()
    expect(select(owner({ address: { ...address, mode: 'one-shot' }, parentAvailable: true })))
      .toEqual({ reason: 'one-shot' })
    // One-shot stays read-only even while running: it has no stop action.
    expect(select(owner({ address: { ...address, mode: 'one-shot' }, parentAvailable: true }, true)))
      .toEqual({ reason: 'one-shot' })
    expect(select(owner({ address }))).toBeNull()
    expect(select(owner({ address, parentAvailable: true }))).toBeNull()
    expect(select(owner({ address, parentAvailable: false })))
      .toEqual({ reason: 'parent-unavailable' })
    // A RUNNING parent-offline continuable yields the default composer, whose
    // disabled input still carries the primary Stop; stopped, it takes back over.
    expect(select(owner({ address, parentAvailable: false }, true))).toBeNull()
  })
})
