/** `settings.theme` namespace dictionaries (the Appearance and font-size rows' copy). */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'appearance.title': '外观',
  'appearance.light': '浅色',
  'appearance.dark': '深色',
  'appearance.system': '跟随系统',
  'fontSize.title': '字号大小',
  'fontSize.description': '仅影响会话内容的字号',
  'fontSize.unit': 'px',
  'fontSize.increase': '增大字号',
  'fontSize.decrease': '减小字号',
  'background.title': '自定义背景',
  'background.description': '填入图片链接作为背景，可调节模糊与不透明度',
  'background.imagePlaceholder': '背景图片链接（留空则关闭）',
  'background.choose': '选择图片',
  'background.localImage': '已选择本地图片',
  'background.clear': '清除',
  'background.blur': '模糊',
  'background.opacity': '不透明度',
} satisfies Record<string, string>

/** The settings.theme namespace key union. */
export type ThemeKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'appearance.title': 'Appearance',
  'appearance.light': 'Light',
  'appearance.dark': 'Dark',
  'appearance.system': 'System',
  'fontSize.title': 'Font size',
  'fontSize.description': 'Only affects conversation content',
  'fontSize.unit': 'px',
  'fontSize.increase': 'Increase font size',
  'fontSize.decrease': 'Decrease font size',
  'background.title': 'Custom background',
  'background.description': 'Paste an image URL as the background; tune blur and opacity',
  'background.imagePlaceholder': 'Background image URL (empty disables it)',
  'background.choose': 'Choose image',
  'background.localImage': 'Local image selected',
  'background.clear': 'Clear',
  'background.blur': 'Blur',
  'background.opacity': 'Opacity',
} satisfies Record<ThemeKey, string>
