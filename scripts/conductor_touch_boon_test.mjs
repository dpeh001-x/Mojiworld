// Live test: THE MASTER CONDUCTOR GRANTS NO BOON, AND HIS TOUCH COSTS AT
// LEAST 30% OF THE PLAYER'S MAX HP.
//
// Per user: "Train conductor boss should not drop any boons, make his touch
// damage higher damage, at least 30% of player's max HP."
//
// Both halves are driven through the REAL paths: the boon check kills him via
// killMonster with showPowerupChoice stubbed to observe (and a control boss to
// prove the stub itself fires), the touch check overlaps the player with a
// live Conductor and steps updateMonsters on the driven clock.
//   node scripts/conductor_touch_boon_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net_ from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8781; p <= 8899 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof spawnMonster === 'function' && typeof killMonster === 'function'
  && typeof updateMonsters === 'function', null, { timeout: 120000 });
await page.waitForTimeout(2500);

const r = await page.evaluate(async () => {
  if (typeof _lxIsSanctuary === 'function') { try { window._lxIsSanctuary = () => false; } catch (e) {} }
  if (!game.camera) game.camera = { x: 0, y: 0 };
  const out = {};

  // ---- boon: kill through the real path, observe the wheel ----
  const realChoice = window.showPowerupChoice;
  const calls = [];
  window.showPowerupChoice = (info) => { calls.push(String((info && info.type) || 'x')); };
  const killBoss = (type) => new Promise((res) => {
    game.monsters = [];
    spawnMonster(500, 300, type, true);
    const m = game.monsters[0];
    if (!m) return res('spawn refused');
    m.currentHp = 0; m.hp = 0;
    try { killMonster(m); } catch (e) { return res('kill err ' + String(e).slice(0, 60)); }
    setTimeout(() => res('done'), 1900);   // the wheel fires on a 1500ms timer
  });
  player.hp = Math.max(1, player.hp);
  out.conductorKill = await killBoss('pqConductor');
  out.callsAfterConductor = calls.length;
  out.controlKill = await killBoss('zodiac_leo');
  out.callsAfterControl = calls.length;
  window.showPowerupChoice = realChoice;

  // ---- touch: overlap a live Conductor, step the driven clock ----
  const touch = (type) => {
    game.monsters = [];
    spawnMonster(500, 300, type, true);
    const m = game.monsters[0];
    if (!m) return { err: 'spawn refused' };
    const maxHp = (typeof getMaxHp === 'function') ? getMaxHp() : (player.maxHp || 100);
    player.hp = maxHp;
    player.invulnerable = 0; player.dodgeIframes = 0; player._god = false;
    player.blockTimer = 0; player.hitStun = 0;
    player.x = m.x + m.w / 2 - player.w / 2;   // dead centre overlap
    player.y = m.y + m.h - player.h;
    let lost = 0, frames = 0;
    for (let f = 0; f < 240 && lost <= 0; f++) {
      game.time++;
      player.invulnerable = 0; player.dodgeIframes = 0;   // one clean hit is the sample
      player.x = m.x + m.w / 2 - player.w / 2;            // stay on him despite knockback
      player.y = m.y + m.h - player.h;
      try { updateMonsters(16); } catch (e) { return { err: String(e).slice(0, 80) }; }
      lost = maxHp - player.hp;
      frames = f;
    }
    game.monsters = [];
    return { lost, maxHp, pct: +((lost / maxHp) * 100).toFixed(1), frames };
  };
  out.conductorTouch = touch('pqConductor');
  player.hp = 99999; out.hpRestore = true;
  out.mobTouch = touch('sandhusk');
  player.hp = (typeof getMaxHp === 'function') ? getMaxHp() : 100;
  game.monsters = [];
  return out;
});
await b.close(); srv.kill();

ok('killing the Conductor opens NO boon wheel',
  r.conductorKill === 'done' && r.callsAfterConductor === 0,
  { kill: r.conductorKill, wheelCalls: r.callsAfterConductor });
ok('...while a control boss still opens it - the stub itself works',
  r.controlKill === 'done' && r.callsAfterControl === 1,
  { kill: r.controlKill, wheelCalls: r.callsAfterControl,
    note: 'without this control, a broken stub would pass the first check for free' });
ok("the Conductor's touch costs at least 30% of max HP",
  r.conductorTouch.lost > 0 && r.conductorTouch.pct >= 30,
  r.conductorTouch);
ok('an ordinary mob is nowhere near the floor - the floor is his, not global',
  r.mobTouch.lost > 0 && r.mobTouch.pct < 30,
  r.mobTouch);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
process.exit(results.every(q => q.pass) ? 0 : 1);
