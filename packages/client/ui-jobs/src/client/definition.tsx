/**
 * What the `jobs` Sidebar tab type IS: a page, not a viewer — it claims no
 * address and is opened by kind from the guide page.
 */
import type { SidebarRightTabDefinition } from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-locale/client'
import { IconQueueOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { NS } from './locales.ts'

/** The tab kind this package owns. */
export const JOBS_KIND = 'jobs'

/** This implementation's identity in the tab system, and the key its body registers under. */
export const JOBS_ID = '@deepseek-ai/dsh-client-ui-jobs'

/**
 * The jobs type's registry definition.
 * @param t - namespace-bound translate, read fresh on every label call.
 * @returns the definition to register.
 */
export function jobsDefinition(t: TranslateNS<typeof NS>): SidebarRightTabDefinition {
  return {
    id: JOBS_ID,
    kind: JOBS_KIND,
    priority: 'builtin',
    title: () => t('tab.label'),
    guide: [{
      order: 30,
      title: () => t('tab.label'),
      description: () => t('tab.description'),
      icon: IconQueueOutline14,
    }],
  }
}
