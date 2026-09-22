// @vitest-environment jsdom
/**
 * The Sidebar subagent tab: its type definition, the body's empty and tree
 * states, its catalog observation, and the chip title. The rows themselves are
 * the header dropdown's, asserted in the conversation spec.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type {
  SessionListState, SessionSummary, SubagentCatalogSnapshot,
} from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { SUBAGENTS_ID, SUBAGENTS_KIND, subagentsDefinition } from '../src/client/subagents-definition.tsx'
import { SubagentsBody, type SubagentsBodyProps } from '../src/client/SubagentsBody.tsx'
import { SubagentsTitle } from '../src/client/SubagentsTitle.tsx'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { en, zh } from '../src/client/locales.ts'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** A page type never receives an address; its title thunk takes one anyway. */
const NO_ADDRESS = ''
const PARENT = 'parent' as SessionId
const CHILD = 'child' as SessionId
const GRANDCHILD = 'grandchild' as SessionId
const t = makeTranslate(zh) as SubagentsBodyProps['t']

function summary(id: SessionId, over: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id,
    title: 'worker session',
    displayTitle: 'worker',
    running: true,
    blank: false,
    updatedAt: Date.now(),
    origin: 'subagent',
    parentId: PARENT,
    ...over,
  } as unknown as SessionSummary
}

function catalog(over: Partial<SubagentCatalogSnapshot> = {}): SubagentCatalogSnapshot {
  return {
    entries: [{
      kind: 'child', id: CHILD, mode: 'continuable', label: 'worker',
      activity: 'running', hasChildren: true,
    }],
    parentAvailable: true,
    state: 'ready',
    error: null,
    ...over,
  }
}

function props(
  catalogs: Readonly<Record<SessionId, SubagentCatalogSnapshot>>,
  summaries: Readonly<Record<SessionId, SessionSummary>> = { [CHILD]: summary(CHILD) },
): SubagentsBodyProps & { setCatalogOpen: ReturnType<typeof vi.fn> } {
  const state = {
    ids: [PARENT, CHILD],
    byId: summaries,
    current: PARENT,
    phase: 'ready',
    subagentsByParent: catalogs,
    jobsBySession: {},
    currentAddress: undefined,
  } satisfies SessionListState
  function useSessions<T>(select: (snapshot: SessionListState) => T): T {
    return select(state)
  }
  return {
    sessionId: PARENT,
    useSessions,
    openChild: vi.fn(),
    refresh: vi.fn(),
    setCatalogOpen: vi.fn(),
    t,
  } as unknown as SubagentsBodyProps & { setCatalogOpen: ReturnType<typeof vi.fn> }
}

describe('subagents tab definition', () => {
  it('is a page type with a guide entry, and reads its copy on every call', () => {
    const definition = subagentsDefinition(t)
    expect(definition).toMatchObject({ id: SUBAGENTS_ID, kind: SUBAGENTS_KIND, priority: 'builtin' })
    expect(definition.patterns).toBeUndefined()
    expect(definition.title(NO_ADDRESS)).toBe(zh['tab.label'])
    const [entry] = definition.guide ?? []
    expect(entry?.order).toBe(20)
    expect(entry?.title()).toBe(zh['tab.label'])
    expect(entry?.description?.()).toBe(zh['tab.description'])
    expect(entry?.icon).toBeTypeOf('function')
  })

  it('takes its labels from the active language rather than registration time', () => {
    expect(subagentsDefinition(makeTranslate(en) as SubagentsBodyProps['t']).title(NO_ADDRESS))
      .toBe(en['tab.label'])
  })
})

