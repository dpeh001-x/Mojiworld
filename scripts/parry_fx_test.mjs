// The parry's own counter-flash — both paths where a parry damages a monster.
// ============================================================================
//   1. FRAMES RAN: the sim actually stepped (the boot gate is open)
//   2. THE ART IS REGISTERED AND DECODED: LX_FX.parry_riposte is a real image
//      and Sprites/fx/anim/parry_riposte_0..8 all decode — nine frames, not the
//      static fallback
//   3. THE INDEX KNOWS IT: _lxFrameCount('fx/anim','parry_riposte') is 9. This
//      is the check that matters most: fx/anim IS indexed, and the resolver is
//      "indexed and absent -> 0, ask for nothing", so a key missing from
//      data/sprite_frame_index.js loads no frames however real the files are
//   4. THE NOVA WEARS IT: a Riposte Nova proc spawns parry_riposte, not
//      nova_ring (previous build: nova_ring, the Nova Step DASH shockwave)
//   5. IT LANDS ON WHAT IT DAMAGED: every monster the nova actually hit gets
//      its own flash — which is what the request names. Since the parry-shield
//      pass that flash is the CLASS's shield (parry_<class>), not parry_riposte
//   6. THE ROGUE COUNTER WEARS IT: the parry counter-strike, which had no
//      effect of its own at all, now flashes on every landed counter (parry_rogue,
//      on the monster)
//   7. AND ONLY WHEN IT DISHES DAMAGE: 'melee' is not MISS_EXEMPT, so that
//      counter can whiff — a whiff, and a dead target, must NOT flash
//   8. CONTROL — THE FALLBACK SURVIVES: nova_ring is still spawned by Nova
//      Step's own dash, and still sits behind the nova as its 404 fallback
//   9. THE CLASS SHIELDS ARE REGISTERED, INDEXED AND DECODED: parry_warrior /
//      _rogue / _mage / _archer each have a still and seven decoded frames, and
//      _lxFrameCount knows all four (per user: "The parry sprite needs a complete
//      overhaul to fit the game and all classes nicely")
//  10. EVERY CLASS'S PARRY FLASHES ITS SHIELD ON THE PLAYER: triggerParry spawns
//      parry_<class> riding the player (follow), sticky, fadeTail 0.3, lifted
//      (pivotY 0.595) - and the class's stance burst still riding them gives way
// Run: node scripts/parry_fx_test.mjs   (MOJI_GAME_FILE=... for a baseline)
import { createRequire } from 'node:module';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// the repo this script lives in (was hardcoded to the shared working copy, so a worktree tested someone else's tree)
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require(ROOT + '/node_modules/playwright-core');
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 12833);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1200));
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 230) });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(11000);
  const click = async (sel, ms) => {
    const el = await page.$(sel);
    if (!el || !(await el.isVisible().catch(() => false))) return false;
    try { await el.click({ timeout: ms || 2500 }); return true; } catch (e) { return false; }
  };
  await click('#menu-newgame', 8000); await page.waitForTimeout(1500);
  await click('#auth-submit', 8000);  await page.waitForTimeout(2500);
  for (let i = 0; i < 8; i++) {
    const r = await page.evaluate(() => { const o = document.getElementById('class-options');
      return !!(o && o.firstElementChild && o.firstElementChild.getBoundingClientRect().width > 40); });
    if (r) break;
    if (!(await click('#cs-nav-next'))) break;
    await page.waitForTimeout(1000);
  }
  await page.evaluate(() => { const o = document.getElementById('class-options'); if (o && o.firstElementChild) o.firstElementChild.click(); });
  for (let i = 0; i < 30; i++) {
    for (const sel of ['#plg-dagger-skip', '#plg-skip', '#boss-intro-skip', '#tut-skip']) await click(sel, 1000);
    await page.keyboard.press('Enter').catch(() => {});
    await page.waitForTimeout(1500);
    const st = await page.evaluate(() => ({ p: (typeof game !== 'undefined') ? game.paused : null, pro: !!window._prologueActive }));
    if (st.p === false && !st.pro) break;
  }
  // .fade is what the boot gate waits for: without it the loop spins without ever stepping the sim
  await page.evaluate(() => { const o = document.getElementById('loading-overlay'); if (o) { o.classList.add('fade'); o.style.display = 'none'; } });

  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = { framesRan: 0 };
    // count in GAME frames, with a wall-clock guard: a death screen stops the
    // clock and a bare frame-wait loop then hangs the probe silently
    const t0 = game.time, w0 = performance.now();
    while (game.time - t0 < 40 && performance.now() - w0 < 9000) await sleep(30);
    out.framesRan = game.time - t0;

    // ---- registration + decode -------------------------------------------
    const img = (typeof LX_FX !== 'undefined') ? LX_FX.parry_riposte : null;
    out.base = { present: !!img, complete: !!(img && img.complete), w: img ? img.naturalWidth : 0 };
    out.animKey = (typeof _FX_ANIM_KEYS !== 'undefined') && _FX_ANIM_KEYS.has('parry_riposte');
    out.indexed = (typeof _lxFrameCount === 'function') ? _lxFrameCount('fx/anim', 'parry_riposte', -1) : 'no fn';
    let fr = (typeof _fxAnimFrames === 'function') ? _fxAnimFrames('parry_riposte') : null;
    for (let i = 0; i < 60 && !(fr && fr.length && fr.every((f) => f && f.complete && f.naturalWidth > 0)); i++) {
      await sleep(150); fr = _fxAnimFrames('parry_riposte');
    }
    out.frames = { n: fr ? fr.length : 0, decoded: fr ? fr.filter((f) => f && f.complete && f.naturalWidth > 0).length : 0 };
    // ---- the class shields (parry-shield) ---------------------------------
    out.cls = {};
    for (const c of ['warrior', 'rogue', 'mage', 'archer']) {
      const k = 'parry_' + c, im = (typeof LX_FX !== 'undefined') ? LX_FX[k] : null;
      let f = (typeof _fxAnimFrames === 'function') ? _fxAnimFrames(k) : null;
      for (let i = 0; i < 60 && !(f && f.length && f.every((x) => x && x.complete && x.naturalWidth > 0)); i++) { await sleep(150); f = _fxAnimFrames(k); }
      out.cls[c] = { w: (im && im.complete) ? im.naturalWidth : 0, key: (typeof _FX_ANIM_KEYS !== 'undefined') && _FX_ANIM_KEYS.has(k),
        idx: (typeof _lxFrameCount === 'function') ? _lxFrameCount('fx/anim', k, -1) : 'no fn', n: f ? f.length : 0, dec: f ? f.filter((x) => x && x.complete && x.naturalWidth > 0).length : 0 };
    }

    // ---- spy on the burst spawner ----------------------------------------
    let log = [];
    const realBurst = window.spawnSpriteBurst;
    window.spawnSpriteBurst = function (x, y, key, opt) { log.push({ x: Math.round(x), y: Math.round(y), key, size: Math.round((opt && opt.size) || 0),
      follow: !!(opt && opt.follow), sticky: !!(opt && opt.sticky), fadeTail: opt ? opt.fadeTail : undefined, pivotY: opt ? opt.pivotY : undefined }); return realBurst.apply(this, arguments); };

    // ---- 1. the Riposte Nova ---------------------------------------------
    // Put live monsters inside the 150 px radius and give the player the boon.
    player.mods = player.mods || {}; player.mods.riposteNova = 0.8;
    player._riposteAt = -9999;
    // the zone populates a moment after the gate opens - wait for it, with a
    // wall-clock guard, rather than measuring an empty arena and reporting zero
    // A new game now ends in town, and spawnMonster refuses non-boss spawns there (v0.29.619): with no zone to
    // populate, the nova met nobody and reported 0/0 - so step into the forest (story beats marked seen, v0.30.1116
    // queues them and pauses the sim) and wait for its spawns.
    try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    if (!game.monsters.some((m) => m && m.currentHp > 0)) { try { loadMap('forest'); } catch (e) {} game.paused = false; }
    const mw0 = performance.now();
    while (!game.monsters.some((m) => m && m.currentHp > 0) && performance.now() - mw0 < 15000) await sleep(200);
    const live = game.monsters.filter((m) => m && m.currentHp > 0).slice(0, 3);
    out.movedMonsters = live.length;
    const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;   // after the map change
    live.forEach((m, i) => { m.x = pcx + (i - 1) * 40; m.y = pcy - m.h / 2; m.currentHp = Math.max(m.currentHp, 99999); m.maxHp = Math.max(m.maxHp || 0, 99999); });
    const hp0 = live.map((m) => m.currentHp);
    log = [];
    out.novaCls = player.cls;   // the per-monster flash is this class's shield
    _riposteProc();
    out.novaLog = log.slice();
    out.novaDamaged = live.filter((m, i) => m.currentHp < hp0[i]).length;

    // ---- 2. the rogue parry counter --------------------------------------
    // riposteNova off, so the only thing that can flash here is the counter.
    player.mods.riposteNova = 0;
    const wasCls = player.cls; player.cls = 'rogue';
    const src = live[0] || game.monsters.find((m) => m && m.currentHp > 0);
    out.haveSource = !!src;
    // 'melee' is NOT in MISS_EXEMPT_SKILLS, so this counter rolls to hit and can
    // whiff. Run it repeatedly and score hits and whiffs separately: every landed
    // counter must flash, and a whiff must not.
    let hits = 0, misses = 0, flashOnHit = 0, flashOnMiss = 0;
    for (let i = 0; i < 16 && src; i++) {
      src.currentHp = 99999; src.maxHp = Math.max(src.maxHp || 0, 99999);
      player.invulnerable = 0; player.blockTimer = 0; player.parryWindow = 0;
      const h0 = src.currentHp;
      log = [];
      triggerParry(src);
      const flashed = log.some((b) => b.key === 'parry_rogue' && !b.follow);   // on the monster, not the shield riding the player
      if (src.currentHp < h0) { hits++; if (flashed) flashOnHit++; }
      else { misses++; if (flashed) flashOnMiss++; }
      await sleep(20);
    }
    // A DETERMINISTIC no-damage case, so the gate is not judged on a random roll:
    // a target already at 0 makes hitMonster return before it touches anything.
    let deadFlash = null;
    if (src) {
      src.currentHp = 0;
      player.invulnerable = 0; player.blockTimer = 0; player.parryWindow = 0;
      log = [];
      triggerParry(src);
      deadFlash = log.some((b) => b.key === 'parry_rogue' && !b.follow);
    }
    out.counter = { hits, misses, flashOnHit, flashOnMiss, deadFlash };
    out.counterLog = log.slice();

    // ---- 3. every class's parry flashes its own shield on the player ----------
    out.burst = {};
    for (const c of ['warrior', 'rogue', 'mage', 'archer']) {
      player.cls = c; player.invulnerable = 0; player.blockTimer = 0; player.parryWindow = 0;
      game.smoothFx = [];
      startBlock();
      const stance = game.smoothFx.find((f) => f && f.follow === player && f.spriteKey === LX_BLOCK_FX[c]);
      log = [];
      triggerParry(null);
      const b = log.find((e) => e.key === 'parry_' + c && e.follow);
      out.burst[c] = { spawned: !!b, sticky: !!(b && b.sticky), fadeTail: b ? b.fadeTail : null, pivotY: b ? b.pivotY : null, stanceCut: !!stance && stance.life <= 1 };
    }
    player.cls = wasCls;
    window.spawnSpriteBurst = realBurst;
    out.helper = typeof _lxParryFx;
    return out;
  });

  // source-level control: the fallback and the dash ring must both still be there
  const src = await (await fetch(`http://localhost:${PORT}/${FILE}`)).text();
  const novaSpawns = (src.match(/spawnSpriteBurst\([^)]*'nova_ring'/g) || []).length;

  console.log('  frames ' + R.framesRan + ' | base ' + JSON.stringify(R.base) + ' | key ' + R.animKey + ' | index ' + R.indexed + ' | frames ' + JSON.stringify(R.frames));
  console.log('  nova   ' + JSON.stringify(R.novaLog) + '  damaged ' + R.novaDamaged + '/' + R.movedMonsters);
  console.log('  rogue  ' + JSON.stringify(R.counter) + ' | helper ' + R.helper + ' | nova_ring spawn sites ' + novaSpawns);

  const NL = R.novaLog || [], CT = R.counter || {};
  ok('FRAMES RAN: the sim actually stepped', (R.framesRan | 0) > 10, `${R.framesRan} frames`);
  ok('THE ART IS REGISTERED AND DECODED: base image + nine decoded frames',
    R.base && R.base.present && R.base.w > 0 && R.animKey && R.frames.n === 9 && R.frames.decoded === 9,
    `base ${R.base && R.base.w}px, key ${R.animKey}, ${R.frames.decoded}/${R.frames.n} frames decoded`);
  ok('THE INDEX KNOWS IT: _lxFrameCount returns 9, so the loop is asked for at all',
    R.indexed === 9, `_lxFrameCount('fx/anim','parry_riposte') = ${R.indexed} (an unindexed key returns 0 and loads nothing)`);
  ok('THE NOVA WEARS IT: the shockwave is parry_riposte, not the dash ring',
    NL.some((b) => b.key === 'parry_riposte' && b.size > 200) && !NL.some((b) => b.key === 'nova_ring'),
    `${NL.length} bursts: ${NL.map((b) => b.key).join(', ')} (previous build: nova_ring)`);
  ok('IT LANDS ON WHAT IT DAMAGED: one flash per monster the nova hit',
    R.novaDamaged > 0 && NL.filter((b) => b.key === 'parry_' + R.novaCls && b.size < 200).length >= R.novaDamaged,
    `${R.novaDamaged} damaged, ${NL.filter((b) => b.key === 'parry_' + R.novaCls && b.size < 200).length} per-monster parry_${R.novaCls} flashes`);
  ok('THE ROGUE COUNTER WEARS IT: every landed counter-strike flashes (it had nothing before)',
    R.haveSource && CT.hits > 0 && CT.flashOnHit === CT.hits,
    `${CT.flashOnHit}/${CT.hits} landed counters flashed`);
  ok('AND ONLY WHEN IT DISHES DAMAGE: a whiffed or dead-target counter does not flash',
    CT.deadFlash === false && CT.flashOnMiss === 0,
    `dead target flashed: ${CT.deadFlash}; whiffs ${CT.misses}, of which flashed ${CT.flashOnMiss}`);
  ok('CONTROL — THE FALLBACK SURVIVES: nova_ring still spawned by the dash and behind the nova',
    novaSpawns === 2 && R.helper === 'function',
    `${novaSpawns} nova_ring spawn sites (expected 2: Nova Step's dash, and the nova's 404 fallback)`);
  const C = R.cls || {}, B = R.burst || {}, CL = ['warrior', 'rogue', 'mage', 'archer'];
  ok('THE CLASS SHIELDS ARE REGISTERED, INDEXED AND DECODED: a still + seven frames each',
    CL.every((c) => C[c] && C[c].w > 0 && C[c].key && C[c].idx === 7 && C[c].n === 7 && C[c].dec === 7),
    CL.map((c) => c + ' ' + (C[c] ? `${C[c].w}px key ${C[c].key} idx ${C[c].idx} ${C[c].dec}/${C[c].n}` : 'missing')).join('; '));
  ok("EVERY CLASS'S PARRY FLASHES ITS SHIELD ON THE PLAYER, and the stance burst gives way",
    CL.every((c) => B[c] && B[c].spawned && B[c].sticky && B[c].fadeTail === 0.3 && B[c].pivotY === 0.595 && B[c].stanceCut),
    CL.map((c) => c + ' ' + JSON.stringify(B[c])).join('; '));
} finally { await browser.close().catch(() => {}); server.kill(); }
let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
