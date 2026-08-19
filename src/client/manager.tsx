import {
  Check,
  ChevronLeft,
  FileCode2,
  FolderOpen,
  Import,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Server,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { McpServerConfig, McpServerSummary, ScannedSkill, SkillDetail, SkillSummary } from '../protocol.ts'
import { SkillsMcpApi } from './api.ts'
import css from './settings-card.module.css'

const api = new SkillsMcpApi()

const copy = {
  zh: {
    skills: 'Skills 技能', mcp: 'MCP 服务', searchSkills: '搜索技能', searchMcp: '搜索服务器',
    statusFilter: '状态筛选', all: '全部', enabled: '已启用', disabled: '已停用', refresh: '刷新', import: '导入技能',
    project: '项目级', user: '用户级', emptySkills: '没有发现技能', noMatch: '没有匹配的结果',
    chooseFolder: '选择文件夹', scan: '扫描目录', scanning: '扫描中...', importSelected: '导入选中',
    noImport: '未发现可导入的技能', selectImport: '请先选择要导入的技能', detail: '技能详情',
    selectSkill: '选择一个技能查看完整说明', whenToUse: '适用场景', content: '技能内容', delete: '删除',
    deleteSkillTitle: '删除技能', deleteSkillBody: '此操作会从磁盘永久删除该技能，无法撤销。',
    cancel: '取消', confirmDelete: '确认删除', newServer: '新建服务器', noServers: '尚未配置 MCP 服务器',
    serverEditor: '服务器配置', editServer: '编辑服务器', save: '保存', saving: '保存中...',
    test: '测试连接', testing: '测试中...', close: '关闭编辑器', running: '运行中', connecting: '连接中',
    failed: '失败', stopped: '已停用', deleteServerTitle: '删除 MCP 服务器',
    deleteServerBody: '服务器配置和当前连接会被移除，此操作无法撤销。', plaintext: '环境变量和请求头当前以明文保存在 ~/.dsh/mcp.json。',
    selectServer: '选择服务器进行编辑，或新建一个服务器。', enable: '启用', disable: '停用',
  },
  en: {
    skills: 'Skills', mcp: 'MCP services', searchSkills: 'Search skills', searchMcp: 'Search servers',
    statusFilter: 'Status filter', all: 'All', enabled: 'Enabled', disabled: 'Disabled', refresh: 'Refresh', import: 'Import skills',
    project: 'Project', user: 'User', emptySkills: 'No skills found', noMatch: 'No matching results',
    chooseFolder: 'Choose folder', scan: 'Scan folder', scanning: 'Scanning...', importSelected: 'Import selected',
    noImport: 'No importable skills found', selectImport: 'Select at least one skill', detail: 'Skill details',
    selectSkill: 'Select a skill to inspect its full instructions', whenToUse: 'When to use', content: 'Skill content', delete: 'Delete',
    deleteSkillTitle: 'Delete skill', deleteSkillBody: 'This permanently deletes the skill from disk and cannot be undone.',
    cancel: 'Cancel', confirmDelete: 'Delete', newServer: 'New server', noServers: 'No MCP servers configured',
    serverEditor: 'Server configuration', editServer: 'Edit server', save: 'Save', saving: 'Saving...',
    test: 'Test connection', testing: 'Testing...', close: 'Close editor', running: 'Running', connecting: 'Connecting',
    failed: 'Failed', stopped: 'Disabled', deleteServerTitle: 'Delete MCP server',
    deleteServerBody: 'The configuration and active connection will be removed. This cannot be undone.', plaintext: 'Environment values and headers are currently stored in plaintext at ~/.dsh/mcp.json.',
    selectServer: 'Select a server to edit, or create a new one.', enable: 'Enable', disable: 'Disable',
  },
} as const

type Copy = typeof copy.zh | typeof copy.en

function useCopy(): Copy {
  return document.documentElement.lang.toLowerCase().startsWith('en') ? copy.en : copy.zh
}

function sourceLabel(source: string): string {
  if (source === 'project-dsh') return '.dsh/skills'
  if (source === 'project-agents') return '.agents/skills'
  if (source === 'user-dsh') return '~/.dsh/skills'
  if (source === 'user-agents') return '~/.agents/skills'
  return source
}

const EMPTY_SERVER_JSON = JSON.stringify({
  name: '',
  transport: 'stdio',
  command: 'npx',
  args: [],
  env: {},
  enabled: true,
}, null, 2)

function serverConfig(server: McpServerSummary): McpServerConfig {
  const { status: _status, error: _error, ...config } = server
  return config
}

/** 技能与 MCP 的一级管理页面。 */
export function SkillsMcpManager(props: { cwd: string; enabled: boolean; pickDirectory: () => Promise<string | null> }) {
  const t = useCopy()
  const [tab, setTab] = useState<'skills' | 'mcp'>('skills')
  return (
    <div className={css.manager}>
      <div className={css.tabs} role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'skills'} className={tab === 'skills' ? css.tabActive : css.tab} onClick={() => setTab('skills')}>{t.skills}</button>
        <button type="button" role="tab" aria-selected={tab === 'mcp'} className={tab === 'mcp' ? css.tabActive : css.tab} onClick={() => setTab('mcp')}>{t.mcp}</button>
      </div>
      {!props.enabled && <p className={css.errorBanner} role="status">Plugin disabled</p>}
      {tab === 'skills' ? <SkillsPanel cwd={props.cwd} pickDirectory={props.pickDirectory} t={t} /> : <McpPanel t={t} />}
    </div>
  )
}

