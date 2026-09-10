// The class dash sprites are gone, and the dash's procedural FX stay inside a fixed budget.
// Per user: "remove all the class dash sprites" / "add more effects to dashing without
// increasing lag".
//
//   node scripts/dash_fx_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11219);
const checks = [];
const CLASS_DASH = /^dash_(warrior|mage|archer|rogue)(_\d+)?\.webp$/;

// ---- on disk and in the data tables -------------------------------------------
const onDisk = [];
for (const d of ['Sprites/fx', 'Sprites/fx/anim']) {
  const full = path.join(ROOT, d);
  if (existsSync(full)) for (const f of readdirSync(full)) if (CLASS_DASH.test(f)) onDisk.push(d + '/' + f);
}
checks.push(['no class dash sprite is left on disk', onDisk.length === 0, onDisk.slice(0, 4).join(', ')]);
const idx = readFileSync(path.join(ROOT, 'data', 'sprite_frame_index.js'), 'utf8');
checks.push(['the frame index no longer lists the four dash loops', !/"dash_(warrior|mage|archer|rogue)"/.test(idx)]);
const man = readFileSync(path.join(ROOT, 'data', 'assets_manifest.json'), 'utf8');
checks.push(['the cache-warm manifest no longer lists them (no wasted 404s)', !/dash_(warrior|mage|archer|rogue)/.test(man)]);
const html = readFileSync(path.join(ROOT, PAGE), 'utf8');
checks.push(['the game no longer keys, gates or draws them', !/_classDashSpriteReady|LX_FX\.dash_|'dash_' \+ player\.cls|dash_warrior:\s*'dash_warrior\.webp'/.test(html)]);

// ---- in a running game ------------------------------------------------------------
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const dashReq = [], errs = [];
page.on('request', (r) => { if (/dash_(warrior|mage|archer|rogue)/.test(r.url())) dashReq.push(r.url().split('/').pop()); });
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Dash');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const r = await page.evaluate(() => {
  const out = { keys: {}, dashes: {} };
  out.keys.fxKeyed = ['dash_warrior', 'dash_mage', 'dash_archer', 'dash_rogue'].filter((k) => _FX_ANIM_KEYS.has(k));
  out.keys.lxfx = ['dash_warrior', 'dash_mage', 'dash_archer', 'dash_rogue'].filter((k) => typeof LX_FX !== 'undefined' && LX_FX[k]);
  out.keys.gate = typeof _classDashSpriteReady;
  out.keys.draw = typeof drawDashFx === 'function' && typeof spawnDashFx === 'function';
  if (!game.mapData) game.mapData = { worldWidth: 4000 };
  player.x = 800; player.y = 300; player.w = player.w || 40; player.h = player.h || 60;
  const run = (label, fn) => {
    const p0 = game.particles.length;
    game.dashFx = [];
    player.quickDashTimer = 0; player.dodgeTimer = 0; player.dodgeCD = 0;
    try { fn(); } catch (e) { out.dashes[label] = { err: String(e.message) }; return; }
    const fx = game.dashFx.slice();
    // tick the draw pass through a whole life: it must never throw and must drain the list
    let frames = 0; while (game.dashFx.length && frames < 60) { drawDashFx(); frames++; }
    out.dashes[label] = { particles: game.particles.length - p0, fx: fx.length, types: fx.map((f) => f.type).join('+'),
      maxLife: Math.max(0, ...fx.map((f) => f.maxLife)), drained: game.dashFx.length === 0, frames };
  };
  for (const cls of ['warrior', 'archer', 'rogue']) run(cls, () => { player.cls = cls; quickDash(1); });
  run('mage', () => { player.cls = 'mage'; quickDash(-1); });
  run('dodge', () => { player.cls = 'warrior'; startDodge(); });
  // spam: ten dashes back to back must not grow the list past its cap
  game.dashFx = [];
  for (let i = 0; i < 10; i++) { player.cls = 'rogue'; quickDash(i & 1 ? 1 : -1); }
  out.capAfterSpam = game.dashFx.length;
  return out;
});
await browser.close(); server.kill();

for (const [k, d] of Object.entries(r.dashes)) console.log(`  ${k.padEnd(8)} ${d.err ? 'ERROR ' + d.err : `${d.particles} particles, ${d.fx} fx (${d.types}), life<=${d.maxLife}, drained in ${d.frames} frames`}`);
const D = Object.values(r.dashes);
checks.push(['no dash loop key survives in _FX_ANIM_KEYS and no dash sprite in LX_FX', r.keys.fxKeyed.length === 0 && r.keys.lxfx.length === 0, JSON.stringify(r.keys)]);
checks.push(['the sprite gate is gone and the procedural pass exists', r.keys.gate === 'undefined' && r.keys.draw]);
checks.push(['every dash spawns its FX without throwing', D.every((d) => !d.err), D.filter((d) => d.err).map((d) => d.err).join(' | ')]);
checks.push(['every dash gets a ring and streaks', D.every((d) => d.fx >= 2 && /ring/.test(d.types) && /streaks/.test(d.types))]);
checks.push(['the mage blink gets two rings (depart + arrive)', (r.dashes.mage || {}).fx === 3]);
checks.push(['budget: at most 40 new particles per dash (the mage keeps her 28 rune particles)', D.every((d) => d.particles <= 40), D.map((d) => d.particles).join('/')]);
checks.push(['budget: no FX object lives longer than 16 frames', D.every((d) => d.maxLife <= 16)]);
checks.push(['the draw pass drains every object by itself', D.every((d) => d.drained)]);
checks.push(['ten dashes back to back never exceed the cap of 8 live objects', r.capAfterSpam <= 8, String(r.capAfterSpam)]);
checks.push(['the game never requests a class dash sprite', dashReq.length === 0, dashReq.slice(0, 3).join(', ')]);
checks.push(['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')]);

let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
process.exit(fails ? 1 : 0);
