/**
 * The skills-mcp-manager settings card: a disclosure card contributed to the
 * Web UI plugin group. Its header names the plugin, and its body holds the
 * master switch + agent-announcement toggles (over the `skills-mcp-manager`
 * settings namespace) plus the full skills/MCP management UI.
 */

import { useState, type ReactNode } from 'react'
import type { SettingsScope, SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SkillsMcpKey } from './locales.ts'
import { SkillsMcpManager } from './manager.tsx'
import css from './settings-card.module.css'

/** The fields this card edits (the namespace's full schema). */
export interface SkillsMcpSettings {
  enabled?: boolean
  announceToAgent?: boolean
}

/** Card state projected from the settings scope. */
export interface SkillsMcpCardState {
  /** False while the namespace is still loading; the card renders nothing. */
  available: boolean
  /** False when the Host does not serve this namespace to the client. */
  exposed: boolean
  /** Whether the Host document accepts writes. */
  writable: boolean
  /** Master switch. */
  enabled: boolean
  /** System-prompt announcement flag. */
  announceToAgent: boolean
}

/** The registration-side face the card's slot entry injects. */
export interface SkillsMcpCardFace {
  hooks: {
    /** Card snapshot bound by the renderer as useSkillsMcpCard. */
    skillsMcpCard: SnapshotStore<SkillsMcpCardState>
  }
  setEnabled: (value: boolean) => void
  setAnnounceToAgent: (value: boolean) => void
  pickDirectory: () => Promise<string | null>
}

/** Bridges the `skills-mcp-manager` scope onto the card. */
export class SkillsMcpCardController {
  private readonly store: SnapshotStore<SkillsMcpCardState>

  constructor(
    private readonly scope: SettingsScope<SkillsMcpSettings>,
    private readonly pickDirectory: () => Promise<string | null>,
  ) {
    this.store = createSnapshotStore(this.projection())
    this.scope.subscribe(() => { this.store.set(this.projection()) })
  }

  private projection(): SkillsMcpCardState {
    const snap = this.scope.getSnapshot()
    return {
      available: snap.status !== 'loading',
      exposed: snap.status === 'ready',
      writable: snap.writable,
      enabled: snap.value?.enabled ?? true,
      announceToAgent: snap.value?.announceToAgent ?? true,
    }
  }

  /** Build the face the card's slot registration injects. */
  inject(): SkillsMcpCardFace {
    return {
      hooks: { skillsMcpCard: this.store },
      setEnabled: (value) => { void this.scope.set('enabled', value) },
      setAnnounceToAgent: (value) => { void this.scope.set('announceToAgent', value) },
      pickDirectory: this.pickDirectory,
    }
  }
}

/** Props the renderer binds for the card. */
export type SkillsMcpSettingsCardProps =
  PropsRuntime<'web-ui.plugin.item'>
  & PropsLocale<'skills-mcp-manager'>
  & InjectFace<SkillsMcpCardFace>

/** One on/off toggle row for a config boolean. */
function Toggle(props: {
  id: string
  label: string
  hint: string
  checked: boolean
  disabled: boolean
  onChange: (value: boolean) => void
}): ReactNode {
  return (
    <div className={css.field}>
      <label className={css.toggle} htmlFor={props.id}>
        <input
          id={props.id}
          type="checkbox"
          checked={props.checked}
          disabled={props.disabled}
          onChange={(event) => { props.onChange(event.target.checked) }}
        />
        <span className={css.toggleLabel}>{props.label}</span>
      </label>
      <p className={css.hint}>{props.hint}</p>
    </div>
  )
}

/**
 * Render the settings card.
 * @param props - locale copy, the card snapshot, and its config actions.
 * @returns the card, or nothing while the namespace is loading.
 */
export function SkillsMcpSettingsCard(props: SkillsMcpSettingsCardProps) {
  const state = props.useSkillsMcpCard((s) => s)
  const { t } = props
  const [open, setOpen] = useState(false)

  // Current workspace path → project-level skills root.
  const cwd = props.useWorkspaces((s) => {
    const items = (s && s.items) || []
    const ws = items.find((w) => w.workspaceId === s.recentWorkspaceId) || items[0]
    return ws ? ws.path : ''
  })

  if (!state.available) return null
  const title = t('title')

  if (!state.exposed) {
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
          ? <div className={css.body}><p className={css.notExposed} role="status">{t('notExposed')}</p></div>
          : null}
      </li>
    )
  }

  const disabled = !state.writable
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
            {!state.writable ? <p className={css.readOnly} role="status">{t('readOnly')}</p> : null}
            <div className={css.config}>
              <Toggle
                id="skills-mcp-enabled"
                label={t('enabled')}
                hint={t('enabledHint')}
                checked={state.enabled}
                disabled={disabled}
                onChange={props.setEnabled}
              />
              <Toggle
                id="skills-mcp-announce"
                label={t('announce')}
                hint={t('announceHint')}
                checked={state.announceToAgent}
                disabled={disabled}
                onChange={props.setAnnounceToAgent}
              />
            </div>
            <SkillsMcpManager cwd={cwd} enabled={state.enabled} pickDirectory={props.pickDirectory} />
          </div>
        )
        : null}
    </li>
  )
}
