// Bastion of Dawn: the DAWN CHARGE and the Dawnbreak burst (replaces judgement_bastion_test.mjs and
// holyorb_sprite_test.mjs, which asserted the retired Judgement meter and its orb volley).
//
// Per user: "The mechanics of the skill can be made cleaner in terms of a stored damage charge then
// crazy burst the longer the time + the more damage taken" and "ensure no cut-offs of the sprite
// edges". Checked, through the real paths:
//   A. the bank: only while armed, only HP actually lost on a hit - never a heal, never a self-cost
//   B. the model: 6x at zero, 16x for a full hold, 40x with a full health bar taken as well
//   C. the burst: a full charge out-damages a panic release by the model's ratio, and reaches further
//   D. the support half survives: full heal, 15s party shield (20s at rank 10), cooldown at release
//   E. death voids the stance; the armed banner reads the charge
//   F. the art: every shipped frame decodes and has a clean (alpha 0) canvas border
//   node scripts/bastion_dawn_charge_test.mjs      (MOJI_GAME_FILE / ART_ROOT override)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const sharp = require('sharp');
const fs = require('node:fs');
const ART = process.env.ART_ROOT || ROOT;   // where the Sprites/ tree under test lives
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

// ---- F (static half): the shipped frames, measured on disk ---------------------------------------
const SETS = ['crusader_ult', 'bastion_aura', 'bastion_pillar'];
let worstBorder = 0, missing = [];
for (const k of SETS) for (const f of [`fx/${k}.webp`, ...Array.from({ length: 9 }, (_, i) => `fx/anim/${k}_${i}.webp`)]) {
  const p = path.join(ART, 'Sprites', f);
  if (!fs.existsSync(p)) { missing.push(f); continue; }
  const { data, info } = await sharp(p).ensureAlpha().extractChannel('alpha').raw().toBuffer({ resolveWithObject: true });
  let s = 0, n = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++)
    if (x < 3 || y < 3 || x >= info.width - 3 || y >= info.height - 3) { s += data[y * info.width + x]; n++; }
  worstBorder = Math.max(worstBorder, s / n);
}
ok('all 30 Bastion frames exist (3 sets x base + 9)', missing.length === 0, missing.join(', '));
ok('no frame is cut off: worst canvas-border alpha is 0', worstBorder <= 0.5, 'worst ' + worstBorder.toFixed(2));

// ---- boot -----------------------------------------------------------------------------------------
const net = await import('node:net');
const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.env.PORT; for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: process.env });
await new Promise((r) => setTimeout(r, 2000));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const ctx = await b.newContext({ serviceWorkers: 'block' });   // the SW would answer art from its own cache
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
if (ART !== ROOT) {   // serve the art under test, and the frame index that knows about it
  await page.route(/\/Sprites\/fx\/(anim\/)?(crusader_ult|bastion_aura|bastion_pillar)[_0-9]*\.webp/, (r) => {
    const rel = new URL(r.request().url()).pathname.replace(/^\//, '');
    const p = path.join(ART, rel);
    return fs.existsSync(p) ? r.fulfill({ status: 200, contentType: 'image/webp', body: fs.readFileSync(p) }) : r.continue();
  });
  const sfi = path.join(ART, 'data', 'sprite_frame_index.js');
  if (fs.existsSync(sfi)) await page.route('**/data/sprite_frame_index.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(sfi) }));
}
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof SKILL_FNS === 'object' && typeof updatePlayer === 'function' && typeof loadMap === 'function', null, { timeout: 180000 });
await page.evaluate(() => {
  try { _lxBootGateDone = true; window._prologueActive = false; window._prologuePending = false; if (typeof _prologueFinish === 'function') _prologueFinish(true); } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.setProperty('display', 'none', 'important'); }
  document.querySelectorAll('[id^="story-beat"], #lo-stack, #tutorial-modal').forEach((e) => e.remove());
  try { window.showToast = function () {}; } catch (e) {}
  player.cls = 'warrior'; player.job = 'knight'; player.master = 'crusader'; player.level = 60;
  loadMap('forest', 300); game.paused = false;
});
await page.waitForTimeout(2500);

