// A/B: the served build vs a candidate in a Gravitos form-3 fight at 1080p fullscreen - fps, render scale and
// FX tier over time, builds alternated per round (boss AI is random, so compare rounds, not single runs).
//   GPU=0 THROTTLE=1 ROUNDS=2 SECS=20 node scripts/perf_gravitos_ab.mjs _cand.html
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAND = process.argv[2]; if (!CAND) throw new Error('candidate html required');
const ROUNDS = Number(process.env.ROUNDS || 2), SECS = Number(process.env.SECS || 20);
const VW = Number(process.env.VW || 1920), VH = Number(process.env.VH || 1080);
async function run(build, port) {
  const env = { ...process.env }; if (build) env.MOJI_GAME_FILE = build; else delete env.MOJI_GAME_FILE;
  const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(port)], { stdio: 'ignore', cwd: ROOT, env });
  await new Promise((r) => setTimeout(r, 1500));
  const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'].concat(process.env.GPU === '0' ? ['--disable-gpu'] : []) });
  try {
    const page = await browser.newPage({ viewport: { width: VW, height: VH } });
    const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
    await page.goto(`http://localhost:${port}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => typeof loadMap === 'function' && typeof hitMonster === 'function', null, { timeout: 120000 });
    await page.evaluate(() => {
      for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) o.style.display = 'none'; }
      window._lxBootGateDone = true; window._prologueActive = false;
      player.level = 100; player.cls = 'warrior'; player.invulnerable = 9e9; player.hp = player.maxHp = 99999; player._god = true;
      loadMap('gravitosArena'); game.paused = false;
    });
    await page.waitForFunction(() => game.monsters.some((m) => m && m.type === 'gravitos' && m.currentHp > 0), null, { timeout: 60000 }).catch(() => {});
    await page.waitForFunction(() => ![...document.querySelectorAll('video')].some((v) => v.offsetParent && !v.paused && v.id.indexOf('map-bg-video') !== 0), null, { timeout: 60000 }).catch(() => {});
    if (Number(process.env.THROTTLE) > 1) { const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.THROTTLE) }); }
    return await page.evaluate(async (SECS) => {
      const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
      const clear = () => { for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); } game.paused = false; };
      const boss = () => game.monsters.find((x) => x && x.type === 'gravitos' && x.currentHp > 0);
      for (let i = 0; i < 2; i++) { clear(); const m = boss(); if (m) { m.evasion = 0; m.currentHp = 1; hitMonster(m, 99999999, false, 'phys'); } await sleep(4000); }
      const hitter = setInterval(() => { const m = boss(); if (!m) return; const k = m.currentHp; try { hitMonster(m, 2000, Math.random() < 0.3, 'phys'); } catch (e) {} m.currentHp = Math.max(k, m.maxHp * 0.5); }, 200);
      const d = []; let last = performance.now(), run = true;
      const f = (t) => { d.push([t, t - last]); last = t; if (run) requestAnimationFrame(f); };
      requestAnimationFrame(f);
      const t0 = performance.now(), samples = [];
      for (let s = 0; s < SECS; s++) { clear(); await sleep(1000); samples.push({ s, dpr: _LX_DPR, very: !!LX_PERF.veryLowFx, avg: +LX_PERF.avgFrame.toFixed(1) }); }
      run = false; clearInterval(hitter);
      const win = (a, b) => { const x = d.filter(([t]) => t - t0 >= a * 1000 && t - t0 < b * 1000).map(([, v]) => v).sort((p, q) => p - q); return x.length ? { fps: +(x.length / (b - a)).toFixed(1), p50: +x[x.length >> 1].toFixed(1), p95: +x[Math.floor(x.length * 0.95)].toFixed(1) } : null; };
      const q = SECS / 4;
      return { version: GAME_VERSION, form: (boss() || {})._gravitosPhase, canvas: canvas.width + 'x' + canvas.height,
        windows: [win(0, q), win(q, 2 * q), win(2 * q, 3 * q), win(3 * q, SECS)], dprTrail: samples.filter((x, i) => i % 4 === 0 || i === SECS - 1).map((x) => x.s + ':' + x.dpr.toFixed(2) + (x.very ? 'v' : '')), toasts: [...document.querySelectorAll('.toast, .lx-toast')].map((e) => e.textContent).filter((t) => /Resolution/.test(t)).length };
    }, SECS).then((r) => ({ ...r, errs: errs.length }));
  } finally { await browser.close().catch(() => {}); srv.kill(); }
}
console.log(`gpu ${process.env.GPU === '0' ? 'off' : 'on'} · throttle ${process.env.THROTTLE || 1} · ${VW}x${VH} · ${ROUNDS} rounds x ${SECS}s`);
let port = 9700;
for (let r = 0; r < ROUNDS; r++) {
  for (const [label, build] of [['tip ', null], ['cand', CAND]]) {
    const o = await run(build, port++);
    console.log(`  ${label} ${o.version} form ${o.form} canvas ${o.canvas} | ` + o.windows.map((w) => w ? `${w.fps}fps p95 ${w.p95}` : '-').join(' | ') + ` | dpr ${o.dprTrail.join(' ')} | errs ${o.errs}`);
  }
}
