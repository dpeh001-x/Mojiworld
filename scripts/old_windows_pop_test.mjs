// Live test: THE OLD WINDOWS, POP PUNK (per user: "Fix all you have found" - seven windows still wore the v0.25 base:
// a gold hairline, a gold-gradient Trebuchet title, violet glass and slate buttons). Opens each one and reads computed
// style:
//   - Crafting, Reforge, Enhancement, Taxi, Achievements, Multiplayer and the plain Confirm wear the U panel's frame
//     (a 3px ink edge on a berry slab) and keep their painted plate / globe art;
//   - each title is butter Nunito 1000 with an ink stroke (paint-order stroke first) and a berry slab - no gradient
//     text, no Trebuchet - and its emoji tiles are not stroked;
//   - the body face is Nunito; the slate buttons are inked stickers, the Confirm butter;
//   - SCOPE: the Confirm's comic and mono skins (both per user) keep their own looks, and a window outside the list
//     (the Quest Journal) keeps its own frame.
//   node scripts/old_windows_pop_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.env.PORT || process.argv[2]; for (let p = 19031; p <= 19099 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof openCraftingModal === 'function' && typeof uiConfirm === 'function', null, { timeout: 120000 });
await page.waitForTimeout(2500);
const R = await page.evaluate(async () => {
  // headless trips the perf governor into reduced-effects mode (html.lx-nobackdrop strips every box-shadow and
  // backdrop-filter): pin full effects so the frame / slab / glass reads are real
  const full = () => { try { window._perfTick = function () {}; LX_PERF.veryLowFx = false; } catch (e) {} document.documentElement.classList.remove('lx-nobackdrop'); };
  full();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try { _lxBootGateDone = true; _prologueActive = false; localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player.cls = 'warrior'; player.level = 60; player.mojicoins = 999999; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
  loadMap('town', 600); await sleep(2000); try { closeAllModals(); } catch (e) {}
  const fam = (el) => getComputedStyle(el).fontFamily.split(',')[0].split('"').join('').trim();
  const read = (id) => { const ov = document.getElementById(id); const m = ov && ov.querySelector(':scope > .modal'); if (!m) return null;
    const mc = getComputedStyle(m); const h = m.querySelector('h2'); const hc = h && getComputedStyle(h); const emo = h && h.querySelector('.lx-emo');
    const btn = m.querySelector('.enhance-btn:not(:disabled)');
    return { edge: mc.borderTopWidth + ' ' + mc.borderTopColor, shadow: mc.boxShadow, bg: mc.backgroundImage.slice(0, 90), face: fam(m),
      title: hc && { face: fam(h), weight: hc.fontWeight, fill: hc.webkitTextFillColor, clip: hc.webkitBackgroundClip || hc.backgroundClip, stroke: hc.webkitTextStrokeWidth + ' ' + hc.webkitTextStrokeColor, paint: hc.paintOrder, shadow: hc.textShadow },
      emoStroke: emo ? getComputedStyle(emo).webkitTextStrokeWidth : null, btn: btn && { face: fam(btn), bg: getComputedStyle(btn).backgroundColor, edge: getComputedStyle(btn).borderTopColor } }; };
  const out = {};
  for (const [id, fn] of [['craft-modal', 'openCraftingModal'], ['reforge-modal', 'openReforgeModal'], ['enhance-modal', 'openEnhancementModal'], ['taxi-modal', 'openTaxi'], ['codex-modal', 'openCodex'], ['multiplayer-modal', 'openMultiplayer']]) {
    try { closeAllModals(); } catch (e) {} try { window[fn](); } catch (e) { out[id] = 'ERR ' + e.message; continue; } await sleep(450); out[id] = read(id); } full();
  try { closeAllModals(); } catch (e) {}
  const conf = async (opts) => { uiConfirm(opts); await sleep(400); full(); const r = read('confirm-modal'); const y = document.getElementById('confirm-yes');
    r.yes = { bg: getComputedStyle(y).backgroundColor, face: fam(y) }; r.cls = document.getElementById('confirm-modal').className; document.getElementById('confirm-no').click(); await sleep(250); return r; };
  out.confirm = await conf({ title: 'Discard this item?', body: 'The Runed Sabre will be gone for good.' });
  out.comic = await conf({ title: 'Pay and refund?', body: 'x', skin: 'comic' });
  out.mono = await conf({ title: 'Reset', body: 'x', skin: 'mono' });
  try { toggleQuestJournal(); await sleep(450); const q = document.querySelector('#quest-modal > .modal'); out.journal = q && getComputedStyle(q).borderTopWidth + ' ' + getComputedStyle(q).borderTopColor; closeAllModals(); } catch (e) { out.journal = 'ERR ' + e.message; }
  return out;
});
await b.close(); srv.kill();
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x }); const J = (o) => JSON.stringify(o);
const WINS = ['craft-modal', 'reforge-modal', 'enhance-modal', 'taxi-modal', 'codex-modal', 'multiplayer-modal', 'confirm'];
const W = WINS.map((k) => [k, R[k]]);
ok('all seven windows open', W.every(([, v]) => v && typeof v === 'object'), W.filter(([, v]) => !v || typeof v !== 'object').map(([k, v]) => k + ':' + v));
const good = W.filter(([, v]) => v && typeof v === 'object');
ok("each wears the U panel's frame: a 3px ink edge on a berry slab", good.every(([, v]) => v.edge === '3px rgb(13, 10, 20)' && /rgb\(125, 35, 82\) 8px 8px 0px/.test(v.shadow)), good.map(([k, v]) => k + ' ' + v.edge + ' | ' + v.shadow.slice(0, 40)));
ok('the painted plates and the Multiplayer globe stay', ['craft-modal', 'reforge-modal', 'enhance-modal', 'taxi-modal', 'codex-modal'].every((k) => /panel_p5/.test(R[k] && R[k].bg || '')) && /gradient/.test(R['multiplayer-modal'] && R['multiplayer-modal'].bg || ''), W.map(([k, v]) => k + ':' + (v && v.bg || '').slice(0, 50)));
ok('each title is butter Nunito 1000 with an ink stroke under it and a berry slab - no gradient text', good.every(([, v]) => v.title && v.title.face === 'Nunito' && +v.title.weight >= 1000 && v.title.fill === 'rgb(255, 224, 122)' && !/text/.test(v.title.clip) && /^4\.5px rgb\(13, 10, 20\)/.test(v.title.stroke) && /^stroke/.test(v.title.paint) && /rgb\(125, 35, 82\) 3px 3px/.test(v.title.shadow)), good.map(([k, v]) => k + ' ' + J(v.title).slice(0, 150)));
ok('emoji tiles in the titles are not stroked', good.filter(([, v]) => v.emoStroke !== null).every(([, v]) => v.emoStroke === '0px') && good.some(([, v]) => v.emoStroke !== null), good.map(([k, v]) => k + ':' + v.emoStroke));
ok('the body face is Nunito in every window', good.every(([, v]) => v.face === 'Nunito'), good.map(([k, v]) => k + ':' + v.face));
ok('the slate buttons are inked stickers (ink edge, Nunito); the plain Confirm is butter', good.filter(([, v]) => v.btn).every(([, v]) => v.btn.face === 'Nunito' && v.btn.edge === 'rgb(13, 10, 20)') && R.confirm && R.confirm.yes.bg === 'rgb(255, 224, 122)', good.map(([k, v]) => k + ':' + J(v.btn)).concat([J(R.confirm && R.confirm.yes)]));
ok('SCOPE: the comic and mono Confirm skins keep their own frames and titles', R.comic && /skin-comic/.test(R.comic.cls) && R.comic.edge === '4px rgb(12, 11, 16)' && R.comic.title.fill === 'rgb(12, 11, 16)' && R.mono && /skin-mono/.test(R.mono.cls) && /^1px/.test(R.mono.edge) && R.mono.title.fill === 'rgb(255, 255, 255)', { comic: R.comic && [R.comic.edge, R.comic.title.fill], mono: R.mono && [R.mono.edge, R.mono.title.fill] });
ok('SCOPE: a window outside the list (the Quest Journal) keeps its own frame', typeof R.journal === 'string' && !/^ERR/.test(R.journal) && R.journal !== '3px rgb(13, 10, 20)', R.journal);
ok('no page errors', errs.length === 0, errs.slice(0, 3));
for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + J(q.x ?? '').slice(0, 260));
console.log(`${results.filter((q) => q.pass).length}/${results.length} checks passed`);
process.exit(results.every((q) => q.pass) ? 0 : 1);
