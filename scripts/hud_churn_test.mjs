// HUD CHURN (v0.30.857): the buff pills' timer bars and the combo drain bar are transforms (composited), not widths
// (a layout + paint every frame of their transitions); the combo meter, toasts, the expiring-buff pulse and the mascot
// chip carry will-change so their animations move a layer instead of repainting. And the picture is the same: the two
// bars at 50% are compared pixel-for-pixel against a reference build when one is given.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/hud_churn_test.mjs [page.html] [--ref reference.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT0 = Number(process.env.PORT || '11161');
const args = process.argv.slice(2); const refIx = args.indexOf('--ref'); const REF = refIx >= 0 ? args[refIx + 1] : null;
const cand = args.filter((a, i) => !a.startsWith('--') && i !== refIx + 1)[0] || null;
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
async function run(build, port) {
  const env = { ...process.env }; if (build) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, build); else delete env.MOJI_GAME_FILE;
  const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(port)], { stdio: 'ignore', cwd: SERVE_ROOT, env });
  await new Promise((r) => setTimeout(r, 1500));
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 })).newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  try {
    await page.goto(`http://localhost:${port}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => typeof loadMap === 'function' && typeof castSkill === 'function', null, { timeout: 180000 }); await page.waitForTimeout(4000);
    const r = await page.evaluate(async () => { const sleep = (ms) => new Promise((r2) => setTimeout(r2, ms));
      try { _lxBootGateDone = true; _prologueActive = false; _playStoryBeat = function () { return false; }; _playBossIntro = function () {}; } catch (e) {}
      for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
      player.cls = 'warrior'; player.job = 'berserker'; player.level = 90; player._god = true; player.hp = player.maxHp = 99999; player.maxMp = player.mp = 9999; player.skillCooldowns = {};
      loadMap('glasswindSteppe', 900); await sleep(2500); game.paused = false; for (let i = 0; i < 30 && !player.onGround; i++) await sleep(100);
      const m = spawnMonster(player.x + 120, player.y - 10, 'slime', false, false); m.maxHp = m.currentHp = 9e9; m.evasion = 0; m.speed = 0; m.traits = null;
      for (let i = 0; i < 12; i++) { hitMonster(m, 100, false, 'phys'); await sleep(40); }
      castSkill('warCry'); await sleep(300);
      // freeze both bars at half: the HUD tick writes them, the 120 ms transition settles, then we read and shoot
      const hold = setInterval(() => { game.comboTimer = 1300; game.combo = 12;   /* pinned: the count is text, and a hit more or less on one build would fail the picture for the wrong reason */ if (player.buffs && player.buffs.warCry > 0) player.buffs.warCry = 3500; }, 30);
      await sleep(700);
      const fill = document.getElementById('combo-timer-fill'), bar = fill && fill.parentElement, meter = document.getElementById('combo-meter');
      const pill = document.querySelector('.moji-buff-pill[data-buff="warCry"]') || document.querySelector('.moji-buff-pill'), tm = pill && pill.querySelector('.buff-timer');
      const cs = (el) => el ? getComputedStyle(el) : null;
      const out = { combo: game.combo, comboTimer: game.comboTimer, warCry: player.buffs && player.buffs.warCry, meterText: meter ? meter.innerText.replace(/s+/g, ' ') : null, meterOpacity: meter ? getComputedStyle(meter).opacity : null, meterTransform: meter ? getComputedStyle(meter).transform : null,
        fill: fill ? { width: cs(fill).width, barWidth: cs(bar).width, transform: cs(fill).transform, transition: cs(fill).transitionProperty, origin: cs(fill).transformOrigin, willChange: cs(fill).willChange } : null,
        timer: tm ? { width: cs(tm).width, pillWidth: cs(pill).width, transform: cs(tm).transform, transition: cs(tm).transitionProperty, willChange: cs(tm).willChange } : null,
        meterWillChange: meter ? cs(meter).willChange : null,
        rects: { meter: bar ? bar.getBoundingClientRect().toJSON() : null, pill: tm ? tm.getBoundingClientRect().toJSON() : null } };   // the two BARS: text rasterises differently on a composited layer, the bars are what changed
      pill && pill.classList.add('buff-expiring'); out.expiringWillChange = pill ? cs(pill).willChange : null; pill && pill.classList.remove('buff-expiring');
      showToast('hud churn probe', 'common'); await sleep(50); const t = document.querySelector('.toast'); out.toastWillChange = t ? cs(t).willChange : null; if (t) t.remove();
      for (const t0 of document.querySelectorAll('.toast')) t0.remove(); const tc = document.getElementById('toast-container'); if (tc) tc.style.visibility = 'hidden';   // the cast toasts slide over the meter's corner
      for (const el0 of [meter, pill]) if (el0) { el0.style.background = '#000'; el0.style.backdropFilter = 'none'; el0.style.boxShadow = 'none'; }   // an opaque plate under both, so the picture is the bar and the text, not the map behind them
      document.getElementById('game').style.visibility = 'hidden'; for (const v of document.querySelectorAll('video')) v.style.visibility = 'hidden'; await sleep(120);   // the shots compare the HUD, not the world behind it
      window.__hold = hold; return out; });
    const shot = async (rect) => rect && rect.width > 0 ? (await page.screenshot({ clip: { x: Math.max(0, rect.x - 3), y: Math.max(0, rect.y - 3), width: rect.width + 6, height: rect.height + 6 } })).toString('base64') : null;
    r.shots = { meter: await shot(r.rects.meter), pill: await shot(r.rects.pill) };
    if (process.env.DUMP) { const fs2 = await import('node:fs'); for (const k of ['meter', 'pill']) if (r.shots[k]) fs2.writeFileSync(path.join(process.env.DUMP, 'hud_' + k + '_' + path.basename(String(build || 'tip'), '.html') + '.png'), Buffer.from(r.shots[k], 'base64')); }
    await page.evaluate(() => { clearInterval(window.__hold); document.getElementById('game').style.visibility = ''; });
    r.errs = errs; return r;
  } finally { await page.context().close().catch(() => {}); server.kill(); }
}
// pixel comparison of two PNG crops, done in a page (no image libs in node)
async function diff(aB64, bB64) {
  if (!aB64 || !bB64) return null; const page = await browser.newPage();
  const d = await page.evaluate(async ([a, b]) => { const load = (s) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = 'data:image/png;base64,' + s; });
    const A = await load(a), B = await load(b); if (A.width !== B.width || A.height !== B.height) return { size: A.width + 'x' + A.height + ' vs ' + B.width + 'x' + B.height };
    const px = (im) => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, im.width, im.height).data; };
    const pa = px(A), pb = px(B); let sum = 0, max = 0, n = 0; for (let i = 0; i < pa.length; i += 4) { const e = Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]); sum += e; if (e > max) max = e; n++; }
    return { meanPerPx: +(sum / n).toFixed(2), maxPerPx: max, px: n, size: A.width + 'x' + A.height }; }, [aB64, bB64]);
  await page.close(); return d;
}
try {
  const r = await run(cand, PORT0);
  check(r.fill && /^matrix\(0\.[45]\d*, 0, 0, 1, 0, 0\)$/.test(r.fill.transform) && r.fill.width === r.fill.barWidth && r.fill.transition === 'transform', 'the combo drain bar is a transform at half (full-width box, scaleX 0.5, transition on transform)', J(r.fill));
  check(r.timer && /^matrix\(0\.[45]\d*, 0, 0, 1, 0, 0\)$/.test(r.timer.transform) && r.timer.transition === 'transform', 'a buff pill\u2019s timer bar is a transform at half', J(r.timer));
  check(r.meterWillChange === 'transform', 'the combo meter has its own layer (will-change: transform)', J(r.meterWillChange));
  check(r.expiringWillChange === 'transform', 'an expiring buff pill pulses on its own layer', J(r.expiringWillChange));
  check(r.toastWillChange === 'transform, opacity', 'a toast slides on its own layer', J(r.toastWillChange));
  check(r.errs.length === 0, 'no page errors', J(r.errs.slice(0, 3)));
  if (REF) {
    const q = await run(REF, PORT0 + 1);
    const dm = await diff(r.shots.meter, q.shots.meter), dp = await diff(r.shots.pill, q.shots.pill);
    console.log('meter text cand:', J(r.meterText), r.meterOpacity, r.meterTransform, '| ref:', J(q.meterText), q.meterOpacity, q.meterTransform);
    check(dm && dm.meanPerPx !== undefined && dm.meanPerPx < 4.0, 'the combo drain bar at half looks the same as on the reference build (mean channel diff < 4 / 255)', J(dm));
    check(dp && dp.meanPerPx !== undefined && dp.meanPerPx < 4.0, 'a buff pill’s timer bar at half looks the same as on the reference build', J(dp));
  }
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 300)); }
await browser.close();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
