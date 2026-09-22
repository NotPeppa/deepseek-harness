/**
 * The jobs type's chip title: the queue glyph before the type's label.
 * Registered under `sidebar.right.pane.tab.title`; without it the chip would
 * show the bare label.
 */
import type { ReactNode } from 'react'
import { IconQueueOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './JobsBody.module.css'

/**
 * The title as the chip and a floating panel's header show it.
 * @param props - the tab information hook.
 * @returns the queue glyph followed by the tab's title text.
 */
export function JobsTitle({ useTabInfo }: PropsRuntime<'sidebar.right.pane.tab.title'>): ReactNode {
  const { tab } = useTabInfo()
  return (
    <>
      <IconQueueOutline14 size={16} className={css.titleIcon} />
      {tab.title}
    </>
  )
}
