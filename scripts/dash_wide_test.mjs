// Dash skills reach WIDE enemies (v0.30.x dash-wide; follow-up to dash-hitbox).
//   node scripts/dash_wide_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build; PORT=<port>; DW_VERBOSE=1 prints every count)
// Flurry, Dimensional Warp (sideways and up), Rush's flame bursts and Smoke Dash (the dash corridor and the cloud) measured
// the enemy's CENTRE against their sideways reach, so a boss 150-400 px wide was missed while the skill's band covered his
// body. Each skill is cast at rank 1 (the base reach, no rank bonus) facing right, with the player's right edge at X+28.
// Targets stand with their feet on the player's floor at an EDGE GAP g (the target's left edge minus the player's right
// edge). The reach in edge-gap terms after the fix, from each skill's own numbers (player 28 px wide):
//   Flurry corridor  g < 348   (360 px blink + 16 px pad)          Warp sideways  g < 261   (225 px warp + 50 px pad)
//   Warp up          the body must cover the player's column      Rush bursts    g < 32 at each burst (60 px reach)
//   Smoke Dash       corridor g < 198 (220 px dash + 20 px pad); cloud g < 282 (90 px around the landing point)
// Each wide boss (King Krook, King Gloopaloo, Leo) is placed at gaps INSIDE that reach where its centre is outside the old
// centre window, and must be hit. A Shroom (45 px) placed just OUTSIDE the reach must not be hit, and a Shroom inside it
// still is. Hits are counted at hitMonster with the skill's own tag; targets are pinned and topped up, the player is
// invulnerable.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11425';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${(ok && !process.env.DW_VERBOSE) ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const TYPES = { js: 'text/javascript', mjs: 'text/javascript', json: 'application/json', css: 'text/css', png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', mp4: 'video/mp4', woff2: 'font/woff2' };
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  // files missing from the (stale) working copy come from origin, like the fonts in keybinds_test
  await p.route((u) => u.hostname === 'localhost' && u.port === String(PORT) && !/[.]html$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (!rel || existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: TYPES[rel.split('.').pop().toLowerCase()] || 'application/octet-stream', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] }) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof castSkill === 'function' && typeof spawnMonster === 'function' && typeof hitMonster === 'function', null, { timeout: 150000 });
  const setup = await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'rogue'; player.level = 100;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    loadMap('mushroom'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    player.invulnerable = 999999; game.monsters.length = 0;
    const g = (game.mapData.platforms || []).find((q) => q.type === 'ground'); const FEET = g ? g.y : 480;
    window.__dw = { log: [], phase: 'idle', FEET };
    const _hm = hitMonster;
    window.hitMonster = function (m, dmg, crit, tag) { if (m && m.__dwId) __dw.log.push({ id: m.__dwId, tag, phase: __dw.phase }); return _hm.apply(this, arguments); };
    window.__dwPin = () => { for (const m of game.monsters) { const q = m.__dwPos; if (!q) continue; m.x = q.x; m.y = q.y; m.vx = 0; m.vy = 0; m.onGround = true; } };
    const _um = updateMonsters; window.updateMonsters = function () { const r = _um.apply(this, arguments); try { __dwPin(); } catch (e) {} return r; };
    const mk = (id, type, boss) => {
      for (let t = 0; t < 8; t++) {
        const m = spawnMonster(1800, FEET - 300, type, boss);
        if (!m || m._suppressed) return null;
        if (boss || (!m.isElite && !m.isMiniBoss && m.h <= 60)) { m.__dwId = id; return m; }
        const i = game.monsters.indexOf(m); if (i >= 0) game.monsters.splice(i, 1);
      }
      return null;
    };
    const made = { kingKrook: mk('kingKrook', 'kingKrook', true), king: mk('king', 'king', true), leo: mk('leo', 'zodiac_leo', true), shroom: mk('shroom', 'mushroom', false) };
    game.paused = false; try { closeAllModals(); } catch (e) {}
    const sz = {}; for (const k in made) sz[k] = made[k] ? [Math.round(made[k].w), Math.round(made[k].h)] : null;
    return { FEET, sz, pw: player.w, ww: game.mapData.worldWidth };
  });
  console.log('setup', JSON.stringify(setup));
  // one cast facing right from X = 300: the target's left edge at the player's right edge + gap, feet on the floor; the others parked far away
  const cast = (skill, cls, tid, gap, up) => p.evaluate(async ([skill, cls, tid, gap, up]) => {
    const FEET = __dw.FEET, PX = 300;
    player.cls = cls; player.job = null; player.level = 100; player.skillRanks = Object.assign(player.skillRanks || {}, { [skill]: 1 });
    player.x = PX; player.y = FEET - player.h; player.vx = 0; player.vy = 0; player.onGround = true; player.facing = 1;
    player.hp = player.maxHp; player.mp = 1e6; player.invulnerable = 999999; player._skillLockTimer = 0; player.hitStun = 0; player.stunTimer = 0; player.frozenTimer = 0;
    player.skillCooldowns = {}; player._flurryReturn = null; player._blinkUpIntent = !!up; player.rushTimer = 0; player.smokeLock = 0; game.keys = {};
    let tgt = null;
    for (const m of game.monsters) {
      if (!m.__dwId) continue;
      m.currentHp = 1e9; m.maxHp = Math.max(m.maxHp || 0, 1e9);
      if (m.__dwId === tid) { tgt = m; m.__dwPos = { x: PX + player.w + gap, y: FEET - m.h }; }
      else m.__dwPos = { x: 2600 - m.w / 2, y: FEET - m.h };
    }
    if (!tgt) return { err: 'no target ' + tid };
    __dwPin(); game.paused = false;
    __dw.log.length = 0; __dw.phase = 'cast'; castSkill(skill); __dw.phase = 'after'; player._blinkUpIntent = false;
    const t0 = game.time, w0 = performance.now();
    while ((performance.now() - w0 < 1100 || game.time - t0 < 45) && performance.now() - w0 < 15000) await new Promise((s) => setTimeout(s, 50));
    __dw.phase = 'idle';
    const mine = __dw.log.filter((e) => e.id === tid);
    return { gap, all: mine.length, tagged: mine.filter((e) => e.tag === skill).length, cast: mine.filter((e) => e.tag === skill && e.phase === 'cast').length,
      after: mine.filter((e) => e.tag === skill && e.phase === 'after').length, frames: game.time - t0 };
  }, [skill, cls, tid, gap, !!up]);

  const BOSSES = [['kingKrook', 'King Krook'], ['king', 'King Gloopaloo'], ['leo', 'Leo (zodiac)']];
  // per skill: the boss gaps (inside the reach), what counts as hit there, a Shroom gap outside the reach (0 hits) and inside it (hit)
  const SKILLS = [
    { id: 'flurry', cls: 'rogue', name: 'Flurry', gaps: [280, 330], hit: (r) => r.tagged >= 1, need: '>= 1 slash', out: 356, in: 300, inHit: (r) => r.tagged >= 1 },
    { id: 'blink', cls: 'mage', name: 'Dimensional Warp (sideways)', gaps: [200, 245], hit: (r) => r.tagged >= 1, need: '>= 1 hit', out: 268, in: 200, inHit: (r) => r.tagged >= 1 },
    { id: 'blink', up: true, cls: 'mage', name: 'Dimensional Warp (up)', gaps: [-20, -70], hit: (r) => r.tagged >= 1, need: '>= 1 hit, the body covering the player\'s column', out: 8, in: -30, inHit: (r) => r.tagged >= 1 },
    { id: 'rush', cls: 'warrior', name: 'Rush', gaps: [0, 25], hit: (r) => r.tagged >= 6, need: 'the body hit + all 5 flame bursts', out: -118, in: 10, inHit: (r) => r.tagged >= 3 },
    { id: 'smokeDash', cls: 'rogue', name: 'Smoke Dash', gaps: [150, 240], hit: (r) => (r.gap === 150 ? r.cast >= 1 : r.after >= 2), need: 'the dash at 150 px, >= 2 cloud ticks at 240 px', out: 300, in: 150, inHit: (r) => r.cast >= 1 && r.after >= 2 },
  ];
  for (const S of SKILLS) {
    for (const [bid, bname] of BOSSES) {
      const rs = []; for (const g of S.gaps) rs.push(await cast(S.id, S.cls, bid, g, S.up));
      check(rs.every((r) => !r.err && S.hit(r)), `${S.name} hits ${bname} at edge gaps ${S.gaps.join(' and ')} px (${S.need})`, rs);
    }
    const o = await cast(S.id, S.cls, 'shroom', S.out, S.up);
    check(!o.err && o.all === 0, `${S.name} does not hit a Shroom just outside its reach (edge gap ${S.out} px)`, o);
    const i = await cast(S.id, S.cls, 'shroom', S.in, S.up);
    check(!i.err && S.inHit(i), `${S.name} still hits a Shroom inside its reach (edge gap ${S.in} px)`, i);
  }
  check(errs.length === 0, 'no page errors', errs.slice(0, 5));
} finally {
  await browser.close().catch(() => {}); srv.kill();
}
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