function SkillsPanel(props: { cwd: string; pickDirectory: () => Promise<string | null>; t: Copy }) {
  const { t } = props
  const [items, setItems] = useState<SkillSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'enabled' | 'disabled'>('all')
  const [selected, setSelected] = useState<SkillSummary | null>(null)
  const [detail, setDetail] = useState<SkillDetail | null>(null)
  const [pending, setPending] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<SkillSummary | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [scan, setScan] = useState({ dir: '', busy: false, items: [] as ScannedSkill[], selected: new Set<string>(), message: '' })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setItems(await api.listSkills(props.cwd)) } catch (failure) { setError(String((failure as Error).message ?? failure)) } finally { setLoading(false) }
  }, [props.cwd])

  useEffect(() => { void load() }, [load])

  const choose = async (skill: SkillSummary) => {
    setSelected(skill)
    setDetail(null)
    try { setDetail(await api.readSkill(skill.path)) } catch (failure) { setError(String((failure as Error).message ?? failure)) }
  }

  const toggle = async (skill: SkillSummary) => {
    setPending(skill.path)
    setError('')
    try { await api.toggleSkill(skill.path, !skill.enabled); await load() } catch (failure) { setError(String((failure as Error).message ?? failure)) } finally { setPending('') }
  }

  const remove = async () => {
    if (!deleteTarget) return
    setPending(deleteTarget.path)
    try {
      await api.deleteSkill(deleteTarget.path, deleteTarget.kind)
      if (selected?.path === deleteTarget.path) { setSelected(null); setDetail(null) }
      setDeleteTarget(null)
      await load()
    } catch (failure) { setError(String((failure as Error).message ?? failure)) } finally { setPending('') }
  }

  const scanDirectory = async () => {
    if (scan.dir.trim() === '') { setScan((current) => ({ ...current, message: '请输入目录路径' })); return }
    setScan((current) => ({ ...current, busy: true, message: '', items: [], selected: new Set() }))
    try {
      const found = await api.scanSkills(scan.dir.trim())
      setScan((current) => ({ ...current, busy: false, items: found, message: found.length === 0 ? t.noImport : '' }))
    } catch (failure) { setScan((current) => ({ ...current, busy: false, message: String((failure as Error).message ?? failure) })) }
  }

  const importSelected = async () => {
    const chosen = scan.items.filter((item) => scan.selected.has(item.sourcePath))
    if (chosen.length === 0) { setScan((current) => ({ ...current, message: t.selectImport })); return }
    setScan((current) => ({ ...current, busy: true, message: '' }))
    try {
      const result = await api.importSkills(chosen.map(({ sourcePath, kind }) => ({ sourcePath, kind })))
      const imported = result.filter((entry) => entry.ok).length
      setScan((current) => ({ ...current, busy: false, selected: new Set(), message: `已导入 ${imported} 个技能` }))
      await load()
    } catch (failure) { setScan((current) => ({ ...current, busy: false, message: String((failure as Error).message ?? failure) })) }
  }

  const filtered = useMemo(() => items.filter((skill) => {
    const matchesQuery = `${skill.name} ${skill.description}`.toLowerCase().includes(query.trim().toLowerCase())
    const matchesStatus = filter === 'all' || (filter === 'enabled' ? skill.enabled : !skill.enabled)
    return matchesQuery && matchesStatus
  }), [filter, items, query])

  return (
    <div className={css.panel}>
      <div className={css.toolbar}>
        <label className={css.search}><Search size={16} aria-hidden="true" /><input aria-label={t.searchSkills} placeholder={t.searchSkills} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <div className={css.filterGroup} role="group" aria-label={t.statusFilter}>
          {(['all', 'enabled', 'disabled'] as const).map((value) => (
            <button key={value} type="button" className={css.filterButton} aria-pressed={filter === value} onClick={() => setFilter(value)}>{t[value]}</button>
          ))}
        </div>
        <IconButton label={t.refresh} onClick={() => void load()}><RefreshCw size={17} /></IconButton>
        <button type="button" className={css.primaryButton} onClick={() => setImportOpen((open) => !open)}><Import size={16} />{t.import}</button>
      </div>

      {importOpen && <section className={css.importPanel} aria-label={t.import}>
        <div className={css.importControls}>
          <label className={css.pathInput}><FolderOpen size={17} /><input value={scan.dir} placeholder="C:\\path\\to\\skills" onChange={(event) => setScan((current) => ({ ...current, dir: event.target.value }))} /></label>
          <button type="button" className={css.secondaryButton} onClick={async () => { const path = await props.pickDirectory(); if (path) setScan((current) => ({ ...current, dir: path })) }}>{t.chooseFolder}</button>
          <button type="button" className={css.secondaryButton} disabled={scan.busy} onClick={() => void scanDirectory()}>{scan.busy ? t.scanning : t.scan}</button>
          <IconButton label={t.close} onClick={() => setImportOpen(false)}><X size={17} /></IconButton>
        </div>
        {scan.items.length > 0 && <div className={css.scanResults}>{scan.items.map((item) => <label key={item.sourcePath} className={css.scanRow}>
          <input type="checkbox" checked={scan.selected.has(item.sourcePath)} onChange={() => setScan((current) => {
            const selectedPaths = new Set(current.selected)
            selectedPaths.has(item.sourcePath) ? selectedPaths.delete(item.sourcePath) : selectedPaths.add(item.sourcePath)
            return { ...current, selected: selectedPaths }
          })} />
          <FileCode2 size={16} /><span><strong>{item.name}</strong><small>{item.description || item.sourcePath}</small></span>
        </label>)}</div>}
        {scan.message && <p className={css.inlineMessage}>{scan.message}</p>}
        {scan.items.length > 0 && <button type="button" className={css.primaryButton} disabled={scan.busy} onClick={() => void importSelected()}><Check size={16} />{t.importSelected} ({scan.selected.size})</button>}
      </section>}

      {error && <div className={css.errorBanner} role="alert">{error}</div>}
      <div className={css.masterDetail}>
        <div className={css.listPane}>
          {loading ? <LoadingRows /> : filtered.length === 0 ? <EmptyState icon={<FileCode2 />} text={items.length === 0 ? t.emptySkills : t.noMatch} /> : (['project', 'user'] as const).map((level) => {
            const group = filtered.filter((skill) => skill.level === level)
            if (group.length === 0) return null
            return <section key={level} className={css.group}><h3>{level === 'project' ? t.project : t.user}<span>{group.length}</span></h3>{group.map((skill) => <div key={skill.path} className={`${css.listRow} ${selected?.path === skill.path ? css.listRowSelected : ''}`}>
              <button type="button" className={css.rowMain} onClick={() => void choose(skill)}><strong>{skill.name}</strong><span>{skill.description || sourceLabel(skill.source)}</span></button>
              <span className={css.source}>{sourceLabel(skill.source)}</span>
              <Switch checked={skill.enabled} disabled={pending !== ''} label={`${skill.enabled ? t.disable : t.enable} ${skill.name}`} onChange={() => void toggle(skill)} />
              <IconButton label={t.delete} danger disabled={pending !== ''} onClick={() => setDeleteTarget(skill)}><Trash2 size={16} /></IconButton>
            </div>)}</section>
          })}
        </div>
        <aside className={css.detailPane} aria-label={t.detail}>
          {!selected ? <EmptyState icon={<FileCode2 />} text={t.selectSkill} /> : <>
            <div className={css.detailHeader}><div><h3>{selected.name}</h3><span>{sourceLabel(selected.source)}</span></div><Switch checked={selected.enabled} disabled={pending !== ''} label={`${selected.enabled ? t.disable : t.enable} ${selected.name}`} onChange={() => void toggle(selected)} /></div>
            {!detail ? <LoadingRows count={3} /> : <div className={css.detailBody}>{detail.description && <p>{detail.description}</p>}{detail.whenToUse && <section><h4>{t.whenToUse}</h4><p>{detail.whenToUse}</p></section>}<section><h4>{t.content}</h4><pre>{detail.content}</pre></section></div>}
          </>}
        </aside>
      </div>
      {deleteTarget && <ConfirmDialog title={t.deleteSkillTitle} body={t.deleteSkillBody} cancel={t.cancel} confirm={t.confirmDelete} onCancel={() => setDeleteTarget(null)} onConfirm={() => void remove()} />}
    </div>
  )
}

