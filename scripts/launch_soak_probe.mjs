// LAUNCH SOAK. A long REAL session: a levelled hero hunts on real maps, casting every skill of the class in rotation,
// changing map every leg, dying and respawning on purpose - while heap, DOM nodes, live intervals, listeners and every
// game array are sampled. The older soak_runtime_probe never left the empty prologue scene (0 monsters, 0 kills), so
// it could only ever report "nothing grows". This one fails if nothing was killed.
//   [SERVE_ROOT=<dir>] node scripts/launch_soak_probe.mjs [page.html] [--legs=8] [--leg-secs=40] [--json=out.json]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync, writeFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11133';
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const LEGS = Number(arg('legs', 8)), LEG_SECS = Number(arg('leg-secs', 40)), JSON_OUT = arg('json', '');
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 180)));
await page.addInitScript(() => { const P = window.__probe = { intervals: new Set(), listeners: 0 };
  const si = window.setInterval, ci = window.clearInterval; window.setInterval = function () { const id = si.apply(this, arguments); P.intervals.add(id); return id; }; window.clearInterval = function (id) { P.intervals.delete(id); return ci.apply(this, arguments); };
  const ae = EventTarget.prototype.addEventListener, re = EventTarget.prototype.removeEventListener; EventTarget.prototype.addEventListener = function () { P.listeners++; return ae.apply(this, arguments); }; EventTarget.prototype.removeEventListener = function () { P.listeners--; return re.apply(this, arguments); }; });
let fail = 0; const samples = [];
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof SKILL_FNS !== 'undefined' && typeof MAPS === 'object', null, { timeout: 180000 }); await page.waitForTimeout(4000);
  const maps = await page.evaluate(() => { try { _lxBootGateDone = true; _prologueActive = false; _playStoryBeat = function () { return false; }; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'mage'; player.job = 'wizard'; player.level = 70; player.maxMp = 99999; player.mp = 99999; game.paused = false;
    window.__kills = 0; window.__deaths = 0; const km = killMonster; killMonster = function () { window.__kills++; return km.apply(this, arguments); };
    // hunting maps only: real spawns, no boss arena, not a town
    return Object.keys(MAPS).filter((id) => { const m = MAPS[id]; return m && (m.spawns || []).length && !m.isBossArena && !(m.spawns || []).some((s) => s.boss) && !m.isVoid; }).slice(0, 40); });
  const SAMPLE = () => { try { if (window.gc) window.gc(); } catch (e) {} const len = (a) => (Array.isArray(a) ? a.length : (a && typeof a.size === 'number' ? a.size : 0)); const g = {};
    for (const k of Object.keys(game)) { const v = game[k]; if (Array.isArray(v) || v instanceof Map || v instanceof Set) g[k] = len(v); }
    return { heapMB: +((performance.memory ? performance.memory.usedJSHeapSize : 0) / 1048576).toFixed(1), dom: document.getElementsByTagName('*').length, intervals: window.__probe.intervals.size, listeners: window.__probe.listeners, kills: window.__kills, deaths: window.__deaths, arrays: g, inv: (player.inventory || []).length, map: game.currentMap, paused: !!game.paused }; };
  for (let leg = 0; leg < LEGS; leg++) {
    const id = maps[(leg * 5) % maps.length];
    await page.evaluate(({ id, die }) => { loadMap(id, 600); game.paused = false; player.hp = getMaxHp ? getMaxHp() : 5000; player._god = !die;
      const ids = Object.keys(SKILLS).filter((k) => SKILLS[k].cls === player.cls && (!SKILLS[k].job || SKILLS[k].job === player.job)); let i = 0; clearInterval(window.__castIv);
      window.__castIv = setInterval(() => { try { if (game.paused) game.paused = false; player.mp = 99999; for (const k of Object.keys(player.skillCooldowns || {})) player.skillCooldowns[k] = 0;
        const near = (game.monsters || []).filter((m) => m.currentHp > 0).sort((a, b) => Math.abs(a.x - player.x) - Math.abs(b.x - player.x))[0];
        if (near) { player.x = near.x - 80; player.y = near.y; player.facing = 1; near.currentHp = Math.min(near.currentHp, 400); }
        const s = ids[i++ % ids.length]; if (SKILL_FNS[s]) SKILL_FNS[s](); } catch (e) {} }, 260); }, { id, die: leg === 3 });
    if (leg === 3) { await page.waitForTimeout(3000); await page.evaluate(() => { try { player._god = false; player.invulnerable = 0; player.hp = 1; if (typeof damagePlayer === 'function') damagePlayer(99999, null); else player.hp = 0; window.__deaths++; } catch (e) {} });
      await page.waitForTimeout(6000); await page.evaluate(() => { for (const b of document.querySelectorAll('button')) if (/respawn|revive|continue|town/i.test(b.textContent || '') && b.offsetParent) { b.click(); break; } game.paused = false; player._god = true; }); }
    await page.waitForTimeout(LEG_SECS * 1000);
    const s = await page.evaluate(SAMPLE); s.leg = leg; s.target = id; samples.push(s);
    console.log(`leg ${leg} ${id.padEnd(22)} heap ${String(s.heapMB).padStart(6)} MB  dom ${s.dom}  intervals ${s.intervals}  listeners ${s.listeners}  kills ${s.kills}  inv ${s.inv}  errors ${errs.length}`);
  }
  await page.evaluate(() => clearInterval(window.__castIv));
  const a = samples[1], z = samples[samples.length - 1]; const grow = {};
  for (const k of Object.keys(z.arrays)) { const d = z.arrays[k] - (a.arrays[k] || 0); if (d > 40) grow[k] = `${a.arrays[k] || 0} -> ${z.arrays[k]}`; }
  console.log('\narrays that grew by > 40 between leg 1 and the last leg:', JSON.stringify(grow));
  console.log(`heap ${a.heapMB} -> ${z.heapMB} MB, dom ${a.dom} -> ${z.dom}, intervals ${a.intervals} -> ${z.intervals}, listeners ${a.listeners} -> ${z.listeners}, kills ${z.kills}, runtime errors ${errs.length}`);
  for (const e of [...new Set(errs)].slice(0, 8)) console.log('  ERR', e);
  const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fail++; };
  check(z.kills >= LEGS * 5, `the soak really fought (${z.kills} kills)`);
  check(errs.length === 0, 'no runtime errors');
  check(z.heapMB - a.heapMB < 60, `heap growth under 60 MB (${(z.heapMB - a.heapMB).toFixed(1)})`);
  check(z.dom - a.dom < 400, `DOM growth under 400 nodes (${z.dom - a.dom})`);
  check(z.intervals - a.intervals <= 2, `live intervals do not pile up (${a.intervals} -> ${z.intervals})`);
  check(z.listeners - a.listeners < 300, `listeners do not pile up (${a.listeners} -> ${z.listeners})`);
  check(Object.keys(grow).length === 0, 'no game array keeps growing');
  if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ samples, errs }, null, 1));
} catch (e) { console.log('PROBE ERROR', String(e.message).slice(0, 300)); fail++; }
await browser.close(); server.kill(); process.exit(fail ? 1 : 0);
