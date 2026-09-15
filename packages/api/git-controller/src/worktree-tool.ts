/**
 * The model-facing worktree tool. It exposes the same three verbs the browser
 * uses, through the same fence: the calling session's own workspace, resolved
 * from its cwd, and nothing else.
 *
 * Force removal is deliberately absent from the schema. Removing a checkout
 * that still holds uncommitted work destroys it, and that is a decision for a
 * person at the worktree manager, not something a tool call should be able to
 * reach. A clean checkout the harness created is removable here; anything else
 * comes back as git's own refusal.
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-tools'
import type { GitController } from './index.ts'

/** The tool's validated arguments. */
interface WorktreeToolArgs {
  operation: 'list' | 'create' | 'remove'
  name?: string
  path?: string
  base?: string
}

/** What the tool answers with; one human-readable block per operation. */
interface WorktreeToolResult {
  summary: string
}

/**
 * Register the `git_worktree` tool against one git controller.
 * @param ctx - Host context carrying the tools registry and the workspace registry.
 * @param git - the controller whose verbs and fence this tool borrows.
 */
export function registerWorktreeTool(ctx: Context, git: GitController): void {
  ctx.inject(['tools'], (toolCtx) => {
    toolCtx.tools.register(defineTool({
      name: 'git_worktree',
      description:
        'List, create, or remove isolated git worktrees of the current session workspace. '
        + 'A created worktree is registered as a workspace and gets its own wt/ branch; '
        + 'open a new session there to work in it, because a session working directory never moves. '
        + 'Only worktrees this harness created can be removed, and only when they are clean.',
      parameters: {
        operation: {
          type: 'string',
          required: true,
          description: 'One of: list, create, remove.',
        },
        name: {
          type: 'string',
          description: 'create: the worktree name, also its wt/ branch suffix. One path segment.',
        },
        base: {
          type: 'string',
          description: 'create: committish the branch starts at. Defaults to the current HEAD.',
        },
        path: {
          type: 'string',
          description: 'remove: absolute path of the worktree, as reported by list.',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: { summary: { type: 'string', required: true } },
        },
        render: (_args, value) => [{ type: 'text', text: value.summary }],
      },
      async execute(args: WorktreeToolArgs, exec): Promise<WorktreeToolResult> {
        const cwd = exec.agent?.session.header.cwd
        if (cwd === undefined) return { summary: 'git_worktree: this session has no working directory.' }
        // The fence: the session's own cwd must be a registered workspace. The
        // model never names a workspace, so it cannot reach another one.
        const workspace = ctx.workspaceRegistry.list().find(entry => entry.path === cwd)
        if (workspace === undefined) {
          return { summary: `git_worktree: '${cwd}' is not a registered workspace.` }
        }
        const id = workspace.id as string
        if (args.operation === 'list') {
          const worktrees = await git.worktrees(id, exec.signal)
          if (worktrees.length === 0) {
            return { summary: 'No worktrees; this workspace is not a git repository.' }
          }
          return {
            summary: worktrees
              .map(tree => [
                tree.path,
                tree.branch ?? '(detached)',
                tree.primary ? 'primary' : tree.managed ? 'managed' : 'linked',
              ].join('  '))
              .join('\n'),
          }
        }
        if (args.operation === 'create') {
          if (args.name === undefined || args.name === '') {
            return { summary: 'git_worktree create: `name` is required.' }
          }
          const created = await git.createWorktree(id, args.name, args.base ?? '', exec.signal)
          if (!created.ok) {
            return { summary: `git_worktree create refused: ${created.message ?? 'unknown reason'}` }
          }
          // A session's working directory is immutable, so the model is told
          // where the checkout is rather than being moved into it.
          return {
            summary: `Created ${created.path ?? ''} on branch wt/${args.name}, registered as a workspace. `
              + 'Open a new session there to work in it; this session stays where it is.',
          }
        }
        if (args.operation === 'remove') {
          if (args.path === undefined || args.path === '') {
            return { summary: 'git_worktree remove: `path` is required.' }
          }
          // force is not offered to the model: see this module's header.
          const removed = await git.removeWorktree(id, args.path, false, exec.signal)
          if (removed.ok) return { summary: `Removed ${args.path} and unregistered its workspace.` }
          if (removed.dirty === true) {
            return {
              summary: `git_worktree remove refused: ${args.path} holds uncommitted work. `
                + 'Removing it anyway is a decision for the person at the worktree manager.',
            }
          }
          return { summary: `git_worktree remove refused: ${removed.message ?? 'unknown reason'}` }
        }
        return { summary: `git_worktree: unknown operation '${String(args.operation)}'.` }
      },
    }))
  })
}