function McpPanel({ t }: { t: Copy }) {
  const [servers, setServers] = useState<McpServerSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [jsonText, setJsonText] = useState(EMPTY_SERVER_JSON)
  const [editingName, setEditingName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<McpServerSummary | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setServers(await api.listMcp()) } catch (failure) { setError(String((failure as Error).message ?? failure)) } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const openNew = () => { setJsonText(EMPTY_SERVER_JSON); setEditingName(''); setEditorOpen(true); setMessage('') }
  const openEdit = (server: McpServerSummary) => {
    const config = serverConfig(server)
    setJsonText(JSON.stringify(config, null, 2))
    setEditingName(server.name)
    setEditorOpen(true); setMessage('')
  }
  const buildServer = (): McpServerConfig | null => {
    try { return JSON.parse(jsonText) as McpServerConfig } catch (failure) { setError(`JSON: ${String((failure as Error).message ?? failure)}`); return null }
  }
  const save = async () => {
    const server = buildServer(); if (!server) return
    setPending('save'); setError('')
    try { await api.saveMcp(server); setMessage(`已保存 ${server.name}`); setEditorOpen(false); await load() } catch (failure) { setError(String((failure as Error).message ?? failure)) } finally { setPending('') }
  }
  const test = async () => {
    const server = buildServer(); if (!server) return
    setPending('test'); setError('')
    try { const result = await api.testMcp(server); setMessage(result.ok ? '连接成功' : `连接失败：${result.error ?? 'unknown error'}`) } catch (failure) { setError(String((failure as Error).message ?? failure)) } finally { setPending('') }
  }
  const toggle = async (server: McpServerSummary) => {
    setPending(server.name)
    try { await api.setMcpEnabled(server.name, !server.enabled); await load() } catch (failure) { setError(String((failure as Error).message ?? failure)) } finally { setPending('') }
  }
  const remove = async () => {
    if (!deleteTarget) return
    setPending(deleteTarget.name)
    try { await api.deleteMcp(deleteTarget.name); setDeleteTarget(null); await load() } catch (failure) { setError(String((failure as Error).message ?? failure)) } finally { setPending('') }
  }
  const statusCopy = { running: t.running, connecting: t.connecting, failed: t.failed, stopped: t.stopped }
  const filtered = servers.filter((server) => server.name.toLowerCase().includes(query.trim().toLowerCase()))

  return <div className={css.panel}>
    <div className={css.toolbar}>
      <label className={css.search}><Search size={16} /><input aria-label={t.searchMcp} placeholder={t.searchMcp} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <IconButton label={t.refresh} onClick={() => void load()}><RefreshCw size={17} /></IconButton>
      <button type="button" className={css.primaryButton} onClick={openNew}><Plus size={16} />{t.newServer}</button>
    </div>
    {error && <div className={css.errorBanner} role="alert">{error}</div>}{message && <div className={css.successBanner} role="status">{message}</div>}
    <div className={`${css.masterDetail} ${editorOpen ? css.editorVisible : ''}`}>
      <div className={css.listPane}>
        {loading ? <LoadingRows /> : filtered.length === 0 ? <EmptyState icon={<Server />} text={servers.length === 0 ? t.noServers : t.noMatch} /> : filtered.map((server) => <div key={server.name} className={css.serverRow}>
          <button type="button" className={css.rowMain} onClick={() => openEdit(server)}><strong>{server.name}</strong><span>{server.transport} · {server.transport === 'stdio' ? server.command : server.url}</span>{server.error && <em>{server.error}</em>}</button>
          <span className={`${css.status} ${css[`status_${server.status}`]}`}>{statusCopy[server.status]}</span>
          <Switch checked={server.enabled !== false} disabled={pending !== ''} label={`${server.enabled !== false ? t.disable : t.enable} ${server.name}`} onChange={() => void toggle(server)} />
          <IconButton label={t.editServer} onClick={() => openEdit(server)}><Pencil size={16} /></IconButton>
          <IconButton label={t.delete} danger onClick={() => setDeleteTarget(server)}><Trash2 size={16} /></IconButton>
        </div>)}
      </div>
      <aside className={css.editorPane} aria-label={t.serverEditor}>
        {!editorOpen ? <EmptyState icon={<Server />} text={t.selectServer} /> : <>
          <div className={css.editorHeader}><button type="button" className={css.backButton} aria-label={t.close} onClick={() => setEditorOpen(false)}><ChevronLeft size={18} /></button><h3>{editingName ? t.editServer : t.newServer}</h3><IconButton label={t.close} onClick={() => setEditorOpen(false)}><X size={18} /></IconButton></div>
          <textarea className={css.codeEditor} aria-label="MCP JSON" rows={22} spellCheck={false} value={jsonText} onChange={(event) => setJsonText(event.target.value)} />
          <p className={css.plaintextNote}>{t.plaintext}</p>
          <div className={css.editorActions}><button type="button" className={css.secondaryButton} disabled={pending !== ''} onClick={() => void test()}>{pending === 'test' ? t.testing : t.test}</button><button type="button" className={css.primaryButton} disabled={pending !== ''} onClick={() => void save()}>{pending === 'save' ? t.saving : t.save}</button></div>
        </>}
      </aside>
    </div>
    {deleteTarget && <ConfirmDialog title={t.deleteServerTitle} body={t.deleteServerBody} cancel={t.cancel} confirm={t.confirmDelete} onCancel={() => setDeleteTarget(null)} onConfirm={() => void remove()} />}
  </div>
}

