---
description: "Branch chip for the blank-session hero: shows the checked-out branch of the chosen workspace and switches it; for users and maintainers of the git surface."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-git-branch

English | [中文](README.zh.md)

## Summary

A chip beside the blank-session workspace chip showing which branch the chosen workspace has checked out, with a searchable list to switch it. Every git operation belongs to the `git` Remote namespace owned by `@deepseek-ai/dsh-api-git-controller`; this package is the surface only.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount alongside `ui-conversation` and the git controller. The chip appears in the hero row between the workspace chip and the agent-preset chip, and only for a workspace that is a git working tree — a non-git project keeps its hero row clean.

Pick a branch from the list to check it out. A switch git refuses leaves the chip on the branch the checkout is still on and shows git's own sentence.

<a id="understand-the-implementation"></a>
## Understand the implementation

**One seat, on the blank-session screen.** That is where a branch is chosen: before the work starts. The chip is deliberately not also in the conversation input dock — both render on a blank screen, since it has a session object, so the chip appeared twice — and switching a branch mid-session would move files under a session already running in that checkout. A branch is a workspace-level fact: the switch reaches every session of that workspace.

**The workspace comes from the Hero owner share**, not from a workspace or session list. The Hero has already settled which workspace a New Session would open in, including a pick the user just made that no session references yet.

**The label follows the Host's last report, never the click echo.** A refused switch must repaint the branch the checkout is still on, so the chip re-reads after a switch whether git accepted it or refused it.

**Refresh is event-driven, not polled:** on mount, on popover open, after a switch, and on window focus (throttled to 5s). A checkout moved from a terminal is picked up the next time the window is looked at, which is the moment a stale branch would mislead.

<a id="known-limitations-and-deferred-work"></a>
## Known Limitations and Deferred Work

- No branch creation, and no remote-tracking branches — the controller lists local branches only.
- No branch control inside an active session.
- No live push: a checkout that moves while the window is focused is not noticed until the next refresh trigger.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** One hero-seat registration, disposed with the plugin fiber. The chip holds no git knowledge of its own: it renders the store, and the store is written only by the plugin's own reads, so a value on screen was always reported by the Host.
