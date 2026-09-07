// Loop-4 probes on the combat scene: (1) DOM mutations per second by target and attribute (the
// source of style / layout / paint / commit work), (2) a V8 allocation sample: which functions allocate.
import { chromium } from 'playwright-core'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn as _spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const _PORT = process.env.PERF_PORT || '9503';
const _srv = _spawn(process.execPath, [path.join(ROOT, 'serve.js'), _PORT], { stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:' + _PORT + '/' + (process.argv[2] || 'mojiworld_game.html') + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function', { timeout: 60000 });
await page.evaluate(() => { const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none'; window._lxBootGateDone = true; const c = document.querySelector('#class-select-modal .cls-card'); if (c && !player.cls) { try { c.click(); } catch (e) {} } const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none'; player.level = 60; player.cls = 'warrior'; player.invulnerable = 9e9; player.hp = 99999; player.maxHp = 99999; try { loadMap('blockland_apex'); } catch (e) { try { loadMap('boneGraveyard'); } catch (e2) {} } game.paused = false; });
await page.waitForTimeout(6000);
await page.evaluate(() => { game.paused = false; const types = Object.keys(monsterTypes).slice(0, 8); for (let i = 0; i < 28; i++) { try { spawnMonster(player.x + (i % 7 - 3) * 90, player.y - 40, types[i % types.length]); } catch (e) {} } });
await page.waitForTimeout(2000);
const dom = await page.evaluate(async () => {
  const counts = {}; let total = 0;
  const label = (n) => { const el = n.nodeType === 3 ? n.parentElement : n; if (!el) return '?'; return (el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '')); };
  const mo = new MutationObserver((recs) => { for (const r of recs) { total++; const k = r.type + ' ' + label(r.target) + (r.attributeName ? ' [' + r.attributeName + ']' : ''); counts[k] = (counts[k] || 0) + 1; } });
  mo.observe(document.documentElement, { attributes: true, characterData: true, childList: true, subtree: true });
  const key = (t, k) => window.dispatchEvent(new KeyboardEvent(t, { key: k, bubbles: true })); let n = 0; const t0 = performance.now(); let frames = 0;
  while (performance.now() - t0 < 3000) { game.paused = false; if ((n++ & 15) === 0) { key('keydown', 'z'); setTimeout(() => key('keyup', 'z'), 60); } await new Promise((r) => requestAnimationFrame(r)); frames++; }
  mo.disconnect();
  return { frames, perSec: +(total / 3).toFixed(0), top: Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 16).map(([k, v]) => [k, +(v / 3).toFixed(0) + '/s']) };
});
console.log('DOM mutations: ' + dom.perSec + '/s over ' + dom.frames + ' frames'); for (const [k, v] of dom.top) console.log('  ' + v.padStart(7) + '  ' + k);
// allocation sampling
const cdp = await page.context().newCDPSession(page); await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.startSampling', { samplingInterval: 16384 });
await page.evaluate(async () => { const key = (t, k) => window.dispatchEvent(new KeyboardEvent(t, { key: k, bubbles: true })); let n = 0; const t0 = performance.now(); while (performance.now() - t0 < 6000) { game.paused = false; if ((n++ & 15) === 0) { key('keydown', 'z'); setTimeout(() => key('keyup', 'z'), 60); } await new Promise((r) => requestAnimationFrame(r)); } });
const { profile } = await cdp.send('HeapProfiler.stopSampling');
const self = new Map(); const walk = (node, stack) => { const f = node.callFrame; const name = (f.functionName || '(anon)') + ':' + f.lineNumber; if (node.selfSize > 0) self.set(name, (self.get(name) || 0) + node.selfSize); for (const c of node.children || []) walk(c, stack); }; walk(profile.head, []);
const totalB = [...self.values()].reduce((a, b) => a + b, 0);
console.log('\nallocation sample over 6 s: ' + (totalB / 1048576).toFixed(1) + ' MB sampled; top allocators:');
for (const [n, b] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18)) console.log('  ' + (b / totalB * 100).toFixed(1).padStart(5) + '%  ' + n);
await browser.close(); try { _srv.kill(); } catch (e) {}
