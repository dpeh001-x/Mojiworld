// ELEMENTAL APOTHEOSIS v3 — three catastrophes, then the cooldown.
// ============================================================================
// Per user: "rework the skill mechanics of elemental apotheosis, it can work
// as a 3 x random elemental catastrophe strike before the cooldown begins".
//
// Replaces the v0.30.21 hold-to-charge (apotheosis_charge_test / _ring_test
// cover THAT design and now fail by intent). What has to be true now:
//   * three presses fire, each behind only a short gate; the fourth is gated
//     behind the full cooldown — and a hand of three DISTINCT elements
//   * the first strike pays the MP, the other two are free
//   * after the cooldown clears, the next press refills the three
//   * the hold is retired: the mage can no longer start a class charge on B
//   * each catastrophe has the shape its name promises (comet falls and
//     shatters, thunder spear crosses the screen, etc.) and lands damage
//   * the catastrophes + the Cascade phases ride their OWN art keys
// Driven through isReady/castSkill like kage_rush_test — the gate is a
// wall-clock cooldown, so readiness is polled, not slept for.
// Run: node scripts/apotheosis_catastrophe_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9473;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
  { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'ApoTest');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*mage\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
await page.evaluate(() => {
  player.level = 99; player._god = true;
  player.cls = 'mage'; player.job = 'archmage'; player.master = 'elementalist';
  loadMap('forest', 300);
});
await page.waitForTimeout(4000);

