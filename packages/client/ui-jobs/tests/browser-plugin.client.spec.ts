/**
 * ui-job plugin halves: the browser entry's dictionary and header-slot
 * registrations against the real SlotRegistry (with fiber teardown proving
 * removal — HMR safety), and the inert node entry.
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { stubSettingsScope } from '@deepseek-ai/dsh-client-test-runtime'
import { apply as applyLocale, inject as localeInject } from '@deepseek-ai/dsh-client-locale/client'
import { apply, inject } from '../src/client/index.ts'
import { apply as applyNode } from '../src/index.ts'
import { en, NS, zh } from '../src/client/locales.ts'
import { JOBS_ID } from '../src/client/definition.tsx'

/** Slot ledger reader: entry ids currently registered in the header list. */
function headerEntryIds(ctx: Context): (string | undefined)[] {
  return ctx.slots
    .entries('conversation.session.header.actions')
    .map(entry => entry.options.id)
}

/** Boot the browser half over a real slot tree that declares the header list. */
async function bench(
  sidebar = true,
): Promise<{ ctx: Context; fiber: ReturnType<Context['plugin']>; registered: string[] }> {
  const ctx = new Context()
  const registered: string[] = []
  await ctx.plugin(SlotRegistry).await()
  ctx.slots.register({
    name: 'root',
    children: {
      'conversation.session.header.actions': { kind: 'list', scope: 'session' },
      'sidebar.right.pane.tab': { kind: 'keyed', scope: 'session' },
      'sidebar.right.pane.tab.title': { kind: 'keyed', scope: 'session' },
    },
  } as never, () => null)
  ctx.provide('sessions', {})
  if (sidebar) {
    ctx.provide('sidebarRightTabs', {
      register: (definition: { id: string }) => {
        registered.push(definition.id)
        return () => { registered.splice(registered.indexOf(definition.id), 1) }
      },
    } as never)
  }
  // The locale plugin binds a settings scope, which reads the connection handle
  // and the forwarded-event port.
  ctx.provide('connection', { api: { settings: {} }, isLoopback: false } as never)
  ctx.provide('remote', { $on: () => () => {} } as never)
  ctx.provide('settingsScope', { bind: () => stubSettingsScope().scope } as never)
  await ctx.plugin({ inject: localeInject, apply: applyLocale }).await()
  // These specs assert the shipped Chinese copy. There is no jsdom `window` in
  // this lane, so browser-language detection never runs and the locale comes
  // from FALLBACK_LOCALE (en): state the asserted locale explicitly.
  ctx.locale.setLocale('zh')
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { ctx, fiber, registered }
}

describe('ui-job browser half', () => {
  it('declares the services it binds', () => {
    expect(inject).toEqual(['sessions', 'slots', 'locale'])
  })

  it('registers the header action, and fiber teardown removes it (HMR safety)', async () => {
    const { ctx, fiber } = await bench()
    expect(headerEntryIds(ctx)).toContain('job-list')
    await fiber.dispose()
    expect(headerEntryIds(ctx)).not.toContain('job-list')
  })

  it('registers the Sidebar tab type, body, and title, and releases them with the fiber', async () => {
    const { ctx, fiber, registered } = await bench()
    expect(registered).toEqual([JOBS_ID])
    const keys = (name: 'sidebar.right.pane.tab' | 'sidebar.right.pane.tab.title'): unknown[] =>
      ctx.slots.entries(name).map(entry => entry.options.key)
    expect(keys('sidebar.right.pane.tab')).toContain(JOBS_ID)
    expect(keys('sidebar.right.pane.tab.title')).toContain(JOBS_ID)

    await fiber.dispose()
    expect(registered).toEqual([])
    expect(keys('sidebar.right.pane.tab')).not.toContain(JOBS_ID)
  })

  it('keeps the header action when no right Sidebar is composed', async () => {
    const { ctx } = await bench(false)
    expect(headerEntryIds(ctx)).toContain('job-list')
    expect(ctx.slots.entries('sidebar.right.pane.tab')).toHaveLength(0)
  })

  it('registers both dictionaries under its own namespace and releases them with the fiber', async () => {
    const { ctx, fiber } = await bench()
    const translate = ctx.locale.bind(NS)
    expect(translate('list.aria')).toBe(zh['list.aria'])
    ctx.locale.setLocale('en')
    expect(translate('list.aria')).toBe(en['list.aria'])

    // Withdrawn dictionaries leave the key unresolved rather than translated.
    await fiber.dispose()
    expect(translate('list.aria')).not.toBe(en['list.aria'])
  })

  it('keeps the English dictionary key-identical to the Chinese source of truth', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
  })
})

describe('ui-job node half', () => {
  it('contributes no host behavior', () => {
    // The node half exists only so the plugin appears in the Loader tree.
    expect(applyNode).not.toThrow()
  })
})
