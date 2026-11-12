/** Real browser Notification and Page Visibility surface. */
import type { AttentionMessage, AttentionPlatform } from './attention.ts'

/**
 * Resolve the browser notification surface for the current document.
 * @returns the platform bound to `Notification` and the Page Visibility API.
 */
export function browserAttentionPlatform(): AttentionPlatform {
  const NotificationClass = typeof Notification === 'undefined' ? undefined : Notification
  return {
    hidden: () => document.visibilityState !== 'visible',
    permission: () => NotificationClass === undefined ? 'unsupported' : NotificationClass.permission,
    requestPermission: async () =>
      NotificationClass === undefined ? 'unsupported' : await NotificationClass.requestPermission(),
    show: (message: AttentionMessage, onClick: () => void) => {
      if (NotificationClass === undefined) return
      try {
        const notification = new NotificationClass(message.title, { body: message.body })
        notification.onclick = () => {
          notification.close()
          window.focus()
          onClick()
        }
      } catch (error) {
        // A browser that refuses the constructor leaves the Session UI as the only attention path.
        console.warn('[ui-attention] notification unavailable:', error)
      }
    },
    onVisibilityChange: (listener: () => void) => {
      document.addEventListener('visibilitychange', listener)
      return () => { document.removeEventListener('visibilitychange', listener) }
    },
  }
}
