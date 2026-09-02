#!/usr/bin/env node
// MASTER SKILL AUDIT — every master skill, measured one cast at a time.
// ============================================================================
// Per user: "check on other master classes if they have any anomalous skills
// that does way too much damage".
//
// The per-MASTER audit (master_dps_audit.mjs) answers "is this class too
// strong". It cannot answer "which button is wrong", because it spams a whole
// kit on cooldown and reports one number. This one casts ONE skill, once, then
// watches for eight seconds so delayed pulses, summons, hazards and DOTs all
// land inside the window, and attributes every point to that cast.
//
// The headline number is not damage. It is DAMAGE PER SECOND OF COOLDOWN:
//   sustained = damage-per-cast / (cooldown in seconds)
// A 50s ultimate hitting for 30x ATK is the genre working as intended; a 6s
// skill hitting for the same is a balance fault. Ranking raw damage would put
// every ultimate at the top and tell you nothing.
//
// ISOLATION is a page reload per MASTER, and residue is measured rather than
// assumed: after each skill's window the harness clears the field and watches a
// further second with no casts at all. That residue is reported per skill, so a
// number inflated by the previous skill's leftovers is visible instead of
// silently believed — an earlier draft of the per-master audit was wrong in
// exactly this way and read Hexmaster at 5x its true output.
//
//   node scripts/master_skill_audit.mjs [--secs N] [--mobs N] [--only a,b] [--json]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { existsSync } = require('node:fs');
const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const SECS = Number(arg('secs', 8)) || 8;
const MOBS = Number(arg('mobs', 6)) || 6;
const ONLY = arg('only', '');
const AS_JSON = argv.includes('--json');
const PORT = Number(process.env.PORT || 9966);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const EXE = [process.env.PW_EXE, process.env.MOJI_PW_EXE,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));
const browser = await chromium.launch({
  channel: EXE ? undefined : 'msedge', executablePath: EXE || undefined,
  headless: true, args: ['--no-sandbox', '--mute-audio'],
});
const errs = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
const URL = `http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`;
const boot = async () => {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof castSkill === 'function'
    && typeof SKILLS === 'object', null, { timeout: 180000 });
  await page.waitForTimeout(6500);
  await page.evaluate(() => { window._lxBootGateDone = true; window._prologueActive = false; });
  await page.fill('#hero-name-input', 'SkillAudit').catch(() => {});
  await page.evaluate(() => {
    const m = document.getElementById('class-select-modal');
    if (!m) return;
    for (const el of m.querySelectorAll('button,div,li')) {
      if (el.children.length > 3) continue;
      if (getComputedStyle(el).display === 'none') continue;
      if (/^\s*mage\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
    }
  });
  await page.click('#cs-nav-next').catch(() => {});
  await page.waitForTimeout(2200);
  await page.evaluate(async () => { loadMap('forest', 300); await new Promise((r) => setTimeout(r, 1400)); });
};

await boot();
const masters = await page.evaluate(() => {
  const by = {};
  for (const id in SKILLS) {
    const s = SKILLS[id];
    if (!s || !s.master) continue;
    (by[s.master] = by[s.master] || { cls: s.cls, job: s.job, skills: [] })
      .skills.push({ id, name: s.name, slot: s.slot, cd: s.cd, mp: s.mp });
  }
  return by;
});

