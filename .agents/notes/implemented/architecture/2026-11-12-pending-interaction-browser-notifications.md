# Agent Note: One pending-interaction watcher raises browser notifications

Status: implemented

English | [中文](2026-11-12-pending-interaction-browser-notifications.zh.md)

## Problem

Approvals, questions, and plan confirmations surface only inside the Session view, so a background tab hides the one thing the user must answer. [Approval](../../../../docs/subsystems/approval.md) and [user questions](../../../../docs/subsystems/user-questions.md) already share the `uiSession` pending-interaction projection, but nothing could act on it outside a Session view.

## Decision

A single Client plugin, `ui-attention`, observes `ctx.uiSession.sessionStatus` and raises one browser notification per pending request. It announces a request at most once per page lifetime, and only while `document.visibilityState` is hidden, the accepted preference enables notifications, and the browser granted permission. Activating the notification returns to the window and opens the Session that owns the request.

The enablement preference is a Host settings namespace (`ui-attention`, field `enabled`, default `false`) rendered by the plugin's own **Settings → General** row. The notification permission stays per browser and is requested from the switch's user gesture, because a Host value cannot grant it.

## Alternatives considered

**Each domain plugin raises its own notification.** Rejected: both domains would carry the permission request, the hidden-page check, and their own copy, and the approval plugin cannot localize text inside another plugin's dictionaries. The generic per-domain heading keeps one watcher and one copy owner.

**Store the switch in the browser.** Rejected by [shared Host preferences](../bug-fix/2026-09-15-authenticated-browser-host-preferences.md): preferences persist in the Host document for every authenticated browser, and the row explains a browser that has not granted permission instead.

**Notify regardless of page visibility.** Rejected: the in-page card already covers a visible window, and a visible reminder competes with it.

## Consequences

Notification copy names the domain and the Session title, not the request's own wording. A request that appears while the page is visible is announced only if the page later becomes hidden while it still waits. An unanswered request whose key changes is a new request and is announced again.

## Testing

Focused coverage pins the watcher's single announcement, visibility edge, preference and permission gates, pruning of answered requests, and disposal; the row spec covers every permission notice and read-only disablement; the apply spec composes the real settings forms and asserts the notification, the Session it opens, and row removal on disposal; the host spec pins the schema default, validation, and withheld generated page.
