#!/usr/bin/env node
// Per user: "paladin/dragoon right now is doing way too little damage against
// bosses, try to increase dragoon damage more significantly, and paladin
// slightly" (v0.30.334; paladin = crusader, the knight line's holy master).
//
// The audit harness cannot measure Sky Lance's dive (its bot repositions the
// player every frame, cancelling the teleport-dive before the slam resolves —
// dive-multiplier changes measured ZERO effect), so the boss half is verified
// at the mechanism: performAround's new opt-in bossMul is measured as a RATIO
// against a boss and a normal mob standing in the same blast, first without
// the flag and then with it. DEF differences cancel between the two runs;
// what remains is the multiplier itself.
//
//   node scripts/dragoon_buff_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 10441);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
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
  const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 130) });
  const md = document.getElementById('class-select-modal'); if (md) md.style.display = 'none';
  game.paused = false;
  player.level = 60; player.baseAtk = 300; player.baseCrit = -100;   // crits off: the ratio must be clean
  player.mods.crit = 0; player.maxMp = 99999; player.mp = 99999; player.hp = getMaxHp();
  loadMap('forest');
  await wait(600); game.paused = false;

  // ---- config assertions ---------------------------------------------------
  ok('Sky Lance cooldown is 11s (was 16s)', SKILLS.dragoon_skylance.cd === 11000, 'cd ' + SKILLS.dragoon_skylance.cd);
  const src = String(SKILL_FNS.dragoon_ult || '');
  ok('Skyfall lances are 3.0x (was 2.0x)', src.includes('* 3.0 + 12'), '');
  ok('Skyfall slam is 7.5x with boss bonus (was 6.0x flat)', src.includes('460, 7.5') && src.includes('bossMul: 1.3'), '');
  const paSrc = String(window.performAround || '');
  ok('performAround supports opt-in bossMul', paSrc.includes('opts.bossMul'), '');
  // The aegis orb damage lives in the aegis TICK, not the cast function —
  // assert on the served source text, which also lets the necromancer soul
  // orb (same 6.0x+40 shape) be checked as genuinely untouched.
  const pageSrc = await (await fetch(location.pathname)).text();
  ok('Divine Aegis orbs 6.6x (was 6.0x)', pageSrc.includes('getAtk() * 6.6 + 40'), '');
  const bastSrc = String(SKILL_FNS.crusader_ult || '');
  ok('Bastion orbs 1.8x (was 1.6x)', /\* 1\.8 \+ 8/.test(bastSrc), '');
  ok('necromancer soul orb untouched (6.0x + 40)', pageSrc.includes('getAtk() * 6.0 + 40'), '');

  // ---- bossMul ratio measurement ------------------------------------------
  const setupPair = () => {
    for (const q of (game.monsters || [])) q.currentHp = 0;
    game.monsters.length = 0;
    spawnMonster(600, 300, 'towerWarden', false, false);   // normal mob
    spawnMonster(700, 300, 'kingKrook', true, false);      // boss
    const mob = game.monsters.find((q) => q && q.type === 'towerWarden');
    const boss = game.monsters.find((q) => q && q.type === 'kingKrook');
    for (const t of [mob, boss]) {
      if (!t) continue;
      t.maxHp = 5e8; t.currentHp = t.maxHp; t.hp = 9e9;
      t.evasion = 0; t._defVar = 1; t._dmgTakenMul = 1; t.traits = {};
    }
    return { mob, boss };
  };
  const blast = async (opts) => {
    const { mob, boss } = setupPair();
    if (!mob || !boss) return null;
    player.x = 620; player.y = mob.y;
    const m0 = mob.currentHp, b0 = boss.currentHp;
    try { game.comboMult = 1; game.combo = 0; } catch (e) {}
    // average over several blasts to smooth the +Math.random()*8 term
    for (let i = 0; i < 6; i++) performAround(400, 5.2, opts);
    await wait(120);
    return { mobD: m0 - mob.currentHp, bossD: b0 - boss.currentHp };
  };
  const flat = await blast({ color: '#fff' });
  const withMul = await blast({ color: '#fff', bossMul: 1.6 });
  if (!flat || !withMul || flat.mobD <= 0 || flat.bossD <= 0) {
    ok('bossMul ratio measured', false, JSON.stringify({ flat, withMul }));
  } else {
    const r0 = flat.bossD / flat.mobD;
    const r1 = withMul.bossD / withMul.mobD;
    const lift = r1 / r0;
    ok('bossMul lifts boss damage ~1.6x (mob damage unchanged)', lift > 1.45 && lift < 1.75,
       'lift ' + lift.toFixed(2) + '  (mob ' + Math.round(withMul.mobD / flat.mobD * 100) + '% of flat)');
    ok('...and normal-mob damage is NOT inflated', Math.abs(withMul.mobD / flat.mobD - 1) < 0.15,
       (withMul.mobD / flat.mobD).toFixed(2) + 'x');
  }
  return res;
});
await browser.close(); server.kill();

const pad = Math.max(...out.map((r) => r.n.length));
console.log('\n  ' + PAGE + '\n');
for (const r of out) console.log((r.pass ? '  PASS  ' : '  FAIL  ') + r.n.padEnd(pad) + (r.extra ? '   [' + r.extra + ']' : ''));
const bad = out.filter((r) => !r.pass).length;
console.log('\n' + (bad ? ('  ' + bad + '/' + out.length + ' FAILED') : ('  all ' + out.length + ' passed')));
process.exit(bad ? 1 : 0);
