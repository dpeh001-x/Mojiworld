// A HEAVY SWING HITS ON ITS PEAK FRAME, IN STEP WITH THE MONSTER'S STRIKE. Per user: "Ensure that the timing of the strike is
// accurately time calibrated to hit the player at the peak frame (frame 5), and ensure the timing of the animation being
// played is accurate with respect to the monster's attack", "ensure that for towerarbiter the strike plays with this
// sequence as well". Every animated swinger swings at a hero standing inside its swing box. Each render logs the strike-effect frame drawn, the
// monster's attack frame drawn (the set it draws + index) and the hero's HP.
// A render counts as the hit only while the swing is live (a slow frame can run two updates, so the hero is vulnerable
// for the whole windup and refilled every frame until the swing exists).
//   - PEAK: the render where the hero loses HP shows the effect's 5th frame (its strike, index 4)
//   - IN STEP: on that render the monster shows the strike / key frame of the set it is drawing (bosses' included)
//   - STAYS: after the hit the strike keeps drawing and plays its trail (it used to vanish on the frame it hit)
//   - ARBITER: his heavy swing plays his purple sword set, the slam (f6) on the hit
//   - LATE: a hero stepping into the swing after its peak frame is not hurt; inside the peak it is
//   [PORT=13925] node scripts/swing_timing_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { spawn } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json')); const { chromium } = require('playwright-core');
const PORT = process.env.PORT || '13925'; let pass = 0, fail = 0;
const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d !== undefined ? '  ' + JSON.stringify(d).slice(0, 700) : '')); ok ? pass++ : fail++; };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: { ...process.env, MOJI_GAME_FILE: path.resolve(ROOT, process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html') } });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function', null, { timeout: 180000 });
const R = await page.evaluate(async () => {
  const W8 = (ms) => new Promise((r) => setTimeout(r, ms)), raf = () => new Promise((r) => requestAnimationFrame(r));
  try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player._storyBeatsSeen = player._storyBeatsSeen || {}; if (typeof STORY_BEATS === 'object') for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
  player._tutorialSeen = true; player._gravitosCineSeen = true; loadMap('forest', 1500); await W8(2500); try { closeAllModals(); } catch (e) {}
  const S = { m: null, type: null, eff: null, mon: null, log: null };
  const label = (lab, arr, img) => { const i = arr && arr.indexOf ? arr.indexOf(img) : -1; return i >= 0 ? { set: lab, i } : null; };
  const oMSF = window._monsterStateFrame; window._monsterStateFrame = function (m) { const f = oMSF.apply(this, arguments);
    if (m === S.m) { const set = _monsterFramesFor(m.type) || {}; S.mon = label(m.type, set.attack, f) || { set: 'other', i: -1 }; } return f; };
  const oDBS = window._drawBossSprite; window._drawBossSprite = function (sprite, m) {
    if (m === S.m) { S.mon = null; try { if (m.zodiacSign) S.mon = label('zodiac_' + m.zodiacSign, ZODIAC_ATTACK_FRAMES[m.zodiacSign], sprite); } catch (e) {}
      if (!S.mon) for (const k in BOSS_ATTACK_FRAMES) if ((S.mon = label(k, BOSS_ATTACK_FRAMES[k], sprite))) break;
      if (!S.mon) S.mon = { set: 'other', i: -1 }; }
    return oDBS.apply(this, arguments); };
  const P = CanvasRenderingContext2D.prototype, oDraw = P.drawImage;
  P.drawImage = function (img) { if (S.log) { const fr = _fxAnimFrames('swing_' + S.type), i = fr ? fr.indexOf(img) : -1; if (i >= 0) S.eff = i; } return oDraw.apply(this, arguments); };
  const oDP = window.drawProjectiles; window.drawProjectiles = function () { const r = oDP.apply(this, arguments);
    if (S.log) { const own = (q) => q.skill === 'swing' && q._swingType === S.type;
      S.log.push({ eff: S.eff, mon: S.mon, hp: player.hp, live: game.projectiles.some(own) || (game._lxSwingFx || []).some(own) }); }
    S.eff = null; S.mon = null; return r; };
  // strike / key frame of a drawn set (bosses: their key frame; monsters: their attack timing's strike)
  const keyOf = (set, boss) => { let n = 0, ft = [];
    try { const a = /^zodiac_/.test(set) ? ZODIAC_ATTACK_FRAMES[set.slice(7)] : (boss ? BOSS_ATTACK_FRAMES[set] : _monsterFramesFor(set).attack); n = a.length; ft = _lxCalibFt(set, 'attack') || []; } catch (e) {}
    return boss ? _lxBossKeyFrame(set, n, ft) : _lxFtStrike(n, ft); };
  // one swing at a hero in the box; late > 0: the hero stays invulnerable until the swing is that many updates old
  const HP0 = 1e6;
  const swingAt = async (type, late) => {
    game.paused = false; game.monsters.length = 0; game.projectiles.length = 0; game._lxSwingFx = [];
    player._god = true; player.invulnerable = 9e9; player.x = 1500; player.vx = 0; player.maxHp = HP0; player.hp = HP0;   // a fixed pool: no getMaxHp() feedback
    for (let k = 0; k < 20; k++) await raf();
    const boss = !!(monsterTypes[type].boss || /^zodiac_/.test(type)), m = spawnMonster(player.x + 260, player.y - 200, type, boss);
    const g = (game.platforms || []).find((q) => q.type === 'ground'); if (g) { m.y = g.y - m.h; m.vy = 0; }
    m.traits = Object.assign({}, m.traits, { activeBoss: true }); const bm = m.traits.bigMelee;
    m.shootTimer = -9e9; m._columnCd = 9e9; m._hgCd = 9e9; m._bigMeleeCd = 300; m.facing = -1;
    const [SW] = _lxSwingDims(m, bm); for (let k = 0; k < 300 && !_lxSwingAnim(type); k++) await raf();
    S.m = m; S.type = type; S.log = []; const oR = Math.random; let sw = null, age = 0, after = 0, inBox = null;
    try {
      const t0 = performance.now();
      while (performance.now() - t0 < 12000) {
        await raf(); m._zSpentMs = 0; m._dirOpenT = 0; m._dirFleeT = 0;
        sw = sw || game.projectiles.find((q) => q.skill === 'swing' && q._swingType === type) || (game._lxSwingFx || []).find((q) => q._swingType === type) || null;
        if (!sw) player.x = m._bigMeleeFiring ? (m.x + 8) - 0.5 * SW - player.w / 2 : m.x + m.w / 2 - bm.range * 0.8 - player.w / 2;   // in the box, clear of the body
        player.y = m.y + m.h - player.h; player.vx = 0; player.vy = 0;
        if (sw) age = (sw._sgL0 || 14) - sw.life;
        const open = late ? (sw && age >= late) : (m._bigMeleeFiring || !!sw);
        if (open && player._god) { player._god = false; player.invulnerable = 0; Math.random = () => 0.99;
          if (late) inBox = !!(sw && sw.x < player.x + player.w && player.x < sw.x + sw.w && sw.y < player.y + player.h && player.y < sw.y + sw.h); }
        if (!player._god && !sw) { player.hp = HP0; player.invulnerable = 0; player.hitStun = 0; }   // anything before the swing (contact, its i-frames) is undone
        if (sw && (++after > 150 || sw.life <= 0)) break;   // until the swing (or the strike it left on screen) is over - a hit adds hit-stop
      }
    } finally { Math.random = oR; player._god = true; player.invulnerable = 9e9; player.hp = HP0; }
    const log = S.log; S.log = null; S.m = null;
    // late: the hero is shielded until then, so any loss is the swing
    const hitI = log.findIndex((q, i) => i > 0 && (late || q.live) && q.hp < log[i - 1].hp), K = _lxSwingAnimInfo(_lxSwingShapeOf(type));
    const at = hitI >= 0 ? log[hitI] : null, effAfter = hitI >= 0 ? log.slice(hitI).map((q) => q.eff).filter((e) => e != null) : [];
    return { inBox, boss, swung: !!sw, hit: hitI >= 0, k: K && K.k, n: K && K.n, eff: at && at.eff, mon: at && at.mon, monKey: at && at.mon && at.mon.set !== 'other' ? keyOf(at.mon.set, boss) : null, effMax: effAfter.length ? Math.max(...effAfter) : null };
  };
  const types = Object.keys(LX_SWING_SHAPE).filter((t) => _lxSwingAnimInfo(LX_SWING_SHAPE[t])), out = { all: {} };
  for (const t of types) { let r = await swingAt(t, 0); if (!r.hit) r = await swingAt(t, 0); out.all[t] = r; }   // one retry: a swing can be stepped out of by the AI
  out.late = { mob: await swingAt('willeo', 6), boss: await swingAt('legosaurus', 6) };
  return out;
});
const A = Object.entries(R.all), miss = A.filter(([, r]) => !r.hit).map(([t]) => t);
check(A.length === 27 && miss.length === 0, 'every animated swing lands on a hero standing in its box', { n: A.length, miss });   // 27 since v0.30.1591: Deranged Kuro's swing came back with him (v0.30.1627)
const offPeak = A.filter(([, r]) => r.hit && r.eff !== r.k).map(([t, r]) => ({ t, eff: r.eff, k: r.k }));
check(miss.length === 0 && offPeak.length === 0, 'PEAK: the hit lands on the render showing the effect\'s 5th frame (its strike)', offPeak);
const offStep = A.filter(([, r]) => r.hit && !(r.mon && r.mon.set !== 'other' && r.mon.i === r.monKey)).map(([t, r]) => ({ t, mon: r.mon, key: r.monKey }));
check(miss.length === 0 && offStep.length === 0, 'IN STEP: on the hit the monster shows the strike / key frame of the attack set it draws', offStep);
const gone = A.filter(([, r]) => r.hit && !(r.effMax >= r.k + 3)).map(([t, r]) => ({ t, effMax: r.effMax }));
check(miss.length === 0 && gone.length === 0, 'STAYS: after the hit the strike keeps drawing and plays its trail', gone);
const arb = R.all.towerArbiter || {};
check(!!(arb.hit && arb.mon && arb.mon.set === 'towerArbiter' && arb.mon.i === 6), 'ARBITER: his heavy swing plays his purple sword set, the slam (f6) on the hit', arb.mon);
check(!!(R.late.mob.inBox && !R.late.mob.hit && R.late.boss.inBox && !R.late.boss.hit), 'LATE: a hero stepping into the swing box after its peak frame is not hurt (Willeo, Legosaurus)', { mob: [R.late.mob.inBox, R.late.mob.hit], boss: [R.late.boss.inBox, R.late.boss.hit] });
check(errs.length === 0, 'no page errors', errs.slice(0, 3));
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
