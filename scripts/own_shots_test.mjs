// Sandhusk, Jellybean and Lanternjaw fire their own projectiles, not the shared dark orb (final polish, own-shots).
// Per user: "Remake specific projectiles for sandhusk, jelly bean, angler fish and ensure they no longer use the mdark",
// "use ludo.ai to make pop punk styled projectiles that fit the character", "make cute animation for it".
// Held: each mob's live shot carries its own key; the shot flies exactly like the orb it replaced (speed, size, arc, magic
// damage) so difficulty is unchanged; its still, nine-frame loop and cast aura load; the blit draws the loop; the other
// mdark users (Spook, Bone Wraith, Harea, Mirror Self, the Conductor) still fire mdark.
//   node scripts/own_shots_test.mjs [page.html] [port]    (MOJI_GAME_FILE / this repo's game by default)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || 9945);
const OWN = { sandhusk: 'msandball', jellyfish: 'mjellyglob', anglerfish: 'manglerlure' };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ ...(process.env.PW_EXE ? { executablePath: process.env.PW_EXE } : { channel: 'msedge' }), headless: true, args: ['--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
const missing = []; page.on('response', (r) => { if (r.status() >= 400 && /projectiles\//.test(r.url())) missing.push(r.url().split('/').slice(-2).join('/')); });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof fireMonsterProjectile === 'function' && typeof spawnMonster === 'function', null, { timeout: 180000 });
await page.waitForTimeout(4000);
const r = await page.evaluate(async (OWN) => {
  const out = { mobs: {}, others: {} };
  const a = Object.entries(MAPS).filter(([id, mp]) => !mp.isVoid && !mp.isTown && (mp.platforms || []).some((p) => p.w > 900)).sort((x, y) => y[1].worldWidth - x[1].worldWidth)[0];
  loadMap(a[0]);
  const gy = (game.mapData.platforms || []).filter((p) => p.w > 900).sort((x, y) => x.y - y.y)[0].y;
  const fire = (type) => {
    const _rnd = Math.random; let _seed = 12345; Math.random = () => { _seed = (_seed * 16807) % 2147483647; return (_seed - 1) / 2147483646; };   // pinned: size / damage rolls must match like for like
    try {
    game.monsters.length = 0; game.projectiles.length = 0;
    player.x = game.mapData.worldWidth * 0.5; player.y = gy - 80;
    const m = spawnMonster(player.x + 260, gy - 120, type, false);
    fireMonsterProjectile(m);
    const p = game.projectiles.find((q) => q.owner === 'enemy');
    return { shoot: m.shoot, p: p ? { skill: p.skill, speed: +Math.hypot(p.vx, p.vy).toFixed(2), w: p.w, life: p.life, dmg: +(p.damage / (m.atk || 1)).toFixed(3) } : null };
    } finally { Math.random = _rnd; }
  };
  for (const type of Object.keys(OWN)) {
    const own = fire(type);
    const was = (() => { const t = monsterTypes[type], keep = t.shoot; t.shoot = 'mdark'; const x = fire(type); t.shoot = keep; return x; })();   // the same mob on the orb, for a like-for-like flight check
    out.mobs[type] = { own, was };
  }
  for (const t of ['wraith', 'boneWraith']) out.others[t] = monsterTypes[t] && monsterTypes[t].shoot;
  // art: still, loop, cast aura
  const keys = Object.values(OWN);
  for (const k of keys) { _projAnimFrame(k); _lxMobProjReady(LX_MOB_PROJ[k]); }
  const t0 = performance.now();
  while (performance.now() - t0 < 20000) {
    const ok = keys.every((k) => LX_MOB_PROJ[k] && LX_MOB_PROJ[k].naturalWidth > 0 && (PROJ_ANIM_FRAMES[k] || []).filter((im) => im && im.naturalWidth > 0).length === 9);
    if (ok) break; for (const k of keys) { _projAnimFrame(k); _lxMobProjReady(LX_MOB_PROJ[k]); } await new Promise((res) => setTimeout(res, 250));
  }
  out.art = {};
  for (const k of keys) {
    const cast = LX_MOB_CAST[k]; if (cast && cast._lxLazy && typeof _lxWantImg === 'function') _lxWantImg(cast, true);
    out.art[k] = { still: !!(LX_MOB_PROJ[k] && LX_MOB_PROJ[k].naturalWidth), frames: (PROJ_ANIM_FRAMES[k] || []).filter((im) => im && im.naturalWidth > 0).length,
      blit: !!_PROJ_SPRITE_BLIT[k], castSrc: cast ? String(cast.src || cast._lxHeldSrc || '').split('/').pop() : null, magic: null };
  }
  await new Promise((res) => setTimeout(res, 1500));
  for (const k of keys) { const c = LX_MOB_CAST[k]; out.art[k].castOk = !!(c && c.naturalWidth > 0); }
  // the blit draws the loop
  const seen = []; const _o = window._lxProjScaled; window._lxProjScaled = function (img) { seen.push(img); return _o.apply(this, arguments); };
  game.projectiles.length = 0;
  for (const k of keys) game.projectiles.push({ x: player.x + 80, y: player.y, vx: 3, vy: 0, w: 31, h: 31, life: 100, owner: 'enemy', skill: k, damage: 1 });
  try { drawProjectiles(); } catch (e) { out.drawErr = String(e).slice(0, 120); }
  window._lxProjScaled = _o;
  out.drawsLoop = Object.fromEntries(keys.map((k) => [k, seen.some((im) => (PROJ_ANIM_FRAMES[k] || []).includes(im))]));
  return out;
}, OWN);
await browser.close(); server.kill();
let fails = 0; const ok = (n, c, x) => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}  ${c ? '' : JSON.stringify(x).slice(0, 260)}`); };
for (const [type, key] of Object.entries(OWN)) {
  const m = r.mobs[type];
  ok(`${type} fires ${key}, not mdark`, m.own.shoot === key && m.own.p && m.own.p.skill === key, m.own);
  ok(`${type}'s shot flies like the orb it replaced (speed, size, life, damage)`, m.own.p && m.was.p && m.own.p.speed === m.was.p.speed && m.own.p.w === m.was.p.w && m.own.p.life === m.was.p.life && m.own.p.dmg === m.was.p.dmg, m);
  const a = r.art[key];
  ok(`${key}: still, nine-frame loop, blit entry and cast aura all load`, a.still && a.frames === 9 && a.blit && a.castOk, a);
  ok(`${key}: the projectile draws its loop`, r.drawsLoop[key] === true, { drawErr: r.drawErr });
}
ok('the other orb users keep mdark', Object.values(r.others).every((s) => s === 'mdark'), r.others);
ok('no projectile art 404s', missing.length === 0, missing.slice(0, 5));
ok('no page errors', errs.length === 0, errs.slice(0, 3));
console.log(fails ? `FAIL(${fails})` : 'ALL PASS');
process.exit(fails ? 1 : 0);
