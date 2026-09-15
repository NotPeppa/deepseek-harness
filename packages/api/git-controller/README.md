---
description: "Workspace git service: the checkout facts and the branch switch the Web GUI branch chip calls, fenced to registered workspaces; for maintainers of the git surface."
kind: "package-reference"
---

# @deepseek-ai/dsh-api-git-controller

English | [中文](README.zh.md)

## Summary

Host owner of the `git` Remote namespace. It answers what one registered workspace's checkout looks like — whether the directory is a working tree, which branch is out, and which local branches exist — and performs the branch switch. It owns no UI; the branch chip ships in `@deepseek-ai/dsh-client-ui-git-branch`.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Compose the plugin into a Host assembly that provides `subprocess` and `workspaceRegistry`, and mount its generated contribution in the Client Remote assembly (`packages/api/remotes`) so `remote.git` exists in the browser. A namespace must also be injected by name — `inject: ['remote', 'remote.git']` — or `ctx.remote.git` is simply not there.

Four methods:

- `status(workspaceId)` → `{ repository, current?, branches, remoteBranches }`. `repository: false` covers both "not a working tree" and "no git on PATH". `current` is absent on a detached HEAD, and `origin/HEAD` is filtered out of the remote list — it points at another entry of that same list.
- `switchBranch(workspaceId, branch)` → `{ ok, message? }`, for a local branch.
- `checkoutRemote(workspaceId, remoteRef)` → the same, through `--track`, for a remote-tracking branch.
- `createBranch(workspaceId, name)` → the same, creating at the current HEAD.

Three more for worktrees — `worktrees(workspaceId)`, `createWorktree(workspaceId, name, base)`, `removeWorktree(workspaceId, path, force)` — plus `checkoutChanges()`, a stream announcing every checkout this Host moves.

Every failure carries git's own stderr, so a dirty tree or a branch held by another worktree explains itself. A removal refused only for uncommitted work comes back marked `dirty`: that is the one refusal a caller may retry with `force`.

<a id="understand-the-implementation"></a>
## Understand the implementation

**The fence is the workspace registry.** Every call names a workspace by registry id, never by path. The registry record's `path` is the realpath resolved when the workspace was created and is never rewritten afterwards, so an id that resolves is by construction a directory the user already admitted. An unknown id is refused before git runs at all.

**Git runs with fixed argv through the subprocess seam**, never shell-interpreted, so a branch name cannot become an argument or a command. The switch is `git switch --no-guess -- <branch>`: `--no-guess` keeps a typo from silently creating a remote-tracking branch, and `--` ends option parsing so a name like `-f` stays a name.

**A worktree always brings its own branch.** Git refuses to check one branch out in two checkouts at once, so sharing the caller's branch is not available even if it were wanted; created checkouts get a `wt/` branch, and that prefix keeps them apart from branches a person made. They live under `<dsh home>/worktrees/<repository key>/<name>/`, keyed by the repository's common dir rather than its folder name — two repositories of the same name would otherwise collide there.

**Removal is fenced on canonical paths at both ends**, compared with a trailing separator so a sibling whose name merely starts the same (`worktrees-old` beside `worktrees`) is not mistaken for a child. A worktree name is refused unless it is one plain directory segment, before git sees it.

**Changes are announced, not polled.** Every verb here knows exactly when it moved a checkout, so a watcher learns at that moment. A refusal changed nothing and is not announced. This is not a filesystem watch: a branch switched in a terminal is not announced, and the browser's own focus re-read remains the answer for that.

**The model-facing `git_worktree` tool** shares this fence through the calling session's cwd, so the model cannot name another workspace. Force removal is deliberately absent from its schema — destroying uncommitted work is a decision for a person at the manager, not something a tool call can reach.

**A detached HEAD is not a branch.** `rev-parse --abbrev-ref HEAD` answers the literal `HEAD` there; that is reported as no current branch rather than a branch named `HEAD`.

<a id="known-limitations-and-deferred-work"></a>
## Known Limitations and Deferred Work

- No worktree operations.
- Creation is always at the current HEAD; a branch cannot be created from another base.
- A switch is workspace-level and reaches every session of that workspace.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** Host-only — the package publishes no browser face, so nothing here can reach the DOM. Every method resolves its directory through the workspace registry before spawning, so no code path exists that runs git in a directory the browser named.
