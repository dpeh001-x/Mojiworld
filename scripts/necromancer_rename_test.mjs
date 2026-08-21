// The Lich master class is now the Necromancer, per user "rename lich to
// necromancer, replace it on every single file you can find".
//
// The rename is only safe if three separate things hold, and none of them is
// obvious from reading a diff:
//
//   1. EXISTING SAVES SURVIVE. player.master and the player.skillRanks keys are
//      both persisted. The load-time consistency guard tests MASTERS[master]
//      FIRST, so a stale 'lich' is invisible to it and sails through to become
//      a dangling reference (no kit, no master bonus, blank class panel, and
//      nothing logged). Rank points spent on lich_harvest / lich_ult would be
//      stranded under keys nothing reads. A migration maps both.
//
//   2. THE MONSTERS ARE NOT THE CLASS. 'lich' is a substring of 'lichkin' and
//      'shardlich' — two monsters — and of the map "Bone Graveyard — Lich's
//      Vigil". A blind find-and-replace renames all three. They must be intact.
//
//   3. THE ART STILL RESOLVES. The skill ids name their own asset files
//      (Sprites/skills/<id>.webp, audio/skill/<id>.mp3, the fx anim frames), so
//      renaming the ids without renaming the files is a silent 404.
// Run: node scripts/necromancer_rename_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const URL = 'file:///' + path.join(ROOT, args[0] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [], missing = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
page.on('requestfailed', (rq) => { const u = rq.url(); if (/necromancer|lich/i.test(u)) missing.push(u.replace(/^.*\//, '')); });
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  - ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof MASTERS === 'object', { timeout: 90000 });
const r = await page.evaluate(async () => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  const out = {};

  // --- the class itself ---
  out.master = {
    hasNecromancer: !!MASTERS.necromancer,
    name: MASTERS.necromancer && MASTERS.necromancer.name,
    from: MASTERS.necromancer && MASTERS.necromancer.from,
    lichGone: MASTERS.lich === undefined,
  };
  out.skills = {
    harvest: !!SKILLS.necromancer_harvest,
    ult: !!SKILLS.necromancer_ult,
    harvestMaster: SKILLS.necromancer_harvest && SKILLS.necromancer_harvest.master,
    ultMaster: SKILLS.necromancer_ult && SKILLS.necromancer_ult.master,
    oldGone: SKILLS.lich_harvest === undefined && SKILLS.lich_ult === undefined,
  };
  // Nothing anywhere may still advertise the old ids.
  out.stragglers = Object.keys(SKILLS).filter((k) => /(^|_)lich(_|$)/.test(k))
    .concat(Object.keys(MASTERS).filter((k) => /(^|_)lich(_|$)/.test(k)));

  // --- the lore that merely SPELLS lich ---
  out.lore = {
    lichkin: !!(typeof monsterTypes !== 'undefined' && monsterTypes.lichkin),
    lichkinName: (typeof monsterTypes !== 'undefined' && monsterTypes.lichkin || {}).name,
    shardlich: !!(typeof monsterTypes !== 'undefined' && monsterTypes.shardlich),
    shardlichName: (typeof monsterTypes !== 'undefined' && monsterTypes.shardlich || {}).name,
    mapName: (typeof MAPS !== 'undefined' && MAPS.boneGraveyard3 || {}).name,
  };

  // --- the migration, driven through the REAL save path ---
  player.cls = 'mage'; player.job = 'warlock';
  player.master = 'lich';
  player.skillRanks = player.skillRanks || {};
  player.skillRanks.lich_harvest = 5;
  player.skillRanks.lich_ult = 3;
  player.buffs = player.buffs || {};
  player.buffs.lich = 1234;
  try { saveState(); } catch (e) { out.saveErr = String(e).slice(0, 90); }
  // saveState debounces (~1500ms); reading back before it lands tests nothing.
  for (let i = 0; i < 600 && game._saveTimer; i++) await new Promise((res) => setTimeout(res, 20));
  out.saveLanded = !game._saveTimer;
  try { loadState(); } catch (e) { out.loadErr = String(e).slice(0, 90); }
  out.migrated = {
    master: player.master,
    harvestRank: (player.skillRanks || {}).necromancer_harvest,
    ultRank: (player.skillRanks || {}).necromancer_ult,
    oldKeysGone: !('lich_harvest' in (player.skillRanks || {})) && !('lich_ult' in (player.skillRanks || {})),
  };

  // --- the art the renamed ids resolve to ---
  const load = (src) => new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im.naturalWidth > 0);
    im.onerror = () => res(false);
    im.src = src;
  });
  out.art = {};
  for (const p of ['Sprites/skills/necromancer_harvest.webp', 'Sprites/skills/necromancer_ult.webp',
                   'Sprites/fx/necromancer_ult.webp', 'Sprites/fx/anim/necromancer_ult_0.webp',
                   'Sprites/projectiles/p_necromancer_soulorb.webp']) {
    // Key on the FULL path: Sprites/skills/ and Sprites/fx/ each hold a
    // necromancer_ult.webp, so keying on the basename collapsed the two and
    // silently graded only one of them.
    out.art[p] = await load(p);
  }
  out.fxKey = !!(typeof LX_FX !== 'undefined' && LX_FX.necromancer_ult);
  out.animFrames = (typeof _lxFrameCount === 'function') ? _lxFrameCount('fx/anim', 'necromancer_ult', 0) : null;
  return out;
});
await browser.close();

