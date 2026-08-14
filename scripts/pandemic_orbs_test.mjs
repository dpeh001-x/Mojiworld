// Pandemic Hex buff: super poison + 10 dark hex orbs, measured live.
//
// Per user: "add in a super poison element for it and make it summon 10 dark
// orbs that dishes damage and poisons." The checks:
//   1. the cast launches exactly 10 orbs, all carrying the hexorb sprite key
//   2. the orb sprite FILE exists and decodes (a missing bspr fails silent)
//   3. an orb hit deals damage AND lands SUPER POISON (0.9x ATK/tick DOT)
//   4. super poison never DOWNGRADES a hotter DOT already on the target
//   5. orbs home: with one target alive, orbs converge and connect
// Run: node scripts/pandemic_orbs_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'file:///' + path.join(ROOT, process.argv[2] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof SKILL_FNS !== 'undefined' && typeof game !== 'undefined', { timeout: 60000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
});
await page.waitForTimeout(3000);

const r = await page.evaluate(async () => {
  const out = {};
  const frame = () => new Promise((res) => requestAnimationFrame(res));
  player.cls = 'mage'; player.job = 'warlock'; player.master = 'hexmaster';
  player.level = 90; player.invulnerable = 9e9; player.hp = 99999;
  game.paused = false;

  // --- 2. the sprite decodes -------------------------------------------------
  out.spriteOk = await new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img.naturalWidth > 0);
    img.onerror = () => res(false);
    img.src = 'Sprites/projectiles/p_ult_hexorb.webp';
  });

  // --- 1. exactly 10 orbs, right fields --------------------------------------
  // A REAL monster, HP-boosted to survive. Two probe lessons baked in here:
  // synthetic dummies never enter the projectile collision path (_liveMobs is
  // a pre-filtered snapshot), and an orb that KILLS skips the poison by design
  // (corpses do not tick) - the first probe read both as 'super poison broken'.
  try { loadMap('forest'); } catch (e) {}
  for (let i = 0; i < 40; i++) { game.paused = false; await frame(); }
  const tgt = game.monsters.find((m) => m && m.currentHp > 0);
  if (!tgt) return { noMonster: true };
  tgt.maxHp = 5e7; tgt.currentHp = 5e7; tgt.hp = 5e7; tgt.evasion = 0;
  for (const m of game.monsters) if (m !== tgt) m.currentHp = 0;
  game.projectiles.length = 0; game.hazards.length = 0;
  const _tx = player.x + 250, _ty = player.y;
  tgt.x = _tx; tgt.y = _ty; tgt.vx = 0; tgt.vy = 0;
  SKILL_FNS.hexmaster_ult();
  // orbs stagger out over 250 + 9*100 = ~1.2s of real timers
  const t0 = performance.now();
  const seen = new Set();
  let peakOrbs = 0;
  while (performance.now() - t0 < 2300) {
    game.paused = false;
    tgt.x = _tx; tgt.y = _ty; tgt.vx = 0; tgt.vy = 0; tgt.currentHp = Math.max(tgt.currentHp, 1e6);
    for (const p of game.projectiles) if (p && p.skill === 'hexorb') seen.add(p);
    peakOrbs = Math.max(peakOrbs, game.projectiles.filter((p) => p && p.skill === 'hexorb').length);
    await frame();
  }
  out.orbsLaunched = seen.size;
  out.peakOrbs = peakOrbs;
  const sample = [...seen][0];
  out.orbSprite = sample ? sample.bspr : null;
  out.orbPoisonFlag = sample ? sample.superPoison : null;
  out.orbAoe = sample ? sample.aoeOnHit : null;

  // --- 3. the hit landed damage + super poison -------------------------------
  // let the homing orbs connect
  const t1 = performance.now();
  while (performance.now() - t1 < 2500 && game.projectiles.some((p) => p && p.skill === 'hexorb')) {
    game.paused = false; tgt.x = _tx; tgt.y = _ty; tgt.vx = 0; tgt.vy = 0; tgt.currentHp = Math.max(tgt.currentHp, 1e6); await frame();
  }
  out.tgtHurt = tgt.currentHp < tgt.maxHp;
  out.tgtDot = tgt.burnDmg | 0;
  out.dotExpected = Math.max(3, Math.floor(getAtk() * 0.9));

  // --- 4. never downgrades a hotter DOT ---------------------------------------
  game.projectiles.length = 0;
  tgt.burnDmg = 99999;
  game.projectiles.push({ x: tgt.x - 30, y: tgt.y + 10, vx: 6, vy: 0, w: 28, h: 28, life: 60,
    damage: 100, owner: 'player', skill: 'hexorb', homing: tgt, aoeOnHit: 80,
    noGravity: true, _msHandled: true, superPoison: 1, bspr: 'bult_hexorb', color: '#aa33ff' });
  const t2 = performance.now();
  while (performance.now() - t2 < 1500 && game.projectiles.length) { game.paused = false; await frame(); }
  out.dotNotDowngraded = (tgt.burnDmg | 0) === 99999;

  out.desc = (SKILLS && SKILLS.hexmaster_ult && SKILLS.hexmaster_ult.desc) || '';
  return out;
});
await browser.close();

console.log(`  orbs launched ${r.orbsLaunched} (peak in flight ${r.peakOrbs}); sprite ${r.orbSprite}, poison flag ${r.orbPoisonFlag}, aoe ${r.orbAoe}`);
console.log(`  target hurt ${r.tgtHurt}, DOT ${r.tgtDot} (expected ${r.dotExpected}); sprite decodes ${r.spriteOk}`);

check(r.spriteOk, 'the ludo.ai orb sprite exists and decodes (a missing bspr fails silently)', r.spriteOk);
check(r.orbsLaunched === 10, 'the cast launches exactly 10 orbs', r.orbsLaunched);
check(r.orbSprite === 'bult_hexorb', 'orbs carry the dark-hex sprite key', r.orbSprite);
check(r.orbPoisonFlag === 1 && r.orbAoe === 80, 'orbs carry super poison and the burst radius', { poison: r.orbPoisonFlag, aoe: r.orbAoe });
check(r.tgtHurt, 'the orbs dealt damage (they dish, not just decorate)', r.tgtHurt);
check(r.tgtDot === r.dotExpected, 'SUPER POISON landed at 0.9x ATK per tick', { got: r.tgtDot, want: r.dotExpected });
check(r.dotNotDowngraded, 'super poison never downgrades a hotter DOT already ticking', r.dotNotDowngraded);
check(/SUPER POISON/.test(r.desc) && /10 dark hex orbs/.test(r.desc), 'the tooltip tells the truth', r.desc.slice(0, 90));
check(errs.length === 0, 'no page errors', errs);
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