describe('subagents tab body', () => {
  it('says so before any catalog arrives and when the session delegated nothing', () => {
    const { unmount } = render(<SubagentsBody {...props({})} />)
    expect(screen.getByText(zh['tab.empty'])).toBeTruthy()
    unmount()

    render(<SubagentsBody {...props({ [PARENT]: catalog({ entries: [] }) })} />)
    expect(screen.getByText(zh['tab.empty'])).toBeTruthy()
  })

  it('observes the session catalog while mounted and releases it on unmount', () => {
    const bound = props({ [PARENT]: catalog() })
    const { unmount } = render(<SubagentsBody {...bound} />)
    expect(bound.setCatalogOpen).toHaveBeenCalledWith(PARENT, true)

    unmount()
    expect(bound.setCatalogOpen).toHaveBeenLastCalledWith(PARENT, false)
  })

  it('draws the tree and opens a child row', () => {
    const bound = props({ [PARENT]: catalog() })
    render(<SubagentsBody {...bound} />)
    const tree = screen.getByRole('tree', { name: zh['tree.aria'] })
    const rows = within(tree).getAllByRole('treeitem')
    expect(rows).toHaveLength(1)

    fireEvent.click(rows[0]!)
    expect(bound.openChild).toHaveBeenCalled()
  })

  it('expands a branch, observing it, and releases the branch when it collapses', () => {
    const bound = props(
      { [PARENT]: catalog(), [CHILD]: catalog({
        entries: [{
          kind: 'child', id: GRANDCHILD, mode: 'one-shot', label: 'reviewer',
          activity: 'inactive', hasChildren: false,
        }],
      }) },
      { [CHILD]: summary(CHILD), [GRANDCHILD]: summary(GRANDCHILD, { parentId: CHILD, running: false }) },
    )
    render(<SubagentsBody {...bound} />)
    const tree = screen.getByRole('tree', { name: zh['tree.aria'] })
    const disclosure = within(tree).getAllByRole('button')[0]!

    fireEvent.click(disclosure)
    expect(bound.setCatalogOpen).toHaveBeenCalledWith(CHILD, true)
    expect(within(screen.getByRole('tree', { name: zh['tree.aria'] })).getAllByRole('treeitem').length)
      .toBeGreaterThan(1)

    fireEvent.click(within(screen.getByRole('tree', { name: zh['tree.aria'] })).getAllByRole('button')[0]!)
    expect(bound.setCatalogOpen).toHaveBeenCalledWith(CHILD, false)
    expect(within(screen.getByRole('tree', { name: zh['tree.aria'] })).getAllByRole('treeitem')).toHaveLength(1)
  })

  it('collapses a branch whose own children never loaded, and skips its diagnostic rows', () => {
    const bound = props(
      { [PARENT]: catalog(), [CHILD]: catalog({
        entries: [
          { kind: 'diagnostic', id: 'bad' as SessionId, reason: 'corrupt' },
          {
            kind: 'child', id: GRANDCHILD, mode: 'continuable', label: 'scout',
            activity: 'inactive', hasChildren: true,
          },
        ],
      }) },
      { [CHILD]: summary(CHILD), [GRANDCHILD]: summary(GRANDCHILD, { parentId: CHILD, running: false }) },
    )
    render(<SubagentsBody {...bound} />)
    const disclosures = (): HTMLElement[] =>
      within(screen.getByRole('tree', { name: zh['tree.aria'] })).getAllByRole('button')

    fireEvent.click(disclosures()[0]!)
    // The grandchild is expanded while its own catalog is still absent, so
    // collapsing the branch above it must tolerate the missing entries.
    fireEvent.click(disclosures()[1]!)
    expect(bound.setCatalogOpen).toHaveBeenCalledWith(GRANDCHILD, true)

    fireEvent.click(disclosures()[0]!)
    expect(bound.setCatalogOpen).toHaveBeenCalledWith(GRANDCHILD, false)
    expect(within(screen.getByRole('tree', { name: zh['tree.aria'] })).getAllByRole('treeitem')).toHaveLength(1)
  })

  it('runs no clock for a session whose descendants have all settled', () => {
    vi.useFakeTimers()
    const setInterval = vi.spyOn(globalThis, 'setInterval')
    // No subagent-origin summaries: the lineage index knows no descendants here.
    render(<SubagentsBody {...props({ [PARENT]: catalog() }, {})} />)
    expect(screen.getByRole('tree', { name: zh['tree.aria'] })).toBeTruthy()
    expect(setInterval).not.toHaveBeenCalled()
  })

  it('ticks a running row without an open dropdown', () => {
    vi.useFakeTimers()
    const bound = props({ [PARENT]: catalog() })
    render(<SubagentsBody {...bound} />)
    expect(screen.getByRole('tree', { name: zh['tree.aria'] })).toBeTruthy()
    // The interval exists only while a descendant runs; advancing it must not throw.
    expect(() => { vi.advanceTimersByTime(2_000) }).not.toThrow()
  })
})

describe('subagents tab title', () => {
  it('draws the glyph before the tab title', () => {
    const titleProps = {
      useTabInfo: () => ({ tab: { title: zh['tab.label'] } }),
    } as unknown as PropsRuntime<'sidebar.right.pane.tab.title'>
    const { container } = render(<SubagentsTitle {...titleProps} />)
    expect(container.querySelector('svg')).toBeTruthy()
    expect(container.textContent).toContain(zh['tab.label'])
  })
})
