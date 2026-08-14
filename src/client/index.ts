/**
 * Browser-half entry for the dsh-skills-mcp-manager plugin — runs inside the
 * dsh web GUI. Registers the locale dictionary and contributes a settings card
 * into the Web UI plugin group (the `web-ui.plugin.item` slot the family
 * group card renders). The card hosts the skills/MCP management UI, which
 * talks to the Host over /api/dsh-skills-mcp.
 *
 * Deliberately does NOT bind the settingsScope: third-party settings
 * namespaces are not exposed to the browser configuration surface, so a
 * settings-scope-backed card would render an empty shell. The manager is
 * shown directly instead.
 *
 * Failure policy: mounting problems are logged, never thrown — the web shell
 * fails the whole boot when a plugin apply throws, and an external plugin must
 * not take the GUI down.
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the slots merge tables (SlotMap / LocaleNamespaceMap).
import type {} from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { en, zh, type SkillsMcpKey } from './locales.ts'
import { SkillsMcpSettingsCard } from './SettingsCard.tsx'

/** Locale namespace this plugin owns. */
const NS = 'skills-mcp-manager'

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
export const inject = ['slots', 'workspaces', 'locale']

/**
 * Mount the settings card.
 * @param ctx - client root context (slots, workspaces, locale).
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'skills-mcp-manager: dictionaries')

  ctx.slots.inject('web-ui.plugin.item', () => ctx.slots.register({
    name: 'web-ui.plugin.item',
    id: 'skills-mcp-manager',
    order: 120,
    locale: NS,
    inject: () => ({ pickDirectory: () => ctx.workspaces.pickDirectory() }),
  }, SkillsMcpSettingsCard))
}
