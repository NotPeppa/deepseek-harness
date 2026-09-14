/** Locale bundles for the plugin configuration section and its plugin cards. */

/** Locale keys these surfaces render. */
export type PluginsSettingsLocaleKey =
  | 'nav' | 'title' | 'intro' | 'tabs' | 'configurableTab' | 'empty'
  | 'overridden' | 'reset' | 'readOnly' | 'expand' | 'collapse'
  | 'save' | 'saving' | 'discard' | 'unsaved' | 'saveFailed' | 'invalidNumber'
  | 'bashTitle' | 'bashDescription' | 'bashTimeoutMs' | 'bashTimeoutMsHint'
  | 'bashMaxOutputBytes' | 'bashMaxOutputBytesHint'
  | 'agentLoopTitle' | 'agentLoopDescription' | 'agentLoopMaxParallel' | 'agentLoopMaxParallelHint'
  | 'webSearchTitle' | 'webSearchDescription'
  | 'webSearchApiKey' | 'webSearchApiKeyHint' | 'webSearchApiKeySet' | 'webSearchApiKeyUnset'
  | 'webSearchBaseUrl' | 'webSearchBaseUrlHint' | 'webSearchMaxUses' | 'webSearchMaxUsesHint'
  | 'tinyfishTitle' | 'tinyfishDescription'
  | 'tinyfishApiKey' | 'tinyfishApiKeyHint' | 'tinyfishApiKeySet' | 'tinyfishApiKeyUnset'
  | 'tinyfishUseForSearch' | 'tinyfishUseForSearchHint'
  | 'tinyfishBaseUrl' | 'tinyfishBaseUrlHint'
  | 'planPhaseTitle' | 'planPhaseDescription'
  | 'planPhasePlanningGroup' | 'planPhaseExecutingGroup'
  | 'planPhaseModel' | 'planPhaseModelHint'
  | 'planPhaseReasoningEffort' | 'planPhaseReasoningEffortHint'
  | 'planPhaseFold' | 'planPhaseFoldHint'
  | 'planPhaseKeepModel' | 'planPhaseDefaultEffort' | 'planPhaseEffortUnavailable'
  | 'planPhaseCatalogLoading' | 'planPhaseCatalogFailed' | 'planPhaseCatalogRetry'
  | 'planPhaseCatalogPartial'
  | 'subagentModelSelectionTitle' | 'subagentModelSelectionDescription'
  | 'subagentModelSelectionToggle' | 'subagentModelSelectionChoose' | 'subagentModelSelectionAllowed'
  | 'subagentModelSelectionLoading' | 'subagentModelSelectionLoadFailed' | 'subagentModelSelectionRetry'
  | 'subagentModelSelectionPartial' | 'subagentModelSelectionUnavailable'
  | 'subagentModelSelectionUnavailableGroup' | 'subagentModelSelectionEmpty'
  | 'subagentModelSelectionRequired' | 'subagentModelSelectionConflict' | 'subagentModelSelectionOff'

