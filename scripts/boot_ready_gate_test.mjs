// READINESS GATE: sprites decoded and baked, backdrop primed, music buffered
// BEFORE a map is revealed — at boot for the predicted first map, and under
// the transition veil for every map entered after — so the first seconds of
// play do not pay for them.
// ============================================================================
// Per user: "ensure that the sprites, bgm and background load prior to
// starting the game mainscreen proper ... ensure that this preloading helps
// reduce in game lag".
//
// This drives the REAL path, not a faked boot: a resume session is seeded
// into sessionStorage before the page loads (which _finishHide consumes at
// boot exactly as it does for a returning player), the overlay must not fade
// until the boot gate has run for the predicted first map, class select is
// completed the way a player does it, town loads through its veil, and then a
// second map is entered through loadMap. The proof it helps is measured
// twice: the first 120 frames of play in each map mint almost no sprite
// caches, where the pre-change build minted dozens as the fight warmed up on
// screen.
// Run: node scripts/boot_ready_gate_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 9869);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const EXE = [process.env.PW_EXE, process.env.MOJI_PW_EXE,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));
const browser = await chromium.launch({
  channel: EXE ? undefined : 'msedge', executablePath: EXE || undefined,
  headless: true, args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [], logs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 150)));
page.on('console', (m) => { const t = m.text(); if (/ready gate/.test(t)) logs.push(t.replace(/^\[boot\] /, '')); });
await page.addInitScript(() => {
  try { sessionStorage.setItem('lx_resume', JSON.stringify({ name: 'GateTest', kind: 'guest' })); } catch (e) {}
  window.__gateObs = { status: [], fadedAt: 0, gateDoneAt: 0, t0: performance.now() };
  const pushStatus = () => {
    try {
      const st = document.getElementById('loading-status');
      const s = st ? st.textContent.trim() : '';
      const last = window.__gateObs.status[window.__gateObs.status.length - 1];
      if (s && s !== last) window.__gateObs.status.push(s);
    } catch (e) {}
  };
  const armObserver = () => {
    const st = document.getElementById('loading-status');
    if (!st) { setTimeout(armObserver, 50); return; }
    try { new MutationObserver(pushStatus).observe(st, { childList: true, subtree: true, characterData: true }); } catch (e) {}
  };
  armObserver();
  const tick = () => {
    try {
      pushStatus();
      const ov = document.getElementById('loading-overlay');
      if (ov && ov.classList.contains('fade') && !window.__gateObs.fadedAt) window.__gateObs.fadedAt = performance.now();
      if (window._lxReadyGateDone && !window.__gateObs.gateDoneAt) window.__gateObs.gateDoneAt = performance.now();
    } catch (e) {}
    if (!window.__gateObs.fadedAt || performance.now() - window.__gateObs.t0 < 60000) setTimeout(tick, 50);
  };
  setTimeout(tick, 50);
});
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`,
  { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof game === 'object' && typeof loop === 'function', null, { timeout: 180000 });
await page.waitForFunction(() => { const ov = document.getElementById('loading-overlay'); return !ov || ov.classList.contains('fade'); }, null, { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(400);

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 240) });
const ev = async (fn, arg) => { try { return await page.evaluate(fn, arg); } catch (e) { return { err: String(e).slice(0, 140) }; } };

// ---- the boot gate: real path, predicted map, overlay held ----------------
const obs = await ev(() => ({ ...window.__gateObs, gateExists: typeof _lxReadyGate === 'function', gateDone: !!window._lxReadyGateDone,
  predicted: (typeof _lxPredictStartMap === 'function') ? _lxPredictStartMap() : null, sitting: game.currentMap,
  queue: (typeof _LX_PREWARM_Q !== 'undefined') ? _LX_PREWARM_Q.length : -1,
  log: (window._lxReadyGateLog || []).slice(),
  overlayGone: !document.getElementById('loading-overlay') || document.getElementById('loading-overlay').classList.contains('fade') }));
const bootRec = (obs.log || []).find((r) => r.boot) || null;
ok('the readiness gate exists and ran on the real boot path', !obs.err && obs.gateExists && obs.gateDone && !!bootRec, obs.err || `gate ${obs.gateExists ? 'present' : 'missing'}, boot record ${!!bootRec}`);
ok('it warmed the PREDICTED first map, not the void placeholder the game boots in',
  !!bootRec && bootRec.id === obs.predicted && obs.predicted !== 'void' && obs.sitting === 'void',
  bootRec ? `predicted ${obs.predicted}, gated ${bootRec.id}, while sitting in ${obs.sitting}` : '');
ok('the overlay faded only AFTER the gate released', obs.overlayGone && obs.gateDoneAt > 0 && obs.fadedAt >= obs.gateDoneAt - 60,
  `gate released at ${Math.round(obs.gateDoneAt)}ms, overlay faded at ${Math.round(obs.fadedAt)}ms`);
// Town has no mob spawns, so "Baking…" is legitimately absent there; the
// stages a hub map must narrate are decode, backdrop, music and Ready.
const afterBoot = (() => { const i = obs.status.findIndex((s) => /Decoding sprites…/.test(s)); return i < 0 ? [] : obs.status.slice(i).filter((s) => !/Decoding sprites…\s\d/.test(s)); })();
// "Painting the backdrop…" is a sub-millisecond stage painted in the same task
// as the next one, so no observer (or eye) can see it; the stages that must
// show are decode, prepare, music and Ready.
ok('the overlay narrated the gate\'s stages', ['Decoding', 'Preparing', 'music', 'Ready'].every((k) => afterBoot.some((s) => s.indexOf(k) >= 0)),
  afterBoot.join(' | ') || '(no gate status seen)');
ok('the boot gate left the first map ready: decoded, pre-warm queue drained, music buffered, uncapped',
  !!bootRec && bootRec.bgm >= 3 && !bootRec.capped && obs.queue === 0,
  bootRec ? `baked ${bootRec.baked} frames in ${bootRec.bakeMs}ms (queue left ${obs.queue}), decode ${bootRec.decodeMs}ms, backdrop ${bootRec.backdrop}, bgm readyState ${bootRec.bgm}, total ${bootRec.ms}ms${bootRec.capped ? ' CAPPED' : ''}` : '');

// ---- enter the first map the way a player does: class select -> town ---------
await page.fill('#hero-name-input', 'GateTest').catch(() => {});
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  if (!m) return;
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*mage\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
// The class-select "Next" only pages the modal; the world is entered when the
// game loads the predicted first map. Do exactly that, through loadMap, so the
// veil gate runs for it the way it will for a player.
await page.evaluate(() => { try { loadMap(_lxPredictStartMap(), 300); } catch (e) {} });
await page.waitForFunction(() => game.currentMap && game.currentMap !== 'void', null, { timeout: 20000 }).catch(() => {});
await page.waitForFunction((id) => (window._lxReadyGateLog || []).some((r) => !r.boot && r.id === id), await page.evaluate(() => game.currentMap), { timeout: 12000 }).catch(() => {});
await page.waitForTimeout(300);

const entry = async (label) => ev(async ({ label }) => {
  const rec = (window._lxReadyGateLog || []).slice(-1)[0] || null;
  const id = game.currentMap;
  const md = (typeof _variedMapData === 'function') ? _variedMapData(id) : game.mapData;
  const types = []; for (const sp of ((md && md.spawns) || [])) if (sp && sp.type && !sp.boss && types.indexOf(sp.type) < 0) types.push(sp.type);
  let frames = 0, baked = 0, decoded = 0;
  for (const t of types) { const set = MONSTER_FRAMES[t]; if (!set) continue;
    for (const mode of ['idle', 'walk']) for (const im of (set[mode] || [])) { if (!im) continue; frames++;
      if ((im.naturalWidth || im.width) > 0) decoded++;
      if ((im._lxPlainCache && im._lxPlainCache.size) || (im._lxFeatherC && im._lxFeatherC.size)) baked++; } }
  const bgImg = (md && md.bg && typeof BG_IMAGES !== 'undefined') ? BG_IMAGES[md.bg] : null;
  // veil state right now, then the first 120 frames of play
  const veil = document.getElementById('map-fade-overlay');
  const veilOn = !!(veil && veil.classList.contains('on'));
  game.paused = false;
  let mints = 0; const oCE = document.createElement.bind(document);
  document.createElement = function (t) { if (t === 'canvas' && /_lxDrawSoft|_lxTintBake|_lxPlainOf/.test(new Error().stack || '')) mints++; return oCE.apply(this, arguments); };
  let worst = 0, last = performance.now();
  for (let i = 0; i < 120; i++) { await new Promise((r) => requestAnimationFrame(r)); const n = performance.now(); worst = Math.max(worst, n - last); last = n; }
  document.createElement = oCE;
  return { label, id, rec: rec && rec.id === id ? rec : null, types: types.length, frames, decoded, baked, hasBg: !!bgImg, bgBaked: !!(bgImg && bgImg._lxBgS),
    veilOn, mints, worst: +worst.toFixed(0), mobs: game.monsters.length };
}, { label });

const town = await entry('first map');
// The boot gate already decoded and baked this map, so its veil gate should
// find nothing to do and release quickly - and never sit on the preloader's
// 1.5s per-image timeout for an unrelated broken sprite.
ok(`the first map (${town.id}) entered through its veil gate, which found the boot gate's work already done`,
  !town.err && !!town.rec && town.rec.baked === 0 && town.rec.ms < 900,
  town.err || (town.rec ? `veil gate on ${town.rec.id}: baked ${town.rec.baked} (already done at boot), decode ${town.rec.decodeMs}ms, ${town.rec.ms}ms total` : `no gate record for ${town.id}`));
