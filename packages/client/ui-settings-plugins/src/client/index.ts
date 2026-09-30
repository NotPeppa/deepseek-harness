/**
 * Built-in plugins settings section, browser half: the shell around the
 * feature-owned tabs registered into `settings.plugins.tab` (the read-only
 * inventory ships one). The configuration pages of the host-plane plugins
 * live in their own companion packages, which register into the Plugins
 * page; this section owns the Settings navigation entry and the tab chrome
 * only.
 */

// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the settings shell's SlotMap merge (the 'settings.section'
// entry). Cross-plugin collaboration goes through slots, never a value import
// (client bundle purity gate).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { PluginsSettingsSection } from './PluginsSettingsSection.tsx'
import type { PluginsSettingsSectionInjected, PluginsSettingsTabEntry } from './PluginsSettingsSection.tsx'
import { en, zh } from './locales.ts'
import { PlanModelSwitchCard } from './PlanModelSwitchCard.tsx'
import { TinyFishCard } from './TinyFishCard.tsx'
import { PLAN_MODEL_SWITCH_NS, PlanModelSwitchCardController } from './plan-model-switch-card-controller.ts'
import { TINYFISH_NS, WEB_NS, TinyFishCardController } from './tinyfish-card-controller.ts'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'

export type { PluginsSettingsSectionInjected, PluginsSettingsSectionProps } from './PluginsSettingsSection.tsx'

/** Dictionary namespace owned by this plugin. */
const NS = 'settings.plugins'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'remote', 'remote.credentials', 'remote.session', 'configForms']

/**
 * Mount the built-in plugins section.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-plugins: section dictionaries')

  const plan = new PlanModelSwitchCardController(ctx.configForms.get(PLAN_MODEL_SWITCH_NS), ctx)
  const tiny = new TinyFishCardController(ctx.configForms.get(TINYFISH_NS), ctx.configForms.get(WEB_NS), ctx)
  ctx.effect(() => () => { plan.dispose() })
  ctx.effect(() => ctx.remote.$on('llm/adapters-updated', () => { plan.refreshCatalog() }))
  ctx.effect(() => ctx.remote.$on('settings/document-updated', () => { plan.refreshCatalog() }))
  ctx.effect(() => ctx.on('connection/reset', () => { plan.resetConnection() }))
  ctx.effect(() => ctx.remote.$on('credentials/reference-updated', (ref) => { tiny.refreshCredential(ref) }))
  ctx.effect(() => ctx.configForms.whileServed([PLAN_MODEL_SWITCH_NS], () => ctx.slots.inject('plugins.item', () => ctx.slots.register({
    name: 'plugins.item', id: 'plan-model-switch', order: 60, label: () => t('planPhaseTitle'), locale: NS, inject: () => plan.inject(),
  }, PlanModelSwitchCard))))
  ctx.effect(() => ctx.configForms.whileServed([TINYFISH_NS], () => ctx.slots.inject('plugins.item', () => ctx.slots.register({
    name: 'plugins.item', id: 'tinyfish', order: 50, label: () => t('tinyfishTitle'), locale: NS, inject: () => tiny.inject(),
  }, TinyFishCard))))

  let tabsVersion = -1
  let tabsRevision = -1
  let tabs: readonly PluginsSettingsTabEntry[] = []
  const sectionInjected = (): PluginsSettingsSectionInjected => ({
    hooks: {
      tabs: {
        getSnapshot: () => {
          const version = ctx.slots.getVersion('settings.plugins.tab')
          const revision = ctx.locale.getSnapshot().revision
          if (version !== tabsVersion || revision !== tabsRevision) {
            tabsVersion = version
            tabsRevision = revision
            tabs = ctx.slots.entries('settings.plugins.tab')
              .map(entry => ({
                /* v8 ignore next -- list-slot registration requires id */
                id: entry.options.id ?? '',
                order: entry.options.order ?? 0,
                label: resolveSlotLabel(entry.options.label) ?? '',
              }))
              .sort((a, b) => a.order - b.order)
          }
          return tabs
        },
        subscribe: (listener) => {
          const offLedger = ctx.slots.subscribe('settings.plugins.tab', listener)
          const offLocale = ctx.locale.subscribe(listener)
          return () => {
            offLedger()
            offLocale()
          }
        },
      },
    },
  })

  // This package owns the one Built-in plugins navigation entry and the tab
  // chrome; feature plugins contribute pages without competing for Settings nav rows.
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'plugins',
    order: 15,
    label: () => t('nav'),
    locale: NS,
    inject: sectionInjected,
    children: { 'settings.plugins.tab': { kind: 'list', scope: 'root' } },
  }, PluginsSettingsSection))
}
