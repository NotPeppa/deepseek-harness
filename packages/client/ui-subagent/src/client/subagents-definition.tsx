/**
 * What the `subagents` Sidebar tab type IS: a page, not a viewer — it claims no
 * address and is opened by kind from the guide page.
 */
import type { SidebarRightTabDefinition } from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-locale/client'
import { IconAgentPresetOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { NS } from './locales.ts'

/** The tab kind this package owns. */
export const SUBAGENTS_KIND = 'subagents'

/** This implementation's identity in the tab system, and the key its body registers under. */
export const SUBAGENTS_ID = '@deepseek-ai/dsh-client-ui-subagent'

/**
 * The subagent type's registry definition.
 * @param t - namespace-bound translate, read fresh on every label call.
 * @returns the definition to register.
 */
export function subagentsDefinition(t: TranslateNS<typeof NS>): SidebarRightTabDefinition {
  return {
    id: SUBAGENTS_ID,
    kind: SUBAGENTS_KIND,
    priority: 'builtin',
    title: () => t('tab.label'),
    guide: [{
      order: 20,
      title: () => t('tab.label'),
      description: () => t('tab.description'),
      icon: IconAgentPresetOutline16,
    }],
  }
}
