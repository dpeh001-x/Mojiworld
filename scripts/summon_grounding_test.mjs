#!/usr/bin/env node
// The wolf summons stand ON the floor, not in it.
//
// Per user: "for the apex bond summon sprites, call of the wind and wild bond summon sprites ensure
// they are levelled to the ground, right now they seem to be pushed vertically lower than they
// should."
//
// Measured on the build before the fix, with all three standing on the player's own floor (y=480):
//   Wild Bond wolf          feet drawn at y 490   10px under
//   Call of the Wild wolves feet drawn at y 490   10px under
//   Apex Bond werewolf      feet drawn at y 502   22px under
// which is exactly _SUMMON_PUSH_DOWN (10), plus _wereDrop (12) for the werewolf.
//
// This measures what is DRAWN, not the arithmetic: it hooks ctx.drawImage, takes the destination rect
// the game really passes, converts it to a visible foot line with the game's own
// _summonContentBottomFrac, and compares that against the pet's own hitbox foot line (y + h) - the
// same line _allyPlatformStep lands it on. Draws are matched to owners by horizontal centre, so the
// three skills are told apart.
//   node scripts/summon_grounding_test.mjs        MOJI_GAME_FILE / PORT
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 10889);
const TOL = 2;                       // px; the feet may sit within a couple of px of the line
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof castSkill === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(8000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const frame = () => new Promise((res) => requestAnimationFrame(res));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    loadMap('forest', 300); await sleep(2000);
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    game.paused = false;
    player.cls = 'archer'; player.job = 'ranger'; player._god = true; player.level = 90;
    player.baseAtk = 900; player.maxMp = 99999; player.mp = 99999;
    player.masteries = player.masteries || {}; player.masteries.beastmaster = true;
    if (typeof player.master !== 'undefined') player.master = 'beastmaster';
    await sleep(400);
    const out = { ver: GAME_VERSION };
    for (const id of ['wildBond', 'beastmaster_pack', 'beastmaster_ult']) {
      if (!SKILLS[id]) continue;
      for (const k of Object.keys(player._cd || {})) player._cd[k] = 0;
      player.mp = 99999;
      try { castSkill(id); } catch (e) {}
      await sleep(600);
    }
    // one of each skill: the pack's wolves are identical to each other, and six lanes ran the far
    // ones outside the camera (~±480px) where they are culled and never drawn
    const all = [];
    if (player.pet) all.push({ p: player.pet, name: 'Wild Bond' });
    if ((player.pack || []).length) all.push({ p: player.pack[0], name: 'Call of the Wild' });
    if (player.ultPet) all.push({ p: player.ultPet, name: 'Apex Bond' });
    // park the rest far away so their draws cannot be mistaken for these
    (player.pack || []).slice(1).forEach((p, i) => { p.x = player.x - 1400 - i * 120; });
    out.summoned = all.length;
    out.cap = (player.pet ? 1 : 0) + (player.pack || []).length;
    // park them on the player's own floor, spaced apart, and let gravity settle them
    // hold each summon at its own lane and let ONLY gravity act, so the AI cannot walk it off the
    // spot between the settle and the capture
    const lane = all.map((a, i) => player.x + 100 + i * 180);
    all.forEach((a, i) => { a.p.x = lane[i]; a.p.y = player.y; a.p.vy = 0; });
    for (let k = 0; k < 90; k++) {
      all.forEach((a, i) => { a.p.x = lane[i]; a.p.vx = 0; });
      await frame();
    }

    let seen = [];
    const _orig = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (img, ...a) {
      try {
        if (a.length >= 4) {
          const [dx, dy, dw, dh] = a.length === 8 ? a.slice(4) : a;
          if (dw > 100 && dh > 100) {
            const f = (typeof _summonContentBottomFrac === 'function') ? _summonContentBottomFrac(img) : 1;
            if (f < 0.999) seen.push({ cx: dx + dw / 2, feet: dy + dh * f, dh });
          }
        }
      } catch (e) {}
      return _orig.apply(this, [img, ...a]);
    };
    // One frame at a time, with the foot lines read immediately after that same frame - a pet that is
    // still settling moves its own y between a draw and a later read, which otherwise shows up as a
    // bogus delta. Stop as soon as all three skills have been measured.
    const hits = [];
    const done = new Set();
    for (let k = 0; k < 20 && done.size < all.length; k++) {
      all.forEach((a, i) => { a.p.x = lane[i]; a.p.vx = 0; });
      seen = [];
      await frame();
      const owners = all.map((a) => ({ name: a.name, cx: a.p.x + (a.p.w || 0) / 2, foot: a.p.y + (a.p.h || 0), settled: a.p.onGround !== false }));
      for (const d of seen) {
        let best = null;
        for (const o of owners) { const dd = Math.abs(o.cx - d.cx); if (!best || dd < best.dd) best = { o, dd }; }
        if (!best || best.dd > 90 || !best.o.settled) continue;
        if (done.has(best.o.name)) continue;
        done.add(best.o.name);
        hits.push({ name: best.o.name, feet: Math.round(d.feet), floor: Math.round(best.o.foot), drawH: Math.round(d.dh) });
      }
    }
    CanvasRenderingContext2D.prototype.drawImage = _orig;
    out.hits = hits;
    return out;
  });
  console.log(`build ${r.ver}   summons up: ${r.summoned}   shared wolf cap in use: ${r.cap}`);
  for (const h of r.hits) console.log(`  ${h.name.padEnd(18)} drawH ${String(h.drawH).padStart(4)}   feet y=${h.feet}  floor y=${h.floor}  delta ${h.feet - h.floor >= 0 ? '+' : ''}${h.feet - h.floor}px`);
  const byName = (n) => r.hits.filter((h) => h.name === n);
  for (const n of ['Wild Bond', 'Call of the Wild', 'Apex Bond']) {
    const got = byName(n);
    ok(`${n}: drawn on its foot line, not under it`,
      got.length > 0 && got.every((h) => Math.abs(h.feet - h.floor) <= TOL),
      got.length ? got.map((h) => (h.feet - h.floor >= 0 ? '+' : '') + (h.feet - h.floor) + 'px').join(', ') : 'never drawn');
  }
  ok('every wolf summon is level (none sunk, none floating)',
    r.hits.length > 0 && r.hits.every((h) => Math.abs(h.feet - h.floor) <= TOL),
    `${r.hits.length} drawn, worst ${r.hits.reduce((m, h) => Math.max(m, Math.abs(h.feet - h.floor)), 0)}px off`);
  ok('the shared wolf cap is 5', r.cap === 5, `pet + pack = ${r.cap}`);
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
