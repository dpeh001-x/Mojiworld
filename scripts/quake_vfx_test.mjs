// Earthquake readability, measured rather than asserted.
//
// Per user: "hard to detect if the earthquake is happening or whether I'm
// taking damage". Three things are counted on a REAL mob_quake hazard:
//   1. draw calls during the telegraph — is anything painted at all
//   2. particles spawned by the impact
//   3. damage-number entries when the player is standing in the band
// Run: node scripts/quake_vfx_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'file:///' + path.join(ROOT, process.argv[2] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 180)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof MAPS !== 'undefined', { timeout: 60000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  game.paused = false; player.level = 60;
  try { loadMap('blockland_apex'); } catch (_e) {}
});
await page.waitForTimeout(8000);

const r = await page.evaluate(() => {
  const out = {};
  // Freeze the world and clear the arena: a live Legosaurus lands its own
  // hits during the tick below, and the first run attributed its 2204 damage
  // number to the quake.
  game.paused = true;
  game.monsters.length = 0;
  player._god = false;
  const mk = () => {
    const gy = (game.mapData && game.mapData.worldHeight ? game.mapData.worldHeight - 60 : 680);
    const h = {
      type: 'mob_quake', cx: player.x + player.w / 2,
      x: player.x - 280, y: gy - 30, w: 560, h: 50,
      life: 90, maxLife: 90, damage: 400, stun: 700, colorTele: '#ff8844',
    };
    game.hazards.push(h);
    return h;
  };

  // --- 1. telegraph: count ctx work for one hazard, mid wind-up -------------
  game.hazards.length = 0;
  const h1 = mk();
  h1.life = 30;                                   // two-thirds through
  const n = { fill: 0, fillRect: 0, stroke: 0, fillText: 0, strokeText: 0, drawImage: 0 };
  const keep = {};
  for (const k of Object.keys(n)) { keep[k] = ctx[k]; ctx[k] = function (...a) { n[k]++; return keep[k].apply(ctx, a); }; }
  const pBefore = game.particles.length;
  try { if (typeof drawHazards === 'function') drawHazards(); } catch (_e) {}
  for (const k of Object.keys(n)) ctx[k] = keep[k];
  out.telegraphDraws = Object.values(n).reduce((a, b) => a + b, 0);
  out.telegraphDetail = n;
  out.telegraphParticles = game.particles.length - pBefore;

  // --- 2. impact: particles spawned when it fires --------------------------
  // Clear PROJECTILES too, not just hazards. game.paused stops the loop from
  // ticking, but this test calls updateProjectiles() directly - so a fire jet
  // the Legosaurus launched before the pause still advances and lands. That is
  // the 2204-damage / size-16 number that made this test fail about one run in
  // three, always for a reason unrelated to quakes.
  game.hazards.length = 0; game.particles.length = 0; game.damageNumbers.length = 0;
  game.projectiles.length = 0;
  game.monsters.length = 0;
  const h2 = mk();
  // life 1, not 0: updateProjectiles DECREMENTS before testing life === 0,
  // so a hazard planted at 0 goes to -1 and the impact branch never runs.
  h2.life = 1;
  player.x = h2.cx - player.w / 2;                 // stand in the band
  player.y = h2.y - player.h + 2;                  // on the floor line
  player.invulnerable = 0; player._god = false; player.hp = 99999;
  const hpBefore = player.hp;
  try { if (typeof updateProjectiles === 'function') updateProjectiles(16); } catch (_e) {}
  out.impactParticles = game.particles.length;
  out.damageNumbers = game.damageNumbers.length;
  out.damageNumberTexts = game.damageNumbers.map((d) => String(d.text));
  out.maxDamageNumberSize = game.damageNumbers.reduce((a, d) => Math.max(a, d.size || 0), 0);
  out.hpLost = hpBefore - player.hp;
  return out;
});
await browser.close();

console.log(`telegraph: ${r.telegraphDraws} draw calls ${JSON.stringify(r.telegraphDetail)}, ${r.telegraphParticles} dust`);
console.log(`impact   : ${r.impactParticles} particles, ${r.damageNumbers} damage labels ${JSON.stringify(r.damageNumberTexts)} max size ${r.maxDamageNumberSize}, hp lost ${r.hpLost}`);

// Assert the COMPONENTS, not a draw-call total. "8 calls" was a guess about
// implementation: the band is deliberately cheap — one gradient fillRect for
// the floor wash, one stroke for the two hard edges, plus the pre-existing ring
// sprite. Three calls is the design, and counting them told us nothing about
// whether the zone is legible. What matters is that a filled area and its
// boundary now exist, where before there was only the ring.
check(r.telegraphDetail.fillRect >= 1, 'the strike zone is filled, not just outlined', r.telegraphDetail);
check(r.telegraphDetail.stroke >= 1, 'and its edges are marked, so "inside" is readable', r.telegraphDetail);
check(r.telegraphDraws > 1, 'the telegraph draws more than the bare ring it used to', r.telegraphDraws);
check(r.impactParticles >= 40, 'the impact throws a proper plume (was 14)', r.impactParticles);
check(r.hpLost > 0, 'standing in the band still costs HP (the mechanic is intact)', r.hpLost);
check(r.damageNumbers >= 2, 'the hit is labelled, not just numbered', r.damageNumberTexts);
check(r.damageNumberTexts.some((t) => /QUAKE/i.test(t)), 'and the label names the attack', r.damageNumberTexts);
check(r.maxDamageNumberSize >= 20, 'the damage number is legible in a boss fight (was 14)', r.maxDamageNumberSize);
check(errs.length === 0, 'no page errors', errs);
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
