import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { createUserMessage, type GenerateOptions } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import AgentRegistry, { type Agent } from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import PlanModeController from '@deepseek-ai/dsh-plan-mode'
import * as planModelSwitch from '@deepseek-ai/dsh-plan-model-switch'
import type { Config } from '@deepseek-ai/dsh-plan-model-switch'
import { MockAdapter, textResponse } from '../../../core/agent-loop/tests/mock-adapter.ts'

const PLAN_CONFIG = { section: 'Test plan mode instructions.', maxExecutionAgents: 4 }

const ROUTES: Config = {
  planningProvider: 'mock',
  planningModel: 'planner',
  executingProvider: 'mock',
  executingModel: 'executor',
}

/**
 * Full-loop integration: a scripted mock model drives the REAL plan-mode and
 * phase-routing plugins through the agent loop, so what is asserted is the
 * model each request was actually routed to.
 */
async function harness(adapter: MockAdapter, config: Config = ROUTES): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(AgentLoop, { agents: [] })
  await ctx.plugin(PlanModeController, PLAN_CONFIG)
  await ctx.plugin(planModelSwitch, config)
  ctx.llm.registerAdapter(['mock'], adapter)
  return ctx
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

/** Run one user turn to completion. */
async function turn(ctx: Context, agent: Agent, text: string): Promise<void> {
  agent.followup(createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } }))
  await waitForIdle(ctx, agent)
}

/** Text of every durable model-change notice, in log order. */
function noticeTexts(agent: Agent): string[] {
  return agent.session.snapshotEvents().flatMap((event) => {
    if (event.type !== 'user/message') return []
    const source = event.data.source
    if (source.kind !== 'plugin' || source.plugin !== 'model-selection') return []
    return [event.data.content.filter(block => block.type === 'text').map(block => block.text).join('')]
  })
}

/** The models the adapter was asked for, in request order. */
function models(requests: readonly GenerateOptions[]): string[] {
  return requests.map(request => request.model)
}

describe('plan phase model routing', () => {
  it('routes planning and execution to their own models across one plan cycle', async () => {
    const adapter = new MockAdapter([
      textResponse('Here is the plan.'),
      textResponse('Executing it.'),
    ])
    const ctx = await harness(adapter)
    const agent = await ctx.agentLoop.create(SessionId('phase-cycle'), { provider: 'mock', model: 'base' })

    ctx.planMode.set(agent, true)
    await turn(ctx, agent, 'design the change')
    ctx.planMode.set(agent, false)
    await turn(ctx, agent, 'go ahead')

    expect(models(adapter.requests)).toEqual(['planner', 'executor'])
  })

  it('leaves a session that never plans on the route it was created with', async () => {
    const adapter = new MockAdapter([textResponse('One.'), textResponse('Two.')])
    const ctx = await harness(adapter)
    const agent = await ctx.agentLoop.create(SessionId('phase-none'), { provider: 'mock', model: 'base' })

    await turn(ctx, agent, 'just do it')
    await turn(ctx, agent, 'and this too')

    expect(models(adapter.requests)).toEqual(['base', 'base'])
  })

  it('leaves an unconfigured phase on the current route', async () => {
    const adapter = new MockAdapter([textResponse('Planning.'), textResponse('Executing.')])
    // Only the planning phase is configured: leaving plan mode must not strand
    // the session on a route nobody named.
    const ctx = await harness(adapter, { planningProvider: 'mock', planningModel: 'planner' })
    const agent = await ctx.agentLoop.create(SessionId('phase-partial'), { provider: 'mock', model: 'base' })

    ctx.planMode.set(agent, true)
    await turn(ctx, agent, 'design')
    ctx.planMode.set(agent, false)
    await turn(ctx, agent, 'run')

    expect(models(adapter.requests)).toEqual(['planner', 'planner'])
  })

  it('re-entering plan mode returns to the planning model', async () => {
    const adapter = new MockAdapter([
      textResponse('Plan v1.'),
      textResponse('Executing.'),
      textResponse('Plan v2.'),
    ])
    const ctx = await harness(adapter)
    const agent = await ctx.agentLoop.create(SessionId('phase-reentry'), { provider: 'mock', model: 'base' })

    ctx.planMode.set(agent, true)
    await turn(ctx, agent, 'design')
    ctx.planMode.set(agent, false)
    await turn(ctx, agent, 'run')
    ctx.planMode.set(agent, true)
    await turn(ctx, agent, 'rethink')

    expect(models(adapter.requests)).toEqual(['planner', 'executor', 'planner'])
  })

  it('narrates each handoff as a durable model-change notice', async () => {
    const adapter = new MockAdapter([
      textResponse('Default turn.'),
      textResponse('Plan.'),
      textResponse('Execute.'),
    ])
    const ctx = await harness(adapter)
    const agent = await ctx.agentLoop.create(SessionId('phase-notice'), { provider: 'mock', model: 'base' })

    await turn(ctx, agent, 'hello')
    ctx.planMode.set(agent, true)
    await turn(ctx, agent, 'design')
    ctx.planMode.set(agent, false)
    await turn(ctx, agent, 'run')

    expect(models(adapter.requests)).toEqual(['base', 'planner', 'executor'])
    // The reader of a mixed transcript can tell which model wrote what.
    expect(noticeTexts(agent)).toEqual([
      expect.stringContaining('base') as unknown as string,
      expect.stringContaining('planner') as unknown as string,
    ])
    expect(noticeTexts(agent)[0]).toContain('planner')
    expect(noticeTexts(agent)[1]).toContain('executor')
  })

  it('runs without a compaction service mounted', async () => {
    const adapter = new MockAdapter([textResponse('Plan.'), textResponse('Execute.')])
    const ctx = await harness(adapter, {
      planningProvider: 'mock',
      planningModel: 'planner',
      executingProvider: 'mock',
      executingModel: 'executor',
      foldPlanning: true,
    })
    const agent = await ctx.agentLoop.create(SessionId('phase-nofold'), { provider: 'mock', model: 'base' })

    ctx.planMode.set(agent, true)
    await turn(ctx, agent, 'design')
    ctx.planMode.set(agent, false)
    await turn(ctx, agent, 'run')

    expect(models(adapter.requests)).toEqual(['planner', 'executor'])
  })
})
