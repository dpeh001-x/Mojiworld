// The crusader Judgement orbs wear the divine-aegis sprite (ludo.ai art).
//
// Per user: "Using ludo.ai generate a nice sprite for crusader orbs for the
// skill divine aegis." The checks:
//   1. the sprite FILE exists and decodes (a missing bspr fails silently —
//      the orb would quietly fall back to a bare colored dot again)
//   2. Bastion of Dawn's orbs actually carry the sprite key
//   3. the orb count still follows banked Judgement (5 stacks -> 10 orbs);
//      wearing art must not have changed the mechanics
// Run: node scripts/holyorb_sprite_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'file:///' + path.join(ROOT, process.argv[2] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome' });
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
  player.cls = 'warrior'; player.job = 'knight'; player.master = 'crusader';
  player.level = 90; player.invulnerable = 9e9; player.hp = 9999; player.maxHp = 9999;
  game.paused = false;

  out.spriteOk = await new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img.naturalWidth > 0);
    img.onerror = () => res(false);
    img.src = 'Sprites/projectiles/p_ult_holyorb.webp';
  });
  out.manifestHasKey = (typeof LX_BULT_PROJ !== 'undefined') && !!LX_BULT_PROJ.bult_holyorb;

  game.monsters.length = 0; game.projectiles.length = 0; game.hazards.length = 0;
  const tgt = { type: 'snail', x: player.x + 200, y: player.y, w: 40, h: 40,
    currentHp: 5e6, maxHp: 5e6, hp: 5e6, level: 1, evasion: 0, isBoss: false, vx: 0, vy: 0 };
  game.monsters.push(tgt);
  player._judgeStacks = 5;               // full meter -> 10 orbs (+L10 bonus if ranked; rank 0 here)
  // Bastion of Dawn is TWO-TAP since the Guardian rework: the first call ARMS
  // (and flags the physical press as still held), the second releases. Clear
  // the held flag between calls the way a real keyup would.
  SKILL_FNS.crusader_ult();
  player._bastionArmHeld = false;
  SKILL_FNS.crusader_ult();
  // orbs stagger out at 200 + i*90 ms of real timers
  const t0 = performance.now();
  const seen = new Set();
  while (performance.now() - t0 < 2200) {
    game.paused = false;
    for (const p of game.projectiles) if (p && p.skill === 'holyorb') seen.add(p);
    await frame();
  }
  out.orbCount = seen.size;
  const sample = [...seen][0];
  out.orbSprite = sample ? sample.bspr : null;
  out.orbAoe = sample ? sample.aoeOnHit : null;
  out.stacksConsumed = (player._judgeStacks | 0) === 0;
  return out;
});
await browser.close();

console.log(`  sprite decodes ${r.spriteOk}, manifest key ${r.manifestHasKey}; orbs ${r.orbCount}, bspr ${r.orbSprite}, aoe ${r.orbAoe}`);

check(r.spriteOk, 'the ludo.ai aegis-orb sprite exists and decodes', r.spriteOk);
check(r.manifestHasKey, 'bult_holyorb is registered in the projectile manifest', r.manifestHasKey);
check(r.orbCount === 10, 'a full Judgement meter still launches 10 orbs (art did not change mechanics)', r.orbCount);
check(r.orbSprite === 'bult_holyorb', 'the orbs wear the divine-aegis sprite, not the bare dot', r.orbSprite);
check(r.orbAoe === 90, 'the 90px burst is untouched', r.orbAoe);
check(r.stacksConsumed, 'casting still consumes the banked Judgement', r.stacksConsumed);
check(errs.length === 0, 'no page errors', errs);
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
