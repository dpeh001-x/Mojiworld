// v0.29.296 — empirically determine which hit-TAG each skill delivers to
// hitMonster. Milestone "ability verbs" (execute/chain/lifesteal/mark) are
// resolved from that tag, so a skill whose damage arrives under a different
// tag would silently never fire its perk. Guessing is not good enough — this
// casts every skill at a dummy target and records what actually lands.
//
//   node serve.js 8772 && node scripts/skill_hit_tag_probe.mjs 8772
import { chromium } from 'playwright-core';
import { existsSync, writeFileSync } from 'node:fs';
const PORT = process.argv[2] || '8772';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => typeof game !== 'undefined' && typeof SKILL_FNS !== 'undefined', null, { timeout: 60000 });
await page.waitForTimeout(2500);

const out = await page.evaluate(async () => {
  // Instrument hitMonster to record the tag it is called with.
  const seen = {};
  let current = null;
  const orig = window.hitMonster || hitMonster;
  const rec = function (m, dmg, isCrit, skill) {
    if (current) (seen[current] ||= new Set()).add(String(skill));
    return orig.apply(this, arguments);
  };
  try { window.hitMonster = rec; } catch (e) {}
  // eslint-disable-next-line no-global-assign
  try { eval('hitMonster = rec'); } catch (e) {}

  // Make the player omnipotent so nothing blocks a cast, and park a beefy
  // dummy right next to them so every melee/projectile finds a target.
  player.level = 200; player.mp = 99999; player.hp = player.maxHp = 999999;
  player.skillCooldowns = {};
  const ids = Object.keys(SKILL_FNS);
  const results = {};
  for (const id of ids) {
    // fresh dummies in a ring so AoE / chain / homing all connect
    game.monsters.length = 0;
    for (let i = 0; i < 6; i++) {
      const m = { uid: 9000 + i, type: 'slime', name: 'Dummy', x: player.x + 60 + i * 40, y: player.y,
        w: 40, h: 40, currentHp: 1e9, maxHp: 1e9, exp: 0, mojicoins: 0, facing: -1,
        vx: 0, vy: 0, hitFlash: 0, traits: {}, level: 1 };
      game.monsters.push(m);
    }
    current = id;
    player.mp = 99999; player.skillCooldowns = {};
    try { SKILL_FNS[id](); } catch (e) { (results[id] ||= {}).error = String(e).slice(0, 80); }
    await new Promise(r => setTimeout(r, 260));   // let delayed/projectile hits land
    current = null;
  }
  // second pass: give slow skills more time
  const slow = ids.filter(id => !seen[id]);
  for (const id of slow) {
    game.monsters.length = 0;
    for (let i = 0; i < 6; i++) {
      game.monsters.push({ uid: 9100 + i, type: 'slime', name: 'Dummy', x: player.x + 50 + i * 30, y: player.y,
        w: 40, h: 40, currentHp: 1e9, maxHp: 1e9, exp: 0, mojicoins: 0, facing: -1,
        vx: 0, vy: 0, hitFlash: 0, traits: {}, level: 1 });
    }
    current = id;
    player.mp = 99999; player.skillCooldowns = {};
    try { SKILL_FNS[id](); } catch (e) {}
    await new Promise(r => setTimeout(r, 1400));
    current = null;
  }
  for (const id of ids) results[id] = { tags: seen[id] ? [...seen[id]] : [] };
  return results;
});

await b.close();
if (errs.length) console.log('page errors: ' + errs.slice(0, 3).join(' | '));

const rows = Object.entries(out);
const hit = rows.filter(([, v]) => v.tags.length);
const miss = rows.filter(([, v]) => !v.tags.length);
console.log(`probed ${rows.length} skills — ${hit.length} landed damage, ${miss.length} landed none\n`);
const selfTagged = [], crossTagged = [];
for (const [id, v] of hit) {
  (v.tags.includes(id) ? selfTagged : crossTagged).push(`${id} -> [${v.tags.join(', ')}]`);
}
console.log(`SELF-TAGGED (milestone verbs WILL fire) — ${selfTagged.length}:`);
for (const s of selfTagged) console.log('  ' + s);
console.log(`\nCROSS-TAGGED (verbs keyed on the skill id would NOT fire) — ${crossTagged.length}:`);
for (const s of crossTagged) console.log('  ' + s);
console.log(`\nNO DAMAGE OBSERVED (buff/summon/mobility, or needs real combat) — ${miss.length}:`);
console.log('  ' + miss.map(([id]) => id).join(', '));
writeFileSync(process.argv[3] || 'skill_tags.json', JSON.stringify(out, null, 2));
