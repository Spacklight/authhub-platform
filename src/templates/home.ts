export const homeHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AuthHub Platform</title>
<script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-zinc-950 text-white min-h-screen flex items-center justify-center p-4">
<div class="w-full max-w-md bg-zinc-900 rounded-2xl p-8 border border-zinc-800">
<h1 class="text-2xl font-bold mb-1">AuthHub Platform</h1>
<p class="text-zinc-400 text-sm mb-6">Firebase for 【entity-Facebook¦canonical_name=Facebook】 & 【entity-GitHub¦canonical_name=GitHub】 Auth</p>

<div class="flex gap-2 mb-6">
<button id="tab-login" class="flex-1 py-2 rounded-lg bg-white text-black font-medium">Login</button>
<button id="tab-register" class="flex-1 py-2 rounded-lg bg-zinc-800 text-zinc-400">Register</button>
</div>

<input id="email" type="email" placeholder="email@example.com" class="w-full mb-3 px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 focus:outline-none focus:border-white">
<input id="password" type="password" placeholder="password (min 6)" class="w-full mb-4 px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 focus:outline-none focus:border-white">
<button id="submit" class="w-full py-3 rounded-xl bg-white text-black font-bold">Continue</button>
<div id="msg" class="mt-4 text-sm text-zinc-400 hidden"></div>

<div id="userBox" class="mt-6 p-4 rounded-xl bg-zinc-800 hidden">
<div class="text-xs text-zinc-400">Logged in — redirecting...</div>
<div id="userEmail" class="font-medium"></div>
</div>

</div>
<script>
let mode='login';
const tabLogin=document.getElementById('tab-login'), tabReg=document.getElementById('tab-register');
tabLogin.onclick=()=>{mode='login'; tabLogin.className='flex-1 py-2 rounded-lg bg-white text-black font-medium'; tabReg.className='flex-1 py-2 rounded-lg bg-zinc-800 text-zinc-400';}
tabReg.onclick=()=>{mode='register'; tabReg.className='flex-1 py-2 rounded-lg bg-white text-black font-medium'; tabLogin.className='flex-1 py-2 rounded-lg bg-zinc-800 text-zinc-400';}
document.getElementById('submit').onclick=async()=>{
 const email=document.getElementById('email').value;
 const password=document.getElementById('password').value;
 const msg=document.getElementById('msg');
 msg.classList.remove('hidden'); msg.textContent='Loading...';
 try{
  const res=await fetch('/api/auth/'+mode,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  const data=await res.json();
  if(!res.ok) throw new Error(data.error||'Failed');
  msg.textContent=mode+' success! Redirecting...';
  localStorage.setItem('token',data.token);
  document.getElementById('userBox').classList.remove('hidden');
  document.getElementById('userEmail').textContent=data.user?data.user.email:email;
  setTimeout(()=>location.href='/dashboard',800);
 }catch(e){ msg.textContent=e.message; }
};
const saved=localStorage.getItem('token');
if(saved){ location.href='/dashboard'; }
</script>
</body>
</html>`;
