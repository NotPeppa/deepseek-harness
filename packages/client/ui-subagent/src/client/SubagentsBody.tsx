/** Persistent view of the session's subagent catalog. */
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { CatalogDropdown, type SubagentCatalogInjected } from './SubagentHeaderLineage.tsx'
import type { NS } from './locales.ts'

/** Runtime data and catalog navigation for the sidebar tab. */
export type SubagentsBodyProps = PropsRuntime<'sidebar.right.pane.tab'> & SubagentCatalogInjected & PropsLocale<typeof NS>
/** Render the current catalog using the header's shared tree.
 * @param props Session hooks, navigation actions and localized copy.
 * @returns Persistent catalog tree.
 */
export function SubagentsBody({ sessionId, ...props }: SubagentsBodyProps) {
  return <CatalogDropdown {...props} rootSessionId={sessionId} variant="panel" />
}
