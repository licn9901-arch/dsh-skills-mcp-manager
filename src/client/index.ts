/**
 * Browser-half entry for the dsh-skills-mcp-manager plugin — runs inside the
 * dsh web GUI. Registers the locale dictionary and contributes a settings card
 * into the Web UI plugin group (the `web-ui.plugin.item` slot the family
 * group card renders). The card edits the `skills-mcp-manager` settings
 * namespace (master switch + agent announcement) and hosts the skills/MCP
 * management UI, which talks to the Host over /api/dsh-skills-mcp.
 *
 * Failure policy: mounting problems are logged, never thrown — the web shell
 * fails the whole boot when a plugin apply throws, and an external plugin must
 * not take the GUI down.
 */

import type { ClientContext, SettingsScope, SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the slots merge tables (SlotMap / LocaleNamespaceMap).
import type {} from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the settings-surface Context merge (ctx.settingsScope).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { en, zh, type SkillsMcpKey } from './locales.ts'
import { SkillsMcpCardController, SkillsMcpSettingsCard, type SkillsMcpSettings } from './SettingsCard.tsx'

/** Locale namespace this plugin owns. */
const NS = 'skills-mcp-manager'

/** Settings namespace the card edits (the Host plugin registers it). */
const SETTINGS_NS = 'skills-mcp-manager'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** dsh-skills-mcp-manager surface copy. */
    'skills-mcp-manager': SkillsMcpKey
  }

  interface SlotMap {
    /**
     * The child slot the Web UI plugin group declares; this card registers
     * into the group instead of the top-level `settings.plugin.item` list.
     * Spelled here with the same shape so this package can register without
     * depending on the sibling UI package.
     */
    'web-ui.plugin.item': { kind: 'list'; scope: 'root'; owner: SettingsPluginItemOwnerProps }
  }
}

/** Owner share of the plugin card (the section supplies nothing). */
export interface SettingsPluginItemOwnerProps {
  /** Marker field: card owner props are intentionally empty. */
  children?: never
}

/** Required services (fiber inject waiting — the runtime must be up first). */
export const inject = ['slots', 'settingsScope', 'workspaces', 'locale']

/**
 * Mount the settings card.
 * @param ctx - client root context (settingsScope, slots, locale).
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'skills-mcp-manager: dictionaries')

  // Plugin configuration: master switch + agent announcement, over the
  // `skills-mcp-manager` settings namespace, contributed to the Web UI group.
  const scope = ctx.settingsScope.bind<SkillsMcpSettings>({ namespace: SETTINGS_NS })
  const controller = new SkillsMcpCardController(scope, () => ctx.workspaces.pickDirectory())
  ctx.slots.inject('web-ui.plugin.item', () => ctx.slots.register({
    name: 'web-ui.plugin.item',
    id: 'skills-mcp-manager',
    order: 120,
    locale: NS,
    inject: () => controller.inject(),
  }, SkillsMcpSettingsCard))
}
