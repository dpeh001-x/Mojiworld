// Dash skills reach tall enemies (v0.30.x dash-hitbox).
//   node scripts/dash_hitbox_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build; PORT=<port>; DH_VERBOSE=1 prints every count)
// Flurry and Dimensional Warp did no damage to bosses or tall monsters, Rush's five flame bursts missed them (only its body
// hit landed) and the Smoke Dash cloud never ticked on them: the vertical tests compared one point (centre or top) instead
// of the enemy's body. Each skill is cast at rank 10, Lv100, with the right class, at King Gloopaloo, Mooma and King Krook
// and at a Shroom, at two distances, all with their feet on the player's floor, and at a Shroom on a platform well above
// the player (which must stay out of reach). Hits are counted at hitMonster (the skill's own decision); every target's HP is
// topped back up to 1e9 before each cast and the player is invulnerable, so nothing dies.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11310';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${(ok && !process.env.DH_VERBOSE) ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
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
    // every hitMonster call on a test target is logged with its tag and whether it came during the cast or after it
    window.__dh = { log: [], phase: 'idle', FEET };
    const _hm = hitMonster;
    window.hitMonster = function (m, dmg, crit, tag) { if (m && m.__dhId) __dh.log.push({ id: m.__dhId, tag, phase: __dh.phase }); return _hm.apply(this, arguments); };
    // targets stay exactly where the test puts them (after the monster step, so AI, knockback and gravity cannot move them)
    window.__dhPin = () => { for (const m of game.monsters) { const q = m.__dhPos; if (!q) continue; m.x = q.x; m.y = q.y; m.vx = 0; m.vy = 0; m.onGround = true; } };
    const _um = updateMonsters; window.updateMonsters = function () { const r = _um.apply(this, arguments); try { __dhPin(); } catch (e) {} return r; };
    const mk = (id, type, boss) => {
      for (let t = 0; t < 8; t++) {
        const m = spawnMonster(1800, FEET - 300, type, boss);
        if (!m || m._suppressed) return null;
        if (boss || (!m.isElite && !m.isMiniBoss && m.h <= 60)) { m.__dhId = id; return m; }
        const i = game.monsters.indexOf(m); if (i >= 0) game.monsters.splice(i, 1);
      }
      return null;
    };
    const made = { king: mk('king', 'king', true), mooma: mk('mooma', 'mooma', true), kingKrook: mk('kingKrook', 'kingKrook', true), shroom: mk('shroom', 'mushroom', false), high: mk('high', 'mushroom', false) };
    game.paused = false; try { closeAllModals(); } catch (e) {}
    const sz = {}; for (const k in made) sz[k] = made[k] ? [Math.round(made[k].w), Math.round(made[k].h)] : null;
    return { FEET, sz, wrapped: window.hitMonster !== _hm };
  });
  console.log('setup', JSON.stringify(setup));
  // one cast: the target at centre offset d ahead (lift = its feet above the player's floor), everyone else parked far away
  const cast = (skill, cls, tid, d, lift) => p.evaluate(async ([skill, cls, tid, d, lift]) => {
    const FEET = __dh.FEET, PX = 300;
    player.cls = cls; player.job = null; player.level = 100; player.skillRanks = Object.assign(player.skillRanks || {}, { [skill]: 10 });
    player.x = PX; player.y = FEET - player.h; player.vx = 0; player.vy = 0; player.onGround = true; player.facing = 1;
    player.hp = player.maxHp; player.mp = 1e6; player.invulnerable = 999999; player._skillLockTimer = 0;
    player.skillCooldowns = {}; player._flurryReturn = null; player._blinkUpIntent = false; player.rushTimer = 0; player.smokeLock = 0; game.keys = {};
    const pcx = PX + player.w / 2; let tgt = null;
    for (const m of game.monsters) {
      if (!m.__dhId) continue;
      m.currentHp = 1e9; m.maxHp = Math.max(m.maxHp || 0, 1e9);   // top up: count hits, never deaths
      if (m.__dhId === tid) { tgt = m; m.__dhPos = { x: pcx + d - m.w / 2, y: FEET - lift - m.h }; }
      else m.__dhPos = { x: 1900 - m.w / 2, y: FEET - m.h };
    }
    if (!tgt) return { err: 'no target ' + tid };
    __dhPin(); game.paused = false;
    __dh.log.length = 0; __dh.phase = 'cast'; castSkill(skill); __dh.phase = 'after';
    const t0 = game.time, w0 = performance.now();
    while ((performance.now() - w0 < 1100 || game.time - t0 < 24) && performance.now() - w0 < 12000) await new Promise((s) => setTimeout(s, 50));
    __dh.phase = 'idle';
    const mine = __dh.log.filter((e) => e.id === tid);
    return { all: mine.length, tagged: mine.filter((e) => e.tag === skill).length, after: mine.filter((e) => e.tag === skill && e.phase === 'after').length,
      hpLost: Math.round(1e9 - tgt.currentHp), frames: game.time - t0 };
  }, [skill, cls, tid, d, lift]);

  // skill, class, distances (centre to centre, inside each skill's own horizontal reach), what counts as "hit"
  const SKILLS = [
    { id: 'flurry', cls: 'rogue', name: 'Flurry', ds: [60, 160], hit: (r) => r.tagged >= 1, need: '>= 1 slash' },
    { id: 'blink', cls: 'mage', name: 'Dimensional Warp', ds: [60, 160], hit: (r) => r.tagged >= 1, need: '>= 1 hit' },
    { id: 'rush', cls: 'warrior', name: 'Rush', ds: [40, 90], hit: (r) => r.tagged >= 3, need: '>= 3 hits (body + flame bursts; the body alone is 1)' },
    { id: 'smokeDash', cls: 'rogue', name: 'Smoke Dash cloud', ds: [200, 250], hit: (r) => r.after >= 2, need: '>= 2 cloud ticks' },
  ];
  const BOSSES = [['king', 'King Gloopaloo'], ['mooma', 'Mooma'], ['kingKrook', 'King Krook']];
  for (const S of SKILLS) {
    for (const [bid, bname] of BOSSES) {
      const rs = []; for (const d of S.ds) rs.push({ d, ...(await cast(S.id, S.cls, bid, d, 0)) });
      check(rs.every((r) => !r.err && S.hit(r)), `${S.name} hits ${bname} standing on the player's floor at ${S.ds.join(' and ')} px (${S.need})`, rs);
    }
    const sh = []; for (const d of S.ds) sh.push({ d, ...(await cast(S.id, S.cls, 'shroom', d, 0)) });
    check(sh.every((r) => !r.err && S.hit(r)), `${S.name} still hits a Shroom on the player's floor at ${S.ds.join(' and ')} px`, sh);
    const hi = { d: S.ds[0], ...(await cast(S.id, S.cls, 'high', S.ds[0], 120)) };
    check(!hi.err && hi.all === 0, `${S.name} does not reach a Shroom on a platform 120 px above the player`, hi);
  }
  check(errs.length === 0, 'no page errors', errs.slice(0, 5));
} finally {
  await browser.close().catch(() => {}); srv.kill();
}
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
