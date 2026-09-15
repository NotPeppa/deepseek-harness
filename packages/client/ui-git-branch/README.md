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

**Two seats, one per phase.** The blank-session hero is where a branch is chosen, before the work starts; inside a running conversation the chip rides the input bar's accessory row, beside the access-mode chip, so the branch the work lands on stays visible. It is deliberately not in the dock above the input: that stacks full-width cards (todo, queue), and a lone chip there floats far from the box it belongs to. The accessory row is absent during the hero phase, so the two seats cannot both appear on one screen.

**The worktree manager is a dialog, not another popover section.** The popover picks one value; the manager is a list with its own verbs, and the two together would not fit the seat the chip sits in. Only harness-created checkouts offer removal — the primary one is the repository, and an external one belongs to whoever made it — and the force button appears only after git refused for uncommitted work, so it can never be a first click.

**A switch is guarded twice, not forbidden.** It reaches every session of the workspace, so a pick arms the row and a second click acts; git itself refuses the cases that would lose work, and its sentence is shown verbatim.

**The workspace comes from the Hero owner share**, not from a workspace or session list. The Hero has already settled which workspace a New Session would open in, including a pick the user just made that no session references yet.

**The label follows the Host's last report, never the click echo.** A refused switch must repaint the branch the checkout is still on, so the chip re-reads after a switch whether git accepted it or refused it.

**Refresh is event-driven, not polled:** on mount, on popover open, after a switch, and on window focus (throttled to 5s). A checkout moved from a terminal is picked up the next time the window is looked at, which is the moment a stale branch would mislead.

<a id="known-limitations-and-deferred-work"></a>
## Known Limitations and Deferred Work

- A branch checked out by another worktree can only be reported, not taken — git refuses it, and the manager is where the other checkout is dealt with.
- Creation is always at a committish; there is no picker for one, only a text field.
- No live push: a checkout that moves while the window is focused is not noticed until the next refresh trigger.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** One hero-seat registration, disposed with the plugin fiber. The chip holds no git knowledge of its own: it renders the store, and the store is written only by the plugin's own reads, so a value on screen was always reported by the Host.
