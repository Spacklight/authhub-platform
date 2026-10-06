export const dashboardHtml = (userEmail: string) => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AuthHub Dashboard</title>
<script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-zinc-950 text-white min-h-screen p-6">
<div class="max-w-5xl mx-auto">
<div class="flex justify-between items-center mb-8">
<div><h1 class="text-2xl font-bold">AuthHub</h1><p class="text-sm text-zinc-400">Developer Dashboard — ${userEmail}</p></div>
<button onclick="localStorage.clear(); location.href='/'" class="px-4 py-2 bg-zinc-800 rounded-xl">Logout</button>
</div>

<div class="grid md:grid-cols-2 gap-6">
<div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
<h2 class="font-bold mb-4">Create New Project</h2>
<input id="appName" placeholder="My Awesome App" class="w-full mb-2 px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700">
<input id="website" placeholder="https://myapp.com (optional)" class="w-full mb-4 px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700">
<button onclick="createApp()" class="w-full py-2 bg-white text-black rounded-xl font-bold">Create Project</button>
<div id="createMsg" class="text-sm mt-3 text-zinc-400"></div>
</div>

<div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
<h2 class="font-bold mb-2">How it works (Firebase-style)</h2>
<p class="text-sm text-zinc-400 mb-3">1. Create project → get client_id<br>2. Add to your app: <code class="bg-zinc-800 px-1 rounded">authhub.init('YOUR_CLIENT_ID')</code><br>3. Enable Facebook/GitHub per project<br>4. Your users login via your app, verified by AuthHub</p>
<div class="text-xs text-zinc-500">Next step: We will implement OAuth URLs for Facebook & GitHub</div>
</div>
</div>

<div id="apps" class="mt-8 grid gap-4"></div>
</div>
<script>
const token=localStorage.getItem('token');
if(!token) location.href='/';
async function api(path,opts={}){opts.headers={...(opts.headers||{}),Authorization:'Bearer '+token,'Content-Type':'application/json'};const r=await fetch(path,opts);return {ok:r.ok,data:await r.json()};}
async function loadApps(){
 const {ok,data}=await api('/api/apps');
 const c=document.getElementById('apps');
 if(!ok){c.innerHTML='<p class="text-red-400">'+data.error+'</p>';return;}
 if(!data.apps.length){c.innerHTML='<p class="text-zinc-500 text-sm">No projects yet. Create one above.</p>';return;}
 c.innerHTML=data.apps.map(app=>\`
<div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
<div class="flex justify-between"><h3 class="font-bold">\${app.name}</h3><span class="text-xs text-zinc-500">\${new Date(app.created_at).toLocaleDateString()}</span></div>
<p class="text-xs text-zinc-400 mt-1">\${app.description||''} \${app.website_url||''}</p>
<div class="mt-3 bg-zinc-950 rounded-xl p-3 text-xs font-mono break-all">
<div>client_id: <span class="text-white">\${app.client_id}</span></div>
<div>client_secret: <span class="text-zinc-500">\${app.client_secret}</span> (keep secret!)</div>
</div>
<div class="mt-3 flex gap-2">
<label class="flex items-center gap-2 text-xs"><input type="checkbox" \${app.facebook_enabled?'checked':''} onchange="toggle('\${app.id}','facebook',this.checked)"> Facebook Login</label>
<label class="flex items-center gap-2 text-xs"><input type="checkbox" \${app.github_enabled?'checked':''} onchange="toggle('\${app.id}','github',this.checked)"> GitHub Login</label>
</div>
<div class="mt-3 text-[11px] text-zinc-500">SDK: authhub.auth('\${app.client_id}').signInWithFacebook() / signInWithGitHub()</div>
</div>\`).join('');
}
async function createApp(){
 const name=document.getElementById('appName').value;
 const website=document.getElementById('website').value;
 const msg=document.getElementById('createMsg'); msg.textContent='Creating...';
 const {ok,data}=await api('/api/apps',{method:'POST',body:JSON.stringify({name,website_url:website})});
 msg.textContent=ok?'Created!':'Error: '+data.error;
 if(ok) loadApps();
}
async function toggle(id,provider,enabled){
 await api('/api/apps/'+id+'/providers',{method:'PATCH',body:JSON.stringify({[provider+'_enabled']:enabled})});
}
loadApps();
</script></body></html>`;