/** English copy. */
export const en: Record<PluginsSettingsLocaleKey, string> = {
  nav: 'Plugins',
  title: 'Plugins',
  intro: 'Configure and inspect the plugins installed in this deployment.',
  tabs: 'Plugin views',
  configurableTab: 'Plugin configuration',
  empty: 'This deployment exposes no plugin settings.',
  overridden: 'Overridden',
  reset: 'Reset to default',
  readOnly: 'This deployment stores settings read-only.',
  expand: 'Show settings',
  collapse: 'Hide settings',
  save: 'Save',
  saving: 'Saving…',
  discard: 'Discard',
  unsaved: 'Unsaved',
  saveFailed: 'The deployment did not accept these values; they were left for you to correct.',
  invalidNumber: 'Enter a number, or leave blank to use the default.',
  bashTitle: 'Shell',
  bashDescription: 'Limits every command the agent runs.',
  bashTimeoutMs: 'Command timeout (ms)',
  bashTimeoutMsHint: 'How long one command may run before it is terminated.',
  bashMaxOutputBytes: 'Output cap per stream (bytes)',
  bashMaxOutputBytesHint: 'Output beyond this spills to a temporary file rather than being lost.',
  agentLoopTitle: 'Agent loop',
  agentLoopDescription: 'How the agent dispatches tool calls.',
  agentLoopMaxParallel: 'Parallel tool calls',
  agentLoopMaxParallelHint: 'Upper bound on parallel-safe calls running at once within one step.',
  webSearchTitle: 'Web search',
  webSearchDescription: 'The DeepSeek search provider.',
  webSearchApiKey: 'API key',
  webSearchApiKeyHint: 'Stored outside the settings file. Leave blank to keep the current key.',
  webSearchApiKeySet: 'A key is configured.',
  webSearchApiKeyUnset: 'No key is configured; search is unavailable until one is.',
  webSearchBaseUrl: 'Endpoint',
  webSearchBaseUrlHint: 'Leave blank to use the provider default.',
  webSearchMaxUses: 'Max searches per request',
  webSearchMaxUsesHint: 'How many times one request may search before it must answer.',
  tinyfishTitle: 'TinyFish web search',
  tinyfishDescription: 'Search the web through TinyFish. Search is free on every TinyFish account.',
  tinyfishApiKey: 'API key',
  tinyfishApiKeyHint: 'Create one at agent.tinyfish.ai/api-keys. Stored outside the settings file; leave blank to keep the current key.',
  tinyfishApiKeySet: 'A key is configured.',
  tinyfishApiKeyUnset: 'No key is configured; TinyFish search is unavailable until one is.',
  tinyfishUseForSearch: 'Use TinyFish for web search',
  tinyfishUseForSearchHint: 'Points the web_search tool at TinyFish. Turning it off returns to the provider this deployment ships.',
  tinyfishBaseUrl: 'Endpoint',
  tinyfishBaseUrlHint: 'Leave blank to use the provider default.',
  planPhaseTitle: 'Plan and execution models',
  planPhaseDescription: 'Run planning and execution on different models. Only sessions on a preset that composes phase routing are affected; leave a phase blank to keep the session’s own model.',
  planPhasePlanningGroup: 'While planning',
  planPhaseExecutingGroup: 'After the plan is approved',
  planPhaseModel: 'Model',
  planPhaseModelHint: 'Chosen from the models this deployment has configured.',
  planPhaseReasoningEffort: 'Reasoning effort',
  planPhaseReasoningEffortHint: 'Optional; blank uses the model’s own default.',
  planPhaseFold: 'Fold the planning history',
  planPhaseFoldHint: 'On approval, replace the exploration behind the plan with one summary, so the execution phase carries the plan rather than the whole transcript. The approved plan is never folded.',
  planPhaseKeepModel: 'Keep the session’s model',
  planPhaseDefaultEffort: 'Model default',
  planPhaseEffortUnavailable: 'Available once this phase runs on a model that offers reasoning effort.',
  planPhaseCatalogLoading: 'Loading models…',
  planPhaseCatalogFailed: 'Models could not be loaded.',
  planPhaseCatalogRetry: 'Retry',
  planPhaseCatalogPartial: 'Some model providers could not be loaded; saved routes remain selectable.',
  subagentModelSelectionTitle: 'Subagent',
  subagentModelSelectionDescription: 'Control which models agents may choose for subagents.',
  subagentModelSelectionToggle: 'Allow agents to choose models for subagents',
  subagentModelSelectionChoose: 'When enabled, agents can choose a provider, model, and reasoning effort for each subagent from the authorized models below. Applies only to new sessions.',
  subagentModelSelectionAllowed: 'Models agents may choose',
  subagentModelSelectionLoading: 'Loading models…',
  subagentModelSelectionLoadFailed: 'Models could not be loaded.',
  subagentModelSelectionRetry: 'Retry',
  subagentModelSelectionPartial: 'Some model providers could not be loaded; saved choices remain removable.',
  subagentModelSelectionUnavailable: 'Currently unavailable',
  subagentModelSelectionUnavailableGroup: 'Saved but currently unavailable',
  subagentModelSelectionEmpty: 'No model provider currently advertises a model.',
  subagentModelSelectionRequired: 'Select at least one model before saving.',
  subagentModelSelectionConflict: 'Settings changed elsewhere. Discard your draft and try again.',
  subagentModelSelectionOff: 'Subagents use configured defaults or inherit the parent agent\'s model. Saved model choices are retained.',
}