const R = await page.evaluate(async () => {
  game.paused = false;
  player.maxMp = 1000; player.mp = 1000; player.baseAtk = 500;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const ID = 'elementalist_ult';
  const castWhenReady = async (id, maxMs) => {
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) { if (isReady(id)) { castSkill(id); return Date.now() - t0; } await sleep(25); }
    return -1;
  };
  const resetCast = () => {
    player.skillCooldowns = {}; player.mp = 1000; player._apoCharges = 0; player._apoHand = null;
    game.smoothFx = []; game.projectiles = []; game.monsters.length = 0; player.x = 300; player.y = 300; player.facing = 1;
  };
  const apoShots = () => game.projectiles.filter(p => p && p.owner === 'player' && /^apo_/.test(p.bspr || ''));
  const mk = (x) => { const t = monsterTypes.slime || monsterTypes[Object.keys(monsterTypes)[0]]; const m = { type: 'slime', ...JSON.parse(JSON.stringify(t)), x, y: 300, currentHp: 1e9, maxHp: 1e9, facing: -1, vx: 0, vy: 0, _noGravity: true }; m.traits = {}; game.monsters.push(m); return m; };
  const out = {};

  // ---- 1. three presses, distinct elements, MP once, gate then cooldown ----
  resetCast();
  const presses = [];
  for (let i = 0; i < 3; i++) {
    const mpBefore = player.mp, before = new Set(apoShots());
    const waited = await castWhenReady(ID, 1500);
    const fresh = apoShots().filter(p => !before.has(p));   // by identity: earlier shots may have expired
    presses.push({ waited, mpBefore, mpAfter: player.mp, charges: player._apoCharges | 0,
      cd: Math.round(player.skillCooldowns[ID] || 0), bspr: fresh.length ? fresh[fresh.length - 1].bspr : null });
  }
  out.presses = presses;
  await sleep(1200);
  out.fourthBlocked = !isReady(ID);
  out.cdAfter3 = Math.round(player.skillCooldowns[ID] || 0);

  // ---- 2. refill after the cooldown clears ----------------------------------
  player.skillCooldowns = {}; player.mp = 1000;
  castSkill(ID);
  out.refill = { charges: player._apoCharges | 0, handLeft: (player._apoHand || []).length, mp: player.mp };

  // ---- 3. the hold is retired ----------------------------------------------
  const bKey = Object.keys(KEY_TO_SLOT).find(k => KEY_TO_SLOT[k] === 'b');
  player.skillCooldowns = {}; player._warCharge = null; player._apoCharges = 0;
  out.holdStarted = (typeof tryStartClassCharge === 'function') ? !!tryStartClassCharge(bKey) : 'n/a';
  out.holdState = !!player._warCharge;
  player._warCharge = null;

  // ---- 4. each catastrophe has its promised shape --------------------------
  const force = (el) => { resetCast(); player._apoCharges = 3; player._apoHand = [el]; castSkill(ID); const s = apoShots(); return s[s.length - 1] || null; };
  const shape = {};
  { const p = force('fire');      shape.fire      = p && { bspr: p.bspr, vx: p.vx, explode: p.explode | 0, self: !!p.selfExplode, pierce: !!p.pierce }; }
  { mk(560); const p = force('ice'); shape.ice    = p && { bspr: p.bspr, vy: p.vy, aboveGround: p.y + p.h < player.y + player.h, self: !!p.selfExplode, freeze: p.freeze | 0, explode: p.explode | 0 }; }
  { const p = force('lightning'); shape.lightning = p && { bspr: p.bspr, vx: p.vx, pierce: !!p.pierce, life: p.life }; }
  { const p = force('void');      shape.void      = p && { bspr: p.bspr, vx: p.vx, life: p.life, pierce: !!p.pierce, w: p.w }; }
  out.shape = shape;
  // The loop gives fire/ice/lightning/void shots a one-time upward nudge; with
  // noGravity it never decays. Measured before the _arc opt-out: every
  // catastrophe climbed 2 px a frame for its whole life. Pin the fix.
  { const p = force('fire'); if (!p) out.fireDrift = 'no shot'; else { const y0 = p.y; await sleep(400); out.fireDrift = game.projectiles.includes(p) ? Math.round(p.y - y0) : 'expired'; } }

  // ---- 5. damage lands + the comet freezes what it lands on -----------------
  resetCast(); const m1 = mk(700);
  player._apoCharges = 3; player._apoHand = ['lightning']; castSkill(ID);
  await sleep(900);
  out.lightningDmg = Math.round((1e9 - m1.currentHp) / 500 * 10) / 10;   // x ATK
  resetCast(); const m2 = mk(620); m2.freezeTimer = 0;
  player._apoCharges = 3; player._apoHand = ['ice']; castSkill(ID);
  await sleep(1800);
  out.cometDmg = Math.round((1e9 - m2.currentHp) / 500 * 10) / 10;
  out.cometFroze = (m2.freezeTimer | 0) > 0;

  // ---- 6. art wiring --------------------------------------------------------
  out.wiring = {
    bult: ['apo_fire', 'apo_ice', 'apo_lightning', 'apo_void'].every(k => LX_BULT_PROJ[k] instanceof Image),
    anim: ['apo_fire', 'apo_ice', 'apo_lightning', 'apo_void'].every(k => _BULT_ANIM_KEY[k] === 'p_' + k),
    keys: ['p_apo_fire', 'p_apo_ice', 'p_apo_lightning', 'p_apo_void'].every(k => _PROJ_ANIM_KEYS.has(k)),
    fx: ['cascade_fire', 'cascade_ice', 'cascade_lightning', 'cascade_void'].every(k => !!LX_FX[k]),
  };
  // ---- 7. Cascade phases fire their own art -------------------------------
  resetCast(); mk(480); mk(640);
  player.skillCooldowns = {}; castSkill('elementalist_cascade');
  const seen = new Set();
  for (let t = 0; t < 1500; t += 50) { for (const f of (game.smoothFx || [])) if (f && f.spriteKey) seen.add(f.spriteKey); await sleep(50); }
  out.cascadeKeys = [...seen];
  return out;
});

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 150) });
const P = R.presses, el = P.map(p => p.bspr);
ok('three presses all fire, each behind only a short gate', P.every(p => p.waited >= 0 && p.bspr) && Math.max(...P.map(p => p.waited)) < 1200,   // 500 ms gate + headless jitter (measured 814); the claim is short vs the 66 s cooldown
   P.map(p => `${p.bspr}@${p.waited}ms`).join(', '));
