// BASIC-ATTACK RANKS — 2% each, +20% at rank 10, for warrior/rogue/archer/mage.
// ============================================================================
// Per user: "for warriors, rogue and archers ... each level up to the basic
// attack should only +2% of damage, max level 10", clarified to "RP only at
// 2%/rank for basic attacks, reaching +20% at rank 10", mage left alone -- until 2026-10-09: "mage basic attack at 10 points is +70% change it to 20% at 10 points and each point only adds +2%".
//
// Measuring this turned up a second thing, which is why the test checks the
// warrior and rogue cases through the tag their hits ACTUALLY carry rather than
// through the skill id. On the build before this change, at rank 10:
//
//     slash via 'melee'      1.0   (+0%)   <- ten RP bought nothing
//     stab  via 'melee'      1.0   (+0%)   <- ditto
//     arrowShot via 'arrow'  1.7  (+70%)
//     magicBolt via 'bolt'   1.7  (+70%)
//
// 'melee' is in SKILL_RANK_BLACKLIST and has no entry in the tag bridge, so it
// always returned 1 -- while the skills panel sold ranks in slash/stab anyway,
// because the RP spend path gates on the blacklist by DEF ID and neither id is
// in it. Warriors and rogues were paying RP into a black hole.
//
// The class matters to the measurement: the basic Z attack lands tagged 'melee'
// for everyone, so which basic it belongs to is resolved from player.cls. A
// warrior asking about 'stab' correctly gets nothing, and an early version of
// this test reported exactly that and looked like a bug.
// Run: node scripts/basic_attack_rank_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 9923);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
  { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'BasicRank');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
await page.evaluate(() => { player.level = 99; loadMap('forest', 300); });
await page.waitForTimeout(3500);

const R = await page.evaluate(() => {
  const o = {};
  player.skillRanks = player.skillRanks || {};
  const origCls = player.cls;
  // Read the multiplier as the class whose basic it is -- 'melee' resolves by
  // player.cls, so asking as the wrong class measures nothing.
  const mulAt = (cls, defId, tag, rank) => {
    player.cls = cls;
    player.skillRanks[defId] = rank;
    const v = getSkillRankMul(tag);
    player.skillRanks[defId] = 0;
    return +v.toFixed(4);
  };
  o.warrior = { r1: mulAt('warrior', 'slash', 'melee', 1), r5: mulAt('warrior', 'slash', 'melee', 5), r10: mulAt('warrior', 'slash', 'melee', 10) };
  o.rogue   = { r1: mulAt('rogue', 'stab', 'melee', 1),   r5: mulAt('rogue', 'stab', 'melee', 5),   r10: mulAt('rogue', 'stab', 'melee', 10) };
  o.archer  = { r1: mulAt('archer', 'arrowShot', 'arrow', 1), r5: mulAt('archer', 'arrowShot', 'arrow', 5), r10: mulAt('archer', 'arrowShot', 'arrow', 10) };
  o.mage    = { r1: mulAt('mage', 'magicBolt', 'bolt', 1),   r5: mulAt('mage', 'magicBolt', 'bolt', 5),   r10: mulAt('mage', 'magicBolt', 'bolt', 10) };
  // over-cap must not keep paying
  o.warriorOverCap = mulAt('warrior', 'slash', 'melee', 99);
  player.cls = origCls;

  // RP must still be spendable on these -- the user asked for "RP only at
  // 2%/rank", i.e. the investment stays, only its value changed.
  o.rpBlocked = {
    slash: SKILL_RANK_BLACKLIST.has('slash'),
    stab: SKILL_RANK_BLACKLIST.has('stab'),
    arrowShot: SKILL_RANK_BLACKLIST.has('arrowShot'),
    magicBolt: SKILL_RANK_BLACKLIST.has('magicBolt'),
  };
  // the Skills panel tile for the mage's Magic Bolt, read the way the player reads it
  try { player.cls = 'mage'; const host = document.createElement('div'); document.body.appendChild(host); o.panel = {};
    const tile = (id) => { const b = host.querySelector('[data-rankid="' + id + '"]'); const blk = b && b.closest('.skl-rank'); const pc = blk && blk.querySelector('.skl-rank-pct'); return pc ? pc.textContent.trim() : null; };
    for (const [k, r] of [['mage1', 1], ['mage5', 5], ['mage10', 10]]) { player.skillRanks.magicBolt = r; player.skillRankPoints = 5; host.innerHTML = ''; renderSkillsReference(host); o.panel[k] = tile('magicBolt'); }
    player.skillRanks.magicBolt = 0; host.remove(); player.cls = origCls; } catch (e) { o.panel = { err: String(e.message).slice(0, 120) }; player.cls = origCls; }
  o.cap = SKILL_RANK_CAP;
  o.per = (typeof LX_BASIC_ATK_RANK_PER !== 'undefined') ? LX_BASIC_ATK_RANK_PER : null;
  return o;
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 190) });
const pct = (v) => `+${Math.round((v - 1) * 100)}%`;
const near = (a, b) => Math.abs(a - b) < 0.0005;

console.log('  rank 1 / 5 / 10 multiplier, read through the tag each hit carries:');
for (const k of ['warrior', 'rogue', 'archer', 'mage']) {
  const c = R[k];
  console.log(`    ${k.padEnd(8)} ${pct(c.r1).padStart(5)} ${pct(c.r5).padStart(6)} ${pct(c.r10).padStart(6)}`);
}

ok('the basic-attack rank is 2% a point', R.per === 0.02, 'LX_BASIC_ATK_RANK_PER = ' + R.per);
for (const k of ['warrior', 'rogue', 'archer', 'mage']) {
  ok(`${k}: rank 10 basic attack is exactly +20%`, near(R[k].r10, 1.20),
     `${pct(R[k].r10)} (was ${(k === 'archer' || k === 'mage') ? '+70%' : '+0% — the rank did nothing'})`);
  ok(`${k}: it scales 2% a rank on the way up`, near(R[k].r1, 1.02) && near(R[k].r5, 1.10),
     `rank 1 ${pct(R[k].r1)}, rank 5 ${pct(R[k].r5)}`);
}
ok('the Skills panel tile for the mage\'s Magic Bolt reads +2% at rank 1, +10% at rank 5 and +20% MAX at rank 10', R.panel && R.panel.mage1 === '+2%' && R.panel.mage5 === '+10%' && R.panel.mage10 === '+20% MAX', JSON.stringify(R.panel));
ok('nothing is paid past the rank cap', near(R.warriorOverCap, 1.20),
   `rank 99 still ${pct(R.warriorOverCap)} (cap ${R.cap})`);
ok('RP can still be spent on the basic attack',
   !R.rpBlocked.slash && !R.rpBlocked.stab && !R.rpBlocked.arrowShot && !R.rpBlocked.magicBolt,
   'per the clarification, the investment stays and only its value changed');

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
