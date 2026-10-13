// RELEASE 19a (hunter / archer / rogue Lv 1-40 real-input playthrough) stays fixed:
//   [1] a Ranger with the Wild Bond wolf out (real F press) in a fight saves every time: no "Save disabled" toast, no sticky badge,
//       the stored save has no 'pet' and no monster in it; a GAME error in the flush (a circular field) is reported as one, not as
//       storage, and the next good save clears it; a real storage refusal (SecurityError) still says storage
//   [2] q_inner_dim_trial / q_distorted_portal / every class ladder row lock gear to the class; 25 real completions of the trial
//       hand an archer only archer (or any-class) gear
//   [3] an archer on a door: Up within 300 ms of Z, or with Z held, aims and does not take the door; a fresh Up does (real keys,
//       also after rebinding Up and the attack); a warrior's Z then Up still takes it
//   [4] the King's mercy lantern, offered while the rogue is mid-jump (real Space), stands on the ground; a standing N spares him
//   [5] every job card names its F skill and every master card its G skill (Assassin: Shin-Shuriken)
//   [6] Lady Hong's aim trial survives a rogue's double dash (real Shift presses); walking 400 px away still ends it
//   [7] class wording: the prologue coach says Z fires (archer) / casts (mage) / swings (warrior); the tour's attack and weapon steps
//       name the bow / staff / blade
//   node release19a_test.mjs        PORT / MOJI_GAME_FILE / SERVE_ROOT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15191), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
const boot = async (cls) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  await page.evaluate((c) => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (player.cls !== c) { try { applyClass(c); } catch (e) {} player.cls = c; }
    player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
    player._tutorialSeen = true; player._gravitosCineSeen = true; player._god = true;
    window.__toasts = []; const _st0 = window.showToast; window.showToast = function (t) { try { window.__toasts.push(String(t)); } catch (e) {} return _st0.apply(this, arguments); };
    window._r19 = { sleep: (ms) => new Promise((r) => setTimeout(r, ms)), clear: () => { try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {} game.paused = false; },
      fresh: (lv) => { player.level = lv; player.exp = 0; player.expToNext = 1e15; player.quests = { active: {}, completed: {}, unlocked: {} }; _ensureQuests(); game.qnav = null; game.qnavPins = []; },
      go: async (map, x) => { window._r19.clear(); game._worldStateByMap = game._worldStateByMap || {}; game._worldStateByMap[map] = null; loadMap(map, x || 300); await window._r19.sleep(900); window._r19.clear();
        for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const e = document.getElementById(id); if (e) e.classList.remove('on'); } },
      calm: () => { player.hitStun = 0; player.stunTimer = 0; player.hp = player.maxHp; player.quickDashTimer = 0; } };
  }, cls);
  return { ctx, page };
};
const press = async (page, key, hold = 90) => { await page.keyboard.down(key); await page.waitForTimeout(hold); await page.keyboard.up(key); await page.waitForTimeout(120); };
// walk with the real arrow keys toward world x
const walk = async (page, tx, tol = 14) => { let dir0 = null; for (let i = 0; i < 120; i++) { const x = await page.evaluate(() => player.x + player.w / 2); const dx = tx - x; if (Math.abs(dx) <= tol) break; const dir = dx > 0 ? 'ArrowRight' : 'ArrowLeft'; if (dir0 && dir0 !== dir) await page.keyboard.up(dir0); if (dir0 !== dir) { await page.keyboard.down(dir); dir0 = dir; } await page.waitForTimeout(Math.min(120, 20 + Math.abs(dx) * 0.6)); } if (dir0) await page.keyboard.up(dir0); await page.waitForTimeout(250); };
try {
  // ======== ARCHER (ranger): [1] [2] [3] [7]
  const { page } = await boot('archer');
  // ---- [1] the wolf out in a fight: every save lands
  await page.evaluate(async () => { const { fresh, go } = window._r19; fresh(30); try { applyJob('ranger'); } catch (e) {} window._r19.clear(); player.job = 'ranger';
    await go('forest', 400); window._r19.calm(); player.mp = player.maxMp = 99999; });
  await page.waitForTimeout(400);
  for (let i = 0; i < 4 && !(await page.evaluate(() => !!player.pet)); i++) { await page.evaluate(() => { window._r19.clear(); window._r19.calm(); }); await press(page, 'f', 200); await page.waitForTimeout(600); }   // a real F press (again if a busy frame missed it)
  const P0 = await page.evaluate(() => ({ pet: !!player.pet, job: player.job }));
  ok('[1-setup] a real F press summons the Wild Bond wolf', P0.pet, P0);
  const S1 = await page.evaluate(async () => {
    const { sleep } = window._r19; const out = { samples: [], disabledToasts: 0 };
    const px = () => player.x + player.w / 2;
    for (let i = 0; i < 14; i++) {
      if (game.monsters.filter((m) => m && m.currentHp > 0).length < 3) { for (let k = 0; k < 3; k++) try { spawnMonster(px() + 120 + k * 60, 200, 'slime', true, false); } catch (e) {} }
      for (const m of game.monsters) if (m) m.currentHp = Math.max(m.currentHp, m.maxHp * 0.6);   // the fight goes on
      if (player.pet) player.pet.life = Math.max(player.pet.life || 0, 30000);
      player.hp = player.maxHp; player.hitStun = 0;
      await sleep(450);
      const t0 = window.__toasts.length; game._saveFailing = null;
      _flushSaveStateNow();
      const tt = window.__toasts.slice(t0).join(' | ');
      if (/Save disabled/.test(tt)) out.disabledToasts++;
      out.samples.push({ tgt: !!(player.pet && player.pet._tgtRef), fail: game._saveFailing || null });
    }
    let raw = ''; try { raw = localStorage.getItem(SAVE_KEY) || ''; } catch (e) {}
    let sv = null; try { sv = JSON.parse(raw); } catch (e) {}
    out.savedPet = !!(sv && sv.player && 'pet' in sv.player);
    out.monsterInSave = /"currentHp":/.test(raw) && /"maxHp":/.test(raw) && /"_abBox"|"aggroTarget"|"patternState"/.test(raw);
    out.pet = !!player.pet;
    return out;
  });
  const fails = S1.samples.filter((q) => q.fail).length, withTgt = S1.samples.filter((q) => q.tgt).length;
  ok('[1a] with the wolf fighting, 14 save flushes all land (no failing badge, no "Save disabled" toast)', fails === 0 && S1.disabledToasts === 0 && withTgt >= 3, { fails, withTgt, disabled: S1.disabledToasts });
  ok('[1b] the stored save carries no pet and no monster object', !S1.savedPet && !S1.monsterInSave, { savedPet: S1.savedPet, monster: S1.monsterInSave });
  const S2 = await page.evaluate(async () => {
    const out = {}; const lc0 = player.lookCustom; const cyc = Object.assign({}, lc0 || {}); cyc._self = cyc; player.lookCustom = cyc;   // a game bug: a circular field
    let t0 = window.__toasts.length; game._saveFailing = null; game._saveDisabledWarned = false; game._saveErrorToastAt = 0; _flushSaveStateNow();
    out.err = { fail: game._saveFailing, toasts: window.__toasts.slice(t0).join(' | ').slice(0, 200), badge: ((document.getElementById('save-indicator') || {}).title || '').slice(0, 160) };
    player.lookCustom = lc0; t0 = window.__toasts.length; _flushSaveStateNow(); out.after = { fail: game._saveFailing || null };
    const real = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === SAVE_KEY) throw new DOMException('The operation is insecure.', 'SecurityError'); return real.call(this, k, v); };
    t0 = window.__toasts.length; game._saveDisabledWarned = false; try { _flushSaveStateNow(); } finally { Storage.prototype.setItem = real; }
    out.sec = { fail: game._saveFailing, toasts: window.__toasts.slice(t0).join(' | ').slice(0, 200) };
    _flushSaveStateNow(); out.sec.after = game._saveFailing || null;
    return out;
  });
  ok('[1c] a game error in the flush is reported as one (not "Save disabled" / blocked storage)', S2.err.fail && S2.err.fail !== 'blocked' && !/Save disabled|blocking site storage/.test(S2.err.toasts + S2.err.badge) && /game error/.test(S2.err.toasts + S2.err.badge), S2.err);
  ok('[1d] the next good save clears it', S2.after.fail === null, S2.after);
  ok('[1e] a real storage refusal (SecurityError) still says storage is blocked, and clears on the next good save', S2.sec.fail === 'blocked' && /Save disabled/.test(S2.sec.toasts) && S2.sec.after === null, S2.sec);
  // ---- [1f] every other summon / companion out at once: the save still lands with no monster in it
  const S3 = await page.evaluate(async () => {
    const { sleep } = window._r19; const out = { cast: {} }; const keep = { job: player.job, master: player.master };
    const cast = (job, master, id) => { player.job = job; player.master = master; try { out.cast[id] = String(castSkill(id)); } catch (e) { out.cast[id] = 'ERR ' + e.message; } };
    player.mp = player.maxMp = 99999; game.cooldowns = {}; player.cooldowns = {};
    cast('ranger', 'beastmaster', 'beastmaster_pack'); cast('ranger', 'beastmaster', 'beastmaster_ult'); cast('sniper', 'ballista', 'ballista_ult');
    try { const mm = _mojimonEnsure(); mm.roster.slime = { upg: { hp: 0, atk: 0, def: 0 }, at: Date.now() }; mm.cdUntil = 0; out.mm = _mojimonSummon('slime', { free: true }); } catch (e) { out.mm = 'ERR ' + e.message; }
    player.job = keep.job; player.master = keep.master;
    const px = player.x + player.w / 2; for (let k = 0; k < 3; k++) try { spawnMonster(px + 140 + k * 50, 200, 'slime', true, false); } catch (e) {}
    await sleep(1500);
    out.live = { pet: !!player.pet, pack: (player.pack || []).length, ult: !!player.ultPet, minions: (game.minions || []).length, ballista: !!player._ballista };
    game._saveFailing = null; _flushSaveStateNow(); out.fail = game._saveFailing || null;
    let raw = ''; try { raw = localStorage.getItem(SAVE_KEY) || ''; } catch (e) {} out.monster = /"_abBox"|"aggroTarget"|"_tgtRef"/.test(raw);
    return out;
  });
  ok('[1f] with the wolf, the pack, the apex wolf, the turret and a MojiMon out, the save lands and holds no live entity', !S3.fail && !S3.monster && S3.live.pet && S3.live.pack > 0, S3);
  await page.evaluate(() => { player.pet = null; player.ultPet = null; player.pack = []; game.minions = []; player._ballista = null; for (const m of game.monsters) if (m) m.currentHp = 0; game.monsters.length = 0; });

  // ---- [2] advancement quests and the class ladder: class-locked gear
  const G2 = await page.evaluate(() => {
    const out = { trial: !!QUESTS.q_inner_dim_trial.rewards.gearClassLock, portal: !!QUESTS.q_distorted_portal.rewards.gearClassLock, ladderOpen: [] , items: [] };
    for (const id in QUESTS) if (/^q_(warrior|mage|rogue|archer)_lv\d+$/.test(id)) { const r = QUESTS[id].rewards || {}; if (r.gearChance > 0 && !r.gearClassLock) out.ladderOpen.push(id); }
    const g0 = window._lxGiveRewardItem; window._lxGiveRewardItem = function (it) { out.items.push((it && it.cls) || '?'); return 'bag'; };
    const run = (id, n) => { for (let i = 0; i < n; i++) { delete player.quests.completed[id]; player.quests.active[id] = { progress: 99, readyToHandIn: true }; try { _completeQuest(id); } catch (e) { out.err = String(e.message); } window._r19.clear(); } };
    try { run('q_inner_dim_trial', 25); run('q_distorted_portal', 10); } finally { window._lxGiveRewardItem = g0; }
    out.off = out.items.filter((c) => c !== 'archer' && c !== 'any').length;
    return out;
  });
  ok('[2a] the Mirror Self trial, the Distorted Portal and every class ladder row lock gear to the class', G2.trial && G2.portal && G2.ladderOpen.length === 0, { trial: G2.trial, portal: G2.portal, open: G2.ladderOpen.length, sample: G2.ladderOpen.slice(0, 4) });
  ok('[2b] 35 real completions of the two advancement quests hand an archer no other class\'s gear', G2.items.length >= 30 && G2.off === 0, { n: G2.items.length, off: G2.off, err: G2.err });

  // ---- [3] an archer on a door: Up while aiming does not take it (real keys)
  await page.evaluate(async () => { const { fresh, go } = window._r19; fresh(30); await go('town', 300);
    const po = game.portals.find((p) => p && MAPS[p.dest] && !p.levelGate && p.dest !== 'void') || game.portals[0]; window._r19.po = po;
    window._r19.stand = () => { const y = (typeof po.y === 'number') ? po.y : _defaultPortalY(po.x); player.x = po.x - player.w / 2; player.y = y - player.h; player.vx = 0; player.vy = 0; player.onGround = true; window._r19.calm(); };
    window._r19.stand(); window._r19.tp = 0; window._r19.tp0 = window.tryPortal; window.tryPortal = function () { window._r19.tp++; return false; }; });
  const tp = () => page.evaluate(() => window._r19.tp);
  const settle = async () => { await page.evaluate(() => window._r19.stand()); await page.waitForTimeout(700); };
  const D = {};
  await page.evaluate(() => { window._r19.kt = {}; window.addEventListener('keydown', (e) => { window._r19.kt[e.key] = performance.now(); }, true); });
  let t0 = 0;
  for (let i = 0; i < 4; i++) {   // Z, then Up at once (a loaded machine can space the two key events past 300 ms: such a try does not count)
    await settle(); t0 = await tp(); await page.keyboard.down('z'); await page.waitForTimeout(40); await page.keyboard.up('z'); await page.keyboard.down('ArrowUp'); await page.waitForTimeout(90); await page.keyboard.up('ArrowUp'); await page.waitForTimeout(150);
    D.zThenUp = (await tp()) - t0; D.gap = await page.evaluate(() => Math.round(window._r19.kt.ArrowUp - window._r19.kt.z)); if (D.gap < 250) break; }
  await settle(); t0 = await tp(); await page.keyboard.down('z'); await page.waitForTimeout(450); await press(page, 'ArrowUp'); await page.keyboard.up('z'); D.zHeldUp = (await tp()) - t0;
  await settle(); t0 = await tp(); await press(page, 'ArrowUp'); D.freshUp = (await tp()) - t0;
  await page.evaluate(() => { _kbAssign('moveUp', 'i'); _kbAssign('skill:d', 'j'); });
  for (let i = 0; i < 4; i++) {
    await settle(); t0 = await tp(); await page.keyboard.down('j'); await page.waitForTimeout(40); await page.keyboard.up('j'); await page.keyboard.down('i'); await page.waitForTimeout(90); await page.keyboard.up('i'); await page.waitForTimeout(150);
    D.rebJthenI = (await tp()) - t0; D.gapJ = await page.evaluate(() => Math.round(window._r19.kt.i - window._r19.kt.j)); if (D.gapJ < 250) break; }
  await settle(); t0 = await tp(); await press(page, 'i'); D.rebFreshI = (await tp()) - t0;
  await page.evaluate(() => { _kbAssign('moveUp', 'arrowup'); _kbAssign('skill:d', 'z'); player.cls = 'warrior'; });
  await settle(); t0 = await tp(); await press(page, 'z', 60); await page.waitForTimeout(60); await press(page, 'ArrowUp'); D.warriorZUp = (await tp()) - t0;
  await page.evaluate(() => { player.cls = 'archer'; window.tryPortal = window._r19.tp0; window._r19.m0 = game.currentMap; });
  await settle(); await press(page, 'ArrowUp'); await page.waitForTimeout(2500); await page.evaluate(() => window._r19.clear());
  D.entered = await page.evaluate(() => game.currentMap !== window._r19.m0 ? game.currentMap : null);
  ok('[3a] Up within 300 ms of Z, or with Z held, aims: the door is not taken', D.zThenUp === 0 && D.zHeldUp === 0, D);
  ok('[3b] a fresh Up on the door still takes it (and really enters the map behind it)', D.freshUp === 1 && !!D.entered, D);
  ok('[3c] the same with Up rebound to I and the attack to J; a warrior\'s Z then Up still takes the door', D.rebJthenI === 0 && D.rebFreshI === 1 && D.warriorZUp === 1, D);

  // ---- [7] class wording (archer / mage / warrior)
  const W7 = await page.evaluate(() => {
    const out = {}; const st = (t) => TUTORIAL_STEPS.find((s) => s && s.title === t);
    const coach = (line) => { window._prologueActive = true; try { _prologueCoach(line); } catch (e) {} const el = document.getElementById('prologue-coach'); const t = el ? el.textContent : ''; if (el) el.remove(); window._prologueActive = false; return t; };
    for (const c of ['archer', 'mage', 'warrior']) { player.cls = c;
      out[c] = { coach: coach(_LX_PROLOGUE_COACH[1][1]).slice(9, 60), touch: coach(_LX_PROLOGUE_COACH_TOUCH[7000]).slice(9, 60), fight: String(st('Move & Fight').tryIt), weapon: String(st('Your First Weapon').tryIt) }; }
    player.cls = 'archer'; return out;
  });
  ok('[7a] the prologue coach: Z fires (archer), Z casts (mage), Z swings (warrior); the touch line too', /Z fires/.test(W7.archer.coach) && /button fires/.test(W7.archer.touch) && /Z casts/.test(W7.mage.coach) && /Z swings/.test(W7.warrior.coach), W7);
  ok('[7b] the tour asks an archer to fire the bow, a mage to cast; the weapon step names the bow / staff / blade', /Fire your bow/.test(W7.archer.fight) && /Cast/.test(W7.mage.fight) && /Swing your weapon/.test(W7.warrior.fight)
    && /meet your bow/.test(W7.archer.weapon) && /meet your staff/.test(W7.mage.weapon) && /meet your blade/.test(W7.warrior.weapon), { a: W7.archer, m: W7.mage.weapon });
  // ======== ROGUE: [4] [5] [6]
  const { page: rp } = await boot('rogue');
  // ---- [4] the King's mercy lantern, offered mid-jump (real Space), stands on the ground; a standing N spares him
  const K0 = await rp.evaluate(async () => {
    const { fresh, go } = window._r19; fresh(9); player.quests.active.q_road_6 = { progress: 0 }; await go('slimeCave', 500);
    let b = game.monsters.find((m) => m && m.type === 'king' && m.currentHp > 0);
    if (!b) { try { spawnMonster(1100, 200, 'king', true, false); } catch (e) {} b = game.monsters.find((m) => m && m.type === 'king'); }
    if (!b) return { err: 'no king' };
    for (const m of game.monsters) if (m && m !== b) m.currentHp = 0;
    b.currentHp = Math.floor(b.maxHp * 0.4); window._r19.king = b; window._r19.calm();
    const clearAt = (x) => !(game.mapData.platforms || []).some((p) => p && p.type !== 'ground' && p.x < x + 170 && p.x + p.w > x - 170);   // open sky over the jump and the lantern
    let hx = Math.max(200, b.x - 420); for (let x = 200; x < b.x - 260; x += 20) if (clearAt(x)) { hx = x; break; }
    player.x = hx - player.w / 2; player.vx = 0;
    return { bx: Math.round(b.x), px: Math.round(player.x) };
  });
  await rp.waitForTimeout(900);
  const feet0 = await rp.evaluate(() => Math.round(player.y + player.h));
  await rp.keyboard.down('Space');
  const K1 = await rp.evaluate(async (feet0) => {
    for (let i = 0; i < 60 && !(!player.onGround && feet0 - (player.y + player.h) > 60); i++) await window._r19.sleep(15);   // high in the jump
    const b = window._r19.king, air = !player.onGround, feet = Math.round(player.y + player.h);
    b.currentHp = Math.floor(b.maxHp * 0.26); await window._r19.sleep(120);
    const Z = game._lxMercy; if (!Z) return { air, feet0, feet, err: 'no offer' };
    let surf = null; for (const p of (game.mapData.platforms || [])) if (p && p.w > 0 && Z.x >= p.x && Z.x <= p.x + p.w && Math.abs(p.y - Z.y) <= 2) surf = p.type || 'platform';
    return { air, feet0, feet, zy: Math.round(Z.y), zx: Math.round(Z.x), surf };
  }, feet0);
  await rp.keyboard.up('Space');
  await rp.waitForTimeout(900);
  for (let i = 0; i < 4 && K1.zx && (await rp.evaluate((zy) => player.y + player.h < zy - 20, K1.zy)); i++) {   // landed on a ledge: drop down to it
    await rp.waitForFunction(() => player.onGround, null, { timeout: 4000 }).catch(() => {});
    await rp.keyboard.down('ArrowDown'); await rp.waitForTimeout(80); await press(rp, 'Space', 200); await rp.keyboard.up('ArrowDown'); await rp.waitForTimeout(900); }
  if (K1.zx) await walk(rp, K1.zx + 20, 16);
  await rp.evaluate(() => window._r19.calm());
  await press(rp, 'n'); await rp.waitForTimeout(500);
  const K2 = await rp.evaluate(() => { const a = player.quests.active.q_road_6 || {}, Z = game._lxMercy; return { spared: !!a.spared, done: !!(Z && Z.done), x: Math.round(player.x + player.w / 2), feet: Math.round(player.y + player.h), ground: !!player.onGround, z: Z ? [Math.round(Z.x), Math.round(Z.y)] : null }; });
  ok('[4a] the lantern offered while the rogue is mid-jump stands on a surface (not in the air)', K1.air && K1.feet0 - K1.feet > 50 && !!K1.surf && K1.zy > K1.feet + 40, { K0, K1 });
  ok('[4b] standing beside it, a real N press shows him morning (spared)', K2.spared || K2.done, K2);

  // ---- [5] every job card names its F skill, every master card its G skill; the Lv 20 rogue card says Shin-Shuriken
  const J5 = await rp.evaluate(async () => {
    const bad = [];
    const on = (slot, key, val) => { for (const id in SKILLS) { const s = SKILLS[id]; if (s && s.slot === slot && s[key] === val && (key === 'master' || !s.master)) return s.name; } return null; };
    for (const j in JOBS) { const n = on('q', 'job', j); if (!n || String(JOBS[j].signature).indexOf(n + ' —') !== 0) bad.push(j + ': ' + n + ' vs ' + String(JOBS[j].signature).slice(0, 30)); }
    for (const m in MASTERS) { const n = on('x', 'master', m); if (!n || String(MASTERS[m].signature).indexOf(n + ' —') !== 0) bad.push(m + ': ' + n + ' vs ' + String(MASTERS[m].signature).slice(0, 30)); }
    window._r19.fresh(20); player.job = null; player.master = null; try { openAdvancement(); } catch (e) {} await window._r19.sleep(500);
    const t = ((document.getElementById('advancement-options') || {}).textContent || '').replace(/\s+/g, ' ');
    window._r19.clear(); { const am = document.getElementById('advancement-modal'); if (am) am.style.display = 'none'; } document.body.classList.remove('forced-modal'); game.paused = false;   // the job card is a forced modal
    const i = t.indexOf('Assassin'); return { bad, card: i >= 0 ? t.slice(i, i + 400) : t.slice(0, 300) };
  });
  ok('[5a] every job card signature starts with the skill on F, every master card with the skill on G', J5.bad.length === 0, J5.bad);
  ok('[5b] the Lv 20 Assassin card names Shin-Shuriken (Voidrift Blink is the V skill)', /Signature:\s*Shin-Shuriken/.test(J5.card) && !/Signature:\s*Voidrift Blink/.test(J5.card), J5.card.slice(0, 260));

  // ---- [6] Lady Hong's aim trial survives a double dash; walking away still ends it (real keys)
  const startTrial = async () => {
    await rp.evaluate(async () => { const { fresh, go } = window._r19; fresh(12); player.quests.active.q_road_7 = { progress: 2, stage: 2, used: {}, seq: 0 }; await go('emeraldVillage', 700); window._r19.calm(); window.__toasts.length = 0; });
    await walk(rp, 900, 10); await rp.evaluate(() => window._r19.calm()); await press(rp, 'n'); await rp.waitForTimeout(700);
    return rp.evaluate(() => { const f = game._lxFight; return f ? { kind: f.def && f.def.trial && f.def.trial.kind, x: Math.round(player.x + player.w / 2) } : { none: true, x: Math.round(player.x + player.w / 2), tgt: !!_lxQMarkTarget(), S: !!_lxQStageOf('q_road_7'), paused: game.paused, modal: (typeof _anyOtherModalOpen === 'function') ? String(_anyOtherModalOpen()) : '', map: game.currentMap, t: window.__toasts.slice(-3) }; });
  };
  const A0 = await startTrial();
  await rp.keyboard.down('ArrowLeft'); await rp.waitForTimeout(400); await press(rp, 'Shift', 60); await rp.waitForTimeout(240); await press(rp, 'Shift', 60); await rp.waitForTimeout(300);   // a short walk, then two dashes
  for (let i = 0; i < 8 && A0 && (await rp.evaluate((x0) => Math.abs(player.x + player.w / 2 - x0) < 340, A0.x)); i++) { await press(rp, 'Shift', 90); await rp.waitForTimeout(450); }   // a loaded machine drops dash frames: dash on past 340 px
  await rp.keyboard.up('ArrowLeft'); await rp.waitForTimeout(900);
  const A1 = await rp.evaluate((x0) => ({ moved: Math.round(player.x + player.w / 2 - x0), fight: !!game._lxFight, t: window.__toasts.slice(-2) }), A0 ? A0.x : 0);
  ok('[6a] a rogue\'s double dash (real Shift presses, ' + A1.moved + ' px in all, after a short walk) does not end the aim trial', !!A0 && A0.kind === 'aim' && Math.abs(A1.moved) > 320 && A1.fight, { A0, A1 });
  await rp.evaluate(() => { const f = game._lxFight; if (f) try { _lxFightEnd(f, false, 'reset'); } catch (e) {} });
  const B0 = await startTrial();
  await walk(rp, 900 - 420, 10); await rp.waitForTimeout(400);
  const B1 = await rp.evaluate(() => ({ fight: !!game._lxFight, t: window.__toasts.slice(-3) }));
  ok('[6b] walking 420 px away still ends it ("You stepped away from the mark")', !!B0 && B0.kind === 'aim' && !B1.fight && B1.t.some((q) => /stepped away/.test(q)), { B0, B1 });
} catch (e) { ok('harness ran', false, String(e && e.stack || e).slice(0, 400)); }
ok('no page errors', errs.length === 0, errs.slice(0, 4));
await browser.close(); try { server.kill(); } catch (e) {}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
