/**
 * Background-job plugin, browser half: contributes one session-header action
 * that renders this session's `ctx.jobs` records. The data arrives entirely
 * through the `jobsBySession` list mirror, so the plugin issues no RPC and
 * holds no state of its own beyond popover visibility.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { JobListAction } from './JobListAction.tsx'
import { JOBS_ID, jobsDefinition } from './definition.tsx'
import { JobsBody } from './JobsBody.tsx'
import { JobsTitle } from './JobsTitle.tsx'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import { en, NS, zh, type JobKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Background-job list copy. */
    'job': JobKey
  }
}

export type { JobListActionProps } from './JobListAction.tsx'
export type { JobsBodyProps } from './JobsBody.tsx'
export { JOBS_ID, JOBS_KIND, jobsDefinition } from './definition.tsx'

/** Required services for locale registration and header-slot contribution. */
export const inject = ['sessions', 'slots', 'locale']

/**
 * Client plugin body: register the dictionaries and the header action.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-job: dictionaries')
  ctx.slots.inject(
    'conversation.session.header.actions',
    () => ctx.slots.register({
      name: 'conversation.session.header.actions',
      id: 'job-list',
      // After the subagent catalog: session lineage reads before process work.
      order: 20,
      locale: NS,
    }, JobListAction),
  )
  // The Sidebar tab is optional composition: without the right Sidebar the
  // header action above is still the whole surface.
  ctx.inject(['sidebarRightTabs'], (sidebarCtx) => {
    sidebarCtx.effect(
      () => sidebarCtx.sidebarRightTabs.register(jobsDefinition(t)),
      'ui-job: jobs tab type',
    )
    sidebarCtx.effect(() => sidebarCtx.slots.inject('sidebar.right.pane.tab', () => sidebarCtx.slots.register(
      { name: 'sidebar.right.pane.tab', key: JOBS_ID, locale: NS },
      JobsBody,
    )), 'ui-job: jobs tab body')
    sidebarCtx.effect(() => sidebarCtx.slots.inject('sidebar.right.pane.tab.title', () => sidebarCtx.slots.register(
      { name: 'sidebar.right.pane.tab.title', key: JOBS_ID },
      JobsTitle,
    )), 'ui-job: jobs tab title')
  })
}
