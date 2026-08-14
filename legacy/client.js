// code.client for the "Skills & MCP Manager" dynamic Cordis plugin.
// A plain-JS function body that returns a Cordis Plugin; paste into `code.client`.
// Uses React.createElement (no JSX), `host.call`, and `styles.insert`.
const h = React.createElement

const CSS = "\n.skmcp{font-size:13px;line-height:1.5;color:inherit;}\n.skmcp-tabs{display:flex;gap:4px;border-bottom:1px solid rgba(128,128,128,.25);margin-bottom:16px;}\n.skmcp-tab{background:none;border:none;padding:8px 14px;cursor:pointer;font:inherit;color:inherit;border-bottom:2px solid transparent;opacity:.7;}\n.skmcp-tab.active{opacity:1;border-bottom-color:currentColor;font-weight:600;}\n.skmcp-panel{display:flex;flex-direction:column;gap:20px;}\n.skmcp-section{display:flex;flex-direction:column;gap:10px;}\n.skmcp-h{margin:0;font-size:14px;font-weight:600;}\n.skmcp-inline{display:flex;align-items:center;gap:8px;}\n.skmcp-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid rgba(128,128,128,.2);border-radius:8px;}\n.skmcp-main{flex:1 1 auto;min-width:0;}\n.skmcp-name{font-weight:600;}\n.skmcp-desc{color:rgba(128,128,128,1);font-size:12px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}\n.skmcp-badge{font-size:11px;padding:1px 8px;border-radius:999px;background:rgba(128,128,128,.15);white-space:nowrap;}\n.skmcp-btn{font:inherit;font-size:12px;padding:4px 10px;border:1px solid rgba(128,128,128,.35);border-radius:6px;background:transparent;color:inherit;cursor:pointer;}\n.skmcp-btn:hover{background:rgba(128,128,128,.1);}\n.skmcp-btn.primary{border-color:currentColor;font-weight:600;}\n.skmcp-btn.danger{color:#e5534b;border-color:rgba(229,83,75,.4);}\n.skmcp-btn.active{background:rgba(128,128,128,.15);}\n.skmcp-btn:disabled{opacity:.5;cursor:default;}\n.skmcp-input{font:inherit;font-size:13px;padding:6px 8px;border:1px solid rgba(128,128,128,.35);border-radius:6px;background:transparent;color:inherit;box-sizing:border-box;width:100%;}\n.skmcp-input.grow{flex:1 1 auto;}\n.skmcp-input.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;}\n.grow{flex:1 1 auto;}\n.skmcp-error{color:#e5534b;font-size:12px;}\n.skmcp-note{color:rgba(128,128,128,1);font-size:12px;}\n.skmcp-scan-list{display:flex;flex-direction:column;gap:6px;max-height:260px;overflow:auto;}\n.skmcp-detail{padding:10px;border:1px dashed rgba(128,128,128,.3);border-radius:8px;display:flex;flex-direction:column;gap:6px;}\n.skmcp-pre{background:rgba(128,128,128,.08);padding:10px;border-radius:8px;white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;max-height:320px;overflow:auto;margin:0;}\n.skmcp-switch{display:inline-flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;white-space:nowrap;}\n.skmcp-form{display:flex;flex-direction:column;gap:8px;}\n.skmcp-field{display:flex;flex-direction:column;gap:3px;}\n.skmcp-label{font-size:12px;opacity:.7;}\n"

function sourceLabel(source) {
  if (source === 'project-dsh') return '.dsh/skills'
  if (source === 'project-agents') return '.agents/skills'
  if (source === 'user-dsh') return '~/.dsh/skills'
  if (source === 'user-agents') return '~/.agents/skills'
  return source
}

