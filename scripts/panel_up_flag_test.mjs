// No whole-page restyle on every HUD write (per user: "lets try work on reducing the lag").
// v0.30.1182 hid the Ascend pill with body:has(.modal-overlay[style*="display: flex"]) and body:has(#dialog[style*=...]).
// A :has() on the body whose argument reads the inline style attribute makes Chrome invalidate the whole document's
// style on every inline-style write anywhere, and the skill bar's cooldown sweep writes one every frame: in a throttled
// Gravitos fight style recalc fell 2.5 s -> 1.4 s per 8 s once it moved into JS. Checks:
//   - STATIC: no rule in any stylesheet (media blocks included) has a :has() whose argument tests [style];
//   - the pill still hides while Settings, a .modal-overlay window (Crafting) or an NPC dialog is up, via body.lx-panel-up,
//     and comes back when they close.
//   node scripts/panel_up_flag_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.env.PORT || process.argv[2]; for (let p = 19131; p <= 19199 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof _gugumaAscendChip === 'function', null, { timeout: 120000 });
await page.waitForTimeout(2500);
const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // static: every :has() argument, in every sheet and nested block
  const hasStyle = [];
  const walk = (rules) => { for (const r of rules) { if (r.cssRules && !r.selectorText) { walk(r.cssRules); continue; } const t = r.selectorText || '';
    if (/:has\(/.test(t)) for (const m of t.matchAll(/:has\(([^)]*)\)/g)) if (/\[style/.test(m[1])) hasStyle.push(t.slice(0, 120)); } };
  for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch (e) {} }
  try { _lxBootGateDone = true; _prologueActive = false; localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player.cls = 'warrior'; player.level = 60; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
  loadMap('town', 600); await sleep(2000); try { closeAllModals(); } catch (e) {} game.paused = false;
  player.level = PRESTIGE_LEVEL; _gugumaAscendPrompt(true); await sleep(600);   // at the level cap the pill is a standing offer (the eligibility tick keeps it)
  const pill = () => { const el = document.getElementById('guguma-ascend'); return !!(el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0); };
  const out = { hasStyle, start: pill() };
  const tryIt = async (name, open, close) => { try { closeAllModals(); } catch (e) {} await sleep(300); try { open(); } catch (e) { out[name] = 'ERR ' + e.message; return; }
    await sleep(300); out[name] = { hidden: !pill(), flag: document.body.classList.contains('lx-panel-up') };
    try { close(); } catch (e) {} try { closeAllModals(); } catch (e) {} game.paused = false; await sleep(400); out[name].back = pill(); };
  await tryIt('settings', () => openSettingsModal(), () => { try { closeSettingsModal(); } catch (e) {} });
  await tryIt('crafting', () => openCraftingModal(), () => {});
  await tryIt('dialog', () => { const np = (game.npcs || []).find((x) => x && x.name); if (np) openNPC(np); }, () => { try { closeDialog(); } catch (e) {} });
  out.dialogUp = (document.getElementById('dialog') || {}).style ? document.getElementById('dialog').style.display : null;
  return out;
});
await b.close(); srv.kill();
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x }); const J = (o) => JSON.stringify(o);
ok('STATIC: no :has() in any stylesheet tests the inline style attribute (a whole-page restyle per HUD write)', R.hasStyle.length === 0, R.hasStyle.slice(0, 3));
ok('the Ascend pill shows in town to begin with', R.start === true, R.start);
for (const k of ['settings', 'crafting', 'dialog']) ok(`the pill hides under ${k} (body.lx-panel-up) and comes back after`, R[k] && R[k].hidden && R[k].flag && R[k].back, R[k]);
ok('no page errors', errs.length === 0, errs.slice(0, 3));
for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + J(q.x ?? '').slice(0, 220));
console.log(`${results.filter((q) => q.pass).length}/${results.length} checks passed`);
process.exit(results.every((q) => q.pass) ? 0 : 1);
