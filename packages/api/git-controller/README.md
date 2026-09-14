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

Two methods:

- `status(workspaceId)` → `{ repository, current?, branches }`. `repository: false` covers both "not a working tree" and "no git on PATH". `current` is absent on a detached HEAD.
- `switchBranch(workspaceId, branch)` → `{ ok, message? }`. `message` is git's own stderr, so a dirty tree or a branch held by another worktree explains itself.

<a id="understand-the-implementation"></a>
## Understand the implementation

**The fence is the workspace registry.** Every call names a workspace by registry id, never by path. The registry record's `path` is the realpath resolved when the workspace was created and is never rewritten afterwards, so an id that resolves is by construction a directory the user already admitted. An unknown id is refused before git runs at all.

**Git runs with fixed argv through the subprocess seam**, never shell-interpreted, so a branch name cannot become an argument or a command. The switch is `git switch --no-guess -- <branch>`: `--no-guess` keeps a typo from silently creating a remote-tracking branch, and `--` ends option parsing so a name like `-f` stays a name.

**A detached HEAD is not a branch.** `rev-parse --abbrev-ref HEAD` answers the literal `HEAD` there; that is reported as no current branch rather than a branch named `HEAD`.

<a id="known-limitations-and-deferred-work"></a>
## Known Limitations and Deferred Work

- Local branches only: remote-tracking branches are neither listed nor checked out.
- Switching only: no branch creation, and no worktree operations.
- A switch is workspace-level and reaches every session of that workspace.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** Host-only — the package publishes no browser face, so nothing here can reach the DOM. Every method resolves its directory through the workspace registry before spawning, so no code path exists that runs git in a directory the browser named.