const runMaster = async (master, info) => page.evaluate(async ({ master, info, SECS, MOBS }) => {
  const sleepF = async (n) => { for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r)); };
  const wipe = () => {
    game.monsters = [];
    game.projectiles.length = 0; game.hazards.length = 0;
    if (Array.isArray(game.minions)) game.minions.length = 0;
    game.particles.length = 0;
    player.buffs = {}; player.skillCooldowns = {};
    player.hp = getMaxHp(); player.mp = 9e9;
  };
  game.paused = false;
  player.cls = info.cls; player.job = info.job; player.master = master;
  player.level = 50; player._god = true;
  player.baseAtk = 400; player.baseAcc = 900;
  player.mods = player.mods || {}; player.mods.critDmg = 0;
  player.crit = 0; player.baseCrit = 0;
  const t = (game.mapData.spawns.find((sp) => sp && sp.type && !sp.boss) || {}).type
    || Object.keys(monsterTypes)[0];

  const measure = async (castId, frames) => {
    wipe();
    const ds = [];
    for (let k = 0; k < MOBS; k++) {
      spawnMonster(player.x + 190 + k * 66, player.y, t, false);
      const x = game.monsters[game.monsters.length - 1];
      if (x) { x.maxHp = x.currentHp = 9e12; x.def = 0; x.evasion = 0; x.invulnerable = 0; x._px = x.x; x._py = x.y; ds.push(x); }
    }
    const dset = new Set(ds);
    let dealt = 0; const by = {};
    const orig = window.hitMonster;
    window.hitMonster = function (m, dmg, c, tag) {
      const b = m && m.currentHp; const r = orig.apply(this, arguments);
      if (dset.has(m) && typeof b === 'number') {
        const d = Math.max(0, b - m.currentHp); dealt += d;
        (by[tag || '(untagged)'] = by[tag || '(untagged)'] || 0);
        by[tag || '(untagged)'] += d;
      }
      return r;
    };
    let castErr = null;
    if (castId) { try { castSkill(castId); } catch (e) { castErr = String(e).slice(0, 90); } }
    for (let i = 0; i < frames; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      for (const x of ds) { x.currentHp = x.maxHp; x.x = x._px; x.y = x._py; x.vx = 0; x.vy = 0; }
      player.mp = 9e9; player.hp = getMaxHp();
    }
    window.hitMonster = orig;
    return { dealt: Math.round(dealt), castErr, by, atk: getAtk() };
  };

  const out = [];
  for (const sk of info.skills) {
    const r = await measure(sk.id, Math.round(SECS * 60));
    // residue: same window, nothing cast. Anything landing here is the previous
    // skill's leftovers, and it is reported rather than assumed to be zero.
    const res = await measure(null, 60);
    out.push({
      master, id: sk.id, name: sk.name, slot: sk.slot, cd: sk.cd,
      dealt: r.dealt, atk: r.atk, castErr: r.castErr, residue: res.dealt,
      by: Object.entries(r.by).sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([k, v]) => `${k} ${Math.round(v / r.dealt * 100)}%`).join(' '),
    });
    await sleepF(30);
  }
  wipe();
  return out;
}, { master, info, SECS, MOBS });

const rows = [];
const wanted = Object.keys(masters).filter((m) => !ONLY || ONLY.split(',').includes(m));
for (const m of wanted) {
  try { await boot(); rows.push(...await runMaster(m, masters[m])); }
  catch (e) { console.error(`  ${m}: ${String(e).slice(0, 110)}`); }
  console.error(`  measured ${m} (${rows.length} skills so far)`);
}
await browser.close(); server.kill();

for (const r of rows) {
  r.xatk = r.atk ? +(r.dealt / r.atk).toFixed(1) : 0;         // damage per cast, in ATK
  r.cds = (r.cd || 1000) / 1000;
  r.sust = +(r.xatk / r.cds).toFixed(2);                      // xATK per second of cooldown
}
if (AS_JSON) { console.log(JSON.stringify({ secs: SECS, mobs: MOBS, rows }, null, 1)); process.exit(0); }

const good = rows.filter((r) => r.dealt > 0).sort((a, b) => b.sust - a.sust);
const vals = good.map((r) => r.sust).sort((a, b) => a - b);
const med = vals[Math.floor(vals.length / 2)] || 1;
console.log(`\nMASTER SKILL AUDIT — one cast, ${SECS}s window, ${MOBS} pinned immortal dummies, Lv 50 ATK 400, crit off, DEF 0`);
console.log('Sustained = damage-per-cast (in xATK) divided by cooldown seconds. A big ultimate on a long');
console.log('cooldown is fine; the same damage on a short one is not. Median sustained is the yardstick.\n');
console.log('  xATK/cast   cd    SUSTAINED  xmed   skill                          sources');
console.log('  ---------  ----   ---------  ----   ---------------------------    -------');
for (const r of good) {
  const x = r.sust / med;
  const flag = x >= 3 ? '  <<< ANOMALY' : (x >= 2 ? '  <<< high' : '');
  console.log('  ' + String(r.xatk).padStart(9) + '  ' + (r.cds + 's').padStart(5) + '   '
    + String(r.sust).padStart(9) + '  ' + x.toFixed(2).padStart(5) + '   '
    + (r.master + '.' + r.slot).padEnd(30) + ' ' + r.by + flag);
}
const dead = rows.filter((r) => r.dealt === 0);
console.log(`\nmedian sustained ${med} xATK/s across ${good.length} skills`
  + (dead.length ? `; ${dead.length} dealt nothing in-window (${dead.map((d) => d.master + '.' + d.slot).join(', ')})` : '')
  + (rows.some((r) => r.residue > 0) ? `\nresidue seen: ${rows.filter((r) => r.residue > 0).map((r) => r.master + '.' + r.slot + '=' + r.residue).join(', ')}` : '\nresidue: zero on every skill — attribution is clean'));
if (errs.length) console.log('page errors: ' + errs.slice(0, 2).join(' · '));
