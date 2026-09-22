/**
 * The `subagents` tab body: this session's subagent tree, the same rows the
 * session-header dropdown draws, in a panel that stays open while they run.
 *
 * The tab keeps every catalog it shows observed for as long as it is mounted,
 * so a child that appears or finishes reaches the tree without a reopen.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { CatalogRows } from './SubagentHeaderLineage.tsx'
import type { SubagentCatalogInjected } from './SubagentHeaderLineage.tsx'
import { indexSubagentDescendants } from './subagent-lineage.ts'
import { useCatalogBranches } from './catalog-branches.ts'
import type { NS } from './locales.ts'
import css from './SubagentHeaderLineage.module.css'
import panel from './SubagentsBody.module.css'

/** Full props for the Sidebar subagent tab body. */
export type SubagentsBodyProps =
  PropsRuntime<'sidebar.right.pane.tab'> & SubagentCatalogInjected & PropsLocale<typeof NS>

/**
 * The session's subagent tree, or its empty line when it delegated nothing.
 * @param props - runtime slot currency, the catalog actions, and the copy.
 * @returns the panel body.
 */
export function SubagentsBody({
  sessionId, useSessions, openChild, refresh, setCatalogOpen, t,
}: SubagentsBodyProps): ReactNode {
  const catalogs = useSessions(state => state.subagentsByParent)
  const summaries = useSessions(state => state.byId)
  const catalog = catalogs[sessionId]
  const { expanded, observe, toggleBranch } = useCatalogBranches(catalogs, setCatalogOpen)
  const [now, setNow] = useState(() => Date.now())
  // The session's own catalog is observed for as long as the tab is mounted;
  // the branch state releases it, and every expanded branch, on unmount.
  const observeRef = useRef(observe)
  observeRef.current = observe
  const descendants = useMemo(
    () => indexSubagentDescendants(summaries).get(sessionId),
    [sessionId, summaries],
  )
  const runningCount = descendants?.runningCount ?? 0

  useEffect(() => { observeRef.current(sessionId, true) }, [sessionId])

  useEffect(() => {
    if (runningCount === 0) return
    setNow(Date.now())
    const timer = setInterval(() => { setNow(Date.now()) }, 1_000)
    return () => { clearInterval(timer) }
  }, [runningCount])

  // A catalog that has never loaded and a session with no children read the
  // same until the first snapshot arrives; both say "nothing here" rather than
  // an empty tree with no explanation.
  if (catalog === undefined || (catalog.state === 'ready' && catalog.entries.length === 0)) {
    return <p className={panel.empty}>{t('tab.empty')}</p>
  }
  return (
    <div className={`${css.menu} ${panel.tree}`} role="tree" aria-label={t('tree.aria')}>
      <CatalogRows
        parentSessionId={sessionId}
        currentSessionId={undefined}
        catalog={catalog}
        catalogs={catalogs}
        summaries={summaries}
        expanded={expanded}
        level={1}
        now={now}
        openChild={openChild}
        refresh={refresh}
        toggleBranch={toggleBranch}
        closeCatalog={() => { /* the tab is the surface: opening a child closes nothing */ }}
        t={t}
      />
    </div>
  )
}
