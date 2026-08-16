import { readFileSync } from 'node:fs'

const client = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

if (client.includes('require("lucide-react")') || client.includes("require('lucide-react')")) {
  throw new Error('client.js must inline lucide-react for the DSH browser module loader')
}
if (!client.includes('id: "@cubee-slide/skills-mcp-manager"')) {
  throw new Error('client.js module loader id does not match the published package name')
}

console.log('[verify-client-bundle] lucide-react is inlined and the module id is valid')
