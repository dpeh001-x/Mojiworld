// Gravitos stands on the floor with BOTH feet, the same shallow way in every sprite sequence - and within a form, on the
// same two lines in every frame of every sequence.
// ============================================================================
// Per user: "Some of gravitos sprites go under the floor line too much, some too shallow, lets standardise it to
// shallow", then "Both legs need to be considered not just 1" and "it should be for all sprite sequence" (v0.30.1565);
// then "The main comparison is within the form rather than between the forms, to ensure the the foot height stays as
// constant as possible to produce a smooth animation" and "Perhaps should follow form 3 and lock into one fixed baked
// calibration" (v0.30.1578). Forms 1 and 2 now share ONE calibration across their sets, like form 3: each set's old
// scale / offset was baked into its frames, and every frame was moved so his feet stay on the form's lines.
// Every frame of every gravitos* set (forms 1-3: idle / walk / attack, and the punch / laser / soul / star casts) is
// drawn alone through the game's own _drawBossSprite, in the right form and cast key, on a flat canvas. Per frame, each
// foot's sole is the lowest row of its half of the figure holding a run of >= 8 opaque px; + = under the floor line.
//   1. ALL SEQUENCES: 20 sets, every frame drawn as itself (no stand-in frame)
//   2. ONE CALIBRATION PER FORM: every body set of a form (idle / walk / attack, punch / soul / laser, the star cast's
//      idle / walk) has the same s / dx / dy; only the star cast's attack keeps its own
//   3. BOTH FEET DOWN: in every set the far (higher) foot, at its median over the set's frames, rests 1-5 px into the floor
//   4. SHALLOW: no set's near (lower) foot sinks past 18 px at its median - it was 20-26 px in eight sets
//   5. ON THE FORM'S LINES (forms 1, 2): the lines are idle's near / far foot. In every frame he stands in (not the
//      punch leap), the foot nearest its line is within 2 px of it and neither foot is more than 2 px below its line
//   6. no page errors
// Run: node scripts/gravitos_feet_plant_test.mjs   (PORT=..., MOJI_GAME_FILE=... for another build)
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = (process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')).replace(/\\/g, '/');
const require = createRequire(import.meta.url);
const { chromium } = require(ROOT + '/node_modules/playwright-core');
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 12953);
const res = [];
const ok = (n, c, extra) => { res.push({ n, pass: !!c }); console.log((c ? 'PASS ' : 'FAIL ') + n + (extra === undefined ? '' : '  [' + String(extra).slice(0, 400) + ']')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--mute-audio'] });
try {
  const cx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } });
  await cx.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const page = await cx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function' && typeof _drawBossSprite === 'function', null, { timeout: 180000 });
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu', 'void-intro-overlay']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = player._storyBeatsSeen || {}; if (typeof STORY_BEATS === 'object') for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
    player._tutorialSeen = true; player._gravitosCineSeen = true; applyClass('warrior'); player.level = 90;
    loadMap('forest', 300); await new Promise((r) => setTimeout(r, 2000)); try { closeAllModals(); } catch (e) {} game.paused = false;
    try { _lxBossArtWant('gravitos', true); } catch (e) {}
  });
  const sets = await page.evaluate(() => { const out = []; for (const [st, M] of [['idle', BOSS_IDLE_FRAMES], ['walk', BOSS_WALK_FRAMES], ['attack', BOSS_ATTACK_FRAMES]]) for (const k in M) if (/^gravitos/.test(k) && M[k] && M[k].length) out.push([st, k]); return out; });
  await page.waitForFunction((sets) => sets.every(([st, k]) => { const M = st === 'idle' ? BOSS_IDLE_FRAMES : st === 'walk' ? BOSS_WALK_FRAMES : BOSS_ATTACK_FRAMES; return M[k].every((f) => f && (f.naturalWidth || f.width) > 0); }), sets, { timeout: 180000 }).catch(() => {});
  const R = await page.evaluate((sets) => {
    game.monsters.length = 0; game.projectiles.length = 0;
    const m = spawnMonster(player.x + 420, player.y - 200, 'gravitos', true);
    const orig = window._drawBossSprite, cv = document.querySelector('canvas'), c2 = cv.getContext('2d'), W = cv.width, H = cv.height;
    game.paused = true;
    const sx = Math.round(W / 2 - m.w / 2), sy = Math.round(H - 220 - m.h), lineY = sy + m.h, mid = sx + m.w / 2;
    const out = {}; let distinct = true;
    for (const [st, k] of sets) {
      const M = st === 'idle' ? BOSS_IDLE_FRAMES : st === 'walk' ? BOSS_WALK_FRAMES : BOSS_ATTACK_FRAMES, fr = M[k];
      const f = /^gravitos3/.test(k) ? 3 : /^gravitos2/.test(k) ? 2 : 1, cast = !(k === 'gravitos' || k === 'gravitos2' || k === 'gravitos3');
      m._gravitosPhase = f; m._phaseSprite = f === 1 ? null : 'gravitos' + f; m._gravStarKey = cast ? k : null;
      fr._lxStandInOff = true;   // draw each frame as itself
      const L = [], Rr = [], sigs = new Set();
      for (let i = 0; i < fr.length; i++) {
        m._lxCalE = null; m.facing = 1;
        c2.save(); c2.setTransform(1, 0, 0, 1, 0, 0); c2.fillStyle = '#00ff00'; c2.fillRect(0, 0, W, H);
        orig(fr[i], m, sx, sy, st === 'attack', true);
        c2.restore();
        const d = c2.getImageData(0, 0, W, H).data, ink = (x, y) => { const q = (y * W + x) * 4; return d[q] + Math.abs(d[q + 1] - 255) + d[q + 2] > 90; };
        const sole = (x0, x1) => { for (let y = H - 1; y >= 0; y--) { let run = 0; for (let x = x0; x < x1; x++) { if (ink(x, y)) { if (++run >= 8) { let e = x; while (e + 1 < x1 && ink(e + 1, y)) e++; return { y: y - lineY + 1, x: Math.round((x - run + 1 + e) / 2 - mid) }; } } else run = 0; } } return null; };
        L.push(sole(Math.max(0, Math.round(mid - 260)), Math.round(mid))); Rr.push(sole(Math.round(mid), Math.min(W, Math.round(mid + 260))));
        let sig = 0; for (let y = lineY - 300; y < lineY + 40; y += 7) for (let x = Math.round(mid - 250); x < mid + 250; x += 7) if (ink(x, y)) sig = (sig * 31 + x * 7 + y) | 0; sigs.add(sig);
      }
      if (fr.length > 2 && sigs.size < 2) distinct = false;
      out[k + '/' + st] = { form: f, L, R: Rr };
    }
    const cal = {};
    for (const k in window.LX_ANIM_CALIB) if (/^gravitos[23]?(star|punch|soul|laser)?$/.test(k)) for (const st in window.LX_ANIM_CALIB[k]) { const c = _lxAnimCalib(k, st); cal[k + '/' + st] = [c.s, c.dx, c.dy]; }
    game.paused = false; game.monsters.length = 0;
    return { out, distinct, cal };
  }, sets);
  const med = (xs) => { const q = xs.filter((x) => x != null).sort((p, q2) => p - q2); return q[Math.floor((q.length - 1) / 2)]; };
  const rows = Object.entries(R.out).map(([k, v]) => { const far = v.L.map((l, i) => (l && v.R[i]) ? Math.min(l.y, v.R[i].y) : null), near = v.L.map((l, i) => (l && v.R[i]) ? Math.max(l.y, v.R[i].y) : null); return { k, far: med(far), near: med(near) }; });
  ok(`1. ALL SEQUENCES: ${rows.length} sets, every frame drawn as itself`, rows.length === 20 && R.distinct, rows.map((r) => r.k).join(' '));
  const formOf = (k) => (/^gravitos3/.test(k) ? 3 : /^gravitos2/.test(k) ? 2 : 1), bad2 = [];
  for (const f of [1, 2, 3]) {
    const ref = JSON.stringify(R.cal[(f === 1 ? 'gravitos' : 'gravitos' + f) + '/idle']);
    for (const [k, v] of Object.entries(R.cal)) if (formOf(k) === f && !/star\/attack$/.test(k) && JSON.stringify(v) !== ref) bad2.push(`${k} ${JSON.stringify(v)} vs ${ref}`);
  }
  ok('2. ONE CALIBRATION PER FORM: every body set of a form shares idle\'s s / dx / dy (the star cast\'s attack keeps its own)', bad2.length === 0 && Object.keys(R.cal).length >= 24, bad2.join('; ') || Object.keys(R.cal).length + ' entries');
  const badFar = rows.filter((r) => !(r.far >= 1 && r.far <= 5));
  ok('3. BOTH FEET DOWN: every set\'s far foot rests 1-5 px into the floor (median over its frames)', badFar.length === 0, (badFar.length ? 'off: ' : '') + (badFar.length ? badFar : rows).map((r) => `${r.k} ${r.far}`).join(', '));
  const deep = rows.filter((r) => !(r.near <= 18));
  ok('4. SHALLOW: no set\'s near foot sinks past 18 px (median)', deep.length === 0, (deep.length ? deep : rows).map((r) => `${r.k} ${r.near}`).join(', '));
  const bad5 = [], seen5 = [];
  for (const f of [1, 2]) {
    const idle = R.out[(f === 1 ? 'gravitos' : 'gravitos2') + '/idle'], N = med(idle.L.map((p) => p && p.y)), F = med(idle.R.map((p) => p && p.y));
    for (const [k, v] of Object.entries(R.out)) {
      if (v.form !== f || /star\//.test(k)) continue;
      const mxL = med(v.L.map((p) => p && p.x)), mxR = med(v.R.map((p) => p && p.x)); let air = 0;
      v.L.forEach((l, i) => {
        const r = v.R[i], c = [];
        if (l && Math.abs(l.x - mxL) <= 60) c.push(l.y - N);
        if (r && Math.abs(r.x - mxR) <= 60) c.push(r.y - F);
        if (!c.length) return;
        const g = Math.max(...c);
        if (g < -4) { air++; return; }   // both feet off their lines: a leap
        if (g < -2 || g > 2) bad5.push(`${k}#${i} ${g > 0 ? '+' : ''}${g}`);
      });
      if (air > 1) bad5.push(`${k} ${air} airborne frames`);
      seen5.push(`${k}${air ? ' (' + air + ' leap)' : ''}`);
    }
    seen5.push(`[form ${f} lines: near ${N}, far ${F}]`);
  }
  ok('5. ON THE FORM\'S LINES (forms 1-2): every standing frame has a foot within 2 px of its line and none more than 2 px below it', bad5.length === 0, bad5.join(', ') || seen5.join(' '));
  ok('6. no page errors', errs.length === 0, JSON.stringify(errs));
} finally { await browser.close(); server.kill(); }
const fail = res.filter((r) => !r.pass).length;
console.log(`\n${res.length - fail}/${res.length} passed`);
process.exit(fail ? 1 : 0);
