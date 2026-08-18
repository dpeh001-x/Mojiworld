// Chests keep clear of portals and NPCs, per user: "avoiding putting chests
// near portals or major objects".
//
// Placement is random, so a single map load proves nothing — a clean load can
// happen by luck on the old build too. This forces many restocks across several
// real maps and reports how many chests landed inside a keep-out zone.
//
// The second half matters as much as the first: the fix filters the platform
// pool, and an over-eager filter would quietly stop spawning chests at all. So
// the spawn RATE is measured too, and compared against the same maps' geometry.
// Run: node scripts/chest_placement_clearance_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const URL = 'file:///' + path.join(ROOT, args[0] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof MAPS !== 'undefined', { timeout: 90000 });
const r = await page.evaluate(async () => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  player.level = 60;

  // Chest-eligible maps that actually carry portals and/or NPCs — the only
  // places the bug can show. Picked from real map data, not invented.
  const eligible = Object.keys(MAPS).filter((k) => {
    const m = MAPS[k];
    if (!m || m.isTown || m.isBossArena || m._expeditionMap || m._pqSpire || m._noNaturalChests) return false;
    if (!Array.isArray(m.spawns) || !m.spawns.length) return false;
    if (!Array.isArray(m.platforms) || !m.platforms.some((p) => p.type === 'platform')) return false;
    const objs = (m.portals || []).length + (m.npcs || []).length;
    return objs > 0;
  });

  const CLEAR_X = 130, CLEAR_Y = 70;
  let loads = 0, chests = 0, violations = 0, loadsWithChest = 0;
  const worst = [];
  const perMap = {};

  for (const id of eligible.slice(0, 12)) {
    for (let attempt = 0; attempt < 14; attempt++) {
      // Defeat the 15-minute per-map restock cooldown so every load re-rolls.
      game._chestCooldown = {};
      loadMap(id);
      await new Promise((res) => requestAnimationFrame(res));
      loads++;
      const list = (game.chests || []).filter((x) => x && !x._pqPuzzlePiece);
      if (list.length) loadsWithChest++;
      chests += list.length;
      const keep = [];
      for (const po of (game.portals || [])) if (po && Number.isFinite(po.x)) {
        keep.push({ what: 'portal', x: po.x,
          y: (typeof po.y === 'number') ? po.y : ((typeof _defaultPortalY === 'function') ? _defaultPortalY() : 480) });
      }
      for (const np of (game.npcs || [])) if (np && Number.isFinite(np.x)) {
        keep.push({ what: 'npc', x: np.x, y: (typeof np.y === 'number') ? np.y : 436 });
      }
      for (const ch of list) {
        const cx = ch.x + 17, cy = ch.y;
        for (const k of keep) {
          const dx = Math.abs(k.x - cx), dy = Math.abs(k.y - cy);
          if (dx < CLEAR_X && dy < CLEAR_Y) {
            violations++;
            perMap[id] = (perMap[id] | 0) + 1;
            if (worst.length < 5) worst.push({ map: id, near: k.what, dx: Math.round(dx), dy: Math.round(dy) });
          }
        }
      }
    }
  }
  return { eligibleCount: eligible.length, maps: eligible.slice(0, 12), loads, chests,
           loadsWithChest, violations, worst, perMap };
});
await browser.close();

console.log(`  ${r.loads} loads across ${r.maps.length} maps -> ${r.chests} chests`);
console.log(`  chests inside a portal/NPC keep-out: ${r.violations}  ${JSON.stringify(r.worst)}`);
console.log(`  loads that produced at least one chest: ${r.loadsWithChest}/${r.loads}`);

check(r.maps.length >= 6, 'the survey covers a real spread of maps', r.maps.length);
check(r.chests >= 25, 'and produced enough chests for the result to mean something', r.chests);
check(r.violations === 0, 'no chest spawns on top of a portal or an NPC', { count: r.violations, examples: r.worst, byMap: r.perMap });
// The filter must not have strangled chest spawning: ~55% of loads roll a chest
// (45% roll none by design), so a healthy build lands well above a third.
check(r.loadsWithChest / r.loads >= 0.35,
      'chests still spawn at their normal rate (the keep-out did not starve them)',
      { withChest: r.loadsWithChest, loads: r.loads });
check(errs.length === 0, 'no page errors', [...new Set(errs)].slice(0, 3));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
