// The quest pin is pinned to the world, not to the player.
// Per user: "The quest red pin should not move to follow my character's Y axis."
//
// The cross-map branch of _qnavHeading aims the pin at the next portal on the
// route. A portal declares {x, dest, name} and its y is OPTIONAL - 26 of the 81
// portals reachable after a map load still carry no y - and for every one of
// those the pin's height WAS `player.y`, so it rode up and down with the
// character. This test finds such a portal and holds the pin still.
// Run: node scripts/quest_pin_anchor_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9192;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });

const out = await page.evaluate(() => {
  const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade');
  player.cls = player.cls || 'warrior'; player.level = 200; player.hp = 9e6; player.maxHp = 9e6;
  game.paused = false;

  // How many portals still have no declared height once a map is live? Every
  // one of them is a pin that used to hang at the player's eye level.
  let noY = 0, total = 0;
  for (const id of Object.keys(MAPS).slice(0, 40)) {
    try { loadMap(id, 300); } catch (e) { continue; }
    for (const p of (game.mapData.portals || [])) { total++; if (!Number.isFinite(p.y)) noY++; }
  }

  // Find a live map whose outgoing portal declares no y, and a destination
  // routed through it.
  let host = null;
  for (const id of Object.keys(MAPS)) {
    try { loadMap(id, 300); } catch (e) { continue; }
    const p = (game.mapData.portals || []).find(q => Number.isFinite(q.x) && !Number.isFinite(q.y));
    if (p) { host = { map: id, portalX: p.x, dest: p.dest }; break; }
  }
  if (!host) return { noY, total, host: null };

  loadMap(host.map, 300);
  game.qnav = true;
  const dest = { map: host.dest, kind: 'hunt', who: 'slime' };
  const headings = [], rows = [];
  const realFill = CanvasRenderingContext2D.prototype.fillText;
  const prevDest = window._qnavLiveDest;
  window._qnavLiveDest = () => dest;
  for (const py of [440, 300, 120]) {
    player.x = host.portalX; player.y = py;
    game.camera.x = Math.max(0, host.portalX - 640); game.camera.y = 0;
    const h = _qnavHeading(dest);
    headings.push(h ? h.y : null);
    let row = null;
    CanvasRenderingContext2D.prototype.fillText = function (t, x, y) {
      if (t === '📍') row = Math.round(y);
      return realFill.apply(this, arguments);
    };
    try { _qnavDrawCompass(); } catch (e) {}
    CanvasRenderingContext2D.prototype.fillText = realFill;
    rows.push(row);
  }
  window._qnavLiveDest = prevDest;
  const groundY = ((game.mapData.platforms || []).find(p => p.type === 'ground') || {}).y;
  return { noY, total, host, headings, rows, groundY,
           anchorFn: typeof _qnavAnchorY === 'function',
           anchorAtPortal: (typeof _qnavAnchorY === 'function') ? _qnavAnchorY(host.portalX) : null };
});

ok('found a live portal that declares no height', !!out.host,
   out.host ? `${out.host.map} -> ${out.host.dest} at x=${out.host.portalX} (${out.noY}/${out.total} portals lack a y)` : 'none found');
ok('the pin height is identical at three different player heights',
   out.headings && out.headings[0] != null && out.headings[0] === out.headings[1] && out.headings[1] === out.headings[2],
   `player.y 440/300/120 -> pin y ${JSON.stringify(out.headings)}`);
ok('the pin height is not simply the player\'s height',
   out.headings && out.headings[0] !== 440, `pin y ${out.headings && out.headings[0]}`);
ok('the pin rests on the map\'s ground band',
   out.groundY != null && out.headings && out.headings[0] === out.groundY,
   `pin ${out.headings && out.headings[0]} vs ground ${out.groundY}`);
ok('a player-independent anchor helper exists', out.anchorFn);
ok('the anchor resolves the ground surface under the portal',
   out.anchorAtPortal != null && out.anchorAtPortal === out.groundY,
   `anchor ${out.anchorAtPortal} vs ground ${out.groundY}`);
const rows = (out.rows || []).filter(r => r != null);
ok('the drawn pin lands on the same screen row at every player height',
   rows.length === 3 && Math.abs(rows[0] - rows[1]) <= 1 && Math.abs(rows[1] - rows[2]) <= 1,
   'rows: ' + JSON.stringify(out.rows) + ' (±1 is the idle bob)');

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
await browser.close(); server.kill();
process.exit(failed ? 1 : 0);