function App(props) {
  const cwd = props.useWorkspaces(function (s) {
    const items = (s && s.items) || []
    const ws = items.find(function (w) { return w.workspaceId === s.recentWorkspaceId }) || items[0]
    return ws ? ws.path : ''
  })
  const tabState = React.useState('skills')
  const tabId = tabState[0]
  const setTab = tabState[1]
  const refreshState = React.useState(0)
  const refreshKey = refreshState[0]
  const bumpRefresh = function () { refreshState[1](function (k) { return k + 1 }) }

  return h('div', { className: 'skmcp' },
    h('div', { className: 'skmcp-tabs' },
      h('button', { type: 'button', className: 'skmcp-tab' + (tabId === 'skills' ? ' active' : ''), onClick: function () { setTab('skills') } }, 'Skills 技能'),
      h('button', { type: 'button', className: 'skmcp-tab' + (tabId === 'mcp' ? ' active' : ''), onClick: function () { setTab('mcp') } }, 'MCP 服务'),
    ),
    tabId === 'skills'
      ? h(SkillsPanel, { cwd: cwd, refreshKey: refreshKey, onChanged: bumpRefresh, pickDirectory: props.pickDirectory })
      : h(McpPanel, { refreshKey: refreshKey, onChanged: bumpRefresh }),
  )
}

