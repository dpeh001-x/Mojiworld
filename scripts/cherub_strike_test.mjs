// The cherub strikes on its blast (per user: "fix the drifted cherub attack timings"). Its attack art was redrawn in
// v0.30.442 - f3 charges, f4 throws the arms out, f5 is the blast (mouth open, the whole aura), f6 burns off - but its
// baked timing still held f4, fitted to the old frames, so the pose the hit landed on was the one BEFORE the blast.
//  S1. the longest-held frame is the frame with the biggest silhouette in the art itself (the blast)
//  S2. the timing is what gen_attack_timing.mjs derives from the current art (the drift guard, for this set)
//  G1. the running game reads it (strike frame 5)
//  G2. a contact hit: the charge (f3, f4) plays in and the blast is on screen at the strike, 120 ms after the contact
//  G3. a proximity swing: the blast shows within 80 ms of the moment its hit lands (was 141)
//   node scripts/cherub_strike_test.mjs [page.html] [port]      MOJI_CALIB_FILE reads S1/S2 from another copy
import { createRequire } from 'node:module'; import path from 'node:path'; import fs from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import sharp from 'sharp';
import { defaultMobAttackFt, LX_MOB_ATK_BASE_BY_TYPE } from './gen_attack_timing.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright-core');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const FILE = (args[0] && /\.html$/i.test(args[0])) ? args[0] : 'mojiworld_game.html';
const PORT = Number(args.find((a) => /^\d+$/.test(a)) || process.env.PORT || 11793);
let bad = 0, total = 0; const check = (ok, label, d) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${d !== undefined ? '  ' + JSON.stringify(d) : ''}`); if (!ok) bad++; };
const strikeOf = (ft) => { let s = 0, b = -1; ft.forEach((v, i) => { if (v > b) { b = v; s = i; } }); return s; };
// ---- the data and the art ----
const cs = fs.readFileSync(process.env.MOJI_CALIB_FILE || path.join(ROOT, 'data', 'anim_calib.js'), 'utf8').replace(/\r/g, '');
const calib = JSON.parse(cs.match(/window\.LX_ANIM_CALIB = ([\s\S]*?);\nwindow\.LX_ATK_HITBOX/)[1]);
const ms = fs.readFileSync(path.join(ROOT, 'data', 'anim_calib_manifest.js'), 'utf8');
const M = JSON.parse(ms.slice(ms.indexOf('{'), ms.lastIndexOf('}') + 1));
const ft = calib.cherub && calib.cherub.attack && calib.cherub.attack.ft;
const cover = [];
for (let i = 0; i < 9; i++) { const { data, info } = await sharp(path.join(ROOT, 'Sprites/monsters/attack', `cherub_${i}.webp`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let op = 0; for (let p = 3; p < data.length; p += 4) if (data[p] >= 128) op++; cover.push(+(op / (info.width * info.height) * 100).toFixed(1)); }
const blast = cover.indexOf(Math.max(...cover));
check(!!ft && blast === 5 && strikeOf(ft) === blast, 'S1. the cherub holds its blast longest: its strike frame is the biggest silhouette in its own art (f5)', { strike: ft && strikeOf(ft), blast, cover: cover.join('/'), ft: ft && ft.join('/') });
const st = M.cherub.states.attack, want = defaultMobAttackFt(st.count | 0, st.cb, st.h, LX_MOB_ATK_BASE_BY_TYPE.cherub);
check(!!ft && calib.cherub.attack.ftAuto === true && ft.join('/') === want.join('/'), "S2. the cherub's timing is the generator's rule for its current art (no drift)", { got: ft && ft.join('/'), want: want.join('/') });
// ---- the running game ----
const env = { ...process.env }; if (FILE !== 'mojiworld_game.html') env.MOJI_GAME_FILE = FILE; else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _monsterStateFrame === 'function' && typeof spawnMonster === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), o = {};
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const e = document.getElementById(id); if (e) { e.style.display = 'none'; e.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'mage'; player.level = 60; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    loadMap('stardustAtrium'); await sleep(3500); player._god = true; player.invulnerable = 1e9;
    const hold = () => { game.paused = true; game.hitStop = 1e9; }; hold(); window.__csHold = setInterval(hold, 1);   // no live step between samples
    player.x = 900; player.y = 480 - player.h; player.vx = 0; player.vy = 0; game.camera.x = 420; game.camera.y = 0;
    const mk = async (dx) => { game.monsters.length = 0; const m = spawnMonster(player.x + dx, 480 - 140, 'cherub', false, false) || game.monsters[game.monsters.length - 1];
      m.y = 480 - m.h; m.onGround = true; m.vx = 0; m.vy = 0; const set = _monsterFramesFor('cherub'); const t0 = performance.now();
      while (!(set.attack && set.attack.filter((f) => f && f.complete && f.naturalWidth > 0).length === 9 && set.idle && set.idle[8] && set.idle[8].complete) && performance.now() - t0 < 30000) { _monsterStateFrame(m); await sleep(50); }
      m._animPX = m.x; m._animXV = 0; m._walkLatch = false; return { m, set }; };
    // the picker runs on performance.now(): sample it on a CONTROLLED clock, 2 ms a step; `start` runs on the first sample
    const sample = (m, set, ms, start) => { const P = performance, orig = P.now, t0 = orig.call(P); let t = t0; P.now = () => t;
      try { t = t0; start(t0); const seq = []; for (let e = 0; e <= ms; e += 2) { t = t0 + e; seq.push([e, set.attack.indexOf(_monsterStateFrame(m))]); } return { seq, t0 }; } finally { P.now = orig; } };
    const ft = _lxCalibFt('cherub', 'attack'); let s = 0, b = -1; ft.forEach((v, i) => { if (v > b) { b = v; s = i; } }); o.strike = s; o.ft = ft.join('/');
    // G2. a contact hit (no telegraph): damage now, the swing's strike 120 ms later
    { const { m, set } = await mk(160);
      const { seq } = sample(m, set, 800, (now) => { m._animSt = null; m._swingUntil = 0; m._atkStrikeMs = undefined; m.atkAnimUntil = now + 760 + 50; });
      const at = (e) => (seq.find((x) => x[0] >= e) || [0, -1])[1], own = seq.filter((x) => x[1] >= 0);
      o.G2 = { at120: at(120), before: [...new Set(own.filter((x) => x[0] < 120).map((x) => x[1]))].join(','), mono: own.every((x, i) => i === 0 || x[1] >= own[i - 1][1]) }; }
    // G3. a proximity swing: the player stands in reach of a monster that is not moving
    { const { m, set } = await mk(8);
      const { seq, t0 } = sample(m, set, 900, () => { m.atkAnimUntil = 0; m._swingUntil = 0; m._proxRestUntil = 0; m._animSt = null; m._atkStrikeMs = undefined; m._proxAtk = false; m._swStrikeAt = 0; });
      const hit = m._swStrikeAt > 0 ? Math.round(m._swStrikeAt - t0) : -1, blastAt = (seq.find((x) => x[1] === 5) || [-1])[0];
      o.G3 = { hit, blastAt, gap: blastAt >= 0 && hit >= 0 ? blastAt - hit : null, frames: seq.filter((x, i) => i === 0 || x[1] !== seq[i - 1][1]).map((x) => x[0] + ':f' + x[1]).join(' ') }; }
    clearInterval(window.__csHold); return o;
  });
  check(R.strike === 5, 'G1. the running game reads the cherub strike on frame 5', { strike: R.strike, ft: R.ft });
  check(R.G2.at120 === 5 && /3/.test(R.G2.before) && /4/.test(R.G2.before) && R.G2.mono, 'G2. a contact hit: f3 and f4 play in and the blast (f5) is on screen at the strike, 120 ms after the contact', R.G2);
  check(R.G3.hit > 0 && R.G3.gap !== null && R.G3.gap >= 0 && R.G3.gap <= 80, 'G3. a proximity swing: the blast (f5) shows within 80 ms after its hit lands', R.G3);
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close(); server.kill(); }
console.log(`\n${total - bad}/${total} checks passed`); process.exit(bad ? 1 : 0);
