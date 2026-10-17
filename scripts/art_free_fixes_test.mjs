// ART CLEANED OF COMPRESSION BLOCKS (v0.30.x art-free-fixes): effect frames, backdrops, the world map and menu plates re-saved clean
// under their own names (no credits). Checks, on this tree (PORT / MOJI_GAME_FILE from the environment; MOJI_SERVE_ROOT overrides the
// served tree, MOJI_REPO the git checkout):
//   FILES   : every replaced file is the reviewed one (sha256 listed in apply_art_free_fixes_assets.mjs), on origin's unchanged canvas
//   OUTLINE : every file's alpha plane is origin's byte for byte (so data/sprite_edges.js / sprite_bbox.js, hit boxes and placement hold)
//   BLOCKS  : the visible 4x4 compression grid (flat block boundaries stepping >= 2 levels, minus the same count off the grid) is down by
//             a quarter or more on the effects (in total), the world map and each backdrop / menu plate
//   SW      : sw.js's asset CACHE went up a generation for the replaced art
//   GAME    : the game file carries the marker; the server hands out the new bytes; every replaced effect's edge-table row equals a live
//             probe of the new file (the table generator's own 48 px drawImage probe); replaced effects spawn and draw; no page errors
//   node scripts/art_free_fixes_test.mjs
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process'; import { readFileSync } from 'node:fs';
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(HERE, '..'), REPO = process.env.MOJI_REPO || path.resolve(HERE, '..');
const require = createRequire(path.join(path.resolve(HERE, '..'), 'package.json'));
const { chromium } = require('playwright-core'); const sharp = require('sharp'); sharp.cache(false); const crypto = require('node:crypto');
const PORT = Number(process.env.PORT || 11696), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info).slice(0, 700)}`); if (!ok) bad++; };
const ORIG_REF = 'b9f300314';   // origin before this package
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
let A2 = ''; try { A2 = readFileSync(path.join(HERE, 'apply_art_free_fixes_assets.mjs'), 'utf8'); } catch (e) {}
const ROWS = [...A2.matchAll(/\["((?:Sprites|backgrounds)\/[^"]+)",\d+,"([0-9a-f]{64})",\d+,"([0-9a-f]{64})"\]/g)].map((m) => ({ rel: m[1], oSha: m[2], nSha: m[3] }));
const N_EXPECT = 1097;
// origin's copies, all in one cat-file
const orig = new Map();
{ const out = execFileSync('git', ['cat-file', '--batch'], { cwd: REPO, maxBuffer: 1 << 29, input: ROWS.map((r) => ORIG_REF + ':' + r.rel).join('\n') + '\n' }); let o = 0;
  for (const r of ROWS) { const nl = out.indexOf(10, o), h = out.subarray(o, nl).toString().split(' '); if (h[1] === 'missing') { o = nl + 1; continue; } const n = +h[2]; orig.set(r.rel, out.subarray(nl + 1, nl + 1 + n)); o = nl + 1 + n + 1; } }
// visible 4x4 grid, per mille (see the header); luma rounded, solid px only
function grid(A, W, H) {
  const N = W * H, L = new Int16Array(N), S = new Uint8Array(N);
  for (let i = 0; i < N; i++) { L[i] = Math.round(0.299 * A[i * 4] + 0.587 * A[i * 4 + 1] + 0.114 * A[i * 4 + 2]); S[i] = A[i * 4 + 3] > 250 ? 1 : 0; }
  let gb = 0, nb = 0, go = 0, no = 0;
  for (let ax = 0; ax < 2; ax++) { const n1 = ax ? W : H, n2 = ax ? H : W, st = ax ? W : 1;
    for (let a = 0; a < n1; a++) { const base = ax ? a : a * W;
      for (let b = 2; b < n2 - 2; b++) { const i = base + b * st; if (!S[i - 2 * st] || !S[i + st]) continue;
        const p1 = L[i - 2 * st], p0 = L[i - st], q0 = L[i], q1 = L[i + st]; if (Math.abs(p1 - p0) > 1 || Math.abs(q1 - q0) > 1) continue;
        if ((b & 3) === 0) { nb++; if (Math.abs(q0 - p0) >= 2) gb++; } else { no++; if (Math.abs(q0 - p0) >= 2) go++; } } } }
  return Math.max(0, (nb ? 1000 * gb / nb : 0) - (no ? 1000 * go / no : 0));
}
// ---- FILES + OUTLINE + BLOCKS
const kind = (rel) => /^Sprites\/(fx|projectiles|vfx)\//.test(rel) ? 'fx' : rel.includes('worldmap') ? 'wm' : 'plate';
const wrong = [], dims = [], outline = [], g = { fx: [0, 0] }, plates = [];
for (const r of ROWS) {
  let b = null; try { b = readFileSync(path.join(ROOT, r.rel)); } catch (e) {}
  const o = orig.get(r.rel); if (!o || sha(o) !== r.oSha) { wrong.push('origin copy? ' + r.rel); continue; }
  if (!b || sha(b) !== r.nSha) { wrong.push(r.rel); }
  if (!b) continue;
  const [dn, dO] = await Promise.all([sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true }), sharp(o).ensureAlpha().raw().toBuffer({ resolveWithObject: true })]);
  if (dn.info.width !== dO.info.width || dn.info.height !== dO.info.height) { dims.push(`${r.rel} ${dn.info.width}x${dn.info.height} vs ${dO.info.width}x${dO.info.height}`); continue; }
  let ad = 0; for (let i = 3; i < dn.data.length; i += 4) if (dn.data[i] !== dO.data[i]) ad++;
  if (ad) outline.push(`${r.rel} ${ad} px`);
  const gn = grid(dn.data, dn.info.width, dn.info.height), go = grid(dO.data, dO.info.width, dO.info.height), k = kind(r.rel);
  if (k === 'fx') { g.fx[0] += go; g.fx[1] += gn; } else plates.push({ rel: r.rel.split('/').pop(), k, go: +go.toFixed(1), gn: +gn.toFixed(1) });
}
check(ROWS.length === N_EXPECT && !wrong.length, `FILES: all ${ROWS.length} replaced files are the reviewed clean ones (sha256)`, { n: ROWS.length, wrong: wrong.slice(0, 6), more: Math.max(0, wrong.length - 6) });
check(ROWS.length === N_EXPECT && !wrong.length && !dims.length, 'FILES: every file keeps origin\'s canvas size (drawn boxes and bake bases unchanged)', dims.slice(0, 6));
check(ROWS.length === N_EXPECT && !wrong.length && !outline.length, 'OUTLINE: every file\'s alpha is origin\'s byte for byte (edge / bbox tables, hit boxes and placement hold)', outline.slice(0, 6));
const platesBad = plates.filter((p) => !(p.gn <= (p.k === 'wm' ? 0.6 : 0.8) * p.go));
check(g.fx[1] <= 0.75 * g.fx[0] && !platesBad.length && plates.length === N_EXPECT - ROWS.filter((r) => kind(r.rel) === 'fx').length, `BLOCKS: the visible compression grid is down on the effects (sum ${g.fx[0].toFixed(0)} -> ${g.fx[1].toFixed(0)}) and on every backdrop / plate`, { fx: g.fx.map((v) => +v.toFixed(0)), platesBad: platesBad.slice(0, 6) });
// ---- SW: this tree's CACHE is ABOVE origin's - relative, never a fixed number (another art drop may bump it first). Origin is
// origin/main until this package lands there; after that, the pre-package ORIG_REF (so a later re-run still reads true).
{ const ver = (t) => { const m = /^const CACHE = 'mojiworld-assets-v(\d+)';/m.exec(String(t || '')); return m ? +m[1] : null; };
  const gshow = (ref) => { try { return execFileSync('git', ['show', ref + ':sw.js'], { cwd: REPO, maxBuffer: 1 << 24 }).toString('utf8'); } catch (e) { return ''; } };
  let s = ''; try { s = readFileSync(path.join(ROOT, 'sw.js'), 'utf8').split('\r').join(''); } catch (e) {}
  let o = gshow('origin/main'); const oRef = o.includes('art-free-fixes') ? ORIG_REF : 'origin/main'; if (oRef === ORIG_REF) o = gshow(ORIG_REF);
  const vt = ver(s), vo = ver(o), note = /art-free-fixes[^\n]*\n[^\n]*\nconst CACHE = 'mojiworld-assets-v\d+';\s+\/\/ art-free-fixes/.test(s);
  check(note && vt != null && vo != null && vt > vo, `SW: sw.js CACHE is above origin's (this tree v${vt}, ${oRef} v${vo}) with the art-free-fixes note`, { vt, vo, oRef, note }); }
