// An ultimate's window cut short by a map change charges what the window's own close charges (v0.30.1016).
//
// War of Banners, Meteor Sigil and Deadeye park their cooldown at a short re-press gate while their window
// is open, and a watcher charges the real cooldown when the window closes. A map change cancels that, so
// _lxRestoreUltCd charges it instead - and used to charge its own formula: War of Banners got 45 s where
// finishing the enrage gives 60 s (a portal hop saved a quarter of the cooldown), and Meteor Sigil was
// charged twice, once by the repair and again when its stale window ran out on the next map.
//
//   [SERVE_ROOT=<dir with serve.js + the game's data/>] [PORT=11097] node scripts/ult_window_repair_test.mjs [candidate.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11097';
const env = { ...process.env }; if (process.argv[2]) env.MOJI_GAME_FILE = path.resolve(process.argv[2]); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
let pass = 0, fail = 0;
const check = (ok, msg, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (detail ? '  [' + detail + ']' : '')); ok ? pass++ : fail++; };
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof castSkill === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const steps = async (n) => { const t0 = game.time; for (let i = 0; i < 600 && game.time - t0 < n; i++) await sleep(20); };
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    const go = async (map) => { loadMap(map, 300); await sleep(1200); game.paused = false; };
    await go('forest');
    const as = (cls, job, master) => { Object.assign(player, { cls, job, master, masteries: { [master]: true }, _god: true, level: 90, mp: 99999, maxMp: 99999,
      hp: 999999, maxHp: 999999, skillCooldowns: {}, skillRanks: {}, _momentum: 0 }); if (player.mods) player.mods.cdrChance = 0;
      for (const k of Object.keys(player.buffs || {})) player.buffs[k] = 0; };
    const out = {};
    // War of Banners: the enrage finished vs cut short by a portal
    as('warrior', 'berserker', 'warlord'); castSkill('warlord_ult'); await steps(20);
    player._warlordEnrageUntil = game.time; await steps(20);
    out.wobClose = player.skillCooldowns.warlord_ult || 0; out.wobShown = _skillRealCd('warlord_ult');
    await go('forest'); as('warrior', 'berserker', 'warlord'); castSkill('warlord_ult'); await steps(20);
    await go('town'); out.wobPortal = player.skillCooldowns.warlord_ult || 0;
    // Meteor Sigil: one comet, then a portal; the stale window must not charge the cooldown again
    await go('forest'); as('mage', 'archmage', 'sage'); castSkill('sage_ult'); await steps(10);
    const until = player._sageUntilFr | 0, recorded = player._sageFullCd;
    await go('town'); const sig0 = player.skillCooldowns.sage_ult || 0, t0 = game.time;
    while (game.time <= until + 30 && game.time - t0 < 1200) await sleep(50);
    const sig1 = player.skillCooldowns.sage_ult || 0, elapsedMs = (game.time - t0) * 1000 / 60;
    out.sigil = { recorded, afterPortal: sig0, later: sig1, elapsedMs: Math.round(elapsedMs), stale: player._sageUntilFr | 0 };
    // Deadeye: the window's recorded cooldown
    await go('forest'); as('archer', 'sniper', 'marksman'); castSkill('marksman_oneshot'); await steps(10);
    const deRec = player._deRealCd && player._deRealCd.marksman_oneshot;
    await go('town'); out.deadeye = { recorded: deRec, afterPortal: player.skillCooldowns.marksman_oneshot || 0 };
    return out;
  });
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  // since the audit's R6 War of Banners waits what the Skills panel shows (table cd x 0.75 = 45 s), not the raw 60 s
  check(near(r.wobClose, r.wobShown, 1500), 'War of Banners: finishing the enrage charges what the Skills panel shows', Math.round(r.wobClose) + ' vs ' + Math.round(r.wobShown));
  check(near(r.wobPortal, r.wobClose, 1500), 'War of Banners: a portal inside the enrage charges the same', Math.round(r.wobPortal) + ' vs ' + Math.round(r.wobClose));
  check(r.sigil.recorded > 0 && near(r.sigil.afterPortal, r.sigil.recorded, 1500), 'Meteor Sigil: the portal charges the cooldown its cast recorded', JSON.stringify(r.sigil));
  check(r.sigil.stale === 0 && r.sigil.later < r.sigil.afterPortal - 0.8 * r.sigil.elapsedMs + 1500, 'Meteor Sigil: the old window does not charge it again on the next map', JSON.stringify(r.sigil));
  check(r.deadeye.recorded > 0 && near(r.deadeye.afterPortal, r.deadeye.recorded, 1500), 'Deadeye: the portal charges the window\'s recorded cooldown', JSON.stringify(r.deadeye));
  check(!errs.length, 'no page errors', errs.slice(0, 3).join(' | '));
} catch (e) {
  check(false, 'test ran to completion', String(e.message || e).slice(0, 160));
} finally { await browser.close(); server.kill(); }
console.log(fail ? `${fail} FAILED, ${pass} passed` : `ALL ${pass} PASS`);
process.exit(fail ? 1 : 0);
