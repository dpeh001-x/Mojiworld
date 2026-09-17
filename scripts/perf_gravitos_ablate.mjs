// Which lever buys frames back in a Gravitos fight on a weak machine? One session, A/B/A per lever: each lever is
// measured between two baseline windows, so machine drift cancels. GPU=0 is a software rasteriser; THROTTLE=4
// emulates a CPU four times slower. Used for v0.30.778 (the High emergency floor and the backdrop trim).
//   PORT=9661 GPU=0 THROTTLE=1 VW=1920 VH=1080 SECS=4 node scripts/perf_gravitos_ablate.mjs [candidate.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '9661', SECS = Number(process.env.SECS || 4);
const VW = Number(process.env.VW || 1920), VH = Number(process.env.VH || 1080);
const env = { ...process.env }; if (process.argv[2]) env.MOJI_GAME_FILE = process.argv[2]; else delete env.MOJI_GAME_FILE;
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'].concat(process.env.GPU === '0' ? ['--disable-gpu'] : []) });
const page = await browser.newPage({ viewport: { width: VW, height: VH } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof hitMonster === 'function', null, { timeout: 120000 });
await page.evaluate(() => {
  for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) o.style.display = 'none'; }
  window._lxBootGateDone = true; window._prologueActive = false;
  player.level = 100; player.cls = 'warrior'; player.invulnerable = 9e9; player.hp = player.maxHp = 99999; player._god = true;
  loadMap('gravitosArena'); game.paused = false;
});
await page.waitForFunction(() => game.monsters.some((m) => m && m.type === 'gravitos' && m.currentHp > 0), null, { timeout: 60000 }).catch(() => {});
await page.waitForFunction(() => ![...document.querySelectorAll('video')].some((v) => v.offsetParent && !v.paused), null, { timeout: 60000 }).catch(() => {});
// straight to form 3, let its transition settle
await page.evaluate(async () => {
  const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
  for (let i = 0; i < 2; i++) {
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    game.paused = false;
    const m = game.monsters.find((x) => x && x.type === 'gravitos' && x.currentHp > 0);
    if (m) { m.evasion = 0; m.currentHp = 1; hitMonster(m, 99999999, false, 'phys'); }
    await sleep(4000);
  }
  for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
  game.paused = false;
});
if (Number(process.env.THROTTLE) > 1) { const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.THROTTLE) }); }
await page.waitForTimeout(6000);
const base = await page.evaluate(() => ({ dpr: _LX_DPR, cw: canvas.width, ch: canvas.height, quality: (typeof LX_GFX !== 'undefined' && LX_GFX.quality) || '?', phase: (game.monsters.find((x) => x && x.type === 'gravitos') || {})._gravitosPhase }));
console.log(`viewport ${VW}x${VH} · gpu ${process.env.GPU === '0' ? 'off' : 'on'} · throttle ${process.env.THROTTLE || 1} · canvas ${base.cw}x${base.ch} (dpr ${base.dpr}) · preset ${base.quality} · gravitos form ${base.phase}`);

const measure = (label) => page.evaluate(async ({ label, SECS }) => {
  for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
  game.paused = false;
  const m = game.monsters.find((x) => x && x.type === 'gravitos' && x.currentHp > 0); if (m) m.currentHp = Math.max(m.currentHp, m.maxHp * 0.5);
  await new Promise((r) => setTimeout(r, 600));   // let the change reach the screen
  const d = []; let last = performance.now(), run = true;
  const f = (t) => { d.push(t - last); last = t; if (run) requestAnimationFrame(f); };
  requestAnimationFrame(f);
  await new Promise((r) => setTimeout(r, SECS * 1000));
  run = false; d.sort((a, b) => a - b);
  return { label, fps: +(d.length / SECS).toFixed(1), p50: +d[d.length >> 1].toFixed(1), p95: +d[Math.floor(d.length * 0.95)].toFixed(1) };
}, { label, SECS });

const levers = [
  ['render scale 1.0', `_lxApplyRenderScale(1)`, `_lxApplyRenderScale(${base.dpr})`],
  ['render scale 0.75', `_lxApplyRenderScale(0.75)`, `_lxApplyRenderScale(${base.dpr})`],
  ['smoothing low', `window.__sq = ctx.imageSmoothingQuality; window.__ld = window.loop; ctx.imageSmoothingQuality = 'low'; Object.defineProperty(ctx, 'imageSmoothingQuality', { configurable: true, get(){ return 'low'; }, set(v){} });`, `delete ctx.imageSmoothingQuality; ctx.imageSmoothingQuality = 'high';`],
  ['no arena backdrop', `window.__bd = window._lxGravBackdropDraw; window._lxGravBackdropDraw = function(){};`, `window._lxGravBackdropDraw = window.__bd;`],
  ['no background', `window.__bg = window.drawBackground; window.drawBackground = function(){};`, `window.drawBackground = window.__bg;`],
  ['no particles', `window.__dp = window.drawParticles; window.drawParticles = function(){};`, `window.drawParticles = window.__dp;`],
  ['no hazards', `window.__dh = window.drawHazards; window.drawHazards = function(){};`, `window.drawHazards = window.__dh;`],
  ['no boss sprite', `window.__dm = window.drawMonster; window.drawMonster = function(m){ if (m && m.type === 'gravitos') return; return window.__dm.apply(this, arguments); };`, `window.drawMonster = window.__dm;`],
  ['no HUD DOM (updateUI)', `window.__uu = window.updateUI; window.updateUI = function(){};`, `window.updateUI = window.__uu;`],
];
const rows = [];
for (const [name, on, off] of levers) {
  const a = await measure('base');
  await page.evaluate(on);
  const b = await measure(name);
  await page.evaluate(off);
  const c = await measure('base');
  const baseFps = (a.fps + c.fps) / 2, baseP50 = (a.p50 + c.p50) / 2;
  rows.push({ name, baseFps: +baseFps.toFixed(1), fps: b.fps, gain: +((b.fps / baseFps - 1) * 100).toFixed(0), baseP50: +baseP50.toFixed(1), p50: b.p50 });
  console.log(`  ${name.padEnd(24)} base ${String(baseFps.toFixed(1)).padStart(5)} fps (p50 ${baseP50.toFixed(1)} ms) -> ${String(b.fps).padStart(5)} fps (p50 ${b.p50} ms)  ${b.fps >= baseFps ? '+' : ''}${((b.fps / baseFps - 1) * 100).toFixed(0)}%`);
}
console.log('errors:', errs.length ? errs.slice(0, 3).join(' | ') : 'none');
await browser.close().catch(() => {}); srv.kill();
