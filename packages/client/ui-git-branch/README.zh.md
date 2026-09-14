---
description: "空白会话首屏的分支 chip：显示所选工作区当前检出的分支并可切换；面向 git 功能的用户与维护者。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-git-branch

[English](README.md) | 中文

## 概述

位于空白会话工作区 chip 旁边的一枚 chip，显示所选工作区当前检出的分支，并提供可搜索的列表用于切换。所有 git 操作都属于 `@deepseek-ai/dsh-api-git-controller` 拥有的 `git` Remote 命名空间；本包只是界面。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

与 `ui-conversation` 和 git 控制器一同挂载。chip 出现在首屏那一行，位于工作区 chip 与智能体预设 chip 之间，且仅当该工作区是 git 工作树时才出现——非 git 项目的首屏保持干净。

从列表里选一个分支即可检出。被 git 拒绝的切换会让 chip 停留在检出实际所在的分支上，并展示 git 自己的说明。

<a id="understand-the-implementation"></a>
## 理解实现

**只有一个座位，在空白会话首屏。** 那才是选分支的时机：开工之前。chip 刻意没有同时放进会话输入区的 dock——空白页两个座位会同时渲染（因为它也有会话对象），chip 会出现两次；而且在会话进行中切分支，等于把文件从一个正在该检出上运行的会话脚下换掉。分支是工作区级的事实：切换会波及该工作区的每个会话。

**工作区来自首屏的 owner share**，而不是读取工作区或会话列表。首屏已经确定了"新建会话会开在哪个工作区"，其中包括用户刚刚点选、还没有任何会话指向的那个。

**标签跟随宿主的最新回报，绝不跟随点击回显。** 被拒绝的切换必须重新显示检出实际所在的分支，因此无论 git 接受还是拒绝，切换后都会重新读取。

**刷新由事件驱动，而非轮询**：挂载时、弹层打开时、切换之后，以及窗口重新获得焦点时（5 秒节流）。在终端里切换过的检出，会在下一次看向窗口时被发现——那正是过期分支会误导人的时刻。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与后续工作

- 不支持新建分支，也不支持远程跟踪分支——控制器只列本地分支。
- 会话进行中没有分支控制。
- 没有实时推送：窗口处于焦点期间发生的检出变化，要到下一个刷新时机才会被发现。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>

**运行时不变式：** 只注册一个首屏座位，随插件 fiber 一同释放。chip 自身不持有任何 git 知识：它只渲染 store，而 store 只由插件自己的读取写入，因此屏幕上出现的值必定是宿主回报过的。
