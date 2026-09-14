---
description: "工作区 git 服务：Web GUI 分支 chip 调用的检出信息与分支切换，受限于已注册工作区；面向 git 功能的维护者。"
kind: "package-reference"
---

# @deepseek-ai/dsh-api-git-controller

[English](README.md) | 中文

## 概述

`git` Remote 命名空间的宿主端所有者。它回答某个已注册工作区的检出状况——该目录是否是工作树、当前检出哪个分支、有哪些本地分支——并执行分支切换。本包不含任何 UI，分支 chip 在 `@deepseek-ai/dsh-client-ui-git-branch`。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

把插件组合进一个提供了 `subprocess` 与 `workspaceRegistry` 的宿主装配，并在客户端 Remote 装配（`packages/api/remotes`）中挂载它生成的 contribution，浏览器侧才会有 `remote.git`。命名空间还必须按名字注入——`inject: ['remote', 'remote.git']`——否则 `ctx.remote.git` 根本不存在。

两个方法：

- `status(workspaceId)` → `{ repository, current?, branches }`。`repository: false` 同时覆盖"不是工作树"和"机器上没有 git"。detached HEAD 时 `current` 缺省。
- `switchBranch(workspaceId, branch)` → `{ ok, message? }`。`message` 是 git 自己的 stderr，所以工作区脏、或分支已被别的 worktree 检出，都由 git 自述原因。

<a id="understand-the-implementation"></a>
## 理解实现

**围栏就是工作区注册表。** 每次调用都用注册表 id 指定工作区，而非路径。注册表记录里的 `path` 是工作区创建时解析出的 realpath 且此后永不重写，因此能解析出的 id 必然是用户已经认可过的目录。未知 id 在 git 启动之前就被拒绝。

**git 以固定 argv 经子进程接口运行**，从不经 shell，所以分支名无法变成参数或命令。切换用 `git switch --no-guess -- <branch>`：`--no-guess` 防止打错字时静默创建远程跟踪分支，`--` 终止选项解析，使 `-f` 这样的名字仍然是名字。

**detached HEAD 不是分支。** 此时 `rev-parse --abbrev-ref HEAD` 返回字面量 `HEAD`；它被报告为"无当前分支"，而不是一个叫 `HEAD` 的分支。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与后续工作

- 仅本地分支：远程跟踪分支既不列出也不能检出。
- 仅切换：不支持新建分支，也没有 worktree 操作。
- 切换是工作区级的，会波及该工作区的每个会话。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>

**运行时不变式：** 仅宿主端——本包不发布浏览器侧入口，因此其中没有任何代码能触及 DOM。每个方法都先经工作区注册表解析目录再启动子进程，所以不存在"在浏览器指定的目录里运行 git"的代码路径。
