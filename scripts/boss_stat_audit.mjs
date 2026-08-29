// Do bosses actually out-stat the monsters around them? Measure, per tier.
// ============================================================================
// Per user: bosses must have considerably higher ATK and significantly higher
// HP and DEF than the normal monsters around them.
//
// The comparison must use EFFECTIVE SPAWNED stats, not the raw type lines:
// normal mobs get level scaling at spawn (_hpAtkLvExp x _hpAtkLinLv, with the
// v0.26.388 ATK softener) that bosses deliberately skip (isBoss => x1). So a
// boss that looks 10x on paper can be far closer on a high-level map. This
// probe spawns every map's mobs ON THAT MAP through the real spawnMonster and
// every boss through the same call, reads the instances' hp/atk/def, and
// reports each boss against the strongest effective mob at its own tier
// (maps whose levelReq is at or below the boss's declared level, taking the
// nearest tier).
// Run: node scripts/boss_stat_audit.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11121);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));

const reach = async (page) => {
  const click = async (sel, ms) => {
    const el = await page.$(sel);
    if (!el || !(await el.isVisible().catch(() => false))) return false;
    try { await el.click({ timeout: ms || 2500 }); return true; } catch (e) { return false; }
  };
  await click('#menu-newgame', 8000); await page.waitForTimeout(1500);
  await click('#auth-submit', 8000);  await page.waitForTimeout(2500);
  for (let i = 0; i < 8; i++) {
    const ready = await page.evaluate(() => {
      const o = document.getElementById('class-options');
      return !!(o && o.firstElementChild && o.firstElementChild.getBoundingClientRect().width > 40);
    });
    if (ready) break;
    if (!(await click('#cs-nav-next'))) break;
    await page.waitForTimeout(1000);
  }
  await page.evaluate(() => {
    const o = document.getElementById('class-options');
    if (o && o.firstElementChild) o.firstElementChild.click();
  });
  for (let i = 0; i < 45; i++) {
    for (const sel of ['#plg-dagger-skip', '#plg-skip', '#boss-intro-skip', '#tut-skip']) await click(sel, 1200);
    await page.keyboard.press('Enter').catch(() => {});
    await page.waitForTimeout(2000);
    const st = await page.evaluate(() => ({ p: (typeof game !== 'undefined') ? game.paused : null, pro: !!window._prologueActive }));
    if (st.p === false && !st.pro) return true;
  }
  return false;
};

const b = await chromium.launch({ channel: 'msedge', headless: true });
const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(12000);
if (!(await reach(page))) { console.log('never got control'); await b.close(); server.kill(); process.exit(1); }

const R = await page.evaluate(async () => {
  const out = { mobs: [], bosses: [], errs: [] };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  game.paused = false; player._god = true;

  // ---- effective mob stats, per map, through the real spawner --------------
  const mapNames = Object.keys(MAPS);
  for (const mn of mapNames) {
    const md = MAPS[mn];
    if (!md || !Array.isArray(md.spawns) || !md.spawns.length) continue;
    try { loadMap(mn); game.paused = false; } catch (e) { out.errs.push(mn + ': ' + String(e.message).slice(0, 40)); continue; }
    await sleep(120);
    const types = [...new Set(md.spawns.map((s) => s.type).filter(Boolean))];
    for (const ty of types) {
      try {
        const m = spawnMonster(player.x + 200, player.y, ty, false);
        if (!m || m._suppressed || !m.type) continue;
        // Maps can list BOSSES as spawns (arenas, the sanctum, the apex).
        // Those are not "normal surrounding monsters" - excluding them here
        // keeps Gravitos from being tier 70's "strongest mob" and bosses
        // from being compared against themselves.
        if (monsterTypes[ty] && monsterTypes[ty].boss) { game.monsters.length = 0; continue; }
        out.mobs.push({ map: mn, lvl: md.levelReq | 0, type: ty,
          hp: Math.round(m.hp || m.currentHp || 0), atk: Math.round(m.atk || 0), def: Math.round(m.def || 0) });
      } catch (e) { out.errs.push(mn + '/' + ty + ': ' + String(e.message).slice(0, 40)); }
      game.monsters.length = 0;
    }
  }

  // ---- every boss, through the same call -----------------------------------
  const bossTypes = Object.entries(monsterTypes)
    .filter(([k, t]) => t && t.boss)
    .map(([k, t]) => ({ type: k, lvl: t.level | 0, superBoss: !!t.superBoss }));
  for (const bt of bossTypes) {
    try {
      const m = spawnMonster(player.x + 260, player.y, bt.type, true);
      if (!m || !m.type) { out.errs.push('boss ' + bt.type + ': no spawn'); continue; }
      out.bosses.push({ type: bt.type, lvl: bt.lvl, superBoss: bt.superBoss,
        hp: Math.round(m.hp || m.currentHp || 0), atk: Math.round(m.atk || 0), def: Math.round(m.def || 0) });
    } catch (e) { out.errs.push('boss ' + bt.type + ': ' + String(e.message).slice(0, 50)); }
    game.monsters.length = 0;
  }
  return out;
});
await b.close(); server.kill();

