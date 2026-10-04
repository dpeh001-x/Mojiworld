// GRAVITOS FORMS 2 AND 3 PLAY MORE OF THEIR OWN CASTS (v0.30.1624). Per user: "Gravitos 2 and 3 should play more of their other
// attack animations as well if not it looks rather bland". Drives the REAL boss draw (drawMonster) for every regular move of
// each form, planted and mid-move, and reads which art file each draw blits.
//   1. forms 2/3: Decay Floor -> the form's punch, Black Hole / Gravity Well (and form 3's Crush Tendrils) -> its soul cast,
//      the Void Ring -> its laser cast; Chase Comets and the Weight Wave keep the chest blast (the generic attack set)
//   2. unchanged: laser / zip / crush / slam / Soul Drain still draw their own sets; form 1 is untouched
//   3. ON THE MOVE'S MOMENT: the Decay Floor, Black Hole and Void Ring draw their cast's key frame when the move fires
//   4. variety: by the AI's own ladder weights, the generic set now covers at most 25% of each form's regular moves (was 59 / 71%)
//   5. no page errors
//   node scripts/gravitos_form_variety_test.mjs      (PORT=..., MOJI_GAME_FILE=...)
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = (process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')).replace(/\\/g, '/');
const require = createRequire(import.meta.url);
const { chromium } = require(ROOT + '/node_modules/playwright-core');
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 12967);
const res = []; const ok = (n, c, x) => { res.push(!!c); console.log((c ? 'PASS ' : 'FAIL ') + n + (x === undefined ? '' : '  [' + String(x).slice(0, 500) + ']')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--mute-audio'] });
// the AI's regular ladders (mojiworld_game.html, the phase-1/2/3 _gPick rolls), as weights
const LADDER = { 2: { laser: 13, zip: 11, crush: 10, slam: 11, wave: 11, chaseComets: 11, orbitalRing: 9, blackhole: 11, decayFloor: 3, pull: 10 },
  3: { laser: 11, zip: 9, slam: 9, wave: 9, blackhole: 9, chaseComets: 11, orbitalRing: 11, crushTendrils: 11, decayFloor: 10, pull: 10 },
  1: { laser: 20, zip: 16, crush: 16, slam: 18, chaseComets: 18, pull: 12 } };
try {
  const cx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } });
  await cx.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const page = await cx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function' && typeof drawMonster === 'function', null, { timeout: 180000 });
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu', 'void-intro-overlay']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = player._storyBeatsSeen || {}; if (typeof STORY_BEATS === 'object') for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
    player._tutorialSeen = true; player._gravitosCineSeen = true; applyClass('warrior'); player.level = 90;
    loadMap('forest', 300); await new Promise((r) => setTimeout(r, 2000)); try { closeAllModals(); } catch (e) {} game.paused = false;
    try { _lxBossArtWant('gravitos', true); } catch (e) {}
  });
  await page.waitForFunction(() => ['gravitos', 'gravitos2', 'gravitos3', 'gravitospunch', 'gravitossoul', 'gravitoslaser', 'gravitos2punch', 'gravitos2soul', 'gravitos2laser', 'gravitos3punch', 'gravitos3soul', 'gravitos3laser']
    .every((k) => BOSS_ATTACK_FRAMES[k] && BOSS_ATTACK_FRAMES[k].length && BOSS_ATTACK_FRAMES[k].every((f) => f && (f.naturalWidth || f.width) > 0)), null, { timeout: 180000 }).catch(() => {});
  const R = await page.evaluate((LADDER) => {
    game.monsters.length = 0; game.projectiles.length = 0;
    const m = spawnMonster(player.x + 420, player.y - 200, 'gravitos', true);
    game.paused = true; m.vx = 0; m.vy = 0;
    const name = (im) => { const s = String((im && (im.src || (im._lxSrc && im._lxSrc.src))) || ''); return decodeURIComponent(s.split('?')[0].split('/').pop()); };
    const orig = window._drawBossSprite; let got = null;
    window._drawBossSprite = function (sp) { got = name(sp); return orig.apply(this, arguments); };
    const draw = (form, pattern, t) => {
      m._gravitosPhase = form; m.phase = form; m._phaseSprite = form === 1 ? null : 'gravitos' + form;
      m.patternState = pattern; m.patternTimer = t; m._lxLastMoveAt = 0; m._lxCalE = null; m.atkAnimUntil = 0; m._tpWindMs = 0;
      got = null; try { drawMonster(m); } catch (e) { return 'ERR ' + String(e).slice(0, 60); }
      return got;
    };
    const out = {}, key = {};
    for (const form of [1, 2, 3]) for (const p of Object.keys(LADDER[form]).concat(['soulDrain'])) out[form + '/' + p] = draw(form, p, 300);
    // the key frame on the move's moment: the AI fires on the first step past its threshold (_gravOnceHitMs)
    for (const [form, p] of [[2, 'decayFloor'], [2, 'blackhole'], [2, 'orbitalRing'], [3, 'decayFloor'], [3, 'blackhole'], [3, 'orbitalRing']]) {
      m._gravitosPhase = form; m.phase = form; m._phaseSprite = 'gravitos' + form; m.patternState = p;
      const c = _GRAV_FORM_CASTS[p], k = _gravCastKey(m, c), n = BOSS_ATTACK_FRAMES[k].length, ft = _lxCalibFt(k, 'attack');
      const hit = _gravOnceHitMs(m), kf = ft ? _lxBossKeyFrame(k, n, ft) : null;
      key[form + '/' + p] = { k, kf, hit, drew: draw(form, p, Math.floor(hit) + 1), before: draw(form, p, Math.max(0, hit - 120)) };   // the AI fires on the first step past the threshold
    }
    window._drawBossSprite = orig; game.paused = false; game.monsters.length = 0;
    return { out, key };
  }, LADDER);
  const set = (f) => (f || '').replace(/_\d+\.webp$/, '');
  const want = { 2: { decayFloor: 'gravitos2punch', blackhole: 'gravitos2soul', pull: 'gravitos2soul', orbitalRing: 'gravitos2laser', chaseComets: 'gravitos2', wave: 'gravitos2' },
    3: { decayFloor: 'gravitos3punch', blackhole: 'gravitos3soul', pull: 'gravitos3soul', crushTendrils: 'gravitos3soul', orbitalRing: 'gravitos3laser', chaseComets: 'gravitos3', wave: 'gravitos3' } };
  const bad1 = []; for (const f of [2, 3]) for (const [p, s] of Object.entries(want[f])) if (set(R.out[f + '/' + p]) !== s) bad1.push(`${f}/${p}: ${R.out[f + '/' + p]} (want ${s}_*)`);
  ok('1. forms 2/3: Decay Floor -> punch, Black Hole / Gravity Well / Crush Tendrils -> soul, Void Ring -> laser; comets and wave keep the chest blast', bad1.length === 0,
    bad1.join('; ') || Object.entries(R.out).filter(([k]) => !k.startsWith('1/')).map(([k, v]) => k + '=' + set(v)).join(' '));
  const keep = { '2/laser': 'gravitos2laser', '2/zip': 'gravitos2punch', '2/crush': 'gravitos2punch', '2/slam': 'gravitos2punch', '2/soulDrain': 'gravitos2soul',
    '3/laser': 'gravitos3laser', '3/zip': 'gravitos3punch', '3/slam': 'gravitos3punch', '3/soulDrain': 'gravitos3soul',
    '1/laser': 'gravitoslaser', '1/zip': 'gravitospunch', '1/crush': 'gravitospunch', '1/slam': 'gravitospunch', '1/soulDrain': 'gravitossoul', '1/chaseComets': 'gravitos', '1/pull': 'gravitos' };
  const bad2 = Object.entries(keep).filter(([k, s]) => set(R.out[k]) !== s).map(([k, s]) => `${k}: ${R.out[k]} (want ${s}_*)`);
  ok('2. unchanged: laser / zip / crush / slam / Soul Drain keep their own sets on every form; form 1 untouched', bad2.length === 0, bad2.join('; ') || 'all as before');
  const bad3 = Object.entries(R.key).filter(([, v]) => !(v.kf != null && v.drew === `${v.k}_${v.kf}.webp` && v.before !== v.drew)).map(([k, v]) => `${k}: drew ${v.drew} at ${Math.round(v.hit)} (key ${v.k}_${v.kf}, 120 ms before ${v.before})`);
  ok('3. ON THE MOVE\'S MOMENT: each new cast draws its key frame as the move fires (and not before)', bad3.length === 0, bad3.join('; ') || Object.entries(R.key).map(([k, v]) => `${k} ${v.drew}`).join(' '));
  const share = {}; for (const f of [2, 3]) { let g = 0, t = 0; for (const [p, w] of Object.entries(LADDER[f])) { t += w; if (set(R.out[f + '/' + p]) === 'gravitos' + f) g += w; } share[f] = g / t; }
  ok('4. variety: the generic chest blast covers at most 25% of forms 2 and 3\'s regular moves', share[2] <= 0.25 && share[3] <= 0.25, `form 2 ${(share[2] * 100).toFixed(0)}%, form 3 ${(share[3] * 100).toFixed(0)}%`);
  ok('5. no page errors', errs.length === 0, JSON.stringify(errs.slice(0, 3)));
} finally { await browser.close(); server.kill(); }
const fail = res.filter((x) => !x).length; console.log(`\n${res.length - fail}/${res.length} passed`); process.exit(fail ? 1 : 0);
