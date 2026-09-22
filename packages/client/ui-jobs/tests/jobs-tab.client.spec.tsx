// @vitest-environment jsdom
/**
 * The Sidebar jobs tab: its type definition, the body's two states, and the
 * chip title. The rows themselves are the header action's, asserted there.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionJob as JobView } from '@deepseek-ai/dsh-api-session-controller/types'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { JOBS_ID, JOBS_KIND, jobsDefinition } from '../src/client/definition.tsx'
import { JobsBody, type JobsBodyProps } from '../src/client/JobsBody.tsx'
import { JobsTitle } from '../src/client/JobsTitle.tsx'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { en, zh } from '../src/client/locales.ts'

const SESSION = 'session' as SessionId
/** A page type never receives an address; its title thunk takes one anyway. */
const NO_ADDRESS = ''
const START = 1_700_000_000_000
const t = makeTranslate(zh) as JobsBodyProps['t']

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(START)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function job(over: Partial<JobView> = {}): JobView {
  return {
    id: 'bash-1' as JobView['id'],
    kind: 'bash',
    label: 'pnpm run build',
    status: 'running',
    startedAt: START,
    ...over,
  }
}

function props(jobs: readonly JobView[] | undefined): JobsBodyProps {
  const state = {
    ids: [SESSION],
    byId: {},
    current: SESSION,
    phase: 'ready',
    subagentsByParent: {},
    jobsBySession: jobs === undefined ? {} : { [SESSION]: jobs },
    currentAddress: undefined,
  } satisfies SessionListState
  function useSessions<T>(select: (snapshot: SessionListState) => T): T {
    return select(state)
  }
  return { sessionId: SESSION, useSessions, t } as unknown as JobsBodyProps
}

describe('jobs tab definition', () => {
  it('is a page type with a guide entry, and reads its copy on every call', () => {
    const definition = jobsDefinition(t)
    expect(definition).toMatchObject({ id: JOBS_ID, kind: JOBS_KIND, priority: 'builtin' })
    // A page claims no address: it is opened by kind from the guide, so the
    // chip title ignores the address the registry hands every type.
    expect(definition.patterns).toBeUndefined()
    expect(definition.title(NO_ADDRESS)).toBe(zh['tab.label'])
    const [entry] = definition.guide ?? []
    expect(entry?.order).toBe(30)
    expect(entry?.title()).toBe(zh['tab.label'])
    expect(entry?.description?.()).toBe(zh['tab.description'])
    expect(entry?.icon).toBeTypeOf('function')
  })

  it('takes its labels from the active language rather than registration time', () => {
    const definition = jobsDefinition(makeTranslate(en))
    expect(definition.title(NO_ADDRESS)).toBe(en['tab.label'])
  })
})

describe('jobs tab body', () => {
  it('says so when the session has run nothing', () => {
    render(<JobsBody {...props(undefined)} />)
    expect(screen.getByText(zh['tab.empty'])).toBeTruthy()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('lists the session jobs and ticks a live row without an open popover', () => {
    render(<JobsBody {...props([job(), job({
      id: 'bash-2' as JobView['id'], status: 'completed', startedAt: START - 8_000, finishedAt: START - 3_000,
    })])} />)
    const rows = within(screen.getByRole('list', { name: zh['list.aria'] })).getAllByRole('listitem')
    // Live first, settled after, each with its own duration source.
    expect(rows[0]?.textContent).toContain('0秒')
    expect(rows[1]?.textContent).toContain('5秒')

    act(() => { vi.advanceTimersByTime(2_000) })
    expect(within(screen.getByRole('list', { name: zh['list.aria'] })).getAllByRole('listitem')[0]?.textContent)
      .toContain('2秒')
  })

  it('leaves the clock stopped once every job has settled', () => {
    render(<JobsBody {...props([job({ status: 'failed', finishedAt: START - 1_000, startedAt: START - 4_000 })])} />)
    act(() => { vi.advanceTimersByTime(5_000) })
    expect(screen.getAllByRole('listitem')[0]?.textContent).toContain('3秒')
  })
})

describe('jobs tab title', () => {
  it('draws the glyph before the tab title', () => {
    const titleProps = {
      useTabInfo: () => ({ tab: { title: zh['tab.label'] } }),
    } as unknown as PropsRuntime<'sidebar.right.pane.tab.title'>
    const { container } = render(<JobsTitle {...titleProps} />)
    expect(container.querySelector('svg')).toBeTruthy()
    expect(container.textContent).toContain(zh['tab.label'])
  })
})
