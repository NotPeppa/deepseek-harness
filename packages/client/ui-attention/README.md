---
description: "Notify the browser when an approval or question waits for an answer."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-attention

English | [中文](README.zh.md)

## Summary

Raise a browser notification when an approval, question, or plan confirmation waits for an answer while the page is hidden. The switch sits in **Settings → General**. Each browser grants its own notification permission; the Host stores whether notifications are enabled.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Turn on **Browser notifications** in Settings → General. The browser asks for notification permission when the switch is first turned on in that browser. Afterwards, a request that appears while the tab is in the background raises one notification; activating it returns to the window and opens the Session that is waiting. The switch shows the accepted Host value, so another browser that has not granted permission explains its own state under the same row.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation details — click to expand</summary>

One watcher covers every pending-interaction domain by observing the `uiSession` Session status projection, instead of each approval or question plugin raising its own notification. Each pending request is announced at most once per page lifetime, and only while `document.visibilityState` is `hidden`, the accepted Host preference enables it, and the browser granted permission. Notification copy comes from the `attention` locale namespace; the Host half contributes only the `enabled` field of the `ui-attention` settings namespace.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Approval](../../../docs/subsystems/approval.md) — the approval waterfall this watcher observes.
- [Settings forms](../ui-settings/README.md) — accepted Host values and ordered writes.
- [Web Client](../../../docs/subsystems/web-client.md) — plugin composition and Session status facts.

<a id="model-experience"></a>
## Model Experience

None, as this browser preference contributes no model-visible content.

#### KV Cache effect

None; notifications are a browser surface over existing Session state.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- A notification is raised only while the page is hidden. A visible but unfocused window shows the in-page card instead.
- A browser that never granted permission raises no reminder even when another browser enabled the preference; the row explains that state and offers the permission request again.
- Activating the notification opens the Session that owns the request. A notification daemon that drops the click handler leaves the view unchanged.

<a id="dev-note"></a>
### Dev Note

None.
