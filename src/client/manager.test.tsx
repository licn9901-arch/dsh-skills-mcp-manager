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
})
