// Live test: ALL-SKILL SWEEP — casts every skill of all four classes and
// asserts each one actually does something: spends MP, sets its cooldown, and
// deals damage / spawns projectiles / applies a buff / heals. Catches a skill
// that silently breaks (throws, deals 0, or becomes free) when the damage
// pipeline, job gating, or a shared helper is refactored.
//
// Harness notes earned the hard way — get these wrong and you get false alarms:
//   • game.time is a FRAME COUNTER the main loop owns; many skills schedule
//     their payload as `game.time + N`. Tick it manually or they never fire.
//   • other payloads use setTimeout in REAL ms, so the loop must also burn
//     real wall-clock time, not just frames.
//   • scheduleSkillTimer payloads early-return on `game.paused`; if the dummy
//     wall kills the player the game pauses and later skills look inert.
//     player._god keeps him alive while leaving heals observable.
//   • job/master skills early-return unless player.job matches.
//   • monsters have real evasion + a level-gap hit roll — zero evasion and
//     raise baseAcc or hits randomly whiff.
// Run: node scripts/playtest_skills_test.mjs   (MOJI_PW_EXE overrides Chrome)
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
// Resolve a browser that actually EXISTS. The Linux path stays first so CI is
// untouched, but it is the only candidate this line used to have - and with
// MOJI_PW_EXE unset on a dev machine that made the launch throw before a single
// assertion ran. 66 scripts shared the line, so 66 gates were passing by never
// executing. Falling through to the local Chrome is what the tests that do run
// already rely on (they pass channel:'chrome').
const EXE = [process.env.MOJI_PW_EXE,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((p) => p && existsSync(p));
const URL = process.env.MOJI_GAME_URL || 'http://localhost:8080/mojiworld_game.html';

// Skills that deliberately refund or grant MP on cast (documented in-source):
// bloodlust's cast surge, and the warlord/sage ult "free spam" windows.
const MP_REFUND_BY_DESIGN = new Set(['bloodlust', 'warlord_ult', 'sage_ult']);

const results = [];
const ok = (n, c, extra) => results.push({ n, pass: !!c, extra });
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  const page = await (await browser.newContext()).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof castSkill === 'function', null, { timeout: 45000 });
  await page.waitForTimeout(2500);

  const out = await page.evaluate(async () => {
    const report = {};
    window._prologueActive = false; window._prologuePending = false;
    const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
    game.paused = false;
    const HP0 = 5e8;
    const REACHES = [40, 90, 160, 260, 400, 600, 900];

    const advance = async (frames) => {
      for (let f = 0; f < frames; f++) {
        game.time++; game.paused = false; player._god = true;
        try { updatePlayer(16); } catch (e) {}
        try { updateMonsters(16); } catch (e) {}
        try { if (typeof updateProjectiles === 'function') updateProjectiles(16); } catch (e) {}
        await new Promise((r) => setTimeout(r, 8));
      }
    };

    const runClass = async (cls) => {
      player.cls = cls; player.level = 60; player.baseAcc = 20; player.tree = player.tree || {};
      loadMap('glasswindSteppe');
      const rows = [];
      for (const id of Object.keys(SKILLS).filter((k) => SKILLS[k] && SKILLS[k].cls === cls)) {
        const s = SKILLS[id];
        player.job = s.job || null; if (s.master) player.master = s.master;
        game.monsters.length = 0;
        const dummies = [];
        for (const dx of REACHES) {
          const d = spawnMonster(player.x + dx, player.y, 'slime', false, false);
          if (d) { d.maxHp = HP0; d.currentHp = HP0; d.def = 0; d.evasion = 0; dummies.push(d); }
        }
        if (!dummies.length) { rows.push({ id, harness: 'no dummies spawned' }); continue; }
        player.facing = 1;
        player.maxMp = 99999; player.mp = 99999;
        player.hp = Math.floor(getMaxHp() * 0.5); player.currentHp = player.hp;
        player._god = true; game.paused = false;
        player.skillCooldowns = {}; player._skillLockTimer = 0;
        game.projectiles.length = 0;
        const buffs0 = JSON.stringify(player.buffs), mp0 = player.mp, hp0 = player.hp;
        let threw = null;
        try { castSkill(id); } catch (e) { threw = String(e).slice(0, 110); }
        const mpSpent = mp0 - player.mp;                 // read BEFORE regen ticks
        const cdSet = (player.skillCooldowns[id] || 0) > 0;
        let maxProj = game.projectiles.length;
        const watch = setInterval(() => { if (game.projectiles.length > maxProj) maxProj = game.projectiles.length; }, 4);
        await advance(240);
        clearInterval(watch);
        let dmg = 0;
        for (const d of dummies) { const h = HP0 - d.currentHp; if (h > 0) dmg += h; }
        rows.push({ id, mpCost: s.mp, mpSpent, cd: s.cd, cdSet, dmg: Math.round(dmg),
          proj: maxProj, buffed: JSON.stringify(player.buffs) !== buffs0, healed: player.hp > hp0, threw });
      }
      return rows;
    };

    for (const c of ['warrior', 'mage', 'rogue', 'archer']) report[c] = await runClass(c);
    return report;
  });

  let total = 0;
  const threw = [], inert = [], free = [], nocd = [], harness = [];
  for (const [cls, rows] of Object.entries(out)) {
    for (const r of rows) {
      if (r.harness) { harness.push(`${cls}/${r.id}: ${r.harness}`); continue; }
      total++;
      if (r.threw) { threw.push(`${cls}/${r.id}: ${r.threw}`); continue; }
      if (r.dmg === 0 && r.proj === 0 && !r.buffed && !r.healed) inert.push(`${cls}/${r.id}`);
      if (r.mpCost > 0 && r.mpSpent === 0 && !MP_REFUND_BY_DESIGN.has(r.id)) free.push(`${cls}/${r.id} (${r.mpCost} MP)`);
      if (r.cd > 0 && !r.cdSet) nocd.push(`${cls}/${r.id}`);
    }
  }
  ok(`all 4 classes enumerated (${total} skills)`, total >= 60, total);
  ok('no skill throws when cast', threw.length === 0, threw.slice(0, 8));
  ok('every skill does something (damage / projectile / buff / heal)', inert.length === 0, inert.slice(0, 10));
  ok('every costed skill actually spends MP', free.length === 0, free.slice(0, 8));
  ok('every skill with a cooldown sets it (not spammable)', nocd.length === 0, nocd.slice(0, 8));
  ok('harness spawned dummies for every skill', harness.length === 0, harness.slice(0, 5));
  ok('no page errors during the sweep', errs.length === 0, errs.slice(0, 5));
} catch (e) { results.push({ n: 'HARNESS ERROR', pass: false, extra: String(e).slice(0, 300) }); }
finally { await browser.close(); }

const passed = results.filter((r) => r.pass).length;
console.log('\n=== ALL-SKILL SWEEP (4 classes) ===');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : ''}`);
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
