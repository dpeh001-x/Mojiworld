// What survives a boss's death?
//
// The softlock candidate this exists for: killing a boss while it has you
// SHACKLED. The QTE stun is released by boss-side code; if the boss dies first
// and nothing calls _qteEnd, the player is left stunned with nothing alive to
// free them. Every boss is therefore killed twice -- once normally, once
// mid-shackle -- and the world is then run for 20 s with zero player input.
//
// Also guards orphaned hazards outliving the fight (the "I killed it and then
// died to nothing" class of bug).
//
// NOT failed on: leftover monsters. Gemini and Pisces split into a twin by
// design (with an explicit anti-recursion guard), and Conductor/Libra summon
// adds; all are ordinary killable monsters. The invariant asserted is that
// whatever remains can be cleared, not that nothing remains.
//   node scripts/boss_death_cleanup_test.mjs
// Env: PW_EXE / PW_CHANNEL (default msedge), PORT (default 8910)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 8910;
const server = spawn(process.execPath, [join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch(process.env.PW_EXE
  ? { executablePath: process.env.PW_EXE, headless: true }
  : { channel: process.env.PW_CHANNEL || 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(8000);

await page.evaluate(() => {
  window.__step = (dt) => {
    game.time = (game.time | 0) + 1;
    if (typeof updatePlayer === 'function') updatePlayer(dt);
    updateMonsters(dt); updateProjectiles(dt);
    if (typeof updateMinions === 'function') updateMinions(dt);
    if (typeof updateParticles === 'function') updateParticles(dt);
    if (typeof updateMapEvents === 'function') updateMapEvents(dt);
  };
  window.__setup = (type) => {
    const a = Object.entries(MAPS)
      .filter(([id, mp]) => !mp.isVoid && !mp.isTown && (mp.platforms || []).some(p => p.w > 900))
      .sort((x, y) => y[1].worldWidth - x[1].worldWidth)[0];
    loadMap(a[0]);
    const ww = game.mapData.worldWidth;
    const gy = (game.mapData.platforms || []).filter(p => p.w > 900).sort((x, y) => x.y - y.y)[0].y;
    game.monsters.length = 0;
    for (const k of ['projectiles', 'particles', 'hazards', 'minions', 'fxInstances']) if (game[k]) game[k].length = 0;
    game.keys = {};
    player.level = 200; player.maxHp = 9999999; player.hp = 9999999;
    player.x = ww * 0.5; player.y = gy - 80; player.vx = 0; player.vy = 0;
    player.invulnerable = 0; player._god = false;
    player.stunTimer = 0; player.frozenTimer = 0;
    // 50 fights share one page, so per-run state MUST be torn down properly.
    // Force-clearing _QTE.active without _qteEnd left the card and its internal
    // state half-alive, and boss death sets game.paused (victory banner) which
    // then persisted into every later run â€” between them they made the last few
    // bosses in iteration order report a 20 s stun that a clean single run
    // measures at 2.5 s. Leaked harness state, not a game defect.
    if (typeof _qteEnd === 'function') { try { _qteEnd(false); } catch (e) {} }
    if (typeof _QTE !== 'undefined' && _QTE) { _QTE.active = false; _QTE.remain = 0; }
    game.paused = false; game.dying = false;
    return spawnMonster(ww * 0.5 + 260, gy - 200, type, true);
  };
});

const BOSSES = await page.evaluate(() => Object.entries(monsterTypes).filter(([k, t]) => t && t.boss).map(([k]) => k));
console.log('BOSS'.padEnd(24) + 'mode        hazLeft  release  ccStuck  clearable  monsLeft');
console.log('-'.repeat(78));

const results = [];
const ok = (n, c, e) => results.push({ n, pass: !!c, e });

for (const type of BOSSES) {
  for (const mode of ['normal', 'midShackle']) {
    const before = errs.length;
    const r = await page.evaluate(([type, mode]) => {
      const out = { type, mode };
      try {
        const m = window.__setup(type);
        if (!m || m._suppressed) { out.fatal = 'spawn failed'; return out; }
        for (let i = 0; i < 1500; i++) {                 // warm up: get hazards in flight
          m.currentHp = Math.max(1, Math.floor(m.maxHp * (1 - i / 1500 * 0.9)));
          player.hp = player.maxHp; window.__step(16.667);
          if (game.monsters.indexOf(m) < 0) break;
        }
        if (game.monsters.indexOf(m) < 0) { out.skipped = 'died during warm-up'; return out; }
        if (mode === 'midShackle') {
          if (typeof _qteShackleStart !== 'function') { out.skipped = 'no shackle fn'; return out; }
          _qteShackleStart(m);
          if (!(player.stunTimer > 0)) { out.skipped = 'shackle did not take'; return out; }
        }
        for (let i = 0; i < 400 && game.monsters.indexOf(m) >= 0; i++) {
          try { hitMonster(m, 1e9, false); } catch (e) { break; }
          window.__step(16.667);
        }
        if (game.monsters.indexOf(m) >= 0 && typeof killMonster === 'function') { killMonster(m); window.__step(16.667); }
        if (game.monsters.indexOf(m) >= 0) { out.fatal = 'could not kill'; return out; }

        // Track how long the shackle that was live AT DEATH takes to release.
        // Cumulative stunned-frames is the wrong measure: Gemini/Pisces twins
        // and Conductor/Libra adds survive by design and can legitimately
        // re-shackle you afterwards. What matters is that the boss's own
        // shackle drains and that nothing is left holding you.
        let releaseFrame = -1, reshackles = 0;
        let prevActive = typeof _QTE !== 'undefined' && _QTE ? !!_QTE.active : false;
        for (let i = 0; i < 1200; i++) {                 // 20 s, no input at all
          player.hp = player.maxHp; window.__step(16.667);
          const act = typeof _QTE !== 'undefined' && _QTE ? !!_QTE.active : false;
          if (act && !prevActive) reshackles++;          // a LIVE add grabbed us again
          prevActive = act;
          if (releaseFrame < 0 && (player.stunTimer | 0) <= 0) releaseFrame = i;
        }
        out.releaseSec = releaseFrame < 0 ? null : +(releaseFrame / 60).toFixed(1);
        out.reshackles = reshackles;
        // whatever remains must be killable, or the arena never clears
        let clearable = true;
        for (const mo of [...(game.monsters || [])]) {
          for (let i = 0; i < 250 && game.monsters.indexOf(mo) >= 0; i++) {
            try { hitMonster(mo, 1e9, false); } catch (e) { break; }
            window.__step(16.667);
          }
          if (game.monsters.indexOf(mo) >= 0) clearable = false;
        }
        Object.assign(out, {
          hazAfter: (game.hazards || []).length,
          monsLeft: (game.monsters || []).length,
          // Only "stuck" if something still holds us with nothing alive to have
          // re-applied it. CC from a surviving add is the game working.
          ccStuck: ((player.stunTimer | 0) > 0 || (player.frozenTimer | 0) > 0 ||
                    (typeof _QTE !== 'undefined' && _QTE ? !!_QTE.active : false)) &&
                   (game.monsters || []).length === 0,
          clearable,
        });
      } catch (e) { out.fatal = String(e).slice(0, 180); }
      return out;
    }, [type, mode]);
    r.pageErrs = errs.length - before;
    const p = (v, n) => String(v ?? '-').padStart(n);
    console.log(String(type).padEnd(24) + String(mode).padEnd(12) + p(r.hazAfter, 6) + p(r.releaseSec, 10) +
      p(r.ccStuck ? 'YES' : 'no', 9) + p(r.clearable === undefined ? '-' : (r.clearable ? 'yes' : 'NO'), 11) +
      p(r.monsLeft, 7) + (r.skipped ? '  (' + r.skipped + ')' : '') + (r.fatal ? '  ERR ' + r.fatal : ''));
    if (r.skipped) continue;
    const tag = `${type}/${mode}`;
    if (r.fatal) { ok(`${tag} completes`, false, r.fatal); continue; }
    ok(`${tag}: nothing holds the player once the arena is empty`, !r.ccStuck);
    // The shackle is a 3 s timer; 6 s is generous slack, and a null release
    // means it never let go at all within the 20 s window.
    ok(`${tag}: the boss's own shackle releases`, r.releaseSec != null && r.releaseSec <= 6, `${r.releaseSec}s`);
    ok(`${tag}: no hazards outlive the boss`, (r.hazAfter || 0) === 0, `${r.hazAfter} left`);
    ok(`${tag}: leftovers are killable`, r.clearable !== false);
    if (r.pageErrs) ok(`${tag}: no page errors`, false, `${r.pageErrs}`);
  }
}

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} assertions pass across ${BOSSES.length} bosses x2 death modes`);
if (failed.length) { console.log('FAIL:'); failed.forEach(f => console.log(`  ${f.n}${f.e ? '  (' + f.e + ')' : ''}`)); }
else console.log("PASS â€” nothing outlives a boss's death: no hazards, no stuck CC, and every leftover is killable");
console.log('pageerrors:', errs.length, errs.slice(0, 5));
await browser.close(); server.kill();
process.exit(failed.length || errs.length ? 1 : 0);
