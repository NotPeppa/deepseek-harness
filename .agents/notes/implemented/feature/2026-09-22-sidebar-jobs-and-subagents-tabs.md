# Agent Note: Sidebar tabs for background jobs and subagents

Status: implemented

English | [中文](2026-09-22-sidebar-jobs-and-subagents-tabs.zh.md)

## Problem

Both live-activity surfaces of a session were popovers on the session header: the background-job list and the subagent catalog. A popover is the wrong container for work that takes minutes — it closes on an outside press, it cannot be watched while the conversation scrolls, and on a long run the user reopens it repeatedly to see whether anything moved. The right Sidebar already hosts long-lived per-session pages (the workspace file tree, document previews) and offers them from its guide, but neither activity surface had a tab type there.

## Decision

**Each package contributes its own Sidebar tab, and keeps its header popover.** [ui-jobs](../../../../packages/client/ui-jobs/src/client/index.ts) registers the `jobs` type ([definition.tsx](../../../../packages/client/ui-jobs/src/client/definition.tsx), [JobsBody.tsx](../../../../packages/client/ui-jobs/src/client/JobsBody.tsx), [JobsTitle.tsx](../../../../packages/client/ui-jobs/src/client/JobsTitle.tsx)); [ui-subagent](../../../../packages/client/ui-subagent/src/client/index.ts) registers the `subagents` type ([subagents-definition.tsx](../../../../packages/client/ui-subagent/src/client/subagents-definition.tsx), [SubagentsBody.tsx](../../../../packages/client/ui-subagent/src/client/SubagentsBody.tsx), [SubagentsTitle.tsx](../../../../packages/client/ui-subagent/src/client/SubagentsTitle.tsx)). Ownership follows the data: each body reads the same `useSessions` mirror its popover reads, so neither package learns the other's rows and no new package joins the Web composition. Both are page types under [Right Sidebar tab types and navigation](../architecture/2026-09-05-sidebar-tab-types-and-navigation.md): they claim no address and are opened by kind from the guide, whose entry count stays inside the 4-entry description threshold.

**The Sidebar is optional composition, taken through `ctx.inject`.** `sidebarRightTabs` is not in either package's `inject` list; each tab registers inside `ctx.inject(['sidebarRightTabs'], …)`, so an app composition without the right Sidebar keeps the header surfaces and loses only the tab. The alternative — adding the service to the required list — would have made the header action itself dormant wherever the Sidebar is absent.

**Rows have one home per surface pair.** The jobs `<li>`, its ordering, its duration formatting, and its status wording moved into [JobRows.tsx](../../../../packages/client/ui-jobs/src/client/JobRows.tsx), which both the header popover and the tab draw; the subagent tree body reuses the dropdown's exported `CatalogRows` and its CSS module, overriding only the floating geometry, and both surfaces share [catalog-branches.ts](../../../../packages/client/ui-subagent/src/client/catalog-branches.ts) for expansion state, runtime observation, and the recursive collapse. Each surface keeps its own clock gate: the popover ticks while it is open with a live row, the tab while a live row exists at all.

**The tab owns catalog observation for as long as it is mounted.** `SubagentsBody` reports the session catalog — and every branch the user expands — through `setCatalogOpen`, and releases all of them on unmount, the same protocol the dropdown follows on open and close. An empty or not-yet-loaded catalog renders the empty line rather than an empty tree, because a tab is opened deliberately and must say why it is blank; the popover instead hides itself, which a tab cannot do.

## Alternatives considered

**One combined "activity" tab.** It would need both mirrors and both row renderers in one package, forcing a cross-package import of an internal component or a duplicated row. Two tabs cost one more guide entry and keep ownership where the data is.

**Move the surfaces out of the header.** The header pills are the ambient signal — they are how a user learns a job or a child exists at all. The tab is the place to watch; removing the pill would trade a glance for a click.

## Consequences

`ui-jobs` and `ui-subagent` now depend on `@deepseek-ai/dsh-client-ui-sidebar-right` (manifest, tsconfig reference, dev dependency) for types and the tab registry. The guide lists three entry capsules; a fourth would still show descriptions, a fifth would drop them for every entry. Both packages' specs cover the definition thunks, the bodies' empty and populated states, catalog observation and release, and the plugin wiring with and without the Sidebar service; both READMEs restate the tab behavior in the two languages.
