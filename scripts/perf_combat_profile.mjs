// Empirical combat-lag profile: frame times + CDP CPU sample on a dense fight.
// Shipped alongside the v0.29.729 combat-lag pass so before/after comparisons
// use one fixed harness. Interleave runs (A,B,A,B) - absolute medians swing
// with machine load; the self-time SHARES and the p99 tail are the stable
// signals. Usage: node scripts/perf_combat_profile.mjs [build.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'file:///' + path.join(ROOT, process.argv[2] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome', args: [
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster !== 'undefined', { timeout: 60000 }).catch(() => {});
await page.waitForFunction(() => typeof loadMap === 'function', { timeout: 60000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  player.level = 60; player.cls = 'warrior'; player.invulnerable = 9e9; player.hp = 99999; player.maxHp = 99999;
  try { loadMap('blockland_apex'); } catch (e) { try { loadMap('boneGraveyard'); } catch (e2) {} }
  game.paused = false;
});
await page.waitForTimeout(6000);

// dense fight: many mobs around the player, auto-attacking
await page.evaluate(() => {
  game.paused = false;
  const types = Object.keys(monsterTypes).slice(0, 8);
  for (let i = 0; i < 28; i++) {
    try {
      if (typeof spawnMonster === 'function') {
        spawnMonster(player.x + (i % 7 - 3) * 90, player.y - 40, types[i % types.length]);
      }
    } catch (e) {}
  }
});
await page.waitForTimeout(1000);
const mobCount = await page.evaluate(() => game.monsters.filter((m) => m && m.currentHp > 0).length);

const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
await cdp.send('Profiler.start');
// frame times during 8s of real combat (spam an attack key)
const frames = await page.evaluate(async () => {
  const out = [];
  const t0 = performance.now();
  let last = t0;
  const key = (t, k) => window.dispatchEvent(new KeyboardEvent(t, { key: k, bubbles: true }));
  let n = 0;
  while (performance.now() - t0 < 8000) {
    game.paused = false;
    if ((n++ & 15) === 0) { key('keydown', 'z'); setTimeout(() => key('keyup', 'z'), 60); }
    await new Promise((r) => requestAnimationFrame(r));
    const now = performance.now();
    out.push(now - last); last = now;
  }
  return out;
});
const { profile } = await cdp.send('Profiler.stop');
await browser.close();

frames.sort((a, b) => a - b);
const pct = (p) => frames[Math.floor(frames.length * p)].toFixed(1);
console.log(`mobs alive: ${mobCount}; frames: ${frames.length}`);
console.log(`frame ms  p50 ${pct(0.5)}  p90 ${pct(0.9)}  p99 ${pct(0.99)}  max ${frames[frames.length - 1].toFixed(1)}`);

// self-time by function from the CPU profile
const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
const self = new Map();
const total = profile.samples.length;
for (const s of profile.samples) {
  const n = nodes.get(s);
  if (!n) continue;
  const f = n.callFrame;
  const name = (f.functionName || '(anon)') + ':' + f.lineNumber;
  self.set(name, (self.get(name) || 0) + 1);
}
const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18);
console.log('\ntop self-time (of ' + total + ' samples):');
for (const [name, cnt] of top) console.log(`  ${(cnt / total * 100).toFixed(1).padStart(5)}%  ${name}`);
