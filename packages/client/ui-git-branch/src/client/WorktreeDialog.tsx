/**
 * Worktree manager: every checkout of one repository, with creation and the
 * removal of the ones this harness made.
 *
 * It is a dialog rather than another section of the branch popover: the popover
 * is a picker for one value, while this is a list with its own verbs, and the
 * two together would not fit the seat the chip sits in.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { GitWorktree } from '@deepseek-ai/dsh-api-git-controller/types'
import type { en } from './locales.ts'
import css from './BranchPill.module.css'

/** What the manager needs beyond the chip's own share. */
export interface WorktreeDialogProps {
  /** Whether the manager is showing. */
  open: boolean
  /** Close it. */
  onClose: () => void
  /** Checkouts as last read. */
  worktrees: readonly GitWorktree[]
  /** A create or remove is in flight. */
  busy: boolean
  /** Git's refusal from the last operation. */
  failure: string
  /** Path whose removal was refused only for uncommitted work. */
  dirtyPath: string
  /** Section copy. */
  t: (key: keyof typeof en) => string
  /** Create a worktree; an empty base means the current HEAD. */
  onCreate: (name: string, base: string) => void
  /** Remove a worktree; `force` is offered only after a dirty refusal. */
  onRemove: (path: string, force: boolean) => void
}

/**
 * Render the worktree manager.
 * @param props - the listing, its verbs, and the copy.
 * @returns the dialog.
 */
export function WorktreeDialog(props: WorktreeDialogProps): ReactNode {
  const [name, setName] = useState('')
  const [base, setBase] = useState('')
  const trimmedName = name.trim()

  /** The badge naming what kind of checkout a row is. */
  const kind = (tree: GitWorktree): string =>
    props.t(tree.primary ? 'worktree.primary' : tree.managed ? 'worktree.managed' : 'worktree.linked')

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={props.t('worktree.title')}
      closeLabel={props.t('branch.cancel')}
      description={props.t('worktree.description')}
      footer={<Button variant="outline" onClick={props.onClose}>{props.t('branch.cancel')}</Button>}
    >
      {props.failure === '' ? null : <p className={css.failure}>{props.failure}</p>}
      {props.worktrees.length === 0
        ? <p className={css.empty}>{props.t('worktree.empty')}</p>
        : (
          <ul className={css.treeList}>
            {props.worktrees.map((tree) => {
              // Only a harness-created checkout is removable: the primary one
              // is the repository, and an external one belongs to whoever made
              // it. Those rows are display-only.
              const removable = tree.managed && !tree.primary
              const armedDirty = props.dirtyPath === tree.path
              return (
                <li key={tree.path} className={css.treeRow}>
                  <div className={css.treeText}>
                    <span className={css.treeBranch}>{tree.branch ?? props.t('worktree.detached')}</span>
                    <span className={css.treePath}>{tree.path}</span>
                    <span className={css.treeMeta}>
                      {kind(tree)}
                      {tree.workspaceId === undefined ? '' : ` · ${props.t('worktree.open')}`}
                    </span>
                  </div>
                  {removable
                    ? (
                      <button
                        type="button"
                        className={armedDirty ? css.treeForce : css.treeRemove}
                        disabled={props.busy}
                        onClick={() => { props.onRemove(tree.path, armedDirty) }}
                      >
                        {/* Force appears only after git refused for uncommitted
                            work, so it can never be the first click. */}
                        {props.t(armedDirty ? 'worktree.forceRemove' : 'worktree.remove')}
                      </button>
                    )
                    : null}
                </li>
              )
            })}
          </ul>
        )}
      <form
        className={css.treeCreate}
        onSubmit={(event) => {
          event.preventDefault()
          if (trimmedName === '') return
          props.onCreate(trimmedName, base.trim())
          setName('')
          setBase('')
        }}
      >
        <input
          className={css.search}
          type="text"
          value={name}
          placeholder={props.t('worktree.namePlaceholder')}
          aria-label={props.t('worktree.namePlaceholder')}
          onChange={(event) => { setName(event.currentTarget.value) }}
        />
        <input
          className={css.search}
          type="text"
          value={base}
          placeholder={props.t('worktree.basePlaceholder')}
          aria-label={props.t('worktree.basePlaceholder')}
          onChange={(event) => { setBase(event.currentTarget.value) }}
        />
        <div className={css.createActions}>
          <button type="submit" className={css.createSubmit} disabled={props.busy || trimmedName === ''}>
            {props.t('worktree.create')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
