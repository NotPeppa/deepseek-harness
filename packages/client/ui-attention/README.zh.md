---
description: "审批或提问等待处理时向浏览器推送通知。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-attention

[English](README.md) | 中文

## 概述

当页面在后台、而审批、提问或计划确认正在等待回答时，向浏览器推送一条通知。开关位于 **设置 → 通用**。通知权限由每个浏览器各自授予，Host 只保存通知是否启用。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

在 设置 → 通用 中打开 **浏览器通知**。首次在该浏览器打开开关时，浏览器会询问通知权限。此后当标签页在后台、又有新的请求出现时，会推送一条通知；点击通知会回到窗口并打开正在等待回答的会话。开关显示 Host 已接受的值，因此尚未授予权限的浏览器会在同一行下说明自身状态。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节 —— 点击展开</summary>

本插件观察 `uiSession` 的会话状态投影，用一个监视器覆盖所有等待处理域，而不是让审批或提问插件各自推送通知。每个请求在页面生命周期内最多提醒一次，且仅在 `document.visibilityState` 为 `hidden`、Host 偏好已启用、浏览器已授予权限时提醒。通知文案来自 `attention` 语言命名空间；Host 侧只提供 `ui-attention` 设置命名空间的 `enabled` 字段。

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [审批](../../../docs/subsystems/approval.zh.md) —— 本监视器所观察的审批瀑布流。
- [设置表单](../ui-settings/README.zh.md) —— Host 接受的值与有序写入。
- [Web 客户端](../../../docs/subsystems/web-client.zh.md) —— 插件组合与会话状态事实。

<a id="model-experience"></a>
## 模型体验

无。该浏览器偏好不产生任何模型可见内容。

#### KV 缓存影响

无；通知是基于既有会话状态的浏览器界面。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 仅在页面隐藏时推送通知；窗口可见但未聚焦时改为显示页面内卡片。
- 从未授予权限的浏览器即使在另一浏览器启用了通知也不会提醒；该行会说明状态并再次提供权限申请。
- 点击通知会打开发起请求的会话；若通知守护进程丢弃点击回调，视图保持不变。

<a id="dev-note"></a>
### 开发备注

无。
