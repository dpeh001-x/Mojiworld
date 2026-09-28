// PATH'S BANE'S LUNGE, AND HIS SLASH. Per user, with a clip: "path's bane sudden slip and sliding motion should be
// either made slower or corrected to make it not look buggy, also the edge of the slash is cutoff, fix it".
// The hourglass lunge covered 460 px in 320 ms at one constant ~24 px a frame, snapped to a stop and held the attack
// pose the whole way - a statue gliding over the floor. Attack frame 5's green crescent ran off the bottom of its
// image and was sliced flat there. Driven in the running game:
//   - SLOWER: the dash lasts >= 600 ms and never moves more than 16 px in a sim step
//   - EASED: the first and last steps are a fraction of the peak - no snap at launch or landing
//   - HONEST: it still travels ~360 px, in the direction the brace locked
//   - ONE POSE: the dash holds a single attack frame (his walk cycle skated under a 22 px/tick body); the brace keeps
//     the attack loop as its tell
//   - THE SLASH: no attack frame's art reaches its image's bottom edge (frame 5's crescent was sliced flat there; the
//     set was redrawn in v0.30.1401 on a 630x640 canvas - see pathsbane_swing_art_test)
//   [PORT=13882] node scripts/pathsbane_lunge_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const require = createRequire(path.join(ROOT, 'x.js')); const { chromium } = require('playwright-core');
const PORT = process.env.PORT || '13882'; let pass = 0, fail = 0;
const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d !== undefined ? '  [' + (typeof d === 'string' ? d : JSON.stringify(d)) + ']' : '')); ok ? pass++ : fail++; };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: { ...process.env, MOJI_GAME_FILE: path.resolve(ROOT, process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html') } });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function', null, { timeout: 180000 });
const R = await page.evaluate(async () => {
  const W8 = (ms) => new Promise((r) => setTimeout(r, ms));
  try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu', 'void-intro-overlay']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player._storyBeatsSeen = player._storyBeatsSeen || {}; if (typeof STORY_BEATS === 'object') for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
  player._tutorialSeen = true; applyClass('warrior'); player.level = 90;
  try { _lxBootHold.release('menu'); } catch (e) {}
  loadMap('forest', 300); await W8(1500); try { closeAllModals(); } catch (e) {} game.paused = false;
  player._god = true; player.invulnerable = 9e9;
  game.monsters.length = 0;
  const m = spawnMonster(player.x + 420, player.y - 100, 'pathsBane', false);
  try { _lxArt2WantMon('pathsBane', true); } catch (e) {}
  for (let i = 0; i < 100; i++) { const st = (typeof MONSTER_FRAMES !== 'undefined' && MONSTER_FRAMES.pathsBane) || null; if (st && st.walk && st.attack && [...st.walk, ...st.attack].every((f) => f && f.complete && f.naturalWidth > 0)) break; await W8(100); }
  // keep his other moves out of the way: no swing, no column, no shots during the probe
  m._bmCd = 9e9; m._colCd = 9e9; m.shootTimer = -9e9; if (m.traits && m.traits.bigMelee) m.traits.bigMelee = Object.assign({}, m.traits.bigMelee, { cdMs: 9e9 });
  if (m.traits && m.traits.columnStrike) m.traits.columnStrike = Object.assign({}, m.traits.columnStrike, { cdMs: 9e9 });
  // what the draw chose: the frame _monsterStateFrame hands back for him, named by set and index (the drawn canvases
  // are shrunk copies with no src, so reading drawImage cannot tell walk from attack)
  let lastSrc = ''; const oSF = window._monsterStateFrame;
  window._monsterStateFrame = function (mm) {
    const r = oSF.apply(this, arguments);
    if (mm === m) { const st = MONSTER_FRAMES.pathsBane || {}; for (const k of ['attack', 'walk', 'idle']) { const i = (st[k] || []).indexOf(r); if (i >= 0) { lastSrc = k + '/' + i; break; } } }
    return r;
  };
  // stand the player on his line 400 px away and open the lunge now
  await W8(300);
  player.x = m.x + m.w / 2 - 400; player.vx = 0;
  m._hgCd = 0; m._hgCharging = false;
  const rows = []; let lastT = game.time, x0 = null, dir = null;
  const t0 = performance.now();
  while (performance.now() - t0 < 12000) {
    await new Promise((r) => requestAnimationFrame(r));
    player.x = Math.min(player.x, m.x - 360); player.vx = 0;   // stay out of contact, on his left
    if (game.time === lastT) continue;
    rows.push({ ph: m._hgCharging ? m._hgPhase : '-', x: m.x, src: lastSrc, t: performance.now(), ticks: game.time - lastT });
    lastT = game.time;
    if (m._hgCharging && m._hgPhase === 'dash' && x0 === null) { x0 = rows.length > 1 ? rows[rows.length - 2].x : m.x; dir = m._hgDir; }
    if (x0 !== null && !m._hgCharging) break;
  }
  window._monsterStateFrame = oSF;
  const dash = rows.filter((r) => r.ph === 'dash'), brace = rows.filter((r) => r.ph === 'brace');
  // px per game tick (a sampled frame can cover more than one tick on a loaded machine)
  const steps = []; for (let i = 1; i < rows.length; i++) if (rows[i].ph === 'dash' || (rows[i - 1].ph === 'dash')) steps.push(Math.abs(rows[i].x - rows[i - 1].x) / Math.max(1, rows[i].ticks));
  return {
    braceN: brace.length, dashN: dash.length, dashTicks: dash.reduce((a, r) => a + r.ticks, 0),
    steps: steps.map((v) => +v.toFixed(1)), travel: x0 === null ? null : +Math.abs(rows[rows.length - 1].x - x0).toFixed(1), dir,
    dashWalk: dash.filter((r) => /^walk\//.test(r.src)).length, dashPoses: [...new Set(dash.map((r) => r.src))],
    braceAtk: brace.filter((r) => /^attack\//.test(r.src)).length,
    traits: { ms: m.traits.hourglassDashMs, dist: m.traits.hourglassDistance },
  };
});
const st = R.steps || []; const core = st.slice(1, -1); const peak = Math.max(0, ...st);
console.log(JSON.stringify({ ...R, steps: st.slice(0, 50) }));
const simMs = R.dashTicks * (1000 / 60);   // game ticks at the game's 60 Hz step
check(R.dashN > 0 && R.braceN > 0, 'the lunge fired: a brace, then a dash', { brace: R.braceN, dash: R.dashN });
check(simMs >= 600, 'SLOWER: the dash lasts at least 600 ms of game time (was 320)', Math.round(simMs) + ' ms, ' + R.dashTicks + ' ticks');
check(peak > 0 && peak <= 16, 'SLOWER: no game tick moves him more than 16 px (was ~22 every tick)', peak.toFixed(1) + ' px');
check(st.length >= 6 && st[0] <= 0.45 * peak && st[st.length - 1] <= 0.45 * peak, 'EASED: launch and landing steps are under half the peak - no snap', { first: st[0], last: st[st.length - 1], peak });
check(R.travel >= 320 && R.travel <= 400 && R.dir === -1, 'HONEST: ~360 px toward where the brace locked (left, at the player)', { travel: R.travel, dir: R.dir });
check(R.dashN > 0 && R.dashWalk === 0 && R.dashPoses.length === 1 && /^attack\//.test(R.dashPoses[0]), 'ONE POSE: the dash holds a single attack frame - no walk cycle skating under it', { poses: R.dashPoses, walkSteps: R.dashWalk, of: R.dashN });
check(R.braceN > 0 && R.braceAtk >= 0.8 * R.braceN, 'the brace keeps the attack pose as its tell', { attack: R.braceAtk, of: R.braceN });
// the slash: no attack frame's art on its bottom rows
for (let fi = 0; fi < 9; fi++) {
  // read the served art's pixels in the page (no native decoder needed)
  const px = await page.evaluate(async (fi) => {
    const im = new Image(); im.src = 'Sprites/monsters/attack/pathsBane_' + fi + '.webp?t=' + Date.now();
    await im.decode();
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const W = c.width, H = c.height, d = g.getImageData(0, H - 6, W, 6).data;
    let bottom = 0, low = 0;
    for (let x = 0; x < W; x++) { if (d[(5 * W + x) * 4 + 3] > 8) bottom++; for (let y = 0; y < 6; y++) if (d[(y * W + x) * 4 + 3] > 64) low++; }
    return { W, H, bottom, low };
  }, fi);
  const bottom = px.bottom, low = px.low;
  check(px.W === 630 && px.H === 640 && bottom === 0 && low === 0, 'THE SLASH: attack frame ' + fi + '\'s art ends before the image\'s bottom edge (frame 5\'s crescent was sliced flat there)', { W: px.W, H: px.H, bottomRowPx: bottom, opaqueInLast6Rows: low });
}
check(errs.length === 0, 'no page errors', errs.slice(0, 3));
await browser.close(); server.kill();
console.log('\n' + pass + '/' + (pass + fail) + ' checks passed'); process.exit(fail ? 1 : 0);
