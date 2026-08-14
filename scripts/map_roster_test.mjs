// A map spawns its authored roster - all of it, only it, at its authored weights.
// =============================================================================
// Per user: "shardlich should not spawn in the ossuary sprawl, ensure random
// monsters do not spawn in maps they are not supposed to."
//   1. shardlich is gone from Ossuary Sprawl
//   2. the cap no longer starves authored mob types at load (14 maps did)
//   3. the respawn drip follows the authored weights and never re-rolls a
//      `spawnChance` elite (the Ossuary Tyrant was the map's MOST common mob)
//   4. nothing outside a map's roster can ever reach the ambient spawn path
// Run: node scripts/map_roster_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9184;
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

await page.evaluate(() => {
  const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade');
  player.cls = player.cls || 'warrior'; player.level = 200; player.hp = 9e6; player.maxHp = 9e6;
  player._god = true; game.paused = false;
});

// ── 1. the reported mob is off the roster, and the map keeps its shape ───────
const roster = await page.evaluate(() => ({
  types: MAPS.ossuarySprawl.spawns.map(s => s.type),
  n: MAPS.ossuarySprawl.spawns.length,
}));
ok('shardlich is off the Ossuary Sprawl roster', !roster.types.includes('shardlich'), roster.types.join(', '));
ok('Ossuary Sprawl still fields a full six-entry roster', roster.n === 6, 'entries: ' + roster.n);
ok('shardlich still lives in its own map (Glasswind Steppe)',
   await page.evaluate(() => MAPS.glasswindSteppe2.spawns.some(s => s.type === 'shardlich')));

// ── 2. the cap distributes instead of truncating ─────────────────────────────
const starve = await page.evaluate(() => {
  const bad = [];
  for (const id of Object.keys(MAPS)) {
    const md = MAPS[id];
    if (!md || !Array.isArray(md.spawns) || !md.spawns.length || md.isTown) continue;
    // entries that are always meant to be present: non-boss, not chance-gated
    const want = md.spawns.filter(s => s && !s.boss && s.spawnChance == null).map(s => s.type);
    if (want.length < 2) continue;
    const seen = new Set();
    for (let i = 0; i < 6; i++) {
      try { loadMap(id, 300); } catch (e) { break; }
      for (const m of game.monsters) if (!m.isBoss) seen.add(m.type);
    }
    const never = want.filter(t => !seen.has(t));
    if (never.length) bad.push(id + ':' + never.join('/'));
  }
  return bad;
});
ok('no map starves an authored mob type at load', starve.length === 0,
   starve.length ? `${starve.length} starved: ` + starve.slice(0, 6).join('  ') : 'all authored types present');

const entry = await page.evaluate(() => {
  const mix = {};
  for (let i = 0; i < 12; i++) { loadMap('ossuarySprawl', 300); for (const m of game.monsters) if (!m.isBoss) mix[m.type] = (mix[m.type] || 0) + 1; }
  return mix;
});
ok('Ossuary Sprawl shows its whole roster on entry',
   ['boneWraith', 'boneGolem', 'lichkin', 'sepulchreHound', 'tombKeeper'].every(t => entry[t] > 0),
   JSON.stringify(entry));

// ── 3. the drip follows the authored weights ────────────────────────────────
const soak = await page.evaluate(async () => {
  loadMap('ossuarySprawl', 300);
  const seen = {}; let kills = 0;
  for (let i = 0; i < 70; i++) {
    for (const m of [...game.monsters]) {
      if (m.isBoss) continue;
      m.currentHp = 0; try { killMonster(m); kills++; } catch (e) {}
    }
    await new Promise(r => setTimeout(r, 500));
    for (const m of game.monsters) seen[m.type] = (seen[m.type] || 0) + 1;
  }
  const total = Object.values(seen).reduce((a, b) => a + b, 0) || 1;
  return { seen, kills, tyrantPct: +(100 * (seen.ossuaryTyrant || 0) / total).toFixed(1),
           wraithPct: +(100 * (seen.boneWraith || 0) / total).toFixed(1) };
});
ok('a kill soak never drip-spawns shardlich into the Sprawl', !soak.seen.shardlich,
   'sightings: ' + (soak.seen.shardlich || 0));
ok('the chance-gated Ossuary Tyrant is no longer the map\'s common mob',
   soak.tyrantPct < 8, `tyrant ${soak.tyrantPct}% of sightings over ${soak.kills} kills`);
ok('the heaviest authored entry is the most common mob',
   soak.wraithPct >= soak.tyrantPct, `boneWraith ${soak.wraithPct}% vs tyrant ${soak.tyrantPct}%`);

// ── 4. the roster guard refuses an alien type outright ──────────────────────
const guard = await page.evaluate(() => {
  loadMap('ossuarySprawl', 300);
  const before = game.monsters.length;
  spawnFromMap('scorpion', false);          // a Lv-15 desert mob, nowhere near this roster
  const afterAlien = game.monsters.length;
  spawnFromMap('boneWraith', false);        // authored — must still work
  return { blocked: afterAlien === before, authoredWorks: game.monsters.length === afterAlien + 1 };
});
ok('the roster guard refuses an off-roster type', guard.blocked);
ok('the roster guard still admits an authored type', guard.authoredWorks);

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
await browser.close(); server.kill();
process.exit(failed ? 1 : 0);
