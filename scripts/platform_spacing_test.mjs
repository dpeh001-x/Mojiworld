// Crowded platforms are spaced out on load, and nothing becomes unreachable.
//
// Per user: "try to space out even more, vertically and horizontally". Right after a map's layout is built,
// _lxSpaceOutPlatforms pushes crowded pairs apart (stacked less than LX_SPACE_V apart while overlapping, or
// side by side closer than LX_SPACE_H). For EVERY map this runs the pass on a fresh layout and checks: the
// crowding goes down and never up; with an independent copy of the jump model, every platform reachable
// before is still reachable; every portal, NPC and launch pad that stood on a platform still stands on it;
// a platform carrying a world prop never moves; boss arenas, the Void and Clockwork Spire are untouched;
// and the authored MAPS data is not mutated. Then a live load confirms the game plays the spaced layout.
//   node scripts/platform_spacing_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11701), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p)), headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _variedMapData === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => {
    if (typeof _lxSpaceOutPlatforms !== 'function') return { missing: true };
    const V = LX_SPACE_V, H = LX_SPACE_H, UP = LX_REACH_UP, X = LX_REACH_X, out = { before: 0, after: 0, maps: [], lost: [], riders: [], props: [], exempt: [], mutated: [] };
    const ov = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), crowd = (a, b) => { const o = ov(a, b), d = Math.abs(b.y - a.y); return (o > 8 && d > 0 && d < V) || (d < 24 && -o < H); };
    const count = (fl) => { let n = 0; for (let i = 0; i < fl.length; i++) for (let j = i + 1; j < fl.length; j++) if (crowd(fl[i], fl[j])) n++; return n; };
    const reach = (all) => { const fl = all.filter((p) => p.type !== 'ground' && p.w > 0), g = all.filter((p) => p.type === 'ground'), q = g.length ? g.slice() : [fl.reduce((m, p) => (p.y > m.y ? p : m), fl[0])], R = new Set(q.map((p) => all.indexOf(p)));
      while (q.length) { const s = q.pop(); for (const t of fl) { const ti = all.indexOf(t); if (R.has(ti)) continue; const rise = s.y - t.y, gap = -ov(s, t); if (rise <= UP && gap <= X + Math.max(0, -rise) * 0.8) { R.add(ti); q.push(t); } } } return R; };
    const on = (e, p) => p && e.x >= p.x - 4 && e.x <= p.x + p.w + 4 && p.y - e.y >= -4 && p.y - e.y <= 60;
    for (const id of Object.keys(MAPS)) {
      const snap = JSON.stringify([MAPS[id].platforms, MAPS[id].portals, MAPS[id].npcs, MAPS[id].launchPads]);
      const md = _variedMapData(id); if (!md || !md.platforms) continue;
      const pre = JSON.parse(JSON.stringify(md.platforms)), flPre = pre.filter((p) => p.type !== 'ground' && p.w > 0), c0 = count(flPre), R0 = flPre.length > 1 ? reach(pre) : new Set();
      const hosts = []; for (const k of ['portals', 'npcs', 'launchPads']) (md[k] || []).forEach((e, i) => { if (e && typeof e.x === 'number' && typeof e.y === 'number') { let hi = -1; pre.forEach((p, k) => { if (p.type !== 'ground' && on(e, p) && (hi < 0 || p.y - e.y < pre[hi].y - e.y)) hi = k; }); if (hi >= 0) hosts.push([k, i, hi, e.x - pre[hi].x, e.y - pre[hi].y]); } });
      const moved = _lxSpaceOutPlatforms(md, id), post = md.platforms, c1 = count(post.filter((p) => p.type !== 'ground' && p.w > 0));
      out.before += c0; out.after += c1; if (moved) out.maps.push(id + ':' + c0 + '>' + c1 + '(' + moved + ')');
      if (c1 > c0) out.lost.push(id + ' crowding rose');
      if (flPre.length > 1) { const R1 = reach(post); for (const i of R0) if (!R1.has(i)) out.lost.push(id + ' #' + i); }
      for (const [k, i, hi, rx, ry] of hosts) { const e = md[k][i], p = post[hi]; if (Math.round(e.x - p.x) !== Math.round(rx) || Math.round(e.y - p.y) !== Math.round(ry)) out.riders.push(id + ' ' + k + '#' + i); }
      for (const pr of (MAP_PROPS[id] || [])) { const hi = pre.findIndex((p) => p.type !== 'ground' && pr.x >= p.x - 4 && pr.x <= p.x + p.w + 4 && Math.abs(pr.y - p.y) <= 10); if (hi >= 0 && (post[hi].x !== pre[hi].x || post[hi].y !== pre[hi].y)) out.props.push(id + ' ' + pr.key); }
      if ((MAPS[id].isBossArena || MAPS[id].isVoid || id === 'clockworkSpire') && moved) out.exempt.push(id);
      if (JSON.stringify([MAPS[id].platforms, MAPS[id].portals, MAPS[id].npcs, MAPS[id].launchPads]) !== snap) out.mutated.push(id);
    }
    return out;
  });
  if (r.missing) ok('the spacing pass exists (_lxSpaceOutPlatforms)', false);
  else {
    console.log('crowded pairs across the game:', r.before, '->', r.after, '; maps changed', r.maps.length); console.log('  ' + r.maps.join(' '));
    ok(`crowding goes down across the game (${r.before} -> ${r.after}) and rises on no map`, r.after < r.before && !r.lost.some((x) => /rose/.test(x)), { before: r.before, after: r.after });
    ok('every platform reachable before the pass is still reachable after it (independent jump model)', !r.lost.some((x) => /#/.test(x)), r.lost.slice(0, 8));
    ok('every portal, NPC and launch pad on a moved platform rides with it', r.riders.length === 0, r.riders.slice(0, 8));
    ok('no platform carrying a world prop moves', r.props.length === 0, r.props);
    ok('boss arenas, the Void and Clockwork Spire keep their authored layout', r.exempt.length === 0, r.exempt);
    ok('the authored MAPS data is never mutated', r.mutated.length === 0, r.mutated.slice(0, 6));
    const live = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
      try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
      for (const el of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const n = document.getElementById(el); if (n) n.style.display = 'none'; }
      loadMap('town', 300); await sleep(1200);
      const md = game.mapData, on = (e) => md.platforms.some((p) => p.type !== 'ground' && e.x >= p.x - 4 && e.x <= p.x + p.w + 4 && Math.abs(p.y - e.y) <= 60);
      return { spaced: md._lxSpaced || null, npcs: (game.npcs || []).length, npcsOnSomething: (game.npcs || []).filter((n) => typeof n.y === 'number' && on(n)).length };
    });
    ok('a live load of Everdawn Central plays the spaced layout', !!live.spaced && live.spaced.after < live.spaced.before, live);
  }
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
