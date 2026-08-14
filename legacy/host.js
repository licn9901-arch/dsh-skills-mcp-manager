// code.host for the "Skills & MCP Manager" dynamic Cordis plugin.
// A plain-JS function body that returns a Cordis Plugin; paste into `code.host`.
return {
  apply(ctx) {
    const shell = ctx.get('shell')
    const fs = ctx.get('fs')

    const FULL_ACCESS = { mode: 'danger-full-access', workspaceRoot: '' }

    const ok = (data) => Object.assign({ ok: true }, data)
    const fail = (message) => ({ ok: false, error: String(message || 'unknown error') })

    async function runNode(script) {
      if (shell === undefined) throw new Error('shell service unavailable')
      const b64 = btoa(script)
      const command = "node -e \"eval(Buffer.from('" + b64 + "','base64').toString('utf8'))\""
      const spec = shell.resolve({ command: command, stdoutMaxBytes: 4 * 1024 * 1024, timeoutMs: 120000, sandboxPolicy: FULL_ACCESS })
      const result = await shell.run(spec)
      if (result.exitCode !== 0) {
        const errText = (result.stderr && result.stderr.text) ? result.stderr.text : ((result.stdout && result.stdout.text) || '')
        throw new Error('node script failed: ' + errText.trim())
      }
      const text = (result.stdout && result.stdout.text) || ''
      return JSON.parse(text)
    }

    let rootsPromise
    function getRoots() {
      if (rootsPromise === undefined) {
        rootsPromise = runNode(
          "const os=require('os'),path=require('path'),fs=require('fs');" +
          "const home=os.homedir();" +
          "const dshHome=process.env.DSH_HOME||path.join(home,'.dsh');" +
          "const agentsHome=process.env.DSH_AGENTS_HOME||path.join(home,'.agents');" +
          "fs.mkdirSync(dshHome,{recursive:true});" +
          "fs.mkdirSync(path.join(dshHome,'skills'),{recursive:true});" +
          "process.stdout.write(JSON.stringify({home:home,dshHome:dshHome,agentsHome:agentsHome,userSkillsDir:path.join(dshHome,'skills'),agentsSkillsDir:path.join(agentsHome,'skills')}));"
        )
      }
      return rootsPromise
    }

    async function findProjectRoot(cwd) {
      const script = "const path=require('path'),fs=require('fs');" +
        "const cwd=" + JSON.stringify(cwd) + ";" +
        "let dir=path.resolve(cwd);" +
        "for(let i=0;i<100;i++){if(fs.existsSync(path.join(dir,'.git')))break;const parent=path.dirname(dir);if(parent===dir)break;dir=parent;}" +
        "process.stdout.write(JSON.stringify({projectRoot:dir}));"
      const res = await runNode(script)
      return res.projectRoot
    }

    function levelOf(source) {
      return (source === 'project-dsh' || source === 'project-agents') ? 'project' : 'user'
    }

    function scalarValue(v) {
      if (v === 'true' || v === 'True' || v === 'TRUE') return true
      if (v === 'false' || v === 'False' || v === 'FALSE') return false
      if (v === 'null' || v === '~') return null
      if (/^-?\d+$/.test(v)) return parseInt(v, 10)
      return v
    }
    function parseBool(v) {
      if (v === true || v === 1 || v === '1') return true
      if (v === false || v === 0 || v === '0') return false
      if (typeof v === 'string') {
        const s = v.toLowerCase()
        if (s === 'true' || s === 'yes' || s === 'on') return true
        if (s === 'false' || s === 'no' || s === 'off') return false
      }
      return undefined
    }
    function parseFrontmatter(raw) {
      const lines = raw.split(/\r?\n/)
      if (lines.length === 0 || lines[0].trim() !== '---') return null
      let closeIdx = -1
      for (let i = 1; i < lines.length; i++) { if (lines[i].trim() === '---') { closeIdx = i; break } }
      if (closeIdx < 0) return null
      const data = {}
      for (let i = 1; i < closeIdx; i++) {
        const line = lines[i]
        const colon = line.indexOf(':')
        if (colon < 0) continue
        const key = line.slice(0, colon).trim()
        let val = line.slice(colon + 1).trim()
        if (val.length >= 2 && ((val[0] === '"' && val[val.length - 1] === '"') || (val[0] === "'" && val[val.length - 1] === "'"))) val = val.slice(1, -1)
        data[key] = scalarValue(val)
      }
      const body = lines.slice(closeIdx + 1).join('\n')
      return { data: data, body: body }
    }
    function parseSkillFile(raw) {
      const fm = parseFrontmatter(raw)
      if (fm === null) return null
      const name = typeof fm.data.name === 'string' ? fm.data.name : ''
      const description = typeof fm.data.description === 'string' ? fm.data.description : ''
      if (name === '' || description === '') return null
      const whenToUse = typeof fm.data.whenToUse === 'string' ? fm.data.whenToUse : ''
      const disableModel = parseBool(fm.data['disable-model-invocation'])
      const userInvocable = parseBool(fm.data['user-invocable'])
      return {
        name: name,
        description: description,
        whenToUse: whenToUse,
        enabled: (disableModel !== true) || (userInvocable !== false),
        content: fm.body.trim(),
      }
    }
    function toggleInvocation(raw, enabled) {
      const lines = raw.split(/\r?\n/)
      if (lines.length === 0 || lines[0].trim() !== '---') return raw
      let closeIdx = -1
      for (let i = 1; i < lines.length; i++) { if (lines[i].trim() === '---') { closeIdx = i; break } }
      if (closeIdx < 0) return raw
      const kept = lines.slice(1, closeIdx).filter(function (l) {
        return !/^\s*(disable-model-invocation|disableModelInvocation|modelInvocable|user-invocable|userInvocable)\s*:/.test(l)
      })
      if (!enabled) { kept.push('disable-model-invocation: true'); kept.push('user-invocable: false') }
      return [lines[0]].concat(kept, lines.slice(closeIdx)).join('\n')
    }

    async function scanRoot(path, source) {
      const items = []
      let target
      try { target = await fs.resolve(path) } catch (e) { return items }
      let entries
      try { entries = await fs.listDir(target) } catch (e) { return items }
      for (const entry of entries) {
        const name = entry.name
        if (!name || name === '.system' || name[0] === '.') continue
        if (entry.type === 'directory') {
          const mdPath = entry.target.displayPath + '/SKILL.md'
          let mdTarget
          try { mdTarget = await fs.resolve(mdPath) } catch (e) { continue }
          let info
          try { info = await fs.stat(mdTarget) } catch (e) { continue }
          if (info === undefined || info.type !== 'file') continue
          const raw = await fs.readText(mdTarget)
          const parsed = parseSkillFile(raw)
          if (parsed === null) continue
          items.push(Object.assign({}, parsed, { source: source, level: levelOf(source), kind: 'bundle', path: mdPath }))
        } else if (entry.type === 'file' && name.endsWith('.md')) {
          const raw = await fs.readText(entry.target)
          const parsed = parseSkillFile(raw)
          if (parsed === null) continue
          items.push(Object.assign({}, parsed, { source: source, level: levelOf(source), kind: 'file', path: entry.target.displayPath }))
        }
      }
      return items
    }

    harness.handle('listSkills', async function (args) {
      if (fs === undefined) return fail('fs service unavailable')
      try {
        const roots = await getRoots()
        let scans
        if (args && args.cwd) {
          const projectRoot = await findProjectRoot(args.cwd)
          scans = [
            { path: projectRoot + '/.dsh/skills', source: 'project-dsh' },
            { path: projectRoot + '/.agents/skills', source: 'project-agents' },
            { path: roots.userSkillsDir, source: 'user-dsh' },
            { path: roots.agentsSkillsDir, source: 'user-agents' },
          ]
        } else {
          scans = [
            { path: roots.userSkillsDir, source: 'user-dsh' },
            { path: roots.agentsSkillsDir, source: 'user-agents' },
          ]
        }
        const seen = {}
        const items = []
        for (const s of scans) {
          const found = await scanRoot(s.path, s.source)
          for (const it of found) {
            if (seen[it.path]) continue
            seen[it.path] = true
            items.push(it)
          }
        }
        items.sort(function (a, b) {
          if (a.level !== b.level) return a.level === 'project' ? -1 : 1
          return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0)
        })
        return ok({ items: items })
      } catch (e) { return fail(e && e.message) }
    })

    harness.handle('readSkill', async function (args) {
      if (fs === undefined) return fail('fs service unavailable')
      const path = args && args.path
      if (!path) return fail('path required')
      try {
        const target = await fs.resolve(path)
        const raw = await fs.readText(target)
        const parsed = parseSkillFile(raw)
        if (parsed === null) return fail('not a valid skill file: ' + path)
        return ok({ skill: Object.assign({}, parsed, { path: path }) })
      } catch (e) { return fail(e && e.message) }
    })

    harness.handle('setSkillEnabled', async function (args) {
      if (fs === undefined) return fail('fs service unavailable')
      const path = args && args.path
      const enabled = !!(args && args.enabled)
      if (!path) return fail('path required')
      try {
        const target = await fs.resolve(path)
        const raw = await fs.readText(target)
        const next = toggleInvocation(raw, enabled)
        await fs.writeText(target, next, undefined, undefined, FULL_ACCESS)
        return ok({ path: path, enabled: enabled })
      } catch (e) { return fail(e && e.message) }
    })

    harness.handle('deleteSkill', async function (args) {
      if (shell === undefined) return fail('shell service unavailable')
      const path = args && args.path
      const kind = args && args.kind
      if (!path) return fail('path required')
      try {
        const script = "const fs=require('fs'),path=require('path');" +
          "const p=" + JSON.stringify(path) + ";" +
          "const kind=" + JSON.stringify(kind || 'file') + ";" +
          "const target=kind==='bundle'?path.dirname(p):p;" +
          "fs.rmSync(target,{recursive:true,force:true});" +
          "process.stdout.write(JSON.stringify({ok:true,removed:target}));"
        const res = await runNode(script)
        return ok({ path: path, removed: res.removed })
      } catch (e) { return fail(e && e.message) }
    })

    harness.handle('scanSkills', async function (args) {
      if (fs === undefined) return fail('fs service unavailable')
      const dir = args && args.dir
      if (!dir) return fail('directory is required')
      try {
        const rootTarget = await fs.resolve(dir)
        const entries = await fs.listDir(rootTarget)
        const items = []
        for (const entry of entries) {
          const name = entry.name
          if (!name || name[0] === '.') continue
          const base = entry.target.displayPath
          if (entry.type === 'directory') {
            const mdPath = base + '/SKILL.md'
            let mdTarget
            try { mdTarget = await fs.resolve(mdPath) } catch (e) { continue }
            let info
            try { info = await fs.stat(mdTarget) } catch (e) { continue }
            if (info === undefined || info.type !== 'file') continue
            const raw = await fs.readText(mdTarget)
            const parsed = parseSkillFile(raw)
            if (parsed !== null) items.push({ name: parsed.name, description: parsed.description, sourcePath: base, kind: 'bundle' })
          } else if (entry.type === 'file' && name.endsWith('.md') && name !== 'SKILL.md') {
            const raw = await fs.readText(entry.target)
            const parsed = parseSkillFile(raw)
            if (parsed !== null) items.push({ name: parsed.name, description: parsed.description, sourcePath: base, kind: 'file' })
          }
        }
        return ok({ items: items })
      } catch (e) { return fail(e && e.message) }
    })

    harness.handle('importSkills', async function (args) {
      if (shell === undefined) return fail('shell service unavailable')
      const items = (args && args.items) || []
      if (!Array.isArray(items) || items.length === 0) return fail('nothing selected')
      try {
        const roots = await getRoots()
        const script = "const fs=require('fs'),path=require('path');" +
          "const destDir=" + JSON.stringify(roots.userSkillsDir) + ";" +
          "const items=" + JSON.stringify(items) + ";" +
          "fs.mkdirSync(destDir,{recursive:true});" +
          "const results=[];" +
          "for(const it of items){const base=path.basename(it.sourcePath);const dest=path.join(destDir,base);" +
          "if(fs.existsSync(dest)){results.push({name:base,ok:false,reason:'already exists'});continue;}" +
          "try{if(it.kind==='bundle')fs.cpSync(it.sourcePath,dest,{recursive:true});else fs.copyFileSync(it.sourcePath,dest);results.push({name:base,ok:true});}" +
          "catch(e){results.push({name:base,ok:false,reason:String(e&&e.message||e)});}}" +
          "process.stdout.write(JSON.stringify({ok:true,results:results}));"
        return await runNode(script)
      } catch (e) { return fail(e && e.message) }
    })

    async function readMcp() {
      const roots = await getRoots()
      const target = await fs.resolve(roots.dshHome + '/mcp.json')
      const info = await fs.stat(target)
      if (info === undefined) return { servers: [] }
      const raw = await fs.readText(target)
      if (!raw || raw.trim() === '') return { servers: [] }
      const data = JSON.parse(raw)
      return { servers: Array.isArray(data.servers) ? data.servers : [] }
    }
    async function writeMcp(data) {
      const roots = await getRoots()
      const target = await fs.resolve(roots.dshHome + '/mcp.json')
      await fs.writeText(target, JSON.stringify(data, null, 2), undefined, undefined, FULL_ACCESS)
    }
    function validateMcp(server) {
      if (!server || typeof server !== 'object') return 'server must be an object'
      const name = server.name
      if (typeof name !== 'string' || !/^[A-Za-z0-9_-]{1,32}$/.test(name)) return 'invalid name (1-32 chars of A-Za-z0-9_-)'
      if (server.transport !== 'stdio' && server.transport !== 'streamable-http') return "transport must be 'stdio' or 'streamable-http'"
      if (server.transport === 'stdio' && (typeof server.command !== 'string' || server.command.trim() === '')) return 'stdio transport requires command'
      if (server.transport === 'streamable-http' && (typeof server.url !== 'string' || server.url.trim() === '')) return 'streamable-http transport requires url'
      return null
    }

    harness.handle('listMcp', async function () {
      if (fs === undefined) return fail('fs service unavailable')
      try { const data = await readMcp(); return ok({ servers: data.servers }) }
      catch (e) { return fail(e && e.message) }
    })

    harness.handle('saveMcp', async function (args) {
      if (fs === undefined) return fail('fs service unavailable')
      const server = args && args.server
      const err = validateMcp(server)
      if (err) return fail(err)
      try {
        const data = await readMcp()
        const idx = data.servers.findIndex(function (s) { return s.name === server.name })
        const normalized = { name: server.name, transport: server.transport, enabled: server.enabled !== false }
        if (server.transport === 'stdio') {
          normalized.command = server.command
          normalized.args = Array.isArray(server.args) ? server.args : []
          normalized.env = (server.env && typeof server.env === 'object' && !Array.isArray(server.env)) ? server.env : {}
          normalized.cwd = server.cwd || ''
        } else {
          normalized.url = server.url
          normalized.headers = (server.headers && typeof server.headers === 'object' && !Array.isArray(server.headers)) ? server.headers : {}
        }
        if (idx >= 0) data.servers[idx] = normalized
        else data.servers.push(normalized)
        await writeMcp(data)
        return ok({ server: normalized })
      } catch (e) { return fail(e && e.message) }
    })

    harness.handle('setMcpEnabled', async function (args) {
      if (fs === undefined) return fail('fs service unavailable')
      const name = args && args.name
      const enabled = !!(args && args.enabled)
      try {
        const data = await readMcp()
        const s = data.servers.find(function (x) { return x.name === name })
        if (s === undefined) return fail('server not found: ' + name)
        s.enabled = enabled
        await writeMcp(data)
        return ok({ name: name, enabled: enabled })
      } catch (e) { return fail(e && e.message) }
    })

    harness.handle('deleteMcp', async function (args) {
      if (fs === undefined) return fail('fs service unavailable')
      const name = args && args.name
      try {
        const data = await readMcp()
        data.servers = data.servers.filter(function (x) { return x.name !== name })
        await writeMcp(data)
        return ok({ name: name })
      } catch (e) { return fail(e && e.message) }
    })
  },
}