ok('the three catastrophes are DISTINCT elements', new Set(el).size === 3, el.join(', '));
ok('charges count 2 -> 1 -> 0', P.map(p => p.charges).join(',') === '2,1,0', P.map(p => p.charges).join(','));
ok('first strike pays MP, the second and third are free (regen-tolerant)', P[0].mpBefore - P[0].mpAfter >= 50 && P[1].mpBefore - P[1].mpAfter < 10 && P[2].mpBefore - P[2].mpAfter < 10,
   `mp ${P[0].mpBefore}->${P[0].mpAfter}, ${P[1].mpBefore}->${P[1].mpAfter}, ${P[2].mpBefore}->${P[2].mpAfter}`);
ok('a short gate after the 1st and 2nd, the full cooldown only after the 3rd', P[0].cd <= 600 && P[1].cd <= 600 && P[2].cd > 20000,
   `cd ${P[0].cd} / ${P[1].cd} / ${P[2].cd}ms`);
ok('the fourth press is gated behind the full cooldown', R.fourthBlocked && R.cdAfter3 > 20000, `blocked=${R.fourthBlocked} cd=${R.cdAfter3}`);
ok('once the cooldown clears the next press refills the three', R.refill.charges === 2 && R.refill.handLeft === 2 && R.refill.mp < 1000, JSON.stringify(R.refill));
ok('the hold is retired — B no longer starts a class charge for the mage', R.holdStarted === false && !R.holdState, `started=${R.holdStarted}`);
const S = R.shape;
ok('INFERNO rolls forward, explodes through the pack', S.fire && S.fire.bspr === 'apo_fire' && S.fire.vx > 0 && S.fire.explode >= 100 && S.fire.pierce, JSON.stringify(S.fire));
ok('GLACIAL CATACLYSM falls from above and shatters (selfExplode + freeze)', S.ice && S.ice.bspr === 'apo_ice' && S.ice.vy > 0 && S.ice.aboveGround && S.ice.self && S.ice.freeze >= 1500, JSON.stringify(S.ice));
ok('THUNDERFALL crosses the screen (fast, piercing)', S.lightning && S.lightning.bspr === 'apo_lightning' && Math.abs(S.lightning.vx) >= 30 && S.lightning.pierce, JSON.stringify(S.lightning));
ok('SINGULARITY is slow, huge and lingers', S.void && S.void.bspr === 'apo_void' && Math.abs(S.void.vx) <= 6 && S.void.life >= 120 && S.void.w >= 180, JSON.stringify(S.void));
ok('a thunder spear lands real damage on a foe in the lane', R.lightningDmg >= 5, `${R.lightningDmg}x ATK`);
ok('the Inferno rolls LEVEL - no upward drift from the arc nudge', R.fireDrift === 0, `drifted ${R.fireDrift}px over ~24 frames`);
ok('the comet damages AND freezes what it lands on', R.cometDmg >= 3 && R.cometFroze, `${R.cometDmg}x ATK, froze=${R.cometFroze}`);
ok('catastrophes + Cascade phases are wired to their own art', R.wiring.bult && R.wiring.anim && R.wiring.keys && R.wiring.fx, JSON.stringify(R.wiring));
ok('Cascade fires its own phase art (pyre / frost nova / convergence), not ice_block',
   ['cascade_fire', 'cascade_ice', 'cascade_void'].every(k => R.cascadeKeys.includes(k)) && !R.cascadeKeys.includes('ice_block'), R.cascadeKeys.join(', '));
ok('Cascade storm hops stamp their own impact art', R.cascadeKeys.includes('cascade_lightning'), R.cascadeKeys.join(', '));
ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
await browser.close(); server.kill();
process.exit(bad ? 1 : 0);
