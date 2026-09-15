// @vitest-environment jsdom
/**
 * Branch chip behavior over a fake store: what it renders, what it hides, and
 * the one rule that matters on a refused switch — the label follows the Host's
 * last report, never the click.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { BranchPill } from '../src/client/BranchPill.tsx'
import type { BranchState } from '../src/client/store.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const BASE: BranchState = {
  repository: true,
  current: 'main',
  branches: ['main', 'feature/x'],
  remoteBranches: ['origin/topic'],
  busy: false,
  failure: '',
  worktrees: [],
  worktreeBusy: false,
  worktreeFailure: '',
  worktreeDirty: '',
}

/** Render the chip over a fixed store snapshot. */
function mount(state: Partial<BranchState> = {}) {
  const value = { ...BASE, ...state }
  const switchBranch = vi.fn()
  const checkoutRemote = vi.fn()
  const createBranch = vi.fn()
  const refresh = vi.fn()
  const refreshWorktrees = vi.fn()
  const createWorktree = vi.fn()
  const removeWorktree = vi.fn()
  render(<BranchPill
    t={((key: keyof typeof en) => en[key]) as never}
    useStore={((select: (s: BranchState) => unknown) => select(value)) as never}
    // The view never writes, so the store's action face is present only to
    // satisfy the slot share; a call here would be a defect in the view.
    actions={{} as never}
    switchBranch={switchBranch}
    checkoutRemote={checkoutRemote}
    createBranch={createBranch}
    refresh={refresh}
    refreshWorktrees={refreshWorktrees}
    createWorktree={createWorktree}
    removeWorktree={removeWorktree}
  />)
  return { switchBranch, checkoutRemote, createBranch, refresh, refreshWorktrees, createWorktree, removeWorktree }
}

/** Open the chip's popover. */
function openMenu(): void {
  fireEvent.click(screen.getByLabelText(en['branch.label']))
}

describe('BranchPill', () => {
  it('renders nothing for a workspace that is not a git repository', () => {
    mount({ repository: false })
    // Absent, not disabled: a non-git project keeps its hero row clean.
    expect(screen.queryByLabelText(en['branch.label'])).toBeNull()
  })

  it('shows the checked-out branch and re-reads when the menu opens', () => {
    const { refresh } = mount()
    expect(screen.getByLabelText(en['branch.label']).textContent).toContain('main')
    openMenu()
    // The checkout can move from a terminal, so the list is re-read, not trusted.
    expect(refresh).toHaveBeenCalledOnce()
    expect(screen.getByRole('option', { name: /feature\/x/ })).toBeTruthy()
  })

  it('names a detached HEAD instead of inventing a branch', () => {
    mount({ current: '' })
    expect(screen.getByLabelText(en['branch.label']).textContent).toContain(en['branch.none'])
  })

  it('filters the list and reports when nothing matches', () => {
    mount()
    openMenu()
    const search = screen.getByLabelText(en['branch.search'])
    fireEvent.change(search, { target: { value: 'feat' } })
    expect(screen.queryByRole('option', { name: /^main/ })).toBeNull()
    fireEvent.change(search, { target: { value: 'nope' } })
    expect(screen.getByText(en['branch.empty'])).toBeTruthy()
  })

  it('arms a picked branch and only switches on the confirming click', () => {
    const { switchBranch } = mount()
    openMenu()
    expect(screen.getByRole('option', { name: /^main/ }).hasAttribute('disabled')).toBe(true)
    const row = screen.getByRole('option', { name: /feature\/x/ })
    fireEvent.click(row)
    // The first click only arms: a switch moves files under every session of
    // this workspace, so a mis-click must not be enough.
    expect(switchBranch).not.toHaveBeenCalled()
    expect(screen.getByText(en['branch.confirm'])).toBeTruthy()
    fireEvent.click(screen.getByRole('option', { name: /feature\/x/ }))
    expect(switchBranch).toHaveBeenCalledWith('feature/x')
  })

  it('checks out a remote branch through the tracking verb, not the plain switch', () => {
    const { switchBranch, checkoutRemote } = mount()
    openMenu()
    const row = screen.getByRole('option', { name: /origin\/topic/ })
    fireEvent.click(row)
    fireEvent.click(screen.getByRole('option', { name: /origin\/topic/ }))
    // A plain switch refuses a name the local repository does not have.
    expect(checkoutRemote).toHaveBeenCalledWith('origin/topic')
    expect(switchBranch).not.toHaveBeenCalled()
  })

  it('groups local and remote branches and filters both', () => {
    mount()
    openMenu()
    expect(screen.getByText(en['branch.local'])).toBeTruthy()
    expect(screen.getByText(en['branch.remote'])).toBeTruthy()
    fireEvent.change(screen.getByLabelText(en['branch.search']), { target: { value: 'topic' } })
    expect(screen.queryByText(en['branch.local'])).toBeNull()
    expect(screen.getByRole('option', { name: /origin\/topic/ })).toBeTruthy()
  })

  it('creates a branch from the draft and refuses an empty name', () => {
    const { createBranch } = mount()
    openMenu()
    fireEvent.click(screen.getByText(en['branch.create']))
    const submit = screen.getByText(en['branch.createSubmit'])
    expect(submit.hasAttribute('disabled')).toBe(true)
    fireEvent.change(screen.getByLabelText(en['branch.createPlaceholder']), { target: { value: '  feature/z  ' } })
    fireEvent.click(screen.getByText(en['branch.createSubmit']))
    // Trimmed, but otherwise unjudged: git's ref rules are the authority.
    expect(createBranch).toHaveBeenCalledWith('feature/z')
  })

  it('keeps the label on the branch the checkout is still on and shows git’s refusal', () => {
    // The store still reports `main` because the switch was refused; the label
    // must follow that report rather than the branch the user clicked.
    mount({ failure: 'error: local changes would be overwritten' })
    expect(screen.getByLabelText(en['branch.label']).textContent).toContain('main')
    openMenu()
    expect(screen.getByText('error: local changes would be overwritten')).toBeTruthy()
  })

  it('disables the chip while a switch is in flight', () => {
    mount({ busy: true })
    const chip = screen.getByLabelText(en['branch.label'])
    expect(chip.hasAttribute('disabled')).toBe(true)
    expect(chip.textContent).toContain(en['branch.switching'])
  })
})