const r = await page.evaluate(async () => {
  const out = {};
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const frames = async (n) => { const t0 = game.time; for (let i = 0; i < 200 && game.time < t0 + n; i++) await wait(17); };
  window.rollCrit = () => false;            // crits would swamp the ratio being measured
  game.monsters.length = 0;
  player.invulnerable = 9e9; player.mp = 9999; player.skillCooldowns = {}; player.skillRanks = {};
  const mhp = getMaxHp();
  const hitFor = async (amount) => { player.hp = Math.max(1, player.hp - amount); player.lastHitTime = game.time; await frames(3); };

  // --- A. the bank ---------------------------------------------------------------------------
  player.hp = mhp; player._bastionArmedUntil = 0; player._dawnStored = 0;
  await hitFor(Math.round(mhp * 0.2));
  out.unarmedBank = +player._dawnStored || 0;                        // not armed: nothing banks
  player.hp = mhp; await frames(2);
  SKILL_FNS.crusader_ult();                                          // ARM
  out.armedOpen = (player._bastionArmedUntil | 0) > game.time && (player._dawnStored | 0) === 0;
  await hitFor(Math.round(mhp * 0.3));
  out.afterHit = Math.round(player._dawnStored || 0); out.expectHit = Math.round(mhp * 0.3);
  player.hp = Math.min(mhp, player.hp + Math.round(mhp * 0.25)); await frames(3);   // a heal - no hit stamp
  out.afterHeal = Math.round(player._dawnStored || 0);
  player.hp = Math.max(1, player.hp - Math.round(mhp * 0.1)); await frames(3);        // an HP COST - no hit stamp
  out.afterCost = Math.round(player._dawnStored || 0);
  out.banner = (typeof _playerControlState === 'function') ? (_playerControlState() || {}).detail : null;

  // the stance draws while armed
  let auraDraws = 0; const _di = ctx.drawImage;
  ctx.drawImage = function (img, ...a) { if (img && /bastion_aura_\d/.test(img.src || '')) auraDraws++; return _di.call(this, img, ...a); };
  for (let i = 0; i < 40 && !auraDraws; i++) await wait(100);
  ctx.drawImage = _di; out.auraDraws = auraDraws;

  // --- B. the model ----------------------------------------------------------------------------
  const at = (heldFr, stored) => { player._bastionArmAt = game.time - heldFr; player._dawnStored = stored; return _lxDawnCharge(); };
  out.model = { zero: at(0, 0).mul, hold: at(600, 0).mul, longer: at(1200, 0).mul, tank: at(0, mhp).mul, both: at(600, mhp).mul, overfull: at(600, mhp * 3).mul, fullC: at(600, mhp).c };

  // --- C. the burst ----------------------------------------------------------------------------
  const mk = (dx) => { const m = { x: player.x + dx, y: player.y, w: 40, h: 40, hp: 1e9, maxHp: 1e9, currentHp: 1e9, def: 0, type: 'slime', level: 1,
    speed: 0, facing: 1, vx: 0, vy: 0, _noGravity: true, name: 'dummy' }; game.monsters.push(m); return m; };
  const burst = async (heldFr, stored, viaCastSkill) => {
    game.monsters.length = 0;
    const near = mk(150), far = mk(450);
    player.skillCooldowns = {}; player._bastionArmedUntil = 0; player._bastionArmHeld = false;
    SKILL_FNS.crusader_ult();                                        // arm
    player._bastionArmAt = game.time - heldFr; player._dawnStored = stored;
    game.keys = {}; player._bastionArmHeld = false;
    const mul = _lxDawnCharge().mul;
    player.hp = Math.round(mhp * 0.35); player.buffs.aegisShield = 0; player.mp = 10;   // mp under cost: an armed release still fires
    if (viaCastSkill) castSkill('crusader_ult'); else SKILL_FNS.crusader_ult();
    const rel = { healed: player.hp === getMaxHp(), shield: (player.buffs.aegisShield | 0), cd: (player.skillCooldowns.crusader_ult | 0) > 0,
      disarmed: (player._bastionArmedUntil | 0) === 0, emptied: (player._dawnStored | 0) === 0 };
    await wait(1500);
    return { mul, near: Math.round(1e9 - near.currentHp), far: Math.round(1e9 - far.currentHp), ...rel };
  };
  out.low = await burst(0, 0, false);
  out.high = await burst(600, mhp, true);
  player.skillRanks = { crusader_ult: SKILL_RANK_CAP };
  out.r10 = await burst(600, mhp, false);
  out.r10bonus = getSkillLv10('crusader_ult');
  player.skillRanks = {};
  game.monsters.length = 0;

  // --- E. death voids the stance -------------------------------------------------------------------
  player.skillCooldowns = {}; player._bastionArmedUntil = 0; player._bastionArmHeld = false;
  SKILL_FNS.crusader_ult(); player._dawnStored = mhp * 0.5;
  player.invulnerable = 0; player.hp = 0; updatePlayer(16);
  out.death = { armed: (player._bastionArmedUntil | 0) > 0, stored: +player._dawnStored || 0 };
  out.desc = SKILLS.crusader_ult.desc;
  out.anim = ['crusader_ult', 'bastion_aura', 'bastion_pillar'].every((k) => _FX_ANIM_KEYS.has(k));
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log(JSON.stringify(r, null, 1));
ok('A. nothing banks while the bastion is not armed', r.unarmedBank === 0, r.unarmedBank);
ok('A. arming opens an EMPTY charge', r.armedOpen, '');
ok('A. a hit while armed banks the HP it cost', Math.abs(r.afterHit - r.expectHit) <= 2, `${r.afterHit} vs ${r.expectHit}`);
ok('A. a heal is never banked', r.afterHeal === r.afterHit, `${r.afterHit} -> ${r.afterHeal}`);
ok('A. HP lost without a hit (a skill cost) is never banked', r.afterCost === r.afterHit, `${r.afterHit} -> ${r.afterCost}`);
ok('A. the armed banner reads the charge', /Dawn \d+%/.test(r.banner || ''), r.banner);
ok('A. the rune ward draws under the paladin while armed', r.auraDraws > 0, r.auraDraws);
const M = r.model;
ok('B. 6x at zero, 16x for a full hold, 15x for a full health bar taken, 40x for both', M.zero === 6 && M.hold === 16 && M.tank === 15 && M.both === 40, JSON.stringify(M));
ok('B. both halves cap: holding past 10s or overfilling adds nothing', M.longer === 16 && M.overfull === 40 && Math.abs(M.fullC - 1) < 1e-9, JSON.stringify(M));
const ratio = r.high.near / Math.max(1, r.low.near), want = r.high.mul / r.low.mul;
ok('C. a full charge out-damages a panic release by the model ratio', Math.abs(ratio / want - 1) < 0.2, `damage x${ratio.toFixed(2)} vs model x${want.toFixed(2)} (${r.low.near} -> ${r.high.near})`);
ok('C. the charged burst reaches a foe at 450px; the panic release does not', r.high.far > 0 && r.low.far === 0, `low ${r.low.far}, high ${r.high.far}`);
ok('D. release (through castSkill, MP under cost): full heal, 15s shield, cooldown, stance and charge cleared',
  r.high.healed && r.high.shield === 15000 && r.high.cd && r.high.disarmed && r.high.emptied, JSON.stringify(r.high));
ok('D. rank 10: 20s shield and a x1.2 Dawnbreak', r.r10.shield === 20000 && r.r10bonus && r.r10bonus.burstMul === 1.2 && Math.abs(r.r10.near / r.high.near - 1.2) < 0.2, `shield ${r.r10.shield}, near ${r.high.near} -> ${r.r10.near}`);
ok('E. death voids the stance and everything it stored', !r.death.armed && r.death.stored === 0, JSON.stringify(r.death));
ok('the description teaches the charge', /DAWN CHARGE/.test(r.desc) && /40×/.test(r.desc), '');
ok('all three sets are animated fx keys', r.anim, '');
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));

let fail = 0;
for (const x of results) { if (!x.pass) fail++; console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.n}${x.pass ? '' : '  -- ' + x.x}`); }
console.log(`\n${results.length - fail}/${results.length} passed`);
process.exit(fail ? 1 : 0);
