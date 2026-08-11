// TOWNS MUST BE MONSTER-FREE.
// =============================================================================
// A. STATIC: every hub-shaped map (NPCs, empty spawn table, not an arena/tower)
//    must set isTown, because every wild-spawn gate in the game keys off it.
//    This is what Emerald Village failed.
// B. LIVE: force the rare "wanderer" roll to fire, load each town, and assert
//    nothing hostile appears. Math.random is pinned so the 8%-per-load branch
//    is taken every time instead of being a coin flip the test usually wins.
// Run: node scripts/town_no_monsters_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });

// ── A. STATIC AUDIT ──────────────────────────────────────────────────────────
{
  const s = fs.readFileSync(path.join(ROOT, FILE), 'utf8');
  const mi = s.search(/\bconst MAPS\s*=\s*\{/);
  const open = s.indexOf('{', mi);
  let d = 0, end = -1;
  for (let i = open; i < s.length; i++) { const c = s[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { end = i; break; } } }
  const body = s.slice(open + 1, end);
  const maps = []; d = 0;
  let k = 0;
  while (k < body.length) {
    if (d === 0) {
      const m = /^\s*([A-Za-z_$][\w$]*)\s*:\s*\{/.exec(body.slice(k, k + 200));
      if (m) {
        const st = k + m[0].length - 1;
        let dd = 0, j = st;
        for (; j < body.length; j++) { if (body[j] === '{') dd++; else if (body[j] === '}') { dd--; if (!dd) break; } }
        maps.push({ id: m[1], blk: body.slice(st, j + 1) });
        k = j + 1; continue;
      }
    }
    const c = body[k]; if (c === '{') d++; else if (c === '}') d--; k++;
  }
  ok('MAPS parses into map blocks', maps.length > 40, `${maps.length} maps`);
  const nSpawn = (blk) => {
    const m = /\bspawns\s*:\s*\[/.exec(blk); if (!m) return 0;
    let dd = 0, j = m.index + m[0].length - 1;
    for (; j < blk.length; j++) { if (blk[j] === '[') dd++; else if (blk[j] === ']') { dd--; if (!dd) break; } }
    return [...blk.slice(m.index, j).matchAll(/type\s*:\s*'/g)].length;
  };
  // A hub is: has NPCs, declares no spawns, and is not an arena / tower / void.
  const hubs = maps.filter(x =>
    /\bnpcs\s*:\s*\[[\s\S]{0,40}[A-Za-z]/.test(x.blk) &&
    nSpawn(x.blk) === 0 &&
    !/\bisBossArena\s*:\s*true|\bisTower\s*:\s*true|\bisVerticalTower\s*:\s*true/.test(x.blk));
  const unflagged = hubs.filter(x => !/\bisTown\s*:\s*true/.test(x.blk)).map(x => x.id);
  ok('every NPC hub with no spawn table is flagged isTown',
     unflagged.length === 0, unflagged.length ? `missing isTown: ${unflagged.join(', ')}` : `${hubs.length} hubs checked`);
  ok('emeraldVillage is flagged isTown',
     /\bisTown\s*:\s*true/.test((maps.find(x => x.id === 'emeraldVillage') || { blk: '' }).blk));
  // The gates the flag drives must still exist, or the flag stops meaning anything.
  // v0.29.635 — the rare-wanderer roll this used to assert was REMOVED outright
  // (per user: "the monsters currently in it should be the only ones in the
  // map"), so the assertion is inverted rather than deleted — it now guards
  // against the feature coming back. Towns no longer depend on it either way:
  // what keeps them clean is spawnMonster's own refusal plus the per-frame
  // sweep, and both are exercised live further down. See map_roster_test.mjs
  // for the stronger per-map guarantee this became.
  ok('the rare-wanderer roll is gone (a map spawns only its own roster)',
     !/const wanderers\s*=/.test(s) && !/_lxWandererPool/.test(s)
     && !/Math\.random\(\) < 0\.08[\s\S]{0,400}spawnFromMap\(pick/.test(s));
  ok('natural chests are still gated on isTown', /_chestEligible\s*=\s*!game\.mapData\.isTown/.test(s));
}

// ── B. LIVE ──────────────────────────────────────────────────────────────────
const PORT = 9118;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);

const live = await page.evaluate(() => {
  const out = [];
  const ok = (n, c, extra) => out.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });
  for (const id of ['class-select-modal','advancement-modal','tutorial-modal','loading-overlay']) {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  }
  // Pin the RNG low so the 8%-per-load wanderer branch is always taken; without
  // this the test passes ~92% of the time on a BROKEN build.
  const realRandom = Math.random;
  const loadWith = (id, val) => {
    Math.random = () => val;
    try { loadMap(id); } catch (e) { /* surfaced via monster count below */ }
    finally { Math.random = realRandom; }
    return (game.monsters || []).filter(m => m && !m.ally && !m.isSummon && !m._playerOwned).length;
  };

  const towns = ['emeraldVillage', 'jadeGrove', 'reachOfVermillion', 'shadowWovenHood', 'town'];
  const dirty = [];
  for (const t of towns) {
    for (const v of [0, 0.05, 0.5]) {          // 0 and 0.05 both trip the < 0.08 roll
      const n = loadWith(t, v);
      if (n > 0) dirty.push(`${t}@rand=${v}:${n}`);
    }
  }
  ok('no hostile monsters spawn in any town, even with the wanderer roll forced',
     dirty.length === 0, dirty.length ? dirty.join(' | ') : `${towns.length} towns x 3 rolls clean`);

  // Control: the same forced roll on a combat map MUST populate it, otherwise
  // the test above would pass simply because nothing spawns anywhere.
  const combat = loadWith('forest', 0.05);
  ok('control: a combat map still populates under the same conditions',
     combat > 0, `forest spawned ${combat}`);

  // ── The sanctuary guarantee (layer 2): even a DIRECT spawn is refused ────
  const hostiles = () => (game.monsters || []).filter(m => m && !m.ally && !m.isSummon && !m._playerOwned).length;
  loadMap('emeraldVillage');
  const stub = spawnMonster(600, 300, 'scorpion', false);
  ok('spawnMonster refuses a wild mob in a town', hostiles() === 0 && !!(stub && stub._suppressed),
     `monsters ${hostiles()}, suppressed=${!!(stub && stub._suppressed)}`);

  // A boss is still allowed: the Echo Keeper stands in the isTown 'void' map
  // and summons one on request. Blocking that would break the feature.
  loadMap('void');
  const bossStub = spawnMonster(600, 300, 'king', true);
  const bossIn = (game.monsters || []).filter(m => m && m.isBoss).length;
  ok('a deliberately summoned BOSS is still allowed in a town', bossIn > 0 && !(bossStub && bossStub._suppressed),
     `bosses ${bossIn}`);

  // The sweep catches anything that bypassed spawnMonster entirely.
  loadMap('jadeGrove');
  game.monsters.push({ type: 'scorpion', x: 500, y: 300, w: 40, h: 30, currentHp: 100, maxHp: 100, atk: 10 });
  const before = hostiles();
  try { updateMonsters(16.667); } catch (e) {}
  ok('the sweep removes a monster pushed straight into a town',
     before === 1 && hostiles() === 0, `${before} -> ${hostiles()}`);

  // ...and must not touch the player's MojiMon companion (game.minions).
  loadMap('jadeGrove');
  game.minions = game.minions || [];
  game.minions.push({ type: 'slime', mojimon: true, x: 500, y: 300, w: 40, h: 30, currentHp: 50, maxHp: 50, life: 1e12 });
  const minionsBefore = game.minions.length;
  try { updateMonsters(16.667); } catch (e) {}
  ok('the sweep leaves the MojiMon companion alone',
     game.minions.length === minionsBefore, `minions ${minionsBefore} -> ${game.minions.length}`);

  // A combat map must still accept a direct spawn (the sweep is town-scoped).
  loadMap('forest');
  const nBefore = hostiles();
  spawnMonster(600, 300, 'scorpion', false);
  try { updateMonsters(16.667); } catch (e) {}
  ok('control: combat maps still accept and keep spawns', hostiles() > nBefore,
     `${nBefore} -> ${hostiles()}`);

  return out;
});

for (const r of live) res.push(r);
let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
console.log('pageerrors:', errs.length, errs.slice(0, 5));
await browser.close(); server.kill();
process.exit(failed || errs.length ? 1 : 0);
