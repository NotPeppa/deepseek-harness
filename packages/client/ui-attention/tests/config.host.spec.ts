/** The Host schema validates and withholds the browser preference from generated pages. */
import { Context } from '@deepseek-ai/cordis'
import { expect, it, onTestFinished, vi } from 'vitest'
import * as HostPlugin from '../src/index.ts'
import { liveConfig, omitsGeneratedPage } from '../../../settings/settings/tests/live-config.ts'
import { plainConfig } from '../../../settings/settings/src/schema.ts'

it('registers the disabled default and rejects invalid values', async () => {
  const ctx = new Context()
  const release = vi.fn()
  ctx.provide('settings', { configure: vi.fn(() => release) } as never)
  onTestFinished(() => { void ctx.fiber.dispose() })
  const configuration = await liveConfig(ctx, HostPlugin)
  expect(plainConfig(configuration.fiber.effectiveConfig)).toEqual({ enabled: false })
  await configuration.update({ enabled: true })
  expect(plainConfig(configuration.fiber.effectiveConfig)).toEqual({ enabled: true })
  await expect(configuration.update({ enabled: 'yes' })).rejects.toThrow()
  await configuration.fiber.dispose()
})

it('keeps its own instance off the generated Settings pages', () => omitsGeneratedPage(ctx => ctx.plugin(HostPlugin)))
