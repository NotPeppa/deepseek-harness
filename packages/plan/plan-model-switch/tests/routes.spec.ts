import { describe, expect, it } from 'vitest'
import { routeFor, sameRoute } from '@deepseek-ai/dsh-plan-model-switch'

describe('phase route projection', () => {
  it('reads each phase from its own fields', () => {
    const routes = {
      planningProvider: 'deepseek-official',
      planningModel: 'big',
      executingProvider: 'deepseek-official',
      executingModel: 'small',
    }
    expect(routeFor(routes, 'planning')).toEqual({ provider: 'deepseek-official', model: 'big' })
    expect(routeFor(routes, 'executing')).toEqual({ provider: 'deepseek-official', model: 'small' })
  })

  it('carries a configured reasoning effort', () => {
    expect(routeFor({ planningProvider: 'p', planningModel: 'm', planningReasoningEffort: 'high' }, 'planning'))
      .toEqual({ provider: 'p', model: 'm', reasoningEffort: 'high' })
  })

  it('leaves a phase unrouted unless both provider and model are configured', () => {
    expect(routeFor({}, 'planning')).toBeUndefined()
    expect(routeFor({ planningProvider: 'p' }, 'planning')).toBeUndefined()
    expect(routeFor({ planningModel: 'm' }, 'planning')).toBeUndefined()
    // A blank field is no field: an emptied control must not half-name a route.
    expect(routeFor({ planningProvider: '  ', planningModel: 'm' }, 'planning')).toBeUndefined()
  })

  it('trims what the user typed', () => {
    expect(routeFor({ planningProvider: ' p ', planningModel: ' m ' }, 'planning'))
      .toEqual({ provider: 'p', model: 'm' })
  })

  it('does not read one phase out of the other phase fields', () => {
    expect(routeFor({ planningProvider: 'p', planningModel: 'm' }, 'executing')).toBeUndefined()
  })
})

describe('route comparison', () => {
  it('treats identical routes as unchanged', () => {
    expect(sameRoute({ provider: 'p', model: 'm' }, { provider: 'p', model: 'm' })).toBe(true)
    expect(sameRoute(undefined, undefined)).toBe(true)
  })

  it('separates a changed provider, model, effort, or presence', () => {
    expect(sameRoute({ provider: 'p', model: 'm' }, { provider: 'q', model: 'm' })).toBe(false)
    expect(sameRoute({ provider: 'p', model: 'm' }, { provider: 'p', model: 'n' })).toBe(false)
    expect(sameRoute(
      { provider: 'p', model: 'm' },
      { provider: 'p', model: 'm', reasoningEffort: 'high' as never },
    )).toBe(false)
    expect(sameRoute(undefined, { provider: 'p', model: 'm' })).toBe(false)
  })
})
