const fs=require('fs'),os=require('os'),p=require('path'),cp=require('child_process');
const h=fs.readFileSync('mojiworld_game.html','utf8');
const m=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)];
const big=m.map(x=>x[1]).sort((a,b)=>b.length-a.length)[0];
const f=p.join(os.tmpdir(),'_lx_check.js');
fs.writeFileSync(f,big);
try{ cp.execSync('node --check "'+f+'"'); console.log('SYNTAX OK',big.length,'chars'); }
catch(e){ console.log('SYNTAX FAIL'); process.stdout.write((e.stdout||'')+''); process.stdout.write((e.stderr||'')+''); process.exit(1); }
