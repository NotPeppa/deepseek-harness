---
description: "Phase model routing for plan mode: how a deployment runs planning on one model and execution on another, and folds the exploration behind an approved plan."
kind: "package-reference"
---

# @deepseek-ai/dsh-plan-model-switch

English | [中文](README.zh.md)

## Summary

Use `dsh-plan-model-switch` to plan on one model and execute on another. Entering plan mode selects the planning model; approval selects the execution model and folds the exploration into one summary so execution carries the deliverable instead of the full transcript. Choose it when the phases need different cost or capability profiles. A phase changes only when both its provider and model are configured. The `plan-execute` preset mounts the runtime; base-backed profiles keep its settings visible before any session, while `standard` never applies them.

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

Choose the two models at any time in **Settings › Plugins › Plugin configuration › Plan and execution models**, then pick the **Plan / execute mode** agent preset when starting a session. The settings card remains visible without an active plan/execute session. Both model fields are dropdowns over the deployment's configured models — the same catalog the Models page reads — with a reasoning-effort choice for models that advertise one. From there the cycle is the ordinary one: `/plan` to enter plan mode, review the plan the agent presents through `exit_plan_mode`, and approve it. The approval is where the model changes.

### When to choose it

Choose phase routing when the two phases genuinely want different models — a stronger model to design, a cheaper or faster one to carry the design out. Skip it when the execution phase is two or three steps long: switching models starts a fresh provider-side cache lineage, and a short execution phase does not amortize that.

### Minimal configuration

Base-backed profiles mount `@deepseek-ai/dsh-plan-model-switch/settings` on the Host, which owns the durable settings namespace. Mount the runtime row inside an agent composition that already has plan mode. Routes are left to the settings section rather than inlined, because which models a deployment holds is not a fact a shipped composition knows.

```yaml
- name: '@deepseek-ai/dsh-plan-mode'
  config:
    section: |
      You are in plan mode. …
- name: '@deepseek-ai/dsh-plan-model-switch'
```

| Field | Default | Meaning |
|---|---|---|
| `planningProvider` / `planningModel` | (unset) | Route serving plan mode. Both are required; either alone leaves the phase unrouted |
| `planningReasoningEffort` | (unset) | Adapter-owned effort for the planning route; blank uses the model's default |
| `executingProvider` / `executingModel` | (unset) | Route serving the session once a plan is approved, under the same both-or-neither rule |
| `executingReasoningEffort` | (unset) | Adapter-owned effort for the execution route |
| `foldPlanning` | `true` | Whether leaving plan mode folds the exploration behind an approved plan into one summary |

