import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { sign, verify } from 'hono/jwt'
import { homeHtml } from './templates/home'
import { dashboardHtml } from './templates/dashboard'
type Env = { DB: D1Database; JWT_SECRET: string; GITHUB_CLIENT_ID: string; GITHUB_CLIENT_SECRET: string; FACEBOOK_APP_ID?: string; FACEBOOK_APP_SECRET?: string; }
const app = new Hono<{ Bindings: Env }>()
app.use('*', logger())
app.use('*', cors({ origin: '*', allowHeaders: ['Content-Type','Authorization'], allowMethods: ['GET','POST','PATCH','OPTIONS'] }))
async function hashPassword(p:string){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(p));return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('')}
function getSecret(c:any){return (c.env.JWT_SECRET || 'change-me-in-production-please').trim();}
async function getUserFromToken(c:any){
 const auth=c.req.header('Authorization'); if(!auth) return null
 try{ const token=auth.replace(/^Bearer\s+/i,''); const payload=await verify(token, getSecret(c), 'HS256'); const user=await c.env.DB.prepare('SELECT id,email FROM users WHERE id=?1').bind(payload.sub).first(); return user?{...user,payload}:null }catch{return null}
}
const GH_CALLBACK = 'https://authhub-platform.emalawi.workers.dev/api/oauth/github/callback'
app.get('/', (c) => c.html(homeHtml))
app.get('/dashboard', (c) => c.html(dashboardHtml('Developer')))
app.get('/health', (c) => c.json({ ok: true, secretSet:!!c.env.JWT_SECRET, githubSet:!!(c.env.GITHUB_CLIENT_ID && c.env.GITHUB_CLIENT_SECRET) }))
// Auth
app.post('/api/auth/register', async (c) => {
 const { email, password } = await c.req.json(); if(!email||!password||password.length<6) return c.json({error:'Invalid'},400);
 const hash=await hashPassword(password);
 try{ const id=crypto.randomUUID(); await c.env.DB.prepare('INSERT INTO users (id,email,password_hash,created_at) VALUES (?1,?2,?3,?4)').bind(id,email.toLowerCase(),hash,new Date().toISOString()).run();
 const token=await sign({sub:id,email,exp:Math.floor(Date.now()/1000)+60*60*24*7}, getSecret(c), 'HS256'); return c.json({token,user:{id,email}}) }catch(e:any){ if(e.message?.includes('UNIQUE')) return c.json({error:'Email exists'},409); return c.json({error:e.message},500) }
})
app.post('/api/auth/login', async (c) => {
 const { email, password } = await c.req.json(); const hash=await hashPassword(password);
 const user=await c.env.DB.prepare('SELECT id,email FROM users WHERE email=?1 AND password_hash=?2').bind(email.toLowerCase(),hash).first();
 if(!user) return c.json({error:'Invalid credentials'},401);
 const token=await sign({sub:(user as any).id,email:(user as any).email,exp:Math.floor(Date.now()/1000)+60*60*24*7}, getSecret(c), 'HS256');
 return c.json({token,user})
})
app.get('/api/auth/me', async (c) => {
 const user=await getUserFromToken(c); if(!user) return c.json({error:'Unauthorized'},401); return c.json({user})
})
app.get('/api/apps', async (c) => {
 const user=await getUserFromToken(c); if(!user) return c.json({error:'Unauthorized'},401);
 const { results } = await c.env.DB.prepare('SELECT * FROM apps WHERE owner_id=?1 ORDER BY created_at DESC').bind((user as any).id).all(); return c.json({apps:results})
})
app.post('/api/apps', async (c) => {
 const user=await getUserFromToken(c); if(!user) return c.json({error:'Unauthorized'},401);
 const { name, website_url } = await c.req.json(); if(!name) return c.json({error:'Name required'},400);
 const id=crypto.randomUUID(); const client_id='ah_'+crypto.randomUUID().replace(/-/g,'').slice(0,24); const client_secret='ahs_'+crypto.randomUUID().replace(/-/g,'')+crypto.randomUUID().replace(/-/g,'');
 await c.env.DB.prepare('INSERT INTO apps (id,owner_id,name,website_url,client_id,client_secret,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)').bind(id,(user as any).id,name,website_url||'',client_id,client_secret,new Date().toISOString()).run();
 const row=await c.env.DB.prepare('SELECT * FROM apps WHERE id=?1').bind(id).first(); return c.json({app:row})
})
app.patch('/api/apps/:id/providers', async (c) => {
 const user=await getUserFromToken(c); if(!user) return c.json({error:'Unauthorized'},401);
 const { id } = c.req.param(); const body=await c.req.json(); const fields=[]; const vals=[];
 if('facebook_enabled' in body){fields.push('facebook_enabled=?'); vals.push(body.facebook_enabled?1:0);}
 if('github_enabled' in body){fields.push('github_enabled=?'); vals.push(body.github_enabled?1:0);}
 if(!fields.length) return c.json({error:'Nothing'},400);
 vals.push(id,(user as any).id);
 await c.env.DB.prepare(`UPDATE apps SET ${fields.join(',')} WHERE id=? AND owner_id=?`).bind(...vals).run();
 const up=await c.env.DB.prepare('SELECT * FROM apps WHERE id=?1').bind(id).first(); return c.json({app:up})
})
// ===== OAUTH FOR DEVELOPER APPS =====
app.get('/api/oauth/:provider/authorize', async (c) => {
 const provider=c.req.param('provider'); const client_id=c.req.query('client_id'); const redirect_uri=c.req.query('redirect_uri'); const orig_state=c.req.query('state')||''; const scope=c.req.query('scope')||'user:email'
 if(!client_id) return c.json({error:'client_id required'},400);
 const appRow=await c.env.DB.prepare('SELECT * FROM apps WHERE client_id=?1').bind(client_id).first() as any;
 if(!appRow) return c.json({error:'Invalid client_id'},400);
 if(provider==='github' &&!appRow.github_enabled) return c.json({error:'GitHub not enabled for this app'},400);
 if(provider==='facebook' &&!appRow.facebook_enabled) return c.json({error:'Facebook not enabled'},400);
 if(provider==='github'){
   if(!c.env.GITHUB_CLIENT_ID) return c.json({error:'GitHub not configured on server'},500);
   const statePayload={app_client_id:client_id, redirect_uri:redirect_uri||appRow.website_url, orig_state, nonce:crypto.randomUUID(), exp:Math.floor(Date.now()/1000)+600}
   const stateJwt=await sign(statePayload, getSecret(c), 'HS256')
   const ghUrl=`https://github.com/login/oauth/authorize?client_id=${c.env.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(GH_CALLBACK)}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(stateJwt)}`
   return c.redirect(ghUrl)
 }
 return c.json({error:'Provider not supported yet'},400)
})
app.get('/api/oauth/github/callback', async (c) => {
 const code=c.req.query('code'); const stateJwt=c.req.query('state'); if(!code||!stateJwt) return c.json({error:'Missing code/state'},400);
 let state:any; try{ state=await verify(stateJwt, getSecret(c), 'HS256') }catch{return c.json({error:'Invalid state'},400)}
 const appRow=await c.env.DB.prepare('SELECT * FROM apps WHERE client_id=?1').bind(state.app_client_id).first() as any; if(!appRow) return c.json({error:'App not found'},400)
 // exchange code for token
 const tokenRes=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({client_id:c.env.GITHUB_CLIENT_ID, client_secret:c.env.GITHUB_CLIENT_SECRET, code, redirect_uri:GH_CALLBACK})})
 const tokenData=await tokenRes.json() as any; if(!tokenData.access_token) return c.json({error:'GitHub token exchange failed', details:tokenData},400)
 const accessToken=tokenData.access_token
 const userRes=await fetch('https://api.github.com/user',{headers:{Authorization:`Bearer ${accessToken}`, 'User-Agent':'AuthHub'}})
 const ghUser=await userRes.json() as any
 const emailRes=await fetch('https://api.github.com/user/emails',{headers:{Authorization:`Bearer ${accessToken}`, 'User-Agent':'AuthHub'}})
 const emails=await emailRes.json() as any; const primary=Array.isArray(emails)?(emails.find((e:any)=>e.primary)?.email || emails[0]?.email):null
 const email=primary||ghUser.email||''
 // upsert app_user
 const existing=await c.env.DB.prepare('SELECT * FROM app_users WHERE app_id=?1 AND provider=?2 AND provider_user_id=?3').bind(appRow.id,'github',String(ghUser.id)).first() as any
 let appUserId=existing?.id
 if(!existing){
   appUserId=crypto.randomUUID()
   await c.env.DB.prepare('INSERT INTO app_users (id,app_id,provider,provider_user_id,email,name,avatar_url,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)').bind(appUserId,appRow.id,'github',String(ghUser.id),email,ghUser.name||ghUser.login,ghUser.avatar_url,new Date().toISOString()).run()
 }else{
   await c.env.DB.prepare('UPDATE app_users SET email=?1,name=?2,avatar_url=?3 WHERE id=?4').bind(email,ghUser.name||ghUser.login,ghUser.avatar_url,appUserId).run()
 }
 const appUserToken=await sign({sub:appUserId, app_id:appRow.id, provider:'github', provider_user_id:String(ghUser.id), email, name:ghUser.name||ghUser.login, avatar:ghUser.avatar_url, exp:Math.floor(Date.now()/1000)+60*60*24*7}, getSecret(c), 'HS256')
 const redirectUrl=new URL(state.redirect_uri); redirectUrl.searchParams.set('token',appUserToken); redirectUrl.searchParams.set('provider','github'); if(state.orig_state) redirectUrl.searchParams.set('state',state.orig_state)
 return c.redirect(redirectUrl.toString())
})
// Verify token issued to app user (developers call this)
app.post('/api/oauth/verify', async (c) => {
 const { token, client_secret }=await c.req.json(); if(!token) return c.json({error:'token required'},400);
 try{
   const payload=await verify(token, getSecret(c), 'HS256') as any
   if(client_secret){
     const appRow=await c.env.DB.prepare('SELECT * FROM apps WHERE id=?1').bind(payload.app_id).first() as any
     if(!appRow || appRow.client_secret!==client_secret) return c.json({error:'Invalid client_secret'},401)
   }
   return c.json({valid:true, user:payload})
 }catch(e:any){ return c.json({valid:false, error:e.message},401) }
})
export default app
