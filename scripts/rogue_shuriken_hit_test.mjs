// THE ROGUE'S THIRD HIT MARK IS A SHURIKEN, AND ONLY THE SHURIKEN SKILLS LAND IT (v0.30.1459). Per user the crescent (hit_rogue_3)
// was redrawn as a different kind of hit mark - a four-point throwing star that flashes, cracks apart and fades - and "use only
// this hit mark when using the shuriken skills and not others". The game still mirrors it on a blow from the monster's right.
//   1. the art is the star: the still and every frame of its burst keep a four-fold magenta shape (overlap with itself turned
//      90 degrees; the crescent scored 0.06-0.08), centred;
//   2. the starburst (the Rogue's FIRST spark) plays straight again: its frame 3 - fx/anim/hit_rogue_3.webp, a name the
//      crescent's set never owned - was mirrored with the crescent in v0.30.1447; it must line up with frames 2 and 4;
//   3. in game, every Rogue skill CAST FOR REAL against pinned dummies: Shuriken, Shin-Shuriken, Bloodmoon Domain and Voidwalk
//      land the shuriken mark and nothing else; no other Rogue skill ever lands it, and those share the other two designs;
//   4. from the monster's left the mark is drawn as is, from its right mirrored; a round-burst spark is never mirrored.
//   node scripts/rogue_shuriken_hit_test.mjs [port]      (MOJI_SERVE_ROOT overrides the served tree)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs'); const sharp = require('sharp');
const PORT = Number(process.argv[2] || process.env.PORT || 10267); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  ' + JSON.stringify(note) : '')); };
const SHURIKEN = ['throwDagger', 'smokeBomb', 'nightreaper_ult', 'phantom_ult'];   // the shuriken skills (per user)
const art = (rel) => path.join(SERVE_ROOT, 'Sprites', rel);
// ---- 1. four-fold: IoU of the bright-magenta mask with itself turned 90 degrees about its centroid
async function fold(file) {
  const { data } = await sharp(file).ensureAlpha().resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).raw().toBuffer({ resolveWithObject: true });
  const W = 256, M = new Uint8Array(W * W); let sx = 0, sy = 0, n = 0;
  for (let k = 0; k < W * W; k++) { const q = k * 4; if (data[q + 3] > 128 && data[q] > 150 && data[q + 2] > 150 && data[q + 1] < 140) { M[k] = 1; sx += k % W; sy += (k / W) | 0; n++; } }
  if (n < 200) return null;
  const cx = sx / n, cy = sy / n; let I = 0, U = 0;
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const a = M[y * W + x], rx = Math.round(cx - (y - cy)), ry = Math.round(cy + (x - cx)); const b = rx >= 0 && ry >= 0 && rx < W && ry < W ? M[ry * W + rx] : 0; if (a && b) I++; if (a || b) U++; }
  return { iou: +(I / U).toFixed(2), cx: +(cx / W).toFixed(2), cy: +(cy / W).toFixed(2) };
}
const still = await fold(art('fx/hit_rogue_3.webp'));
ok('the still is a four-point star, centred (90-degree overlap >= 0.45; the crescent was 0.08)', !!still && still.iou >= 0.45 && Math.abs(still.cx - 0.5) < 0.08 && Math.abs(still.cy - 0.5) < 0.08, still);
const frames = []; for (let i = 0; i < 9; i++) frames.push(await fold(art(`fx/anim/hit_rogue_3_${i}.webp`)));
const shown = frames.slice(0, 5);   // the star holds its shape through the first five frames, then breaks into flecks
ok('the burst keeps the star shape while it is whole (frames 0-4 overlap >= 0.40)', shown.every((f) => f && f.iou >= 0.40), frames.map((f) => f && f.iou));
// ---- 2. the starburst's frame 3 lines up with its neighbours (not mirrored)
const px = async (rel, flop) => { let s = sharp(art(rel)).ensureAlpha(); if (flop) s = s.flop(); return s.raw().toBuffer(); };
const dif = (A, B) => { let d = 0; for (let p = 0; p < A.length; p += 4) d += Math.abs(A[p] - B[p]) + Math.abs(A[p + 1] - B[p + 1]) + Math.abs(A[p + 2] - B[p + 2]) + 2 * Math.abs(A[p + 3] - B[p + 3]); return d / (A.length / 4); };
{ const f2 = await px('fx/anim/hit_rogue_2.webp'), f4 = await px('fx/anim/hit_rogue_4.webp'), a = await px('fx/anim/hit_rogue_3.webp'), b = await px('fx/anim/hit_rogue_3.webp', true);
  const asIs = dif(a, f2) + dif(a, f4), flipped = dif(b, f2) + dif(b, f4);
  ok('the starburst\'s frame 3 is the right way round (closer to frames 2 and 4 than its mirror is)', asIs < 0.8 * flipped, { asIs: +asIs.toFixed(1), mirrored: +flipped.toFixed(1) }); }
