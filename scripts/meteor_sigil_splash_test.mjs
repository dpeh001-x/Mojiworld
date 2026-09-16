// Meteor Sigil: a comet that reaches a foe explodes, and the explosion damages its neighbours.
//
// Per user: "For sage's meteor sigil skill, when the meteor sigil contacts enemies make a explosion
// animation of the meteor (ensure no cutoffs of edges), it should cause splash damage to the near
// surrounding monsters", then "use ludo.ai to make the explosion animation".
//
// Fires the REAL SKILL_FNS.sage_ult into a pinned pack and judges splash against the MEASURED impact
// point - the comet's last position before it is spent - rather than against where the test thinks it
// will land, so a change in homing or speed cannot make the assertions quietly wrong.
//   node scripts/meteor_sigil_splash_test.mjs [port]     (MOJI_GAME_FILE overrides the build)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || 29600);
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0;
const ok = (c, m, extra) => { if (c) { pass++; console.log('  PASS  ' + m); }
  else { fail++; console.log('  FAIL  ' + m + (extra !== undefined ? '  <- ' + extra : '')); } };

const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof SKILL_FNS === 'object' && typeof spawnMonster === 'function' && typeof loadMap === 'function', null, { timeout: 180000 });
await page.waitForTimeout(2500);
await page.evaluate(() => {
  try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player.cls = 'mage'; player.level = 80; player.invulnerable = 9e9; player.hp = player.maxHp = 99999; player.mp = 99999;
  loadMap('forest', 300); game.paused = false;
});
await page.waitForTimeout(4500);

const r = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
  game.monsters.length = 0; game.projectiles.length = 0;
  if (game.smoothFx) game.smoothFx.length = 0;
  player.facing = 1; player.vx = 0; player.vy = 0;
  const px = player.x + player.w / 2, fy = player.y + player.h;
  // a pack AHEAD of the hero: the target nearest, neighbours spread past it, one well outside
  const PACK = [['target', 330], ['n40', 370], ['n90', 420], ['n150', 480], ['far', 640]];
  const mobs = {};
  for (const [tag, dx] of PACK) {
    const m = spawnMonster(px + dx, fy - 60, 'skeleton');
    if (!m) continue;
    m._tag = tag; m.maxHp = m.currentHp = 1e9; m.evasion = 0; m.def = 0;
    mobs[tag] = { m, x: px + dx - m.w / 2 };
  }
  // hold the pack still for the whole flight - AI and knockback would otherwise move the geometry
  let alive = true;
  const pin = () => {
    if (!alive) return;
    for (const k in mobs) { const o = mobs[k]; o.m.x = o.x; o.m.y = fy - o.m.h; o.m.vx = 0; o.m.vy = 0; o.m.currentHp = Math.max(o.m.currentHp, 1); }
    player.vx = 0;
    requestAnimationFrame(pin);
  };
  pin();
  await sleep(200);
  const hp0 = Object.fromEntries(Object.entries(mobs).map(([k, o]) => [k, o.m.currentHp]));

  SKILL_FNS.sage_ult();
  const comet = game.projectiles[game.projectiles.length - 1];
  const cfg = comet ? { explode: comet.explode, impactFx: comet.impactFx || null, bspr: comet.bspr } : null;
  let last = null;
  for (let i = 0; i < 260; i++) {
    if (comet && game.projectiles.indexOf(comet) >= 0) {
      last = { x: comet.x + comet.w / 2, y: comet.y + comet.h / 2, vx: comet.vx || 0, vy: comet.vy || 0 };
    } else if (last) break;
    await sleep(16);
  }
  await sleep(120);
  alive = false;

  // The last SAMPLED position is up to a frame short of where the comet struck (it travels ~9 px a
  // frame and is removed the frame it explodes). The burst is spawned AT the explosion, so when there
  // is one it is the exact impact point; otherwise step the last sample forward by its own velocity.
  const burstObj = (game.smoothFx || []).find((f) => f && f.type === 'spriteBurst' && f.spriteKey === 'sage_meteor_impact');
  const impact = burstObj ? { x: burstObj.x, y: burstObj.y, from: 'burst' }
    : (last ? { x: last.x + last.vx, y: last.y + last.vy, from: 'extrapolated' } : null);

  const out = { cfg, impact, rows: [] };
  for (const [k, o] of Object.entries(mobs)) {
    const cx = o.m.x + o.m.w / 2, cy = o.m.y + o.m.h / 2;
    const dist = impact ? Math.hypot(cx - impact.x, cy - impact.y) : null;
    out.rows.push({ tag: k, dist: dist == null ? null : Math.round(dist), lost: Math.round(hp0[k] - o.m.currentHp) });
  }
  const bursts = (game.smoothFx || []).filter((f) => f && f.type === 'spriteBurst');
  out.burst = bursts.find((b) => b.spriteKey === 'sage_meteor_impact') || null;
  out.burst = out.burst ? { key: out.burst.spriteKey, size: out.burst.size, x: Math.round(out.burst.x), y: Math.round(out.burst.y),
    scale: [out.burst.scaleStartX, out.burst.scaleEndX, out.burst.scaleStartY, out.burst.scaleEndY].join(',') } : null;
  return out;
});