function IconButton({ label, children, danger = false, disabled = false, onClick }: { label: string; children: ReactNode; danger?: boolean; disabled?: boolean; onClick: () => void }) { return <button type="button" className={`${css.iconButton} ${danger ? css.danger : ''}`} aria-label={label} title={label} disabled={disabled} onClick={onClick}>{children}</button> }
function Switch({ checked, disabled, label, onChange }: { checked: boolean; disabled: boolean; label: string; onChange: () => void }) { return <button type="button" role="switch" aria-checked={checked} aria-label={label} className={css.switch} disabled={disabled} onClick={onChange}><span /></button> }
function EmptyState({ icon, text, action }: { icon: ReactNode; text: string; action?: ReactNode }) { return <div className={css.empty}>{icon}<p>{text}</p>{action}</div> }
function LoadingRows({ count = 5 }: { count?: number }) { return <div className={css.loading} aria-label="loading">{Array.from({ length: count }, (_, index) => <span key={index} />)}</div> }
function ConfirmDialog({ title, body, cancel, confirm, onCancel, onConfirm }: { title: string; body: string; cancel: string; confirm: string; onCancel: () => void; onConfirm: () => void }) { return <div className={css.dialogBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}><div className={css.dialog} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"><h3 id="confirm-title">{title}</h3><p>{body}</p><div><button type="button" className={css.secondaryButton} onClick={onCancel}>{cancel}</button><button type="button" className={css.dangerButton} onClick={onConfirm}>{confirm}</button></div></div></div> }
