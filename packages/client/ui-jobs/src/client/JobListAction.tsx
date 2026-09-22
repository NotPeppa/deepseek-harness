import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { SessionJob as JobView } from '@deepseek-ai/dsh-api-session-controller/types'
import { IconChevronDownOutline14, StateDot, useDismissOnOutsidePointer } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { NS } from './locales.ts'
import { isLive, JobRows, useJobClock } from './JobRows.tsx'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import css from './JobListAction.module.css'

/** Full props for the session-header background-job action. */
export type JobListActionProps =
  PropsRuntime<'conversation.session.header.actions'> & PropsLocale<typeof NS>

/** Stable empty list so a session with no jobs keeps one array identity. */
const NO_TASKS: readonly JobView[] = []

/**
 * Session-header entry point for this session's background jobs. It renders
 * nothing at all until the session has at least one job, so an ordinary
 * conversation never grows a control for a capability it is not using.
 * @param props - runtime slot currency plus the namespace translator.
 * @returns the trigger and its popover list, or null when there is nothing to show.
 */
export function JobListAction({ sessionId, useSessions, t }: JobListActionProps) {
  const jobs = useSessions(state => state.jobsBySession[sessionId]) ?? NO_TASKS
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const liveCount = useMemo(() => jobs.filter(isLive).length, [jobs])
  // The clock only runs while an open list is showing something that moves.
  const now = useJobClock(open && liveCount > 0)

  useDismissOnOutsidePointer(rootRef, open, setOpen)

  // The last job disappearing removes this control, which unmounts the open
  // list with it; nothing needs to close first because focus leaves with the
  // whole control.
  if (jobs.length === 0) return null

  const countKey = liveCount > 0
    ? (liveCount === 1 ? 'count.live.one' : 'count.live.other')
    : (jobs.length === 1 ? 'count.idle.one' : 'count.idle.other')
  const countLabel = t(countKey, { count: liveCount > 0 ? liveCount : jobs.length })

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Escape' || !open) return
    event.preventDefault()
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div ref={rootRef} className={css.root} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className={css.trigger}
        aria-expanded={open}
        aria-label={countLabel}
        onClick={() => { setOpen(current => !current) }}
      >
        {liveCount > 0 ? <StateDot state="ongoing" className={css.triggerDot} /> : null}
        <span className={css.count}>{countLabel}</span>
        <IconChevronDownOutline14 className={open ? css.triggerOpen : undefined} />
      </button>
      {open
        ? (
          <ul className={css.menu} aria-label={t('list.aria')}>
            <JobRows jobs={jobs} now={now} t={t} />
          </ul>
        )
        : null}
    </div>
  )
}
