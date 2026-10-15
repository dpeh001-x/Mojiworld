// BOSS SHOTS OF THEIR OWN (per user): Mirror Self throws a cracked violet mirror for every class kit, and the Sundered Smith a
// smaller glob of molten iron, instead of art borrowed from common monsters. Through the real spawnMonster, fireMonsterProjectile,
// projectile update and drawProjectiles:
//   1. who fires what: Mirror Self mmirror (mage) / mmirrorsplinter (warrior, archer) / mmirrortoxic (rogue), the Smith mmolten;
//      Spook and Bone Wraith keep mdark, the Smithgolem mforgespark, the Tomb Keeper msplinter, Rotter and Pondhop mtoxic
//   2. each mirror shot leaves the hand exactly as the shot it replaced (speed, arc, size, life, damage) - same mob, same dice -
//      and falls the same; the molten iron flies and falls as the ember did, but is smaller (size base 24 vs 34)
//   3. drawn: each new shot draws only its own still / loop (the three mirror kits all play the mirror's), the common shots never
//   4. the new art loads (a still and nine frames each), no 404s, no page errors
//   node scripts/boss_own_shots_test.mjs [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || process.env.PORT || 9836);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  ' + JSON.stringify(x).slice(0, 400))); };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [], miss = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  page.on('response', (r) => { if (r.status() >= 400 && /projectiles\/(anim\/)?(mmirror|mmolten)/.test(r.url())) miss.push(r.url().replace(/^.*Sprites\//, '')); });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof loadMap === 'function' && typeof fireMonsterProjectile === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(4000);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._god = true; player.invulnerable = 9e9;
    try { loadMap('forest', 300); } catch (e) {} await sleep(1500);
    game.monsters.length = 0; game.projectiles.length = 0;
    const out = { fires: {}, launch: {}, fall: {}, draws: {}, loaded: {} };
    const spawnOne = (type, cls, boss) => { player.cls = cls || 'mage'; game.monsters.length = 0; spawnMonster(player.x - 420, player.y - 40, type, !!boss, false); return game.monsters[game.monsters.length - 1]; };
    const fire = (m, shoot) => { if (shoot) m.shoot = shoot; const R0 = Math.random; Math.random = () => 0.5; try { player.vx = 0; player.vy = 0; fireMonsterProjectile(m); } finally { Math.random = R0; } const p = game.projectiles.pop(); game.projectiles.length = 0; return p; };
    const pick = (p) => p && { skill: p.skill, vx: +p.vx.toFixed(4), vy: +p.vy.toFixed(4), w: p.w, h: p.h, life: p.life, damage: p.damage };
    // 1. who fires what
    const cases = [['mirrorSelf', 'mage', 1], ['mirrorSelf', 'warrior', 1], ['mirrorSelf', 'archer', 1], ['mirrorSelf', 'rogue', 1], ['sundered_smith', 'mage', 1],
      ['wraith'], ['boneWraith'], ['smithgolem'], ['tombKeeper'], ['zombie'], ['frog']];
    for (const [type, cls, boss] of cases) { const m = spawnOne(type, cls, boss); out.fires[type + (cls ? '/' + cls : '')] = m && m.shoot; }
    // 2. leaving the hand: the same mob fires the old key and the new one with the same dice
    for (const [type, cls, oldK, newK] of [['mirrorSelf', 'mage', 'mdark', 'mmirror'], ['mirrorSelf', 'warrior', 'msplinter', 'mmirrorsplinter'],
      ['mirrorSelf', 'rogue', 'mtoxic', 'mmirrortoxic'], ['sundered_smith', 'mage', 'mforgespark', 'mmolten']]) {
      const m = spawnOne(type, cls, true); out.launch[newK] = { old: pick(fire(m, oldK)), now: pick(fire(m, newK)) };
    }
    game.monsters.length = 0;
    // ... and falling: twin shots side by side in view above the player, the game's own update for ~12 frames (off-screen shots are culled)
    game.paused = false;
    const pairs = [['mdark', 'mmirror'], ['msplinter', 'mmirrorsplinter'], ['mtoxic', 'mmirrortoxic'], ['mforgespark', 'mmolten']];
    const shots = pairs.flatMap(([a, b], i) => [a, b].map((k, j) => ({ x: player.x - 300 + i * 120 + j * 50, y: Math.max(40, player.y - 300), w: 30, h: 30, vx: 0.01, vy: 0, life: 9e9, damage: 0, owner: 'enemy', skill: k, color: '#fff' })));
    game.projectiles.push(...shots); await sleep(200);
    for (const [a, b] of pairs) { const pa = shots.find((p) => p.skill === a), pb = shots.find((p) => p.skill === b); out.fall[b] = { old: +pa.vy.toFixed(4), now: +pb.vy.toFixed(4), alive: game.projectiles.includes(pb) }; }
    game.projectiles.length = 0;
    // 4. the art loads
    const okIm = (im) => !!(im && (im.tagName === 'CANVAS' || (im.complete && im.naturalWidth > 0)));
    for (const k of ['mmirror', 'mmolten']) { _projAnimFrame(k); _lxMobProjReady(LX_MOB_PROJ[k]); }
    let t0 = performance.now(); while (performance.now() - t0 < 15000 && !['mmirror', 'mmolten'].every((k) => (PROJ_ANIM_FRAMES[k] || []).length === 9 && PROJ_ANIM_FRAMES[k].every(okIm) && okIm(LX_MOB_PROJ[k]))) { for (const k of ['mmirror', 'mmolten']) { _projAnimFrame(k); _lxMobProjReady(LX_MOB_PROJ[k]); } await sleep(100); }
    for (const k of ['mmirror', 'mmolten']) out.loaded[k] = (PROJ_ANIM_FRAMES[k] || []).filter(okIm).length + '/' + (PROJ_ANIM_FRAMES[k] || []).length + (okIm(LX_MOB_PROJ[k]) ? ' +still' : ' (no still)');
    out.sharedImage = LX_MOB_PROJ.mmirrorsplinter === LX_MOB_PROJ.mmirror && LX_MOB_PROJ.mmirrortoxic === LX_MOB_PROJ.mmirror;
    // 3. what each shot draws: every frame or still handed to drawImage on the game canvas, traced through the _lxProjScaled bake
    const origin = new Map(), tag = (im, t) => { if (im && typeof im === 'object' && !origin.has(im)) origin.set(im, t); return im; };
    const PS = window._lxProjScaled, PA = window._projAnimFrame, P = CanvasRenderingContext2D.prototype, di = P.drawImage;
    for (const k of ['mdark', 'msplinter', 'mtoxic', 'mforgespark', 'mmirror', 'mmolten']) tag(LX_MOB_PROJ[k], 'still:' + k);
    window._lxProjScaled = function (img) { const r = PS.apply(this, arguments); if (img && origin.has(img)) tag(r, origin.get(img)); return r; };
    window._projAnimFrame = function () { const r = PA.apply(this, arguments); if (r) for (const k in PROJ_ANIM_FRAMES) if (PROJ_ANIM_FRAMES[k] && PROJ_ANIM_FRAMES[k].includes(r)) { tag(r, 'set:' + k); break; } return r; };
    const seen = {};
    P.drawImage = function (im) { const t = (this === ctx) && im && origin.get(im); if (t && seen.cur) seen.cur[t] = (seen.cur[t] | 0) + 1; return di.apply(this, arguments); };
    try {
      for (const k of ['mmirror', 'mmirrorsplinter', 'mmirrortoxic', 'mmolten', 'mdark', 'msplinter', 'mtoxic', 'mforgespark']) {
        game.projectiles.length = 0; seen.cur = {};
        const p = { x: player.x + 160, y: player.y - 120, w: 40, h: 40, vx: -5, vy: 0, life: 9e9, damage: 0, owner: 'enemy', skill: k, color: '#fff', noGravity: true };
        game.projectiles.push(p);
        const tt = performance.now(); while (performance.now() - tt < 500) { p.x = player.x + 160; p.y = player.y - 120; p.life = 9e9; await sleep(16); }
        out.draws[k] = seen.cur;
      }
    } finally { P.drawImage = di; window._lxProjScaled = PS; window._projAnimFrame = PA; seen.cur = null; game.projectiles.length = 0; }
    return out;
  });
  const F = R.fires;
  ok('Mirror Self throws the mirror for every class kit (mage / warrior / archer / rogue)', F['mirrorSelf/mage'] === 'mmirror' && F['mirrorSelf/warrior'] === 'mmirrorsplinter' && F['mirrorSelf/archer'] === 'mmirrorsplinter' && F['mirrorSelf/rogue'] === 'mmirrortoxic', F);
  ok('the Sundered Smith throws his molten iron', F['sundered_smith/mage'] === 'mmolten', F);
  ok('the common monsters keep their shots (Spook, Bone Wraith, Smithgolem, Tomb Keeper, Rotter, Pondhop)', F.wraith === 'mdark' && F.boneWraith === 'mdark' && F.smithgolem === 'mforgespark' && F.tombKeeper === 'msplinter' && F.zombie === 'mtoxic' && F.frog === 'mtoxic', F);
  for (const k of ['mmirror', 'mmirrorsplinter', 'mmirrortoxic']) { const L = R.launch[k]; ok(`${k} leaves the hand exactly as ${L.old && L.old.skill} did (speed, arc, size, life, damage)`, !!(L.old && L.now) && ['vx', 'vy', 'w', 'h', 'life', 'damage'].every((f) => L.old[f] === L.now[f]), L); }
  { const L = R.launch.mmolten; ok('the molten iron flies as the ember did (speed, arc, life, damage)', !!(L.old && L.now) && ['vx', 'vy', 'life', 'damage'].every((f) => L.old[f] === L.now[f]), L);
    ok('the molten iron is smaller than the ember (per user): hitbox x24/34', !!(L.old && L.now) && L.now.w < L.old.w && Math.abs(L.now.w / L.old.w - 24 / 34) < 0.03 && L.now.h === L.now.w, L); }
  for (const [k, f] of Object.entries(R.fall)) ok(`${k} falls as the shot it replaced`, f.alive && f.old === f.now, f);
  ok('the splinter kit really does fall (the comparison is not vacuous)', R.fall.mmirrorsplinter && R.fall.mmirrorsplinter.now > 0.5, R.fall);
  for (const [k, v] of Object.entries(R.loaded)) ok(`${k}: nine frames and the still load`, v === '9/9 +still', v);
  ok('the three mirror kits share one image', R.sharedImage === true);
  const own = { mmirror: 'mmirror', mmirrorsplinter: 'mmirror', mmirrortoxic: 'mmirror', mmolten: 'mmolten', mdark: 'mdark', msplinter: 'msplinter', mtoxic: 'mtoxic', mforgespark: 'mforgespark' };
  for (const [k, art] of Object.entries(own)) {
    const d = R.draws[k] || {}, tags = Object.keys(d);
    const animated = k.startsWith('mmirror') || k === 'mmolten';
    ok(`${k} draws only the ${art} art${animated ? ', its loop playing' : ''}`, tags.length > 0 && tags.every((t) => t === 'set:' + art || t === 'still:' + art) && (!animated || (d['set:' + art] | 0) > 0), d);
  }
  ok('no 404 for the new art', miss.length === 0, miss);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
