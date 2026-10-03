// Joined ground pieces read as one floor, with no cut where they meet (per user, with a screenshot: "Fix to ensure better
// continuity of the art for the floor, should not have a sudden cutoff and transition").
// 21 maps build their rises from stepped ground pieces that abut. Each piece painted its face from its own top-left (tone from
// its own lip, strata / stones / courses and mottle seeded by its own width, grain at a random offset), so at every join the
// bands jumped, the shade stepped and a pale 2px line ran down the seam. Each piece of a joined run now paints a window onto
// the run's one face (_lxGroundGroup), and the ramp over a join paints that face behind its slope.
// For up to three joins on each of four maps (sand, moss, grass), the floor drawn in game, hero and monsters hidden:
//   1. the run's pieces share one group window (and a lone piece has none)
//   2. across each join, the face below the cap steps by at most 8 levels (columns 3-8 px either side, lower face; the
//      same measure 40px off the seam - the texture alone - reads up to ~6)
//   3. no line down the seam: no column within 2 px of it stands out from its neighbours by more than 8 levels
//   [MOJI_SERVE_ROOT / PORT] node scripts/floor_seam_test.mjs      (serves mojiworld_game.html)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10033); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof drawPlatforms === 'function', null, { timeout: 180000 }); await page.waitForTimeout(4000);
  const R = await page.evaluate(async () => {
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._god = true; player.invulnerable = 0;
    window.drawPlayer = () => {};
    const out = { ver: GAME_VERSION, maps: [] }; const cv = document.getElementById('game'), g2 = cv.getContext('2d');
    for (const map of ['duneSands', 'cadetsStrand', 'glimmerwood', 'wildflowerPlains']) {
      loadMap(map, 300); await new Promise((r) => setTimeout(r, 2500)); game._mapFadeTimer = 0; game.paused = false;
      const g = game.mapData.platforms.filter((q) => q.type === 'ground'), joins = [];
      for (const a of g) for (const b of g) { if (a === b) continue; const gap = b.x - (a.x + a.w); if (gap >= -8 && gap <= 2 && Math.abs(b.y - a.y) <= 32 && Math.abs(b.y - a.y) >= 8) joins.push({ a, b, x: Math.round((a.x + a.w + b.x) / 2) }); }
      const lone = g.find((p) => !joins.some((j) => j.a === p || j.b === p));
      const grouped = typeof _lxGroundGroup === 'function' ? joins.slice(0, 3).map((j) => { const ga = _lxGroundGroup(j.a), gb = _lxGroundGroup(j.b); return !!ga && !!gb && ga.seed === gb.seed && ga.w === gb.w; }) : [];
      const res = { map, joins: joins.length, grouped, loneNull: lone ? (typeof _lxGroundGroup === 'function' ? _lxGroundGroup(lone) === null : false) : null, seams: [] };
      for (const j of joins.slice(0, 3)) {
        const T = performance.now(); while (performance.now() - T < 900) { game.monsters.length = 0; player.x = j.x - 40; player.vx = 0; await new Promise((r) => requestAnimationFrame(r)); }
        const sc = cv.width / W, camX = game.camera.x, camY = game.camera.y || 0;
        const top = Math.max(j.a.y, j.b.y), bot = Math.min(j.a.y + j.a.h, j.b.y + j.b.h);
        const y0 = Math.round((top + 0.35 * (bot - top) - camY) * sc), y1 = Math.round((bot - 6 - camY) * sc), sx = Math.round((j.x - camX) * sc);
        if (y1 - y0 < 6 || sx < 20 || sx > cv.width - 20) { res.seams.push({ x: j.x, skip: true }); continue; }
        // the same two numbers at a seam and, as a control for the texture itself, 40px (logical) either side of it
        const stats = (cx) => { const px = g2.getImageData(cx - 12, y0, 25, y1 - y0).data, cols = [];
          for (let c = 0; c < 25; c++) { let s = 0; for (let r = 0; r < y1 - y0; r++) { const i = (r * 25 + c) * 4; s += px[i] + px[i + 1] + px[i + 2]; } cols.push(s / (3 * (y1 - y0))); }
          const avg = (a, b) => cols.slice(a, b).reduce((p, v) => p + v, 0) / (b - a);
          const step = Math.abs(avg(15, 21) - avg(4, 10));   // columns 3-8 px right vs left (device px)
          let line = 0; for (let c = 10; c <= 14; c++) line = Math.max(line, Math.abs(cols[c] - (cols[c - 4] + cols[c + 4]) / 2));
          return [step, line]; };
        const [step, line] = stats(sx), cA = stats(sx - Math.round(40 * sc)), cB = stats(sx + Math.round(40 * sc));
        res.seams.push({ x: j.x, dy: j.b.y - j.a.y, step: +step.toFixed(1), line: +line.toFixed(1), ctlStep: +Math.max(cA[0], cB[0]).toFixed(1), ctlLine: +Math.max(cA[1], cB[1]).toFixed(1) });
      }
      out.maps.push(res);
    }
    return out;
  });
  console.log('build ' + R.ver);
  for (const m of R.maps) console.log('  ' + m.map + ': ' + m.joins + ' joins, seams ' + JSON.stringify(m.seams));
  ok('joined pieces share one group window, and a lone piece has none', R.maps.every((m) => m.grouped.length > 0 && m.grouped.every(Boolean) && m.loneNull !== false), JSON.stringify(R.maps.map((m) => [m.map, m.grouped, m.loneNull])));
  const seams = R.maps.flatMap((m) => m.seams.filter((s) => !s.skip).map((s) => ({ ...s, map: m.map })));
  const worstStep = seams.reduce((a, s) => (s.step > a.step ? s : a), { step: -1 }), worstLine = seams.reduce((a, s) => (s.line > a.line ? s : a), { line: -1 });
  ok('across every join the face steps by at most 8 levels (the texture alone moves up to ~6)', seams.length >= 8 && seams.every((s) => s.step <= 8), `${seams.length} seams, worst ${worstStep.step} (${worstStep.map} x ${worstStep.x})`);
  ok('no line down any seam (no column within 2px stands out by more than 8 levels)', seams.length >= 8 && seams.every((s) => s.line <= 8), `worst ${worstLine.line} (${worstLine.map} x ${worstLine.x})`);
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
