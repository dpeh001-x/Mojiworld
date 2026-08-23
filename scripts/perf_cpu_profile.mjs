// Ground-truth JS self-time, from the browser's own sampling profiler.
//
// Why this exists alongside perf_frame_profile.mjs: wrapping each draw function
// in performance.now() misattributes GPU backpressure — whichever call happens
// to trigger a flush absorbs the cost of everything queued before it. That is
// why the wrapper reported drawNPCs at 1.79 ms while calling it directly timed
// 0.037 ms. A sampling profiler attributes SELF time per function and does not
// have that failure mode.
//
//   node scripts/perf_cpu_profile.mjs [file.html] [--map=town] [--secs=8] [--fill]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--')) || 'mojiworld_game.html';
const MAP = (args.find(a => a.startsWith('--map=')) || '').split('=')[1] || 'town';
const SECS = +((args.find(a => a.startsWith('--secs=')) || '').split('=')[1] || 8);
const FILL = args.includes('--fill');
const URL = 'file:///' + path.join(ROOT, file).split(path.sep).join('/');

const browser = await chromium.launch({ channel: 'msedge', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function', { timeout: 90000 });

const setup = await page.evaluate(async ({ MAP, FILL }) => {
  window._lxBootGateDone = true;
  try { const bo = document.getElementById('loading-overlay'); if (bo) bo.remove(); } catch (e) {}
  // Wait the way the real commence gate does, so we profile the state a player
  // actually starts in rather than a pre-decode moment that never ships.
  try { await Promise.race([window._lxNpcSpritesReady || Promise.resolve(), new Promise(r => setTimeout(r, 25000))]); } catch (e) {}
  loadMap(MAP);
  player.cls = 'warrior'; player.level = 60; player._god = true; game.paused = false;
  if (FILL) {
    const cap = (game.mapData.monsterCap || 20);
    const t = (game.mapData.spawns || []).map(s => s.type).filter(Boolean);
    let g = 0;
    while (game.monsters.length < cap && t.length && g++ < 400) {
      try { spawnMonster(200 + (g * 97) % 1600, 300, t[g % t.length], false, false); } catch (e) { break; }
    }
  }
  if (typeof _lxNextFrame === 'function') _lxNextFrame();
  return { map: MAP, monsters: game.monsters.length, npcs: (game.npcs || []).length };
}, { MAP, FILL });

await page.waitForTimeout(2500);   // let the scene settle before sampling

const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 100 });   // 100us
await cdp.send('Profiler.start');
await page.waitForTimeout(SECS * 1000);
const { profile } = await cdp.send('Profiler.stop');

// Aggregate SELF time per function from the sample counts.
const byId = new Map(profile.nodes.map(n => [n.id, n]));
const self = new Map();
const total = profile.samples.length;
for (const id of profile.samples) {
  const n = byId.get(id);
  if (!n) continue;
  const cf = n.callFrame;
  const name = (cf.functionName || '(anonymous)') + (cf.url && cf.url.includes('mojiworld') ? '' : ' [ext]');
  self.set(name, (self.get(name) || 0) + 1);
}
const durMs = (profile.endTime - profile.startTime) / 1000;
const rows = [...self.entries()].sort((a, b) => b[1] - a[1]);

console.log(`\nscene: ${setup.map}   monsters ${setup.monsters}   npcs ${setup.npcs}`);
console.log(`sampled ${total} samples over ${durMs.toFixed(0)}ms\n`);
console.log('  ' + 'function (self time)'.padEnd(38) + '%'.padStart(7) + 'ms'.padStart(9));
let shown = 0;
for (const [name, count] of rows) {
  if (shown++ >= 22) break;
  const pct = count / total * 100;
  if (pct < 0.4) break;
  console.log('  ' + name.slice(0, 37).padEnd(38) + pct.toFixed(1).padStart(7) + (durMs * count / total).toFixed(0).padStart(9));
}
// Who CALLS the hot leaves? Self time names the victim; the parent chain names
// the culprit. Walk children -> parent once, then attribute each hot leaf back
// up to the nearest frame that lives in the game file.
{
  const parent = new Map();
  for (const n of profile.nodes) for (const c of (n.children || [])) parent.set(c, n.id);
  const HOT = ["getImageData", "drawImage", "putImageData", "toDataURL"];
  for (const leaf of HOT) {
    const callers = new Map();
    for (const id of profile.samples) {
      const n = byId.get(id);
      if (!n || n.callFrame.functionName !== leaf) continue;
      let cur = parent.get(id), hops = 0, label = "(root)";
      while (cur != null && hops++ < 12) {
        const pn = byId.get(cur);
        if (!pn) break;
        const fn = pn.callFrame.functionName;
        if (fn && fn[0] !== '(') { label = fn + '  @' + (pn.callFrame.lineNumber + 1); break; }
        cur = parent.get(cur);
      }
      callers.set(label, (callers.get(label) || 0) + 1);
    }
    if (!callers.size) continue;
    console.log('\n  callers of ' + leaf + ':');
    for (const [k, v] of [...callers].sort((a, b) => b[1] - a[1]).slice(0, 6))
      console.log("    " + k.padEnd(40) + (v / total * 100).toFixed(1).padStart(6) + "%");
  }
}
const idle = rows.find(r => /idle|program|GC/i.test(r[0]));
if (idle) console.log(`\n  (idle/program/GC: ${(idle[1] / total * 100).toFixed(1)}%)`);
await browser.close();
