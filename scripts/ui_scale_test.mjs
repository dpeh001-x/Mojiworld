// HUD SIZE (uiScale): the accessibility control the polish audit found missing.
// It must (a) default to 100 and change nothing, (b) actually resize the HUD readouts,
// (c) NEVER touch the canvas - the play area, camera maths and pointer mapping stay put,
// (d) persist, and (e) clamp to its range.
//   node scripts/ui_scale_test.mjs   (MOJI_GAME_FILE serves a staged build)
import { chromium } from 'playwright-core'; import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process'; import net from 'node:net';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS  ' : 'FAIL  ') + n + (x ? '  ' + x : '')); };
const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT; for (let p = 8961; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1800));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof game === 'object' && typeof _applySettings === 'function' && typeof _lxGetSettings === 'function', null, { timeout: 180000 });
await page.evaluate(() => new Promise((res) => { let n = 0; const t = () => { window._lxBootGateDone = true; try { _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const o = document.getElementById(id); if (o) o.style.display = 'none'; } const c = document.querySelector('.cls-card'); if (c) c.click(); if (++n > 150) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
await page.waitForTimeout(1200);
const IDS = ['top-ui', 'right-ui', 'skill-bar', 'minimap', 'quest-tracker'];
const shot = (ids) => page.evaluate((ids) => { const o = { canvas: null, hud: {} };
  const c = document.getElementById('game'); if (c) { const r = c.getBoundingClientRect(); o.canvas = { w: +r.width.toFixed(1), h: +r.height.toFixed(1), x: +r.x.toFixed(1), y: +r.y.toFixed(1), attrW: c.width, attrH: c.height }; }
  for (const id of ids) { const e = document.getElementById(id); if (!e) continue; const r = e.getBoundingClientRect(); if (r.width > 0) o.hud[id] = { w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; }
  o.varSet = getComputedStyle(document.documentElement).getPropertyValue('--lx-ui-scale').trim(); return o; }, ids);
const setScale = (v) => page.evaluate((v) => { const s = _lxGetSettings(); s.uiScale = v; _lxSaveSettings(s); _applySettings(s); }, v);
const defaults = await page.evaluate(() => ({ def: LX_SETTINGS_DEFAULTS.uiScale, cur: _lxGetSettings().uiScale }));
ok('uiScale defaults to 100', defaults.def === 100 && (defaults.cur === 100 || defaults.cur === undefined), JSON.stringify(defaults));
const at100 = await shot(IDS);
ok('the HUD elements the setting targets are present', Object.keys(at100.hud).length >= 3, Object.keys(at100.hud).join(', '));
await setScale(130); await page.waitForTimeout(250);
const at130 = await shot(IDS);
const grew = Object.keys(at100.hud).filter((k) => at130.hud[k] && at130.hud[k].w > at100.hud[k].w * 1.15);
ok('at 130% the HUD readouts grow', grew.length >= Math.max(1, Object.keys(at100.hud).length - 1), `${grew.length}/${Object.keys(at100.hud).length} grew: ${grew.join(', ')}`);
ok('the canvas is untouched at 130% (play area, camera maths, pointer mapping)',
  !!at100.canvas && at130.canvas.w === at100.canvas.w && at130.canvas.h === at100.canvas.h && at130.canvas.attrW === at100.canvas.attrW && at130.canvas.attrH === at100.canvas.attrH,
  `${at100.canvas && at100.canvas.w}x${at100.canvas && at100.canvas.h} -> ${at130.canvas && at130.canvas.w}x${at130.canvas && at130.canvas.h}`);
await setScale(80); await page.waitForTimeout(250);
const at80 = await shot(IDS);
const shrank = Object.keys(at100.hud).filter((k) => at80.hud[k] && at80.hud[k].w < at100.hud[k].w * 0.95);
ok('at 80% the HUD readouts shrink', shrank.length >= Math.max(1, Object.keys(at100.hud).length - 1), `${shrank.length}/${Object.keys(at100.hud).length}`);
ok('the canvas is untouched at 80% too', at80.canvas.w === at100.canvas.w && at80.canvas.h === at100.canvas.h);
await setScale(999); await page.waitForTimeout(200);
const clamped = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--lx-ui-scale').trim());
ok('an out-of-range value clamps to 150%', clamped === '1.5', `--lx-ui-scale = ${clamped}`);
await setScale(100); await page.waitForTimeout(250);
const back = await shot(IDS);
const same = Object.keys(at100.hud).every((k) => back.hud[k] && Math.abs(back.hud[k].w - at100.hud[k].w) <= 1.5);
ok('returning to 100% restores the original layout exactly', same);
ok('the setting survives a save/load round trip', await page.evaluate(() => { const s = _lxGetSettings(); s.uiScale = 120; _lxSaveSettings(s); return _lxGetSettings().uiScale === 120; }));
ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
await b.close(); srv.kill();
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exitCode = fail ? 1 : 0;
