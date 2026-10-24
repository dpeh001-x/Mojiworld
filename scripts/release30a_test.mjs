// RELEASE 30a (a skill press that cannot cast shows nothing; player report 2026-10-24, Lv 95 Beastmaster in the Hall of Echoes) stays fixed.
// Real keys (G / F / B / V / S / X, the arrows), tapped (80 ms) and held (1 s), Lv 95, 960x560:
//   [1] Beastmaster at the summon cap (5 out): G (Call of the Wild) tapped / held plays no master flourish, no cast flash >= 0.2, no hit-stop,
//       no cast sound, spends no MP / cooldown, summons nothing; one "Summon cap" notice, the buzzer at most twice in the 1 s hold
//       (was: a flourish + 140 ms hit-stop at every press and every held frame - the white orb in the video)
//   [2] ...F (Wild Bond) at the cap: no cast sound, no attack pose, nothing spent (was: the cast sound + pose every held frame)
//   [3] ready presses are unchanged: G with room summons the pack with one flourish and pays; B (Apex Bond) casts with one flourish; F then G
//       0.2 s later (inside F's cast lock) both cast, in order (the v0.30.1804 press buffer)
//   [4] on cooldown / with no MP: G and B (Beastmaster, Marksman) tapped and held do nothing at all - no cast, flourish, flash, draw, MP
//   [5] silenced (Skill Lock): an Archer holding V / X and a Warrior (Crusader) holding S / B never start a draw / charge, the archer keeps walking, no
//       FULL DRAW, at most one "Skills locked" notice a second (was: rooted drawing, then FULL DRAW flash + hit-stop + toast, then refused)
//   [6] a ready held V still draws (rooted) and casts on release with FULL DRAW; a tapped V casts at once
//   [7] Marksman G (Deadeye) / B (Deadeye Protocol): presses inside the window still pour lines into the mark, without a 0.35 crit flash per
//       line (was 3-7 a press); the window opens with one flourish
//   [8] Crusader B: the arming tap plays one flourish and arms; the next tap releases (cooldown stamped)
//   node release30a_test.mjs   PORT (default 15630) / MOJI_GAME_FILE (served as /mojiworld_game.html) / SERVE_ROOT / ONLY=1,..,8
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15630);
const URL = `http://localhost:${PORT}/mojiworld_game.html?dev=1&lxhold=0`;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 600) + ']' : '')); };
const on = (k) => !process.env.ONLY || process.env.ONLY.split(',').includes(k);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
console.log('server pid ' + server.pid);
await sleep(1500);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try { console.log('browser pid ' + browser.process().pid); } catch (e) {}
const errs = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 960, height: 560 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  console.log('  build', await page.evaluate(() => GAME_VERSION));
  await page.evaluate(() => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const clear = () => { try { if (typeof _dismissBossIntro === 'function') _dismissBossIntro(); } catch (e) {} try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {}
      for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const e = document.getElementById(id); if (e) e.classList.remove('on'); }
      for (const id of ['advancement-modal', 'powerup-modal']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
      { const tm = document.getElementById('tutorial-modal'); if (tm && (tm.classList.contains('tut-dock') || getComputedStyle(tm).display !== 'none')) try { _closeTutorial(true); } catch (e) {} } game.paused = false; };
    const calm = () => { player.hitStun = 0; player.stunTimer = 0; player.frozenTimer = 0; player.hp = getMaxHp(); player.maxMp = Math.max(player.maxMp, 99999); player.mp = player.maxMp; };
    const reset = () => { try { cancelPendingSkillTimers(); } catch (e) {} player.pet = null; player.ultPet = null; player.pack = []; player._clones = []; player.skillCooldowns = {}; player._warCharge = null; player._ballistaTurrets = []; player._ballistaChannel = null; game.minions = []; game.monsters = []; player._castLockUntil = 0; player._skillLockTimer = 0; player._deadeyeUntil = 0; player._protocolUntil = 0; player._deadeyeMark = null; player._bastionArmedUntil = 0; player._bastionArmHeld = false; player._lxSkBuf = null; player._rootedTimer = 0; };
    const kit = async (m) => { const j = MASTERS[m].from, cls = JOBS[j].cls;
      if (player.cls !== cls) { try { applyClass(cls); } catch (e) {} player.cls = cls; }
      if (player.level < 95) devSetLevel(95); try { applyJob(j); } catch (e) {} try { applyMaster(m); } catch (e) {} player.job = j; player.master = m;
      player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._tutorialSeen = true; player._gravitosCineSeen = true; player._god = true;
      game._worldStateByMap = Object.assign(game._worldStateByMap || {}, { forest: null }); clear(); loadMap('forest', 1500); for (let i = 0; i < 6; i++) { await sleep(240); clear(); } reset(); calm();
      Object.defineProperty(game, 'comboMult', { get: () => 1, set() {}, configurable: true }); return [player.cls, player.job, player.master]; };
    // one recorder: what castSkill did, what showed, per animation frame what the hero was doing
    const R = window.__R = { on: false, inCast: 0, inLine: 0 };
    const zero = () => Object.assign(R, { casts: [], flo: 0, flash: [], stop: 0, toasts: [], sfx: 0, fail: 0, fr: 0, chg: 0, atk: 0, hs: 0, x0: player.x, mp0: player.mp, lines: 0, inLine: 0, lineFlash: 0, inCast: 0, castFlash: 0, castStop: 0 });
    const wrap = (o, n, f) => { const f0 = o[n]; o[n] = function () { if (R.on) f.apply(this, arguments); return f0.apply(this, arguments); }; };
    { const c0 = window.castSkill; window.castSkill = function (id) { const cd0 = player.skillCooldowns[id] || 0, mp0 = player.mp; R.inCast++; let r; try { r = c0.apply(this, arguments); } finally { R.inCast--; } if (R.on) R.casts.push({ id, paid: (player.skillCooldowns[id] || 0) !== cd0 || player.mp !== mp0 }); return r; }; }
    wrap(window, 'masterSkillFlourish', () => { R.flo++; });
    wrap(window, 'flash', (a) => { R.flash.push(Math.round(a * 100) / 100); if (R.inLine > 0 && a >= 0.3) R.lineFlash++; if (R.inCast > 0 && a >= 0.2) R.castFlash++; });
    wrap(window, 'addHitStop', () => { R.stop++; if (R.inCast > 0) R.castStop++; });
    wrap(window, 'showToast', (t) => { R.toasts.push(String(t).slice(0, 40)); });
    wrap(window, '_playSkillSfx', () => { R.sfx++; });
    // a Deadeye / Protocol line: hitMonster(m, dmg, isCrit, 'oneshot' | 'marksman_ult'); flashes raised INSIDE it are the line's own
    { const h0 = window.hitMonster; window.hitMonster = function (m, d, c, s) { const line = R.on && (s === 'oneshot' || s === 'marksman_ult'); if (line) { R.lines++; R.inLine++; }
      try { return h0.apply(this, arguments); } finally { if (line) R.inLine--; } }; }
    wrap(audio, 'play', (k) => { if (k === 'fail') R.fail++; });
    const tick = () => { if (R.on) { R.fr++; if (player._warCharge) R.chg++; if (player.attacking) R.atk++; if ((game.hitStop || 0) > 0) R.hs++; } requestAnimationFrame(tick); }; tick();
    const dummy = () => { if (!game.monsters.some((x) => x && x.__d)) { const d = spawnMonster(player.x + 260, player.y, 'slime'); if (d && !d._suppressed) { d.__d = true; d.evasion = 0; } }
      for (const x of game.monsters) if (x && x.__d) { x.maxHp = x.currentHp = 1e12; x.vx = 0; x._stagger = 1e9; x.atk = 0; } };
    window.__t = { sleep, clear, calm, reset, kit, zero, dummy, want: null };
    // the post-tour quest kickoff toasts (THE STORY BEGINS ...) flash on their own timer - not under test
    try { window._lxQuestKickoff = () => {}; window._lxQuestKickoffSoon = () => {}; } catch (e) {}
    setInterval(() => { if (!R.on) return; player.hp = getMaxHp(); player.hitStun = 0; player.stunTimer = 0; if (window.__t.want === 'dummy') dummy(); else game.monsters = []; }, 40);
  });
  // a press: prep() in the page, then the key tapped / held while walking right, then the readings
  const press = async (key, mode, prep, walk = true) => {
    await page.evaluate(async ([src, key]) => { const t = window.__t; window.__k = key; t.clear(); t.calm(); player.facing = 1; player.x = 500; player.vx = 0; if (src) await (0, eval)('(' + src + ')')(); t.zero(); window.__R.on = true; }, [prep ? prep.toString() : '', key]);
    if (walk) { await page.keyboard.down('ArrowRight'); await sleep(80); }
    await page.keyboard.down(key); await sleep(mode === 'hold' ? 1000 : 80); await page.keyboard.up(key);
    await sleep(450); if (walk) await page.keyboard.up('ArrowRight');
    return page.evaluate((key) => { const R = window.__R; R.on = false; const f = skillBySlot(KEY_TO_SLOT[key]); const id = f && f.id;
      return { id, casts: R.casts.length, paid: R.casts.filter((c) => c.paid).length, flo: R.flo, big: R.castFlash + R.toasts.filter((t) => /FULL DRAW|EMPOWERED/.test(t)).length, flash: R.flash, stop: R.stop, castStop: R.castStop, toasts: R.toasts, sfx: R.sfx, fail: R.fail,
        fr: R.fr, chg: R.chg, atk: R.atk, hs: R.hs, dx: Math.round(player.x - R.x0), mp: Math.round(R.mp0 - player.mp), cd: Math.round((id && player.skillCooldowns[id]) || 0), lines: R.lines, lineFlash: R.lineFlash,
        pack: (player.pack || []).length, pet: !!player.pet, ult: !!player.ultPet }; }, key);
  };
  const capToasts = (r) => r.toasts.filter((t) => t.indexOf('Summon cap') >= 0).length;
  const kit = async (m) => { const k = await page.evaluate((m) => window.__t.kit(m), m); console.log('  kit ' + k.join(' / ')); };
  const atCap = async () => { const t = window.__t; t.reset(); t.calm(); castSkill('wildBond'); await t.sleep(700); player._castLockUntil = 0; castSkill('beastmaster_pack'); await t.sleep(900); player.skillCooldowns = {}; player._castLockUntil = 0; };
  // hit-stops / flashes are counted when raised inside castSkill (a quest or milestone toast can flash on its own)
  const quiet = (r) => r.flo === 0 && r.big === 0 && r.castStop === 0 && r.sfx === 0 && r.mp <= 0 && r.paid === 0;
  if (on('1') || on('2') || on('3')) await kit('beastmaster');
  if (on('1')) {
    const t = await press('g', 'tap', atCap);
    ok('[1a] Beastmaster at the cap (5 out), G tapped: no flourish / flash / hit-stop / cast sound, nothing spent or summoned, one cap notice', quiet(t) && t.cd === 0 && t.pack + (t.pet ? 1 : 0) === 5 && capToasts(t) === 1, t);
    const h = await press('g', 'hold', atCap);
    ok('[1b] ...G held 1 s: still nothing - no flourish / hit-stop / sound, <= 1 cap notice, the buzzer <= 2 times', quiet(h) && h.cd === 0 && h.pack + (h.pet ? 1 : 0) === 5 && capToasts(h) <= 1 && h.fail <= 2, h);
  }
  if (on('2')) {
    for (const mode of ['tap', 'hold']) { const r = await press('f', mode, atCap);
      ok('[2] Wild Bond (F) ' + mode + ' at the cap: no cast sound, no attack pose, nothing spent, <= 1 cap notice', quiet(r) && r.atk === 0 && r.cd === 0 && capToasts(r) <= 1 && r.fail <= 2, r); }
  }
  if (on('3')) {
    const g = await press('g', 'tap', () => window.__t.reset());
    ok('[3a] G with room: the pack is summoned, one flourish, MP + cooldown paid', g.paid === 1 && g.flo === 1 && g.pack > 0 && g.mp > 0 && g.cd > 0, g);
    const b = await press('b', 'tap', () => window.__t.reset());
    ok('[3b] B (Apex Bond) ready: casts with one flourish, the werewolf is out', b.paid === 1 && b.flo === 1 && b.ult && b.cd > 0, b);
    await page.evaluate(() => { const t = window.__t; t.reset(); t.calm(); t.zero(); window.__R.on = true; });
    await page.keyboard.down('f'); await sleep(60); await page.keyboard.up('f'); await sleep(140); await page.keyboard.down('g'); await sleep(60); await page.keyboard.up('g'); await sleep(1400);
    const C = await page.evaluate(() => { const R = window.__R; R.on = false; return { casts: R.casts.filter((c) => c.paid).map((c) => c.id), pack: (player.pack || []).length, pet: !!player.pet }; });
    ok('[3c] F then G 0.2 s later (inside F\'s cast lock): both cast, in order, G once (the press buffer)', C.casts.join() === 'wildBond,beastmaster_pack', C);
  }
  if (on('4')) for (const m of ['beastmaster', 'marksman']) {
    await kit(m);
    for (const key of ['g', 'b']) for (const sc of ['cd', 'mp']) for (const mode of ['tap', 'hold']) {
      const r = await press(key, mode, sc === 'cd' ? (() => { window.__t.reset(); const f = skillBySlot(KEY_TO_SLOT[window.__k]); player.skillCooldowns[f.id] = 30000; }) : (() => { window.__t.reset(); player.mp = 0; }), true);
      ok('[4] ' + m + ' ' + key.toUpperCase() + ' ' + (sc === 'cd' ? 'on cooldown' : 'with no MP') + ', ' + mode + ': no cast, flourish, flash, draw or MP', quiet(r) && r.casts === 0 && r.chg === 0, r);
    }
  }
  if (on('5') || on('6') || on('7')) await kit('marksman');
  if (on('5')) {
    for (const key of ['v', 'x']) { const r = await press(key, 'hold', () => { window.__t.reset(); player._skillLockTimer = 6000; });
      const locked = r.toasts.filter((t) => t.indexOf('Skills locked') >= 0).length;
      ok('[5a] silenced Archer holds ' + key.toUpperCase() + ' (' + r.id + ') 1 s: no draw, keeps walking, no FULL DRAW / flash / hit-stop, <= 2 notices, buzzer <= 2', r.chg === 0 && r.dx > 40 && r.big === 0 && r.castStop === 0 && r.paid === 0 && !r.toasts.some((t) => t.indexOf('FULL DRAW') >= 0) && locked <= 2 && r.fail <= 2, r); }
  }
  if (on('6')) {
    const h = await press('v', 'hold', () => window.__t.reset(), false);
    ok('[6a] a ready Archer holding V draws (rooted) and casts on release with FULL DRAW', h.chg > 5 && h.paid === 1 && h.toasts.some((t) => t.indexOf('FULL DRAW') >= 0), h);
    const t = await press('v', 'tap', () => window.__t.reset());
    ok('[6b] a ready V tapped casts at once (no FULL DRAW)', t.paid === 1 && !t.toasts.some((x) => x.indexOf('FULL DRAW') >= 0), t);
  }
  if (on('7')) {
    for (const [key, id] of [['g', 'marksman_oneshot'], ['b', 'marksman_ult']]) {
      await page.evaluate(() => { const t = window.__t; t.reset(); t.calm(); t.want = 'dummy'; t.dummy(); player.x = 500; player.facing = 1; t.zero(); window.__R.on = true; });
      for (let i = 0; i < 6; i++) { await page.keyboard.down(key); await sleep(70); await page.keyboard.up(key); await sleep(480); }
      await sleep(600);
      const r = await page.evaluate(() => { const R = window.__R; R.on = false; window.__t.want = null; return { casts: R.casts.filter((c) => c.id !== 'arrowShot').length, flo: R.flo, lines: R.lines, lineFlash: R.lineFlash, flash: R.flash.slice(0, 30) }; });
      ok('[7] Marksman ' + key.toUpperCase() + ' (' + id + ') pressed through its window: >= 4 presses fire >= 12 lines, one flourish, no crit flash (>= 0.3) raised by a line (was 0.35 on every line)', r.casts >= 4 && r.lines >= 12 && r.flo === 1 && r.lineFlash === 0, r);
    }
  }
  if (on('8') || on('5')) {
    await kit('crusader');
    if (on('5')) for (const key of ['s', 'b']) { const r = await press(key, 'hold', () => { window.__t.reset(); player._skillLockTimer = 6000; });
      ok('[5b] silenced Warrior holds ' + key.toUpperCase() + ' (' + r.id + ') 1 s: no charge, no EMPOWERED / flash / hit-stop, <= 2 notices, buzzer <= 2', r.chg === 0 && r.big === 0 && r.castStop === 0 && r.paid === 0 && r.toasts.filter((t) => t.indexOf('Skills locked') >= 0).length <= 2 && r.fail <= 2, r); }
    if (on('8')) {
    const a = await press('b', 'tap', () => window.__t.reset(), false);
    const armed = await page.evaluate(() => (player._bastionArmedUntil | 0) > game.time);
    ok('[8a] Crusader B tapped: arms the Bastion with one flourish, nothing paid', armed && a.flo === 1 && a.paid === 0, { armed, ...a });
    const r = await press('b', 'tap', null, false);
    ok('[8b] ...the next tap releases it (cooldown stamped, one flourish)', r.cd > 0 && r.flo === 1, r);
    }
  }
} finally {
  console.log('page errors: ' + errs.length + (errs.length ? ' ' + JSON.stringify(errs.slice(0, 3)) : ''));
  console.log(`${pass}/${pass + fail} checks passed`);
  await browser.close(); server.kill();
  process.exit(fail ? 1 : 0);
}
