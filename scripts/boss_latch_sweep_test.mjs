#!/usr/bin/env node
// Per user: "Also ensure that other bosses such as king gloop are fixed" —
// the roster-wide follow-up to the v0.30.324 Mooma stranded-latch fix.
//
// The stagger branch cancels a live pattern without running its cleanup, so
// one-shot latch flags reset only in that cleanup stayed stranded and
// disarmed the boss's NEXT cast: no banner before a lethal special, or a
// silent dud. v0.30.326 clears a curated per-cycle latch list at the point of
// cancellation, covering every staggerable boss (all but Gravitos/Octobaby).
//
// This test drives the two most prominent cases live:
//   KING GLOOPALOO — staggered mid-gluespray telegraph; also verifies the
//     nastier _teleporting strand (set at vanish, cleared only at reappear:
//     a mid-warp stagger flagged him mid-warp for the rest of the fight).
//   KING KROOK — staggered mid-MEGA-FIREBALL telegraph; the follow-up mega
//     must re-announce ("DODGE!" banner) and re-detonate.
// Both bosses re-enter the pattern exactly the way their pickers do (state
// assignment without touching flags), so the assertions hold for every entry
// style including variable-assignment pickers.
//
//   node scripts/boss_latch_sweep_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 9985);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Probe');
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

const out = await page.evaluate(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const res = [];
  const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 120) });
  let glueToasts = 0, megaToasts = 0;
  new MutationObserver((muts) => {
    for (const mu of muts) for (const nd of mu.addedNodes) {
      const txt = (nd.textContent || '');
      if (/GLUE|glue/i.test(txt)) glueToasts++;
      if (txt.includes('MEGA FIREBALL')) megaToasts++;
    }
  }).observe(document.body, { childList: true, subtree: true });

  const waitFor = async (cond, ms) => {
    const t0 = performance.now();
    while (performance.now() - t0 < ms) { if (cond()) return true; await wait(50); }
    return false;
  };
  const spawnBoss = async (map, type) => {
    loadMap(map);
    await wait(1200);
    game.paused = false;
    if (!game.monsters.some((m) => m && m.type === type)) {
      try { spawnMonster(700, 300, type, true, false); } catch (e) {}
    }
    const b = game.monsters.find((m) => m && m.type === type);
    if (b) {
      b.hp = b.maxHp = 9e9; b.currentHp = 9e9;
      b.aggro = true; b.aggroTarget = player;
      player.x = b.x - 120; player.y = b.y;
    }
    return b;
  };
  const stagger = async (b) => {
    b._stagger = 1400; b._staggerCd = 8000;   // exactly what the break-full path sets
    await wait(250);
    const cancelled = b.patternState === 'idle';
    await waitFor(() => !(b._stagger > 0), 3000);
    b._staggerCd = 0;
    return cancelled;
  };
  // Re-enter a pattern the way variable-assignment pickers do: state only,
  // flags untouched. This is what makes the strand visible.
  const enter = (b, st) => { b.patternState = st; b.patternTimer = 0; b._kSubTimer = 0; };

  player.level = 60; player._god = true;

  // ================= KING GLOOPALOO =================
  // Type key is 'king' (renamed Jelly King -> King Gloopaloo, v0.25.646).
  const gl = await spawnBoss('slimeCave', 'king');
  if (!gl) { ok('gloopaloo spawned', false); return res; }
  ok('gloopaloo spawned', true);
  enter(gl, 'gluespray');
  ok('gluespray #1 announces', await waitFor(() => gl._glueAnnounced === true, 4000), 'flag ' + gl._glueAnnounced);
  ok('stagger cancels gluespray', await stagger(gl), 'state ' + gl.patternState);
  enter(gl, 'gluespray');
  const glue2 = await waitFor(() => gl._glueAnnounced === true && gl.patternTimer > 500, 4000);
  ok('gluespray #2 re-announces after the stagger', glue2 && glueToasts >= 2,
     glueToasts + ' glue toast(s), flag ' + gl._glueAnnounced);

  // _teleporting strand: vanish, stagger mid-warp, flag must not stay latched.
  enter(gl, 'teleport');
  ok('teleport reaches mid-warp', await waitFor(() => gl._teleporting === true, 4000), '_teleporting ' + gl._teleporting);
  await stagger(gl);
  ok('mid-warp stagger does NOT strand _teleporting', gl._teleporting !== true, '_teleporting ' + gl._teleporting);
  for (const q of (game.monsters || [])) q.currentHp = 0;
  game.monsters.length = 0;

  // ================= KING KROOK =================
  const kk = await spawnBoss('krookThrone', 'kingKrook');
  if (!kk) { ok('krook spawned', false); return res; }
  ok('krook spawned', true);
  enter(kk, 'megaFireball');
  ok('mega #1 announces', await waitFor(() => kk._megaAnnounced === true, 4000), 'flag ' + kk._megaAnnounced);
  ok('stagger cancels the mega', await stagger(kk), 'state ' + kk.patternState);
  enter(kk, 'megaFireball');
  const mega2 = await waitFor(() => megaToasts >= 2, 4000);
  ok('mega #2 re-announces (DODGE! banner)', mega2, megaToasts + ' mega toast(s)');
  const fired2 = await waitFor(() => kk._kFired === true, 5000);
  ok('mega #2 detonates', fired2, '_kFired ' + kk._kFired);

  return res;
});
await browser.close(); server.kill();

const pad = Math.max(...out.map((r) => r.n.length));
console.log('\n  ' + PAGE + '\n');
for (const r of out) console.log((r.pass ? '  PASS  ' : '  FAIL  ') + r.n.padEnd(pad) + (r.extra ? '   [' + r.extra + ']' : ''));
const bad = out.filter((r) => !r.pass).length;
console.log('\n' + (bad ? ('  ' + bad + '/' + out.length + ' FAILED') : ('  all ' + out.length + ' passed')));
process.exit(bad ? 1 : 0);
