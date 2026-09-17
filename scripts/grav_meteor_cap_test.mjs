// Gravitos's falling meteors take at most 30,000 HP (grav-meteor-cap): on the way down, on landing, and on a co-op
// guest; an ordinary hit under the cap is untouched; another boss's meteor is not capped.
//   PORT=9781 node scripts/grav_meteor_cap_test.mjs [candidate.html]      (MOJI_GAME_FILE also honoured)
import { chromium } from 'playwright-core';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '9781';
const FILE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: { ...process.env, MOJI_GAME_FILE: FILE } });
await new Promise((r) => setTimeout(r, 1500));
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const ctxB = await browser.newContext({ viewport: { width: 1630, height: 944 }, serviceWorkers: 'block' });
  const page = await ctxB.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  const TBL = path.join(process.env.TEMP, 'gs_tables');
  await page.route(/\/data\/(sprite_bbox|sprite_edges|sprite_frame_index)\.js/, (r) => { try { r.fulfill({ status: 200, contentType: 'application/javascript', body: readFileSync(path.join(TBL, r.request().url().split('/').pop().split('?')[0])) }); } catch (e) { r.continue(); } });
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof hitMonster === 'function', null, { timeout: 120000 });
  await page.evaluate(() => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false;
    player.level = 100; player.cls = 'mage'; player._god = false;
    loadMap('gravitosArena'); game.paused = false;
  });
  await page.waitForFunction(() => game.monsters.some((m) => m && m.type === 'gravitos' && m.currentHp > 0), null, { timeout: 60000 });
  await page.waitForFunction(() => ![...document.querySelectorAll('video')].some((v) => v.offsetParent && !v.paused && v.id.indexOf('map-bg-video') !== 0), null, { timeout: 60000 }).catch(() => {});

  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
    const out = { cap: (typeof LX_GRAV_METEOR_CAP !== 'undefined') ? LX_GRAV_METEOR_CAP : null };
    const boss = () => game.monsters.find((x) => x && x.type === 'gravitos' && x.currentHp > 0);
    const quiet = () => { const sb = document.getElementById('story-beat-overlay'); for (let k = 0; k < 12 && sb && sb.classList.contains('on'); k++) sb.click(); const bi = document.getElementById('boss-intro-overlay'); if (bi) bi.classList.remove('on'); game.paused = false;
      const m = boss(); if (m) { m.patternState = 'idle'; m.patternTimer = 0; m._instaTimer = m._rainTimer = m._soulTimer = 99999; m.x = 1900; } };
    const HP = 900000; const keepMax = window.getMaxHp; window.getMaxHp = () => HP;   // a bar big enough to read a six-figure hit off
    // one meteor, straight down on the player; returns what it took. passHit:true = skip the fall, test the LANDING alone.
    const strike = async (o, passHit) => {
      quiet(); game.hazards.length = 0; player.hp = HP; player.invulnerable = 0; player.blockTimer = 0; player._aegis = false; player.vx = player.vy = 0;
      player.x = game.camera.x + 300; player.y = 436;
      const cx = player.x + player.w / 2;
      const h = Object.assign({ type: 'meteor_warn', cx, x: cx - 90, y: 0, w: 180, h: H, radius: 90, life: 30, maxLife: 84, fireAt: 84, owner: 'enemy', color: '#aa44ff' }, o);
      if (passHit) h._passHit = true;
      game.hazards.push(h); const before = player.hp;
      for (let k = 0; k < 80 && game.hazards.includes(h) && player.hp === before; k++) { quiet(); player.x = cx - player.w / 2; await sleep(30); }
      await sleep(120);
      return { lost: Math.round(before - player.hp), passHit: !!h._passHit, src: player._lastDamageSource };
    };
    const grav = (dmg, label) => ({ damage: dmg, _gravBlue: true, _sourceLabel: label, _gravBand: (typeof _gravHeavyBand === 'function') ? _gravHeavyBand(3, 'skill') : null });
    out.fall = [await strike(grav(5e6, 'a Decay Pillar'), false), await strike(grav(5e6, 'a Crush Tendril'), false), await strike(grav(5e6, 'a Gravity Crush column'), false)];
    out.landing = await strike(grav(5e6, 'a Decay Pillar'), true);
    out.small = await strike(grav(4000, 'a Decay Pillar'), false);                       // an ordinary hit: the cap must not touch it
    out.other = await strike({ damage: 5e6, _sourceLabel: 'an Aries meteor' }, false);     // not his: uncapped
    // the co-op guest's copy
    const guest = (msg) => { quiet(); game.hazards.length = 0; player.hp = HP; player.invulnerable = 0; player.x = game.camera.x + 300; player.y = 436;
      const kI = net.isHost, kH = net.hostId, kF = window._coopFollowingHost; net.isHost = false; net.hostId = 7; window._coopFollowingHost = () => true;
      const before = player.hp; try { _coopApplyHazHit(Object.assign({ t: 'hazhit', id: 7, map: game.currentMap, x: Math.round(player.x + player.w / 2), r: 90, d: 5e6, c: '#aa44ff' }, msg)); } finally { net.isHost = kI; net.hostId = kH; window._coopFollowingHost = kF; }
      return Math.round(before - player.hp); };
    out.guestFlag = guest({ gb: 1, sl: 'x' }); out.guestLabel = guest({ sl: 'a Crush Tendril' }); out.guestOther = guest({ sl: 'an Aries meteor' });
    window.getMaxHp = keepMax; player._god = true;
    return out;
  });
  console.log(`cap ${r.cap} · fall ${JSON.stringify(r.fall.map((x) => x.lost))} · landing ${r.landing.lost} · small ${r.small.lost} · another boss ${r.other.lost} · guest flag ${r.guestFlag} label ${r.guestLabel} other ${r.guestOther}`);
  check(r.cap === 30000, 'the cap is 30,000', r.cap);
  check(r.fall.every((x) => x.passHit && x.lost === 30000), 'THE FALL: a 5,000,000-damage pillar, tendril and crush column each take exactly 30,000 on the way down (previous build: no ceiling)', r.fall);
  check(r.landing.lost > 0 && r.landing.lost <= 30000, 'THE LANDING: never more than 30,000 (the phase band may make it less)', r.landing);
  check(r.small.lost > 0 && r.small.lost < 30000, 'an ordinary hit under the cap is left alone', r.small);
  check(r.other.lost > 30000, "another boss's meteor is not capped", r.other);
  check(r.guestFlag === 30000 && r.guestLabel === 30000 && r.guestOther > 30000, "CO-OP: the guest's copy is capped by the host's flag, and by the source label if a relay drops the flag; other meteors are not", { flag: r.guestFlag, label: r.guestLabel, other: r.guestOther });
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad === 0 ? `\nall ${total} passed` : `\n${bad} of ${total} FAILED`);
process.exit(bad === 0 ? 0 : 1);
