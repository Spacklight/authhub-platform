import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { sign, verify } from 'hono/jwt'

type Env = {
  DB: D1Database
  JWT_SECRET: string
}

const app = new Hono<{ Bindings: Env }>()

app.use('*', logger())
app.use('*', cors())

app.get('/', (c) => c.json({ name: 'AuthHub Platform', status: 'ok', version: '0.1.0' }))
app.get('/health', (c) => c.json({ ok: true, time: new Date().toISOString() }))

async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder().encode(password)
  const hash = await crypto.subtle.digest('SHA-256', enc)
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('')
}

async function createUser(db: D1Database, email: string, passwordHash: string) {
  const id = crypto.randomUUID()
  await db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?1, ?2, ?3, ?4)').bind(id, email.toLowerCase(), passwordHash, new Date().toISOString()).run()
  return id
}

app.post('/api/auth/register', async (c) => {
  const { email, password } = await c.req.json()
  if (!email || !password || password.length < 6) return c.json({ error: 'Invalid email or password (min 6 chars)' }, 400)
  const hash = await hashPassword(password)
  try {
    const id = await createUser(c.env.DB, email, hash)
    const token = await sign({ sub: id, email, exp: Math.floor(Date.now()/1000)+60*60*24*7 }, c.env.JWT_SECRET)
    return c.json({ id, email, token })
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) return c.json({ error: 'Email already exists' }, 409)
    return c.json({ error: 'Failed', details: e.message }, 500)
  }
})

app.post('/api/auth/login', async (c) => {
  const { email, password } = await c.req.json()
  const hash = await hashPassword(password)
  const user = await c.env.DB.prepare('SELECT id, email FROM users WHERE email = ?1 AND password_hash = ?2').bind(email.toLowerCase(), hash).first()
  if (!user) return c.json({ error: 'Invalid credentials' }, 401)
  const token = await sign({ sub: (user as any).id, email: (user as any).email, exp: Math.floor(Date.now()/1000)+60*60*24*7 }, c.env.JWT_SECRET)
  return c.json({ token, user })
})

app.get('/api/auth/me', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth) return c.json({ error: 'No token' }, 401)
  try {
    const payload = await verify(auth.replace('Bearer ',''), c.env.JWT_SECRET)
    const user = await c.env.DB.prepare('SELECT id, email, created_at FROM users WHERE id = ?1').bind(payload.sub).first()
    return c.json({ user })
  } catch { return c.json({ error: 'Invalid token' }, 401) }
})

app.get('/api/users', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT id, email, created_at FROM users ORDER BY created_at DESC LIMIT 100').all()
  return c.json({ users: results })
})

export default app
