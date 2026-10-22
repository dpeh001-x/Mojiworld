// Mojiworld FEEDBACK PORTAL - the admin dashboard (v0.30.1851): one self-contained page, served at /feedback-admin by the Worker.
// No data and no key are baked in: the page asks for the admin key (kept in sessionStorage only), then reads /api/feedback/* with it.
// Every piece of player text goes in through textContent, never innerHTML, so a report cannot run code in the dashboard.
export const ADMIN_HTML = String.raw`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Mojiworld Feedback</title>
<style>
:root{--bg:#120d1c;--card:#1b1428;--ink:#f4f1ea;--dim:#a99dc0;--line:#3a2f4d;--gold:#ffe07a;--pink:#ff3d8b;--ok:#6be3a0;--bad:#ff6b6b}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,Segoe UI,Roboto,sans-serif}
header{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:12px 16px;border-bottom:3px solid #0d0a14;background:#1a1226;position:sticky;top:0;z-index:5}
h1{margin:0;font-size:18px;color:var(--gold);letter-spacing:.5px}.sp{flex:1}
button,select,input{font:inherit;color:var(--ink);background:#241a35;border:2px solid var(--line);border-radius:8px;padding:6px 10px}
button{cursor:pointer;box-shadow:2px 2px 0 #0d0a14}button:hover{border-color:var(--gold)}button.pri{background:var(--gold);color:#17101f;border-color:#0d0a14;font-weight:700}
.chips{display:flex;flex-wrap:wrap;gap:6px;padding:10px 16px}.chip{padding:3px 10px;border-radius:999px;border:2px solid var(--line);background:#241a35;cursor:pointer}.chip.on{background:var(--gold);color:#17101f;border-color:#0d0a14;font-weight:700}
main{display:grid;grid-template-columns:minmax(300px,1.1fr) minmax(320px,1fr);gap:14px;padding:0 16px 24px}@media(max-width:900px){main{grid-template-columns:1fr}}
.list{background:var(--card);border:2px solid #0d0a14;border-radius:12px;overflow:hidden;max-height:calc(100vh - 150px);overflow-y:auto}
.row{padding:9px 12px;border-bottom:1px solid var(--line);cursor:pointer;display:grid;grid-template-columns:auto 1fr auto;gap:4px 10px}.row:hover,.row.sel{background:#2a1f3d}
.tag{font-size:11px;font-weight:800;padding:1px 7px;border-radius:6px;border:1px solid #0d0a14;color:#17101f;white-space:nowrap}
.t-bug{background:#ff7b7b}.t-feedback{background:#7bc7ff}.t-idea{background:var(--gold)}.t-praise{background:#ff9bd0}
.s-new{color:var(--pink);font-weight:800}.s-triaged{color:var(--gold)}.s-fixed{color:var(--ok)}.s-wontfix,.s-dup{color:var(--dim)}
.msg{color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.meta{color:var(--dim);font-size:12px;grid-column:2/4}
.detail{background:var(--card);border:2px solid #0d0a14;border-radius:12px;padding:14px;max-height:calc(100vh - 150px);overflow-y:auto}
.detail h2{margin:0 0 6px;font-size:16px;color:var(--gold)}.body{white-space:pre-wrap;word-break:break-word;background:#120d1c;border:1px solid var(--line);border-radius:8px;padding:10px;margin:8px 0}
table.d{width:100%;border-collapse:collapse;font-size:12px}table.d td{padding:3px 6px;border-bottom:1px solid var(--line);vertical-align:top}table.d td:first-child{color:var(--dim);white-space:nowrap}
.act{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}img.shot{max-width:100%;border:2px solid #0d0a14;border-radius:8px;margin-top:8px}
#gate{max-width:420px;margin:12vh auto;background:var(--card);border:3px solid #0d0a14;border-radius:14px;padding:22px;box-shadow:8px 8px 0 #7d2352}#gate input{width:100%;margin:10px 0}
.err{color:var(--bad);min-height:1.4em}.note{width:100%}.count{color:var(--dim);font-size:12px}
</style></head><body>
<div id="gate"><h1>Mojiworld Feedback</h1><div class="count">Enter the admin key (the FEEDBACK_ADMIN_KEY secret). It stays in this tab only.</div>
<input id="key" type="password" placeholder="admin key" autocomplete="off"><button class="pri" id="go">Open</button><div class="err" id="gerr"></div></div>
<div id="app" hidden>
<header><h1>🐞 Mojiworld Feedback</h1><span class="count" id="tot"></span><span class="sp"></span>
<input id="q" placeholder="search text, version, map…" size="26"><button id="refresh">↻ Refresh</button><button id="csv">⬇ CSV</button><button id="json">⬇ JSON</button><button id="tmail" title="Sends one clearly labelled test email to the report mailbox. Stores nothing.">✉ Test email</button><button id="lock">Lock</button></header>
<div class="chips" id="chips"></div>
<main><div class="list" id="list"></div><div class="detail" id="detail"><div class="count">Pick a report.</div></div></main></div>
<script>
(function(){
var BASE=location.origin,$=function(i){return document.getElementById(i)},K='mojiworld_fb_key',items=[],counts={},sel=null,fType='',fStatus='new';
var TYPES=['','bug','feedback','idea','praise'],STATUS=['','new','triaged','fixed','wontfix','dup'];
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function hdr(){return{authorization:'Bearer '+sessionStorage.getItem(K)}}
function api(p,o){o=o||{};o.headers=Object.assign({'content-type':'application/json'},hdr(),o.headers||{});return fetch(BASE+p,o)}
function ago(t){var s=(Date.now()-t)/1000;return s<90?'just now':s<5400?Math.round(s/60)+' min ago':s<172800?Math.round(s/3600)+' h ago':Math.round(s/86400)+' d ago'}
function chips(){var c=$('chips');c.textContent='';[['type',TYPES,fType],['status',STATUS,fStatus]].forEach(function(g){g[1].forEach(function(v){
 var n=v?(g[0]==='type'?counts.byType:counts.byStatus)||{}:null,e=el('span','chip'+(g[2]===v?' on':''),(v||'all '+g[0])+(v&&n&&n[v]?' · '+n[v]:''));
 e.onclick=function(){if(g[0]==='type')fType=v;else fStatus=v;load()};c.appendChild(e)});c.appendChild(el('span','sp'))})}
function load(){var u='/api/feedback/list?limit=300'+(fType?'&type='+fType:'')+(fStatus?'&status='+fStatus:'')+($('q').value?'&q='+encodeURIComponent($('q').value):'');
 api(u).then(function(r){if(r.status===401||r.status===503){return r.json().then(function(j){lock(j.error||'unauthorized')})}return r.json().then(function(j){
  items=j.items||[];counts=j.counts||{};$('tot').textContent=(counts.total||0)+' reports · '+(counts.byStatus&&counts.byStatus['new']||0)+' new';chips();draw();$('gate').hidden=true;$('app').hidden=false})}).catch(function(e){$('gerr').textContent='Network error'})}
function draw(){var L=$('list');L.textContent='';if(!items.length)L.appendChild(el('div','count','Nothing here.'));items.forEach(function(r){
 var row=el('div','row'+(sel&&sel.id===r.id?' sel':'')),t=el('span','tag t-'+r.type,r.type);row.appendChild(t);row.appendChild(el('div','msg',r.msg));row.appendChild(el('span','s-'+r.status,r.status));
 var d=r.diag||{};row.appendChild(el('div','meta',[ago(r.t),r.ver,d.map,d.cls&&('Lv'+(d.level||'?')+' '+d.cls),d.platform,r.hasShot?'📷':'',r.mail?(r.mail.ok?'✉ sent':'✉ NOT SENT'):''].filter(Boolean).join(' · ')));
 row.onclick=function(){sel=r;draw();show(r)};L.appendChild(row)})}
function md(r){var d=r.diag||{};return '**'+r.type.toUpperCase()+'** ('+r.ver+')\n\n'+r.msg+'\n\n- id: '+r.id+'\n- map/level/class: '+[d.map,d.level,d.cls].join(' / ')+'\n- platform: '+(d.platform||'?')+'\n- errors: '+((d.errors||[]).join(' | ')||'none')}
function show(r){var D=$('detail');D.textContent='';D.appendChild(el('h2',null,r.type+' · '+r.id));D.appendChild(el('div','count',new Date(r.t).toLocaleString()+' · '+ago(r.t)+(r.contact?' · contact: '+r.contact:'')));
 D.appendChild(el('div','body',r.msg));D.appendChild(el('div','count',r.mail?(r.mail.ok?'✉ Emailed via '+r.mail.via+' · '+ago(r.mail.at):'⚠ Email NOT sent ('+(r.mail.via||'?')+'): '+(r.mail.error||'unknown')):'✉ no email record'));
 var a=el('div','act'),sel2=el('select');STATUS.slice(1).forEach(function(s){var o=el('option',null,s);o.value=s;if(s===r.status)o.selected=true;sel2.appendChild(o)});
 sel2.onchange=function(){upd(r,{status:sel2.value})};a.appendChild(sel2);
 var mb=el('button',null,r.mail&&r.mail.ok?'Email again':'Send email now');mb.onclick=function(){mb.textContent='Sending…';api('/api/feedback/resend',{method:'POST',body:JSON.stringify({id:r.id})}).then(function(x){return x.json()}).then(function(j){if(j.item)Object.assign(r,j.item);load();show(r)})};a.appendChild(mb);
 var cp=el('button',null,'Copy as GitHub issue');cp.onclick=function(){navigator.clipboard.writeText(md(r)).then(function(){cp.textContent='Copied ✓'})};a.appendChild(cp);
 var del=el('button',null,'Delete');del.onclick=function(){if(confirm('Delete this report?'))api('/api/feedback/delete',{method:'POST',body:JSON.stringify({id:r.id})}).then(function(){sel=null;D.textContent='';load()})};a.appendChild(del);D.appendChild(a);
 var n=el('input','note');n.placeholder='internal note (saved on blur)';n.value=r.note||'';n.onblur=function(){if(n.value!==(r.note||''))upd(r,{note:n.value})};D.appendChild(n);
 var t=el('table','d'),d=r.diag||{};Object.keys(d).forEach(function(k){var tr=el('tr');tr.appendChild(el('td',null,k));tr.appendChild(el('td',null,Array.isArray(d[k])?d[k].join('\n'):String(d[k])));t.appendChild(tr)});D.appendChild(t);
 if(r.hasShot){api('/api/feedback/shot?id='+r.id).then(function(x){return x.blob()}).then(function(b){var i=el('img','shot');i.src=URL.createObjectURL(b);D.appendChild(i)})}}
function upd(r,p){p.id=r.id;api('/api/feedback/update',{method:'POST',body:JSON.stringify(p)}).then(function(x){return x.json()}).then(function(j){if(j.ok){Object.assign(r,j.item);load()}})}
function lock(m){sessionStorage.removeItem(K);$('app').hidden=true;$('gate').hidden=false;$('gerr').textContent=m||''}
function dl(name,type,text){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:type}));a.download=name;a.click()}
$('go').onclick=function(){sessionStorage.setItem(K,$('key').value.trim());$('gerr').textContent='';load()};$('key').onkeydown=function(e){if(e.key==='Enter')$('go').click()};
$('refresh').onclick=load;$('lock').onclick=function(){lock('')};$('q').onkeydown=function(e){if(e.key==='Enter')load()};
$('csv').onclick=function(){api('/api/feedback/list?format=csv'+(fType?'&type='+fType:'')+(fStatus?'&status='+fStatus:'')).then(function(r){return r.text()}).then(function(t){dl('mojiworld-feedback.csv','text/csv',t)})};
$('json').onclick=function(){dl('mojiworld-feedback.json','application/json',JSON.stringify(items,null,2))};
$('tmail').onclick=function(){var b=$('tmail');b.textContent='Sending…';api('/api/feedback/testmail',{method:'POST',body:'{}'}).then(function(r){return r.json()}).then(function(j){b.textContent=j.ok?'✉ Sent via '+j.via+' to '+(j.to||'the mailbox')+' ✓ check the inbox':'✉ FAILED: '+(j.error||'unknown')}).catch(function(){b.textContent='✉ FAILED: network'})};
if(sessionStorage.getItem(K))load();setInterval(function(){if(!$('app').hidden)load()},60000);
})();
</script></body></html>`;
