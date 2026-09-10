// Tower expedition (v0.30.453). Per user: "Tower arbiter needs to be stronger, more DEF"; "the
// towersovereign is also very buggy, the second u kill / or die to the boss u instantly teleport out
// of the map"; "The exp should be better on completion of the expedition".
//
// Measured live: real damage through the real pipeline, the real map after a real _endExpedition,
// and the real EXP the grant functions pay.
//   node scripts/tower_expedition_test.mjs      MOJI_GAME_FILE / MOJI_SERVE_ROOT / PORT override
// Negative control v0.30.452: Arbiter def 90, the map flips to town in the same tick the run ends,
// and a Lv 75 clear pays 5% of a level with no completion bonus at all.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10291); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof monsterTypes === 'object' && typeof _endExpedition === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    try { _cineScoreStop(1, false); } catch (e) {}
    const o = { ver: GAME_VERSION };
    const A = monsterTypes.towerArbiter, S = monsterTypes.towerSovereign;
    o.arbiter = { hp: A.hp, atk: A.atk, def: A.def, exp: A.exp };
    o.sovereign = { def: S.def };
    // What the player actually FIGHTS. data/monster_stats.js overrides monsterTypes for any type
    // it lists (v0.29.762 — "the file's number IS the stat"), and both of these are listed. The
    // two DEF checks below used to read monsterTypes alone and so graded a number nothing used.
    o.table = {
      arbiter:   (typeof LX_MONSTER_STATS !== 'undefined' && LX_MONSTER_STATS.towerArbiter)   ? LX_MONSTER_STATS.towerArbiter.def   : null,
      sovereign: (typeof LX_MONSTER_STATS !== 'undefined' && LX_MONSTER_STATS.towerSovereign) ? LX_MONSTER_STATS.towerSovereign.def : null,
    };
    // --- how much damage the Arbiter's DEF actually eats, through the live formula
    loadMap('forest', 300); await sleep(700);
    player.level = 70; player.invulnerable = 9e9; game.paused = false;
    const hitFor = (defVal) => {
      game.monsters.length = 0;
      const b = spawnMonster(player.x + 400, player.y, 'towerArbiter', true);
      if (!b) return null;
      b.def = defVal; b.evasion = 0; b.currentHp = b.maxHp = 1e9; b._wardUntil = 0; b.invulnerable = 0;
      const before = b.currentHp;
      try { hitMonster(b, 100000, false, null); } catch (e) { return null; }
      const dealt = before - b.currentHp;
      game.monsters.length = 0;
      return dealt;
    };
    const atNew = hitFor(A.def), atOld = hitFor(90);
    o.dmg = { atShippedDef: atNew, atOldDef90: atOld, reduction: (atOld && atNew) ? +(1 - atNew / atOld).toFixed(3) : null };
    // The honest "stronger" metric is HP and DEF together, but it has to be DETERMINISTIC. Counting
    // hits-to-kill in a loop is not: the same (hp, def) measured 8 hits once and 19 the next, because
    // a live boss carries revive, ward and phase state between spawns — so that version reported a
    // confident 2.38x on the UNCHANGED build. Derive it instead from the stable per-hit figures
    // already measured above: effective toughness = HP / damage taken per hit.
    o.ttk = { now: +(A.hp / atNew).toFixed(2), before: +(42000 / atOld).toFixed(2),
              tougher: (atNew && atOld) ? +((A.hp / atNew) / (42000 / atOld)).toFixed(2) : null };
    // --- the EXP the run pays
    o.exp = { at40: (typeof LX_EXP_RUN_AT_40 !== 'undefined') ? LX_EXP_RUN_AT_40 : null,
              at70: (typeof LX_EXP_RUN_AT_70 !== 'undefined') ? LX_EXP_RUN_AT_70 : null,
              clearBonus: (typeof LX_EXP_CLEAR_BONUS !== 'undefined') ? LX_EXP_CLEAR_BONUS : null,
              target75: (typeof _lxExpeditionRunTarget === 'function') ? _lxExpeditionRunTarget(75) : null };
    // --- THE BUG: ending a run must not swap the map in the same breath
    const track = async (reason) => {
      loadMap('tower_b10', 300); await sleep(800);
      const startMap = game.currentMap;
      game.expedition = { active: true, floor: 10, snapshot: null, _startExp: player.exp | 0, _startLevel: player.level | 0 };
      _endExpedition(reason);
      const at0 = game.currentMap;                 // same tick
      await sleep(900); const at900 = game.currentMap;
      await sleep(3200); const at4100 = game.currentMap;
      return { startMap, at0, at900, at4100, heldOnMap: at0 === startMap && at900 === startMap, wentHome: at4100 === 'town' };
    };
    o.complete = await track('complete');
    o.death = await track('death');
    // --- and the deferred exit must not fire if the player already left another way
    loadMap('tower_b10', 300); await sleep(700);
    game.expedition = { active: true, floor: 9, snapshot: null };
    _endExpedition('death');
    await sleep(300); loadMap('forest', 300); await sleep(300);   // player leaves by another route
    const mapAfterLeaving = game.currentMap;
    await sleep(3000);
    o.noYank = { leftTo: mapAfterLeaving, stillThere: game.currentMap === mapAfterLeaving, now: game.currentMap };
    return o;
  });
  console.log(`build ${r.ver}  arbiter def ${r.arbiter.def}  run@70 ${r.exp.at70}  clear bonus ${r.exp.clearBonus}`);
  ok('the Arbiter carries the authored DEF 300, with HP and ATK unchanged', r.arbiter.def === 300 && r.arbiter.hp === 58000 && r.arbiter.atk === 395,
    JSON.stringify(r.arbiter));
  // Per user: Arbiter 300, Sovereign 250. That deliberately puts the mid-boss's DEF ABOVE the
  // apex's, so the old "stays under the Sovereign" rule no longer holds and is not asserted.
  // What IS asserted is the invariant that actually bit: the declaration and the authoritative
  // table must agree, or the source is describing a fight nobody has.
  ok('the Arbiter and Sovereign are on their authored DEF', r.arbiter.def === 300 && r.sovereign.def === 250,
    `arbiter ${r.arbiter.def} vs sovereign ${r.sovereign.def}`);
  ok('that DEF really eats damage in the live pipeline (>=15% less per hit than at 90)', r.dmg.reduction !== null && r.dmg.reduction >= 0.15,
    `${r.dmg.atOldDef90} -> ${r.dmg.atShippedDef} per hit, ${Math.round((r.dmg.reduction || 0) * 100)}% less`);
  ok('and with the HP behind it he is at least 1.5x as tough overall (HP / damage per hit)', r.ttk.tougher !== null && r.ttk.tougher >= 1.5,
    `${r.ttk.before} -> ${r.ttk.now} effective hits, ${r.ttk.tougher}x`);
  ok('a full run is worth running again: 0.30 of a level to Lv 40, holding 0.20 past 70', r.exp.at40 === 0.30 && r.exp.at70 === 0.20 && r.exp.target75 === 0.20,
    JSON.stringify(r.exp));
  ok('completion itself pays a bonus worth half the run budget', r.exp.clearBonus === 0.5, String(r.exp.clearBonus));
  ok('killing the boss no longer teleports you out instantly — the map holds, then goes home', r.complete.heldOnMap && r.complete.wentHome,
    `${r.complete.startMap} -> ${r.complete.at0} / ${r.complete.at900} / ${r.complete.at4100}`);
  ok('dying to the boss no longer teleports you out instantly either', r.death.heldOnMap && r.death.wentHome,
    `${r.death.startMap} -> ${r.death.at0} / ${r.death.at900} / ${r.death.at4100}`);
  ok('and the delayed exit never yanks a player who already left by another route', r.noYank.stillThere,
    `left to ${r.noYank.leftTo}, ended on ${r.noYank.now}`);
  ok('monsterTypes agrees with the authoritative stat table', r.table.arbiter === r.arbiter.def && r.table.sovereign === r.sovereign.def,
    `declared ${r.arbiter.def}/${r.sovereign.def} vs table ${r.table.arbiter}/${r.table.sovereign}`);
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