console.log(`  master:    ${JSON.stringify(r.master)}`);
console.log(`  skills:    ${JSON.stringify(r.skills)}`);
console.log(`  lore kept: ${JSON.stringify(r.lore)}`);
console.log(`  migrated:  ${JSON.stringify(r.migrated)}  (save landed: ${r.saveLanded})`);
console.log(`  art:       ${JSON.stringify(r.art)}  fxKey=${r.fxKey} frames=${r.animFrames}`);

check(r.master.hasNecromancer && r.master.name === 'Necromancer', 'the master class is Necromancer', r.master);
check(r.master.from === 'warlock', 'and still branches from Warlock', r.master);
check(r.master.lichGone, 'the old "lich" master id is gone', r.master);
check(r.skills.harvest && r.skills.ult, 'both of its skills exist under the new ids', r.skills);
check(r.skills.harvestMaster === 'necromancer' && r.skills.ultMaster === 'necromancer',
      'and they point at the renamed master', r.skills);
check(r.skills.oldGone, 'the old skill ids are gone', r.skills);
check(r.stragglers.length === 0, 'no lich-named skill or master survives anywhere', r.stragglers);
// The three things that merely spell it.
check(r.lore.lichkin && r.lore.lichkinName === 'Lichkin', 'the Lichkin MONSTER is untouched', r.lore);
check(r.lore.shardlich && r.lore.shardlichName === 'Shardlich', 'the Shardlich MONSTER is untouched', r.lore);
check(typeof r.lore.mapName === 'string' && r.lore.mapName.includes("Lich's Vigil"),
      "the map \"Bone Graveyard — Lich's Vigil\" keeps its name", r.lore);
// The half that protects real players.
check(r.saveLanded, 'the save actually landed before the reload was attempted', r.saveLanded);
check(r.migrated.master === 'necromancer', 'a save carrying master:"lich" loads as a Necromancer', r.migrated);
check(r.migrated.harvestRank === 5 && r.migrated.ultRank === 3,
      'and the rank points spent on the old skill ids follow them', r.migrated);
check(r.migrated.oldKeysGone, 'with no stale lich_* keys left behind', r.migrated);
// The art.
check(Object.values(r.art).every(Boolean), 'every renamed sprite resolves (no silent 404)', r.art);
check(r.fxKey, 'LX_FX carries the renamed ult key', r.fxKey);
check(r.animFrames === 9, 'and the frame index knows its 9 ult frames', r.animFrames);
check(missing.length === 0, 'no failed requests for lich/necromancer assets', [...new Set(missing)].slice(0, 5));
check(errs.length === 0, 'no page errors', [...new Set(errs)].slice(0, 3));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
