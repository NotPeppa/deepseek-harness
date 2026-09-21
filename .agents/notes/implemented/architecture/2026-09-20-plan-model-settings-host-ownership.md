# Agent Note: Plan model settings have a Host owner

Status: implemented

English | [中文](2026-09-20-plan-model-settings-host-ownership.zh.md)

## Problem

The plan/execution model card is a browser surface used to configure a future session, but its settings namespace was registered by the agent-plane runtime. That runtime exists only while a session using the `plan-execute` preset is mounted. Before the first such session, and after its last session closed, the Host described no `plan-model-switch` namespace; the settings tab therefore hid the card. Requiring a user to start the target mode before configuring it reverses the creation order the setting exists to support.

Registering the namespace from each session also made a shared user preference depend on session lifetime. Concurrent plan/execute sessions could attempt to register the same unique namespace, while closing its owner removed the configuration surface for every other session.

## Decision

`@deepseek-ai/dsh-plan-model-switch/settings` is the single Host-plane owner of the `plan-model-switch` settings namespace. The base bundle mounts it beside the settings provider, so every base-backed profile describes the namespace for the Host lifetime. The Web card continues to follow the ordinary served-namespace directory and therefore renders without a special visibility exception.

The `@deepseek-ai/dsh-plan-model-switch` root export remains the agent-plane runtime mounted by the `plan-execute` preset. It does not register a namespace. At each plan-phase boundary it reads the Host owner's resolved section, whose companion-row configuration supplies the composition defaults and whose saved user choices win over them. Without the Host companion or a settings provider, the runtime uses its own entry.

The settings owner and runtime are separate package exports because their lifetimes and dependencies differ: the owner requires only `ctx.settings`; the runtime requires plan mode and session projections. Keeping the runtime out of the Host prevents global phase listeners, while keeping the owner out of an agent realm prevents session disposal from removing the shared configuration.

## Alternatives considered

**Always dispatch the card key in the browser.** The card's settings scope would still be unavailable, so the shared card chrome would render nothing; forcing it visible would produce disabled controls whose values could not be saved. Rejected because visibility must correspond to a writable settings owner.

**Mount the complete runtime on the Host.** The runtime requires agent-plane plan-mode state and would either wait forever for those services or install phase listeners in the wrong realm. Rejected because configuration ownership does not imply runtime ownership.

**Let the first plan/execute session continue to own the namespace.** This keeps configuration unavailable at the point users need it and makes namespace lifetime depend on an arbitrary session. Rejected.

## Consequences

- The plan/execution model card is present whenever a base-backed Host is connected, including with no sessions open and while the selected preset is `standard`.
- Saving the card does not enable phase routing for presets that do not mount the runtime; the card copy states that only presets composing phase routing are affected.
- Custom deployments that do not use `dsh-base` mount both exports when they want the persistent card and runtime behavior, and put shared defaults on the Host companion row.
- One Host registration serves every plan/execute session, avoiding duplicate namespace registration and session-order dependence.

## Verification

The plan-model-switch integration tests pin Host-lifetime registration, the default fold value, runtime-entry fallback, and resolved Host-setting precedence. The base bundle test pins the Host companion row. The existing client settings tests continue to pin that only served namespaces are dispatched, so the visible card follows from the real Host registration rather than a browser-only exception.
