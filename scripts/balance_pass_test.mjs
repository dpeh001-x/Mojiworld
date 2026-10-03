// BALANCE PASS: Deadeye rebounds, mage burst +, Krook sturdier/deadlier, town bake.
// ============================================================================
// Per user, four asks in one pass:
//   - "Bowmaster B skill deadeye protocol ... after it hoams and seeks it also
//      ricochets 3 times to deal good damage"
//   - "Increase burst damage for archmage skills between 10-25%" and "increase
//      sage and elementalist skill damage slightly more than archmage"
//   - "Krook boss is extremely easy make his DEF way sturdier and way
//      deadlier, wire in occasional 50% Max HP attacks with the stomp"
//   - the town portals hardbake from the Ctrl editor
// Run: node scripts/balance_pass_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 9961);
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
await page.waitForFunction(() => typeof game === 'object' && typeof spawnMonster === 'function', null, { timeout: 180000 });
await page.waitForTimeout(7000);
await page.evaluate(() => { window._lxBootGateDone = true; window._prologueActive = false; });
await page.fill('#hero-name-input', 'BalPass').catch(() => {});
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  if (!m) return;
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*archer\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 200) });

// ---- static tables ----------------------------------------------------------
const tables = await page.evaluate(() => ({
  portals: MAPS.town.portals,
  apo: (typeof LX_APO_CAT !== 'undefined') ? Object.fromEntries(Object.entries(LX_APO_CAT).map(([k, v]) => [k, { mul: v.mul, flat: v.flat }])) : null,
  krook: { atk: monsterTypes.kingKrook.atk, def: monsterTypes.kingKrook.def, hp: monsterTypes.kingKrook.hp },
}));
ok('town portals match the Ctrl-editor bake exactly',
  JSON.stringify(tables.portals) === JSON.stringify([
    { x: 153, y: 480, dest: 'cadetsStrand', name: "◀ Cadet's Strand" },   // new-maps: Cadet's Strand now lies between Everdawn and the Bastion
    { x: 1479, dest: 'everdawn_megamall', name: '⬥ Everdawn Megamall', y: 480 },
    { x: 2735, y: 480, dest: 'forest', name: '◀ Emerald Thicket' },
  ]), JSON.stringify(tables.portals));
// v0.30.814 (075d3b43) - the user's Skill Editor patch retuned all four catastrophes (was 7.8 / 9.1 / 10.4 / 9.75, flat 78).
ok('Apotheosis: 15 / 14 / 14.4 / 16, flat 76 / 76 / 96 / 318 (doubled in v0.30.1604)',
  tables.apo && tables.apo.fire.mul === 15 && tables.apo.ice.mul === 14
  && tables.apo.lightning.mul === 14.4 && tables.apo.void.mul === 16
  && tables.apo.fire.flat === 76 && tables.apo.ice.flat === 76 && tables.apo.lightning.flat === 96 && tables.apo.void.flat === 318, JSON.stringify(tables.apo));
// v0.30.351 (a8177142) - "seven boss DEF values set by hand off the audit": Krook DEF 375 -> 120. The ATK half stands.
ok('Krook is deadlier: ATK 455 -> 590, DEF hand-set to 120',
  tables.krook.def === 120 && tables.krook.atk === 590, JSON.stringify(tables.krook));