function SkillsPanel(props) {
  const cwd = props.cwd
  const listState = React.useState({ loading: true, items: [], error: '' })
  const list = listState[0]
  const setList = listState[1]
  const detailName = React.useState(null)
  const detail = React.useState(null)
  const scan = React.useState({ dir: '', busy: false, items: [], selected: {}, error: '', note: '' })
  const busy = React.useState('')
  const msg = React.useState('')
  const confirmDel = React.useState(null)

  function load() {
    setList({ loading: true, items: [], error: '' })
    host.call('listSkills', { cwd: cwd }).then(function (r) {
      if (r && r.ok) setList({ loading: false, items: r.items, error: '' })
      else setList({ loading: false, items: [], error: (r && r.error) || '加载失败' })
    }).catch(function (e) {
      setList({ loading: false, items: [], error: String(e && e.message || e) })
    })
  }

  React.useEffect(function () { load() }, [cwd, props.refreshKey])

  function toggle(skill) {
    busy[1](skill.path)
    msg[1]('')
    host.call('setSkillEnabled', { path: skill.path, enabled: !skill.enabled }).then(function (r) {
      busy[1]('')
      if (r && r.ok) load(); else msg[1]((r && r.error) || '操作失败')
    }).catch(function (e) { busy[1](''); msg[1](String(e && e.message || e)) })
  }

  function remove(skill) {
    if (confirmDel[0] !== skill.path) { confirmDel[1](skill.path); return }
    confirmDel[1](null)
    busy[1](skill.path)
    msg[1]('')
    host.call('deleteSkill', { path: skill.path, kind: skill.kind }).then(function (r) {
      busy[1]('')
      if (r && r.ok) load(); else msg[1]((r && r.error) || '删除失败')
    }).catch(function (e) { busy[1](''); msg[1](String(e && e.message || e)) })
  }

  function view(skill) {
    if (detailName[0] === skill.path) { detailName[1](null); detail[1](null); return }
    detailName[1](skill.path)
    detail[1](null)
    host.call('readSkill', { path: skill.path }).then(function (r) {
      detail[1]({ path: skill.path, data: (r && r.ok) ? r.skill : { error: (r && r.error) || '加载失败' } })
    })
  }

  function chooseDir() {
    const pick = props.pickDirectory
    if (typeof pick !== 'function') { scan[1](function (prev) { return Object.assign({}, prev, { error: '目录选择器不可用，请手动输入路径' }) }); return }
    pick().then(function (path) {
      if (path) scan[1](function (prev) { return Object.assign({}, prev, { dir: path, error: '' }) })
    }).catch(function (e) {
      scan[1](function (prev) { return Object.assign({}, prev, { error: String(e && e.message || e) }) })
    })
  }

  function doScan() {
    const dir = scan[0].dir.trim()
    if (!dir) { scan[1](function (prev) { return Object.assign({}, prev, { error: '请输入或选择目录路径' }) }); return }
    scan[1](function (prev) { return Object.assign({}, prev, { busy: true, items: [], error: '', note: '' }) })
    host.call('scanSkills', { dir: dir }).then(function (r) {
      scan[1](function (prev) {
        if (r && r.ok) return Object.assign({}, prev, { busy: false, items: r.items, selected: {}, note: r.items.length === 0 ? '未发现可导入的技能' : '' })
        return Object.assign({}, prev, { busy: false, items: [], error: (r && r.error) || '扫描失败' })
      })
    }).catch(function (e) {
      scan[1](function (prev) { return Object.assign({}, prev, { busy: false, items: [], error: String(e && e.message || e) }) })
    })
  }

  function toggleSelect(item) {
    scan[1](function (prev) {
      const sel = Object.assign({}, prev.selected)
      if (sel[item.sourcePath]) delete sel[item.sourcePath]
      else sel[item.sourcePath] = true
      return Object.assign({}, prev, { selected: sel })
    })
  }

  function doImport() {
    const chosen = scan[0].items.filter(function (it) { return scan[0].selected[it.sourcePath] })
    if (chosen.length === 0) { scan[1](function (prev) { return Object.assign({}, prev, { error: '请先勾选要导入的技能' }) }); return }
    scan[1](function (prev) { return Object.assign({}, prev, { busy: true, error: '' }) })
    host.call('importSkills', { items: chosen.map(function (it) { return { sourcePath: it.sourcePath, kind: it.kind } }) }).then(function (r) {
      if (r && r.ok) {
        const imported = r.results.filter(function (x) { return x.ok }).length
        scan[1](function (prev) { return Object.assign({}, prev, { busy: false, selected: {}, note: '已导入 ' + imported + ' 个技能' }) })
        load()
      } else {
        scan[1](function (prev) { return Object.assign({}, prev, { busy: false, error: (r && r.error) || '导入失败' }) })
      }
    }).catch(function (e) {
      scan[1](function (prev) { return Object.assign({}, prev, { busy: false, error: String(e && e.message || e) }) })
    })
  }

  const groups = [['project', '项目级'], ['user', '用户级']]
  const byLevel = {}
  list.items.forEach(function (it) { (byLevel[it.level] = byLevel[it.level] || []).push(it) })

  const rows = []
  groups.forEach(function (g) {
    const gs = byLevel[g[0]] || []
    if (gs.length === 0) return
    rows.push(h('div', { key: 'g-' + g[0], className: 'skmcp-h' }, g[1] + ' (' + gs.length + ')'))
    gs.forEach(function (skill) {
      const isBusy = busy[0] === skill.path
      rows.push(h('div', { key: skill.path, className: 'skmcp-row' },
        h('div', { className: 'skmcp-main', style: { cursor: 'pointer' }, onClick: function () { view(skill) } },
          h('div', { className: 'skmcp-name' }, skill.name + (skill.enabled ? '' : ' （已禁用）')),
          skill.description ? h('div', { className: 'skmcp-desc' }, skill.description) : null,
        ),
        h('span', { className: 'skmcp-badge' }, sourceLabel(skill.source)),
        h('label', { className: 'skmcp-switch' },
          h('input', { type: 'checkbox', checked: skill.enabled, disabled: isBusy, onChange: function () { toggle(skill) } }),
          h('span', null, skill.enabled ? '启用' : '禁用'),
        ),
        h('button', { type: 'button', className: 'skmcp-btn', onClick: function () { view(skill) } }, detailName[0] === skill.path ? '收起' : '详情'),
        h('button', { type: 'button', className: 'skmcp-btn danger', disabled: isBusy, onClick: function () { remove(skill) } }, confirmDel[0] === skill.path ? '确认删除?' : '删除'),
      ))
      if (detailName[0] === skill.path) {
        const entry = detail[0]
        const d = (entry && entry.path === skill.path) ? entry.data : null
        rows.push(h('div', { key: skill.path + '-detail', className: 'skmcp-detail' },
          d === null ? h('div', null, '加载中…')
            : d && d.error ? h('div', null, d.error)
            : h('div', null,
                h('div', { className: 'skmcp-name' }, d.description || skill.description),
                d.whenToUse ? h('div', { className: 'skmcp-desc' }, 'When to use: ' + d.whenToUse) : null,
                h('pre', { className: 'skmcp-pre' }, d.content || ''),
              ),
        ))
      }
    })
  })

  return h('div', { className: 'skmcp-panel' },
    h('div', { className: 'skmcp-section' },
      h('div', { className: 'skmcp-h' }, '导入技能'),
      h('div', { className: 'skmcp-inline' },
        h('input', { className: 'skmcp-input grow', placeholder: '自定义目录路径，或点击右侧按钮选择', value: scan[0].dir, onChange: function (e) { scan[1](function (prev) { return Object.assign({}, prev, { dir: e.target.value }) }) } }),
        h('button', { type: 'button', className: 'skmcp-btn', onClick: chooseDir }, '选择文件夹'),
        h('button', { type: 'button', className: 'skmcp-btn', disabled: scan[0].busy, onClick: doScan }, scan[0].busy ? '扫描中…' : '扫描目录'),
      ),
      scan[0].error ? h('div', { className: 'skmcp-error' }, scan[0].error) : null,
      scan[0].items.length > 0 ? h('div', { className: 'skmcp-scan-list' },
        scan[0].items.map(function (it) {
          return h('label', { key: it.sourcePath, className: 'skmcp-row' },
            h('input', { type: 'checkbox', checked: !!scan[0].selected[it.sourcePath], onChange: function () { toggleSelect(it) } }),
            h('div', { className: 'skmcp-main' },
              h('div', { className: 'skmcp-name' }, it.name + (it.kind === 'bundle' ? ' (目录)' : ' (文件)')),
              it.description ? h('div', { className: 'skmcp-desc' }, it.description) : null,
            ),
          )
        }),
        h('button', { type: 'button', className: 'skmcp-btn', disabled: scan[0].busy, onClick: doImport }, '导入选中 (' + Object.keys(scan[0].selected).length + ')')
      ) : null,
      scan[0].note ? h('div', { className: 'skmcp-note' }, scan[0].note) : null,
    ),
    h('div', { className: 'skmcp-section' },
      h('div', { className: 'skmcp-inline' },
        h('div', { className: 'skmcp-h grow' }, '技能列表'),
        h('button', { type: 'button', className: 'skmcp-btn', onClick: load }, '刷新'),
      ),
      msg[0] ? h('div', { className: 'skmcp-error' }, msg[0]) : null,
      list.error ? h('div', { className: 'skmcp-error' }, list.error) : null,
      list.loading ? h('div', null, '加载中…')
        : (list.items.length === 0 ? h('div', null, '没有发现技能') : rows),
    ),
  )
}

