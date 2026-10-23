// The platform under the Singularity's exit door stays put through all three of Gravitos's forms (gravitos-portal-platform).
//   node scripts/gravitos_portal_platform_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Per user: "ensure that the platform on the portal does not disappear in form 2 and 3 as players might exit midway".
// Story fight and an Echo Keeper echo (the real dialog), each form reached through hitMonster. In every form: the door's platform is
// still in the map, solid, uncracked, where form 1 had it and drawn; the hero lands on it from the floor vent and stands on it; Up at the
// door opens "Leave the fight?" as in form 1; "Leave anyway" in form 3 takes the hero through. Plus: the rest of the collapse still happens.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11871';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof killMonster === 'function' && typeof openNPC === 'function' && typeof tryPortal === 'function', null, { timeout: 150000 });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'rogue'; player.level = 70;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    try { for (const k of Object.keys(LX_KILL_FILMS)) if (LX_KILL_FILMS[k] && LX_KILL_FILMS[k].key) player._storyBeatsSeen[LX_KILL_FILMS[k].key] = true; } catch (e) {}
    loadMap('mushroom'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    player.invulnerable = 999999; game.monsters.length = 0;
    // the perch draw spy: every _drawCutePlatform call this frame, as [screen x, y, w, h]
    const S = window.__draws = []; const _d = _drawCutePlatform;
    window._drawCutePlatform = function (sx, y, w, h) { if (S.length < 400) S.push([sx, y, w, h]); return _d.apply(this, arguments); };
    // hold the boss inert and the field clear, every frame, while window.__hold is set (the fight itself is not under test)
    const hold = () => { try { const m = window.__boss; if (window.__hold && m && game.monsters.includes(m)) { m.patternState = 'idle'; m.patternTimer = 0; m.vx = 0; m.x = 1750; m._ohkoWarnUntil = null;
      if (game.hazards) game.hazards.length = 0; if (game.projectiles) game.projectiles.length = 0; player.hp = getMaxHp(); player.invulnerable = 999999; } } catch (e) {} requestAnimationFrame(hold); };
    requestAnimationFrame(hold);
  });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const setup = (kind) => p.evaluate(async (kind) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {}
    window.__hold = false; game.bossRush = null; game.monsters.length = 0; if (game.hazards) game.hazards.length = 0;
    game.bossDefeated = game.bossDefeated || {}; game.bossDefeated.gravitosArena = kind !== 'story'; loadMap('gravitosArena');
    await sleep(2500); game.paused = false; player.invulnerable = 999999;
    const grav = () => (game.monsters || []).find((m) => m && m.type === 'gravitos' && m.currentHp > 0);
    if (kind === 'echo') {
      const npc = (game.npcs || []).find((n) => n && n.role === 'echoKeeper'); if (!npc) return { err: 'no Echo Keeper' };
      game.monsters.length = 0; openNPC(npc); await sleep(400);
      const b = [...document.querySelectorAll('#dialog-options button')].find((x) => /Summon the echo/.test(x.textContent)); if (!b) return { err: 'no summon option' };
      b.click(); await sleep(300);
    }
    const t0 = performance.now(); while (!grav() && performance.now() - t0 < 6000) await sleep(100);
    if (!grav() && kind === 'story') spawnMonster(1100, 380, 'gravitos', true, false);
    try { closeDialog(); } catch (e) {} game.paused = false;
    const m = grav(); if (!m) return { err: 'no Gravitos' };
    window.__boss = m; window.__hold = true;
    const door = (game.portals || []).find((po) => po && po.dest === 'weightbearerStair');
    if (!door) return { err: 'no door', portals: (game.portals || []).map((po) => po.dest) };
    const host = (game.mapData.platforms || []).find((q) => q && q.type !== 'ground' && door.x >= q.x && door.x <= q.x + q.w && Math.abs(q.y - door.y) <= 24);
    window.__door = door; window.__host = host;
    const base = (q) => q && { x: q._driftBaseX != null ? q._driftBaseX : q.x, y: q._driftBaseY != null ? q._driftBaseY : q.y, w: q.w, h: q.h, ax: q._driftAx || 0 };
    window.__host0 = base(host);
    return { ok: true, echo: !!m._echoBoss, door: { x: door.x, y: door.y }, host: base(host), plats: game.mapData.platforms.length };
  }, kind);
  // Knock the current form down (hitMonster, the real damage path) and let the collapse finish.
  const nextForm = () => p.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const m = window.__boss, ph = m._gravitosPhase || 1; window.__hold = false;
    for (let k = 0; k < 60 && game.monsters.includes(m) && m.currentHp > 0 && (m._gravitosPhase || 1) === ph; k++) { m.invulnerable = 0; m.currentHp = 1; m.patternState = 'idle'; m.patternTimer = 0; hitMonster(m, 999999, false); await sleep(25); }
    window.__hold = true;
    const g0 = game.time | 0, t0 = performance.now();
    while (((game.time | 0) - g0 < 150 || (game.mapData.platforms || []).some((q) => q && q._lxDoomed)) && performance.now() - t0 < 20000) await sleep(30);
    return { phase: m._gravitosPhase || 1, frames: (game.time | 0) - g0, plats: (game.mapData.platforms || []).filter((q) => q.type !== 'ground').map((q) => [q._driftBaseX != null ? q._driftBaseX : q.x, q._driftBaseY != null ? q._driftBaseY : q.y]),
      pads: (game.mapData.launchPads || []).map((q) => q.x), debris: (typeof _lxGravDebris !== 'undefined') ? _lxGravDebris.length : null };
  });
  // In the current form: the perch is there, the vent lands you on it, you stand on it, Up at the door asks "Leave the fight?".
  const probe = (leave) => p.evaluate(async (leave) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const frames = async (n, f) => { const g0 = game.time | 0, t0 = performance.now(); while ((game.time | 0) - g0 < n && performance.now() - t0 < 20000) { if (f && f()) break; await sleep(16); } return (game.time | 0) - g0; };
    const key = (k, down) => document.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key: k, code: k, bubbles: true }));
    const m = window.__boss, door = window.__door, h0 = window.__host0, H = window.__host;
    const live = (game.mapData.platforms || []).find((q) => q === H);
    const r = { phase: m._gravitosPhase || 1, inMap: !!live, solid: !!live && live.type === 'platform' && !live._lxDoomed && !live.dropThroughOnly,
      same: !!live && (live._driftBaseX != null ? live._driftBaseX : live.x) === h0.x && (live._driftBaseY != null ? live._driftBaseY : live.y) === h0.y && live.w === h0.w && live.h === h0.h && (live._driftAx || 0) === h0.ax };
    // (a) the floor vent at x 240 (the way up) throws the hero onto the perch: steer at it the whole flight, as a player would. The perch
    // swings 72 px either way, so a throw can miss it as a player's can: up to three tries, the same in every form.
    const pad = (game.mapData.launchPads || []).find((q) => q.x === 240);
    const calm = () => { player.vx = 0; player.vy = 0; player._padLaunch = false; player._padFlingUntil = 0; player._padVxCap = 0; player._padVyCap = 0; };
    r.vent = !!pad; r.landed = false; r.launch = [];
    for (let t = 0; pad && live && t < 3 && !r.landed; t++) {
      player.x = 120; player.y = 480 - player.h - 2; calm(); await frames(20);   // on the floor left of the vent, settled
      player.x = pad.x + pad.w / 2 - player.w / 2; player.y = pad.y - player.h - 2; calm(); player.onGround = false;
      let dir = 0; const steer = () => { const c = player.x + player.w / 2, tgt = live.x + live.w / 2; const want = c < tgt - 16 ? 1 : c > tgt + 16 ? -1 : 0;
        if (want !== dir) { if (dir === 1) key('ArrowRight', false); if (dir === -1) key('ArrowLeft', false); if (want === 1) key('ArrowRight', true); if (want === -1) key('ArrowLeft', true); dir = want; } };
      let up = false; const ran = await frames(240, () => { steer(); if (player.vy < -5) up = true; return up && player.onGround && player.vy >= 0; });
      key('ArrowRight', false); key('ArrowLeft', false);
      const feet = player.y + player.h;
      r.launch.push({ up, ran, feet: Math.round(feet), x: Math.round(player.x), on: [Math.round(live.x), live.y] });
      r.landed = up && player.onGround && Math.abs(feet - live.y) <= 3 && player.x + player.w > live.x && player.x < live.x + live.w;
    }
    // (b) stand on it at the door for a second: still on the perch, and it is drawn under the hero
    if (live) {
      player.x = 120; player.y = 480 - player.h - 2; calm(); await frames(20);
      player.x = door.x - player.w / 2; player.y = live.y - player.h - 20; calm(); player.onGround = false;
      window.__draws.length = 0;
      await frames(60);
      const feet = player.y + player.h, c = player.x + player.w / 2, cx = (game.camera && game.camera.x) || 0;
      r.stand = { feet: Math.round(feet), c: Math.round(c), on: [Math.round(live.x), live.y] };
      r.stood = !!player.onGround && Math.abs(feet - live.y) <= 3 && c >= live.x && c <= live.x + live.w;
      r.drawn = window.__draws.some((d) => Math.abs(d[1] - live.y) < 0.5 && d[2] === live.w && d[3] === live.h && Math.abs(d[0] + cx - live.x) <= 80);
    }
    // (c) Up at the door (feet on the perch, centred on it): the mid-fight door asks first; (d) "Leave anyway" goes through
    m._lxEngaged = true; if (m.currentHp >= m.maxHp) m.currentHp = m.maxHp - 1;
    const seat = () => { player.x = door.x - player.w / 2; player.y = (live ? live.y : 480) - player.h;   /* no platform: where the hero can stand - the floor below the door */ player.vx = 0; player.vy = 0; };
    seat(); try { closeDialog(); } catch (e) {}
    const reach = Math.abs(player.x + player.w / 2 - door.x) < 50 && Math.abs(player.y + player.h - door.y) < 100;
    const ret = tryPortal(); await sleep(150);
    const dlg = document.getElementById('dialog'), txt = dlg ? dlg.textContent : '';
    r.door = { reach, ret, asks: /Leave the fight\?/.test(txt) && !!(dlg && dlg.offsetParent !== null || (dlg && getComputedStyle(dlg).display !== 'none')) };
    const btn = (re) => [...document.querySelectorAll('#dialog-options button, #dialog button')].find((b) => re.test(b.textContent));
    if (leave) {
      const b = btn(/Leave anyway/); seat(); if (b) b.click();
      const t0 = performance.now(); while (game.currentMap !== 'weightbearerStair' && performance.now() - t0 < 12000) await sleep(100);
      r.left = game.currentMap;
    } else { const b = btn(/Keep fighting/); if (b) b.click(); else try { closeDialog(); } catch (e) {} await sleep(100); r.stayed = game.currentMap; }
    return r;
  }, leave);
  for (const kind of ['story', 'echo']) {
    const st = await setup(kind);
    if (!st.ok) { check(false, `${kind}: the fight starts with the door on a platform`, st); continue; }
    check(!!st.host && st.door.y < 480, `${kind}: the door stands on a raised platform in form 1`, st);
    let f1 = null;
    for (let form = 1; form <= 3; form++) {
      let nf = null;
      if (form > 1) { nf = await nextForm(); check(nf.phase === form && nf.frames > 0, `${kind}: Gravitos is in form ${form} (${nf.frames} frames after the change)`, nf); }
      if (nf && form === 2) check(!nf.plats.some((q) => q[0] === 1700 && q[1] === 180), `${kind}: form 2 still collapses the right high perch`, nf);
      if (nf && form === 3) check(!nf.plats.some((q) => q[1] === 320) && !nf.pads.includes(560) && !nf.pads.includes(1560) && nf.pads.includes(240), `${kind}: form 3 still collapses the y:320 pair and their vents (floor vents stay)`, nf);
      const r = await probe(form === 3);
      if (form === 1) f1 = r;
      check(r.inMap && r.solid && r.same, `${kind} form ${form}: the door's platform is still there, solid and uncracked, where form 1 had it`, r);
      check(r.drawn, `${kind} form ${form}: the door's platform is drawn`, r);
      check(r.vent && r.landed, `${kind} form ${form}: the floor vent lands the hero on the door's platform`, r.launch);
      check(r.stood, `${kind} form ${form}: the hero stands on it at the door`, r.stand);
      check(r.door.reach && r.door.ret === f1.door.ret && r.door.asks === f1.door.asks && r.door.asks, `${kind} form ${form}: Up at the door asks "Leave the fight?" as in form 1`, { now: r.door, f1: f1.door });
      if (form === 3) check(r.left === 'weightbearerStair', `${kind} form 3: "Leave anyway" takes the hero through the door mid-fight`, r.left);
      else check(r.stayed === 'gravitosArena', `${kind} form ${form}: "Keep fighting" keeps the fight`, r.stayed);
    }
  }
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await ctx.close();
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
