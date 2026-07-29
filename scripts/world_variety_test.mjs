// Live test: WORLD STATES + ELITE AFFIXES (v0.29.310).
// Both features exist to add encounter variety from machinery that already
// ships. This guards the two ways that silently fails:
//   1. a feature that announces itself but changes nothing (this repo has
//      shipped advertised-but-never-applied systems before), and
//   2. the affix roll mutating monsterTypes[type].traits, which is a SHARED
//      object — that would rewrite every monster of that type for the session.
// Run: node scripts/world_variety_test.mjs   (MOJI_PW_EXE overrides Chrome)
import { chromium } from 'playwright-core';
const EXE = process.env.MOJI_PW_EXE || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = process.env.MOJI_GAME_URL || 'http://localhost:8080/mojiworld_game.html';
const R = []; const ok = (n, c, x) => R.push({ n, pass: !!c, x });
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  const page = await (await browser.newContext()).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof ELITE_AFFIXES !== 'undefined', null, { timeout: 45000 });
  await page.waitForTimeout(2500);

  const out = await page.evaluate(async () => {
    window._prologueActive = false; const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
    game.paused = false;
    player.cls = 'warrior'; player.level = 60; player._god = true;
    player.maxHp = 3744; player.hp = 3744; player.baseAtk = 189; player.baseDef = 161;
    loadMap('glasswindSteppe');
    const res = {};

    // --- ELITE AFFIXES ------------------------------------------------------
    // snapshot the SHARED type traits before any affix rolls
    const typeTraitsBefore = JSON.stringify(monsterTypes.slime.traits || null);
    const seen = {}; let affixed = 0, plain = 0;
    for (let i = 0; i < 400; i++) {
      game.monsters.length = 0;
      const m = spawnMonster(player.x + 200, player.y, 'slime', false, false);
      if (!m) break;
      m.isElite = true; m._affix = null;
      const id = _lxRollEliteAffix(m);
      if (id) { seen[id] = (seen[id] || 0) + 1; affixed++; } else plain++;
    }
    res.affixKinds = Object.keys(seen).length;
    res.affixSpread = seen;
    res.affixed = affixed;
    // the shared type object must be untouched
    res.typeTraitsUnchanged = JSON.stringify(monsterTypes.slime.traits || null) === typeTraitsBefore;

    // an affix must actually change the instance
    game.monsters.length = 0;
    const base = spawnMonster(player.x + 200, player.y, 'slime', false, false);
    const baseSpeed = base.speed, baseDef = base.def;
    const clone = spawnMonster(player.x + 260, player.y, 'slime', false, false);
    clone.isElite = true;
    let swiftFound = null, traitFound = null;
    for (let i = 0; i < 300; i++) {
      const t = spawnMonster(player.x + 300, player.y, 'slime', false, false);
      t.isElite = true; t._affix = null;
      const id = _lxRollEliteAffix(t);
      if (id === 'swift' && !swiftFound) swiftFound = { before: baseSpeed, after: t.speed };
      if (id === 'volatile' && !traitFound) traitFound = { hasTrait: !!(t.traits && t.traits.explodesOnDeath), named: /Volatile/.test(t.name || '') };
      game.monsters.length = 0;
      if (swiftFound && traitFound) break;
    }
    res.swift = swiftFound; res.volatileAffix = traitFound; res.baseDef = baseDef;

    // --- WORLD STATES -------------------------------------------------------
    res.stateDefs = WORLD_STATES.map((w) => w.id);
    // force each state and confirm its hook actually reads it
    const applied = {};
    for (const w of WORLD_STATES) {
      game._towerSpeedMul = 1; game._towerHpMul = 1;
      game._towerPlayerDmgMul = 1; game._towerPlayerTakeMul = 1;
      game.tower = null;
      game._worldStateByMap = { [game.currentMap]: w.id };
      _lxRollWorldState();
      applied[w.id] = {
        active: !!(game.worldState && game.worldState.id === w.id),
        speed: towerSpeedMul(), hp: towerHpMul(),
        pdmg: towerPlayerDmgMul(), ptake: towerPlayerTakeMul(),
        vamp: towerVampiric(),
      };
    }
    res.states = applied;
    // a map with no state must leave every hook neutral
    game._worldStateByMap = { [game.currentMap]: null };
    game._towerSpeedMul = 1; game._towerHpMul = 1; game._towerPlayerDmgMul = 1; game._towerPlayerTakeMul = 1;
    _lxRollWorldState();
    res.neutral = { state: game.worldState, speed: towerSpeedMul(), hp: towerHpMul(), vamp: towerVampiric() };
    return res;
  });

  ok(`elite affixes roll a spread of kinds (${out.affixKinds} of ${7})`, out.affixKinds >= 5, out.affixSpread);
  ok('affix roll does NOT mutate the shared monsterTypes traits object', out.typeTraitsUnchanged === true);
  ok('a stat affix really changes the instance (Swift speeds it up)',
    !!out.swift && out.swift.after > out.swift.before, out.swift);
  ok('a trait affix really attaches (Volatile gains explodesOnDeath + is named)',
    !!out.volatileAffix && out.volatileAffix.hasTrait && out.volatileAffix.named, out.volatileAffix);
  const s = out.states || {};
  ok('world state Double Time speeds monsters up', s.fast && s.fast.active && s.fast.speed > 1.5, s.fast);
  ok('world state Vampiric Air is READ by towerVampiric()', s.regen && s.regen.active && s.regen.vamp === true, s.regen);
  ok('world state Glass Hour raises damage dealt AND taken', s.fragile && s.fragile.pdmg > 1.2 && s.fragile.ptake > 1.2, s.fragile);
  ok('world state Dim Light raises enemy HP', s.dim && s.dim.active && s.dim.hp > 1.1, s.dim);
  ok('a map with no state leaves every hook neutral', out.neutral && !out.neutral.state &&
    out.neutral.speed === 1 && out.neutral.hp === 1 && out.neutral.vamp === false, out.neutral);
  ok('no page errors', errs.length === 0, errs.slice(0, 4));
} catch (e) { R.push({ n: 'HARNESS ERROR', pass: false, x: String(e).slice(0, 300) }); }
finally { await browser.close(); }

const pass = R.filter((r) => r.pass).length;
console.log('\n=== WORLD STATES + ELITE AFFIXES ===');
for (const r of R) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.x !== undefined ? '  ' + JSON.stringify(r.x) : ''}`);
console.log(`\n${pass}/${R.length} passed`);
process.exit(pass === R.length ? 0 : 1);
