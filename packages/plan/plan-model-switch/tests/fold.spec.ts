import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { createUserMessage } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId, SessionSeq } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import * as NativeToolExecutor from '@deepseek-ai/dsh-tool-executor-native'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { defineContentToolFixture } from '@deepseek-ai/dsh-tool-testkit'
import AgentRegistry, { type Agent } from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import UserQuestionService from '@deepseek-ai/dsh-user-questions'
import CompactionEngine, { CompactionId, type CompactionResult } from '@deepseek-ai/dsh-compaction'
import PlanModeController, { EXIT_PLAN_MODE } from '@deepseek-ai/dsh-plan-mode'
import * as planModelSwitch from '@deepseek-ai/dsh-plan-model-switch'
import type { Config } from '@deepseek-ai/dsh-plan-model-switch'
import { MockAdapter, textResponse, toolCallResponse } from '../../../core/agent-loop/tests/mock-adapter.ts'

const PLAN_CONFIG = { section: 'Test plan mode instructions.', maxExecutionAgents: 4 }

const ROUTES: Config = {
  planningProvider: 'mock',
  planningModel: 'planner',
  executingProvider: 'mock',
  executingModel: 'executor',
}

const PLAN = '# Plan\n\n1. Do the thing.'

/** Records the spans it was asked to fold; summarization is not under test. */
class RecordingCompaction extends CompactionEngine {
  readonly regions: { start: SessionSeq; end: SessionSeq }[] = []

  override compactIfNeeded(): Promise<null> {
    return Promise.resolve(null)
  }

  override compactNow(): Promise<null> {
    return Promise.resolve(null)
  }

  override compactRegion(start: SessionSeq, end: SessionSeq): Promise<CompactionResult> {
    this.regions.push({ start, end })
    // The plugin ignores the value and only reports a rejection, so any
    // well-formed result over the requested span is enough here.
    return Promise.resolve({
      compactionId: CompactionId('fold-test'),
      startSeq: SessionSeq(0),
      summarySeq: SessionSeq(0),
      endSeq: SessionSeq(0),
      summary: [{ type: 'text', text: 'folded' }],
      shadowedRange: { start, end },
      shadowedSeqs: [start, end],
      shadowedTokenCount: 0,
    })
  }
}

/**
 * Full-loop harness with the interaction channel the exit tool needs and a
 * recording compaction engine in place of a model-backed one.
 */
async function harness(adapter: MockAdapter, config: Config = ROUTES): Promise<{
  ctx: Context
  compaction: RecordingCompaction
}> {
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(NativeToolExecutor)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(AgentLoop, { agents: [] })
  await ctx.plugin(UserQuestionService)
  await ctx.plugin(RecordingCompaction)
  await ctx.plugin(PlanModeController, PLAN_CONFIG)
  await ctx.plugin(planModelSwitch, config)
  ctx.llm.registerAdapter(['mock'], adapter)
  ctx.tools.register(defineContentToolFixture({
    name: 'read',
    description: 'test tool read',
    parameters: {},
    execute: () => Promise.resolve([{ type: 'text', text: 'file contents' }]),
  }))
  // A human who approves every plan and selects two worker agents.
  ctx.on('user-questions/request', (request, next) => {
    const question = request.questions[0]
    if (question?.id === 'execution-agents') {
      return Promise.resolve({ answers: [{ id: question.id, selected: ['2'] }] })
    }
    const approve = question?.intent?.approve
    if (question === undefined || approve === undefined) return next()
    return Promise.resolve({ answers: [{ id: question.id, selected: [approve] }] })
  })
  return { ctx, compaction: ctx.compaction as RecordingCompaction }
}

function waitForIdle(ctx: Context, agent: Agent): Promise<void> {
  return new Promise((resolve) => {
    const dispose = ctx.on('agent/status', ({ agent: subject, status }) => {
      if (subject === agent && status === 'idle') {
        dispose()
        resolve()
      }
    })
  })
}