// ---- Deadeye Protocol: a lone target takes the volley ---------------------------
// v0.30.610 (99afedd3, per user) revamped Deadeye Protocol: the homing 'gale' rounds with 3 rebounds are gone, and a
// press inside its 8 s window fires a volley of 5 homing SINGLE-TARGET rounds (p.onlyTarget; 7 on a Deadeye-marked
// foe). The v0.30.345 ask this protected - the ult pours real damage into one foe - is tested on that volley now.
// (Before this update the hit check below passed on '0 shots -> 0 hits', i.e. vacuously.)
const deadeye = await page.evaluate(async () => {
  loadMap('forest', 300);
  await new Promise((r) => setTimeout(r, 1500));
  game.paused = false;
  player.level = 60; player.job = 'sniper'; player.master = 'marksman';
  player._god = true; player.mp = 99999; player.skillCooldowns = {};
  player.baseAcc = 900;
  game.monsters = [];
  const _type = (game.mapData.spawns.find((sp) => sp && sp.type && !sp.boss) || {}).type || Object.keys(monsterTypes)[0];
  spawnMonster(player.x + 400, player.y, _type, false);
  const dummy = game.monsters[game.monsters.length - 1];
  dummy.hp = dummy.currentHp = dummy.maxHp = 9e9;
  dummy.invulnerable = 0; dummy.vx = 0; dummy._testPin = true;
  const px = dummy.x, py = dummy.y;
  let hits = 0;
  const orig = window.hitMonster;
  window.hitMonster = function (m, d, c, sk) { if (m === dummy && sk === 'marksman_ult') hits++; return orig.apply(this, arguments); };
  // the rounds are scheduled one line-gap apart (scheduleSkillTimer), so collect them over the frames, not at cast
  const seen = new Set(); let single = true;
  const scan = () => { for (const p of game.projectiles) if (p && p.skill === 'marksman_ult' && p.owner === 'player' && !seen.has(p)) {
    seen.add(p); if (p.homing !== dummy || !p.onlyTarget) single = false; } };
  try { castSkill('marksman_ult'); } catch (e) { window.hitMonster = orig; return { err: String(e).slice(0, 140) }; }
  for (let i = 0; i < 300; i++) {
    await new Promise((r) => requestAnimationFrame(r));
    scan();
    dummy.currentHp = dummy.maxHp; dummy.x = px; dummy.y = py; dummy.vx = 0; dummy.vy = 0;
    if (i > 60 && !game.projectiles.some((p) => p && p.skill === 'marksman_ult')) break;
  }
  const shots = seen.size;
  player._protocolUntil = 0;   // close the Overclock window so it cannot swallow the mage casts below
  for (let i = 0; i < 5; i++) await new Promise((r) => requestAnimationFrame(r));
  window.hitMonster = orig;
  return { shots, hits, single };
});
ok('Deadeye Protocol: a press fires a volley of 5 single-target rounds locked on the foe', !deadeye.err && deadeye.shots === 5 && deadeye.single,
  deadeye.err || `${deadeye.shots} rounds, all locked on the dummy: ${deadeye.single}`);
ok('a LONE target takes every round of the volley',
  !deadeye.err && deadeye.shots > 0 && deadeye.hits >= deadeye.shots,
  `${deadeye.shots} rounds -> ${deadeye.hits} hits`);

// ---- Krook stomps, deterministic --------------------------------------------
const stomp = await page.evaluate(async () => {
  game.monsters = [];
  spawnMonster(player.x + 700, player.y, 'kingKrook', true);
  const k = game.monsters[game.monsters.length - 1];
  if (!k) return { err: 'no krook' };
  k.currentHp = k.maxHp;
  const kx = k.x;
  // settle the spawn (intro invulnerability / first-pattern pick) before the
  // first measured stomp — without this, run 1 read 0% because the pattern
  // block was not ticking yet while run 2 measured cleanly.
  for (let i = 0; i < 90; i++) { game.time++; try { updateMonsters(16); } catch (e) {} k.x = kx; k.vx = 0; }
  const runOne = (colossal) => {
    player._god = false; player.hp = getMaxHp(); player.invulnerable = 0;
    player.onGround = true; player.stunTimer = 0;
    k.patternState = 'stomp'; k.patternTimer = 0;
    k._kAnnounced = true;               // skip the roll; we force the flag
    k._kColossal = colossal; k._kFired = false;
    // The stomp is ground-wide (no radius) so distance is safe: the boss is
    // pinned 700px out each tick, which keeps contact damage out of the
    // measurement — the first draft spawned him ON the player and read a
    // 42,000% "stomp" that was 130 frames of contact damage.
    for (let i = 0; i < 130 && !k._kFired; i++) {
      game.time++; try { updateMonsters(16); } catch (e) {}
      // re-pin: the boss AI may pick its own pattern over the forced one
      if (!k._kFired && k.patternState !== 'stomp') { k.patternState = 'stomp'; }
      k.x = kx; k.vx = 0; player.onGround = true; player.invulnerable = 0;
    }
    game.time += 60; try { updateMonsters(16); } catch (e) {}   // let it fire if boundary-close
    const lost = getMaxHp() - player.hp;
    player.stunTimer = 0; k.patternState = 'idle'; k.patternTimer = 0;
    return lost / getMaxHp();
  };
  const colossal = runOne(true);
  const normal = runOne(false);
  player._god = true; player.hp = getMaxHp();
  return { colossal: +colossal.toFixed(3), normal: +normal.toFixed(3) };
});
ok('a COLOSSAL stomp takes half the bar', !stomp.err && Math.abs(stomp.colossal - 0.50) < 0.02,
  stomp.err || `lost ${(stomp.colossal * 100).toFixed(1)}% of max HP`);