The generated [configuration catalog](../../../docs/config-catalog.md#deepseek-aidsh-plan-model-switch) is the exhaustive source for every accepted field and its JSDoc.

### What switches, and when

The route changes at the step boundary where plan mode's own state changes — the step that carries out the approved plan is already the first step the execution model serves. A durable `[model changed: …]` notice is appended at each handoff, so a reader of the transcript can tell which model wrote what. A session that never enters plan mode keeps the model it was created with, and a phase left unconfigured keeps whatever route is already in force.

### What the fold does

On approval, the surface nodes between the moment plan mode turned on and the assistant message carrying the plan are replaced by one summary through the compaction seam. The approved plan, the conversation that preceded planning, and the system prompt are outside that span and stay verbatim. The replaced content remains in the session log, so replay reproduces the condensed conversation and a person can still read what was folded.

The fold completes before the first execution step runs, so that step already carries the plan rather than the exploration. It is skipped — silently and by design — when the deployment composes no compaction engine, when plan mode was left without an approved plan (`/plan off`), when the span holds fewer than four surface nodes, and when the session entered plan mode before this plugin first saw it (a resume or a fork). A fold that fails is logged and the session continues on the execution route.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

This section explains the design decisions behind the package; the observable behavior is fully covered in [Use this package](#use-this-package).

### Design philosophy

- **The deliverable is the handoff.** The execution model is a different model that never read the exploration; what it gets is the plan a person approved. That is why the fold stops before the plan rather than summarizing it along with everything else, and why the `plan-execute` preset's planning guidance demands rationale and rejected alternatives.
- **Route only on a transition.** First sight of a session that is not planning is a starting state, not a transition, so a session that never plans is never quietly moved onto the execution model.
- **Both halves of a route, or neither.** A half-named route would resolve its other half from the session's current selection — a different model than the one the user asked for.
- **The fold is an optimization, never a dependency.** Every failure path around it (no engine, no plan, an unbalanced span, a rejected compaction) leaves a correct session running the right route.

### Source map

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | Agent runtime: config schema, phase boundary, settings overlay, and route installation |
| [`src/settings.ts`](src/settings.ts) | Host companion: keeps the settings namespace registered independently of active sessions |
| [`src/routes.ts`](src/routes.ts) | The flat per-phase route shape and its projection into a `ModelSelection` |
| [`src/fold.ts`](src/fold.ts) | Span selection: the deliverable node, and the balanced planning span before it |
| — | No runtime invariant companion is published; this package exposes no independent event sequence or mutable data relation beyond contracts enforced at its owning seams. |

### Where the switch lands

The agent loop assembles the prompt, then opens the `agent/pre-step` waterfall that plan mode commits its state in. This plugin reads that state after `next()`, so it sees the boundary the step is about to run under. The selection it installs sets both `current` and the already-captured `assembled` value, because assembly for that step has finished: without it the step carrying the approved plan would still run on the planning model. Request routing, the `{{model}}` prompt variable, and the model-change notice all come from `installModelSelection` in `dsh-agent`, installed once per agent into that agent's own scope.

### Why positions, not sequence numbers

The fold span is computed by surface position. A positional replacement can leave visible seqs non-monotonic, so comparing sequence numbers would be comparing the wrong order; `indexOf` on the surface is the order the model actually sees.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these pages when the package-level contract is not enough.

- [Plan mode](../plan-mode/README.md) — the mode this package routes around, its guidance, and the reviewed exit.
- [Plan package map](../README.md) — the group and each role.
- [Compaction](../../compaction/compaction/README.md) — the seam the fold replaces its span through.
- [Agent presets](../../preset/agent-presets/README.md) — how the `plan-execute` preset mounts this row.
- [Generated configuration catalog](../../../docs/config-catalog.md#deepseek-aidsh-plan-model-switch) — every accepted config field and its source declaration.

-----

<a id="model-experience"></a>
## Model Experience

### Model-change notice

#### What the model sees

The durable user-role notice `dsh-agent` appends at each route change, naming the model above the boundary and the model continuing the session.

#### Token effect

Fixed and small: one short line per handoff, at most twice per plan cycle.

#### KV Cache effect

Replacing. A phase switch starts a fresh provider-side cache lineage for the new route, and the fold replaces earlier request tokens with one summary; both are intended, and both mean the first request of a phase reuses nothing. Within a phase the prefix is append-only again.

### Folded planning history

#### What the model sees

The compaction engine's summary in place of the exploration, followed by the approved plan verbatim.

#### Token effect

Replaced: the planning span's tokens are exchanged for one summary for the rest of the session.

#### KV Cache effect

Replacing, once, at the approval boundary; the reviewed plan and everything after it remain a stable prefix.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits describe when phase routing does not behave as you might expect.

- **The switch costs one cold prefix** — a different model reuses none of the session's provider-side cache. Phase routing pays for itself over a long execution phase and loses over a short one.
- **The `{{model}}` prompt variable lags by one step at a handoff** — the prompt is assembled before plan mode commits its state, and no outside observer can see that commit any earlier. The request itself is routed correctly; only the persona line naming the model is one step behind.
- **The fold needs an approved plan** — leaving with `/plan off` folds nothing, because an abandoned exploration is the only record of itself.
- **The summary is written by the compaction engine's own route** — the shipped engine summarizes with the model the latest request used, so the fold costs one summarization call on whichever model that is.
- **A forked child cannot take part** — `subagent_fork` copies the parent conversation, which is the cost the fold removes, and inherits the parent's route by design; the `plan-execute` preset therefore ships without it and delegates through `subagent`.
- **Plan mode restrains through text, not enforcement** — this package does not change that; a deployment that needs the planning phase to be read-only configures sandbox mode and approval policy independently.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

This Dev Note is working context for maintainers: open questions and undecided directions. It is explicitly non-authoritative — shipped behavior, limits, and rationale live in the sections above.

#### Future: routing the summarization call

The fold's summary is written by whichever route the compaction engine resolves, which at the approval boundary is still the planning model. Summarizing on the execution model would be cheaper and is a one-argument change once the seam takes a route for one call.

#### Future: phases beyond plan mode

The phase concept is currently plan mode's two states. A third phase (review, or a verification pass) would want the same routing, and the split between `routes.ts` and the boundary observation is where that would go.

</details>