async function turn(ctx: Context, agent: Agent, text: string): Promise<void> {
  agent.followup(createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } }))
  await waitForIdle(ctx, agent)
}

/**
 * Text of every surface node inside a span, by POSITION: a replacement leaves
 * visible seqs non-monotonic, so position is the only ordering to slice on.
 */
function textsInSpan(agent: Agent, span: { start: SessionSeq; end: SessionSeq }): string {
  const nodes = agent.session.surface.nodes
  const from = nodes.indexOf(span.start)
  const to = nodes.indexOf(span.end)
  return nodes.slice(from, to + 1)
    .map(seq => JSON.stringify(agent.session.eventAt(seq)?.data ?? null))
    .join(' | ')
}

/** One plain turn, then a planning turn: two tool calls and the reviewed exit. */
function planningScript(): ConstructorParameters<typeof MockAdapter>[0] {
  return [
    textResponse('Hi.'),
    toolCallResponse('call-1', 'read', {}, 'Looking around.'),
    toolCallResponse('call-2', 'read', {}, 'Still looking.'),
    toolCallResponse('call-3', EXIT_PLAN_MODE, { plan: PLAN }, 'Plan ready.'),
    textResponse('Carrying out the plan.'),
  ]
}

describe('folding the planning span', () => {
  it('folds the exploration and stops short of the reviewed plan', async () => {
    const { ctx, compaction } = await harness(new MockAdapter(planningScript()))
    const agent = await ctx.agentLoop.create(SessionId('fold-cycle'), { provider: 'mock', model: 'base' })

    await turn(ctx, agent, 'hello')
    ctx.planMode.set(agent, true)
    await turn(ctx, agent, 'design the change')
    await turn(ctx, agent, 'go ahead')

    expect(compaction.regions).toHaveLength(1)
    const folded = textsInSpan(agent, compaction.regions[0]!)
    // The exploration goes.
    expect(folded).toContain('Looking around.')
    expect(folded).toContain('Still looking.')
    // The plan the user approved stays, and so does the turn before planning.
    // The exit tool's NAME is protocol traffic — the in-history tool-addition
    // developer message announces it inside the planning span — so the cut is
    // checked against the reviewed plan's own text and carrier instead.
    expect(folded).not.toContain('Plan ready.')
    expect(folded).not.toContain('Do the thing')
    expect(folded).not.toContain('Hi.')
  })

  it('does not fold when the configuration turns it off', async () => {
    const { ctx, compaction } = await harness(
      new MockAdapter(planningScript()), {
        planningProvider: 'mock',
        planningModel: 'planner',
        executingProvider: 'mock',
        executingModel: 'executor',
        foldPlanning: false,
      })
    const agent = await ctx.agentLoop.create(SessionId('fold-off'), { provider: 'mock', model: 'base' })

    await turn(ctx, agent, 'hello')
    ctx.planMode.set(agent, true)
    await turn(ctx, agent, 'design the change')
    await turn(ctx, agent, 'go ahead')

    expect(compaction.regions).toEqual([])
  })

  it('does not fold a plan phase that produced no reviewed plan', async () => {
    const adapter = new MockAdapter([
      textResponse('Hi.'),
      toolCallResponse('call-1', 'read', {}, 'Looking around.'),
      textResponse('Thinking out loud.'),
      textResponse('Doing it.'),
    ])
    const { ctx, compaction } = await harness(adapter)
    const agent = await ctx.agentLoop.create(SessionId('fold-abandoned'), { provider: 'mock', model: 'base' })

    await turn(ctx, agent, 'hello')
    ctx.planMode.set(agent, true)
    await turn(ctx, agent, 'design the change')
    // `/plan off`: the user left without approving a plan, so the exploration
    // is all there is — summarizing it away would delete the only record.
    ctx.planMode.set(agent, false)
    await turn(ctx, agent, 'go ahead')

    expect(compaction.regions).toEqual([])
  })
})
