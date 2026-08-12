// Fine sweep of the survivability curve Ã¢â‚¬â€ every 5 levels, tankiest (warrior)
// and squishiest (mage), to locate the troughs the 10-level matrix implies.
// Shares the exact harness of survivability_matrix.mjs (game's own devSetLevel,
// the shop's tier ladder, live updateMonsters contact sampling).
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9012;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);

const OUT = await page.evaluate(async () => {
  for (const id of ['class-select-modal','advancement-modal','tutorial-modal','loading-overlay',
                    'story-beat-overlay','boss-intro-overlay','dialog']) {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  }
  loadMap('forest'); game.paused = false;

  // what normal mobs actually exist at the top of the ladder?
  const lvls = Object.values(MOB_NATURAL_LEVEL);
  const roster = {
    maxNatural: Math.max(...lvls),
    above80: Object.keys(MOB_NATURAL_LEVEL).filter(t => MOB_NATURAL_LEVEL[t] > 80),
    nonBossAbove80: Object.keys(MOB_NATURAL_LEVEL)
      .filter(t => MOB_NATURAL_LEVEL[t] > 80 && monsterTypes[t] && !monsterTypes[t].boss),
    count: lvls.length,
  };

  const shopTier = (lv) => lv >= 88 ? 10 : lv >= 78 ? 9 : lv >= 68 ? 8 : lv >= 55 ? 7
                         : lv >= 40 ? 6 : lv >= 20 ? 4 : lv >= 10 ? 3 : lv >= 6 ? 2 : 1;
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
    player._secondWindExpiry = 0; player._dashEvadeUntil = 0; player.parryWindow = 0;
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
  // For a fine sweep, pin ONE representative mob and re-level it to L, so the
  // curve isn't confounded by which creatures happen to sit at each level.
  // (The matrix run uses real per-level rosters; this isolates level itself.)
  const sample = (lv, n) => {
    game.monsters.length = 0; game.projectiles.length = 0; game.hazards.length = 0;
    const m = spawnMonster(600, 300, 'slime', false);
    if (!m) return null;
    m.level = lv; m.aggroTarget = player;
    m.atk = _medAtkAtLv(lv);                     // exactly median-ATK for the level
    m.maxHp = 1e9; m.currentHp = 1e9;
    if (game.camera) { game.camera.x = Math.max(0, m.x - 400); game.camera.y = 0; }
    const hits = [];
    for (let s = 0; s < n; s++) {
      player.hp = getMaxHp(); player.invulnerable = 0; player.parryWindow = 0;
      const before = player.hp;
      for (let f = 0; f < 180; f++) {
        game.time++;
        player.x = m.x; player.y = m.y; player.vx = 0; player.vy = 0;
        m.facing = ((player.x + player.w / 2) >= (m.x + m.w / 2)) ? 1 : -1;
        m.freezeTimer = 0; m.stunTimer = 0;
        updateMonsters(16.667); updatePlayer(16.667);
        if (player.hp !== before) { hits.push(before - player.hp); break; }
      }
    }
    if (!hits.length) return null;
    hits.sort((a, b) => a - b);
    return hits[hits.length >> 1];
  };

  const rows = [];
  for (let lv = 10; lv <= 95; lv += 5) {
    for (const cls of ['warrior', 'mage']) {
      buildChar(cls, lv);
      const hp = getMaxHp(), def = getDef();
      const dmg = sample(lv, 5);
      if (dmg == null) continue;
      rows.push({ lv, cls, hp, def, tier: shopTier(lv), dmg, hits: +(hp / dmg).toFixed(1) });
    }
  }
  return { rows, roster };
});

writeFileSync(path.join(ROOT, 'scripts', 'survivability_sweep.json'), JSON.stringify(OUT, null, 1));
console.log('roster:', JSON.stringify(OUT.roster));
console.log('lv  cls      tier      HP     DEF    hit   hits-to-die');
for (const r of OUT.rows) {
  console.log(`${String(r.lv).padStart(2)}  ${r.cls.padEnd(8)} T${String(r.tier).padEnd(3)} ` +
    `${String(r.hp).padStart(7)} ${String(Math.round(r.def)).padStart(6)} ${String(r.dmg).padStart(6)}   ${r.hits}`);
}
console.log('pageerrors:', errs.length, errs.slice(0, 3));
await browser.close(); server.kill();
