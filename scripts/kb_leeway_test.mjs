// Knockback leeway for the Tower Sovereign and Gravitos (per user: regulate their knockback so players are not repeatedly
// punished or stuck, mainly around their OHKOs; every other boss keeps its knockback).
//   CAP 8 px/frame sideways, 5 up - LEEWAY: within 1.5 s of their last throw x0.5, then x0.25 - SHELTER: while their one-shot
//   charges x0.25, and none at all for a player standing in the light.
// Drives the game's own knock helpers on a live page, one throw at a time, reading the player's velocity after each.
//   node scripts/kb_leeway_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path'; import fs from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright-core');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const FILE = (args[0] && /\.html$/i.test(args[0])) ? args[0] : 'mojiworld_game.html';
const PORT = Number(args.find((a) => /^\d+$/.test(a)) || process.env.PORT || 11851);
let bad = 0, total = 0; const check = (ok, label, d) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${d !== undefined ? '  ' + JSON.stringify(d) : ''}`); if (!ok) bad++; };
const SRC = fs.readFileSync(path.join(ROOT, FILE), 'utf8');
check(SRC.split('_lxKbRegSet(Math.sign(m.vx) * 9, -5, _lxKbRegOwner(m));').length === 2 && SRC.split('_lxKbRegSet(Math.sign((player.x + player.w/2) - cx) * 8, -5, _lxKbRegOwner(m));').length === 2,
  "Gravitos's charge and slam throw through the regulator");
const env = { ...process.env }; if (FILE !== 'mojiworld_game.html') env.MOJI_GAME_FILE = FILE; else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _lxBodyKnock === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  const R = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.setProperty('display', 'none', 'important'); }
    window.showToast = function () {}; player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._tutorialSeen = true; player._gravitosCineSeen = true;
    player.cls = 'mage'; player.level = 100; loadMap('forest'); await wait(2500);
    const hold = () => { game.paused = true; game.hitStop = 1e9; }; hold(); window.__kbHold = setInterval(hold, 1);   // no live step between throws
    player.blockTimer = 0; game.hazards.length = 0; game.monsters.length = 0;
    const mk = (type, boss, extra) => { const m = spawnMonster(400, 300, type, boss, false) || game.monsters[game.monsters.length - 1]; Object.assign(m, extra || {}); m.vx = 0; m.vy = 0; m.x = 400; m.y = 480 - m.h; return m; };
    const sov = mk('towerSovereign', true), grav = mk('gravitos', true), krook = mk('kingKrook', true), leo = mk('zodiac_leo', true, { zodiacSign: 'leo', zodiacBoss: true }), skel = mk('skeleton', false);
    for (const m of [sov, grav, krook, leo, skel]) m.currentHp = m.maxHp;
    let T = (game.time | 0) + 1000;
    const at = (t) => { game.time = t; };
    // one throw from m's body at step t, the player standing just right of it: the resulting velocity
    const body = (m, t) => { at(t); player.x = m.x + m.w + 2; player.y = 480 - player.h; player.vx = 0; player.vy = 0; player.onGround = true;
      _lxBodyKnock(m, _lxKbTier(m), 1); return { vx: +player.vx.toFixed(2), vy: +player.vy.toFixed(2) }; };
    const out = {};
    out.owner = { sov: _lxKbRegOwner(sov), grav: _lxKbRegOwner(grav), homer: _lxKbRegOwner({ owner: 'enemy', skill: 'msovereign' }), gshot: _lxKbRegOwner({ owner: 'enemy', _srcType: 'gravitos' }),
      gband: _lxKbRegOwner({ owner: 'enemy', _gravBand: {} }), krook: _lxKbRegOwner(krook), leo: _lxKbRegOwner(leo), skel: _lxKbRegOwner(skel), shard: _lxKbRegOwner({ owner: 'enemy', skill: 'bolt' }) };
    const chain = (m) => { T += 1000; const a = body(m, T), b = body(m, T + 60), c = body(m, T + 120), d = body(m, T + 180), e = body(m, T + 180 + 91); return [a, b, c, d, e]; };
    out.sovChain = chain(sov); out.gravChain = chain(grav);
    T += 1000; out.krook = [body(krook, T), body(krook, T + 30), body(krook, T + 60)];
    T += 1000; out.leo = [body(leo, T), body(leo, T + 30), body(leo, T + 60)];
    // shelter: the Sovereign's collapse field with one zone; in it, then out of it
    T += 1000; at(T); const z = { x: 700, y: 480 - 75, w: 124, h: 75 };
    game.hazards.push({ type: 'gravitos_singularity', x: 0, y: 0, w: 4000, h: 2000, cx: 500, cy: 300, life: 200, maxLife: 300, atk: 99999, safeZones: [z] });
    const inLight = () => { player.x = z.x + z.w / 2 - player.w / 2; player.y = z.y + z.h - player.h; player.vx = 0; player.vy = 0; player.onGround = true;
      const sx = player.x; _lxBodyKnock(sov, 3, 1); return { vx: player.vx, vy: player.vy, x: player.x - sx, inside: _lxSzInside(game.hazards[game.hazards.length - 1], false) }; };
    out.shelterIn = inLight();
    T += 1000; out.shelterOut = body(sov, T);   // first of a chain, outside the light: 8 x 0.25
    game.hazards.length = 0;
    T += 1000; grav._ohkoWarnUntil = T + 120; out.gravWarn = body(grav, T); grav._ohkoWarnUntil = null;
    // an authored throw (the charge / slam helper) and a shot
    T += 1000; at(T); _lxKbRegSet(9, -5, 'gravitos'); out.charge1 = { vx: player.vx, vy: player.vy }; at(T + 30); _lxKbRegSet(9, -5, 'gravitos'); out.charge2 = { vx: player.vx, vy: player.vy };
    T += 1000; at(T); player.vx = 0; _lxKbRegSet(9, -5, 'mooma'); out.other = { vx: player.vx, vy: player.vy };
    T += 1000; at(T); player.vx = 0; player.vy = 0; player.onGround = true; _lxShotKnock({ owner: 'enemy', skill: 'msovereign', x: player.x - 40, w: 20, vx: 6, vy: 0 }, 3); out.homer = { vx: +player.vx.toFixed(2) };
    clearInterval(window.__kbHold); game.monsters.length = 0; return out;
  });
  const O = R.owner;
  check(O.sov === 'towerSovereign' && O.grav === 'gravitos' && O.homer === 'towerSovereign' && O.gshot === 'gravitos' && O.gband === 'gravitos', 'the Sovereign, Gravitos and their shots are recognised', O);
  check(O.krook === null && O.leo === null && O.skel === null && O.shard === null, 'nobody else is (King Krook, a zodiac sign, a skeleton, a plain shot)', O);
  for (const [nm, c] of [['Sovereign', R.sovChain], ['Gravitos', R.gravChain]]) {
    const v = c.map((x) => Math.abs(x.vx));
    check(v[0] > 0 && v[0] <= 8.001, `${nm}: its first throw is capped at 8 px/frame (${v[0]})`, c[0]);
    // the chain scales the RAW throw, then the cap applies: q = raw / 4, so the first is min(8, 4q) and the second 2q
    const q = v[2];
    check(q > 0 && Math.abs(v[3] - q) < 0.05 && Math.abs(v[1] - 2 * q) < 0.05 && Math.abs(v[0] - Math.min(8, 4 * q)) < 0.05, `${nm}: within 1.5 s the next throw is half, then a quarter, and stays a quarter (${v.slice(0, 4).join(' / ')}; raw ${(4 * q).toFixed(2)})`, c);
    check(Math.abs(v[4] - v[0]) < 0.05, `${nm}: after a quiet 1.5 s it is full again (${v[4]})`, c[4]);
  }
  for (const [nm, c] of [['King Krook', R.krook], ['a zodiac sign (Leo)', R.leo]]) {
    const v = c.map((x) => x.vx);
    check(v[0] > 0 && v[0] === v[1] && v[1] === v[2], `${nm} keeps its knockback: the same full throw three times in a row (${v[0]})`, c);
  }
  check(R.leo[0].vx > 8, `and Leo is not capped at 8 (${R.leo[0].vx})`, R.leo[0]);
  check(R.shelterIn.inside && R.shelterIn.vx === 0 && R.shelterIn.vy === 0 && R.shelterIn.x === 0, 'while the collapse charges, a player in the light is not thrown at all', R.shelterIn);
  const qS = Math.abs(R.sovChain[2].vx), qG = Math.abs(R.gravChain[2].vx);
  check(Math.abs(Math.abs(R.shelterOut.vx) - qS) < 0.05, `outside the light, a fresh throw is a quarter (${Math.abs(R.shelterOut.vx)} = raw / 4)`, R.shelterOut);
  check(Math.abs(Math.abs(R.gravWarn.vx) - qG) < 0.05, `during Gravitos's one-shot warning its throw is a quarter (${Math.abs(R.gravWarn.vx)})`, R.gravWarn);
  check(R.charge1.vx === 8 && R.charge1.vy === -5 && R.charge2.vx === 4.5 && R.charge2.vy === -2.5, "Gravitos's charge: capped to 8 / -5, then its 9 / -5 halved in the chain (4.5 / -2.5)", [R.charge1, R.charge2]);
  check(R.other.vx === 9 && R.other.vy === -5, "another boss's authored throw goes through untouched (9 / -5)", R.other);
  check(R.homer.vx > 0 && R.homer.vx <= 8, `a Sovereign homing shot is regulated too (${R.homer.vx})`, R.homer);
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close(); server.kill(); }
console.log(`\n${total - bad}/${total} checks passed`); process.exit(bad ? 1 : 0);
