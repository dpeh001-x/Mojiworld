// BOSS ADDS DO NOT BECOME PERMANENT CORPSES.
//
// Nothing in the engine reaps a zero-HP monster: the death path runs from the damage resolver,
// not from a poll. So `m.currentHp = 0` on its own does not remove anything — it produces a
// monster that is still in game.monsters, still drawn, and un-killable, because hitting
// something already at zero does nothing. Three places assumed otherwise:
//
//   * the PQ Conductor's death sweep (v0.29.885)                  — fixed v0.30.503
//   * the Tower Sovereign's lapsed Regalia window                  — this test's main subject
//   * the Octobaby leg orphan path                                — fixed v0.30.505
//
// The Sovereign case is the worst of the three because it repeats: 4-6 shards are raised every
// 16-22 s for the whole fight, and every window the player declines leaves its whole set behind.
//
//   node scripts/boss_add_sweep_test.mjs        MOJI_SERVE_ROOT / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10771); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function' && typeof bossAI === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(6000);

  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    const o = {};
    // Record what updateMonsters throws instead of swallowing it. An earlier draft used a bare
    // catch{} here and a ReferenceError thrown EVERY FRAME by a bad fix surfaced only as
    // "4 legs not swept" — a crash wearing an assertion's clothes.
    const pumpErrs = [];
    const step = (n) => { for (let i = 0; i < n; i++) { try { if (typeof updateMonsters === 'function') updateMonsters(16.667); } catch (e) { if (pumpErrs.length < 3) pumpErrs.push(String(e && e.message || e).slice(0, 120)); } } };
    // The Crown Regalia lives in _bossSpecialAttacks(m, dt); a bare updateMonsters pump never
    // reaches it, and the first draft of this test measured "0 shards raised" for that reason.
    const tick = (m, n) => { for (let i = 0; i < n; i++) { game.time = (game.time | 0) + 1; try { _bossSpecialAttacks(m, 16.667); } catch (e) {} } };
    const corpses = () => (game.monsters || []).filter((m) => m && m.currentHp <= 0 && !m._dying).length;

    loadMap('forest', 300); await sleep(700);
    game.paused = false;
    player.level = 150; player.maxHp = 9e6; player.hp = 9e6; player._god = true;

    // ---- Tower Sovereign: three declined Regalia windows --------------------
    game.monsters.length = 0;
    const sov = spawnMonster(player.x + 400, player.y - 100, 'towerSovereign', true, false);
    o.sovSpawned = !!sov;
    if (sov) {
      sov.maxHp = 9e9; sov.currentHp = 9e9;   // survive the whole measurement
      // The whole Sovereign block in _bossSpecialAttacks is gated on _expeditionFinalBoss,
      // which only the expedition spawner sets. Without it the Regalia never raises and this
      // test measured "0 shards" against a mechanic that had simply not run.
      sov._expeditionFinalBoss = true;
      o.windows = [];
      for (let w = 0; w < 3; w++) {
        // raise the crown now...
        sov._sovShielded = false; sov._sovExposedUntil = 0;
        sov._sovRegaliaAt = (game.time | 0) - 1;
        tick(sov, 3);
        const raised = (game.monsters || []).filter((m) => m && m._sovShardOf === sov).length;
        // ...and decline it: let the window lapse untouched, which is what the code
        // calls "the window WAS the reward and it was declined".
        sov._sovRegaliaEnds = (game.time | 0) - 1;
        tick(sov, 4);
        o.windows.push({ raised, corpsesNow: corpses(), monsters: game.monsters.length });
      }
      tick(sov, 300); step(300);   // ten seconds: anything that reaps them has every chance to
      o.sovCorpsesAfter = corpses();
      o.sovShardsLeft = (game.monsters || []).filter((m) => m && m._sovShardOf === sov).length;
      // and are they killable at all?
      let stubborn = 0;
      for (const mo of [...(game.monsters || [])]) {
        if (!mo || mo === sov || mo.currentHp > 0) continue;
        for (let i = 0; i < 120 && game.monsters.indexOf(mo) >= 0; i++) { try { hitMonster(mo, 1e9, false); } catch (e) { break; } step(1); }
        if (game.monsters.indexOf(mo) >= 0) stubborn++;
      }
      o.sovStubborn = stubborn;
    }

    // ---- PQ Conductor: the v0.30.503 fix must stay fixed ---------------------
    game.monsters.length = 0;
    const con = spawnMonster(player.x + 300, player.y - 60, 'pqConductor', true, false);
    o.conSpawned = !!con;
    if (con) {
      const adds = [];
      for (let i = 0; i < 2; i++) {
        const a = spawnMonster(player.x + 200 + i * 60, player.y, 'ticketMech', false);
        if (a) { a._pqSummoned = true; adds.push(a); }
      }
      o.conAdds = adds.length;
      for (let i = 0; i < 400 && game.monsters.indexOf(con) >= 0; i++) { try { hitMonster(con, 1e9, false); } catch (e) { break; } step(1); }
      if (game.monsters.indexOf(con) >= 0) { try { killMonster(con); } catch (e) {} }
      step(60);
      o.conAddsLeft = (game.monsters || []).filter((m) => m && m._pqSummoned).length;
      o.conCorpses = corpses();
    }
    // ---- Octobaby: a leg whose head left by any route other than killMonster ----
    // The head's killMonster handler splices the legs it knows about. This is the OTHER path:
    // updateMonsters finds a leg whose parent is gone and used to zero its HP and move on,
    // trusting a reaper that does not exist.
    // Killing the Conductor above set game.paused for the victory banner, and updateMonsters
    // does nothing while paused — so the first draft of this section pumped 50 frames into a
    // frozen world and reported four un-swept legs against a fix that was working. Same leaked
    // state boss_death_cleanup_test warns about in its own __setup.
    game.paused = false;
    game.monsters.length = 0;
    const head = spawnMonster(player.x + 300, player.y - 60, 'octobaby', true, false);
    o.octoSpawned = !!head;
    if (head) {
      step(30);                                  // let the head put its legs out
      const legs = (game.monsters || []).filter((x) => x && x._octoParent === head);
      o.octoLegs = legs.length;
      // orphan them WITHOUT killMonster — a splice of the head alone
      const hi = game.monsters.indexOf(head);
      if (hi >= 0) game.monsters.splice(hi, 1);
      head.currentHp = 0;
      step(20);
      o.octoLegsLeft = (game.monsters || []).filter((x) => x && x._octoParent === head).length;
      o.octoCorpses = corpses();
      let stubborn = 0;
      for (const mo of [...(game.monsters || [])]) {
        if (!mo || mo.currentHp > 0) continue;
        for (let i = 0; i < 120 && game.monsters.indexOf(mo) >= 0; i++) { try { hitMonster(mo, 1e9, false); } catch (e) { break; } step(1); }
        if (game.monsters.indexOf(mo) >= 0) stubborn++;
      }
      o.octoStubborn = stubborn;
    }
    o.pumpErrs = pumpErrs;
    return o;
  });

  console.log(JSON.stringify(r, null, 1).slice(0, 1400) + '\n');

  ok('the Sovereign spawned', r.sovSpawned);
  ok('each declined Regalia window really raised shards', (r.windows || []).every((w) => w.raised >= 3), JSON.stringify(r.windows));
  ok('a lapsed Regalia window leaves no corpses behind', r.sovCorpsesAfter === 0, `${r.sovCorpsesAfter} zero-HP monsters after three declined windows`);
  ok('no shard outlives its window', r.sovShardsLeft === 0, `${r.sovShardsLeft} shards still in game.monsters`);
  ok('nothing left behind is unkillable', (r.sovStubborn || 0) === 0, `${r.sovStubborn} could not be removed by damage`);

  ok('the Conductor spawned with adds', r.conSpawned && r.conAdds === 2);
  ok('the Conductor still sweeps his adds (v0.30.503 holds)', r.conAddsLeft === 0, `${r.conAddsLeft} left`);
  ok('...and leaves no corpses either', r.conCorpses === 0, `${r.conCorpses} zero-HP monsters`);
  ok('the Octobaby head put its legs out', r.octoSpawned && (r.octoLegs || 0) >= 1, 'legs=' + r.octoLegs);
  ok('an orphaned leg is removed, not left at zero HP', (r.octoLegsLeft || 0) === 0, `${r.octoLegsLeft} legs still attached to a gone head`);
  ok('...and leaves no corpse behind', (r.octoCorpses || 0) === 0, `${r.octoCorpses} zero-HP monsters`);
  ok('...and nothing left is unkillable', (r.octoStubborn || 0) === 0, `${r.octoStubborn} could not be removed`);
  ok('updateMonsters threw nothing while pumping', (r.pumpErrs || []).length === 0, (r.pumpErrs || []).join(' | '));
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally {
  await browser.close(); server.kill();
}
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
