import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { sign, verify } from 'hono/jwt'
import { homeHtml } from './templates/home'
import { dashboardHtml } from './templates/dashboard'

type Env = { DB: D1Database; JWT_SECRET: string; }
const app = new Hono<{ Bindings: Env }>()
app.use('*', logger())
app.use('*', cors())

async function hashPassword(p: string){ const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(p)); return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('') }
async function getUserFromToken(c:any){
 const auth=c.req.header('Authorization'); if(!auth) return null;
 try{ const payload=await verify(auth.replace('Bearer ',''),c.env.JWT_SECRET); const user=await c.env.DB.prepare('SELECT id,email FROM users WHERE id=?1').bind(payload.sub).first(); return user?{...user,payload}:null }catch{return null}
}

app.get('/', (c) => c.html(homeHtml))
app.get('/dashboard', (c) => {
 // Serve dashboard always - JS will check token in localStorage
 return c.html(dashboardHtml('Developer'))
})
app.get('/health', (c) => c.json({ ok: true }))

app.post('/api/auth/register', async (c) => {
 const { email, password } = await c.req.json();
 if(!email||!password||password.length<6) return c.json({error:'Invalid'},400);
 const hash=await hashPassword(password);
 try{ const id=crypto.randomUUID(); await c.env.DB.prepare('INSERT INTO users (id,email,password_hash,created_at) VALUES (?1,?2,?3,?4)').bind(id,email.toLowerCase(),hash,new Date().toISOString()).run();
 const token=await sign({sub:id,email,exp:Math.floor(Date.now()/1000)+60*60*24*7},c.env.JWT_SECRET); return c.json({token,user:{id,email}}) }catch(e:any){ if(e.message?.includes('UNIQUE')) return c.json({error:'Email exists'},409); return c.json({error:e.message},500) }
})
app.post('/api/auth/login', async (c) => {
 const { email, password } = await c.req.json(); const hash=await hashPassword(password);
 const user=await c.env.DB.prepare('SELECT id,email FROM users WHERE email=?1 AND password_hash=?2').bind(email.toLowerCase(),hash).first();
 if(!user) return c.json({error:'Invalid credentials'},401);
 const token=await sign({sub:(user as any).id,email:(user as any).email,exp:Math.floor(Date.now()/1000)+60*60*24*7},c.env.JWT_SECRET);
 return c.json({token,user})
})
app.get('/api/auth/me', async (c) => {
 const user=await getUserFromToken(c); if(!user) return c.json({error:'No token'},401); return c.json({user})
})

app.get('/api/apps', async (c) => {
 const user=await getUserFromToken(c); if(!user) return c.json({error:'Unauthorized'},401);
 const { results } = await c.env.DB.prepare('SELECT * FROM apps WHERE owner_id=?1 ORDER BY created_at DESC').bind((user as any).id).all();
 return c.json({apps:results})
})
app.post('/api/apps', async (c) => {
 const user=await getUserFromToken(c); if(!user) return c.json({error:'Unauthorized'},401);
 const { name, description, website_url } = await c.req.json(); if(!name) return c.json({error:'Name required'},400);
 const id=crypto.randomUUID(); const client_id='ah_'+crypto.randomUUID().replace(/-/g,'').slice(0,24); const client_secret='ahs_'+crypto.randomUUID().replace(/-/g,'')+crypto.randomUUID().replace(/-/g,'');
 await c.env.DB.prepare('INSERT INTO apps (id,owner_id,name,description,website_url,client_id,client_secret,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)').bind(id,(user as any).id,name,description||'',website_url||'',client_id,client_secret,new Date().toISOString()).run();
 const appRow=await c.env.DB.prepare('SELECT * FROM apps WHERE id=?1').bind(id).first(); return c.json({app:appRow})
})
app.patch('/api/apps/:id/providers', async (c) => {
 const user=await getUserFromToken(c); if(!user) return c.json({error:'Unauthorized'},401);
 const { id } = c.req.param(); const body=await c.req.json();
 const fields=[]; const vals=[];
 if('facebook_enabled' in body){ fields.push('facebook_enabled=?'); vals.push(body.facebook_enabled?1:0) }
 if('github_enabled' in body){ fields.push('github_enabled=?'); vals.push(body.github_enabled?1:0) }
 if(!fields.length) return c.json({error:'Nothing to update'},400);
 vals.push(id, (user as any).id);
 await c.env.DB.prepare(`UPDATE apps SET ${fields.join(',')} WHERE id=? AND owner_id=?`).bind(...vals).run();
 const updated=await c.env.DB.prepare('SELECT * FROM apps WHERE id=?1').bind(id).first(); return c.json({app:updated})
})

export default app
