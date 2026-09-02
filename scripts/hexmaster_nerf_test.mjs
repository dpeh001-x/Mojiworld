// HEXMASTER: the finale reads curse DEPTH, not crowd SIZE.
// ============================================================================
// Per user: "check on hexmaster does too much damage, audit and nerf him".
//
// The audit ran every master through the same pinned immortal dummies and read
// every point of damage that landed, and it found TWO different faults in two
// different builds — which is why this file asserts both.
//
// 1. THE CASCADE, already fixed on main by v0.30.330 but still shipping in the
//    playtest zip and in the working copy this audit was first (wrongly) run
//    against. Without LX_GRANDHEX_RUPTURE_ICD the rupture splash re-tips its
//    own neighbours: measured 14,084 ruptures in 600 frames — about 23 every
//    frame, against a design rate of 0.04 — for 103,700,230 crowd DPS, or
//    9,765x the median master. With the breaker present it is ZERO ruptures
//    and stacks sit clamped at 4. The check below is a regression guard: the
//    constant must exist and must hold the line.
//
// 2. THE FINALE, which is what remains and what this change nerfs. Pandemic
//    Hex's eruption multiplier read the SUM of hex stacks across the whole
//    field and performAround then paid that number out to every enemy in a
//    560px radius — so a bigger pack raised the per-enemy damage. Measured at
//    ATK 732: 3.5x ATK per head solo, 10.2x at four enemies, 14.4x at eight.
//    And the band itself was out of family: every performAround in the game
//    sorted, the next-largest area hit anywhere is 7.5x, this was 10.0-16.0x.
// Run: node scripts/hexmaster_nerf_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 9968);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const EXE = [process.env.PW_EXE, process.env.MOJI_PW_EXE,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));
const browser = await chromium.launch({
  channel: EXE ? undefined : 'msedge', executablePath: EXE || undefined,
  headless: true, args: ['--no-sandbox', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 150)));
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`,
  { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof game === 'object' && typeof castSkill === 'function', null, { timeout: 180000 });
await page.waitForTimeout(7000);
await page.evaluate(() => { window._lxBootGateDone = true; window._prologueActive = false; });
await page.fill('#hero-name-input', 'HexNerf').catch(() => {});
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  if (!m) return;
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*mage\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 220) });

// ---- the band ---------------------------------------------------------------
const band = await page.evaluate(() => {
  const g = (n) => { try { return eval(n); } catch (e) { return null; } };
  return { base: g('LX_PANDEMIC_FINALE_BASE'), per: g('LX_PANDEMIC_FINALE_PER_STACK'),
    cap: g('LX_PANDEMIC_FINALE_CAP'), at: g('LX_GRANDHEX_RUPTURE_AT'), icd: g('LX_GRANDHEX_RUPTURE_ICD') };
});
ok('the finale band comes down: 10.0-16.0x ATK -> 5.0-9.5x',
  band.base === 5.0 && band.cap === 9.5,
  `base ${band.base}, per-stack ${band.per}, cap ${band.cap}`);
ok('a fully cursed field still erupts for 9.0x — the largest nova in the game (next is 7.5x)',
  Math.min(band.cap, band.base + band.per * (band.at - 1)) === 9.0,
  `${band.base} + ${band.per} x ${band.at - 1} stacks = ${Math.min(band.cap, band.base + band.per * (band.at - 1))}x`);
ok('REGRESSION GUARD: the v0.30.330 rupture breaker is present',
  band.icd === 180, `LX_GRANDHEX_RUPTURE_ICD = ${band.icd} frames`);

// ---- the shape: crowd size must not raise the multiplier -------------------
// Driven through the REAL function against real cursed monsters, not a
// re-derivation of the formula — the fault being fixed was in what the
// function counted, so counting it again the same way would prove nothing.
const shape = await page.evaluate(async () => {
  loadMap('forest', 300);
  await new Promise((r) => setTimeout(r, 1400));
  game.paused = false;
  player.level = 50; player._god = true; player.baseAtk = 400;
  const t = (game.mapData.spawns.find((sp) => sp && sp.type && !sp.boss) || {}).type;
  const stackTo = (n, depth) => {
    game.monsters = [];
    for (let k = 0; k < n; k++) {
      spawnMonster(player.x + 200 + k * 60, player.y, t, false);
      const m = game.monsters[game.monsters.length - 1];
      if (!m) continue;
      m.maxHp = m.currentHp = 9e12; m.def = 0; m.evasion = 0;
      m._hexStacks = depth; m._hexUntil = (game.time || 0) + 99999;   // cursed to `depth`
    }
    return _lxPandemicFinaleMul();
  };
  const out = { deep: {}, shallow: {}, byDepth: {} };
  for (const n of [1, 2, 4, 8, 16]) out.deep[n] = +stackTo(n, 4).toFixed(3);
  for (const n of [1, 2, 4, 8, 16]) out.shallow[n] = +stackTo(n, 1).toFixed(3);
  for (const d of [0, 1, 2, 3, 4]) out.byDepth[d] = +stackTo(6, d).toFixed(3);
  game.monsters = [];
  return out;
});
const deep = Object.values(shape.deep);
ok('CROWD SIZE no longer raises the eruption — 1 enemy and 16 erupt identically',
  new Set(deep.map((v) => v.toFixed(2))).size === 1,
  Object.entries(shape.deep).map(([n, v]) => `${n} foes ${v}x`).join('  '));
ok('...at every curse depth, not just a full one',
  new Set(Object.values(shape.shallow).map((v) => v.toFixed(2))).size === 1,
  Object.entries(shape.shallow).map(([n, v]) => `${n} foes ${v}x`).join('  '));
ok('CURSE DEPTH is what raises it — the thing the kit is actually about',
  shape.byDepth[4] > shape.byDepth[0] && [1, 2, 3, 4].every((d) => shape.byDepth[d] > shape.byDepth[d - 1]),
  Object.entries(shape.byDepth).map(([d, v]) => `${d} stacks ${v}x`).join('  '));
ok('an uncursed field erupts for the 5.0x floor, not 10.0x',
  shape.byDepth[0] === 5.0, `${shape.byDepth[0]}x`);

// ---- what it is worth: the same measurement the audit used ------------------
const dps = await page.evaluate(async () => {
  const run = async (mobs) => {
    game.paused = false;
    const sk = []; for (const id in SKILLS) if (SKILLS[id] && SKILLS[id].master === 'hexmaster') sk.push(id);
    const s0 = SKILLS[sk[0]];
    player.cls = s0.cls; player.job = s0.job; player.master = 'hexmaster';
    player.level = 50; player._god = true; player.baseAtk = 400; player.baseAcc = 900;
    player.mods = player.mods || {}; player.mods.critDmg = 0; player.crit = 0; player.baseCrit = 0;
    player.mp = 9e9; player.skillCooldowns = {};
    game.monsters = []; game.projectiles.length = 0; game.hazards.length = 0;
    const t = (game.mapData.spawns.find((sp) => sp && sp.type && !sp.boss) || {}).type;
    const ds = [];
    for (let k = 0; k < mobs; k++) {
      spawnMonster(player.x + 200 + k * 70, player.y, t, false);
      const x = game.monsters[game.monsters.length - 1];
      if (x) { x.maxHp = x.currentHp = 9e12; x.def = 0; x.evasion = 0; x.invulnerable = 0; x._px = x.x; x._py = x.y; ds.push(x); }
    }
    const dset = new Set(ds);
    let dealt = 0, ruptures = 0;
    const orig = window.hitMonster;
    window.hitMonster = function (m, dmg, c, tag) {
      const b = m && m.currentHp; const r = orig.apply(this, arguments);
      if (dset.has(m) && typeof b === 'number') {
        dealt += Math.max(0, b - m.currentHp);
        if (tag === 'grandhexRupture') ruptures++;
      }
      return r;
    };
    const F = 600;
    for (let i = 0; i < F; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      for (const x of ds) { x.currentHp = x.maxHp; x.x = x._px; x.y = x._py; x.vx = 0; x.vy = 0; }
      player.mp = 9e9; player.hp = getMaxHp();
      for (const id of sk) if (!(player.skillCooldowns[id] > 0)) { try { castSkill(id); } catch (e) {} }
    }
    window.hitMonster = orig;
    const maxStacks = Math.max(0, ...ds.map((x) => x._hexStacks | 0));
    game.monsters = []; game.projectiles.length = 0; game.hazards.length = 0;
    return { dps: Math.round(dealt / (F / 60)), ruptures, maxStacks, atk: getAtk() };
  };
  const crowd = await run(8);
  return { crowd };
});
// The pre-change reading on this same harness and this same build.
ok('crowd DPS falls materially from the 37,804 measured before the change',
  dps.crowd.dps < 34000, `${dps.crowd.dps.toLocaleString()} DPS on 8 pinned dummies (was 37,804)`);
ok('the rupture cascade stays dead — the 23-per-frame runaway does not return',
  dps.crowd.ruptures < 40 && dps.crowd.maxStacks <= 4,
  `${dps.crowd.ruptures} rupture hits in 600 frames, stacks clamped at ${dps.crowd.maxStacks}`);
ok('he is still a crowd-clear master, not gutted — well clear of Elementalist\'s 11,655',
  dps.crowd.dps > 20000, `${dps.crowd.dps.toLocaleString()} DPS`);
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' · '));

await browser.close(); server.kill();
let fail = 0;
for (const r of res) { if (!r.pass) fail++; console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.extra ? '  — ' + r.extra : '')); }
console.log(`\n${res.length - fail}/${res.length} checks passed`);
process.exit(fail ? 1 : 0);
