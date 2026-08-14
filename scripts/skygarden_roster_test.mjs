// Sky Garden has no mushrooms - on entry or over a long kill soak - and the
// Fungal Hollow story quest that needs them is untouched.
// Per user: "remove the monster 'shroom' from the sky garden map."
// Run: node scripts/skygarden_roster_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9190;
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

const roster = await page.evaluate(() => ({
  sky: MAPS.skyGarden.spawns.map(s => s.type + 'x' + s.count),
  hollow: MAPS.mushroom.spawns.map(s => s.type + 'x' + s.count),
}));
ok('mushroom is off the Sky Garden roster', !roster.sky.some(t => t.startsWith('mushroom')), roster.sky.join(' '));
ok('Fungal Hollow keeps its mushrooms (the Lv-8 story quest needs them)',
   roster.hollow.some(t => t.startsWith('mushroom')), roster.hollow.join(' '));
ok('the mushroom kill-quest target still has a home map',
   await page.evaluate(() => Object.keys(MAPS).some(id =>
     Array.isArray(MAPS[id].spawns) && MAPS[id].spawns.some(s => s && s.type === 'mushroom'))));

// entry composition over many loads
const entry = await page.evaluate(() => {
  const mix = {}; let live = 0; const REPS = 14;
  for (let i = 0; i < REPS; i++) {
    loadMap('skyGarden', 300);
    for (const m of game.monsters) if (!m.isBoss) { mix[m.type] = (mix[m.type] || 0) + 1; live++; }
  }
  return { mix, live: +(live / REPS).toFixed(1) };
});
ok('no mushroom spawns in Sky Garden on entry', !entry.mix.mushroom, JSON.stringify(entry.mix));
ok('Sky Garden still fields its authored natives', !!entry.mix.skywisp && !!entry.mix.cloudbun);
ok('Sky Garden density is unchanged (still fills its cap of 15)',
   entry.live >= 14.5, 'live avg ' + entry.live);

// long kill soak - the respawn drip must never produce one either
const soak = await page.evaluate(async () => {
  loadMap('skyGarden', 300);
  const seen = {}; let kills = 0;
  for (let i = 0; i < 60; i++) {
    for (const m of [...game.monsters]) {
      if (m.isBoss) continue;
      m.currentHp = 0; try { killMonster(m); kills++; } catch (e) {}
    }
    await new Promise(r => setTimeout(r, 500));
    for (const m of game.monsters) seen[m.type] = (seen[m.type] || 0) + 1;
  }
  return { seen, kills };
});
ok('a kill soak never drip-spawns a mushroom into Sky Garden', !soak.seen.mushroom,
   `sightings: ${soak.seen.mushroom || 0} over ${soak.kills} kills - ${JSON.stringify(soak.seen)}`);

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
await browser.close(); server.kill();
process.exit(failed ? 1 : 0);