// ---- analysis: each boss vs the strongest effective mob at its tier ---------
const tiers = [...new Set(R.mobs.map((m) => m.lvl))].sort((a, b) => a - b);
// Nearest tier by distance, not at-or-below: King (lv10) fights beside the
// lv12 ancient-ruins mobs, not the lv3 meadow ones.
const tierOf = (lvl) => tiers.reduce((a, t) => Math.abs(t - lvl) < Math.abs(a - lvl) ? t : a, tiers[0]);
for (const t of [...new Set(R.mobs.map((m) => m.lvl))].sort((a, b) => a - b)) {
  const pool = R.mobs.filter((m) => m.lvl === t);
  const top = (k) => pool.reduce((a, m) => m[k] > a[k] ? m : a, pool[0]);
  console.log("tier " + String(t).padStart(3) + "  maxHP " + top("hp").hp + "(" + top("hp").type + ")  maxATK " + top("atk").atk + "(" + top("atk").type + ")  maxDEF " + top("def").def + "(" + top("def").type + ")");
}
console.log(`mobs measured: ${R.mobs.length} across ${tiers.length} tiers (${tiers.join(',')})   bosses: ${R.bosses.length}`);
if (R.errs.length) console.log('errs: ' + R.errs.slice(0, 8).join(' | '));
console.log('\nboss'.padEnd(21) + 'lv   tier  bossHP/ATK/DEF          strongest tier mob (hp/atk/def)     ratios hp/atk/def');
const rows = [];
for (const bo of R.bosses.sort((a, b) => a.lvl - b.lvl)) {
  const t = tierOf(bo.lvl || 1);
  const pool = R.mobs.filter((m) => m.lvl === t);
  if (!pool.length) continue;
  const maxHp = Math.max(...pool.map((m) => m.hp));
  const maxAtk = Math.max(...pool.map((m) => m.atk));
  const maxDef = Math.max(...pool.map((m) => m.def));
  const rh = maxHp ? bo.hp / maxHp : Infinity;
  const ra = maxAtk ? bo.atk / maxAtk : Infinity;
  const rd = maxDef ? bo.def / maxDef : (bo.def > 0 ? Infinity : 1);
  rows.push({ ...bo, tier: t, maxHp, maxAtk, maxDef, rh, ra, rd });
  const flag = (rh < 8 ? ' HP!' : '') + (ra < 1.5 ? ' ATK!' : '') + (rd < 1.5 ? ' DEF!' : '');
  console.log(bo.type.padEnd(21) + String(bo.lvl).padEnd(5) + String(t).padEnd(6)
    + `${bo.hp}/${bo.atk}/${bo.def}`.padEnd(24)
    + `${maxHp}/${maxAtk}/${maxDef}`.padEnd(36)
    + `${rh.toFixed(1)}x / ${ra.toFixed(2)}x / ${rd.toFixed(2)}x${flag}`);
}
