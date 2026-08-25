#!/usr/bin/env node
// Measures the Lv 40-52 band the way a player meets it, through the real
// hitMonster pipeline, with a properly levelled character whose SP is spent.
//
// Two traps this exists to avoid, both of which produced wrong numbers first
// time round:
//   - assigning player.level applies NO stat growth (a "Lv 45" warrior measured
//     ATK 13 / HP 195), so it levels through _maybeLevelUp;
//   - the skill tree absorbs only ~11 SP. The other ~140 go through the trainer
//     (1 SP -> +1 ATK, 2 SP -> +1 DEF, 1 SP -> +10 HP), and that nearly doubles
//     attack. A character with unspent SP is not the one anyone fights bosses
//     with.
//
//   node scripts/monster_difficulty_check.mjs [file.html] [--level=45]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'mojiworld_game.html';
const LV = +((process.argv.find((a) => a.startsWith('--level=')) || '').split('=')[1] || 45);
const URL = 'file:///' + path.join(ROOT, FILE).split(path.sep).join('/');

const browser = await chromium.launch({ channel: 'msedge', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof hitMonster === 'function', { timeout: 90000 });

const out = await page.evaluate(async ({ LV }) => {
  window._lxBootGateDone = true;
  try { const bo = document.getElementById('loading-overlay'); if (bo) bo.remove(); } catch (e) {}
  try { await Promise.race([window._lxNpcSpritesReady || Promise.resolve(), new Promise((r) => setTimeout(r, 20000))]); } catch (e) {}
  loadMap('forest');
  game.paused = false;

  player.cls = 'warrior';
  player.level = 1; player.exp = 0; player.skillPoints = 0;
  player.treeUnlocked = {}; player.tree = {}; player.mods = player.mods || {};
  player._god = true;
  let g = 0;
  while (player.level < LV && g++ < 500) {
    player.exp += (player.expToNext || 1);
    try { _maybeLevelUp(); } catch (e) { break; }
  }
  const tree = (typeof SKILL_TREE !== 'undefined' && SKILL_TREE[player.cls]) || [];
  for (let pass = 0; pass < 60; pass++) {
    const avail = tree.filter((n) => { try { return canUnlock(n); } catch (e) { return false; } })
                      .sort((a, b) => a.cost - b.cost);
    if (!avail.length) break;
    try { if (!unlockTreeNode(avail[0])) break; } catch (e) { break; }
  }
  player.baseAtk += player.skillPoints; player.skillPoints = 0;   // min-maxed for damage
  try { if (typeof refreshGearCache === 'function') refreshGearCache(); } catch (e) {}
  game._mxT = -1;
  const atk = getAtk(), maxHp = getMaxHp(), def = (typeof getDef === 'function') ? getDef() : 0;
  player.hp = maxHp;

  const T = window.LX_MONSTER_STATS || {};
  const BOSSES = ['young_confused_barnaby', 'sundered_smith', 'kingKrook', 'octobaby'];
  const band = Object.keys(T).filter((k) => T[k].lv >= 40 && T[k].lv <= 52 && !/^octoLeg/.test(k));
  const rows = [];
  for (const key of band) {
    const st = T[key];
    for (const q of (game.monsters || [])) q.currentHp = 0;
    game.monsters.length = 0;
    let m = null;
    try { spawnMonster(700, 300, key, false, false); m = game.monsters[game.monsters.length - 1]; } catch (e) {}
    if (!m) continue;
    m.maxHp = m.currentHp = 1e12;
    let dealt = 0;
    for (let i = 0; i < 40; i++) {
      const b4 = m.currentHp;
      try { hitMonster(m, Math.floor(atk), false, 'melee'); } catch (e) {}
      dealt += (b4 - m.currentHp);
    }
    const perHit = dealt / 40;
    const K = 300;
    const itDeals = Math.max(1, Math.round(st.atk * (K / (def + K))));
    rows.push({ key, lv: st.lv, hp: st.hp, def: st.def, atk: st.atk,
                boss: BOSSES.includes(key), perHit: Math.round(perHit),
                hits: perHit > 0 ? Math.ceil(st.hp / perHit) : Infinity,
                itDeals, youLast: Math.ceil(maxHp / itDeals) });
  }
  return { pAtk: Math.round(atk), pHp: Math.round(maxHp), pDef: Math.round(def), rows };
}, { LV });
await browser.close();

console.log('\n  ' + FILE + '   PLAYER Lv ' + LV + '   ATK ' + out.pAtk +
            ' · HP ' + out.pHp.toLocaleString() + ' · DEF ' + out.pDef + '  (warrior, all SP in ATK, no gear)\n');
const head = '  ' + 'monster'.padEnd(28) + 'lv'.padStart(4) + 'hp'.padStart(11) + 'def'.padStart(6) +
             'atk'.padStart(7) + 'youHitFor'.padStart(11) + 'hits'.padStart(7) + 'itHitsFor'.padStart(11) + 'youLast'.padStart(9);
const show = (l) => { for (const r of l) console.log('  ' + r.key.padEnd(28) + String(r.lv).padStart(4) +
    r.hp.toLocaleString().padStart(11) + String(r.def).padStart(6) + String(r.atk).padStart(7) +
    r.perHit.toLocaleString().padStart(11) + String(r.hits).padStart(7) +
    r.itDeals.toLocaleString().padStart(11) + String(r.youLast).padStart(9)); };
console.log(head);
console.log('  --- BOSSES ---');
show(out.rows.filter((r) => r.boss).sort((a, b) => a.lv - b.lv));
console.log('  --- toughest trash in the same band ---');
show(out.rows.filter((r) => !r.boss).sort((a, b) => b.def - a.def).slice(0, 6));

const bosses = out.rows.filter((r) => r.boss);
const trash = out.rows.filter((r) => !r.boss);
const avg = (a, f) => a.length ? a.reduce((s, x) => s + f(x), 0) / a.length : 0;
console.log('\n  boss DEF avg ' + Math.round(avg(bosses, (r) => r.def)) +
            '   vs toughest trash DEF ' + Math.max(...trash.map((r) => r.def)));
console.log('  boss hits-you-for avg ' + Math.round(avg(bosses, (r) => r.itDeals)) +
            '   vs hardest-hitting trash ' + Math.max(...trash.map((r) => r.itDeals)));
console.log('  you hit bosses for avg ' + Math.round(avg(bosses, (r) => r.perHit)) +
            '   vs toughest trash ' + Math.min(...trash.map((r) => r.perHit)));
