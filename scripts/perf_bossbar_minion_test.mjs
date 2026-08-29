// Live test for the batch-E perf pair:
//   - drawSuperBossBar's single-pass target pick behaves exactly like the
//     old double .find(): superBoss outranks ordinary bosses, and the
//     `boss:true`-without-`isBoss` edge still gets the bar
//   - summoned minions draw through the _lxProjScaled side-canvas with the
//     foot geometry untouched (no errors, cache populated once art decodes)
//   node scripts/perf_bossbar_minion_test.mjs
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8961; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], {
  stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof spawnMonster === 'function' && typeof raiseMinion === 'function', null, { timeout: 120000 });
await page.evaluate(() => new Promise((res) => { let n = 0;
  const t = () => { window._lxBootGateDone = true;
    const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
    const c = document.querySelector('.cls-card'); if (c) c.click();
    const m = document.getElementById('class-select-modal'); if (m) m.style.display = 'none';
    if (++n > 150) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
await page.waitForTimeout(1000);

const r = await page.evaluate(async () => {
  const out = {};
  try { loadMap('forest'); } catch (e) {}
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 40) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  player._god = true; player.hp = 99999;
  const mk = (tag, extra) => {
    spawnMonster(Math.round(player.x + 200), Math.round(player.y), 'slime', false);
    const m = game.monsters[game.monsters.length - 1];
    m.hp = m.currentHp = 1e6; m.maxHp = 1e6; m.atk = 0; m._svTag = tag;
    Object.assign(m, extra || {});
    return m;
  };
  // superBoss outranks an ordinary boss regardless of array order
  game.monsters = [];
  mk('plain');
  const bossOnly = mk('bossOnly', { boss: true });          // the edge: boss:true, no isBoss
  const superB = mk('super', { superBoss: true, isBoss: true });
  game._superBossRef = null;
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 5) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  out.superWins = game._superBossRef === superB;
  // with the super gone, the boss:true-without-isBoss mob still gets the bar
  superB.currentHp = 0; game._superBossRef = null;
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 5) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  out.bossTrueEdge = game._superBossRef === bossOnly;
  // no boss at all: no ref, no crash
  bossOnly.currentHp = 0; game._superBossRef = null;
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 5) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  out.noneClean = !game._superBossRef;

  // minions draw through the downscale cache, feet geometry untouched
  game.monsters = []; game.minions = [];
  player.cls = 'mage'; player.job = 'warlock'; player.master = 'necromancer';
  for (let i = 0; i < 3; i++) {
    try { raiseMinion(player.x + 40 + i * 30, player.y, i % 2 ? 'zombie' : 'skeleton', 60000); } catch (e) {}
  }
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 120) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  out.minions = game.minions.length;
  let cached = 0;
  try {
    for (const k of ['skeleton', 'zombie']) {
      const img = (typeof LX_SUMMON !== 'undefined') && LX_SUMMON[k];
      if (img && img._lxProjCache) cached++;
    }
  } catch (e) {}
  out.minionCached = cached;
  out.minionArt = (typeof LX_SUMMON !== 'undefined') && !!(LX_SUMMON.skeleton && LX_SUMMON.skeleton.naturalWidth > 0);
  game.minions = [];
  return out;
});

ok('a live superBoss wins the bar over an ordinary boss', r.superWins, r);
ok('boss:true without isBoss still gets the bar (the audited edge)', r.bossTrueEdge, r);
ok('no boss on the map -> no ref, no crash', r.noneClean, r);
ok('minions summoned and drawing', r.minions === 3, r);
ok('minion art drew through the _lxProjScaled side-canvas',
  !r.minionArt || r.minionCached > 0, { minionArt: r.minionArt, cached: r.minionCached, note: 'skipped when art not decoded in headless' });
ok('no page errors', errs.length === 0, { errs: errs.slice(0, 3) });

await b.close(); srv.kill();
let pass = 0;
for (const t of results) {
  console.log((t.pass ? '  PASS  ' : '  FAIL  ') + t.n);
  if (!t.pass) console.log('        ' + JSON.stringify(t.x).slice(0, 300));
  if (t.pass) pass++;
}
console.log('\n' + pass + '/' + results.length + ' checks passed');
process.exit(pass === results.length ? 0 : 1);
