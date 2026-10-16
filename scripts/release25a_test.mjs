// RELEASE 25a (a walking summon faces the way it is going; per user 2026-10-16: "the summons : wolve seem to be facing different
// directions when walking to one locations ensure the summons face one direction only when walking to a direction") stays fixed:
//   A Lv 80 Beastmaster calls the Wild Bond wolf (real F), the pack (real G) and the Apex Bond werewolf (real B), then walks left and right
//   with the real arrow keys - on the forest with nothing to hunt, and in Gemini's arena (zod_gemini) where the pack chases the twins.
//   Every drawWolf is sampled through the draw itself: the summon frame handed to _lxDrawSoft, the mirror of the transform it is drawn
//   under, and which way that frame's art faces (wolf_alpha_walk 2-6 and wolf_sky_walk 2-4 are drawn facing LEFT; every other summon
//   frame faces right - read off the art). Drawn facing = art x mirror.
//   [1] while walking (|vx| > 1, not biting) every summon faces its direction of travel (>= 97% of samples; was: a pup's walk faced the
//       other way on 5 of its 9 frames)
//   [2] summons walking the same way in the same frame all face the same way (>= 97% of those frames)
//   [3] no flicker: drawn-facing flips per second while a summon travels steadily one way stay ~0 (<= 0.3/s per summon)
//   [4] a bite still faces its foe (a pinned slime beside a standing hero; >= 95% of biting samples with the foe > 24 px aside;
//       a planted biter turns in place when its knocked-back foe passes it)
//   [5] the undead (two raised thralls) face their motion while walking (>= 95%; their draw mirrors exactly on facing < 0)
//   node release25a_test.mjs        PORT (default 15130) / MOJI_GAME_FILE / SERVE_ROOT; SHOTS=<png> writes a tiled strip of the pack walking
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15130), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const press = async (page, key, hold = 90) => { await page.keyboard.down(key); await page.waitForTimeout(hold); await page.keyboard.up(key); await page.waitForTimeout(120); };
// the recorder: drawWolf -> its _lxDrawSoft call (frame + transform); drawMinions -> each thrall's facing (its draw mirrors on facing < 0)
const recorder = () => {
  const LEFT = { wolf_alpha_walk: [2, 3, 4, 5, 6], wolf_sky_walk: [2, 3, 4] };   // the art: these frames are drawn facing left
  const artFace = (img) => { for (const tag in SUMMON_ANIM_FRAMES) { const a = SUMMON_ANIM_FRAMES[tag]; const i = a ? a.indexOf(img) : -1; if (i >= 0) return { f: (LEFT[tag] && LEFT[tag].indexOf(i) >= 0) ? -1 : 1, k: tag + '_' + i }; } return { f: 1, k: 'still' }; };
  let nid = 0, cur = null, base = 1, done = false; window.__rec = []; window.__on = false;
  const tgtDx = (e) => { const t = e._tgtRef; return (t && t.currentHp > 0) ? (t.x + t.w / 2) - (e.x + e.w / 2) : null; };
  const dw0 = window.drawWolf; window.drawWolf = function (pet) { cur = pet; done = false; base = Math.sign(ctx.getTransform().a) || 1; try { return dw0.apply(this, arguments); } finally { cur = null; } };
  const ds0 = window._lxDrawSoft; window._lxDrawSoft = function (c, img, dx, dy, w, h) {
    if (window.__on && cur && !done && c === ctx && w > 20) { done = true; const p = cur; if (!p.__id) p.__id = (p === player.ultPet ? 'ult' : p === player.pet ? 'pet' : 'pack') + (++nid);
      const a = artFace(img), mir = (Math.sign(ctx.getTransform().a) || 1) !== base;
      window.__rec.push({ id: p.__id, t: game.time, ph: window.__ph, vx: +(p.vx || 0).toFixed(2), fc: p.facing || 1, k: a.k, drawn: a.f * (mir ? -1 : 1), atk: _lxSummonAttacking(p), bite: (game.time || 0) < (p._atkAnimUntil || 0), tdx: tgtDx(p) }); }
    return ds0.apply(this, arguments); };
  const dm0 = window.drawMinions; window.drawMinions = function () {
    if (window.__on) for (const mn of game.minions || []) { if (!mn || mn.mojimon) continue; if (!mn.__id) mn.__id = mn.type + (++nid);
      window.__rec.push({ id: mn.__id, und: 1, t: game.time, ph: window.__ph, vx: +(mn.vx || 0).toFixed(2), fc: mn.facing || 1, drawn: (mn.facing | 0) < 0 ? -1 : 1, atk: _lxSummonAttacking(mn), tdx: mn._mnTgt && mn._mnTgt.currentHp > 0 ? (mn._mnTgt.x + mn._mnTgt.w / 2) - (mn.x + mn.w / 2) : null }); }
    return dm0.apply(this, arguments); };
};
const shots = [];
const snap = async (page) => { if (!process.env.SHOTS) return; const g = await page.evaluate(() => { window._r25.clear(); const L = [player.pet, ...(player.pack || [])].filter(Boolean); if (!L.length) return null;
    const cx = L.reduce((s, e) => s + e.x + e.w / 2, 0) / L.length - game.camera.x, cy = L.reduce((s, e) => s + e.y + e.h, 0) / L.length - (game.camera.y || 0);
    const r = document.getElementById('game').getBoundingClientRect(); const k = r.width / W; return { x: r.left + cx * k, y: r.top + cy * k, k, d: Math.sign(player.vx || 0) }; });
  if (!g) return; const w = 340 * g.k, h = 186 * g.k; const clip = { x: Math.max(0, g.x - w / 2), y: Math.max(0, g.y - h + 30 * g.k), width: w, height: h };
  try { shots.push({ b: await page.screenshot({ clip }), d: g.d }); } catch (e) {} };
