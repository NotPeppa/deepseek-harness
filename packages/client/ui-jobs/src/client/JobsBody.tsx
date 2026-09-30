/**
 * The `jobs` tab body: this session's background jobs, the same rows the
 * session-header popover draws, in a panel that stays open while work runs.
 */
import { useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { JobView } from '@deepseek-ai/dsh-api-job-controller/client'
import type { JobListInjected } from './JobListAction.tsx'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { isLive, JobRows, useJobClock } from './JobRows.tsx'
import type { NS } from './locales.ts'
import css from './JobsBody.module.css'

/** Full props for the Sidebar jobs tab body. */
export type JobsBodyProps =
  PropsRuntime<'sidebar.right.pane.tab'> & InjectFace<JobListInjected> & PropsLocale<typeof NS>

/** Stable empty list so a session with no jobs keeps one array identity. */
const NO_TASKS: readonly JobView[] = []

/**
 * The tab's list, or its empty line when the session has run nothing.
 * @param props - runtime slot currency plus the namespace translator.
 * @returns the panel body.
 */
export function JobsBody({ sessionId, useJobs, watchRows, t }: JobsBodyProps): ReactNode {
  useEffect(() => watchRows(sessionId), [sessionId, watchRows])
  const jobs = useJobs(state => state.rows[sessionId]) ?? NO_TASKS
  const liveCount = useMemo(() => jobs.filter(isLive).length, [jobs])
  const now = useJobClock(liveCount > 0)
  if (jobs.length === 0) return <p className={css.empty}>{t('tab.empty')}</p>
  return (
    <ul className={css.list} aria-label={t('list.aria')}>
      <JobRows jobs={jobs} now={now} t={t} />
    </ul>
  )
}
