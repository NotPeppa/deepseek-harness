/** Copy dictionaries for the branch selector. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'branch.label': '分支',
  'branch.none': '无分支',
  'branch.search': '搜索分支',
  'branch.empty': '没有匹配的分支',
  'branch.switching': '切换中…',
  'branch.local': '本地分支',
  'branch.remote': '远程分支',
  'branch.confirm': '确认切换',
  'branch.create': '新建分支',
  'branch.createPlaceholder': '新分支名（基于当前 HEAD）',
  'branch.createSubmit': '创建并切换',
  'branch.cancel': '取消',
  'worktree.manage': '管理工作树…',
  'worktree.title': '工作树',
  'worktree.description': '同一仓库的多个检出，各自独立。新建的工作树会注册成工作区，在那里开新会话即可。',
  'worktree.primary': '主检出',
  'worktree.managed': '受管',
  'worktree.linked': '外部',
  'worktree.detached': '（游离 HEAD）',
  'worktree.open': '已注册为工作区',
  'worktree.remove': '删除',
  'worktree.forceRemove': '仍有未提交内容，确认删除',
  'worktree.namePlaceholder': '工作树名称（同时作为 wt/ 分支后缀）',
  'worktree.basePlaceholder': '起点（留空则用当前 HEAD）',
  'worktree.create': '创建',
  'worktree.empty': '没有工作树。',
} satisfies Record<string, string>

/** The git namespace key union. */
export type GitKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'branch.label': 'Branch',
  'branch.none': 'No branch',
  'branch.search': 'Search branches',
  'branch.empty': 'No matching branch',
  'branch.switching': 'Switching…',
  'branch.local': 'Local branches',
  'branch.remote': 'Remote branches',
  'branch.confirm': 'Confirm switch',
  'branch.create': 'New branch',
  'branch.createPlaceholder': 'New branch name (from current HEAD)',
  'branch.createSubmit': 'Create and switch',
  'branch.cancel': 'Cancel',
  'worktree.manage': 'Manage worktrees…',
  'worktree.title': 'Worktrees',
  'worktree.description': 'Separate checkouts of one repository. A new worktree is registered as a workspace; open a session there to work in it.',
  'worktree.primary': 'primary',
  'worktree.managed': 'managed',
  'worktree.linked': 'external',
  'worktree.detached': '(detached HEAD)',
  'worktree.open': 'registered as a workspace',
  'worktree.remove': 'Remove',
  'worktree.forceRemove': 'Holds uncommitted work — remove anyway',
  'worktree.namePlaceholder': 'Worktree name (also the wt/ branch suffix)',
  'worktree.basePlaceholder': 'Base (defaults to the current HEAD)',
  'worktree.create': 'Create',
  'worktree.empty': 'No worktrees.',
} satisfies Record<GitKey, string>