const walkFor = async (page, key, ms, shotEvery) => { await page.keyboard.down(key); const t0 = Date.now(); let ns = shotEvery ? t0 + 600 : Infinity;
  while (Date.now() - t0 < ms) { await page.waitForTimeout(100); if (Date.now() >= ns) { await snap(page); ns += shotEvery; } } await page.keyboard.up(key); };
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 960, height: 560 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  console.log('  build', await page.evaluate(() => (typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : '?')));
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    if (player.cls !== 'archer') { try { applyClass('archer'); } catch (e) {} player.cls = 'archer'; }
    devSetLevel(80); try { applyJob('ranger'); } catch (e) {} try { applyMaster('beastmaster'); } catch (e) {}
    player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
    player._tutorialSeen = true; player._gravitosCineSeen = true; player._god = true;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const clear = () => { try { if (typeof _dismissBossIntro === 'function') _dismissBossIntro(); } catch (e) {} try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {} for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const e = document.getElementById(id); if (e) e.classList.remove('on'); } { const am = document.getElementById('advancement-modal'); if (am) am.style.display = 'none'; } { const tm = document.getElementById('tutorial-modal'); if (tm && (tm.classList.contains('tut-dock') || getComputedStyle(tm).display !== 'none')) try { _closeTutorial(true); } catch (e) {} } game.paused = false; };
    window._r25 = { sleep, clear, calm: () => { player.hitStun = 0; player.stunTimer = 0; player.hp = getMaxHp(); player.mp = player.maxMp = 99999; player.skillCooldowns = {}; const tm = document.getElementById('tutorial-modal'); if (tm && tm.classList.contains('tut-dock')) try { _closeTutorial(true); } catch (e) {} } };
    clear(); loadMap('forest', 1500); await sleep(1200); clear();
  });
  await page.evaluate(recorder);
  // ---- summon with the real keys: F (Wild Bond), G x2 (Call of the Wild), B (Apex Bond); castSkill only if a press never lands (reported)
  const how = {};
  for (const [key, id, has] of [['f', 'wildBond', '!!player.pet'], ['g', 'beastmaster_pack', '(player.pack || []).length >= 2'], ['g', 'beastmaster_pack', '(player.pack || []).length >= 3'], ['b', 'beastmaster_ult', '!!player.ultPet']]) {
    how[id] = how[id] || 'key';
    for (let i = 0; i < 4 && !(await page.evaluate(has)); i++) { await page.evaluate(() => { window._r25.clear(); window._r25.calm(); game.monsters = []; }); await press(page, key, 140); await page.waitForTimeout(500); }
    if (!(await page.evaluate(has))) { how[id] = 'castSkill'; await page.evaluate((s) => { window._r25.calm(); try { castSkill(s); } catch (e) {} }, id); await page.waitForTimeout(400); }
  }
  await page.evaluate(() => { const x = player.x + player.w / 2; raiseMinion(x - 60, player.y, 'skeleton'); raiseMinion(x + 60, player.y, 'zombie'); for (const m of game.minions) if (m && !m.mojimon) m.life = 1e9;
    for (const e of [player.pet, player.ultPet, ...(player.pack || [])]) if (e) { e.life = 1e9; e.hp = e.maxHp = 1e12; } });
  const S0 = await page.evaluate(() => ({ cls: player.cls, job: player.job, master: player.master, lv: player.level, pet: !!player.pet, ult: player.ultPet && player.ultPet.sprite, pack: (player.pack || []).length, und: (game.minions || []).filter((m) => m && !m.mojimon).length }));
  ok('[setup] a Lv 80 Beastmaster with the Wild Bond wolf, the pack and the werewolf out (' + JSON.stringify(how) + '), two thralls raised', S0.master === 'beastmaster' && S0.pet && S0.ult === 'werewolf' && S0.pack >= 2 && S0.und === 2, S0);
  // ---- the forest: nothing to hunt, the hero walks right / left / right / left with the real arrow keys
  const quiet = setInterval(() => page.evaluate(() => { game.monsters = []; window._r25.calm(); }).catch(() => {}), 150);
  await page.evaluate(() => { window.__ph = 'forest'; window.__on = true; });
  await walkFor(page, 'ArrowRight', 2600); await walkFor(page, 'ArrowLeft', 2600); await walkFor(page, 'ArrowRight', 2400, 400); await walkFor(page, 'ArrowLeft', 2400, 400);
  clearInterval(quiet); await page.evaluate(() => { window.__on = false; });
  // ---- a bite: a pinned slime beside the standing hero
  await page.evaluate(() => { window._r25.calm(); game.monsters = []; const m = spawnMonster(player.x + player.w / 2 + 170, player.y, 'slime', false, false); if (m) { m.maxHp = m.currentHp = 1e12; if (game.monsters.indexOf(m) < 0) game.monsters.push(m); } window.__slime = m; window.__slimeAt = m ? [Math.round(m.x), Math.round(m.y), m.type] : null; window.__ph = 'bite'; window.__on = true; });
  const pin = setInterval(() => page.evaluate(() => { const m = window.__slime; if (m) { m.currentHp = m.maxHp; m.vx = 0; m.knockVx = 0; } game.monsters = game.monsters.filter((x) => x === m); if (m && game.monsters.indexOf(m) < 0) game.monsters.push(m); window._r25.calm(); }).catch(() => {}), 120);
  await page.waitForTimeout(6000); clearInterval(pin); await page.evaluate(() => { window.__on = false; game.monsters = []; });
  // ---- Gemini's arena: the pack chases the twins while the hero walks
  await page.evaluate(async () => { const { clear, sleep, calm } = window._r25; clear(); loadMap('zod_gemini', 300); for (let i = 0; i < 10; i++) { await sleep(250); clear(); } calm(); window.__ph = 'arena'; window.__on = true; });
  const calmA = setInterval(() => page.evaluate(() => { window._r25.clear(); window._r25.calm(); for (const e of [player.pet, player.ultPet, ...(player.pack || [])]) if (e) e.hp = e.maxHp; }).catch(() => {}), 200);
  for (let k = 0; k < 2; k++) { await walkFor(page, 'ArrowRight', 2200); await walkFor(page, 'ArrowLeft', 2200); }
  clearInterval(calmA);
  const R = await page.evaluate(() => { window.__on = false; return { slime: window.__slimeAt, rec: window.__rec, boss: (game.monsters || []).filter((m) => m && m.currentHp > 0 && (m.isBoss || m.zodiacBoss)).map((m) => m.type), map: game.currentMap }; });
  // ---- the pins
  const rec = R.rec, W = rec.filter((r) => !r.und), U = rec.filter((r) => r.und), sg = (v) => (v > 0 ? 1 : -1);
  const mv = (L) => L.filter((r) => Math.abs(r.vx) > 1 && !r.atk), rate = (L, f) => (L.length ? L.filter(f).length / L.length : 0);
  const by = (ph) => { const L = mv(W.filter((r) => r.ph === ph)); const bad = {}; for (const r of L) if (r.drawn !== sg(r.vx)) bad[r.k] = (bad[r.k] || 0) + 1;
    return { n: L.length, ok: +rate(L, (r) => r.drawn === sg(r.vx)).toFixed(3), wrongFrames: bad }; };
  const F = by('forest'), A = by('arena');
  ok('[1a] forest: every summon walking with the hero faces its travel (>= 97%; was: the pups\' walk frames 2-6 faced back)', F.n > 150 && F.ok >= 0.97, F);
  ok('[1b] Gemini\'s arena: every summon chasing / following faces its travel (>= 97%)', A.n > 40 && A.ok >= 0.97, { ...A, boss: R.boss, map: R.map });
  const frames = {}; for (const r of mv(W)) (frames[r.ph + r.t] || (frames[r.ph + r.t] = [])).push(r);
  let grp = 0, agree = 0; for (const k in frames) for (const d of [1, -1]) { const L = frames[k].filter((r) => sg(r.vx) === d); if (L.length < 2) continue; grp++; if (L.every((r) => r.drawn === L[0].drawn)) agree++; }
  ok('[2] summons walking the same way in the same frame all face the same way (>= 97% of ' + grp + ' frames)', grp > 60 && agree / grp >= 0.97, { grp, agree });
  const per = {}; for (const r of W) (per[r.id] || (per[r.id] = [])).push(r);
  let flips = 0, secs = 0; for (const id in per) { const L = per[id]; for (let i = 1; i < L.length; i++) { const a = L[i - 1], b = L[i];
    if (a.ph !== b.ph || a.atk || b.atk || Math.abs(a.vx) <= 1 || Math.abs(b.vx) <= 1 || sg(a.vx) !== sg(b.vx)) continue; secs += Math.max(0, b.t - a.t) / 60; if (a.drawn !== b.drawn) flips++; } }
  ok('[3] no flicker: drawn-facing flips while travelling steadily one way <= 0.3 per summon-second', secs > 20 && flips / secs <= 0.3, { flips, secs: +secs.toFixed(1), perSec: +(flips / Math.max(1, secs)).toFixed(2) });
  const B = W.filter((r) => r.ph === 'bite' && r.atk && r.tdx != null && Math.abs(r.tdx) > 24);
  ok('[4] a bite faces its foe (>= 95% of biting samples)', B.length > 20 && rate(B, (r) => r.drawn === sg(r.tdx)) >= 0.95, { n: B.length, ok: +rate(B, (r) => r.drawn === sg(r.tdx)).toFixed(3), wrong: B.filter((r) => r.drawn !== sg(r.tdx)).slice(0, 12).map((r) => [r.id, r.bite ? 'bite' : 'pose', Math.round(r.tdx), r.t]), slime: R.slime, biteSamples: W.filter((r) => r.ph === 'bite').length, atk: W.filter((r) => r.ph === 'bite' && r.atk).length, tdx: W.filter((r) => r.ph === 'bite' && r.atk).slice(0, 6).map((r) => r.tdx) });
  const UM = mv(U);
  ok('[5] the undead face their motion while walking (>= 95%)', UM.length > 80 && rate(UM, (r) => r.drawn === sg(r.vx)) >= 0.95, { n: UM.length, ok: +rate(UM, (r) => r.drawn === sg(r.vx)).toFixed(3) });
  if (process.env.SHOTS && shots.length) { const sharp = require('sharp'); const lab = (d) => Buffer.from('<svg width="420" height="230"><rect x="6" y="200" width="200" height="24" rx="5" fill="#000" fill-opacity="0.7"/><text x="14" y="218" font-family="Arial" font-size="16" font-weight="bold" fill="#ffe14a">' + (d > 0 ? 'hero walking RIGHT &gt;&gt;' : d < 0 ? '&lt;&lt; hero walking LEFT' : 'hero standing') + '</text></svg>');
    const ms = await Promise.all(shots.slice(0, 8).map((x) => sharp(x.b).resize(420, 230, { fit: 'fill' }).composite([{ input: lab(x.d), left: 0, top: 0 }]).png().toBuffer()));
    const cols = 4, rows = Math.ceil(ms.length / cols); await sharp({ create: { width: 420 * cols, height: 230 * rows, channels: 3, background: '#111' } }).composite(ms.map((b, i) => ({ input: b, left: (i % cols) * 420, top: Math.floor(i / cols) * 230 }))).png().toFile(process.env.SHOTS);
    console.log('  strip', process.env.SHOTS, ms.length); }
} catch (e) { ok('no exception', false, String(e && e.stack || e).slice(0, 400)); }
ok('no page errors', errs.length === 0, errs.slice(0, 5));
await browser.close(); try { server.kill(); } catch (e) {}
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
