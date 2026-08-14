/**
 * The skills-mcp-manager settings card: a disclosure card contributed to the
 * Web UI plugin group. It renders the skills/MCP management UI directly — the
 * plugin does NOT read its own settings namespace (third-party namespaces are
 * not exposed to the browser settings surface), so there is no master-switch
 * card here; the manager is always shown when the card is expanded.
 */

import { useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { SkillsMcpManager } from './manager.tsx'
import css from './settings-card.module.css'

/** Props the renderer binds for the card. */
export type SkillsMcpSettingsCardProps =
  PropsRuntime<'settings.plugin.item'>
  & PropsLocale<'skills-mcp-manager'>
  & InjectFace<{ pickDirectory: () => Promise<string | null> }>

/**
 * Render the settings card.
 * @param props - locale copy and the native directory-picker helper.
 * @returns the card.
 */
export function SkillsMcpSettingsCard(props: SkillsMcpSettingsCardProps) {
  const [open, setOpen] = useState(false)
  const { t } = props

  // Current workspace path → project-level skills root.
  const cwd = props.useWorkspaces((s) => {
    const items = (s && s.items) || []
    const ws = items.find((w) => w.workspaceId === s.recentWorkspaceId) || items[0]
    return ws ? ws.path : ''
  })

  const title = t('title')
  return (
    <li className={css.card}>
      <button
        type="button"
        className={css.header}
        aria-expanded={open}
        aria-label={t(open ? 'collapse' : 'expand') + ': ' + title}
        onClick={() => { setOpen(!open) }}
      >
        <span className={css.headText}>
          <span className={css.name}>{title}</span>
          <span className={css.description}>{t('description')}</span>
        </span>
        <span className={open ? css.chevronOpen : css.chevron}>▾</span>
      </button>
      {open
        ? (
          <div className={css.body}>
            <SkillsMcpManager cwd={cwd} enabled={true} pickDirectory={props.pickDirectory} />
          </div>
        )
        : null}
    </li>
  )
}
