// A monster is drawn at roughly its own hitbox, whatever resolution its art was authored at.
//
// Per user, with a screenshot of the Ossuary Tyrant filling the screen: "there is a bug the ossuary
// tyrant is blown up to such huge proportion in game", then "blight elder should not be so big as
// well".
//
// THE MECHANISM, because it will happen again to the next high-res redraw: the mob draw computes
//     targetH = m.h * 1.5 * clamp(0.85, 1.20, sourceLongEdge / 768) * _lxMobScale(type)
// so a sprite authored at 1800px pins that clamp at its 1.20 ceiling and is drawn 1.8x its hitbox
// unless _lxMobScale pulls it back. Art RESOLUTION silently becomes in-world SIZE. The Ossuary
// Tyrant (1800x1500) and the Blight Elder (1500x1200) both sat at the ceiling with scales that did
// not compensate - measured 1.59x and 1.41x their own boxes, where every peer sits at 1.05-1.18x.
//
// This pins the ratio, not the scale number, so re-authoring the art at a different size is free as
// long as the drawn size still tracks the hitbox.
//   node scripts/elite_draw_scale_test.mjs [port]     (MOJI_GAME_FILE overrides the build)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || 29530);
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
await page.waitForFunction(() => typeof spawnMonster === 'function' && typeof loadMap === 'function', null, { timeout: 180000 });
await page.waitForTimeout(2500);
await page.evaluate(() => {
  try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player.cls = 'warrior'; player.level = 80; player.invulnerable = 9e9; player.hp = player.maxHp = 99999;
  loadMap('forest', 300); game.paused = false;
});
await page.waitForTimeout(5000);

const TYPES = ['ossuaryTyrant', 'blightElder', 'echoKnight', 'shardlich', 'tombKeeper', 'skeleton'];
const r = await page.evaluate(async (TYPES) => {
  const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
  const out = { player: player.h, rows: [] };
  for (const t of TYPES) {
    game.monsters.length = 0;
    let m = null; try { m = spawnMonster(700, 400, t); } catch (e) {}
    if (!m) { out.rows.push({ t, err: 'no spawn' }); continue; }
    for (let i = 0; i < 14; i++) await sleep(40);
    out.rows.push({ t, box: Math.round(m.h), vis: m._visH ? Math.round(m._visH) : null });
  }
  game.monsters.length = 0;
  return out;
}, TYPES);

console.log('\n  type'.padEnd(20) + 'box'.padEnd(7) + 'drawn'.padEnd(8) + 'drawn/box'.padEnd(12) + 'vs hero');
for (const x of r.rows) {
  if (x.err || !x.vis) { console.log('  ' + x.t.padEnd(16) + (x.err || 'not stamped')); continue; }
  console.log('  ' + x.t.padEnd(18) + String(x.box).padEnd(7) + String(x.vis).padEnd(8) +
    (x.vis / x.box).toFixed(2).padEnd(12) + (x.vis / r.player).toFixed(1) + 'x');
}
console.log('');

const by = Object.fromEntries(r.rows.filter((x) => x.vis).map((x) => [x.t, x]));
ok(r.rows.every((x) => x.vis), 'every sampled type reported a drawn size',
  r.rows.filter((x) => !x.vis).map((x) => x.t).join(','));

// The house band, measured across ordinary mobs and elites: 1.05 - 1.18. Allow a little either side.
const BAND = [0.95, 1.25];
for (const t of ['ossuaryTyrant', 'blightElder']) {
  const x = by[t]; if (!x) continue;
  const ratio = x.vis / x.box;
  ok(ratio <= BAND[1], `${t} is drawn no more than ${BAND[1]}x its hitbox`, ratio.toFixed(2) + 'x');
  ok(ratio >= BAND[0], `${t} was not over-shrunk below its hitbox`, ratio.toFixed(2) + 'x');
}
// every other sampled type should already sit in the band - if one drifts out, the same bug is back
for (const t of ['echoKnight', 'shardlich', 'tombKeeper', 'skeleton']) {
  const x = by[t]; if (!x) continue;
  const ratio = x.vis / x.box;
  ok(ratio >= BAND[0] && ratio <= BAND[1], `${t} sits in the house band`, ratio.toFixed(2) + 'x');
}
// and the elites must still READ as elites: bigger than the largest ordinary one sampled
if (by.ossuaryTyrant && by.echoKnight) {
  ok(by.ossuaryTyrant.vis > by.echoKnight.vis * 1.2,
    'the Ossuary Tyrant still towers over an ordinary elite',
    by.ossuaryTyrant.vis + ' vs ' + by.echoKnight.vis);
}
ok(errs.length === 0, 'no page errors', errs.join(' | '));

await browser.close().catch(() => {}); server.kill();
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