/** Simplified Chinese copy. */
export const zh: Record<PluginsSettingsLocaleKey, string> = {
  nav: '插件',
  title: '插件',
  intro: '配置和查看本部署已安装的插件。',
  tabs: '插件视图',
  configurableTab: '插件配置',
  empty: '本部署没有开放任何插件设置。',
  overridden: '已覆盖',
  reset: '恢复默认',
  readOnly: '本部署的设置为只读。',
  expand: '展开设置',
  collapse: '收起设置',
  save: '保存',
  saving: '保存中…',
  discard: '放弃修改',
  unsaved: '未保存',
  saveFailed: '本部署没有接受这些值，已保留供你修改。',
  invalidNumber: '请填数字；留空表示使用默认值。',
  bashTitle: '终端',
  bashDescription: '限制 agent 运行的每一条命令。',
  bashTimeoutMs: '命令超时（毫秒）',
  bashTimeoutMsHint: '单条命令允许运行多久，超时即终止。',
  bashMaxOutputBytes: '单流输出上限（字节）',
  bashMaxOutputBytesHint: '超出部分会转存到临时文件，而不是被丢弃。',
  agentLoopTitle: 'Agent 循环',
  agentLoopDescription: 'Agent 如何派发工具调用。',
  agentLoopMaxParallel: '并行工具调用数',
  agentLoopMaxParallelHint: '同一步内最多同时运行多少个可并行的调用。',
  webSearchTitle: '网页搜索',
  webSearchDescription: 'DeepSeek 搜索提供方。',
  webSearchApiKey: 'API Key',
  webSearchApiKeyHint: '不写入设置文件。留空表示保持当前密钥。',
  webSearchApiKeySet: '已配置密钥。',
  webSearchApiKeyUnset: '未配置密钥；配置之前搜索不可用。',
  webSearchBaseUrl: '接口地址',
  webSearchBaseUrlHint: '留空则使用提供方默认地址。',
  webSearchMaxUses: '单次请求最多搜索次数',
  webSearchMaxUsesHint: '一次请求在必须作答前最多可以搜索多少次。',
  tinyfishTitle: 'TinyFish 网页搜索',
  tinyfishDescription: '通过 TinyFish 搜索网页。TinyFish 账号的搜索额度免费。',
  tinyfishApiKey: 'API Key',
  tinyfishApiKeyHint: '在 agent.tinyfish.ai/api-keys 创建。不写入设置文件；留空表示保持当前密钥。',
  tinyfishApiKeySet: '已配置密钥。',
  tinyfishApiKeyUnset: '未配置密钥；配置之前 TinyFish 搜索不可用。',
  tinyfishUseForSearch: '用 TinyFish 进行网页搜索',
  tinyfishUseForSearchHint: '把 web_search 工具指向 TinyFish。关闭后回到本部署自带的搜索提供方。',
  tinyfishBaseUrl: '接口地址',
  tinyfishBaseUrlHint: '留空则使用提供方默认地址。',
  planPhaseTitle: '规划与执行模型',
  planPhaseDescription: '让规划阶段与执行阶段各用一个模型。仅对组合了阶段路由的预设生效；某一阶段留空则保持会话自身的模型。',
  planPhasePlanningGroup: '规划阶段',
  planPhaseExecutingGroup: '计划通过之后',
  planPhaseModel: '模型',
  planPhaseModelHint: '从本部署已配置的模型中选择。',
  planPhaseReasoningEffort: '推理强度',
  planPhaseReasoningEffortHint: '可选；留空则使用该模型自身的默认值。',
  planPhaseFold: '折叠规划过程',
  planPhaseFoldHint: '计划通过时，把计划背后的探索过程替换成一段摘要，让执行阶段携带的是计划而不是整份记录。通过的计划本身永远不会被折叠。',
  planPhaseKeepModel: '不切换，沿用会话的模型',
  planPhaseDefaultEffort: '模型默认',
  planPhaseEffortUnavailable: '该阶段选中支持推理强度的模型后可用。',
  planPhaseCatalogLoading: '正在加载模型…',
  planPhaseCatalogFailed: '无法加载模型。',
  planPhaseCatalogRetry: '重试',
  planPhaseCatalogPartial: '部分模型提供方加载失败；已保存的路由仍可选择。',
  subagentModelSelectionTitle: 'Subagent',
  subagentModelSelectionDescription: '控制 Agent 为 Subagent 选择模型的权限。',
  subagentModelSelectionToggle: '允许 Agent 为 Subagent 选择模型',
  subagentModelSelectionChoose: '开启后，Agent 可以从下方授权模型中，为每个 Subagent 选择提供方、模型和推理强度。仅影响新会话。',
  subagentModelSelectionAllowed: 'Agent 可选择的模型',
  subagentModelSelectionLoading: '正在加载模型…',
  subagentModelSelectionLoadFailed: '无法加载模型。',
  subagentModelSelectionRetry: '重试',
  subagentModelSelectionPartial: '部分模型提供方暂时无法加载；已保存的选择仍可移除。',
  subagentModelSelectionUnavailable: '当前不可用',
  subagentModelSelectionUnavailableGroup: '已保存但当前不可用',
  subagentModelSelectionEmpty: '当前没有模型提供方公布模型。',
  subagentModelSelectionRequired: '保存前请至少选择一个模型。',
  subagentModelSelectionConflict: '设置已在其他位置更新。请放弃修改后重试。',
  subagentModelSelectionOff: '关闭后，Subagent 使用配置的默认模型或继承父 Agent 的模型；已选模型会保留。',
}