// ---- GAME
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (rt) => {
    const rel = decodeURIComponent(new URL(rt.request().url()).pathname).replace(/^[/]/, '');
    try { rt.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: REPO, maxBuffer: 1 << 24 }) }); } catch (e) { rt.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof spawnSpriteBurst === 'function' && typeof _fxAnimFrames === 'function', null, { timeout: 150000 });
  const html = readFileSync(path.join(ROOT, FILE), 'utf8');
  check(html.includes('art-free-fixes - ART CLEANED OF COMPRESSION BLOCKS'), 'GAME: the game file carries the art-free-fixes marker', FILE);
  const sample = ROWS.filter((_, i) => i % Math.max(1, Math.floor(ROWS.length / 40)) === 0).concat(ROWS.filter((r) => kind(r.rel) !== 'fx'));
  const served = await p.evaluate(async (rows) => { const out = []; for (const r of rows) { const b = await (await fetch(r.rel, { cache: 'no-store' })).arrayBuffer(); const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))].map((x) => x.toString(16).padStart(2, '0')).join(''); if (h !== r.nSha) out.push(r.rel); } return out; }, sample);
  check(!served.length, `GAME: the server hands out the new bytes (${sample.length} files sampled across every group)`, served.slice(0, 6));
  const fxRows = ROWS.filter((r) => kind(r.rel) === 'fx').map((r) => r.rel.replace(/^Sprites\//, ''));
  const edges = await p.evaluate(async (rels) => {
    const T = window.LX_SPRITE_EDGES || {}, S = 48, cv = document.createElement('canvas'); cv.width = S; cv.height = S; const g = cv.getContext('2d', { willReadFrequently: true });
    const probe = (img) => { g.clearRect(0, 0, S, S); g.drawImage(img, 0, 0, S, S); const d = g.getImageData(0, 0, S, S).data, a = (x, y) => d[(y * S + x) * 4 + 3];
      const scan = (get) => { let n = 0, f = -1, l = -1; for (let i = 0; i < S; i++) if (get(i) > 24) { n++; if (f < 0) f = i; l = i; } return n > 1 ? n + ':' + f + ':' + l : ''; };
      const v = [scan((i) => a(0, i)), scan((i) => a(S - 1, i)), scan((i) => a(i, 0)), scan((i) => a(i, S - 1))].join('|'); return v === '|||' ? '' : v; };
    let n = 0; const diff = [];
    for (let i = 0; i < rels.length; i += 40) await Promise.all(rels.slice(i, i + 40).map(async (rel) => { if (!(rel in T)) return; const im = new Image(); im.src = 'Sprites/' + rel; try { await im.decode(); } catch (e) { diff.push(rel + ' no decode'); return; } n++; const v = probe(im); if (v !== T[rel]) diff.push(rel + ' ' + v + ' vs ' + T[rel]); }));
    return { n, diff };
  }, fxRows);
  check(edges.n > 0.9 * fxRows.length && !edges.diff.length, `GAME: every replaced effect's edge-table row equals a live probe of its new file (${edges.n} rows)`, edges);
  const drew = await p.evaluate(async (keys) => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; try { for (const k of Object.keys(STORY_BEATS)) (player._storyBeatsSeen = player._storyBeatsSeen || {})[k] = true; } catch (e) {}
    loadMap('mushroom'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove(); player.invulnerable = 999999;
    const out = {};
    for (const k of keys) { try { _lxFxWant('fa:' + k, true); } catch (e) {} const t0 = performance.now(); let fr = null;
      while (performance.now() - t0 < 30000) { fr = _fxAnimFrames(k); if (fr && fr.length && fr.every((f) => _lxFxReady(f))) break; await new Promise((r) => setTimeout(r, 250)); }
      spawnSpriteBurst(player.x + 200, player.y, k, { size: 300, life: 40 }); const g0 = game.time | 0, w0 = performance.now();
      while ((game.time | 0) - g0 < 20 && performance.now() - w0 < 20000) await new Promise((r) => requestAnimationFrame(r));
      out[k] = { frames: fr ? fr.length : 0, ready: !!(fr && fr.every((f) => _lxFxReady(f))), ran: (game.time | 0) - g0 }; }
    return out;
  }, ['arrow_rain', 'shadow_strike', 'swing_ossuaryTyrant']);
  check(Object.values(drew).every((v) => v.frames >= 9 && v.ready && v.ran >= 20), 'GAME: replaced effects (a skill burst, a strike, a boss swing) load every frame and play', drew);
  check(!errs.length, 'no page errors', errs.slice(0, 4));
} finally { await browser.close(); srv.kill(); }
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