function McpPanel(props) {
  const listState = React.useState({ loading: true, servers: [], error: '' })
  const list = listState[0]
  const setList = listState[1]
  const form = React.useState({ name: '', transport: 'stdio', command: '', args: '', env: '', cwd: '', url: '', headers: '', mode: 'form', json: '' })
  const f = form[0]
  const setF = form[1]
  const busy = React.useState('')
  const msg = React.useState('')
  const confirmDel = React.useState(null)

  function load() {
    setList({ loading: true, servers: [], error: '' })
    host.call('listMcp', {}).then(function (r) {
      if (r && r.ok) setList({ loading: false, servers: r.servers, error: '' })
      else setList({ loading: false, servers: [], error: (r && r.error) || '加载失败' })
    }).catch(function (e) {
      setList({ loading: false, servers: [], error: String(e && e.message || e) })
    })
  }

  React.useEffect(function () { load() }, [props.refreshKey])

  function patch(p) { setF(Object.assign({}, f, p)) }

  function buildServer() {
    if (f.mode === 'json') {
      try { return JSON.parse(f.json) }
      catch (e) { msg[1]('JSON 解析失败：' + String(e && e.message || e)); return null }
    }
    const server = { name: f.name.trim(), transport: f.transport, enabled: true }
    if (f.transport === 'stdio') {
      server.command = f.command.trim()
      server.args = f.args.split(/\n/).map(function (l) { return l.trim() }).filter(function (l) { return l !== '' })
      server.cwd = f.cwd.trim()
      server.env = parseKv(f.env)
    } else {
      server.url = f.url.trim()
      server.headers = parseKv(f.headers)
    }
    return server
  }

  function save(server) {
    if (!server) return
    busy[1]('save')
    msg[1]('')
    host.call('saveMcp', { server: server }).then(function (r) {
      busy[1]('')
      if (r && r.ok) { msg[1]('已保存 ' + r.server.name); setF({ name: '', transport: 'stdio', command: '', args: '', env: '', cwd: '', url: '', headers: '', mode: 'form', json: '' }); load() }
      else msg[1]((r && r.error) || '保存失败')
    }).catch(function (e) { busy[1](''); msg[1](String(e && e.message || e)) })
  }

  function toggle(s) {
    msg[1]('')
    host.call('setMcpEnabled', { name: s.name, enabled: !s.enabled }).then(function (r) {
      if (r && r.ok) load(); else msg[1]((r && r.error) || '操作失败')
    })
  }

  function remove(s) {
    if (confirmDel[0] !== s.name) { confirmDel[1](s.name); return }
    confirmDel[1](null)
    msg[1]('')
    host.call('deleteMcp', { name: s.name }).then(function (r) {
      if (r && r.ok) load(); else msg[1]((r && r.error) || '删除失败')
    })
  }

  function edit(s) {
    setF({
      name: s.name, transport: s.transport || 'stdio', command: s.command || '',
      args: (s.args || []).join('\n'), env: kvText(s.env || {}), cwd: s.cwd || '',
      url: s.url || '', headers: kvText(s.headers || {}), mode: 'form', json: JSON.stringify(s, null, 2),
    })
    confirmDel[1](null)
  }

  return h('div', { className: 'skmcp-panel' },
    h('div', { className: 'skmcp-section' },
      h('div', { className: 'skmcp-h' }, 'MCP 服务器'),
      msg[0] ? h('div', { className: 'skmcp-error' }, msg[0]) : null,
      list.error ? h('div', { className: 'skmcp-error' }, list.error) : null,
      list.loading ? h('div', null, '加载中…')
        : (list.servers.length === 0 ? h('div', null, '尚未配置任何 MCP 服务器')
          : list.servers.map(function (s) {
              return h('div', { key: s.name, className: 'skmcp-row' },
                h('div', { className: 'skmcp-main' },
                  h('div', { className: 'skmcp-name' }, s.name + (s.enabled !== false ? '' : ' （已禁用）')),
                  h('div', { className: 'skmcp-desc' }, s.transport + (s.transport === 'stdio' ? ' · ' + s.command : ' · ' + (s.url || ''))),
                ),
                h('label', { className: 'skmcp-switch' },
                  h('input', { type: 'checkbox', checked: s.enabled !== false, onChange: function () { toggle(s) } }),
                  h('span', null, s.enabled !== false ? '启用' : '禁用'),
                ),
                h('button', { type: 'button', className: 'skmcp-btn', onClick: function () { edit(s) } }, '编辑'),
                h('button', { type: 'button', className: 'skmcp-btn danger', onClick: function () { remove(s) } }, confirmDel[0] === s.name ? '确认删除?' : '删除'),
              )
            })),
    ),
    h('div', { className: 'skmcp-section' },
      h('div', { className: 'skmcp-h' }, '新建 / 编辑服务器'),
      h('div', { className: 'skmcp-inline' },
        h('button', { type: 'button', className: 'skmcp-btn' + (f.mode === 'form' ? ' active' : ''), onClick: function () { patch({ mode: 'form' }) } }, '表单'),
        h('button', { type: 'button', className: 'skmcp-btn' + (f.mode === 'json' ? ' active' : ''), onClick: function () { patch({ mode: 'json' }) } }, 'JSON'),
      ),
      f.mode === 'form'
        ? h('div', { className: 'skmcp-form' },
            field('名称 name', h('input', { className: 'skmcp-input', value: f.name, placeholder: '例如 github', onChange: function (e) { patch({ name: e.target.value }) } })),
            field('传输 transport', h('select', { className: 'skmcp-input', value: f.transport, onChange: function (e) { patch({ transport: e.target.value }) } },
              h('option', { value: 'stdio' }, 'stdio'),
              h('option', { value: 'streamable-http' }, 'streamable-http'),
            )),
            f.transport === 'stdio'
              ? h('div', null,
                  field('命令 command', h('input', { className: 'skmcp-input', value: f.command, placeholder: 'npx', onChange: function (e) { patch({ command: e.target.value }) } })),
                  field('参数 args（每行一个）', h('textarea', { className: 'skmcp-input', rows: 2, value: f.args, placeholder: '-y\n@modelcontextprotocol/server-github', onChange: function (e) { patch({ args: e.target.value }) } })),
                  field('环境变量 env（KEY=VALUE 每行一个）', h('textarea', { className: 'skmcp-input', rows: 2, value: f.env, onChange: function (e) { patch({ env: e.target.value }) } })),
                  field('工作目录 cwd', h('input', { className: 'skmcp-input', value: f.cwd, onChange: function (e) { patch({ cwd: e.target.value }) } })),
                )
              : h('div', null,
                  field('URL', h('input', { className: 'skmcp-input', value: f.url, placeholder: 'http://localhost:3000/mcp', onChange: function (e) { patch({ url: e.target.value }) } })),
                  field('请求头 headers（KEY=VALUE 每行一个）', h('textarea', { className: 'skmcp-input', rows: 2, value: f.headers, onChange: function (e) { patch({ headers: e.target.value }) } })),
                ),
            h('button', { type: 'button', className: 'skmcp-btn primary', disabled: busy[0] === 'save', onClick: function () { save(buildServer()) } }, busy[0] === 'save' ? '保存中…' : '保存'),
          )
        : h('div', { className: 'skmcp-form' },
            h('textarea', { className: 'skmcp-input mono', rows: 12, value: f.json, placeholder: '{\n  "name": "github",\n  "transport": "stdio",\n  "command": "npx",\n  "args": ["-y", "@modelcontextprotocol/server-github"],\n  "enabled": true\n}', onChange: function (e) { patch({ json: e.target.value }) } }),
            h('button', { type: 'button', className: 'skmcp-btn primary', disabled: busy[0] === 'save', onClick: function () { save(buildServer()) } }, busy[0] === 'save' ? '保存中…' : '保存'),
          ),
      h('div', { className: 'skmcp-desc' }, '配置持久化到 ~/.dsh/mcp.json；启用/禁用为配置标记，实际连接由 dsh-mcp-client（cordis.yml）驱动。'),
    ),
  )
}

function field(label, input) {
  return h('label', { className: 'skmcp-field' }, h('span', { className: 'skmcp-label' }, label), input)
}

function parseKv(text) {
  const obj = {}
  if (!text) return obj
  text.split(/\n/).forEach(function (line) {
    const t = line.trim()
    if (!t) return
    const i = t.indexOf('=')
    if (i < 0) return
    obj[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  })
  return obj
}
function kvText(obj) {
  return Object.keys(obj || {}).map(function (k) { return k + '=' + obj[k] }).join('\n')
}

return {
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return
    const workspaces = ctx.get('workspaces')
    styles.insert(CSS)
    slots.inject('settings.section', function () {
      return slots.register(
        { name: 'settings.section', id: 'skills-mcp', order: 50, label: '技能与 MCP' },
        function Section(props) {
          return React.createElement(App, Object.assign({}, props, {
            pickDirectory: function () { return workspaces ? workspaces.pickDirectory() : Promise.resolve(null) },
          }))
        },
      )
    })
  },
}
