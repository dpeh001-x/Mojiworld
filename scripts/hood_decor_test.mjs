// The Shadow-Woven Hood dressed (v0.30.1570, per user): six ludo street pieces (ramen cart, wanted board, katana stand, cat crates,
// violet brazier, lantern string) join the kept skull banners, incense coil and lanterns. Pins: every piece decodes (no 404),
// standing pieces' visible feet sit on the street (y 480), the pieces this pass hung hook onto a real ledge top inside its span
// (the two lanterns that floated in mid-air are re-hung), the user's own placements stay put, nothing new covers an NPC or a door, and each new piece really lands on the canvas.
//   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10347); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await browser.newContext({ serviceWorkers: 'block' })).newPage();
const errs = [], miss = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
page.on('response', (r) => { if (r.status() >= 400 && /Sprites\/objects\/shadow_/.test(r.url())) miss.push(r.status() + ' ' + r.url().split('/').pop()); });
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
const NEW = ['shadow_ramen_cart', 'shadow_wanted_board', 'shadow_katana_stand', 'shadow_cat_crates', 'shadow_violet_brazier', 'shadow_lantern_string'];
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof MAP_PROPS === 'object' && typeof drawWorldProps === 'function' && typeof loadMap === 'function', null, { timeout: 180000 }); await page.waitForTimeout(6000);
  const r = await page.evaluate(async (NEW) => {
    const sleep = (ms) => new Promise((s) => setTimeout(s, ms)); const o = { ver: GAME_VERSION, reg: NEW.filter((k) => LX_OBJECTS_FILES.includes(k)) };
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { loadMap('shadowWovenHood', 1100); } catch (e) { o.loadErr = String(e && e.message); } await sleep(400); game.paused = true; o.map = game.currentMap;
    try { _lxArt2WantMap('shadowWovenHood', true); } catch (e) {}
    const list = MAP_PROPS.shadowWovenHood || []; o.keys = list.map((p) => p.key); o.rows = list.map((p) => ({ key: p.key, x: p.x, y: p.y, scale: p.scale, anchor: p.anchor }));
    { const t0 = performance.now(); while (performance.now() - t0 < 30000) { if (list.every((p) => { const im = LX_OBJECTS[p.key]; return im && im.complete && im.naturalWidth && LX_OBJECTS_META[p.key] && LX_OBJECTS_META[p.key].bboxBottomY != null; })) break; await sleep(200); } }
    o.ledges = (game.mapData.platforms || []).filter((q) => q.type !== 'ground' && q.y < 480).map((q) => ({ x: q.x, w: q.w, y: q.y }));
    o.npcs = game.npcs.map((n) => ({ name: n.name, x: n.x, y: n.y })); o.portals = game.portals.map((p) => ({ name: p.name || p.target, x: p.x, y: p.y }));
    // the visible content rect of every prop, with drawWorldProps' own geometry
    o.rects = list.map((p) => { const im = LX_OBJECTS[p.key], m = LX_OBJECTS_META[p.key] || {}; if (!(im && im.naturalWidth)) return { key: p.key, decoded: false };
      const f = Math.max(0.7, Math.min(1.4, Math.max(im.naturalWidth, im.naturalHeight) / 512)), h = 80 * (p.scale || 1) * f, w = h * im.naturalWidth / im.naturalHeight, sh = im.naturalHeight, anchor = p.anchor || 'feet';
      const pl = anchor === 'hang' || typeof _lxPropPlant !== 'function' ? 0 : _lxPropPlant(p, h, sh);   // v0.30.1621 floor-line: a standing prop is drawn planted into its line
      const sy = anchor === 'hang' ? p.y - h * (m.bboxTopY / sh) : p.y - h * ((m.bboxBottomY + 1) / sh) + 1 + pl;
      return { key: p.key, x: p.x, y: p.y, anchor, decoded: true, top: sy + h * (m.bboxTopY / sh), bottom: sy + h * ((m.bboxBottomY + 1) / sh), l: p.x - w / 2, r: p.x + w / 2, h, w, nw: im.naturalWidth, sx: p.x - w / 2, sy, pl }; });
    // each new piece lands on the canvas: centre it and record drawWorldProps' on-screen destination rects
    o.drawn = {};
    for (const k of NEW) { const p = list.find((q) => q.key === k); if (!p) continue; game.camera.x = Math.max(0, p.x - W / 2); const camX = game.camera.x, rr = o.rects.find((q) => q.key === k);
      const c = []; const P = CanvasRenderingContext2D.prototype, oI = P.drawImage; P.drawImage = function (im, ...a) { const d = a.length >= 8 ? { x: a[4], y: a[5], w: a[6], h: a[7] } : { x: a[0], y: a[1], w: a[2], h: a[3] }; if (this === ctx) c.push(d); return oI.apply(this, [im, ...a]); };
      try { drawWorldProps(); } catch (e) { c.push({ err: String(e && e.message) }); } finally { P.drawImage = oI; }
      o.drawn[k] = c.some((d) => !d.err && Math.abs(d.x - (rr.sx - camX)) < 2 && Math.abs(d.y - (rr.sy - (game.camera.y || 0))) < 3 && Math.abs(d.w - rr.w) < 2); }
    return o;
  }, NEW);
  console.log('build ' + r.ver + '  map ' + r.map + '  props ' + JSON.stringify(r.keys));
  ok('the six new pieces are registered in LX_OBJECTS_FILES', r.reg.length === 6, JSON.stringify(r.reg));
  ok('the Hood names all six, once each', NEW.every((k) => r.keys.filter((q) => q === k).length === 1), JSON.stringify(r.keys));
  ok('every Hood piece decodes, and no shadow_* sprite 404s', r.rects.every((q) => q.decoded) && miss.length === 0, JSON.stringify(miss));
  const feet = r.rects.filter((q) => q.anchor === 'feet' && q.y >= 470), hang = r.rects.filter((q) => q.anchor === 'hang');
  ok('every street piece (new and kept) has its feet row on the street (y 480 +- 3)', feet.length >= 9 && feet.every((q) => Math.abs(q.bottom - q.pl - 480) <= 3), JSON.stringify(feet.map((q) => [q.key, q.x, Math.round(q.bottom)])));
  ok('every standing street piece is drawn planted 2-5 px into the street line (v0.30.1621, per user: 2 px as NPC feet plus a tapered base gap; the skull banner hangs, 0)', feet.every((q) => (q.key === 'shadow_banner_skull' ? q.pl === 0 : q.pl >= 2 && q.pl <= 5)), JSON.stringify(feet.map((q) => [q.key, q.x, q.pl])));
  const onLedge = (q) => r.ledges.some((L) => Math.abs(L.y - q.y) <= 1 && q.x >= L.x + 4 && q.x <= L.x + L.w - 4);
  const placed = r.rects.filter((q) => NEW.includes(q.key) || (q.key === 'shadow_paper_lantern' && (q.x === 430 || q.x === 1200)));   // new pieces + the two lanterns this pass re-hung
  const placedHang = placed.filter((q) => q.anchor === 'hang');
  ok('the re-hung lanterns and the lantern string hook onto a real ledge top, inside its span', placedHang.length === 3 && placedHang.every(onLedge), JSON.stringify(placedHang.map((q) => [q.key, q.x, q.y])) + ' ledges ' + JSON.stringify(r.ledges));
  ok('nothing this pass placed stands in mid-air: new standing pieces are on the street, hanging ones on a ledge', placed.length === 8 && placed.every((q) => (q.anchor === 'hang' ? onLedge(q) : Math.abs(q.bottom - q.pl - 480) <= 3)), JSON.stringify(placed.map((q) => [q.key, q.x, q.y, Math.round(q.bottom)])));
  const kept = [['shadow_incense_coil', 277, 480, 0.55, 'feet'], ['shadow_banner_skull', 540, 363, 1, 'feet'], ['shadow_paper_lantern', 890, 279, 0.55, 'hang'], ['shadow_banner_skull', 2000, 480, 1.4, 'feet']];
  ok('the user’s own placements stay exactly where they were (incense coil - on the floor line since v0.30.1613 -, both skull banners, the eave lantern)', kept.every(([k, x, y, sc, an]) => r.rows.some((p) => p.key === k && p.x === x && p.y === y && p.scale === sc && (p.anchor || 'feet') === an)), JSON.stringify(r.rows));
  ok('the kept lantern at 890 hangs under the pagoda roof (Taiga’s 860-1140 roof ledge is right over it)', r.ledges.some((L) => L.x <= 890 && L.x + L.w >= 890 && L.y < 279 && 279 - L.y <= 70));
  ok('the lantern string hangs under the 1280-1420 bridge ledge, centred, its rope hooks at the ledge ends (the art less its 24 px transparent margin, within 1 px)', (() => { const s = r.rects.find((q) => q.key === 'shadow_lantern_string'); if (!s) return false; const m = s.w * 24 / s.nw; return s.y === 300 && s.x === 1350 && Math.abs(s.l + m - 1280) <= 1 && Math.abs(s.r - m - 1420) <= 1; })(), JSON.stringify(r.rects.find((q) => q.key === 'shadow_lantern_string')));
  const hit = (q, bx0, bx1, by0, by1) => q.l + 12 < bx1 && q.r - 12 > bx0 && q.top < by1 && q.bottom > by0;
  const fresh = r.rects.filter((q) => NEW.includes(q.key));
  ok('no new piece covers an NPC (x +- 20, from 10 px over the head to the feet at y + 44)', fresh.every((q) => !r.npcs.some((n) => hit(q, n.x - 20, n.x + 20, n.y - 10, n.y + 44))), JSON.stringify(r.npcs));
  ok('no new piece covers a door (x +- 35, the swirl drawn around its y, 420 by default)', fresh.every((q) => !r.portals.some((p) => { const py = p.y == null ? 420 : p.y; return hit(q, p.x - 35, p.x + 35, py - 70, py + 60); })), JSON.stringify(r.portals));
  ok('each new piece lands on the game canvas at its own anchor', NEW.every((k) => r.drawn[k] === true), JSON.stringify(r.drawn));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
