// THE DOWNED BODY FALLS TO THE FLOOR (v0.30.1029; the sticker skull v0.30.1037).
//
// Per user, with a screenshot of a downed hero parked in mid-air beside Aetherion: "the downed character should fall to
// the ground / platform, not remain hovering midair". _coopDownedTick zeroed vy every frame, so a lethal hit taken in a
// jump froze the body where it was for the whole 30 s window. Now the tick runs the hitstun branch's gravity + collision
// step until a platform holds the body. Reads the live game:
//   - a solo hero downed 220 px above the town floor lands on it within a second (y grows, onGround, then y holds)
//   - still down, hp held at 1, the banner up, the countdown running
//   - the card is the skull-and-crossbones plate: the skull svg, the title, the first-div subtitle, the last-div rule
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/downed_falls_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11372';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const src = readFileSync(PAGE, 'utf8');
check(src.includes('the body keeps falling under gravity until a platform holds it'), 'static: the downed tick carries the fall');
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
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _coopTryDowned === 'function', null, { timeout: 180000 });
  const r = await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { tutorial_intro: true, everdawn_welcome: true }); player._tutorialSeen = true;
    applyClass('warrior'); player.level = 60; player.talents = { warrior: 'x' }; player._tutorialSeen = true;
    try { closeAllModals(); } catch (e) {}
    loadMap('town', 300); await new Promise((r) => setTimeout(r, 1500)); try { closeAllModals(); } catch (e) {} game.paused = false;
    // let the hero settle on the floor, remember it, then lift the body 220 px and down it there
    // wait for the hero to actually stand (the arrival can take a moment on a slow frame; a fixed 600 ms read him mid-air once on v0.30.1036)
    for (let i = 0; i < 80 && !player.onGround; i++) await new Promise((r) => setTimeout(r, 50));
    const floorY = player.y, groundedBefore = !!player.onGround;
    player.y = floorY - 220; player.vy = 0; player.onGround = false; player.hp = (typeof getMaxHp === 'function') ? getMaxHp() : player.hp;
    const startY = player.y;
    const downed = _coopTryDowned();
    const t0 = performance.now(); const trace = [];
    for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 50)); trace.push([Math.round(performance.now() - t0), Math.round(player.y), !!player.onGround]); if (player.onGround && i > 4) break; }
    await new Promise((r) => setTimeout(r, 400));
    const el = document.getElementById('coop-downed-banner'); const secs = document.getElementById('coop-downed-secs');
    const s1 = secs ? secs.textContent : null; await new Promise((r) => setTimeout(r, 1100)); const s2 = secs ? secs.textContent : null;
    const divs = el ? [...el.querySelectorAll('div')] : [];
    return { downed, groundedBefore, floorY: Math.round(floorY), startY: Math.round(startY), endY: Math.round(player.y), onGround: !!player.onGround, stillDown: !!player._downed, hp: player.hp, trace: trace.slice(-4),
      card: el ? { skull: !!el.querySelector('svg.cd-skull'), title: (el.querySelector('.cd-title') || {}).textContent || '', firstDiv: divs[0] ? divs[0].className : null, lastDiv: divs.length > 1 ? divs[divs.length - 1].className : null, btn: (document.getElementById('coop-downed-skip') || {}).textContent, secs: [s1, s2], width: Math.round(el.getBoundingClientRect().width), font: getComputedStyle(el).fontFamily.slice(0, 8),
        skullW: Math.round((el.querySelector('svg.cd-skull') || el).getBoundingClientRect().width), skullBottom: Math.round((el.querySelector('svg.cd-skull') || el).getBoundingClientRect().bottom), skullTop: Math.round((el.querySelector('svg.cd-skull') || el).getBoundingClientRect().top), titleTop: Math.round((el.querySelector('.cd-title') || el).getBoundingClientRect().top), plateAlpha: (getComputedStyle(el).backgroundImage.match(/rgba\(46, 8, 16, ([\d.]+)\)/) || [])[1] } : null };
  });
  check(r.downed && r.groundedBefore, 'setup: the hero stood on the town floor, then went down 220 px above it', J({ floorY: r.floorY, startY: r.startY }));
  // it lands on the first platform under it - in town that is a ledge above the floor at this x - and holds there
  check(r.endY > r.startY + 100 && r.onGround && r.endY <= r.floorY + 4 && r.trace.length && r.trace[r.trace.length - 1][1] === r.endY, `FALLS: the downed body dropped onto the platform beneath it and rests there (y ${r.startY} -> ${r.endY}, the floor at ${r.floorY})`, J({ trace: r.trace, onGround: r.onGround }));
  check(r.stillDown && r.hp === 1, 'STILL DOWN: the fall did not end the window - down, hp held at 1', J({ down: r.stillDown, hp: r.hp }));
  check(r.card && r.card.skull && /DOWNED/.test(r.card.title) && r.card.firstDiv === 'cd-sub' && r.card.lastDiv === 'cd-rule' && r.card.btn === '▸ Respawn now' && /^Nunito/.test(r.card.font), 'CARD: the skull-and-crossbones plate - skull svg, DOWNED title, the subtitle first, the rule line last, the Respawn button', J(r.card));
  check(r.card && r.card.secs[0] !== r.card.secs[1], 'COUNTDOWN: the seconds tick while the body lies there', J(r.card && r.card.secs));
  // v0.30.1037 the sticker: the skull is 200+ px wide, the words start under it, the plate is at most 340 wide and about three-quarters opaque
  check(r.card && r.card.skullW >= 200 && r.card.skullTop >= 0 && r.card.titleTop >= r.card.skullBottom - 24 && r.card.width <= 340 && r.card.plateAlpha && parseFloat(r.card.plateAlpha) <= 0.8, 'STICKER: a 200+ px skull-and-bones fully on a 760 px screen, the title under it, a plate no wider than 340 at about three-quarters opacity', J({ skullW: r.card && r.card.skullW, skullTop: r.card && r.card.skullTop, skullBottom: r.card && r.card.skullBottom, titleTop: r.card && r.card.titleTop, width: r.card && r.card.width, alpha: r.card && r.card.plateAlpha }));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
