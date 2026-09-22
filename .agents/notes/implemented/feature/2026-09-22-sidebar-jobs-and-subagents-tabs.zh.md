# Agent Note: 后台任务与子代理的 Sidebar tab

Status: implemented

[English](2026-09-22-sidebar-jobs-and-subagents-tabs.md) | 中文

## Problem

会话的两个实时活动界面都挂在会话页头上的弹层里：后台任务列表与 subagent 目录。弹层不适合承载耗时数分钟的工作——外部按下即关闭、对话滚动时无法持续观察，长时间运行时用户只能反复重开来看有没有进展。右侧边栏本就承载长驻的会话级页面（工作区文件树、文档预览）并在引导页提供它们，但这两个活动界面在那里都没有 tab 类型。

## Decision

**各自的包贡献各自的 Sidebar tab，同时保留页头弹层。** [ui-jobs](../../../../packages/client/ui-jobs/src/client/index.ts) 注册 `jobs` 类型（[definition.tsx](../../../../packages/client/ui-jobs/src/client/definition.tsx)、[JobsBody.tsx](../../../../packages/client/ui-jobs/src/client/JobsBody.tsx)、[JobsTitle.tsx](../../../../packages/client/ui-jobs/src/client/JobsTitle.tsx)）；[ui-subagent](../../../../packages/client/ui-subagent/src/client/index.ts) 注册 `subagents` 类型（[subagents-definition.tsx](../../../../packages/client/ui-subagent/src/client/subagents-definition.tsx)、[SubagentsBody.tsx](../../../../packages/client/ui-subagent/src/client/SubagentsBody.tsx)、[SubagentsTitle.tsx](../../../../packages/client/ui-subagent/src/client/SubagentsTitle.tsx)）。归属跟着数据走：每个主体读取的都是其弹层读取的同一份 `useSessions` 镜像，因此两个包互不了解对方的行，Web 组合也不需要新增包。两者都是[右侧 Sidebar tab 类型与导航](../architecture/2026-09-05-sidebar-tab-types-and-navigation.zh.md)定义的 page 类型：不认领任何地址，由引导页按 kind 打开；引导页入口数仍在 4 条描述阈值之内。

**Sidebar 属于可选组合，经 `ctx.inject` 取用。** `sidebarRightTabs` 不在两个包的 `inject` 列表里；tab 注册发生在 `ctx.inject(['sidebarRightTabs'], …)` 内部，因此没有右侧边栏的应用组合保留页头界面，只是没有 tab。另一种做法——把该服务加进必需列表——会让页头动作本身在缺少 Sidebar 的地方直接不加载。

**一对界面的行只有一处归属。** 任务行的 `<li>`、排序、时长格式与状态措辞移入 [JobRows.tsx](../../../../packages/client/ui-jobs/src/client/JobRows.tsx)，页头弹层与 tab 都画它；subagent 树主体复用下拉导出的 `CatalogRows` 及其 CSS module，只覆盖浮层几何；展开状态、运行时订阅与递归折叠则由两者共用的 [catalog-branches.ts](../../../../packages/client/ui-subagent/src/client/catalog-branches.ts) 承担。两个界面各自把关时钟：弹层在打开且有活跃行时跳动，tab 只要存在活跃行就跳动。

**tab 挂载期间由它负责目录订阅。** `SubagentsBody` 通过 `setCatalogOpen` 上报会话目录以及用户展开的每个分支，并在卸载时全部释放，与下拉在开合时遵循的协议相同。目录为空或尚未加载时渲染空态文案而不是空树：tab 是被刻意打开的，必须说明自己为什么空白；弹层则是把自己藏起来，而 tab 做不到这件事。

## Alternatives considered

**合成一个「活动」tab。** 那需要把两份镜像与两套行渲染放进同一个包，要么跨包引用内部组件，要么复制一份行。两个 tab 只多一个引导入口，却让归属留在数据所在处。

**把界面从页头移走。** 页头的 pill 是环境信号——用户正是靠它才知道存在一个任务或一个子会话。tab 是用来盯的地方；删掉 pill 等于把一瞥换成一次点击。

## Consequences

`ui-jobs` 与 `ui-subagent` 现在依赖 `@deepseek-ai/dsh-client-ui-sidebar-right`（manifest、tsconfig 引用、dev 依赖）以取得类型与 tab 注册表。引导页现在列出三个入口胶囊；第四个仍会显示描述，第五个会让所有入口都失去描述。两个包的测试覆盖定义 thunk、主体的空态与有数据态、目录订阅与释放，以及有无 Sidebar 服务两种情况下的插件接线；两个包的 README 以两种语言重述了 tab 行为。
