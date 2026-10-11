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
//
// v0.30.x summon-plant (per user: "ensure that the summons do not appear as floating and their feet are all grounded on
// the floor / platform"): the art is three-quarter view, so with the LOWEST paw on the line the far paws hung above the
// floor (the werewolf's ~12 px). Each pet now sinks by its far paws' height (_LX_SUMMON_FAR_FOOT x its content height)
// + 1 px, so the expected delta is that - not 0. The v0.30.749 complaint (far paws 7-10 px UNDER) stays excluded by TOL.
//
// v0.30.1681 summon-feet (refined 1683 / 1684, per user "the 2 legs ... touching or below the floor line"): the plant is read
// from EACH frame - _summonFeetFrac finds the planted paws and the HIGHER one lands 2 px into the line, the sink capped at
// _LX_SUMMON_FOOT_CAP; _LX_SUMMON_FAR_FOOT stays in the game for the record only. The expected delta is that rule applied to the
// frame actually drawn (summon_footing_test pins the per-foot depths). Since v0.30.1530 the werewolf takes one of the five shared
// slots and sends the oldest pack wolf home. Draws are captured inside drawWolf (see the capture block), and the forest's mobs are
// cleared while measuring: a pet that chases or bites leaves the floor.
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
    // dc2cea4ed v0.30.1554: at Lv 90 the Lv-20 captains teaser film (and any other story beat) would play and
    // pause the world mid-measurement - mark every beat seen before acting
    player._storyBeatsSeen = player._storyBeatsSeen || {};
    try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    player._storyBeatsSeen.captains_teaser = true;
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
    { const _w = (player.pack || []).find((w) => w && w.life > 0); if (_w) all.push({ p: _w, name: 'Call of the Wild' }); }   // pack[0] is the one the werewolf sent home
    if (player.ultPet) all.push({ p: player.ultPet, name: 'Apex Bond' });
    // park the rest far away so their draws cannot be mistaken for these
    (player.pack || []).filter((p) => !all.some((a) => a.p === p)).forEach((p, i) => { p.x = player.x - 1400 - i * 120; });
    out.summoned = all.length;
    out.cap = (player.pet ? 1 : 0) + (player.ultPet ? 1 : 0) + (player.pack || []).filter((w) => w && w.life > 0).length;   // v0.30.1530: the werewolf holds a slot
    // park them on the player's own floor, spaced apart, and let gravity settle them
    // hold each summon at its own lane and let ONLY gravity act, so the AI cannot walk it off the
    // spot between the settle and the capture
    // the art first: under a loaded sweep the summon sprites can still be decoding, and drawWolf then paints its shape fallback
    // (no image to measure - "never drawn")
    for (let i = 0; i < 300 && !['wolf', 'wolf_alpha', 'werewolf'].every((k) => LX_SUMMON[k] && ((typeof _lxSummonReady === 'function') ? _lxSummonReady(LX_SUMMON[k]) : (LX_SUMMON[k].complete && LX_SUMMON[k].naturalWidth > 0))); i++) await sleep(100);
    game.monsters.length = 0;   // nothing to hunt: a pet that chases or bites leaves the floor
    const lane = all.map((a, i) => player.x + 100 + i * 180);
    all.forEach((a, i) => { a.p.x = lane[i]; a.p.y = player.y; a.p.vy = 0; });
    for (let k = 0; k < 90; k++) {
      all.forEach((a, i) => { a.p.x = lane[i]; a.p.vx = 0; });
      await frame();
    }

    // Wrap drawWolf (the game's own summon draw) so each image belongs to the pet being drawn, and is measured in the space drawWolf
    // draws in - its entry transform. A left-facing pet is drawn mirrored (translate + scale(-1, 1), drawImage at 0,0) and the canvas
    // can carry a render scale, so a raw drawImage rect is not where the pet is. The plan is the draw's own rule on the frame it drew
    // (v0.30.1681 _summonFeetFrac: the higher planted paw lands 2 px into the line, capped at _LX_SUMMON_FOOT_CAP).
    let seen = [], cur = null, wolfCalls = 0, wolfImgs = 0;
    const _orig = CanvasRenderingContext2D.prototype.drawImage, _origWolf = drawWolf;
    drawWolf = function (pet) { const prev = cur; cur = { pet, base: ctx.getTransform() }; wolfCalls++; try { return _origWolf.apply(this, arguments); } finally { cur = prev; } };
    CanvasRenderingContext2D.prototype.drawImage = function (img, ...a) {
      try {
        if (cur && this === ctx && a.length >= 4) {
          wolfImgs++;
          const [dx, dy, dw, dh] = a.length === 8 ? a.slice(4) : a;
          const f = (typeof _summonContentBottomFrac === 'function') ? _summonContentBottomFrac(img) : 1;
          if (f < 0.999 && dw > 20 && dh > 20) {
            const rel = cur.base.inverse().multiply(this.getTransform());
            const p1 = rel.transformPoint({ x: dx, y: dy }), p2 = rel.transformPoint({ x: dx + dw, y: dy + dh });
            const top = Math.min(p1.y, p2.y), hh = Math.abs(p2.y - p1.y);
            seen.push({ pet: cur.pet, feet: top + hh * f, dh: hh,
              plan: Math.round(Math.min((typeof _LX_SUMMON_FOOT_CAP === 'number') ? _LX_SUMMON_FOOT_CAP : 16, _summonFeetFrac(img).gap * hh)) + 2 });
          }
        }
      } catch (e) {}
      return _orig.apply(this, [img, ...a]);
    };
    const hits = [];
    const done = new Set();
    for (let k = 0; k < 60 && done.size < all.length; k++) {
      all.forEach((a, i) => { a.p.x = lane[i]; a.p.vx = 0; }); game.monsters.length = 0;
      seen = [];
      await frame();
      for (const d of seen) {
        const o = all.find((a) => a.p === d.pet); if (!o || done.has(o.name) || o.p.onGround === false) continue;
        done.add(o.name);
        hits.push({ name: o.name, feet: Math.round(d.feet), floor: Math.round(o.p.y + (o.p.h || 0)), drawH: Math.round(d.dh), plan: d.plan });
      }
    }
    CanvasRenderingContext2D.prototype.drawImage = _orig; drawWolf = _origWolf; out.draws = { wolfCalls, wolfImgs };
    out.hits = hits;
    const _key = { 'Wild Bond': 'wolf_alpha', 'Call of the Wild': 'wolf_alpha', 'Apex Bond': 'werewolf' };   // player.master = beastmaster
    for (const h of hits) h.exp = (h.plan != null) ? h.plan : 0;   // v0.30.1681: the draw's own rule on the frame it drew
    return out;
  });
  console.log(`build ${r.ver}   summons up: ${r.summoned}   shared wolf cap in use: ${r.cap}   drawWolf calls / images: ${r.draws ? r.draws.wolfCalls + ' / ' + r.draws.wolfImgs : '?'}`);
  for (const h of r.hits) console.log(`  ${h.name.padEnd(18)} drawH ${String(h.drawH).padStart(4)}   feet y=${h.feet}  floor y=${h.floor}  delta ${h.feet - h.floor >= 0 ? '+' : ''}${h.feet - h.floor}px  (planned +${h.exp}px)`);
  const byName = (n) => r.hits.filter((h) => h.name === n);
  for (const n of ['Wild Bond', 'Call of the Wild', 'Apex Bond']) {
    const got = byName(n);
    ok(`${n}: planted by its higher planted paw, so every paw meets the floor (not floating, not sunk)`,
      got.length > 0 && got.every((h) => h.exp >= 2 && Math.abs(h.feet - h.floor - h.exp) <= TOL),
      got.length ? got.map((h) => (h.feet - h.floor >= 0 ? '+' : '') + (h.feet - h.floor) + 'px vs +' + h.exp + 'px').join(', ') : 'never drawn');
  }
  ok('every wolf summon is level (none sunk, none floating)',
    r.hits.length > 0 && r.hits.every((h) => h.exp >= 2 && Math.abs(h.feet - h.floor - h.exp) <= TOL),
    `${r.hits.length} drawn, worst ${r.hits.reduce((m, h) => Math.max(m, Math.abs(h.feet - h.floor - h.exp)), 0)}px off the planned plant`);
  ok('the shared wolf cap is 5', r.cap === 5, `pet + werewolf + pack = ${r.cap}`);
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
