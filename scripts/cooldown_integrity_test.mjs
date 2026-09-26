// COOLDOWN INTEGRITY (per user: "ensure that the cooldowns cannot be sneakily reset by players or cheat").
// Every running cooldown lived only in memory, so each of these handed skills back ready:
//  A. a reload (F5, quit + Continue, killing the game): player.skillCooldowns was never saved
//  B. ...mid-chain: Sleight / Kage Rush / Apotheosis refilled a full set of charges
//  C. ...inside a window (Deadeye, War of Banners, Meteor Sigil): the skill sat at its short gate and the real
//     cooldown, stamped when the window closes, never came
//  D. ...and the potion + Second Wind clocks (game-time deadlines against a clock that restarts at 0)
//  E. the Amnesiac's pre-advance class swap: applyClass cleared every cooldown, so away-and-back reset them all
//  F. a long cooldown waited up to 15 s for the next autosave; killing the game first brought it back ready
//  G. and a corrupt carry cannot lock a skill for ever, invent one, or overfill charges
//   node scripts/cooldown_integrity_test.mjs [page.html] [port]
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const PAGE = (args[0] && /\.html$/i.test(args[0])) ? args[0] : 'mojiworld_game.html';
const PORT = Number(args.find((a) => /^\d+$/.test(a)) || process.env.PORT || 11477);
const env = { ...process.env }; delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--mute-audio'] });
let bad = 0;
const check = (ok, label, d) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && d !== undefined ? '  [' + JSON.stringify(d) + ']' : ''}`); if (!ok) bad++; };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const boot = async () => {
    await page.waitForFunction(() => typeof loadState === 'function' && typeof castSkill === 'function' && typeof _flushSaveStateNow === 'function'
      && typeof game !== 'undefined' && game && typeof player !== 'undefined', null, { timeout: 180000 });
    await page.waitForTimeout(2500);
  };
  await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await boot();
  const a = await page.evaluate(() => {
    window._lxAwaitingCreation = false;
    const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
    applyClass('rogue'); player.job = 'assassin'; player.master = 'nightreaper'; player.level = 90;
    player.skillCooldowns = { nightreaper_mark: 15000, sleight: 250, marksman_oneshot: 450 };
    player._sleightCharges = 2;
    player._deadeyeUntil = _lxDeNow() + 60000; player._deRealCd = { marksman_oneshot: 21000 };   // a Deadeye window, open
    _setPotionCd('hp'); player._secondWindCD = (game.time || 0) + 5000;
    _flushSaveStateNow();
    return { gateKept: player.skillCooldowns.marksman_oneshot === 450, pot: _potionCdRemainingFrames('hp'), sw: player._secondWindCD - (game.time || 0) };
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 180000 });
  await boot();
  const b = await page.evaluate(() => ({
    cls: player.cls, cds: Object.assign({}, player.skillCooldowns), sleight: player._sleightCharges | 0,
    pot: _potionCdRemainingFrames('hp'), sw: (player._secondWindCD || 0) - (game.time || 0),
  }));
  check(b.cls === 'rogue', 'the reload loaded the saved hero (harness)', b.cls);
  check((b.cds.nightreaper_mark | 0) > 10000 && (b.cds.nightreaper_mark | 0) <= 15000, 'A. a reload keeps a long cooldown where it stopped (15 s in -> ~15 s out, not ready)', b.cds);
  check(b.sleight === 2 && (b.cds.sleight | 0) > 0, 'B. ...and Sleight keeps its 2 unspent charges instead of refilling 3', { ch: b.sleight, gate: b.cds.sleight });
  check((b.cds.marksman_oneshot | 0) > 19000, 'C. ...and a window open at the save comes back on its REAL cooldown, not its 450 ms gate', b.cds.marksman_oneshot);
  check(a.gateKept, 'C. ...while the snapshot leaves the open window alone in the running session', a.gateKept);
  check(b.pot > 0 && b.pot <= 180 && b.sw > 3000 && b.sw <= 5000, 'D. ...and the potion and Second Wind clocks resume where they stopped', { potBefore: a.pot, pot: b.pot, sw: b.sw });

  const e = await page.evaluate(async () => {
    const id = Object.keys(SKILLS).find((k) => SKILLS[k].cls === 'rogue' && !SKILLS[k].job && !SKILLS[k].master && SKILLS[k].cd >= 3000);
    player.job = null; player.master = null; player.cls = 'rogue';
    player.skillCooldowns = { [id]: 20000 };
    const realConfirm = window.uiConfirm;
    window.uiConfirm = () => Promise.resolve(true);
    try {
      _openPreAdvanceClassSwap(); await new Promise((r) => setTimeout(r, 50));
      const away = { cls: player.cls, cd: player.skillCooldowns[id] | 0 };
      _openPreAdvanceClassSwap(); await new Promise((r) => setTimeout(r, 50));
      return { id, away, back: { cls: player.cls, cd: player.skillCooldowns[id] | 0 } };
    } finally { window.uiConfirm = realConfirm; }
  });
  check(e.away.cls === 'warrior' && e.back.cls === 'rogue', 'E. the Amnesiac swap ran away and back (harness)', e);
  check(e.away.cd > 19000 && e.back.cd > 19000, 'E. swapping class away and back keeps the running cooldown (it came back ready)', e);

  const f = await page.evaluate(() => {
    game.paused = false; player.hp = getMaxHp(); player.mp = player.maxMp = 99999;
    player.cls = 'rogue'; player.job = 'assassin'; player.master = 'nightreaper'; player._skillLockTimer = 0;
    player.skillCooldowns = {};
    if (game._saveTimer) { clearTimeout(game._saveTimer); game._saveTimer = null; }
    try { castSkill('nightreaper_mark'); } catch (err) {}
    return { cd: player.skillCooldowns.nightreaper_mark | 0, scheduled: !!game._saveTimer };
  });
  check(f.cd > 10000 && f.scheduled, 'F. a long cooldown schedules a save the moment it starts', f);

  const g = await page.evaluate(() => {
    if (typeof _lxCdRestore !== 'function') return null;
    _lxCdRestore({ cd: { nightreaper_mark: 1e12, notASkill: 5000, sleight: NaN, stab: -40 }, ch: { _sleightCharges: 99, _kageCharges: -3 }, potHp: 1e9, sw: 'x' });
    return { cds: Object.assign({}, player.skillCooldowns), sleight: player._sleightCharges, kage: player._kageCharges,
      pot: _potionCdRemainingFrames('hp'), sw: player._secondWindCD };
  });
  check(!!g && g.cds.nightreaper_mark <= 60000 && !('notASkill' in g.cds) && !('sleight' in g.cds) && !('stab' in g.cds),
    'G. a corrupt carry is clamped (no eternal lock) and junk / unknown ids drop', g);
  check(!!g && g.sleight === 3 && g.kage === 0 && g.pot <= 180 && g.sw === 0, 'G. ...charges and clocks stay inside their real ranges', g);
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); server.kill(); }
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
