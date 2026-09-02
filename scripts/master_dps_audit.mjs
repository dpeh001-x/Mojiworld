#!/usr/bin/env node
// MASTER DPS AUDIT — what each Lv-50 master actually deals, measured.
// ============================================================================
// Per user: "hexmaster does too much damage, audit and nerf him". Grand Hex has
// been nerfed twice already by eye (v0.30.284, v0.30.330), so this measures
// instead: every master is put on the SAME pinned, invincible dummy with the
// same ATK, its X and B are cast on cooldown for a fixed window, and every
// point of damage that reaches the dummy is counted through hitMonster —
// direct hits, chains, splashes, ruptures and damage-over-time alike, because
// the Hexmaster's output is mostly none of it direct.
//
// The dummy is pinned and healed every frame so nothing dies and ends the
// window early, and each master runs the identical script, so the numbers are
// comparable even though none of them is a real fight.
//   node scripts/master_dps_audit.mjs [--secs N] [--json]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { existsSync } = require('node:fs');
const argv = process.argv.slice(2);
const SECS = Number((argv.find((a) => a.startsWith('--secs=')) || '--secs=14').split('=')[1]) || 14;
const AS_JSON = argv.includes('--json');
const ONLY = (argv.find((a) => a.startsWith('--only=')) || '').split('=')[1];
const PORT = Number(process.env.PORT || 9975);
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
let page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const boot = async () => {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`,
    { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof castSkill === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(6500);
  await page.evaluate(() => { window._lxBootGateDone = true; window._prologueActive = false; });
  await page.fill('#hero-name-input', 'DpsAudit').catch(() => {});
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
page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`,
  { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof game === 'object' && typeof castSkill === 'function'
  && typeof SKILLS === 'object', null, { timeout: 180000 });
await page.waitForTimeout(7000);
await page.evaluate(() => { window._lxBootGateDone = true; window._prologueActive = false; });
await page.fill('#hero-name-input', 'DpsAudit').catch(() => {});
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
await page.waitForTimeout(2500);
await page.evaluate(async () => { loadMap('forest', 300); await new Promise((r) => setTimeout(r, 1500)); });

const masters = await page.evaluate(() => {
  const byMaster = {};
  for (const id in SKILLS) {
    const s = SKILLS[id];
    if (!s || !s.master) continue;
    (byMaster[s.master] = byMaster[s.master] || { cls: s.cls, job: s.job, skills: [] }).skills.push({ id, slot: s.slot, cd: s.cd });
  }
  return byMaster;
});

const run = async (master, info, mobs) => page.evaluate(async ({ master, info, SECS, mobs }) => {
  game.paused = false;
  // Isolation is a PAGE RELOAD (see the boot helper below), not an in-page
  // scrub. The first draft tried deleting player state between runs and was
  // wrong twice over: it read Hexmaster at 16,226 DPS against 2,980 measured
  // alone (the surplus was previous masters' summons and DOTs landing in his
  // window), and the scrub itself deleted keys the hex and necro kits need, so
  // those masters vanished from the table entirely. A fresh page cannot leak.
  player.cls = info.cls; player.job = info.job; player.master = master;
  player.level = 50; player._god = true;
  player.baseAtk = 400; player.baseAcc = 900;
  player.mods = player.mods || {}; player.mods.critDmg = 0;
  player.crit = 0; player.baseCrit = 0;              // crit off: it is variance, not signal
  player.mp = 9e9; player.skillCooldowns = {};
  game.monsters = []; game.projectiles.length = 0; game.hazards.length = 0;
  const _t = (game.mapData.spawns.find((sp) => sp && sp.type && !sp.boss) || {}).type || Object.keys(monsterTypes)[0];
  const dummies = [];
  for (let k = 0; k < mobs; k++) {
    spawnMonster(player.x + 200 + k * 70, player.y, _t, false);
    const x = game.monsters[game.monsters.length - 1];
    if (x) { x.maxHp = x.currentHp = 9e12; x.def = 0; x.evasion = 0; x.invulnerable = 0; x._px = x.x; x._py = x.y; dummies.push(x); }
  }
  if (!dummies.length) return { master, err: 'no dummy' };
  const d = dummies[0];
  const dset = new Set(dummies);
  let dealt = 0;
  const orig = window.hitMonster;
  window.hitMonster = function (m, dmg, c, sk) {
    const before = m && m.currentHp;
    const r = orig.apply(this, arguments);
    if (dset.has(m) && typeof before === 'number') dealt += Math.max(0, before - m.currentHp);
    return r;
  };
  const frames = Math.round(SECS * 60);
  for (let i = 0; i < frames; i++) {
    await new Promise((r) => requestAnimationFrame(r));
    for (const x of dummies) { x.currentHp = x.maxHp; x.x = x._px; x.y = x._py; x.vx = 0; x.vy = 0; }   // pinned + immortal
    player.mp = 9e9; player.hp = getMaxHp();
    for (const sk of info.skills) {
      if (!(player.skillCooldowns[sk.id] > 0)) { try { castSkill(sk.id); } catch (e) {} }
    }
  }
  window.hitMonster = orig;
  game.monsters = [];
  return { master, dealt: Math.round(dealt), dps: Math.round(dealt / SECS), skills: info.skills.map((s) => s.id) };
}, { master, info, SECS, mobs });

const out = [];
const wanted = Object.keys(masters).filter((m) => !ONLY || ONLY.split(',').includes(m));
for (const m of wanted) {
  const row = { master: m };
  for (const [label, mobs] of [['solo', 1], ['crowd', 8]]) {
    try { await boot(); const r = await run(m, masters[m], mobs); row[label] = r.err ? null : r.dps; }
    catch (e) { row[label] = null; }
  }
  out.push(row);
  console.error(`  measured ${m}: solo ${row.solo}, crowd ${row.crowd}`);
}
await browser.close(); server.kill();

const good = out.filter((r) => (r.solo > 0 || r.crowd > 0)).sort((a, b) => (b.crowd || 0) - (a.crowd || 0));
if (AS_JSON) { console.log(JSON.stringify({ secs: SECS, results: good }, null, 1)); process.exit(0); }
const medOf = (k) => { const v = good.map((r) => r[k] || 0).filter((x) => x > 0).sort((a, b) => a - b); return v[Math.floor(v.length / 2)] || 1; };
const medSolo = medOf('solo'), medCrowd = medOf('crowd');
console.log(`\nMASTER DPS AUDIT — ${SECS}s on a pinned immortal dummy, Lv 50, ATK 400, crit off, DEF 0`);
console.log('All damage reaching the dummy is counted (direct, chain, splash, rupture, DOT).\n');
console.log('   SOLO dps  xmed  |  CROWD(8) dps  xmed   master');
console.log('  ---------  ----  |  ------------  ----   ----------------');
for (const r of good) {
  const xs = r.solo ? (r.solo / medSolo) : 0;
  const xc = r.crowd ? (r.crowd / medCrowd) : 0;
  const flag = (xc >= 2 || xs >= 2) ? '  <<< OUTLIER' : '';
  console.log('  ' + String(r.solo || '-').padStart(9) + '  ' + (xs ? xs.toFixed(2) : '-').padStart(4) + '  |  '
    + String(r.crowd || '-').padStart(12) + '  ' + (xc ? xc.toFixed(2) : '-').padStart(4) + '   ' + r.master + flag);
}
console.log(`\nmedians: solo ${medSolo}, crowd ${medCrowd} DPS across ${good.length} masters`
  + (errs.length ? `; page errors: ${errs.slice(0, 2)}` : ''));
