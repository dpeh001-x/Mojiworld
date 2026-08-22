// Live test: the Magic Bolt's contact ENERGY BURST.
// Per user: "after it comes into contact with a monster have an animation
// where the magic bolt does an energy burst".
//   node scripts/bolt_impact_fx_test.mjs [port]   (MOJI_GAME_FILE honored)
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const GAME = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';

// ---- the art ships ---------------------------------------------------------
const frames = [];
for (let i = 0; i < 8; i++) frames.push(`Sprites/fx/anim/bolt_impact_${i}.webp`);
ok('the still burst sprite ships', existsSync('Sprites/fx/bolt_impact.webp'), '');
ok('all 8 burst frames ship', frames.every(existsSync), frames.filter(f => !existsSync(f)));
{
  const idx = readFileSync('data/sprite_frame_index.js', 'utf8');
  ok('the frame index records the set (so the loader asks for exactly 8)', /"bolt_impact":\s*8/.test(idx), '');
}

const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext()).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
const bad = []; page.on('response', r => { if (r.status() >= 400 && /bolt_impact/.test(r.url())) bad.push(r.status() + ' ' + r.url().split('/').pop()); });
await page.goto(`http://localhost:${PORT}/${GAME}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof updateProjectiles === 'function' && typeof _FX_ANIM_KEYS !== 'undefined', null, { timeout: 120000 });
await page.waitForLoadState('load', { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(2000);

const r = await page.evaluate(async () => {
  const out = {};
  game.paused = false;
  const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
  out.registered = _FX_ANIM_KEYS.has('bolt_impact');
  out.spriteKnown = !!(LX_FX && LX_FX.bolt_impact);
  // the frame set decodes (async images — poll)
  const fr = (typeof _fxAnimFrames === 'function') ? _fxAnimFrames('bolt_impact') : null;
  out.frameCount = fr ? fr.length : 0;
  const t0 = Date.now();
  while (fr && Date.now() - t0 < 12000 && !fr.every(im => im && im.complete)) await new Promise(z => setTimeout(z, 200));
  out.decoded = fr ? fr.filter(im => im && im.complete && im.naturalWidth > 0).length : 0;

  player.cls = 'mage'; player.level = 30; player.x = 400; player.y = 300;
  const mk = () => { const m = { x: player.x + 60, y: player.y, w: 40, h: 40, hp: 1e9, maxHp: 1e9, currentHp: 1e9,
    def: 0, type: 'slime', level: 1, speed: 0, facing: 1, vx: 0, vy: 0, _noGravity: true, name: 'dummy' };
    game.monsters.length = 0; game.monsters.push(m); return m; };
  const shoot = (skill, alwaysCrit) => {
    game.projectiles.length = 0;
    const before = (game.smoothFx || []).filter(f => f && f.spriteKey === 'bolt_impact').length;
    game.projectiles.push({ x: player.x + 40, y: player.y + 10, vx: 6, vy: 0, w: 20, h: 12, life: 60,
      damage: 50, owner: 'player', skill, alwaysCrit: !!alwaysCrit, _noGravity: true, noGravity: true });
    for (let f = 0; f < 20 && game.projectiles.length; f++) updateProjectiles(16);
    const fx = (game.smoothFx || []).filter(f => f && f.spriteKey === 'bolt_impact');
    return { spawned: fx.length - before, last: fx[fx.length - 1] || null };
  };
  mk(); const boltHit = shoot('bolt', false);
  out.bolt = { spawned: boltHit.spawned, size: boltHit.last && Math.round(boltHit.last.size) };
  mk(); const critHit = shoot('bolt', true);
  out.crit = { spawned: critHit.spawned, size: critHit.last && Math.round(critHit.last.size) };
  mk(); const arrowHit = shoot('arrow', false);
  out.arrow = { spawned: arrowHit.spawned };
  game.monsters.length = 0; game.projectiles.length = 0;
  return out;
});
ok('the key is registered as an ANIMATED fx (not a lone still)', r.registered === true && r.spriteKnown === true, r);
ok('the loader asks for 8 frames and they decode', r.frameCount === 8 && r.decoded === 8, { want: 8, frames: r.frameCount, decoded: r.decoded });
ok('a bolt hitting a monster spawns the burst', r.bolt.spawned === 1, r.bolt);
ok('a CRIT blooms wider than a normal hit', r.crit.size > r.bolt.size, { crit: r.crit.size, normal: r.bolt.size });
ok('an arrow hit spawns NO bolt burst (bolt-only, per the tag guard)', r.arrow.spawned === 0, r.arrow);
ok('no 404s on the burst art', bad.length === 0, bad.slice(0, 4));
ok('no page errors', errs.length === 0, errs.slice(0, 3));
for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
