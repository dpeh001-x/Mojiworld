// HIT SPARKS WARM FIRST, BUFF SECONDS IN PLACE (per user: "Try to find more ways to reduce lag without compromising quality").
//   1. the class prewarm queues the three hit-spark sets first (every basic hit draws one; hit_warrior_2 / _3 were pinned on
//      their first draw mid-fight in a live Gravitos window - a texture upload on the frame they first show)
//   2. a buff pill's seconds change their text node's value in place, never swap the node (layout churn per change)
//   [MOJI_SERVE_ROOT / PORT] node scripts/hit_spark_prewarm_test.mjs      (serves mojiworld_game.html)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10067); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _lxPrewarmClassFx === 'function', null, { timeout: 180000 }); await page.waitForTimeout(3000);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (const o of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const e = document.getElementById(o); if (e) e.style.display = 'none'; }
    window._lxBootGateDone = true; window._prologueActive = false;
    const out = { ver: GAME_VERSION };
    // 1. a fresh class prewarm: which sets queue first
    const seen = []; const q = window._lxQueueFxSet;
    window._lxQueueFxSet = function (arr) { if (arr) { const k = Object.keys(FX_ANIM_FRAMES || {}).find((kk) => FX_ANIM_FRAMES[kk] === arr); seen.push(k || '?'); } };
    player.cls = 'mage'; player.job = null; player.master = null; _lxFxWarmCls = null;
    try { _lxPrewarmClassFx(); } catch (e) { out.err = e.message; }
    window._lxQueueFxSet = q; out.first = seen.slice(0, 4);
    // 2. a buff pill's seconds
    loadMap('forest', 400); await sleep(1500); game.paused = false;
    player.buffs = player.buffs || {}; const key = BUFF_META[0].key; game.paused = true;
    player.buffs[key] = 9000; _updateBuffRow(); const pillLeft = () => document.querySelector('#buff-row .moji-buff-pill .buff-left');
    let left = pillLeft(); out.key = key;
    if (left) {
      const n0 = left.firstChild, t0 = left.textContent; player.buffs[key] = 7400; _updateBuffRow();
      out.buff = { same: left.firstChild === n0, t0, t1: left.textContent, changed: left.textContent !== t0 };
    } else out.buff = null;
    return out;
  });
  console.log('build', R.ver, JSON.stringify(R));
  ok('1. the class prewarm queues the three hit-spark sets first', JSON.stringify(R.first.slice(0, 3)) === JSON.stringify(['hit_mage', 'hit_mage_2', 'hit_mage_3']), JSON.stringify(R.first));
  ok('2. a buff pill\'s seconds change in place (same text node)', !R.buff || (R.buff.changed ? R.buff.same : true), JSON.stringify(R.buff));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL  the harness runs to the end  ' + JSON.stringify(String(e.message).slice(0, 300))); }
finally { await browser.close(); server.kill(); }
console.log(fail ? `FAIL(${fail}) - ${pass} passed, ${fail} failed` : `PASS(0) - ${pass} passed, 0 failed`);
process.exit(fail ? 1 : 0);