ok('an ordinary stomp still takes 22%', !stomp.err && Math.abs(stomp.normal - 0.22) < 0.02,
  stomp.err || `lost ${(stomp.normal * 100).toFixed(1)}% of max HP`);

// ---- sage / elementalist hazard multipliers, live casts ---------------------
const mage = await page.evaluate(async () => {
  player.cls = 'mage'; player.job = 'archmage'; player.master = 'sage';
  player.mp = 99999; player.skillCooldowns = {};
  game.hazards.length = 0;
  try { castSkill('sage_meteorshower'); } catch (e) { return { err: 'sage: ' + String(e).slice(0, 100) }; }
  // 2026-09-28 triage - poll each frame instead of one read at 900 ms. The five columns erupt 110 ms apart and each
  // lives 16 frames (was 45 before the Pyre Columns remake), so the last one is gone by ~700 ms of game time: the
  // fixed wait read a corpse (null) whenever the headless frame rate kept up.
  let sageMul = null;
  for (let i = 0; i < 120 && sageMul == null; i++) {
    await new Promise((r) => requestAnimationFrame(r));
    sageMul = (game.hazards.find((h) => h && typeof h._sageDmgMul === 'number') || {})._sageDmgMul || null;
  }
  player.master = 'elementalist'; player.skillCooldowns = {}; player.mp = 99999;
  game.hazards.length = 0;
  try { castSkill('elementalist_cascade'); } catch (e) { return { sageMul, err: 'casc: ' + String(e).slice(0, 100) }; }
  // the cascade's fire leg pushes its hazard SYNCHRONOUSLY at cast and it
  // lives 12 frames — a first draft waited 2.6s and sampled a corpse. Read now.
  const cascMul = (game.hazards.find((h) => h && typeof h._sageDmgMul === 'number') || {})._sageDmgMul || null;
  return { sageMul, cascMul };
});
// v0.30.785 (3c51eff1) - the user's Skill Editor patch: Pyre Columns lane 3.9 -> 6.
ok('Pyre Columns lane multiplier is 12 (doubled in v0.30.1604)', mage.sageMul === 12, `got ${mage.sageMul}${mage.err ? ' · ' + mage.err : ''}`);
// v0.30.814 (075d3b43) - the user's Skill Editor patch: Prismatic Cascade pyre leg 2.9 -> 3.5.
ok('Prismatic Cascade pyre leg is 7 (doubled in v0.30.1604)', mage.cascMul === 7, `got ${mage.cascMul}${mage.err ? ' · ' + mage.err : ''}`);
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' · '));

await browser.close(); server.kill();
let fail = 0;
for (const r of res) { if (!r.pass) fail++; console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.extra ? '  — ' + r.extra : '')); }
console.log(`\n${res.length - fail}/${res.length} checks passed`);
process.exit(fail ? 1 : 0);
