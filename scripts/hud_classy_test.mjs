// Live test: THE HUD, CLASSY BLACK (per user, asked how the always-on-screen HUD should look: "Classy black, fix mismatches"
// - keep it dark and classy, swap the old serif and stray fonts for the game's Nunito, align the colours with the new panels,
// no stickers or dots). Boots into the forest with toasts up and reads computed style:
//   - no HUD region (stats card, location plate, toasts, skill bar, minimap) still sets text in Cinzel / Alegreya / Inter /
//     Trebuchet / monospace; the boss nameplate bakes in Nunito;
//   - the stats card keeps the user's translucency (v0.25.730 "reduce opacity": body alpha <= 0.52) and its class-coloured
//     rim (v0.25.974 "Match each class colour"), with the gold tint gone;
//   - the location plate stays a near-black semi-opaque plate (the user's "dark black semi opaque");
//   - toasts sit on neutral ink bodies (no violet / brown / blue cast), translucent as before; the minimap and skill bar
//     are neutral ink, not navy / violet;
//   - the quest tracker is left exactly as the user chose in v0.30.987 (its own navy, gold rim and Inter).
//   node scripts/hud_classy_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2]; for (let p = 18931; p <= 18999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof showToast === 'function', null, { timeout: 120000 });
await page.waitForTimeout(2500);
const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try { _lxBootGateDone = true; _prologueActive = false; localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player.cls = 'warrior'; player.job = 'berserker'; player.level = 30; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
  loadMap('forest', 300); await sleep(2500); game.paused = false; try { closeAllModals(); } catch (e) {}
  try { showToast('A rare find', 'rare'); showToast('Epic loot', 'epic'); showToast('LEGENDARY', 'legendary'); } catch (e) {}
  await sleep(900);
  const OLD = /^"?(Cinzel|Alegreya|Inter|Trebuchet|ui-monospace|monospace|Georgia|Cormorant)/;
  const stray = (sel) => { const root = document.querySelector(sel); if (!root) return ['(missing ' + sel + ')']; const bad = [];
    for (const el of [root, ...root.querySelectorAll('*')]) { const c = getComputedStyle(el); if (c.display === 'none' || !el.getClientRects().length) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()); if (!own) continue;
      const f = c.fontFamily.split(',')[0].trim(); if (OLD.test(f)) bad.push((el.id || el.className || el.tagName) + ':' + f); }
    return bad; };
  const rgba = (s) => (s.match(/[\d.]+/g) || []).map(Number);
  const stats = getComputedStyle(document.getElementById('stats'));
  const bodyAlphas = [...stats.backgroundImage.matchAll(/rgba\(([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+)\)/g)].map((m) => +m[4]);
  const golden = /212, 175, 90|226, 196, 120|232, 190, 90/.test(stats.backgroundImage);
  const ml = getComputedStyle(document.getElementById('map-label'));
  const mlStops = [...ml.backgroundImage.matchAll(/rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)/g)].map((m) => ({ sum: +m[1] + +m[2] + +m[3], a: m[4] === undefined ? 1 : +m[4] }));
  const toasts = [...document.querySelectorAll('#toast-container .toast')].map((t) => rgba(getComputedStyle(t).getPropertyValue('--tc-body-a')));
  const mm = rgba(getComputedStyle(document.getElementById('minimap')).backgroundColor);
  const sb = getComputedStyle(document.getElementById('skill-bar')).backgroundImage;
  const qt = document.getElementById('quest-tracker'); const qtc = qt ? getComputedStyle(qt) : null;
  let bake = null; try { const bk = _lxBossTitleBake('bar', 'King Krook, the Ember Tyrant', false); bake = bk && bk.font; } catch (e) {}
  const acc = stats.getPropertyValue('--cls-accent').trim();
  return { stray: { stats: stray('#stats'), map: stray('#map-label'), toasts: stray('#toast-container'), skills: stray('#skill-bar'), minimap: stray('#minimap') },
    bodyAlphas, golden, rim: stats.borderTopColor, acc, mlStops, toasts, mm, sb: sb.slice(0, 160), qt: qtc && { font: qtc.fontFamily, border: qtc.borderTopColor, bg: qtc.backgroundColor }, bake };
});
await b.close(); srv.kill();
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x }); const J = (o) => JSON.stringify(o);
const neutral = (c) => c && c.length >= 3 && Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]) <= 16;
const allStray = Object.values(R.stray).flat();
ok('no HUD region sets text in Cinzel / Alegreya / Inter / Trebuchet / monospace any more (Nunito throughout)', allStray.length === 0, allStray.slice(0, 6));
ok('the boss nameplate bakes in Nunito', /Nunito/.test(R.bake || ''), R.bake);
ok("the stats card keeps the user's translucency (body alpha <= 0.52) and loses its gold tint", R.bodyAlphas.length >= 2 && Math.max(...R.bodyAlphas.slice(-2)) <= 0.52 && !R.golden, { alphas: R.bodyAlphas, golden: R.golden });
const nums = (t) => (String(t).match(/[0-9.]+/g) || []).map(Number);
ok('the stats card keeps its class-coloured rim', !!R.acc && nums(R.rim).length === 4 && nums(R.rim).every((v, i) => Math.abs(v - nums(R.acc)[i]) < 0.01), { rim: R.rim, accent: R.acc });
ok('the location plate stays near-black and semi-opaque', R.mlStops.length >= 2 && R.mlStops.every((s) => s.sum <= 60 && s.a > 0 && s.a < 1), R.mlStops);
ok('toasts sit on neutral ink, still translucent (no violet / brown / blue cast)', R.toasts.length >= 3 && R.toasts.every((c) => neutral(c) && c[3] <= 0.7), R.toasts);
ok('the minimap and the skill bar are neutral ink, not navy / violet', neutral(R.mm) && !/180, 140, 232|60, 40, 90/.test(R.sb), { minimap: R.mm, skills: R.sb.slice(0, 90) });
ok('SCOPE: the quest tracker keeps the look the user chose in v0.30.987 (navy, gold rim, Inter)', !!R.qt && /^"?Inter/.test(R.qt.font) && R.qt.border === 'rgb(221, 170, 102)', R.qt);
ok('no page errors', errs.length === 0, errs.slice(0, 3));
for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + J(q.x ?? '').slice(0, 220));
console.log(`${results.filter((q) => q.pass).length}/${results.length} checks passed`);
process.exit(results.every((q) => q.pass) ? 0 : 1);
