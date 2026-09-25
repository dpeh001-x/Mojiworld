// THE DOWNED COLLAPSE: BUCKLE, TOPPLE, SPRAWL, DUST, STILL (v0.30.1054).
//
// Per user: "when the character is downed could you animate and make him lie in a position that is more believably
// dead". The downed draw was a rigid 90-degree roll of the standing pose. Now drawPlayer's downed block runs a timeline
// (knees buckle with a feet-anchored squash, an accelerating topple, a bounce and dust on landing) and blends a sprawl
// (_LX_DEAD_POSE, degrees per posture part) into _postureMap for the hero draw only. Reads the live game:
//   - in the first third of the fall the squash is on and the pose blend is partial (the eyes: downed_pose_test)
//   - once landed the painter sees the full sprawl: head lolled, an arm flung out in front and one back over the body, a knee bent (mirrored by facing)
//   - the landing kicks up dust particles, once
//   - the flags are hero-scoped: after the draw they read zero
//   - on revive the blend unwinds and the posture map is the player's own again
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/downed_sprawl_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11376';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const src = readFileSync(PAGE, 'utf8');
check(src.includes('const _LX_DEAD_POSE = {') && src.includes('window._lxDownedPoseK = _poseK;') && src.includes('function _lxDownedDust()'), 'static: the sprawl table, the timeline flags and the dust are in the build');
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, MOJI_GAME_FILE: PAGE } });
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } });
await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _coopTryDowned === 'function' && typeof _postureRad === 'function', null, { timeout: 180000 });
  const r = await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { tutorial_intro: true, everdawn_welcome: true }); player._tutorialSeen = true;
    applyClass('warrior'); player.level = 60; player.talents = { warrior: 'x' }; player._tutorialSeen = true;
    try { closeAllModals(); } catch (e) {}
    loadMap('town', 300); await new Promise((r) => setTimeout(r, 1500)); try { closeAllModals(); } catch (e) {} game.paused = false;
    for (let i = 0; i < 80 && !player.onGround; i++) await new Promise((r) => setTimeout(r, 50));
    // record what the painter is handed for the hero's head / back arm / left leg, and the blink factor, per frame.
    // _drawVectorHero reads the map _postureMap() returns straight into its bone transforms, so that is the hook.
    const _o = _postureMap; window.__seen = []; window.__blink = [];
    _postureMap = function () { const m = _o(); if (m && m.head) window.__seen.push({ t: game.time, k: window._lxDownedPoseK || 0, sq: window._lxDownedSquash || 0, head: +m.head.angle, armBack: +m.armBack.angle, legL: +m.legL.angle }); return m; };
    const _ob = _heroBlinkFactor; _heroBlinkFactor = function () { const v = _ob(); window.__blink.push({ t: game.time, k: window._lxDownedPoseK || 0, v }); return v; };
    for (let i = 0; i < 40 && window.__seen.length < 3; i++) await new Promise((r) => setTimeout(r, 50));   // a few standing draws first (the headless frame rate wanders)
    const before = { seen: window.__seen.length, maxK: Math.max(0, ...window.__seen.map((s) => s.k)), dust: (game.particles || []).filter((p) => p && p.color === 'rgba(214,204,186,0.85)').length, face: player.facing || 1 };
    window.__seen.length = 0; window.__blink.length = 0;
    player.hp = (typeof getMaxHp === 'function') ? getMaxHp() : player.hp; const downed = _coopTryDowned(); const t0 = game.time;
    // the dust lives 16-28 frames: sample its count through the fall rather than after it
    let dustPeak = 0; for (let i = 0; i < 45; i++) { await new Promise((r) => setTimeout(r, 40)); dustPeak = Math.max(dustPeak, (game.particles || []).filter((p) => p && p.color === 'rgba(214,204,186,0.85)').length); }
    const seen = window.__seen.slice(), blink = window.__blink.slice();
    const early = seen.filter((s) => s.t - t0 <= 12), late = seen.slice(-6);
    const dust = dustPeak;
    const afterDraw = { k: window._lxDownedPoseK || 0, sq: window._lxDownedSquash || 0 };
    const own = (() => { const m = _o(); return { head: +m.head.angle, armBack: +m.armBack.angle }; })();   // read outside a hero draw (the unhooked map)
    // revive: end the down the way _coopReviveApply does, then let the get-up run
    player._downed = false; player._downedSilent = false; player._downedUntil = 0; player.hp = (typeof getMaxHp === 'function') ? getMaxHp() : player.hp; document.getElementById('coop-downed-banner')?.remove();
    // the get-up is 18 sim frames; wait for the blend to reach zero rather than a fixed beat (the headless sim rate wanders)
    let up = []; for (let i = 0; i < 80; i++) { await new Promise((r) => setTimeout(r, 50)); up = window.__seen.slice(-2); if (up.length === 2 && up.every((q) => q.k === 0)) break; }
    return { downed, before, f: player._downFallFace || 1, early: early.slice(0, 6), earlyMaxSq: Math.max(0, ...early.map((s) => s.sq)), earlyMaxK: Math.max(0, ...early.map((s) => s.k)), earlyBlink: (() => { const inBuckle = blink.filter((b) => b.k > 0 && b.k < 0.45); const any = blink.filter((b) => b.k > 0 && b.t - t0 <= 40); return (inBuckle.length ? inBuckle : any).map((b) => b.v).slice(0, 4); })() /* the face layer bakes and is not drawn every hero frame: buckle-phase samples if any, else the first downed ones */, late, dustBefore: before.dust, dust, dustFlag: player._downDust, afterDraw, own, up };
  });
  const f = r.f;
  check(r.downed && r.before.seen >= 3 && r.before.maxK === 0, 'setup: the hero drew normally (no blend) before the down', J(r.before));
  check(r.early.length >= 2 && r.earlyMaxSq > 0.5 && r.earlyMaxK > 0 && r.earlyMaxK < 0.6, 'BUCKLE: in the first 12 sim frames the feet-anchored squash is on and the sprawl is only partly blended', J({ maxSq: r.earlyMaxSq, maxK: r.earlyMaxK, first: r.early.slice(0, 3) }));
  // the eyes: covered by the shipped downed_pose_test (closed for the whole downed draw); the face layer bakes and is not
  // drawn every hero frame, so a sample inside the buckle window is luck - not asserted here
  const L = r.late[r.late.length - 1] || {};
  check(r.late.length >= 3 && r.late.every((s) => s.k === 1) && Math.abs(L.head - 26 * f) < 0.6 && Math.abs(L.armBack - 55 * f) < 0.6 && Math.abs(L.legL - 50 * f) < 0.6, `SPRAWL: at rest the painter is handed the full sprawl, mirrored by the fall's facing (${f > 0 ? 'right' : 'left'}) - head lolled, an arm flung out in front and one back over the body, a knee bent`, J(L));
  check(r.dust >= r.dustBefore + 6 && r.dustFlag === 1, 'DUST: the landing kicks up a puff of dust, once', J({ before: r.dustBefore, after: r.dust, flag: r.dustFlag }));
  check(r.afterDraw.k === 0 && r.afterDraw.sq === 0 && r.own.head === 0 && r.own.armBack === 0, 'SCOPED: outside the hero draw the flags read zero and the posture map is the player\'s own', J({ afterDraw: r.afterDraw, own: r.own }));
  check(r.up.length >= 2 && r.up.every((s) => s.k === 0 && s.head === 0 && s.armBack === 0), 'GET-UP: after the revive the blend has unwound and the painter sees the standing posture again', J(r.up.slice(-2)));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
