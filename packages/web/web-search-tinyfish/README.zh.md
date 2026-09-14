---
description: "ctx.web 的 TinyFish 搜索提供方：部署方如何只在设置里粘贴一个 API 密钥，就打开 TinyFish web 搜索。"
kind: "package-reference"
---

# @deepseek-ai/dsh-web-search-tinyfish

[English](README.md) | 中文

## 概述

有了 `dsh-web-search-tinyfish`，harness 可以通过 [TinyFish](https://agent.tinyfish.ai) 搜索 web，其搜索接口对每个 TinyFish 账号都免费。当部署希望除 API 密钥外不产生额外费用的 web 搜索，或用户更偏好 TinyFish 的排序时选择它。TinyFish 不返回生成答案，因此结果不携带 `content`——只产出可引用的来源。密钥在每次搜索时从凭据存储解析，因此在设置里粘贴密钥无需重启即可生效。面向模型的 `web_search` 工具位于 `dsh-tool-web`。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

在已加载 web 服务的组合中挂载本提供方；它以 `tinyfish` 搜索提供方身份注册。发布的 `dsh-base` bundle 已经挂载了它，因此在这些部署上全部操作就是：打开 **设置 › 插件 › 插件配置 › TinyFish 网页搜索**，粘贴一枚来自 [agent.tinyfish.ai/api-keys](https://agent.tinyfish.ai/api-keys) 的密钥，打开 **用 TinyFish 进行网页搜索**，然后保存。该开关会把 `searchProvider: tinyfish` 写入 `web` 段；关闭时清除该字段，搜索回到部署自身组合的提供方。

### 何时选择

当部署持有 TinyFish API 密钥，并希望获得免费 web 搜索、带每项结果的 snippet 以及新闻结果的发布日期时，选择此后端。没有任何密钥来源、或端点基址无法解析时，提供方不可用——每次搜索调用都会以结构化错误失败。

### 最小配置

加载 web 服务与本提供方，并把 seam 指向它。密钥是每次搜索解析的凭据引用，因此没有秘密进入组合文件。

```yaml
- name: '@deepseek-ai/dsh-web'
  config:
    searchProvider: tinyfish
- name: '@deepseek-ai/dsh-web-search-tinyfish'
  config:
    apiKeyEnv: TINYFISH_API_KEY
```

| 字段 | 默认值 | 含义 |
|---|---|---|
| `apiKeyEnv` | `TINYFISH_API_KEY` | 每次搜索通过 `ctx.credentials` 解析的凭据引用；未挂载凭据服务时回退到启动环境 |
| `apiKey` | （未设置） | 字面量密钥，优先于 `apiKeyEnv`。建议使用引用，以免秘密进入配置文件 |
| `baseURL` | `https://api.search.tinyfish.ai` | 端点基址；搜索操作即其根路径。无法解析的值会让提供方不可用 |

生成的[配置目录](../../../docs/config-catalog.zh.md#deepseek-aidsh-web-search-tinyfish)是所有可接受字段及其 JSDoc 的详尽来源。

### 一次搜索返回什么

每条 TinyFish 结果映射为一个 `WebSearchSource`：`url`、`title`、`snippet`，以及新闻和部分 web 结果的 `date`（映射为 `publishedAt`）。没有 URL 的结果会被丢弃；空白的可选字段会被省略，而不是发出空值。TinyFish 接口没有结果数量控制，因此请求的 `maxResults` 由服务负责执行——它负责截断与标记。TinyFish 不返回生成答案，因此结果不携带 `content`。

### 失败与恢复

缺少密钥，或 TinyFish 返回 401/402/403，会以 `WebError` `WEB_PROVIDER_CREDENTIAL_MISSING` 呈现，并指明密钥配置位置。其他提供方失败——HTTP 错误、网络失败、无法解析或形状不符的响应体——呈现为 `WEB_PROVIDER_ERROR`；被取消的请求呈现为 `WEB_ABORTED`。HTTP 重定向在联系 `Location` 目标之前即被拒绝。调用方按 code 路由；面向模型的 `web_search` 工具在其自身错误包装下把失败暴露给模型。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部——点击展开</summary>

本节解释提供方背后的设计决策；可观察行为已在[使用本包](#use-this-package)中完整覆盖。

### 设计哲学

本提供方是 TinyFish 搜索接口之上的薄适配层，有三条刻意的规则：

- **密钥每次搜索读取，从不捕获。** 它存放在凭据存储中，设置界面写入它无需重载本插件，因此粘贴的密钥在下一次搜索即生效，而不是下一次重启。
- **每次操作取一份段快照。** 密钥与发送目标端点一起读取，因此在凭据解析过程中落地的设置写入，不会把一份配置的密钥发往另一份配置的端点。
- **不编造答案。** TinyFish 不返回生成答案，因此省略 `content`，而不是伪造模型可能会信任的提供方文本。

### 源码地图

| 文件 | 角色 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：配置 schema、设置段、凭据解析、提供方注册 |
| [`src/provider.ts`](src/provider.ts) | `TinyFishSearchProvider`：请求派发、取消分类、结果映射 |
| [`src/types.ts`](src/types.ts) | TinyFish 线格式类型：`TinyFishSearchResponse`、`TinyFishResult`、`TinyFishError` |
| — | 不发布运行时不变量伴随文档；除其所属 seam 强制的契约外，本包不暴露独立的事件序列或可变数据关系。 |

### 请求与映射流程

`search()` 先解析凭据，然后以 `X-API-Key` 头和 `redirect: 'error'` 发出 `GET {baseURL}/?query=…`，因此重定向会让请求失败而不联系目标。解析出的 `results[]` 逐条映射，没有 URL 的条目被丢弃，服务在返回路径上执行最终的 `maxResults` 约束。取消——名为 `AbortError` 的 `DOMException`，或派发前就已取消的 signal——变成 `WEB_ABORTED`；密钥形状的失败变成 `WEB_PROVIDER_CREDENTIAL_MISSING`；其余变成 `WEB_PROVIDER_ERROR`。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

当包级契约不够用时阅读这些页面。它们从共享词汇走向服务、面向模型的工具，以及设计理由。

- [Web 子系统](../../../docs/subsystems/web.zh.md)——详尽的搜索请求/结果词汇与错误码。
- [Web 包地图](../README.zh.md)——web 家族与各自角色。
- [dsh-web](../web/README.zh.md)——本提供方注册进入的 web 服务，以及选择它的 `web` 设置段。
- [dsh-tool-web](../tool-web/README.zh.md)——渲染本提供方来源的面向模型 `web_search` 工具。
- [生成的配置目录](../../../docs/config-catalog.zh.md#deepseek-aidsh-web-search-tinyfish)——所有可接受配置字段及其来源声明。
- [Web 能力 seam 决策](../../../.agents/notes/implemented/architecture/2026-06-24-web-capability-seam.zh.md)——为什么搜索与抓取共用一个提供方选择服务。

-----

<a id="model-experience"></a>
## 模型体验

间接体验，通过 `dsh-tool-web`：它保留本提供方受 `maxResults` 约束的 URL、标题、snippet 与发布日期，或在消费方的错误包装下保留其确切的 `TinyFish search aborted`、`TinyFish search request failed: <error>`、`TinyFish returned an unprocessable response body: <error>` 与缺少密钥的失败。

#### KV Cache 影响

没有直接失效；请求前缀的任何变化由上述消费方负责。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>


这些限制界定了本提供方不适用的场景。它们是当前的包级约束。

- **不发送结果数量控制**——TinyFish 搜索接口改用分页，因此请求的 `maxResults` 只由服务的截断执行，且无论如何都会取回一页结果。
- **只发送查询词**——TinyFish 的 `purpose`、`location`、`language`、域名过滤、日期过滤与 `domain_type`（新闻、论文）均未暴露；它们等待提供方中立的服务字段（[seam Agent Note](../../../.agents/notes/implemented/architecture/2026-06-24-web-capability-seam.zh.md)）。
- **只做搜索**——TinyFish 的抓取与浏览器自动化接口未接入 `ctx.web` 的抓取一侧，抓取仍由匿名 HTTP 提供方负责。
- **取消分类基于错误形状**——只有名为 `AbortError` 的 `DOMException` 或已取消的 signal 映射为 `WEB_ABORTED`；携带自定义 reason 的取消会呈现为 `WEB_PROVIDER_ERROR`。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

本开发备注是维护者的工作上下文：开放问题与未定方向。它明确不具权威性——已发布的行为、限制与理由位于上文各节与所链接的 Agent Notes。

#### 未来：抓取与更宽的搜索面

TinyFish 的抓取接口能渲染重 JavaScript 页面并返回 markdown，这是匿名 HTTP 抓取提供方做不到的；把它作为第二个 `tinyfish` 抓取提供方接入是显而易见的下一步，且不需要新 seam。搜索过滤器保持未暴露，理由与 Exa 相同：本家族应当添加一个协调一致的控制项，而不是厂商专属参数。

</details>
