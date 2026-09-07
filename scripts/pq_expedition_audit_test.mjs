// Expedition + Ticket Rush audit (v0.30.407). Pins the fixes from the bug check:
//   PQ  - the class Lv-37 Conductor Sweep ticks (the direct PQ tick swallowed every ticket-family kill
//         and the alias hid the literal target); the direct tick reports false when nothing advanced;
//         a restart before the finale was ever cleared is not a repeat run; a restart resets the
//         Express run too; a repeat still pays 25% coins and 50% EXP; Milo's Stage-1 line reads the count.
//   EXP - a floor-clear timer carries its floor and cannot clear the next one; floor EXP is weighted by
//         depth (same run total, B1 pays 1/55); the puzzle's Continue is guarded; the unlock banner
//         fires at the gate level; the briefing says EXP is kept.
//   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10191); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof loadMap === 'function' && typeof _lxPqDirectTick === 'function' && typeof _completeQuest === 'function' && typeof _expeditionFloorCleared === 'function', null, { timeout: 180000 }); await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const o = { ver: GAME_VERSION };
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {} try { _cineScoreStop(1, false); } catch (e) {} try { _lxMenuBgmStop(); } catch (e) {}
    const gate = async () => { const n0 = (window._lxReadyGateLog || []).length; const t0 = performance.now(); while ((window._lxReadyGateLog || []).length <= n0 && performance.now() - t0 < 9000) await sleep(100); await sleep(300); };
    player.quests = player.quests || {}; player.quests.active = player.quests.active || {}; player.quests.completed = player.quests.completed || {}; player.quests.unlocked = player.quests.unlocked || {};
    const clearQ = () => { for (const k of Object.keys(player.quests.active)) delete player.quests.active[k]; for (const k of Object.keys(player.quests.completed)) delete player.quests.completed[k]; };
    player.level = 40; player.hp = player.maxHp; player.invulnerable = 9e9;
    // 1. Conductor Sweep: three Conductor Mech kills on the Underpass with only the class quest active
    const qid = Object.keys(QUESTS).find((k) => /_lv37$/.test(k) && QUESTS[k].target === 'conductorMech' && QUESTS[k].cls === player.cls) || Object.keys(QUESTS).find((k) => /_lv37$/.test(k) && QUESTS[k].target === 'conductorMech') || null;
    if (qid && QUESTS[qid].cls) player.cls = QUESTS[qid].cls;   // the quest tick re-checks the class gate
    loadMap('clockworkUnderpassLobby', 300); await gate(); game.paused = false; clearQ();
    o.sweep = { qid, noneActiveTick: _lxPqDirectTick() };
    if (qid) { player.quests.active[qid] = { progress: 0, targetCount: QUESTS[qid].count }; for (let i = 0; i < 3; i++) { const m = spawnMonster(player.x + 120, player.y, 'conductorMech', false); if (!m) break; m.evasion = 0; m.invulnerable = 0; m.currentHp = 3; try { hitMonster(m, 1e9, false, 'melee'); } catch (e) {} game.time += 120; await sleep(120); } await sleep(400); o.sweep.progress = player.quests.active[qid] ? player.quests.active[qid].progress : 'gone'; delete player.quests.active[qid]; }
    // ...and a Stage-1 kill still ticks Stage 1 (the fix must not break the PQ path)
    player.quests.active.q_clockwork_underpass = { progress: 0, targetCount: 100 }; { const m = spawnMonster(player.x + 120, player.y, 'ticketMech', false); if (m) { m.evasion = 0; m.invulnerable = 0; m.currentHp = 3; try { hitMonster(m, 1e9, false, 'melee'); } catch (e) {} } } await sleep(400);
    o.sweep.stage1Progress = player.quests.active.q_clockwork_underpass ? player.quests.active.q_clockwork_underpass.progress : 'gone'; clearQ();
    // 2. restart semantics
    const noLoad = (fn) => { const L = window.loadMap; window.loadMap = () => {}; try { fn(); } catch (e) { o.restartErr = String(e.message); } window.loadMap = L; };
    player._pqChainRuns = 0; player.quests.completed.q_clockwork_underpass = true; noLoad(() => _lxPqRestartChain());
    o.restart = { earlyRuns: player._pqChainRuns, earlyMul: _lxPqRepeatMul('q_clockwork_underpass') };
    clearQ(); player._pqChainRuns = 0; for (const id of ['q_clockwork_underpass', 'q_pq_spire', 'q_pq_carriage', 'q_pq_finale']) player.quests.completed[id] = true; player.quests.active.q_clockwork_express = { progress: 3, targetCount: 60 }; noLoad(() => _lxPqRestartChain());
    o.restart.afterFinaleRuns = player._pqChainRuns; o.restart.afterFinaleMul = _lxPqRepeatMul('q_clockwork_underpass'); o.restart.expressCleared = !player.quests.active.q_clockwork_express && !player.quests.completed.q_clockwork_express; clearQ();
    // 3. a repeat pays 25% coins and 50% EXP at two levels (the coin factor must not reach the EXP path)
    const stage1 = (lv, runs) => { player.level = lv; player.exp = 0; player._pqChainRuns = runs; delete player.quests.completed.q_clockwork_underpass; player.quests.active.q_clockwork_underpass = { progress: 100, targetCount: 100 }; player.mojicoins = 0; const l0 = player.level, e0 = player.exp; _completeQuest('q_clockwork_underpass'); return { exp: player.level > l0 ? _lxLevelCost(l0) - e0 + player.exp : player.exp - e0, coins: player.mojicoins }; };
    o.repeat = {}; for (const lv of [29, 60]) { const a = stage1(lv, 0), b = stage1(lv, 1); o.repeat[lv] = { expRatio: +(b.exp / Math.max(1, a.exp)).toFixed(3), coinRatio: +(b.coins / Math.max(1, a.coins)).toFixed(3) }; } clearQ(); player._pqChainRuns = 0;
    // 4. the floor-clear timer carries its floor (synthetic run on a field map, level-up held off)
    loadMap('forest', 300); await gate(); game.paused = true; game.monsters.length = 0; const LU = window._maybeLevelUp; window._maybeLevelUp = () => {}; const TS = window.showToast; window.showToast = () => {};
    player.level = 45; player.exp = 0; game.expedition = { active: true, floor: 4, bravoReady: false, currentQuest: null, _floorClearedFor: null };
    _expeditionFloorCleared(3, true); o.stale = { expAfterStaleTimer: player.exp, bravoAfterStaleTimer: !!game.expedition.bravoReady, clearedFor: game.expedition._floorClearedFor };
    const mob = spawnMonster(player.x + 200, player.y, 'thornmaw', false); _expeditionFloorCleared(4, true); o.stale.clearedWithMobAlive = !!game.expedition.bravoReady; if (mob) game.monsters.splice(game.monsters.indexOf(mob), 1);
    _expeditionFloorCleared(4, true); o.stale.clearedWhenEmpty = !!game.expedition.bravoReady && player.exp > 0;
    // 5. floor EXP by depth: the ten grants sum to the run budget, and B1 pays a fifty-fifth of it
    player.exp = 0; game.expedition = { active: true, floor: 0, bravoReady: false, currentQuest: null }; const grants = []; for (let f = 1; f <= EXPEDITION_FLOOR_COUNT; f++) grants.push(_lxGrantExpeditionFloorExp(f));
    const budget = _lxLevelCost(45) * _lxExpeditionRunTarget(45); o.floors = { grants, sumOverBudget: +(grants.reduce((a, b) => a + b, 0) / budget).toFixed(4), b1Share: +(grants[0] / budget).toFixed(4), b10Share: +(grants[9] / budget).toFixed(4), monotonic: grants.every((g, i) => i === 0 || g > grants[i - 1]) };
    game.expedition = { active: false, floor: 0, bravoReady: false, currentQuest: null }; window._maybeLevelUp = LU; window.showToast = TS;
    // 6. the banner and the gate agree; the briefing keeps EXP; Milo's line reads the count
    const intro = (typeof MODE_INTROS !== 'undefined') ? (MODE_INTROS.find ? MODE_INTROS.find((x) => x && x.id === 'towerExpedition') : null) : null;
    o.text = { bannerLevel: intro ? intro.level : null, gate: (typeof EXPEDITION_LEVEL_GATE !== 'undefined') ? EXPEDITION_LEVEL_GATE : null };
    const src = await (await fetch(location.pathname)).text();
    o.text.briefingSaysExpVanishes = /coins, and EXP gained inside <b>vanish on exit<\/b>/.test(src); o.text.briefingKeepsExp = /EXP and levels are yours to keep/.test(src);
    o.text.miloHardcoded = /a hundred and fifty! Stage 1 completes/.test(src); o.text.miloReadsCount = /_lxPqStageCount\('q_clockwork_underpass'\) \+ ' punched!/.test(src);
    o.text.puzzleGuarded = /#ec-puzzle-ok'\)\.onclick = \(\) => \{\s*modal\.remove\(\);\s*game\.paused = false;\s*if \(!game\.expedition \|\| !game\.expedition\.active\) return;/.test(src);
    return o;
  });
  console.log('build ' + r.ver + '  sweep ' + JSON.stringify(r.sweep) + '  restart ' + JSON.stringify(r.restart) + '  repeat ' + JSON.stringify(r.repeat) + '  stale ' + JSON.stringify(r.stale) + '  floors ' + JSON.stringify(r.floors) + '  text ' + JSON.stringify(r.text));
  ok('the class Lv-37 Conductor Sweep counts Conductor Mech kills (3 kills -> 3/20)', r.sweep.qid && r.sweep.progress === 3, JSON.stringify(r.sweep));
  ok('the direct PQ tick reports false when no PQ stage is active (so the standard quest tick runs)', r.sweep.noneActiveTick === false, String(r.sweep.noneActiveTick));
  ok('a Stage-1 Ticket Mech kill still advances Stage 1', r.sweep.stage1Progress === 1, String(r.sweep.stage1Progress));
  ok('restarting before the finale was ever cleared is not a repeat run (runs stay 0, full rates)', r.restart.earlyRuns === 0 && r.restart.earlyMul === 1, JSON.stringify(r.restart));
  ok('restarting after a cleared finale counts the run, and resets the Express run with the chain', r.restart.afterFinaleRuns === 1 && r.restart.afterFinaleMul === LX_PQ_REPEAT_MUL_EXPECTED() && r.restart.expressCleared === true, JSON.stringify(r.restart));
  ok('a repeat Stage 1 pays 25% coins and 50% EXP at Lv 29 and Lv 60', [29, 60].every((lv) => Math.abs(r.repeat[lv].coinRatio - 0.25) < 0.02 && Math.abs(r.repeat[lv].expRatio - 0.5) < 0.02), JSON.stringify(r.repeat));
  ok('a floor-clear timer armed on floor 3 does nothing on floor 4 (no EXP, Bravo not ready)', r.stale.expAfterStaleTimer === 0 && r.stale.bravoAfterStaleTimer === false && r.stale.clearedFor == null, JSON.stringify(r.stale));
  ok('a regular-floor timer re-checks the room: a live mob blocks the clear, an empty room clears', r.stale.clearedWithMobAlive === false && r.stale.clearedWhenEmpty === true, JSON.stringify(r.stale));
  ok('floor EXP is weighted by depth: ten grants sum to the run budget, B1 pays ~1/55, B10 ~10/55, strictly rising', Math.abs(r.floors.sumOverBudget - 1) < 0.002 && Math.abs(r.floors.b1Share - 1 / 55) < 0.002 && Math.abs(r.floors.b10Share - 10 / 55) < 0.002 && r.floors.monotonic, JSON.stringify(r.floors));
  ok('the unlock banner fires at the gate level', r.text.bannerLevel != null && r.text.bannerLevel === r.text.gate, JSON.stringify([r.text.bannerLevel, r.text.gate]));
  ok('the briefing no longer says EXP vanishes; it says EXP and levels are kept', !r.text.briefingSaysExpVanishes && r.text.briefingKeepsExp);
  ok('Milo\'s Stage-1 line reads the stage count instead of "a hundred and fifty"', !r.text.miloHardcoded && r.text.miloReadsCount);
  ok('the puzzle\'s Continue is guarded against a run that already ended', r.text.puzzleGuarded);
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
function LX_PQ_REPEAT_MUL_EXPECTED() { return 0.25; }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