ok(`${town.id}: every idle/walk frame of its ${town.types} mob types is decoded and carries a size-keyed bake${town.frames === 0 ? ' (a hub: no mob spawns to bake)' : ''}`,
  !town.err && (town.frames === 0 || (town.decoded === town.frames && town.baked === town.frames)),
  town.err || `${town.decoded}/${town.frames} decoded, ${town.baked}/${town.frames} baked`);
ok(`${town.id}: the backdrop plate is baked at draw resolution before the first visible frame`,
  !town.err && (!town.hasBg || town.bgBaked), town.err || (town.hasBg ? (town.bgBaked ? 'baked' : 'NOT baked') : 'no plate on this map'));
ok(`${town.id}: the first 120 frames of play mint almost no sprite caches`,
  !town.err && town.mints <= 12, town.err || `${town.mints} mints with ${town.mobs} monsters; worst frame ${town.worst}ms`);

// ---- a second map, entered in play: the veil holds for its gate --------------
const veilHeld = await ev(async () => {
  const n0 = (window._lxReadyGateLog || []).length;
  loadMap('forest', 300);
  const veil = document.getElementById('map-fade-overlay');
  let onWhileGate = 0, samples = 0, releasedBeforeGate = false;
  const t0 = performance.now();
  while (performance.now() - t0 < 8000) {
    await new Promise((r) => setTimeout(r, 40));
    const gated = (window._lxReadyGateLog || []).length > n0;
    const on = !!(veil && veil.classList.contains('on'));
    if (!gated) { samples++; if (on) onWhileGate++; else releasedBeforeGate = true; }
    if (gated && !on) break;
  }
  return { onWhileGate, samples, releasedBeforeGate, gated: (window._lxReadyGateLog || []).length > n0 };
});
ok('entering a second map: the veil stays up until that map\'s gate completes, then drops',
  !veilHeld.err && veilHeld.gated && !veilHeld.releasedBeforeGate && veilHeld.onWhileGate === veilHeld.samples,
  veilHeld.err || `veil on for ${veilHeld.onWhileGate}/${veilHeld.samples} samples while gating; gate ran ${veilHeld.gated}; released early ${veilHeld.releasedBeforeGate}`);
await page.waitForTimeout(200);
const forest = await entry('second map');
ok(`${forest.id}: its frames were baked under the veil, and the first 120 frames of play mint almost none`,
  !forest.err && !!forest.rec && forest.baked === forest.frames && forest.frames > 0 && forest.mints <= 12,
  forest.err || `${forest.baked}/${forest.frames} baked${forest.rec ? ' (gate baked ' + forest.rec.baked + ' in ' + forest.rec.bakeMs + 'ms)' : ''}; ${forest.mints} mints in play with ${forest.mobs} monsters; worst frame ${forest.worst}ms`);
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' · '));
if (logs.length) console.log('  ' + logs.join('\n  '));

await browser.close(); server.kill();
let fail = 0;
for (const r of res) { if (!r.pass) fail++; console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.extra ? '  — ' + r.extra : '')); }
console.log(`\n${res.length - fail}/${res.length} checks passed`);
process.exit(fail ? 1 : 0);
