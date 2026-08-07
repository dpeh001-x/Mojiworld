// SURVIVABILITY vs THE AUTHORED SPEC.
// =============================================================================
// mojiworld_game.html L34254-34259 states the intended curve explicitly:
//   Lv 1 -> ~9 hits to die   Lv 20 -> ~7   Lv 40 -> ~5   Lv 60 -> ~3   Lv 70+ -> ~2
//   "Warriors land ~1.3-1.6x above that (their DR is on top) - intended."
// This measures the real thing and compares.
//
// Honest same-level setup: every mob is left at its OWN authored natural level
// and the player is levelled to match, so no forced m.level distorts the
// _hot = atk / medianAtk(level) ratio that drives contact damage.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9016;
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

const OUT = await page.evaluate(async () => {
  for (const id of ['class-select-modal','advancement-modal','tutorial-modal','loading-overlay',
                    'story-beat-overlay','boss-intro-overlay','dialog']) {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  }
  loadMap('forest'); game.paused = false;

  // ── is the _hot outlier clamp actually rare, as its comment claims? ──────
  // "real mobs span ~x0.55-3.83 at Lv 20 and ~x0.77-1.26 at Lv 80, so the
  //  clamp almost never binds" (L34240 area). Measure it across the roster.
  const hotStats = [];
  for (const t of Object.keys(MOB_NATURAL_LEVEL)) {
    const mt = monsterTypes[t];
    if (!mt || mt.boss) continue;
    const lv = MOB_NATURAL_LEVEL[t];
    const med = _medAtkAtLv(lv);
    if (!(med > 0) || !(mt.atk > 0)) continue;
    hotStats.push({ t, lv, atk: mt.atk, raw: +(mt.atk / med).toFixed(2) });
  }
  const clampedHi = hotStats.filter(h => h.raw >= 3.0);
  const clampedLo = hotStats.filter(h => h.raw <= 0.30);

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
  // Mob stays at its OWN natural level; nothing about it is rewritten except
  // an HP pool large enough to survive sampling.
  const sample = (type, n) => {
    game.monsters.length = 0; game.projectiles.length = 0; game.hazards.length = 0;
    const m = spawnMonster(600, 300, type, false);
    if (!m) return null;
    m.aggroTarget = player; m.maxHp = 1e9; m.currentHp = 1e9;
    if (game.camera) { game.camera.x = Math.max(0, m.x - 400); game.camera.y = 0; }
    const hits = [];
    for (let s = 0; s < n; s++) {
      player.hp = getMaxHp(); player.mp = getMaxMp();
      player.invulnerable = 0; player.parryWindow = 0;
      const before = player.hp;
      for (let f = 0; f < 200; f++) {
        game.time++;
        player.x = m.x; player.y = m.y; player.vx = 0; player.vy = 0;
        m.facing = ((player.x + player.w/2) >= (m.x + m.w/2)) ? 1 : -1;
        m.freezeTimer = 0; m.stunTimer = 0;
        updateMonsters(16.667); updatePlayer(16.667);
        if (player.hp !== before) { hits.push(before - player.hp); break; }
      }
    }
    if (!hits.length) return null;
    hits.sort((a, b) => a - b);
    return hits[hits.length >> 1];
  };

  // one representative band per 10-level interval, using REAL mobs at their level
  const byLevel = {};
  for (const h of hotStats) (byLevel[h.lv] = byLevel[h.lv] || []).push(h.t);
  const rows = [];
  for (const lv of [10, 20, 30, 40, 50, 60, 70, 80]) {
    // mobs whose natural level is exactly lv, else nearest available
    let types = byLevel[lv] || [];
    for (let w = 1; w <= 4 && types.length < 3; w++) {
      types = [];
      for (const k of Object.keys(byLevel)) if (Math.abs(+k - lv) <= w) types.push(...byLevel[k]);
    }
    types = types.slice(0, 5);
    if (!types.length) continue;
    for (const cls of ['warrior', 'archer', 'rogue', 'mage']) {
      buildChar(cls, lv);
      const hp = getMaxHp();
      const per = [];
      for (const t of types) { const d = sample(t, 5); if (d) per.push({ t, d }); }
      if (!per.length) continue;
      const ds = per.map(p => p.d).sort((a, b) => a - b);
      const med = ds[ds.length >> 1];
      rows.push({ lv, cls, hp, def: Math.round(getDef()), tier: shopTier(lv),
                  dmg: med, hits: +(hp / med).toFixed(1),
                  spread: `${ds[0]}-${ds[ds.length-1]}`,
                  mobs: per.map(p => `${p.t}:${p.d}`).join(' ') });
    }
  }
  return { rows, hot: { total: hotStats.length, clampedHi: clampedHi.length, clampedLo: clampedLo.length,
           hiList: clampedHi.slice(0, 14).map(h => `${h.t}(Lv${h.lv} x${h.raw})`),
           maxRaw: Math.max(...hotStats.map(h => h.raw)) } };
});

writeFileSync(path.join(ROOT, 'scripts', 'survivability_vs_spec.json'), JSON.stringify(OUT, null, 1));
const TARGET = { 10: 8, 20: 7, 30: 6, 40: 5, 50: 4, 60: 3, 70: 2, 80: 2 };
console.log(`_hot clamp: ${OUT.hot.clampedHi}/${OUT.hot.total} mobs pinned at the 3.0x ceiling, ` +
            `${OUT.hot.clampedLo} at the 0.30x floor; max raw ratio ${OUT.hot.maxRaw}`);
console.log('  clamped-high examples:', OUT.hot.hiList.join(' '));
console.log('\nlv  class     tier      HP     DEF     hit   hits   target   vs spec');
for (const r of OUT.rows) {
  const tgt = TARGET[r.lv] * (r.cls === 'warrior' ? 1.45 : 1);
  const ratio = (r.hits / tgt);
  console.log(`${String(r.lv).padStart(2)}  ${r.cls.padEnd(8)} T${String(r.tier).padEnd(3)} ` +
    `${String(r.hp).padStart(7)} ${String(r.def).padStart(6)} ${String(r.dmg).padStart(7)} ` +
    `${String(r.hits).padStart(6)} ${tgt.toFixed(1).padStart(7)}   ${ratio.toFixed(2)}x`);
}
console.log('\npageerrors:', errs.length, errs.slice(0, 3));
await browser.close(); server.kill();
