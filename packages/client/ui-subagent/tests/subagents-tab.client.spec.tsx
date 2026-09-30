// @vitest-environment jsdom
/** Persistent subagent catalog over the current shared projection snapshots. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeTranslate, RemoteError } from '@deepseek-ai/dsh-client-test-runtime'
import type { SessionListState, SessionProjectionSnapshot, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { SubagentsBody, type SubagentsBodyProps } from '../src/client/SubagentsBody.tsx'
import { SubagentsTitle } from '../src/client/SubagentsTitle.tsx'
import { SUBAGENTS_ID, SUBAGENTS_KIND, subagentsDefinition } from '../src/client/subagents-definition.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)
const PARENT = SessionId('parent')
const CHILD = SessionId('child')
const GRANDCHILD = SessionId('grandchild')
const t = makeTranslate(zh) as SubagentsBodyProps['t']
const child: SessionSummary = {
  id: CHILD, title: 'worker', displayTitle: 'worker', running: false,
  blank: false, updatedAt: 0, origin: 'subagent', parentId: PARENT, retainedBy: {},
}

function catalog(id = CHILD, label = 'worker'): SessionProjectionSnapshot {
  return { state: 'ready', error: null, values: { subagentCatalog: [{ id, createdAt: 0, mode: 'continuable', label }] } }
}

function props(projectionsBySession: SessionListState['projectionsBySession'] = {}) {
  const state: SessionListState = { ids: [PARENT, CHILD], byId: { [CHILD]: child }, phase: 'ready', projectionsBySession }
  const openChild = vi.fn()
  const refreshProjection = vi.fn()
  const result = {
    sessionId: PARENT, t, useSessions: select => select(state),
    useSessionStatus: select => select(new Map()), openChild, openChildAside: vi.fn(), refreshProjection,
  } as SubagentsBodyProps
  return { ...result, openChild, refreshProjection }
}

describe('persistent subagent tab', () => {
  it('registers a localized page and guide entry', () => {
    const definition = subagentsDefinition(t)
    expect(definition).toMatchObject({ id: SUBAGENTS_ID, kind: SUBAGENTS_KIND })
    expect(definition.guide?.[0]?.title()).toBe(zh['tab.label'])
  })

  it('shows its empty state and refreshes the root projection when mounted', () => {
    const bound = props()
    render(<SubagentsBody {...bound} />)
    expect(screen.getByText(zh['tab.empty'])).toBeTruthy()
    expect(bound.refreshProjection).toHaveBeenCalledWith(PARENT)
  })

  it('opens a child from the persistent tree', () => {
    const bound = props({ [PARENT]: catalog() })
    render(<SubagentsBody {...bound} />)
    fireEvent.click(screen.getByText('worker', { selector: 'span' }))
    expect(bound.openChild).toHaveBeenCalledWith({ parentSessionId: PARENT, childSessionId: CHILD, mode: 'continuable' })
  })

  it('keeps an empty failed catalog visible with its retry action', () => {
    const bound = props({ [PARENT]: { state: 'error', values: {}, error: new RemoteError('gateway/internal', 'Catalog unavailable', {}) } })
    render(<SubagentsBody {...bound} />)
    expect(screen.getByText('Catalog unavailable')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: zh.retry }))
    expect(bound.refreshProjection).toHaveBeenCalledTimes(2)
  })

  it('expands and collapses a loaded child catalog', () => {
    const bound = props({ [PARENT]: catalog(), [CHILD]: catalog(GRANDCHILD, 'reviewer') })
    render(<SubagentsBody {...bound} />)
    fireEvent.click(screen.getByRole('button', { name: zh['branch.expand'].replace('{label}', 'worker') }))
    expect(bound.refreshProjection).toHaveBeenCalledWith(CHILD)
    expect(screen.getByText('reviewer', { selector: 'span' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: zh['branch.collapse'].replace('{label}', 'worker') }))
    expect(screen.queryByText('reviewer', { selector: 'span' })).toBeNull()
  })

  it('keeps the localized title and icon', () => {
    const { container } = render(createElement(SubagentsTitle, { useTabInfo: () => ({ tab: { title: zh['tab.label'] } }) } as never))
    expect(container.querySelector('svg')).toBeTruthy()
    expect(container.textContent).toBe(zh['tab.label'])
  })
})
