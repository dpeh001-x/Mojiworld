// The W map's "▸ YOU ARE HERE" line reads clearly wherever you stand (here-line).
// It was a plain <text> fixed 70 units under the current node; on a map this dense that spot is often another
// node's: on main it lay on a neighbouring disc for 50 of the 80 places you can stand (The Bastion's sat on Hidden
// Pagoda). Now it takes a seat like the names do. For EVERY visible map (a wmX/wmY pin, not _wmIsHidden) this stands
// there through loadMap, opens the W map (toggleWorldMap) with every map discovered, and holds:
//   [1] the line is drawn under the current node's group
//   [2] it overlaps no other node's disc (the circle itself, not its bounding square)
//   [3] it overlaps no name that is showing (the current map's own included)
//   [4] it stays its node's: the edge of the line that faces its node is nearer to that node than to any other
// plus, on one map: [5] re-running the pass leaves the line exactly where it was (the zoom bands re-run it), [6] a lead
// tile (the atlas glyph a sub-label can carry) sits just before the text at whatever seat the text took, and [7] no
// page errors. Against main [2]-[4] fail; against the fix all hold.
//   node scripts/worldmap_here_line_test.mjs [page.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || process.env.PORT || 9953);
const PAGE_URL = (path.isAbsolute(PAGE) ? path.relative(ROOT, PAGE) : PAGE).split(path.sep).join('/');
const res = [];
const ok = (n, c, x) => { res.push({ n, pass: !!c }); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x === undefined ? '' : '  ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 700)}`); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, MOJI_GAME_FILE: '' } });
let srvErr = ''; server.stderr.on('data', (d) => { srvErr += d; });
const watchdog = setTimeout(() => { console.log('FAIL  watchdog: 15 minutes'); process.exit(2); }, 15 * 60 * 1000);
let browser;
try {
  await new Promise((r) => setTimeout(r, 1500));
  if (server.exitCode !== null) throw new Error(`serve.js exited (port ${PORT} taken?): ${srvErr.slice(0, 160)}`);
  browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--mute-audio'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${PAGE_URL}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof MAPS === 'object' && typeof loadMap === 'function' && typeof toggleWorldMap === 'function' && typeof _wmDeoverlapLabels === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(4000);
  // into the world as a Lv 60 hero in god mode with every story beat seen, in Everdawn, every map discovered
  const ids = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    window.__hl = {
      unblock() {
        try { closeAllModals(); } catch (e) {}
        try { if (typeof closeDialog === 'function') closeDialog(); } catch (e) {}
        for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
        const w = document.getElementById('everdawn-welcome-overlay'); if (w) w.remove();
        window._prologueActive = false; game.paused = false;
        player._god = true; player.invulnerable = 999999; player.hp = player.maxHp || player.hp || 100;
        if (Array.isArray(game.monsters)) game.monsters.length = 0;
      },
    };
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) o.style.display = 'none'; }
    window._prologueActive = false; window._lxBootGateDone = true;
    if (!player.cls) player.cls = 'warrior';
    player.level = 60;
    player._storyBeatsSeen = player._storyBeatsSeen || {};
    try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    loadMap('town'); await sleep(800); __hl.unblock();
    game.visitedMaps = Object.fromEntries(Object.keys(MAPS).map((k) => [k, true]));
    return Object.keys(MAPS).filter((id) => MAPS[id] && typeof MAPS[id].wmX === 'number' && typeof MAPS[id].wmY === 'number' && !_wmIsHidden(id)).sort();
  }).then((all) => (process.env.HL_ONLY ? all.filter((id) => process.env.HL_ONLY.split(',').includes(id)) : all));   // HL_ONLY=a,b to look at a few
  console.log(`${ids.length} visible maps`);
  const rows = [];
  for (const id of ids) {
    const r = await page.evaluate(async (id) => {
      const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
      __hl.unblock();
      let forced = false;
      try { loadMap(id); } catch (e) {}
      for (let i = 0; i < 20 && game.currentMap !== id; i++) await sleep(50);
      if (game.currentMap !== id) { game.currentMap = id; forced = true; }   // a map that redirects its entry still counts as where you stand
      await sleep(150); __hl.unblock();
      game.visitedMaps = Object.fromEntries(Object.keys(MAPS).map((k) => [k, true]));
      const modal = document.getElementById('worldmap-modal');
      if (modal.style.display === 'flex') toggleWorldMap();
      toggleWorldMap();
      const grid = document.getElementById('worldmap-grid');
      for (let i = 0; i < 60 && grid.classList.contains('wm-globe-spin'); i++) await sleep(50);   // measure after the zoom-in
      await sleep(900);                                                                              // the rAF pass, the fit, any band re-run
      const out = { id, forced, open: modal.style.display === 'flex' };
      const node = grid.querySelector(`g.wm-node[data-map-id="${id}"]`);
      const line = node && [...node.querySelectorAll('text')].find((t) => /YOU ARE HERE/.test(t.textContent || ''));
      if (!line) { out.line = null; toggleWorldMap(); return out; }
      const R = (el) => el.getBoundingClientRect();
      const lr = R(line); const tile = node.querySelector('svg[data-lx-subtile]');
      const box = tile ? (() => { const t = R(tile); return { left: Math.min(lr.left, t.left), right: Math.max(lr.right, t.right), top: Math.min(lr.top, t.top), bottom: Math.max(lr.bottom, t.bottom) }; })() : lr;
      const ov = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      out.line = { x: line.getAttribute('x'), y: line.getAttribute('y'), anchor: line.getAttribute('text-anchor') };
      const nm = node.querySelector('text.wm-node-label'); out.name = nm ? [nm.getAttribute('x'), nm.getAttribute('y'), nm.getAttribute('text-anchor')].join(' ') : null;
      // for information: does the current map's own name cover another node's disc (the line must not cost it its seat)
      out.nameOnDisc = [];
      if (nm) for (const g of grid.querySelectorAll('g.wm-node')) { if (g === node) continue; const d = g.querySelector('.wm-disc'); if (d && ov(R(nm), R(d)) > 1) out.nameOnDisc.push(g.getAttribute('data-map-id') + ':' + Math.round(ov(R(nm), R(d)))); }
      out.discs = []; out.names = [];
      const own = node.querySelector('.wm-disc').getBoundingClientRect(), oc = { x: own.left + own.width / 2, y: own.top + own.height / 2 };
      const ax = Math.max(box.left, Math.min(oc.x, box.right)), ay = Math.max(box.top, Math.min(oc.y, box.bottom)), dOwn = Math.hypot(ax - oc.x, ay - oc.y);
      out.nearer = [];
      for (const g of grid.querySelectorAll('g.wm-node')) {
        const other = g.getAttribute('data-map-id'); if (other === id) continue;
        const d = g.querySelector('.wm-disc'); if (!d) continue;
        // a disc is a circle: measure the box against the circle, not its bounding square (whose corners are empty)
        const dr = R(d), dcx = dr.left + dr.width / 2, dcy = dr.top + dr.height / 2, rad = dr.width / 2;
        const into = rad - Math.hypot(Math.max(box.left - dcx, 0, dcx - box.right), Math.max(box.top - dcy, 0, dcy - box.bottom));
        if (into > 0.5) out.discs.push(other + ':' + into.toFixed(1) + 'px in');
        if (Math.hypot(ax - (dr.left + dr.width / 2), ay - (dr.top + dr.height / 2)) <= dOwn) out.nearer.push(other);
      }
      for (const t of grid.querySelectorAll('text.wm-node-label')) {
        if (!(t.textContent || '').trim()) continue;
        const cs = getComputedStyle(t); if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) continue;
        const a = ov(box, R(t)); if (a > 1) out.names.push((t.closest('g.wm-node') || {}).getAttribute?.('data-map-id') + ':' + Math.round(a));
      }
      toggleWorldMap();
      return out;
    }, id).catch((e) => ({ id, err: String(e.message || e).slice(0, 120) }));
    rows.push(r);
  }
  const bad = (f) => rows.filter(f).map((r) => r.id + (r.err ? ' ' + r.err : ''));
  ok(`[1] standing in each of the ${ids.length} maps, the W map opens and draws the line under the current node`, rows.every((r) => !r.err && r.open && r.line), bad((r) => r.err || !r.open || !r.line));
  ok('[2] the line lies on no other node\'s disc', rows.every((r) => r.line && !r.discs.length), rows.filter((r) => r.line && r.discs.length).map((r) => `in ${r.id}: ${r.discs.join(',')}`));
  ok('[3] the line lies under no name that is showing', rows.every((r) => r.line && !r.names.length), rows.filter((r) => r.line && r.names.length).map((r) => `in ${r.id}: ${r.names.join(',')}`));
  ok('[4] the line stays its node\'s: no other node is nearer to it', rows.every((r) => r.line && !r.nearer.length), rows.filter((r) => r.line && r.nearer.length).map((r) => `in ${r.id}: ${r.nearer.join(',')}`));
  console.log('seats used: ' + JSON.stringify(rows.reduce((m, r) => { if (r.line) { const k = `${r.line.x},${r.line.y},${r.line.anchor}`; m[k] = (m[k] || 0) + 1; } return m; }, {})));
  console.log('forced (the map redirected its entry): ' + (rows.filter((r) => r.forced).map((r) => r.id).join(',') || 'none'));
  const nod = rows.filter((r) => r.nameOnDisc && r.nameOnDisc.length);
  console.log(`info: the current map's name covers another disc in ${nod.length} maps: ` + (nod.map((r) => `${r.id}(${r.nameOnDisc.join(',')})`).join(' ') || 'none'));
  // [5] + [6] on The Bastion (its line had to move: on main it lay on Hidden Pagoda)
  const st = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    __hl.unblock(); try { loadMap('bastion'); } catch (e) {} await sleep(300); if (game.currentMap !== 'bastion') game.currentMap = 'bastion'; __hl.unblock();
    const modal = document.getElementById('worldmap-modal'); if (modal.style.display === 'flex') toggleWorldMap();
    toggleWorldMap(); const grid = document.getElementById('worldmap-grid');
    for (let i = 0; i < 60 && grid.classList.contains('wm-globe-spin'); i++) await sleep(50);
    await sleep(900);
    const svg = grid.querySelector('svg'); const node = grid.querySelector('g.wm-node[data-map-id="bastion"]');
    const line = [...node.querySelectorAll('text')].find((t) => /YOU ARE HERE/.test(t.textContent || ''));
    const at = () => [line.getAttribute('x'), line.getAttribute('y'), line.getAttribute('text-anchor')].join(' ');
    const out = { first: at() };
    _wmDeoverlapLabels(svg); _wmDeoverlapLabels(svg); out.again = at();
    // a zoom-band round trip: the bands re-run the pass with the zoom scalar the names divide by
    const z0 = svg.getAttribute('data-wm-zoom'), k0 = svg.dataset.wmK;
    svg.setAttribute('data-wm-zoom', 'mid'); svg.dataset.wmK = '0.7'; _wmDeoverlapLabels(svg); out.mid = at();
    svg.setAttribute('data-wm-zoom', z0 || 'far'); if (k0 == null) delete svg.dataset.wmK; else svg.dataset.wmK = k0; _wmDeoverlapLabels(svg); out.back = at();
    // a lead tile - the atlas glyph a sub-label carries when its text starts with an emoji - rides with its text
    const NS = 'http://www.w3.org/2000/svg';
    const tile = document.createElementNS(NS, 'svg'); tile.setAttribute('data-lx-subtile', '1'); tile.setAttribute('width', '12'); tile.setAttribute('height', '12');
    const rct = document.createElementNS(NS, 'rect'); rct.setAttribute('width', '12'); rct.setAttribute('height', '12'); rct.setAttribute('fill', '#f0f'); tile.appendChild(rct);
    line.setAttribute('data-lx-sub', '1'); node.appendChild(tile);
    const snug = () => { const a = line.getBoundingClientRect(), b = tile.getBoundingClientRect(); const gap = a.left - b.right, mid = (b.top + b.bottom) / 2; return { gap: +gap.toFixed(1), ok: gap >= -1 && gap <= 6 && mid > a.top - 4 && mid < a.bottom + 4 }; };
    _wmDeoverlapLabels(svg); if (typeof _wmPlaceSubTiles === 'function') _wmPlaceSubTiles(svg); out.tilePass = snug();
    for (const [x, anc] of [[44, 'start'], [-44, 'end'], [0, 'middle']]) { line.setAttribute('x', x); line.setAttribute('text-anchor', anc); _wmPlaceSubTiles(svg); out['tile_' + anc] = snug(); }
    tile.remove(); line.removeAttribute('data-lx-sub'); _wmDeoverlapLabels(svg); toggleWorldMap();
    return out;
  }).catch((e) => ({ err: String(e.message || e).slice(0, 160) }));
  console.log('bastion line seats: ' + JSON.stringify(st));
  ok('[5] re-running the pass, and a zoom-band round trip, leave the line exactly where it was', !st.err && st.first === st.again && st.first === st.back, { first: st.first, again: st.again, mid: st.mid, back: st.back, err: st.err });
  ok('[6] a lead tile sits just before the text, at the seat the pass chose and at a side seat either way', !st.err && ['tilePass', 'tile_start', 'tile_end', 'tile_middle'].every((k) => st[k] && st[k].ok), { pass: st.tilePass, start: st.tile_start, end: st.tile_end, middle: st.tile_middle });
  ok('[7] no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) {
  ok('the run completes', false, String(e && e.message || e).slice(0, 300));
} finally {
  clearTimeout(watchdog);
  try { if (browser) await browser.close(); } catch (e) {}
  server.kill();
}
const f = res.filter((r) => !r.pass).length;
console.log(f ? `FAIL(${f})` : 'ALL PASS');
process.exit(f ? 1 : 0);