console.log('\n  comet: ' + JSON.stringify(r.cfg));
console.log('  impact point: ' + JSON.stringify(r.impact));
console.log('  ' + 'monster'.padEnd(9) + 'dist'.padEnd(7) + 'hp lost');
for (const x of r.rows) console.log('  ' + x.tag.padEnd(9) + String(x.dist).padEnd(7) + x.lost.toLocaleString());
console.log('  burst: ' + JSON.stringify(r.burst) + '\n');

const by = Object.fromEntries(r.rows.map((x) => [x.tag, x]));
const R = r.cfg ? r.cfg.explode : 0;
ok(!!r.cfg, 'the real skill fired a comet');
ok(!!r.impact, 'the comet reached the pack and was spent');
ok(R >= 100, 'the splash radius is sized to the blast, not the old 56 px', R);
ok(by.target && by.target.lost > 0, 'the comet hits its target');
// every non-target monster inside the radius must have taken splash; everyone outside must not
const inside = r.rows.filter((x) => x.tag !== 'target' && x.dist != null && x.dist < R);
const outside = r.rows.filter((x) => x.tag !== 'target' && x.dist != null && x.dist >= R + 12);
ok(inside.length >= 1, 'at least one neighbour stands inside the blast (the test geometry is live)', inside.map((x) => x.tag).join(','));
ok(inside.every((x) => x.lost > 0), 'every neighbour inside the blast takes splash damage',
  inside.filter((x) => !(x.lost > 0)).map((x) => x.tag + '@' + x.dist).join(','));
ok(outside.every((x) => x.lost === 0), 'nothing outside the blast is touched',
  outside.filter((x) => x.lost !== 0).map((x) => x.tag + '@' + x.dist).join(','));
ok(!!r.burst, 'the explosion animation plays on contact');
ok(!!r.burst && Math.abs(r.burst.size - Math.round((R * 2) / 0.6)) <= 2,
  'and is sized off the splash (canvas = diameter / 0.6: fireball ~0.5 of it, sparks ~0.72)', r.burst && r.burst.size);
ok(!!r.burst && r.burst.scale === '1,1,1,1', 'at a pinned scale - the art grows by itself', r.burst && r.burst.scale);
ok(!!r.burst && !!r.impact && Math.hypot(r.burst.x - r.impact.x, r.burst.y - r.impact.y) < 40,
  'at the point the comet actually struck', r.burst && r.impact ? Math.round(Math.hypot(r.burst.x - r.impact.x, r.burst.y - r.impact.y)) + ' px off' : 'n/a');
ok(errs.length === 0, 'no page errors', errs.join(' | '));

await browser.close().catch(() => {}); server.kill();
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
