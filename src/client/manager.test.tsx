import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SkillsMcpManager } from './manager.tsx'

const jsonResponse = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'content-type': 'application/json' },
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('SkillsMcpManager', () => {
  it('技能列表支持搜索、标准开关和独立详情面板', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/skills/read')) {
        return jsonResponse({ ok: true, skill: { name: 'genui', description: 'Render UI', whenToUse: 'Charts', enabled: true, content: '# GenUI', path: 'C:/skills/genui/SKILL.md' } })
      }
      return jsonResponse({ ok: true, items: [
        { name: 'genui', description: 'Render UI', whenToUse: '', enabled: true, source: 'user-dsh', level: 'user', kind: 'bundle', path: 'C:/skills/genui/SKILL.md' },
        { name: 'other', description: 'Other skill', whenToUse: '', enabled: false, source: 'user-agents', level: 'user', kind: 'bundle', path: 'C:/skills/other/SKILL.md' },
      ] })
    }))

    render(<SkillsMcpManager cwd="C:/workspace" enabled pickDirectory={async () => null} />)
    await screen.findByText('genui')
    expect(screen.getByRole('switch', { name: '停用 genui' })).toBeChecked()
    fireEvent.change(screen.getByPlaceholderText('搜索技能'), { target: { value: 'gen' } })
    expect(screen.queryByText('other')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('genui'))
    await waitFor(() => expect(screen.getByText('# GenUI')).toBeInTheDocument())
  })

  it('技能状态使用可访问的分段控件筛选', async () => {
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse({ ok: true, items: [
      { name: 'enabled-skill', description: 'Enabled', whenToUse: '', enabled: true, source: 'user-dsh', level: 'user', kind: 'bundle', path: 'C:/skills/enabled/SKILL.md' },
      { name: 'disabled-skill', description: 'Disabled', whenToUse: '', enabled: false, source: 'user-agents', level: 'user', kind: 'bundle', path: 'C:/skills/disabled/SKILL.md' },
    ] })))

    render(<SkillsMcpManager cwd="C:/workspace" enabled pickDirectory={async () => null} />)
    await screen.findByText('enabled-skill')

    const filter = screen.getByRole('group', { name: '状态筛选' })
    const all = screen.getByRole('button', { name: '全部' })
    const disabled = screen.getByRole('button', { name: '已停用' })
    expect(filter).toContainElement(all)
    expect(all).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(disabled)
    expect(disabled).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('enabled-skill')).not.toBeInTheDocument()
    expect(screen.getByText('disabled-skill')).toBeInTheDocument()
  })

  it('MCP 仅提供 JSON 编辑器，并且只在新建或编辑时出现', async () => {
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse({ ok: true, servers: [] })))
    render(<SkillsMcpManager cwd="" enabled pickDirectory={async () => null} />)
    fireEvent.click(screen.getByRole('tab', { name: 'MCP 服务' }))
    await screen.findByText('尚未配置 MCP 服务器')
    expect(screen.queryByLabelText('MCP JSON')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '新建服务器' }))
    expect(screen.getByLabelText('MCP JSON')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '表单' })).not.toBeInTheDocument()
  })

  it('可以选择目录、扫描并导入技能', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/skills/scan')) {
        return jsonResponse({ ok: true, items: [{ name: 'new-skill', description: 'New', sourcePath: 'C:/incoming/new-skill', kind: 'bundle' }] })
      }
      if (url.includes('/skills/import')) return jsonResponse({ ok: true, results: [{ ok: true, name: 'new-skill' }] })
      return jsonResponse({ ok: true, items: [] })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<SkillsMcpManager cwd="C:/workspace" enabled pickDirectory={async () => 'C:/incoming'} />)
    fireEvent.click(screen.getByRole('button', { name: '导入技能' }))
    fireEvent.click(screen.getByRole('button', { name: '选择文件夹' }))
    await waitFor(() => expect(screen.getByDisplayValue('C:/incoming')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '扫描目录' }))
    await screen.findByText('new-skill')
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: '导入选中 (1)' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/skills/import'),
      expect.objectContaining({ method: 'POST' }),
    ))
  })

  it('MCP 服务器支持启停、测试和保存 JSON 配置', async () => {
    const server = { name: 'docs', transport: 'stdio', command: 'npx', args: [], env: {}, enabled: true, status: 'running' }
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/mcp/test')) return jsonResponse({ ok: true, test: { ok: true } })
      if (url.includes('/mcp/save') || url.includes('/mcp/enabled')) return jsonResponse({ ok: true })
      return jsonResponse({ ok: true, servers: [server] })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<SkillsMcpManager cwd="" enabled pickDirectory={async () => null} />)
    fireEvent.click(screen.getByRole('tab', { name: 'MCP 服务' }))
    await screen.findByText('docs')
    fireEvent.click(screen.getByRole('switch', { name: '停用 docs' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/mcp/enabled'),
      expect.objectContaining({ method: 'POST' }),
    ))

    fireEvent.click(screen.getByRole('button', { name: '编辑服务器' }))
    const editor = screen.getByLabelText('MCP JSON')
    expect((editor as HTMLTextAreaElement).value).toContain('"name": "docs"')
    fireEvent.click(screen.getByRole('button', { name: '测试连接' }))
    await screen.findByText('连接成功')
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/mcp/save'),
      expect.objectContaining({ method: 'POST' }),
    ))
  })
})
