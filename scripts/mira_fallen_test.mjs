// THE WOMAN WHO TURNED BACK (per user: the Distorted Portal's final boss after the Sundered Forge - Mira's copy - "a powerful boss with a kit
// similar to the towersovereign"). Pins, in the running game:
//   arena: the Last Step is a Lv 50 boss arena behind the Forge (a door each way) that spawns her, alone;
//   her: Lv 55, a super boss but NOT hyper (per user only the Sovereign and Gravitos are), her name unsaid, her five sets + art decode;
//   kit: the Eleven shield her (x0.12 taken) and breaking them all exposes her (x1.75); the Gate's Question covers the arena with three safe
//        steps on her floor plan; five homing Fallen Feathers; three Sand Run Out pillars wearing her sand art; Turn Back steps her to a far hero;
//   her fall clears every sand pillar, Gate and feather; Lyra VI (after V, given by Hera) is hunted here;
//   effects: the shards fly tip-first, the shard / feather / Blade-fall / warning sets are indexed and load, a Blade-fall that lands plays out.
//   node scripts/mira_fallen_test.mjs            (MOJI_SERVE_ROOT / PORT override)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'package.json')); const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 10451);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 400) : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { cwd: ROOT, stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200))); const bad = []; page.on('response', (r) => { if (r.status() >= 400 && /mira|fallenfeather|lastStep/i.test(r.url())) bad.push(r.status() + ' ' + r.url().split('/').slice(-2).join('/')); });
  await page.clock.install();
  await page.goto('http://localhost:' + PORT + '/mojiworld_game.html?dev=1', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof loadMap === 'function' && typeof MAPS === 'object', null, { timeout: 180000 }); await page.waitForTimeout(5000);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    player.cls = 'warrior'; player.level = 55; player._god = true; player._tutorialSeen = true; game.paused = false;
    const L = MAPS.lastStep || {}, out = {};
    out.arena = { lv: L.levelReq, boss: !!L.isBossArena, spawns: (L.spawns || []).map((s) => s.type).join(), back: (L.portals || []).map((p) => p.dest).join(),
      forgeDoor: !!(MAPS.sundered_forge.portals || []).find((p) => p.dest === 'lastStep'), wm: [L.wmX, L.wmY] };
    loadMap('lastStep', 300); await sleep(5000);
    const ms = (game.monsters || []).filter((q) => q.type === 'miraFallen'), m = ms[0]; window.__m = m;
    out.me = m ? { n: ms.length, others: game.monsters.length - ms.length, lv: m.level, sup: !!m.superBoss, hyper: !!m.hyperBoss, name: m.name } : null;
    for (let i = 0; i < 60; i++) { const ok = ['miraFallen', 'miraFallencast', 'miraFallencollapse'].every((k) => BOSS_ATTACK_FRAMES[k] && BOSS_ATTACK_FRAMES[k].length && BOSS_ATTACK_FRAMES[k].every((f) => f && f.complete && f.naturalWidth > 0)); if (ok) break; await sleep(250); }
    out.sets = { idle: (BOSS_IDLE_FRAMES.miraFallen || []).length, walk: (BOSS_WALK_FRAMES.miraFallen || []).length, attack: (BOSS_ATTACK_FRAMES.miraFallen || []).length, cast: (BOSS_ATTACK_FRAMES.miraFallencast || []).length, collapse: (BOSS_ATTACK_FRAMES.miraFallencollapse || []).length };
    out.art = { feather: !!LX_MOB_PROJ.mfallenfeather, col: !!LX_FX.fx_col_miraFallen, tg: !!LX_FX.tg_col_miraFallen, sand: !!LX_VFX.miraSandPillar, shard: await fetch('Sprites/monsters/miraEchoShard.webp').then((r) => r.ok).catch(() => false) };   // loaded lazily when the Eleven first rise
    const q = QUESTS.q_lyra_last || {}; out.quest = { target: q.target, prereq: q.prereq, giver: q.giver, lv: q.levelReq, story: !!q.story };
    // freeze her own clocks; each move is armed on purpose below
    m._miraElevenAt = m._miraGateAt = m._miraFeatherAt = m._miraSandAt = m._miraStepAt = 1e12; m._bigMeleeCd = 1e9; m._columnCd = 1e9; m._hgCd = 1e9;
    return out;
  });
  ok('the Last Step is a Lv 50 boss arena that spawns her, behind the Sundered Forge (a door each way)', R.arena.lv === 50 && R.arena.boss && R.arena.spawns === 'miraFallen' && /sundered_forge/.test(R.arena.back) && R.arena.forgeDoor, R.arena);
  ok('she spawns alone, Lv 55, a super boss but not hyper, her name unsaid', R.me && R.me.n === 1 && R.me.others === 0 && R.me.lv === 55 && R.me.sup && !R.me.hyper && R.me.name === 'The Woman Who Turned Back', R.me);
  ok('her five sets decode (idle 9, walk 9, Twin Verdict 16, cast 16, Gate 16) and her shot, column, warning, sand and shard art are registered', R.sets.idle === 9 && R.sets.walk === 9 && R.sets.attack === 16 && R.sets.cast === 16 && R.sets.collapse === 16 && Object.values(R.art).every(Boolean), { sets: R.sets, art: R.art });
  ok('Lyra VI (after V, given by Hera, Lv 50) is hunted here', R.quest.target === 'miraFallen' && [].concat(R.quest.prereq).indexOf('q_lyra_forge') >= 0 && R.quest.giver === 'Hera' && R.quest.lv === 50 && R.quest.story, R.quest);
  const now0 = await page.evaluate(() => Date.now()); await page.clock.pauseAt(now0 + 1000);
  const step = async (n, fn) => { for (let i = 0; i < n; i++) { await page.clock.runFor(16); if (fn) await page.evaluate(fn); } };
  const keep = () => { player.hp = getMaxHp(); player.invulnerable = 0; };
  // the Eleven
  await page.evaluate(() => { window.__m._miraElevenAt = game.time | 0; }); await step(8, keep);
  const E = await page.evaluate(() => { const m = window.__m; return { shards: game.monsters.filter((q) => q.type === 'miraEchoShard').length, shielded: !!m._miraShielded, mul: m._dmgTakenMul, ph: m._miraPhase }; });
  ok('the Eleven raise 3 + phase mirror shards and shield her (x0.12 damage taken in phase 1)', E.shards === 3 + E.ph && E.shielded && E.mul === 0.12, E);
  // per user: "the sharp end needs to point exactly where the direction of trajectory is" - each shard's heading follows its flight
  await step(20, keep); await page.evaluate(() => { window.__sp = game.monsters.filter((q) => q.type === 'miraEchoShard').map((q) => [q, q.x, q.y]); }); await step(1, keep);
  const HD = await page.evaluate(() => ({ drawer: typeof _lxMiraShardDraw === 'function', s: window.__sp.map(([q, x, y]) => { const a = Math.atan2(q.y - y, q.x - x), d = q._miraDirA;
    return { moved: +Math.hypot(q.x - x, q.y - y).toFixed(2), off: d == null ? null : +Math.abs(Math.atan2(Math.sin(a - d), Math.cos(a - d))).toFixed(2) }; }) }));
  ok("the Eleven's shards fly tip-first: each heading follows its flight (within 0.5 rad)", HD.drawer && HD.s.length > 0 && HD.s.every((h) => h.moved < 0.2 || (h.off != null && h.off < 0.5)), HD);
  await page.evaluate(() => { for (const q of game.monsters) if (q.type === 'miraEchoShard') q.currentHp = 0; game.monsters = game.monsters.filter((q) => q.type !== 'miraEchoShard'); }); await step(6, keep);
  const X = await page.evaluate(() => ({ shielded: !!window.__m._miraShielded, mul: window.__m._dmgTakenMul, exposed: !!window.__m._miraExposedUntil }));
  ok('breaking them all exposes her (x1.75)', !X.shielded && X.exposed && X.mul === 1.75, X);
  await page.evaluate(() => { const m = window.__m; m._miraExposedUntil = 0; m._miraSpentUntil = 0; m._miraElevenAt = 1e12; });
  // the Gate's Question
  await page.evaluate(() => { window.__m._miraGateAt = game.time | 0; }); await step(4, keep);
  const G = await page.evaluate(() => { const h = (game.hazards || []).find((x) => x.type === 'gravitos_singularity'); const fl = game.mapData.worldHeight - 80; return h ? { n: h.safeZones.length, w: h.w, ww: game.mapData.worldWidth, life: h.life, floors: h.safeZones.map((z) => Math.round(z.y + z.h)), fl, src: h._sourceLabel } : null; });
  ok("the Gate's Question covers her arena (5 s) with three safe steps: two on her floor, one on the central platform", G && G.n === 3 && G.w === G.ww && G.life >= 290 && G.floors[0] === G.fl && G.floors[2] === G.fl && G.floors[1] === G.fl - 160 && /Gate/.test(G.src), G);
  await page.evaluate(() => { game.hazards = game.hazards.filter((h) => h.type !== 'gravitos_singularity'); const m = window.__m; m._miraSpentUntil = 0; m._miraGateUntil = 0; m._miraGateAt = 1e12; });
  // Fallen Feathers + Sand Run Out
  await page.evaluate(() => { game.projectiles = game.projectiles.filter((p) => p.skill !== 'mfallenfeather'); window.__m._miraFeatherAt = game.time | 0; });   // only this volley's feathers; one volley: once it fires (its next one is booked) the next is held off
  await step(25, () => { player.hp = getMaxHp(); player.invulnerable = 0; const m = window.__m; if (m._miraFeatherAt > (game.time | 0) && m._miraFeatherAt < 1e11) m._miraFeatherAt = 1e12; });   // past the Gate's hit-stop; the five fly 70 ms apart
  const F = await page.evaluate(() => { const f = game.projectiles.filter((p) => p.skill === 'mfallenfeather'); return { n: f.length, homing: f.every((p) => p.homing) }; });
  ok('Fallen Feathers: five homing feathers', F.n === 5 && F.homing, F);
  await page.evaluate(() => { window.__m._miraFeatherAt = 1e12; window.__m._miraSandAt = game.time | 0; }); await step(70, keep);
  const S = await page.evaluate(() => { const p = game.hazards.filter((h) => h.type === 'sovereign_drain_pillar'); return { n: p.length, art: p.every((h) => h._vfx === 'miraSandPillar') }; });
  ok('Sand Run Out: three falling-sand pillars wearing her sand art', S.n === 3 && S.art, S);
  // Turn Back
  const T = await page.evaluate(async () => { const m = window.__m; m._miraSandAt = 1e12; player.x = m.x > 800 ? 120 : 1400; const x0 = m.x; m._miraStepAt = game.time | 0; return { x0, px: player.x }; });
  await step(4, () => { player.x = window.__tbx || player.x; });
  const T2 = await page.evaluate(() => ({ x: window.__m.x, px: player.x }));
  ok('Turn Back steps her toward a far hero', Math.abs((T2.x + 60) - T2.px) < Math.abs((T.x0 + 60) - T.px) - 100, { from: Math.round(T.x0), to: Math.round(T2.x), hero: T.px });
  // her effects animate (per user: "The shard, feathers and the columns need an epic animation")
  const FS = await page.evaluate(async () => { const f = (u) => fetch(u).then((r) => r.ok).catch(() => false), ix = (window.LX_SPRITE_FRAME_INDEX || {}).frames || {};
    return { shard: (ix['monsters/idle'] || {}).miraEchoShard, feather: (ix['projectiles/anim'] || {}).mfallenfeather, col: (ix['fx/anim'] || {}).fx_col_miraFallen, tg: (ix['fx/anim'] || {}).tg_col_miraFallen,
      load: (await Promise.all(['monsters/idle/miraEchoShard_8', 'projectiles/anim/mfallenfeather_7', 'fx/anim/fx_col_miraFallen_7', 'fx/anim/tg_col_miraFallen_8'].map((p) => f('Sprites/' + p + '.webp')))).every(Boolean),
      keys: _PROJ_ANIM_KEYS.has('mfallenfeather') && _FX_ANIM_KEYS.has('fx_col_miraFallen') && _FX_ANIM_KEYS.has('tg_col_miraFallen') }; });
  ok('her effects animate: shard idle 9, feather loop 8, Blade-fall 8, warning 9 (indexed, loading, keyed)', FS.shard === 9 && FS.feather === 8 && FS.col === 8 && FS.tg === 9 && FS.load && FS.keys, FS);
  // a column used to leave the list the moment it hit, so a hero in the lane never saw it; hers now finishes its play-out
  await page.evaluate(() => { const m = window.__m; m.x = 500; window.__cmx = m.x; window.__cbx = player.x = m.x + 450; player.hitStun = 0; player.frozenTimer = 0; player.stunTimer = 0; m._columnCd = 0; m._columnFiring = false; m._bigMeleeCd = 1e9; });   // the hero stands still in the lane
  let CB = null; for (let i = 0; i < 220 && !CB; i++) { await step(1, () => { player.hp = getMaxHp(); player.invulnerable = 0; player.x = window.__cbx; window.__m.x = window.__cmx; window.__m.vx = 0; if (!(game._lxSwingFx || []).length) player.hitStun = 0; });   // clear of her body: a contact hit's i-frames would block the strike
    CB = await page.evaluate(() => { const k = (game._lxSwingFx || []).find((q) => q.skill === 'column' && q._colSprite === 'fx_col_miraFallen'); return k ? { life: k.life, live: game.projectiles.some((p) => p.skill === 'column') } : null; }); }
  ok('a Blade-fall that lands on the hero keeps playing out after the hit', !!CB && CB.life > 10 && !CB.live, CB);
  await page.evaluate(() => { window.__m._columnCd = 1e9; });
  // her fall clears what she left
  await page.evaluate(() => { const m = window.__m; m._miraFeatherAt = game.time | 0; m._miraGateAt = (game.time | 0) + 2; });
  await step(6, keep);
  await page.evaluate(() => { const m = window.__m; m.traits = Object.assign({}, m.traits, { revivesOnce: null }); m._revived = true; m.currentHp = 0; (typeof killMonster === 'function' ? killMonster : _killMonsterRaw)(m); });
  await step(10, keep);
  const D = await page.evaluate(() => ({ alive: (game.monsters || []).some((q) => q.type === 'miraFallen' && q.currentHp > 0), sand: game.hazards.filter((h) => h.type === 'sovereign_drain_pillar').length, gate: game.hazards.filter((h) => h.type === 'gravitos_singularity').length, feathers: game.projectiles.filter((p) => p.skill === 'mfallenfeather').length }));
  ok('her fall clears every sand pillar, Gate and feather', !D.alive && D.sand === 0 && D.gate === 0 && D.feathers === 0, D);
  ok('no missing art request', !bad.length, bad.slice(0, 5));
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 300)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
