// SOLVER — re-derive _DMG_BAND_TABLE so hits-to-die falls MONOTONICALLY with
// level. Binary-searches each anchor against the LIVE mitigation chain (pierce
// -> flat DEF -> class DR -> absorb curve -> difficulty punish) exactly as the
// table's own comment says it was originally solved; that solve has since gone
// stale against the current gear/DEF numbers.
//
// Solved against the archer/rogue/mage cluster median. Warriors are DESIGNED to
// land 1.3-1.6x above the target (their DR is on top), so including them would
// bias every anchor soft.
//
// Read-only: mutates the table in the page to probe, never writes the game file.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9018;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);

// Monotonic by construction: each step is ~0.9x the previous, floored at 3.0.
// 3 rather than the authored 1.8-2.0 because these are TRASH mobs — at 2 hits a
// single mistake inside a pack is death. Bosses keep their own harder bands.
const TARGET = [[1,12],[5,11],[10,10],[15,9.2],[20,8.5],[30,7.2],[40,6.2],
                [50,5.4],[60,4.7],[70,4.1],[80,3.6],[90,3.2],[100,3.0]];

const OUT = await page.evaluate(async (TARGET) => {
  for (const id of ['class-select-modal','advancement-modal','tutorial-modal','loading-overlay',
                    'story-beat-overlay','boss-intro-overlay','dialog']) {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  }
  loadMap('forest'); game.paused = false;
  const shopTier = (lv) => lv >= 90 ? 10 : lv >= 80 ? 9 : lv >= 70 ? 8 : lv >= 60 ? 7
                         : lv >= 50 ? 6 : lv >= 30 ? 4 : lv >= 10 ? 3 : lv >= 6 ? 2 : 1;
  const pickGear = (cat, cls, lv) => {
    const cap = shopTier(lv);
    const pool = ITEM_POOL[cat].filter(it => !it.setId && (it.tier | 0) <= cap &&
                                             (!it.cls || it.cls === 'any' || it.cls === cls));
    if (!pool.length) return null;
    const top = Math.max(...pool.map(p => p.tier | 0));
    const best = pool.filter(it => (it.tier | 0) === top);
    const mine = best.filter(it => it.cls === cls);
    const chosen = (mine.length ? mine : best).sort((a, b) => itemScore(b) - itemScore(a))[0];
    return { ...chosen, slot: _catToSlot(cat) };
  };
  const modKeys = Object.keys(player.mods || {});
  const buildChar = (cls, lv) => {
    const S = CLASSES[cls].stats;
    player.cls = cls; player.level = 1;
    player.maxHp = S.hp; player.maxMp = S.mp;
    player.baseAtk = S.atk; player.baseDef = S.def; player.baseAcc = 0;
    player.job = null; player.master = null; player.milestones = [];
    player.talents = {}; player.skillPoints = 0; player.skillRanks = {};
    player.mods = {}; for (const k of modKeys) player.mods[k] = 0;
    player.buffs = {}; player.prestige = null;
    player.tree = player.tree || {}; for (const k in player.tree) player.tree[k] = 0;
    player._aegis = 0; player._secondWindExpiry = 0; player.blockTimer = 0;
    player._dashEvadeUntil = 0; player.parryWindow = 0;
    player.equipped = { weapon: null, armor: null, accessory: null };
    player._equipBonusCache = null;
    devSetLevel(lv);
    for (const cat of ['weapons', 'armors', 'accessories']) {
      const g = pickGear(cat, cls, lv); if (g) player.equipped[g.slot] = g;
    }
    player._equipBonusCache = null;
    if (typeof refreshGearCache === 'function') refreshGearCache();
    player.hp = getMaxHp();
  };
  // "a typical at-level geared character" = a median-ATK mob of that level,
  // which is what the band is defined against (per-mob ATK varies INSIDE it).
  const hitsFor = (cls, lv, samples) => {
    game.monsters.length = 0; game.projectiles.length = 0; game.hazards.length = 0;
    const m = spawnMonster(600, 300, 'slime', false);
    if (!m) return null;
    m.level = lv; m.atk = _medAtkAtLv(lv); m.aggroTarget = player;
    m.maxHp = 1e9; m.currentHp = 1e9;
    if (game.camera) { game.camera.x = Math.max(0, m.x - 400); game.camera.y = 0; }
    const hp = getMaxHp(), hits = [];
    for (let s = 0; s < samples; s++) {
      player.hp = hp; player.mp = getMaxMp();
      player.invulnerable = 0; player.parryWindow = 0;
      for (let f = 0; f < 200; f++) {
        game.time++;
        player.x = m.x; player.y = m.y; player.vx = 0; player.vy = 0;
        m.facing = ((player.x + player.w/2) >= (m.x + m.w/2)) ? 1 : -1;
        m.freezeTimer = 0; m.stunTimer = 0;
        updateMonsters(16.667); updatePlayer(16.667);
        if (player.hp !== hp) { hits.push(hp - player.hp); break; }
      }
    }
    if (!hits.length) return null;
    hits.sort((a, b) => a - b);
    return hp / hits[hits.length >> 1];
  };
  // cluster median across the three non-warrior classes
  const clusterHits = (lv) => {
    const v = [];
    for (const c of ['archer', 'rogue', 'mage']) { buildChar(c, lv); const h = hitsFor(c, lv, 3); if (h) v.push(h); }
    if (!v.length) return null;
    v.sort((a, b) => a - b);
    return v[v.length >> 1];
  };

  const idxOf = (lv) => _DMG_BAND_TABLE.findIndex(r => r[0] === lv);
  const original = _DMG_BAND_TABLE.map(r => [r[0], r[1]]);
  const solved = [];
  for (const [lv, want] of TARGET) {
    const i = idxOf(lv);
    if (i < 0) { solved.push({ lv, want, err: 'no anchor' }); continue; }
    let lo = 0.01, hi = 12.0, best = null;
    for (let it = 0; it < 11; it++) {
      const mid = (lo + hi) / 2;
      _DMG_BAND_TABLE[i][1] = mid;
      const h = clusterHits(lv);
      if (h == null) break;
      if (best === null || Math.abs(h - want) < Math.abs(best.h - want)) best = { p: mid, h };
      if (h > want) lo = mid; else hi = mid;    // more damage -> fewer hits
    }
    _DMG_BAND_TABLE[i][1] = original[i][1];      // restore before next anchor
    if (best) solved.push({ lv, want, p: +best.p.toFixed(3), got: +best.h.toFixed(2), was: original[i][1] });
  }
  // warrior check at the solved values (design says 1.3-1.6x above cluster)
  const warriorCheck = [];
  for (const s of solved) {
    if (s.p == null) continue;
    const i = idxOf(s.lv); _DMG_BAND_TABLE[i][1] = s.p;
  }
  for (const lv of [20, 50, 80]) {
    buildChar('warrior', lv);
    const w = hitsFor('warrior', lv, 3);
    const c = clusterHits(lv);
    warriorCheck.push({ lv, warrior: +w.toFixed(1), cluster: +c.toFixed(1), ratio: +(w / c).toFixed(2) });
  }
  for (const r of original) { const i = idxOf(r[0]); if (i >= 0) _DMG_BAND_TABLE[i][1] = r[1]; }
  return { solved, warriorCheck };
}, TARGET);

writeFileSync(path.join(ROOT, 'scripts', 'solve_dmg_band.json'), JSON.stringify(OUT, null, 1));
console.log('lv   target   solved-p    was     x change   measured');
for (const s of OUT.solved) {
  if (s.p == null) { console.log(`${s.lv}  ${s.err}`); continue; }
  console.log(`${String(s.lv).padStart(3)}  ${String(s.want).padStart(6)}   ${String(s.p).padStart(7)}  ` +
    `${String(s.was).padStart(6)}   ${(s.p / s.was).toFixed(2)}x      ${s.got}`);
}
console.log('\nwarrior vs cluster at solved values (design target 1.3-1.6x):');
for (const w of OUT.warriorCheck) console.log(`  Lv ${w.lv}: warrior ${w.warrior} / cluster ${w.cluster} = ${w.ratio}x`);
console.log('\npageerrors:', errs.length, errs.slice(0, 3));
await browser.close(); server.kill();
