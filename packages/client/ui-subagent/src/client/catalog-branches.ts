/**
 * Expansion state of one subagent tree, and the observation it owes the
 * runtime, shared by the header dropdown and the Sidebar tab.
 *
 * Every parent whose rows are on screen is reported through `setCatalogOpen`
 * so membership frames refresh only the branches someone is reading. The
 * report is per parent id and must be released exactly once, so the observed
 * set lives in a ref and is drained on unmount, whichever surface holds it.
 */
import { useEffect, useRef, useState } from 'react'
import type { SubagentCatalogSnapshot } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** Expansion state and the two writes a tree surface performs on it. */
export interface CatalogBranches {
  /** Parents whose children are currently drawn. */
  expanded: ReadonlySet<SessionId>
  /** Report or release one parent without changing what is expanded. */
  observe: (parentSessionId: SessionId, open: boolean) => void
  /** Expand a collapsed branch, or collapse it together with everything under it. */
  toggleBranch: (childSessionId: SessionId) => void
  /** Release every observed parent and collapse the whole tree. */
  closeAll: () => void
}

/**
 * Track which branches are open and keep the runtime told about them.
 * @param catalogs - every known parent's catalog, for walking a collapsing branch.
 * @param setCatalogOpen - the runtime report; read through a ref so a changed
 *   identity never re-runs the release.
 * @returns the expansion state and its writes.
 */
export function useCatalogBranches(
  catalogs: Readonly<Record<SessionId, SubagentCatalogSnapshot>>,
  setCatalogOpen: (parentSessionId: SessionId, open: boolean) => void,
): CatalogBranches {
  const [expanded, setExpanded] = useState<ReadonlySet<SessionId>>(() => new Set())
  const observed = useRef(new Set<SessionId>())
  const setCatalogOpenRef = useRef(setCatalogOpen)
  setCatalogOpenRef.current = setCatalogOpen

  useEffect(() => () => {
    for (const parentSessionId of observed.current) setCatalogOpenRef.current(parentSessionId, false)
    observed.current.clear()
  }, [])

  const observe = (parentSessionId: SessionId, open: boolean): void => {
    if (open) observed.current.add(parentSessionId)
    else observed.current.delete(parentSessionId)
    setCatalogOpen(parentSessionId, open)
  }

  const closeAll = (): void => {
    for (const parentSessionId of observed.current) setCatalogOpen(parentSessionId, false)
    observed.current.clear()
    setExpanded(new Set())
  }

  const closeBranch = (root: SessionId): void => {
    const closing = new Set<SessionId>()
    const visit = (parentSessionId: SessionId): void => {
      if (closing.has(parentSessionId) || !expanded.has(parentSessionId)) return
      closing.add(parentSessionId)
      for (const entry of catalogs[parentSessionId]?.entries ?? []) {
        if (entry.kind === 'child') visit(entry.id)
      }
    }
    visit(root)
    for (const parentSessionId of closing) observe(parentSessionId, false)
    setExpanded(current => new Set([...current].filter(id => !closing.has(id))))
  }

  const toggleBranch = (childSessionId: SessionId): void => {
    if (expanded.has(childSessionId)) {
      closeBranch(childSessionId)
      return
    }
    setExpanded(current => new Set(current).add(childSessionId))
    observe(childSessionId, true)
  }

  return { expanded, observe, toggleBranch, closeAll }
}
