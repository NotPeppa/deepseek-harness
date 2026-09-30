# Agent Note: 后台任务与子代理的 Sidebar tab

Status: implemented

[English](2026-09-22-sidebar-jobs-and-subagents-tabs.md) | 中文

## Problem

会话的两个实时活动界面都挂在会话页头上的弹层里：后台任务列表与 subagent 目录。弹层不适合承载耗时数分钟的工作——外部按下即关闭、对话滚动时无法持续观察，长时间运行时用户只能反复重开来看有没有进展。右侧边栏本就承载长驻的会话级页面（工作区文件树、文档预览）并在引导页提供它们，但这两个活动界面在那里都没有 tab 类型。

## Decision

**各自的包贡献各自的 Sidebar tab，同时保留页头弹层。** [ui-jobs](../../../../packages/client/ui-jobs/src/client/index.ts) 注册 `jobs` 类型（[definition.tsx](../../../../packages/client/ui-jobs/src/client/definition.tsx)、[JobsBody.tsx](../../../../packages/client/ui-jobs/src/client/JobsBody.tsx)、[JobsTitle.tsx](../../../../packages/client/ui-jobs/src/client/JobsTitle.tsx)）；[ui-subagent](../../../../packages/client/ui-subagent/src/client/index.ts) 注册 `subagents` 类型（[subagents-definition.tsx](../../../../packages/client/ui-subagent/src/client/subagents-definition.tsx)、[SubagentsBody.tsx](../../../../packages/client/ui-subagent/src/client/SubagentsBody.tsx)、[SubagentsTitle.tsx](../../../../packages/client/ui-subagent/src/client/SubagentsTitle.tsx)）。归属跟着数据走：任务主体读取任务服务，子智能体主体读取共享 Session 投影，因此两个包互不了解对方的行，Web 组合也不需要新增包。两者都是[右侧 Sidebar tab 类型与导航](../architecture/2026-09-05-sidebar-tab-types-and-navigation.zh.md)定义的 page 类型：不认领任何地址，由引导页按 kind 打开；。

**Sidebar 属于可选组合，经 `ctx.inject` 取用。** `sidebarRightTabs` 不在两个包的 `inject` 列表里；tab 注册发生在 `ctx.inject(['sidebarRightTabs'], …)` 内部，因此缺少页签注册表的组合仍保留满足其他必需依赖的页头控件。另一种做法——把该服务加进必需列表——会让页头动作本身在缺少 Sidebar 的地方直接不加载。

任务页签通过任务服务读取数据，使用 [JobRows.tsx](../../../../packages/client/ui-jobs/src/client/JobRows.tsx) 渲染，并在挂载期间订阅列表。子智能体页签复用 [CatalogDropdown](../../../../packages/client/ui-subagent/src/client/SubagentHeaderLineage.tsx) 的常驻模式，包括投影读取、分支展开、导航与行时钟。

子智能体页签在挂载时刷新根目录，在展开分支时刷新对应子会话目录。空目录显示本地化空态；读取失败时保留重试操作。

## Alternatives considered

**合成一个「活动」tab。** 那需要把两份镜像与两套行渲染放进同一个包，要么跨包引用内部组件，要么复制一份行。两个 tab 只多一个引导入口，却让归属留在数据所在处。

**把界面从页头移走。** 页头的 pill 是环境信号——用户正是靠它才知道存在一个任务或一个子会话。tab 是用来盯的地方；删掉 pill 等于把一瞥换成一次点击。

## Consequences

两个包依赖 Sidebar 类型与可选的页签注册表。针对性测试覆盖空页签、有数据的页签、投影刷新，以及销毁时移除注册项。
