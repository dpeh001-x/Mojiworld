// Smooth jump (v0.30.1332): a real jump in the running game, sampled every SIM step (after updatePlayer - headless draws
// can skip steps) through the hero renderer's own anim picker and channels. Asserts: every airborne frame plays 'jump' (the apex used to flash 'idle'); the arc has
// many distinct in-betweens (it used to hold three poses); no bone snaps more than MAX_STEP rad per sim frame through
// take-off, apex, touchdown and back to idle; the landing plays 'land' and ends on the idle pose; the hair trails in
// the air and settles after. Per user: "Player character jump and falling animation can add more frames to make it
// animate more smooth and naturally".
//   [PORT=11186] node scripts/smooth_jump_test.mjs [candidate.html inside the repo]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PORT = process.env.PORT || '11186', MAX_STEP = 0.42;
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
let pass = 0, fail = 0;
const check = (ok, msg, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (detail ? '  [' + detail + ']' : '')); ok ? pass++ : fail++; };
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _drawVectorHero === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(4000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    try { _playStoryBeat = function () { return false; }; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { if (window._lxBootHold) window._lxBootHold.release('menu'); } catch (e) {}   // this test skips the title menu
    loadMap('forest', 300); await sleep(1500);
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    player.cls = 'warrior'; player._god = true; game.monsters.length = 0; game.paused = false;
    for (let i = 0; i < 60 && !player.onGround; i++) await sleep(50);
    const BONES = ['spine', 'head', 'armL', 'armR', 'legL', 'legR'];
    const rec = []; let lastT = -1;
    const orig = updatePlayer;
    updatePlayer = function () {
      const ret = orig.apply(this, arguments);
      if (game.time !== lastT) {
        lastT = game.time;
        const a = _heroVecAnimFor(), t = _heroVecTimeNorm(a), ch = HERO_VEC_ANIMS[a] || {};
        const rot = {}; for (const b of BONES) rot[b] = ch[b] ? ch[b](t) : 0;
        rec.push({ gt: game.time, a, vy: player.vy, g: !!player.onGround, rot, hair: (typeof _heroVecHairLag === 'function') ? _heroVecHairLag() : null });
      }
      return ret;
    };
    const t0 = game.time;
    // a real jump: the jump input for a few frames, then wait for touchdown + the landing + a settle
    player.vy = -getJump(); player.onGround = false; player.jumping = true;
    for (let i = 0; i < 200; i++) { await sleep(30); if (player.onGround && game.time - t0 > 20 && rec.length && rec[rec.length - 1].g && rec.filter((s) => s.g && s.gt > t0 + 20).length > 40) break; }
    updatePlayer = orig;
    return { rec, ver: GAME_VERSION, t0 };
  });
  const rec = r.rec, air = rec.filter((s) => !s.g), iTake = rec.findIndex((s) => !s.g), iLand = rec.findIndex((s, i) => i > iTake && s.g);
  console.log(`build ${r.ver}: ${rec.length} sampled frames, ${air.length} airborne`);
  check(air.length >= 20 && iTake >= 0 && iLand > iTake, 'a real jump was sampled (take-off, >= 20 airborne frames, touchdown)', `${air.length} air, take-off at ${iTake}, touchdown at ${iLand}`);
  const bad = rec.slice(iTake, iLand).filter((s) => s.a !== 'jump');
  check(bad.length === 0, 'every airborne frame plays the jump pose (no idle flash at the apex)', bad.slice(0, 4).map((s) => `gt ${s.gt} vy ${s.vy.toFixed(2)} ${s.a}`).join(', '));
  const distinct = new Set(air.map((s) => BONESKEY(s.rot))).size;
  function BONESKEY(o) { return ['spine', 'armL', 'legL'].map((b) => o[b].toFixed(3)).join(','); }
  check(distinct >= Math.floor(air.length * 0.6), 'the arc is continuous: most airborne frames are their own in-between', `${distinct} distinct poses over ${air.length} air frames`);
  let worst = { d: 0 };
  for (let i = 1; i < rec.length; i++) {
    const dt = Math.max(1, rec[i].gt - rec[i - 1].gt);
    for (const b of Object.keys(rec[i].rot)) { const d = Math.abs(rec[i].rot[b] - rec[i - 1].rot[b]) / dt; if (d > worst.d) worst = { d, b, gt: rec[i].gt, from: rec[i - 1].a, to: rec[i].a }; }
  }
  check(worst.d <= MAX_STEP, `no bone snaps more than ${MAX_STEP} rad per sim frame (take-off, apex, touchdown, back to idle)`, `worst ${worst.d.toFixed(3)} rad on ${worst.b} at gt ${worst.gt} (${worst.from} -> ${worst.to})`);
  const land = rec.slice(iLand).filter((s) => s.a === 'land'), after = rec.slice(iLand).find((s) => s.a === 'idle');
  const lastLand = land[land.length - 1];
  const endGap = (lastLand && after) ? Math.max(...Object.keys(after.rot).map((b) => Math.abs(after.rot[b] - lastLand.rot[b]))) : 9;
  check(land.length >= 6 && !!after && endGap < 0.12, 'touchdown plays the landing, which hands over to idle without a jump', `${land.length} land frames, gap to idle ${endGap.toFixed(3)} rad`);
  const hairAir = Math.max(...air.map((s) => Math.abs(s.hair || 0))), hairEnd = Math.abs((rec[rec.length - 1] || {}).hair || 0);
  check(hairAir > 0.8 && hairEnd < 0.05, 'the hair trails the arc and settles after the landing', `peak ${hairAir.toFixed(2)} px in the air, ${hairEnd.toFixed(2)} px at the end`);
  check(!errs.length, 'no page errors', errs.slice(0, 2).join(' | '));
} catch (e) { check(false, 'harness error', String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