// ---- 3 + 4. in game
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof castSkill === 'function' && typeof _lxHitVariant === 'function', null, { timeout: 180000 }); await page.waitForTimeout(5000);
  const r = await page.evaluate(async (SHURIKEN) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const out = { ver: GAME_VERSION, cast: {} };
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {} try { _cineScoreStop(1, false); } catch (e) {}
    try { loadMap('forest', 300); } catch (e) {} await sleep(2500); game.paused = false;
    for (let i = 0; i < 30 && !player.onGround; i++) await sleep(100);
    const _x0 = player.x, _y0 = player.y; window.rollCrit = () => false;
    let log = null; const seen = []; const oB = window.spawnSpriteBurst;
    window.spawnSpriteBurst = function (x, y, key, opts) { if (/^hit_rogue/.test(String(key))) { if (log) log[key] = (log[key] || 0) + 1; seen.push({ key, flipX: !!(opts && opts.flipX) }); } return oB.apply(this, arguments); };
    try {
      // ---- every Rogue skill cast for real against six pinned dummies
      let dummies = [];
      const mk = () => { game.monsters.length = 0; dummies = [];
        for (const [dx, dy] of [[150, -10], [230, -10], [320, -10], [-160, -10], [60, -10], [150, -150]]) { const m = spawnMonster(player.x + dx, player.y + dy, 'slime', false); if (!m) continue;
          m.w = 60; m.h = 60; m.maxHp = 9e12; m.currentHp = 9e12; m.evasion = 0; m.speed = 0; m.atk = 0; m._pinX = m.x = player.x + dx; m._pinY = m.y = player.y + dy; m.vx = m.vy = 0; m.frozen = 99999; m.stunTimer = 99999; dummies.push(m); } };
      const setup = (id) => { const sk = SKILLS[id];
        player.x = _x0; player.y = _y0; player.vx = 0; player.vy = 0; player.attackTimer = 0; player.state = 'idle';
        player.cls = sk.cls; player.job = sk.job || null; player.masteries = {}; player.master = sk.master || null; if (sk.master) player.masteries[sk.master] = true;
        player._god = true; player.level = 90; player.maxMp = 99999; player.mp = 99999; player.maxHp = 999999; player.hp = 999999; player.facing = 1; player._releasedCharge = 1;
        if (game.minions) game.minions.length = 0; player._clones = null; player._shade = null;
        for (const k of Object.keys(player.skillCooldowns || {})) player.skillCooldowns[k] = 0; if (player.cooldowns) for (const k of Object.keys(player.cooldowns)) player.cooldowns[k] = 0;
        game.projectiles.length = 0; if (game.hazards) game.hazards.length = 0; if (game.smoothFx) game.smoothFx.length = 0; };
      for (const id of Object.keys(SKILLS).filter((k) => SKILLS[k] && SKILLS[k].cls === 'rogue')) {
        setup(id); mk(); for (let i = 0; i < 20 && !player.onGround; i++) await sleep(100); await sleep(250);
        log = {}; try { castSkill(id); } catch (e) {}
        const win = /_ult$|shadowlord_clones|nightreaper_mark/.test(id) ? 5000 : 2500;   // one mark per game frame: let every frame show one
        const t0 = performance.now(); while (performance.now() - t0 < win) { await sleep(150); game._lastClassHitFxFrame = -99; for (const m of dummies) { m.frozen = 99999; m.stunTimer = 99999; m.vx = 0; m.x = m._pinX; m.y = m._pinY; m.currentHp = 9e12; } }
        out.cast[id] = log; log = null;
      }
      // ---- the mirror: one Shuriken blow from each side, and a Stab (a round burst) from the right
      setup('throwDagger'); game.paused = true; game.monsters.length = 0; const floor = player.y + player.h;
      const got = spawnMonster(player.x + 300, floor - monsterTypes.slime.h, 'slime', false); const m = (got && got.type) ? got : game.monsters.filter((x) => x && x.type === 'slime').pop();
      if (!m) return Object.assign(out, { err: 'no slime' });
      m.currentHp = m.maxHp = 1e12; m.evasion = 0;
      const hit = (skill, side) => {
        player.x = side === 'left' ? m.x - 60 : m.x + m.w + 32; player.y = floor - player.h;
        const n0 = seen.length; game._lastClassHitFxFrame = -99; player._lxSureHit = true;
        try { hitMonster(m, 50, false, skill); } finally { player._lxSureHit = false; }
        return seen.slice(n0);
      };
      out.fromLeft = hit('throwDagger', 'left'); out.fromRight = hit('throwDagger', 'right'); out.roundFromRight = hit('stab', 'right');
    } finally { window.spawnSpriteBurst = oB; }
    return out;
  }, SHURIKEN);
  console.log('build ' + r.ver);
  if (r.err) ok('harness: ' + r.err, false);
  else {
    const c = r.cast, star = (id) => (c[id] || {}).hit_rogue_3 | 0, marks = (id) => Object.keys(c[id] || {});
    for (const id of Object.keys(c)) console.log('  ' + id.padEnd(20) + JSON.stringify(c[id]));
    ok('Shuriken, Shin-Shuriken, Bloodmoon Domain and Voidwalk land the shuriken mark and ONLY it', SHURIKEN.every((id) => star(id) > 0 && marks(id).length === 1), SHURIKEN.map((id) => id + ':' + marks(id).join('+')));
    const rest = Object.keys(c).filter((id) => !SHURIKEN.includes(id)), landed = rest.filter((id) => marks(id).length);
    ok('no other Rogue skill lands the shuriken mark (and at least 10 of them landed a mark, so this is not vacuous)', landed.length >= 10 && rest.every((id) => !star(id)), rest.filter((id) => star(id)));
    ok('...and those skills share the other two designs', landed.some((id) => (c[id].hit_rogue | 0) > 0) && landed.some((id) => (c[id].hit_rogue_2 | 0) > 0));
    const one = (a, k) => (a || []).find((b) => b.key === k);
    ok('a Shuriken blow from the monster\'s LEFT draws the mark as it is', !!one(r.fromLeft, 'hit_rogue_3') && one(r.fromLeft, 'hit_rogue_3').flipX === false, r.fromLeft);
    ok('a Shuriken blow from the monster\'s RIGHT draws it mirrored', !!one(r.fromRight, 'hit_rogue_3') && one(r.fromRight, 'hit_rogue_3').flipX === true, r.fromRight);
    ok('CONTROL: a round-burst spark (Stab) is never mirrored', !!one(r.roundFromRight, 'hit_rogue') && one(r.roundFromRight, 'hit_rogue').flipX === false, r.roundFromRight);
  }
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 300)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
