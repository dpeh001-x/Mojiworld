// HEAVY SWINGS REACH THE FLOOR (v0.30.1424). A bigMelee 'swing' fires a hit band at y = m.y + 0.3 m.h, swingH tall.
// Authored against ~110 px boxes, that band always ran down past the swinger's feet; once v0.30.420 grew the boxes to
// their art it floated clear of a grounded player on nine swingers (Ossuary Tyrant, Echo Knight, Path's Bane,
// Legosaurus, the Sundered Smith, the Tower Sovereign, and the Aries, Capricorn and Pisces signs): the telegraph ran,
// the swing drew, and nothing standing could be hit. v0.30.424 had already made the TRIGGER feet-to-feet ("within
// swingH of my floor line"); the band now means the same thing - its bottom sits on the swinger's floor line
// whenever it would float, and a band that already reached the floor is untouched.
//   1. every swinger, spawned with its runtime box: the band reaches its own floor line; bands that already did keep
//      their top exactly;
//   2. a REAL telegraphed swing, fired by the game's own bigMelee code, lands on a player standing in range - for
//      five of the nine that could not, and one small swinger as the control;
//   3. the danger zone drawn during that telegraph is the band that hits (same y and h).
//   node scripts/heavy_swing_band_test.mjs [port]      (MOJI_SERVE_ROOT overrides the served tree)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.argv[2] || process.env.PORT || 10247); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const FIRE = ['ossuaryTyrant', 'towerSovereign', 'legosaurus', 'zodiac_pisces', 'zodiac_aries', 'nougatBear'];
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  ' + JSON.stringify(note) : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof spawnMonster === 'function' && typeof monsterTypes === 'object', null, { timeout: 180000 }); await page.waitForTimeout(5000);
  const r = await page.evaluate(async (FIRE) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const out = { ver: GAME_VERSION, rows: [], fire: {} };
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {} try { _cineScoreStop(1, false); } catch (e) {}
    try { loadMap('forest', 300); } catch (e) {} await sleep(600); player.level = 99; player.maxHp = player.hp = 1e7;
    game.paused = false; { const tl = performance.now(); while (!player.onGround && performance.now() - tl < 4000) await sleep(30); } await sleep(200); game.paused = true;   // stand on the ground first: its top is the floor line
    const floor = player.y + player.h; out.landed = !!player.onGround; const band = (m, sh) => (typeof _lxSwingBandY === 'function') ? _lxSwingBandY(m, sh) : m.y + m.h * 0.3;
    const spawn1 = (type) => { game.monsters.length = 0; game.projectiles = []; const def = monsterTypes[type];
      spawnMonster(player.x + 300, floor - (def.h || 40), type, !!(def.boss || def.isBoss || /^zodiac_/.test(type)));
      const m = game.monsters.filter((x) => x && x.type === type).pop(); if (m) { m.y = floor - m.h; m.onGround = true; } return m; };
    game.paused = true;
    for (const type of Object.keys(monsterTypes).filter((t) => monsterTypes[t].traits && monsterTypes[t].traits.bigMelee && monsterTypes[t].traits.bigMelee.kind !== 'smash')) {
      let m; try { m = spawn1(type); } catch (e) { out.rows.push({ type, err: String(e.message).slice(0, 80) }); continue; }
      if (!m) { out.rows.push({ type, err: 'no spawn' }); continue; }
      const sh = m.traits.bigMelee.swingH || 80, y0 = band(m, sh), old = m.y + m.h * 0.3;
      out.rows.push({ type, h: m.h, sh, bottomAbove: Math.round(floor - (y0 + sh)), oldReached: old + sh >= floor, topKept: Math.abs(y0 - old) < 0.01 });
    }
    // a REAL swing: the game's own bigMelee telegraph and fire, at a player standing still in range
    const oMid = window._lxMidSwing, oWorthy = window._lxZoneWorthy, oTouch = window._mobTouchBox;
    for (const type of FIRE) {
      const m = spawn1(type); if (!m) { out.fire[type] = { err: 'no spawn' }; continue; }
      const bm = m.traits.bigMelee, gap = Math.max(6, Math.min(40, bm.range - m.w / 2 - player.w / 2 - 10));
      window._lxMidSwing = (mm) => (mm === m ? false : oMid(mm)); window._lxZoneWorthy = () => true;   // no proximity swing in the way; the zone always drawn
      // and no touch: standing in reach of a big swinger is standing in its touch box, whose hit (and i-frames, re-armed
      // here every poll) would otherwise decide whether the swing can land
      window._mobTouchBox = (mm) => (mm === m ? { x: -1e9, y: -1e9, w: 0, h: 0 } : oTouch(mm));
      const seen = new Map(); let zone = null, res = null, hooked = null; const t0 = performance.now();
      // a swing that lands on its first frame is spliced out before a poll could see it: record it as it is pushed
      const hook = () => { const arr = game.projectiles; if (arr === hooked) return; hooked = arr;
        arr.push = function (...a) { for (const p of a) if (p && p.skill === 'swing' && p.owner === 'enemy' && !seen.has(p)) seen.set(p, { y: p.y, h: p.h, bottomAbove: Math.round(floor - (p.y + p.h)) }); return Array.prototype.push.apply(this, a); }; };
      game.paused = false;
      try {
        while (performance.now() - t0 < 12000 && !res) {
          hook(); player.x = m.x - gap - player.w; player.y = floor - player.h; player.vx = 0; player.vy = 0; player.onGround = true; player.hp = player.maxHp;
          player.invulnerable = 0; player.parryWindow = 0; m.facing = -1; m.currentHp = m.maxHp;
          if (!m._bigMeleeFiring && !(m._bigMeleeCd <= 0)) m._bigMeleeCd = 0; m._zSpentMs = 0; m._dirOpenT = 0; m._dirFleeT = 0;
          if (m._bigMeleeFiring) { try { const z = _lxAttackZones().find((q) => q.kind === 'swing'); if (z) zone = { y: z.y, h: z.h }; } catch (e) {} }   // the last telegraph frame's zone
          for (let i = game.projectiles.length - 1; i >= 0; i--) { const p = game.projectiles[i]; if (p && p.owner === 'enemy' && !seen.has(p)) game.projectiles.splice(i, 1); }   // its other attacks' shots: no i-frames from them either
          for (const [p, s] of seen) if (!game.projectiles.includes(p)) res = { ...s, consumed: p.life > 1, life: p.life };
          await sleep(16);
        }
      } finally { window._lxMidSwing = oMid; window._lxZoneWorthy = oWorthy; window._mobTouchBox = oTouch; game.paused = true; if (hooked) delete hooked.push; }
      out.fire[type] = { fired: seen.size > 0, res, zone, gap: Math.round(gap) };
    }
    return out;
  }, FIRE);
  console.log('build ' + r.ver);
  ok('the player stood on the ground before the floor line was read', r.landed, null);
  const errRows = r.rows.filter((x) => x.err);
  ok('every heavy swinger spawns', errRows.length === 0, errRows);
  const rows = r.rows.filter((x) => !x.err);
  const floating = rows.filter((x) => x.bottomAbove > 0).map((x) => `${x.type}: bottom ${x.bottomAbove} px above its floor (h ${x.h}, swingH ${x.sh})`);
  ok(`every heavy swing's band reaches its swinger's floor line (${rows.length} swingers)`, floating.length === 0, floating);
  const moved = rows.filter((x) => x.oldReached && !x.topKept).map((x) => x.type);
  ok('a band that already reached the floor is exactly where it was', moved.length === 0, moved);
  for (const type of FIRE) { const f = r.fire[type] || {};
    ok(`${type}: a real telegraphed heavy swing lands on a player standing in range`, !!(f.fired && f.res && f.res.consumed), f);
    ok(`${type}: the danger zone drawn for it is the band that hits`, !!(f.zone && f.res && Math.abs(f.zone.y - f.res.y) < 0.5 && Math.abs(f.zone.h - f.res.h) < 0.5), { zone: f.zone, hit: f.res }); }
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 300)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
