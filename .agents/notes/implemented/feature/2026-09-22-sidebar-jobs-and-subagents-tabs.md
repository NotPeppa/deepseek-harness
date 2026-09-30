# Agent Note: Sidebar tabs for background jobs and subagents

Status: implemented

English | [中文](2026-09-22-sidebar-jobs-and-subagents-tabs.zh.md)

## Problem

Both live-activity surfaces of a session were popovers on the session header: the background-job list and the subagent catalog. A popover is the wrong container for work that takes minutes — it closes on an outside press, it cannot be watched while the conversation scrolls, and on a long run the user reopens it repeatedly to see whether anything moved. The right Sidebar already hosts long-lived per-session pages (the workspace file tree, document previews) and offers them from its guide, but neither activity surface had a tab type there.

## Decision

**Each package contributes its own Sidebar tab, and keeps its header popover.** [ui-jobs](../../../../packages/client/ui-jobs/src/client/index.ts) registers the `jobs` type ([definition.tsx](../../../../packages/client/ui-jobs/src/client/definition.tsx), [JobsBody.tsx](../../../../packages/client/ui-jobs/src/client/JobsBody.tsx), [JobsTitle.tsx](../../../../packages/client/ui-jobs/src/client/JobsTitle.tsx)); [ui-subagent](../../../../packages/client/ui-subagent/src/client/index.ts) registers the `subagents` type ([subagents-definition.tsx](../../../../packages/client/ui-subagent/src/client/subagents-definition.tsx), [SubagentsBody.tsx](../../../../packages/client/ui-subagent/src/client/SubagentsBody.tsx), [SubagentsTitle.tsx](../../../../packages/client/ui-subagent/src/client/SubagentsTitle.tsx)). Ownership follows the data: jobs read the `ctx.jobs` roster, and subagents read the shared Session projections, so neither package learns the other's rows and no new package joins the Web composition. Both are page types under [Right Sidebar tab types and navigation](../architecture/2026-09-05-sidebar-tab-types-and-navigation.md): they claim no address and are opened by kind from the guide.

**The Sidebar is optional composition, taken through `ctx.inject`.** `sidebarRightTabs` is not in either package's `inject` list; each tab registers inside `ctx.inject(['sidebarRightTabs'], …)`, so a composition without the tab registry keeps header controls whose other required dependencies are present. The alternative — adding the service to the required list — would have made the header action itself dormant wherever the Sidebar is absent.

The jobs tab renders [JobRows.tsx](../../../../packages/client/ui-jobs/src/client/JobRows.tsx) from the jobs service and holds a roster watch while mounted. The subagent tab reuses the persistent mode of [CatalogDropdown](../../../../packages/client/ui-subagent/src/client/SubagentHeaderLineage.tsx), including its projection reads, branch expansion, navigation, and row clocks.

The subagent tab refreshes the root catalog when mounted and each child catalog when its branch expands. An empty catalog renders the localized empty state; a failed read keeps its retry action visible.

## Alternatives considered

**One combined "activity" tab.** It would need both mirrors and both row renderers in one package, forcing a cross-package import of an internal component or a duplicated row. Two tabs cost one more guide entry and keep ownership where the data is.

**Move the surfaces out of the header.** The header pills are the ambient signal — they are how a user learns a job or a child exists at all. The tab is the place to watch; removing the pill would trade a glance for a click.

## Consequences

Both packages depend on the Sidebar types and optional tab registry. Focused tests cover empty and populated tabs, projection refresh, and removal of the registry contributions during disposal.
