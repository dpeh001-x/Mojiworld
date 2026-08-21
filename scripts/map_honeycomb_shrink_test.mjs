// Honeycomb Hollow: halved to 20 climbing shelves, denser.
//
// The load-bearing risk in shrinking this map is NOT the platform count — it is
// everything that was authored against the old 3400 floor. Honeycomb Hollow is
// a procedural vertical tower whose runtime data comes from the packed B blob
// (which overrides the literal generator at boot), and the blob carries two
// portals placed at absolute y. Halve the world without moving them and they
// sit underground — reachable only by a player who can walk through rock.
//
// So this asserts the SHAPE of the shrunk map from the live game.mapData:
//   • 20 climbing shelves (+ ground + portal pad)
//   • world and ground shrank together — no dead air above the top shelf
//   • every platform inside world bounds
//   • every portal standing ON a platform, not floating or buried
//   • the climb is still continuous — no floor gap beyond a jump
//   • the density bump landed, and the queue tracks the cap
// Run: node scripts/map_honeycomb_shrink_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const URL = 'file:///' + path.join(ROOT, args[0] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'msedge', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof MAPS !== 'undefined', { timeout: 90000 });

const r = await page.evaluate(() => {
  const out = {};
  player.cls = 'warrior'; player.level = 30;
  loadMap('honeycombHollow');
  // Read the LIVE map, not the literal: the packed blob overrides it at boot,
  // so anything asserted against MAPS could pass while the played map differs.
  const md = game.mapData;
  const plats = md.platforms || [];
  const shelves = plats.filter(p => p.type === 'platform');
  const ground = plats.filter(p => p.type === 'ground');

  // The portal pad is ALSO type:'platform' (it is the Bubblegum arch's
  // landing, one floor above ground, 140px wide) — so counting every
  // 'platform' conflates it with the climbing floors. Separate them: the
  // "20 platforms" the shrink targets are the CLIMBING SHELVES.
  const pad = shelves.find(pl => pl.w === 140 && Math.abs(pl.y - ((md.groundY != null ? md.groundY : 3400) - 60)) <= 2);
  out.total = plats.length;
  out.pad = pad ? { x: pad.x, y: pad.y, w: pad.w } : null;
  out.shelves = shelves.length - (pad ? 1 : 0);
  out.groundCount = ground.length;
  out.worldHeight = md.worldHeight;
  out.groundY = md.groundY != null ? md.groundY : (ground[0] && ground[0].y);
  out.monsterCap = md.monsterCap;
  out.queue = (md.spawns || []).reduce((a, s) => a + (s.count | 0), 0);

  // No platform outside the world box.
  out.outOfBounds = plats.filter(p =>
    p.y < 0 || p.y > md.worldHeight || p.x < 0 || p.x + p.w > md.worldWidth
  ).map(p => ({ x: p.x, y: p.y, w: p.w }));

  // Dead air: distance from the top shelf to the ceiling. A halved tower that
  // kept its old height would show a huge number here.
  const topY = Math.min(...shelves.map(p => p.y));
  out.headroom = topY;

  // Every portal must stand on something. "On" = its y matches a platform top
  // (within a small tolerance) and its x lies within that platform's span.
  const portals = md.portals || [];
  out.portals = portals.map(p => ({ dest: p.dest, x: p.x, y: p.y }));
  out.portalsFloating = portals.filter(p => {
    if (p.y == null) return false;   // ground-line portals resolve elsewhere
    return !plats.some(pl => Math.abs(pl.y - p.y) <= 2 && p.x >= pl.x - 4 && p.x <= pl.x + pl.w + 4);
  }).map(p => ({ dest: p.dest, x: p.x, y: p.y }));
  out.portalsBelowGround = portals.filter(p => p.y != null && p.y > out.groundY)
    .map(p => ({ dest: p.dest, y: p.y }));

  // Climb continuity: sort shelves bottom-up and check each is within reach of
  // the one below — vertically (a jump) and horizontally (a running leap).
  const byY = shelves.slice().sort((a, b) => b.y - a.y);
  let worstRise = 0, worstGap = 0;
  for (let i = 1; i < byY.length; i++) {
    const lo = byY[i - 1], hi = byY[i];
    worstRise = Math.max(worstRise, lo.y - hi.y);
    const gap = (hi.x > lo.x + lo.w) ? hi.x - (lo.x + lo.w)
              : (lo.x > hi.x + hi.w) ? lo.x - (hi.x + hi.w) : 0;
    worstGap = Math.max(worstGap, gap);
  }
  out.worstRise = worstRise;
  out.worstGap = worstGap;
  return out;
});

console.log('\nSHAPE');
check(r.shelves === 20, '20 climbing shelves (excluding the portal pad)', r.shelves);
check(r.pad !== null, 'the Bubblegum portal pad still exists as its own platform', r.pad);
check(r.groundCount === 1, 'one ground slab', r.groundCount);
check(r.total === 22, 'total collision objects = 20 shelves + ground + portal pad', r.total);
check(r.worldHeight <= 2000, 'world height shrank with the tower', r.worldHeight);
check(r.groundY <= 1900, 'ground line raised', r.groundY);
check(r.headroom >= 100 && r.headroom <= 400, 'no dead air above the top shelf', { topShelfY: r.headroom });
check(r.outOfBounds.length === 0, 'no platform outside the world box', r.outOfBounds);

console.log('\nPORTALS (authored against the OLD floor — the real shrink risk)');
check(r.portalsBelowGround.length === 0, 'no portal buried below the new ground line', r.portalsBelowGround);
check(r.portalsFloating.length === 0, 'every portal stands on a platform', { floating: r.portalsFloating, all: r.portals });

console.log('\nCLIMB');
check(r.worstRise <= 100, 'no floor gap beyond a jump', r.worstRise);
check(r.worstGap <= 420, 'no horizontal gap beyond a running leap', r.worstGap);

console.log('\nDENSITY');
check(r.monsterCap === 14, 'monster cap raised slightly (12 -> 14)', r.monsterCap);
check(r.queue === 29, 'spawn queue scaled with the cap', r.queue);
check(+(r.monsterCap / r.shelves).toFixed(2) >= 0.6 && +(r.monsterCap / r.shelves).toFixed(2) <= 0.8,
      'per-shelf density in the intended band', +(r.monsterCap / r.shelves).toFixed(2));

check(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(bad === 0 ? '\nALL PASS' : `\n${bad} FAILED`);
await browser.close();
process.exit(bad === 0 ? 0 : 1);
