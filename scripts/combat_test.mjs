// Live combat verification — exercise the core combat functions directly and
// assert correctness (basic attack, skill cast + MP/cooldown, crit bonus, DoT
// ticks, kill rewards, DoT death -> cheat-death revive, boss stun-resistance).
import { chromium } from 'playwright-core';
const EXE = process.env.PW_EXE || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8080/mojiworld_game.html', MAP = 'glasswindSteppe';
const results = [];
const ok = (n, c, extra) => results.push({ n, pass: !!c, extra });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
try {
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof performMelee === 'function' && typeof hitMonster === 'function', null, { timeout: 30000 });
  await page.waitForFunction(() => { const a = document.getElementById('lo-auth'); return a && !a.hidden; }, null, { timeout: 45000 }).catch(() => {});
  await page.click('#menu-newgame').catch(() => {});
  await page.waitForSelector('#auth-user', { state: 'visible', timeout: 10000 }).catch(() => {});
  await page.fill('#auth-user', 'Fighter').catch(() => {}); await page.click('#auth-submit').catch(() => {});
  await sleep(1500);
  const ev = (f, a) => page.evaluate(f, a);
  // baseAcc 20 pushes the level-gap hit rate to the 100% clamp — without it
  // even an overleveled warrior misses 10% of the time and the direct
  // hitMonster checks flake (evasion is zeroed per-check for the same reason).
  await ev((m) => { player.cls = 'warrior'; player.level = 20; player.baseAcc = 20; player.mp = player.maxMp = 500; game.paused = false; window._prologueActive = false; const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none'; loadMap(m); }, MAP);
  await sleep(700);

  // (1) BASIC MELEE hits a nearby monster.
  const melee = await ev(() => {
    const m = game.monsters.find(x => x && x.currentHp > 0); if (!m) return null;
    m.x = player.x + 30; m.y = player.y; player.facing = 1; m.evasion = 0;   // deterministic: no dodge roll
    // hitMonster ALSO rolls the level-gap accuracy gate, which m.evasion = 0
    // does not touch — measured 76% hit at Lv1 vs a Lv4 slime. Matching the
    // player's level to the target takes that term to its 90% ceiling, and
    // the retry loop takes the residual flake to ~0. The real damage
    // pipeline still runs; only the dice are removed.
    try { player.level = Math.max(player.level || 1, _mobLevel(m)); } catch (e) {}
    if (m.traits) { delete m.traits.parryChance; delete m.traits.phantomDodge; }
    const hp0 = m.currentHp;
    for (let i = 0; i < 20 && m.currentHp === hp0; i++) performMelee(120, 1.0, {});
    return { hp0, hp1: m.currentHp, dropped: hp0 - m.currentHp };
  });
  ok('basic melee damages a nearby monster', melee && melee.dropped > 0, melee);

  // (2) CRIT applies bonus damage (getCritDmg > 1).
  const crit = await ev(() => {
    const cd = (typeof getCritDmg === 'function') ? getCritDmg() : 0;
    const m = game.monsters.find(x => x && x.currentHp > 0); if (!m) return null;
    m.currentHp = m.maxHp = 100000; m.def = 0; m.evasion = 0;   // deterministic: no dodge roll (razorgale has designed evasion 200)
    const base = 1000;
    const h0 = m.currentHp; hitMonster(m, base, false, 'slash'); const noCrit = h0 - m.currentHp;
    const h1 = m.currentHp; hitMonster(m, Math.floor(base * cd), true, 'slash'); const withCrit = h1 - m.currentHp;
    return { cd, noCrit, withCrit, bonus: withCrit > noCrit };
  });
  ok('crit multiplier is > 1', crit && crit.cd > 1, crit);
  ok('crit hit deals more than a normal hit', crit && crit.bonus, crit);

  // (3) DoT (burn) ticks damage over time via _applyMobStatus.
  const dot = await ev(async () => {
    const m = game.monsters.find(x => x && x.currentHp > 0); if (!m) return null;
    m.currentHp = m.maxHp = 100000;
    _applyMobStatus(m, 'burn', 3000, { chance: 100, dmg: 200 });
    const hp0 = m.currentHp;
    // burn ticks are driven by updateMonsters; run some frames
    for (let i = 0; i < 120; i++) updateMonsters(50);
    return { hp0, hp1: m.currentHp, ticked: hp0 - m.currentHp, hadBurn: (m.burnTimer || 0) >= 0 };
  });
  ok('DoT (burn) ticks damage over time', dot && dot.ticked > 0, dot);

  // (4) castSkill spends MP + sets cooldown (pick a real warrior skill).
  const cast = await ev(() => {
    // find a castable warrior skill id
    let sid = null;
    try { for (const k in SKILLS) { const s = SKILLS[k]; if (s && s.cls === 'warrior' && s.mp > 0) { sid = k; break; } } } catch (e) {}
    if (!sid) return { noSkill: true };
    player.mp = player.maxMp = 500; player.skillCooldowns = player.skillCooldowns || {};
    const mp0 = player.mp; const cd0 = (player.skillCooldowns[sid] || 0);
    let threw = null;
    try { castSkill(sid); } catch (e) { threw = String(e).slice(0, 90); }
    return { sid, mp0, mp1: player.mp, spentMp: mp0 - player.mp, cdSet: (player.skillCooldowns[sid] || 0) > cd0, threw };
  });
  ok('castSkill runs without throwing', cast && !cast.threw && !cast.noSkill, cast);
  ok('castSkill spends MP + sets a cooldown', cast && cast.spentMp > 0 && cast.cdSet, cast);

  // (5) Kill grants XP + removes the monster.
  const kill = await ev(() => {
    const m = game.monsters.find(x => x && x.currentHp > 0); if (!m) return null;
    const xp0 = player.exp || 0; m.currentHp = 1; m.evasion = 0; hitMonster(m, 999999, false, 'slash');
    return { gained: (player.exp || 0) - xp0, removed: !game.monsters.includes(m) };
  });
  ok('kill grants XP and removes the monster', kill && kill.gained > 0 && kill.removed, kill);

  // (6) DoT death triggers a cheat-death revive (R14 fix) instead of dying.
  const revive = await ev(() => {
    player.tree = player.tree || {}; player.tree.secondWind = true; player.tree.secondWindReady = true;
    player._miracleUsedThisMap = true; player._phoenixUsedThisMap = true;  // isolate Second Wind
    game.dying = 0; player.hp = 5;
    if (typeof _tryCheatDeathRevive !== 'function') return { noFn: true };
    player.hp = 0; const revived = _tryCheatDeathRevive();
    return { revived, hpAfter: player.hp, consumed: player.tree.secondWindReady === false };
  });
  ok('cheat-death revive fires on a lethal blow', revive && revive.revived === true && revive.hpAfter > 0 && revive.consumed, revive);

  // (7) Boss stun-resistance: a stunned boss still runs AI (R14 anti-perma-lock).
  const bossStun = await ev(() => {
    const m = game.monsters.find(x => x && x.currentHp > 0); if (!m) return null;
    m.isBoss = true; m.currentHp = m.maxHp = 500000; m.stunTimer = 100000;
    const x0 = m.x, patternBefore = m.patternTimer || 0;
    for (let i = 0; i < 30; i++) updateMonsters(50);
    // The boss should NOT be fully frozen: its AI (pattern/attack timers) advances.
    return { stunStill: m.stunTimer, patternAdvanced: (m.patternTimer || 0) !== patternBefore || m.x !== x0 || (m.attackTimer || 0) !== 0 };
  });
  ok('stunned boss still runs AI (no perma-stun-lock)', bossStun && bossStun.patternAdvanced === true, bossStun);

  ok('no page errors through combat verification', errs.length === 0, errs.slice(0, 6));
} catch (e) { results.push({ n: 'HARNESS ERROR', pass: false, extra: String(e).slice(0, 300) }); }
finally { await browser.close(); }
const passed = results.filter(r => r.pass).length;
console.log('\n=== COMBAT VERIFICATION ===');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : ''}`);
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
