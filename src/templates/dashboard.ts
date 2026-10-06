export const dashboardHtml = (userEmail: string) => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AuthHub Dashboard</title>
<script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-zinc-950 text-white min-h-screen p-6">
<div class="max-w-5xl mx-auto">
<div class="flex justify-between items-center mb-8">
<div><h1 class="text-2xl font-bold">AuthHub</h1><p class="text-sm text-zinc-400">Developer Dashboard - <span id="hdrEmail">${userEmail}</span></p></div>
<button onclick="localStorage.clear(); location.href='/'" class="px-4 py-2 bg-zinc-800 rounded-xl">Logout</button>
</div>
<div class="grid md:grid-cols-2 gap-6">
<div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
<h2 class="font-bold mb-4">Create New Project</h2>
<input id="appName" placeholder="My Awesome App" class="w-full mb-2 px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700">
<input id="website" placeholder="https://webinar.com" class="w-full mb-4 px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700">
<button onclick="createApp()" class="w-full py-2 bg-white text-black rounded-xl font-bold">Create Project</button>
<div id="createMsg" class="text-sm mt-3 text-zinc-400"></div>
</div>
<div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
<h2 class="font-bold mb-2">How it works</h2>
<p class="text-sm text-zinc-400">Firebase-style but for Facebook & GitHub login.</p>
</div>
</div>
<div id="apps" class="mt-8 grid gap-4"></div>
</div>
<script>
function getToken(){return localStorage.getItem('token');}
async function api(path,opts){
 const t=getToken(); if(!t){location.href='/'; return {ok:false,data:{}};}
 opts.headers={...(opts.headers||{}),Authorization:'Bearer '+t,'Content-Type':'application/json'};
 const r=await fetch(path,opts); let data={}; try{data=await r.json();}catch{}
 return {ok:r.ok,data,status:r.status};
}
async function loadApps(){
 const res=await api('/api/apps');
 const c=document.getElementById('apps');
 if(!res.ok){ c.innerHTML='<p class="text-red-400">Error '+res.status+': '+(res.data.error||'Unauthorized')+'</p>'; return; }
 const me=await api('/api/auth/me'); if(me.ok) document.getElementById('hdrEmail').textContent=me.data.user.email;
 if(!res.data.apps.length){c.innerHTML='<p class="text-zinc-500">No projects yet</p>';return;}
 c.innerHTML=res.data.apps.map(function(a){
   return '<div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-5"><h3 class="font-bold">'+a.name+'</h3><p class="text-xs text-zinc-400">'+(a.website_url||'')+'</p><div class="mt-3 bg-zinc-950 p-3 rounded-xl font-mono text-xs break-all">client_id: '+a.client_id+'<br>secret: '+a.client_secret+'</div><div class="mt-3 flex gap-4 text-xs"><label><input type="checkbox" '+(a.facebook_enabled?'checked':'')+' onchange="toggle(\\''+a.id+'\\',\\'facebook\\',this.checked)"> Facebook</label><label><input type="checkbox" '+(a.github_enabled?'checked':'')+' onchange="toggle(\\''+a.id+'\\',\\'github\\',this.checked)"> GitHub</label></div></div>';
 }).join('');
}
async function createApp(){
 const name=document.getElementById('appName').value, website=document.getElementById('website').value;
 const msg=document.getElementById('createMsg'); msg.textContent='Creating...';
 const r=await api('/api/apps',{method:'POST',body:JSON.stringify({name:name,website_url:website})});
 msg.textContent=r.ok?'Created!':('Error: '+r.data.error);
 if(r.ok) loadApps();
}
async function toggle(id,p,en){ await api('/api/apps/'+id+'/providers',{method:'PATCH',body:JSON.stringify({[p+'_enabled']:en})}); }
if(!getToken()) location.href='/'; else loadApps();
</script></body></html>`;
