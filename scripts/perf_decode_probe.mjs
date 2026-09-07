// Which images keep decoding during a fight? Same scene as the combat profiler; after 6 s of
// fighting, reports the kind of every frame in the live monsters' sets (IMG still raw vs baked
// CANVAS / ImageBitmap), the bake budget state, and one second of drawImage calls by source kind.
import { chromium } from 'playwright-core'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn as _spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const _PORT = process.env.PERF_PORT || '9499';
const _srv = _spawn(process.execPath, [path.join(ROOT, 'serve.js'), _PORT], { stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:' + _PORT + '/' + (process.argv[2] || 'mojiworld_game.html') + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function', { timeout: 60000 });
await page.evaluate(() => { const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none'; window._lxBootGateDone = true; const c = document.querySelector('#class-select-modal .cls-card'); if (c && !player.cls) { try { c.click(); } catch (e) {} } const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none'; player.level = 60; player.cls = 'warrior'; player.invulnerable = 9e9; player.hp = 99999; player.maxHp = 99999; try { loadMap('blockland_apex'); } catch (e) { try { loadMap('boneGraveyard'); } catch (e2) {} } game.paused = false; });
await page.waitForTimeout(6000);
await page.evaluate(() => { game.paused = false; const types = Object.keys(monsterTypes).slice(0, 8); for (let i = 0; i < 28; i++) { try { spawnMonster(player.x + (i % 7 - 3) * 90, player.y - 40, types[i % types.length]); } catch (e) {} } });
await page.waitForTimeout(6000);
const r = await page.evaluate(async () => {
  const o = { dpr: typeof _LX_DPR === 'number' ? _LX_DPR : null, budget: typeof _lxBakeBudget === 'function' ? _lxBakeBudget() : null, inFlight: typeof _lxBakeInFlight === 'number' ? _lxBakeInFlight : null, sets: {} };
  const kind = (f) => !f ? 'null' : f.tagName === 'CANVAS' ? 'canvas' : f.tagName === 'IMG' ? 'img' : (typeof ImageBitmap !== 'undefined' && f instanceof ImageBitmap) ? 'bitmap' : (f.constructor && f.constructor.name) || 'other';
  const types = [...new Set(game.monsters.filter((m) => m && m.currentHp > 0).map((m) => m.type))];
  for (const t of types) { const set = _monsterFramesFor(t); const s = {}; for (const st of ['idle', 'walk', 'attack']) { const arr = set[st] || []; const kinds = {}; for (const f of arr) { const k = kind(f); kinds[k] = (kinds[k] || 0) + 1; } const f0 = arr.find((f) => f); s[st] = { n: arr.length, kinds, shrunk: !!arr._lxShrunk, cap: arr._lxShrunkCap || null, base: arr._lxBase || null, f0: f0 ? (f0.naturalWidth || f0.width) + 'x' + (f0.naturalHeight || f0.height) + (f0._lxNoShrink ? ' noShrink' : '') : null }; } const m = game.monsters.find((x) => x && x.type === t); s.mfb = m ? _mobFrameBase(m) : null; s.box = m ? m.w + 'x' + m.h : null; o.sets[t] = s; }
  // one second of drawImage calls by source kind + size
  const P = CanvasRenderingContext2D.prototype; const oI = P.drawImage; const calls = {}; let n = 0;
  P.drawImage = function (im, ...a) { const k = kind(im); const w = im && (im.naturalWidth || im.width) || 0; const key = k + (w >= 700 ? '>=700' : w >= 400 ? '400-699' : '<400'); calls[key] = (calls[key] || 0) + 1; n++; return oI.apply(this, [im, ...a]); };
  const t0 = performance.now(); let frames = 0; while (performance.now() - t0 < 1000) { await new Promise((r) => requestAnimationFrame(r)); frames++; }
  P.drawImage = oI; o.draw = { frames, perFrame: +(n / frames).toFixed(1), byKind: calls };
  // which IMG sources were drawn (top by count)
  const srcs = {}; P.drawImage = function (im, ...a) { if (im && im.tagName === 'IMG') { const s = (im.src || '').replace(/^.*\/Sprites\//, ''); srcs[s] = (srcs[s] || 0) + 1; } return oI.apply(this, [im, ...a]); };
  const t1 = performance.now(); while (performance.now() - t1 < 1000) await new Promise((r) => requestAnimationFrame(r)); P.drawImage = oI;
  o.imgSrcTop = Object.entries(srcs).sort((a, b) => b[1] - a[1]).slice(0, 14);
  return o;
});
await browser.close(); try { _srv.kill(); } catch (e) {}
console.log(JSON.stringify(r, null, 1));
