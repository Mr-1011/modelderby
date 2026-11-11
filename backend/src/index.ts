import { createServer } from 'node:http'
import { APP_NAME } from '@modelderby/shared'

createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true, name: APP_NAME }))
    return
  }
  res.writeHead(404).end()
}).listen(Number(process.env.PORT ?? 8080))

// The race loop needs all keys. Without them only the health route runs.
const keys = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ARCHIL_API_KEY', 'OPENROUTER_API_KEY']
if (keys.every((key) => process.env[key])) {
  const { loop } = await import('./race.ts')
  loop()
}
