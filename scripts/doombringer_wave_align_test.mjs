// Per user: the doombringer shockwave should sit at the player's vertical
// level, not below them.
//
// p.y is the projectile's TOP edge (draw centres on p.y + p.h/2; the hit test
// spans p.y .. p.y + p.h), so spawning at y: cy — the player's CENTRE — put the
// wave's own centre h/2 too low. This measures the CENTRE-TO-CENTRE offset,
// which is the thing the player actually sees; asserting the y literal would
// pass just as happily with a wrong height.
//   node scripts/doombringer_wave_align_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const net = await import('node:net');
const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext()).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof SKILL_FNS === 'object' && typeof player === 'object', { timeout: 120000 });

const r = await page.evaluate(() => {
  player.cls = 'warrior'; player.job = 'berserker'; player.master = null;
  player.facing = 1;
  game.paused = false;
  player.hp = Math.max(1, player.maxHp || 100);
  player.buffs = player.buffs || {}; player.buffs.bloodlust = 600;
  game.projectiles.length = 0;
  SKILL_FNS.slash();
  const p = game.projectiles.find(q => q && q.skill === 'bloodwave');
  if (!p) return { none: true };
  const playerCy = player.y + player.h / 2;
  const waveCy = p.y + p.h / 2;
  return {
    playerTop: player.y, playerBottom: player.y + player.h, playerH: player.h,
    playerCy, waveTop: p.y, waveBottom: p.y + p.h, waveCy, h: p.h,
    offset: waveCy - playerCy,
  };
});
await b.close(); try { srv.kill(); } catch (e) {}

if (r.none) { console.log('no bloodwave spawned'); process.exit(1); }
console.log(`player  ${r.playerTop.toFixed(0)} .. ${r.playerBottom.toFixed(0)}  centre ${r.playerCy.toFixed(1)} (h ${r.playerH})`);
console.log(`wave    ${r.waveTop.toFixed(0)} .. ${r.waveBottom.toFixed(0)}  centre ${r.waveCy.toFixed(1)} (h ${r.h})`);
console.log(`centre-to-centre offset: ${r.offset.toFixed(1)} px  (was +${(r.h / 2).toFixed(0)} before the fix)`);

ok('the wave is vertically CENTRED on the player (within 2 px)', Math.abs(r.offset) <= 2, { offset: +r.offset.toFixed(1) });
ok('it no longer hangs below the midline by half its height',
   Math.abs(r.offset) < r.h / 4, { offset: +r.offset.toFixed(1), halfHeight: r.h / 2 });
ok('the wave overlaps the player vertically at all',
   r.waveTop < r.playerBottom && r.waveBottom > r.playerTop, { waveTop: r.waveTop, playerBottom: r.playerBottom });
ok('it spans the player\'s body rather than sitting at their feet',
   r.waveTop <= r.playerCy && r.waveBottom >= r.playerCy, { waveTop: r.waveTop, waveBottom: r.waveBottom, playerCy: r.playerCy });
ok('the enlarged height is unchanged (this was a position fix, not a resize)', r.h === 74, { h: r.h });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
