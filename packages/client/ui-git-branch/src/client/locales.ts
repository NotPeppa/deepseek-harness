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
} satisfies Record<GitKey, string>
