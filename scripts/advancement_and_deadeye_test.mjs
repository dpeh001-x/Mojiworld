// v0.30.x — Three skills findings from a parallel audit.
//   1. _lxRestoreUltCd repaired warlord_ult and sage_ult only; Deadeye (marksman_oneshot)
//      parks its cooldown at a 450 ms gate and was left there after a map change or death.
//   2. openMasterAdvancement never checked player.master and _lxApplyMasterInner is not
//      idempotent, so two delayed callers could stack a second Master's stats on the first.
//   3. The master card committed on a single click; the job card was rewritten to
//      arm-then-confirm for exactly this reason.
//
//   node scripts/advancement_and_deadeye_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11251);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Adv');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const r = await page.evaluate(async () => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const out = {};

  // ---- 1. Deadeye: a parked cooldown is put back by the repair
  const def = (typeof SKILLS !== 'undefined') ? SKILLS.marksman_oneshot : null;
  out.deadeyeDef = !!(def && def.cd);
  if (out.deadeyeDef) {
    player.skillCooldowns = player.skillCooldowns || {};
    player.skillCooldowns.marksman_oneshot = 450;
    player._deadeyeUntil = performance.now() + 5000;
    _lxRestoreUltCd();
    out.deadeyeRestored = player.skillCooldowns.marksman_oneshot === def.cd;
    player._deadeyeUntil = 0; player.skillCooldowns.marksman_oneshot = 0;
  }

  // ---- 2. a second Master cannot stack on the first
  const mid = Object.keys(MASTERS)[0];
  const job = MASTERS[mid].from;
  const snap = { job: player.job, master: player.master, atk: player.baseAtk, hp: player.maxHp, mp: player.maxMp };
  // the picker is gated behind a story beat on first sight; mark it seen so opens are synchronous
  player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { advancement_2: 1, advancement_2_done: 1 });
  player.job = job; player.master = null;
  applyMaster(mid);
  const atk1 = player.baseAtk, hp1 = player.maxHp;
  applyMaster(mid);                                  // the double-fire
  out.masterStacked = (player.baseAtk !== atk1) || (player.maxHp !== hp1);
  // applyMaster opens the TALENT picker in the same shared modal - clear it, or section 3
  // finds those cards instead of master cards (which is exactly what the first cut of this did)
  try { closeAllModals(); } catch (e) {}
  { const o = document.getElementById('advancement-options'); if (o) o.innerHTML = ''; }
  out.masterSet = player.master === mid;

  // ...and the picker refuses to open once a master is held
  player.quests = player.quests || {}; player.quests.completed = player.quests.completed || {};
  player.quests.completed.q_distorted_portal = player.quests.completed.q_distorted_portal || Date.now();
  const modal = document.getElementById('advancement-modal');
  if (modal) modal.style.display = 'none';
  openMasterAdvancement();
  await wait(300);
  out.pickerReopened = !!(modal && modal.style.display === 'flex');

  // ---- 3. the master card needs two clicks
  player.master = null; player.baseAtk = snap.atk; player.maxHp = snap.hp; player.maxMp = snap.mp;
  if (modal) modal.style.display = 'none';
  openMasterAdvancement();
  let card = null;
  for (let i = 0; i < 40 && !card; i++) {          // the story beat may gate the open
    await wait(150);
    const sb = document.getElementById('story-beat-overlay');
    if (sb && sb.classList.contains('on')) { try { sb.click(); } catch (e) {} document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); }
    card = [...document.querySelectorAll('#advancement-options .class-card')].find((c) => (c.textContent || '').includes(MASTERS[mid].name)) || null;
  }
  out.cardShown = !!card;
  if (card) {
    card.click();
    out.masterAfterOneClick = player.master;
    out.cardArmed = card.classList.contains('cls-armed');
    card.click();
    out.masterAfterTwoClicks = player.master;
  }
  // put the character back
  player.job = snap.job; player.master = snap.master; player.baseAtk = snap.atk; player.maxHp = snap.hp; player.maxMp = snap.mp;
  if (modal) modal.style.display = 'none';
  game.paused = false;
  return out;
});

const html = await (await fetch(`http://localhost:${PORT}/${PAGE}`)).text();
const restoreSites = (html.match(/_lxRestoreUltCd\(\);/g) || []).length;   // map change + two death paths
const twoClick = html.includes("Click again to take the ' + m.name + ' mastery");

console.log(JSON.stringify({ ...r, restoreSites, twoClick }));
const checks = [
  ['Deadeye is a known ultimate', r.deadeyeDef === true],
  ['a parked Deadeye cooldown is restored by the repair', r.deadeyeRestored === true],
  ['the repair runs on both death paths as well as the map change', restoreSites >= 3, 'sites=' + restoreSites],
  ['applying a Master twice does not stack its stats', r.masterStacked === false && r.masterSet === true],
  ['the Master picker refuses to reopen once a master is held', r.pickerReopened === false],
  ['the master card is reachable in the harness', r.cardShown === true],
  ['one click ARMS the master card, it does not commit', r.cardShown !== true || (r.masterAfterOneClick == null && r.cardArmed === true)],
  ['a second click commits', r.cardShown !== true || r.masterAfterTwoClicks != null],
  ['the two-click confirm text is in the served build', twoClick === true],
  ['no page errors', errs.length === 0, errs.join(' | ')],
];
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
await browser.close(); server.kill();
process.exit(fails ? 1 : 0);
