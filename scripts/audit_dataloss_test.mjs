// The three data-loss findings from the v0.30.493 audit, driven through the real code paths.
//   1. RP-reset fee was `| 0` (ToInt32): a >2.147B wallet wrapped negative and the reset zeroed it.
//   2. _lxSteamCloudSync adopted a stale cloud save on a newer TIMESTAMP alone, with no backup.
//   3. clearSave() left SAVE_KEY + '_verified' behind, so the next character inherited its wallet.
//
//   node scripts/audit_dataloss_test.mjs        MOJI_SERVE_ROOT / PORT override
//
// Negative control: every one of these fails on v0.30.493.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10411); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof renderSkillsReference === 'function' && typeof clearSave === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(6000);

  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    const o = { ver: GAME_VERSION };

    // ---- 1. RP reset on a wallet past the ToInt32 boundary -------------------
    // 3,000,000,000 | 0  ===  -1294967296, so the old code quoted a NEGATIVE fee
    // and Math.max(0, negative - negative) filed the wallet to zero.
    const RICH = 3000000000;
    player.cls = player.cls || 'warrior';
    player.skillRanks = { _t1: 3, _t2: 2 };
    player.skillRankPoints = 0;
    player.mojicoins = RICH;
    const host = document.createElement('div'); document.body.appendChild(host);
    const _realConfirm = window.uiConfirm;
    window.uiConfirm = async (opts) => { o.dialogBody = (opts && opts.body) || ''; o.dialogYes = (opts && opts.yesLabel) || ''; return true; };
    renderSkillsReference(host);
    const btn = host.querySelector('#skl-rp-reset');
    o.rp = { armed: !!btn, title: btn ? btn.title : null, disabled: btn ? !!btn.disabled : null, before: RICH };
    if (btn && !btn.disabled && typeof btn.onclick === 'function') { await btn.onclick(); await sleep(400); }
    o.rp.after = player.mojicoins;
    o.rp.paid = RICH - player.mojicoins;
    o.rp.rpRefunded = player.skillRankPoints;
    window.uiConfirm = _realConfirm;
    host.remove();

    // a normal-sized wallet must be unaffected by the fix
    player.skillRanks = { _t1: 3 }; player.skillRankPoints = 0; player.mojicoins = 100000;
    const host2 = document.createElement('div'); document.body.appendChild(host2);
    window.uiConfirm = async () => true;
    renderSkillsReference(host2);
    const b2 = host2.querySelector('#skl-rp-reset');
    if (b2 && !b2.disabled && typeof b2.onclick === 'function') { await b2.onclick(); await sleep(300); }
    o.rpSmall = { after: player.mojicoins, paid: 100000 - player.mojicoins };
    window.uiConfirm = _realConfirm; host2.remove();

    // ---- 2. Steam Cloud adoption --------------------------------------------
    const mkSave = (level, t) => JSON.stringify({ t, player: { level, name: 'T' + level, cls: 'warrior', mojicoins: level * 10 }, game: {} });
    const runSync = async (localLevel, localT, cloudLevel, cloudT) => {
      const localRaw = mkSave(localLevel, localT), cloudRaw = mkSave(cloudLevel, cloudT);
      try { localStorage.setItem(SAVE_KEY, localRaw); } catch (e) {}
      try { localStorage.removeItem(BACKUP_KEY); } catch (e) {}
      window._steamAvailable = () => true;
      window.SteamAPI = { cloud: { read: async () => cloudRaw, write: async () => true } };
      let ret = null;
      try { ret = await _lxSteamCloudSync(); } catch (e) { ret = 'threw:' + e.message; }
      let after = null; try { after = localStorage.getItem(SAVE_KEY); } catch (e) {}
      let backups = []; try { backups = (typeof _lxGetBackups === 'function') ? _lxGetBackups() : []; } catch (e) {}
      try { if (game) game._resetting = false; } catch (e) {}
      return { ret, adopted: after === cloudRaw, keptLocal: after === localRaw, backups: backups.length,
               backupLabel: backups[0] ? backups[0].label : null, backupLevel: backups[0] ? backups[0].level : null };
    };
    // the bug: a Lv30 cloud save stamped in the future must NOT eat a Lv90 local one
    o.skew = await runSync(90, 1000, 30, 9999);
    // normal cross-device play must still work: a genuinely more advanced cloud save wins...
    o.ahead = await runSync(90, 1000, 95, 9999);
    // ...as does the same level saved later on the other machine
    o.sameLevel = await runSync(90, 1000, 90, 9999);
    // ...and a fresh machine still pulls anything down
    o.fresh = await runSync(1, 1000, 40, 500);
    try { delete window.SteamAPI; delete window._steamAvailable; } catch (e) {}

    // ---- 3. clearSave leaves no marker behind -------------------------------
    o.markKey = (typeof _LX_SAVE_MARK_KEY !== 'undefined') ? _LX_SAVE_MARK_KEY : null;
    try { localStorage.setItem(_LX_SAVE_MARK_KEY, JSON.stringify({ t: 1, setshards: 999999, mojicoins: 888888, bankBalance: 7 })); } catch (e) {}
    o.markBefore = localStorage.getItem(_LX_SAVE_MARK_KEY) !== null;
    clearSave();
    o.markAfter = localStorage.getItem(_LX_SAVE_MARK_KEY) !== null;
    o.saveAfter = localStorage.getItem(SAVE_KEY) !== null;
    return o;
  });

  console.log('build ' + r.ver);
  console.log(JSON.stringify(r, null, 1).slice(0, 2200));
  console.log('');

  // ---- 1
  ok('RP reset button armed on a 3B wallet', r.rp.armed && !r.rp.disabled);
  ok('quoted cost is positive', /costs 600000000 Mojicoins/.test(r.rp.title || ''), r.rp.title);
  ok('confirm dialog quotes a positive fee', !/-\d/.test(r.dialogBody || 'x') && /600000000/.test(r.dialogBody || ''), (r.dialogBody || '').slice(0, 90));
  ok('wallet keeps 80% (2.4B), is not zeroed', r.rp.after === 2400000000, 'after=' + r.rp.after);
  ok('exactly 20% was charged', r.rp.paid === 600000000, 'paid=' + r.rp.paid);
  ok('ranks were actually refunded', r.rp.rpRefunded === 5, 'rp=' + r.rp.rpRefunded);
  ok('a normal wallet still pays 20%', r.rpSmall.paid === 20000 && r.rpSmall.after === 80000, JSON.stringify(r.rpSmall));

  // ---- 2
  ok('clock-skewed lower-level cloud save is REFUSED', r.skew.keptLocal && !r.skew.adopted, JSON.stringify(r.skew));
  ok('higher-level cloud save is still adopted', r.ahead.adopted, JSON.stringify(r.ahead));
  ok('adoption takes a backup first', r.ahead.backups >= 1 && r.ahead.backupLabel === 'auto · before cloud sync', r.ahead.backupLabel);
  ok('the backup holds the LOCAL save being replaced', r.ahead.backupLevel === 90, 'level=' + r.ahead.backupLevel);
  ok('same-level newer cloud save still adopted', r.sameLevel.adopted, JSON.stringify(r.sameLevel));
  ok('fresh machine still pulls the cloud save', r.fresh.adopted, JSON.stringify(r.fresh));

  // ---- 3
  ok('marker existed before the wipe', r.markBefore === true);
  ok('clearSave removes the anti-tamper marker', r.markAfter === false);
  ok('clearSave still removes the save itself', r.saveAfter === false);

  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally {
  await browser.close(); server.kill();
}
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
