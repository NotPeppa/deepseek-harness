/**
 * Span selection for the planning fold: which surface nodes the exploration
 * occupied, so leaving plan mode can replace them with one summary while the
 * reviewed plan itself survives verbatim.
 *
 * The executor only needs the deliverable. Everything the planner read, tried,
 * and discarded is worth one summary paragraph, not a full transcript the
 * execution phase then pays for on every request.
 *
 * Spans are computed by surface POSITION, not by comparing sequence numbers: a
 * replacement can leave visible seqs non-monotonic, and position is what the
 * surface actually orders by.
 *
 * @module @deepseek-ai/dsh-plan-model-switch/fold
 */

import { toolPairingBalancedAfter, toolPairingBalancedBefore } from '@deepseek-ai/dsh-compaction'
import type { Session, SessionSeq } from '@deepseek-ai/dsh-session'

/** An inclusive surface span, both edges tool-pairing balanced. */
export interface FoldSpan {
  /** First surface seq to replace, inclusive. */
  readonly start: SessionSeq
  /** Last surface seq to replace, inclusive. */
  readonly end: SessionSeq
}

/**
 * Find the surface node carrying the most recent call to the plan-mode exit
 * tool — the assistant message the reviewed plan rode in on.
 *
 * A tool call is not itself a surface node; it is part of the assistant message
 * that made it, which is the node a fold has to stop short of.
 *
 * @param session - session whose log and surface are scanned.
 * @param toolName - the exit tool's model-facing name.
 * @returns the deliverable node's seq, or `undefined` when this plan phase
 *   produced no reviewed plan.
 */
export function deliverableNodeSeq(session: Session, toolName: string): SessionSeq | undefined {
  const call = session.snapshotEvents().findLast(event =>
    event.type === 'tool/call' && event.data.name === toolName)
  if (call === undefined) return undefined
  // The carrier is the last surface node at or before the call.
  let carrier: SessionSeq | undefined
  for (const seq of session.surface.nodes) {
    if (seq <= call.seq && (carrier === undefined || seq > carrier)) carrier = seq
  }
  return carrier
}

/**
 * Select the planning span between the mark taken when plan mode turned on and
 * the node carrying the plan that ended it.
 *
 * Both edges are walked inward until the cut is tool-pairing balanced, because
 * a span that splits a tool call from its result is rejected by the compaction
 * seam — and a walked edge only ever folds less than asked, never more.
 *
 * @param session - session whose surface is being folded.
 * @param markSeq - last surface node before planning began; nodes after it are
 *   candidates. `undefined` means planning began before this process saw the
 *   session, which is not a span this function will guess at.
 * @param deliverableSeq - the node carrying the reviewed plan; the fold stops
 *   before it. `undefined` means no plan was produced, and an abandoned
 *   exploration is the only record of itself.
 * @param minimumNodes - smallest span worth summarizing.
 * @returns the span to replace, or `undefined` when there is nothing safe and
 *   worthwhile to fold.
 */
export function planningSpan(
  session: Session,
  markSeq: SessionSeq | undefined,
  deliverableSeq: SessionSeq | undefined,
  minimumNodes: number,
): FoldSpan | undefined {
  if (markSeq === undefined || deliverableSeq === undefined) return undefined
  const nodes = session.surface.nodes
  const markIndex = nodes.indexOf(markSeq)
  const deliverableIndex = nodes.indexOf(deliverableSeq)
  // A mark that a later replacement already swallowed marks nothing.
  if (markIndex === -1 || deliverableIndex === -1) return undefined
  const candidates = nodes.slice(markIndex + 1, deliverableIndex)
  if (candidates.length < minimumNodes) return undefined

  let first = 0
  while (first < candidates.length && !balancedBefore(session, candidates[first])) first += 1
  let last = candidates.length - 1
  while (last >= first && !balancedAfter(session, candidates[last])) last -= 1
  if (last < first || last - first + 1 < minimumNodes) return undefined

  const start = candidates[first]
  const end = candidates[last]
  if (start === undefined || end === undefined) return undefined
  return { start, end }
}

/**
 * Balance check that treats a seq the session cannot explain as unbalanced.
 *
 * The helpers throw for a seq missing from the surface or a result with no open
 * call; neither is a reason to fail the handoff, so an unexplainable edge is
 * simply not an edge this fold uses.
 * @param session - session whose surface is checked.
 * @param seq - candidate edge.
 * @returns whether the cut before it is balanced.
 */
function balancedBefore(session: Session, seq: SessionSeq | undefined): boolean {
  if (seq === undefined) return false
  try {
    return toolPairingBalancedBefore(session, seq)
  } catch {
    return false
  }
}

/**
 * Trailing-cut counterpart of {@link balancedBefore}.
 * @param session - session whose surface is checked.
 * @param seq - candidate edge.
 * @returns whether the cut after it is balanced.
 */
function balancedAfter(session: Session, seq: SessionSeq | undefined): boolean {
  if (seq === undefined) return false
  try {
    return toolPairingBalancedAfter(session, seq)
  } catch {
    return false
  }
}
