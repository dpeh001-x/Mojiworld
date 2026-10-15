// BOSS FRAMES NO LONGER SLICED BY A STRAIGHT LINE - Libra and the Tower Arbiter (boss frame repair). Per user: some boss
// animation frames had art cut off by a hard straight vertical line (inside the canvas, or at its border), and the game
// draws frames whole, so the cut showed. The repaired frames replace the old ones under the same names.
//   art    : every repaired frame is the reviewed repair (sha256) at its old canvas size; Libra's attack 5/6 no longer
//            touch the right border; on every repaired side the art no longer stops on the old cut column (the longest
//            straight run of rows whose outermost ink sits on that column: at most half of before); the probe pixel shows the repair
//   tables : data/sprite_edges.js and data/sprite_bbox.js carry the new values for the frames whose border contact /
//            top row changed; sw.js's CACHE generation was bumped for the same-name replacement
//   live   : the Arbiter (tower_b5) and Libra (zod_libra) spawn, every frame of their sets decodes at its canvas size,
//            the game's frame tables serve the repaired pixels, each repaired frame draws through _lxDrawSoft, and the
//            bosses run ~240 game frames with no page errors
//   node scripts/boss_frame_repair_test.mjs        (MOJI_GAME_FILE = private build; BFR_ART_ROOT = a mirror holding the
//   replaced art + data/sprite_edges.js + data/sprite_bbox.js + sw.js, else the repo working tree)
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json')); const sharp = require('sharp');
const ART = process.env.BFR_ART_ROOT || ROOT;
const PORT = process.env.PORT || '11591';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (what, ok, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info).slice(0, 600)}`); if (!ok) bad++; };
// ==== GENERATED (scripts/_fx_boss_frame_repair_gen.mjs) ====
// arbiter-regen: the Tower Arbiter rows were retired - his sets were regenerated (scripts/arbiter_regen_test.mjs checks them).
const SIDES = [
  {"f":"Sprites/bosses/zodiac/attack/libra_5.webp","W":1106,"H":1106,"sha":"414a3f291d36b35a1a5f559e2ad864724fe6bb1b4f71413bd26ac40ff0cf65f4","side":"R","kind":"edge","cut":1106,"oLine":99,"probe":[1104,265,255,0]},
  {"f":"Sprites/bosses/zodiac/attack/libra_6.webp","W":1106,"H":1106,"sha":"b4946cfa7697be41d5066c16c34290d2ce4e7023e85d818d54283ad442d04774","side":"R","kind":"edge","cut":1106,"oLine":95,"probe":[1105,266,255,0]}
];
// [table file, its "window.X = " prefix, path into the object, new value]
const PATCHES = [
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/zodiac/attack/libra_5.webp"],"||2:24:36|19:14:38"],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["zodiac_libra","states","attack","f",5],{"c":[0,1105,33,1065],"s":[0,1105,36,1056],"p":"AwMEBQYJCgsMDA4ODg4ODg4NDAwLCwoKDA0NDA8XIC0vMEBCZmRmO0BVVVVUUU1KRkFAXl1XUk9gW1pSV2dkt7i5tbWxiXBaV1ZUVV1ocWxxd32Cb3F0dWtnaGhoZmZmZ2hpamZnZzAqLC0vMC4tLConFBYXJycmJSgpKiooGBc="}],
  ["data/sprite_edges.js","window.LX_SPRITE_EDGES = ",["bosses/zodiac/attack/libra_6.webp"],"||2:24:37|20:14:38"],
  ["data/boss_resize_manifest.js","window.LX_BOSS_RESIZE = ",["zodiac_libra","states","attack","f",6],{"c":[0,1105,58,1067],"s":[0,1105,62,1057],"p":"AwMEBQYJCgsMDA0ODg4ODQ0MCwoJCAgKDA0NDRAZIC0wMEBCZWRmO0BXV1ZUVFRRS0lIWlhVUlBPWFNTWmJeudK1s7GrhnJcV1RUVl9qc2tvc3h7fnN1dmdoaWtsbW5vbGxpamZnZ0cqLC0vMC4tLCoVFBYXJycmJSgpKiooGBc="}],
];
// ==== END GENERATED ====
const artFile = (rel) => { const p = path.join(ART, rel); if (existsSync(p)) return readFileSync(p); return execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 27 }); };
// ---- art (static)
const files = [...new Set(SIDES.map((s) => s.f))];
const shaBad = [], sizeBad = [], borderBad = [], lineBad = [], probeBad = [];
for (const f of files) {
  const buf = artFile(f), want = SIDES.find((s) => s.f === f);
  if (crypto.createHash('sha256').update(buf).digest('hex') !== want.sha) shaBad.push(f.replace('Sprites/bosses/', ''));
  const { data: d, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height; if (W !== want.W || H !== want.H) sizeBad.push(f + ' ' + W + 'x' + H);
  for (const s of SIDES.filter((q) => q.f === f)) {
    if (s.kind === 'edge') { let n = 0; for (let y = 0; y < H; y++) for (const x of s.side === 'R' ? [W - 1, W - 2, W - 3] : [0, 1, 2]) if (d[(y * W + x) * 4 + 3] > 24) { n++; break; } if (n) borderBad.push(f.replace('Sprites/bosses/', '') + ' ' + n + ' rows'); }
    let n = 0, run = 0, prev = -2; const ext = s.side === 'R' ? s.cut - 1 : s.cut;
    for (let y = 0; y < H; y++) { let l = -1, r = -1; for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 60) { if (l < 0) l = x; r = x; } if (l >= 0 && Math.abs((s.side === 'R' ? r : l) - ext) <= 1) { run = prev === y - 1 ? run + 1 : 1; prev = y; if (run > n) n = run; } }
    if (n > Math.floor(s.oLine * 0.5)) lineBad.push(`${f.replace('Sprites/bosses/', '')} ${s.side}: a ${n}-row straight run on x${ext} (was ${s.oLine})`);
    const [px, py, , pa] = s.probe, a = d[(py * W + px) * 4 + 3]; if (Math.abs(a - pa) > 24) probeBad.push(`${f.replace('Sprites/bosses/', '')} (${px},${py}) a${a} want ~${pa}`);
  }
}
check('every repaired frame is the reviewed repair (sha256)', !shaBad.length, shaBad);
check('every repaired frame keeps its canvas size', !sizeBad.length, sizeBad);
check('Libra\'s attack 5 and 6 no longer touch the right border', !borderBad.length, borderBad);
check('on every repaired side the art no longer stops on the old cut line', !lineBad.length, lineBad);
check('the probe pixel past each cut shows the repair', !probeBad.length, probeBad);
// ---- tables
const tbl = (rel, prefix) => { const s = artFile(rel).toString('utf8'); const i = s.indexOf(prefix) + prefix.length; return JSON.parse(s.slice(i, s.indexOf(';', s.lastIndexOf('}')))); };
const TB = {}, at = (o, p) => p.reduce((q, k) => (q == null ? undefined : q[k]), o);
for (const rel of new Set(PATCHES.map((q) => q[0]))) TB[rel] = tbl(rel, PATCHES.find((q) => q[0] === rel)[1]);
const tBad = (rel) => PATCHES.filter((q) => q[0] === rel && JSON.stringify(at(TB[rel], q[2])) !== JSON.stringify(q[3])).map((q) => q[2].join('.'));
check('data/sprite_edges.js carries the re-probed edges (Libra\'s right edge clean)', !tBad('data/sprite_edges.js').length, tBad('data/sprite_edges.js'));
check('data/sprite_bbox.js carries the new top rows', !tBad('data/sprite_bbox.js').length, tBad('data/sprite_bbox.js'));
check('the animator / resizer manifests carry the repaired frames\' boxes', !tBad('data/anim_calib_manifest.js').length && !tBad('data/boss_resize_manifest.js').length, [...tBad('data/anim_calib_manifest.js'), ...tBad('data/boss_resize_manifest.js')]);
const sw = artFile('sw.js').toString('utf8');
check('sw.js bumped its CACHE generation for the same-name art', /boss-frame-repair/.test(sw) && /^const CACHE = 'mojiworld-assets-v\d+';/m.test(sw), (sw.match(/^const CACHE.*$/m) || [''])[0].slice(0, 120));
// ---- live
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  await p.route((u) => /^[/](Sprites|data)[/]/.test(u.pathname), async (r) => {   // art / tables missing from this checkout come from origin
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: rel.endsWith('.js') ? 'text/javascript' : rel.endsWith('.json') ? 'application/json' : 'image/' + rel.split('.').pop(), body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 27 }) }); } catch (e) { r.continue(); }
  });
  const served = new Set([...files, 'data/sprite_edges.js', 'data/sprite_bbox.js']);   // the replaced files come from ART (a mirror) when one is given
  await p.route((u) => served.has(decodeURIComponent(u.pathname).replace(/^[/]/, '')), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    r.fulfill({ status: 200, contentType: rel.endsWith('.js') ? 'text/javascript' : 'image/webp', body: artFile(rel) });
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function' && typeof _lxBossArtWant === 'function' && typeof _lxDrawSoft === 'function', null, { timeout: 180000 });
  await p.evaluate(() => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth', 'lo-menu']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'warrior'; player.level = 70;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
  });
  const probes = SIDES.map((s) => ({ f: s.f, x: s.probe[0], y: s.probe[1], a: s.probe[3] }));
  for (const [map, type] of [['tower_b5', 'towerArbiter'], ['zod_libra', 'zodiac_libra']]) {
    const R = await p.evaluate(async ({ map, type, probes }) => {
      const W8 = (ms) => new Promise((r) => setTimeout(r, ms)), out = { map, type };
      try { loadMap(map); } catch (e) { out.loadErr = String(e).slice(0, 120); if (typeof MAPS !== 'undefined' && MAPS[map]) { game.currentMap = map; game.mapData = MAPS[map]; } }
      await W8(1500); document.getElementById('everdawn-welcome-overlay')?.remove();
      game.paused = false; player.invulnerable = 999999; player._god = true; game.monsters.length = 0;
      const WW = (game.mapData && game.mapData.worldWidth) || 1600;
      spawnMonster(Math.round(WW * 0.5), (game.mapData && game.mapData.worldHeight ? game.mapData.worldHeight - 260 : 380), type, true, false);
      const m = game.monsters.find((q) => q.type === type); out.spawned = !!m; if (!m) return out;
      m.currentHp = m.maxHp = 9e9;
      const sets = _lxBossArtSets(type), t0 = performance.now();
      while (performance.now() - t0 < 90000) { try { _lxBossArtWant(type, true); } catch (e) {} if (sets.every((s) => _lxFtReadyN(s) >= s.length)) break; await W8(150); }
      out.sets = sets.length; out.notReady = sets.filter((s) => _lxFtReadyN(s) < s.length).length;
      const g0 = game.time, t1 = performance.now();   // ~240 game frames with the boss alive (wall-clock guard: headless is slow)
      while (game.time - g0 < 240 && performance.now() - t1 < 60000) { player.x = m.x - 380; player.invulnerable = 999999; await W8(50); }
      out.ran = game.time - g0; out.alive = game.monsters.includes(m);
      // the game's own frame objects for the repaired files: decoded, drawable through _lxDrawSoft, serving the repaired pixels
      const cv = document.createElement('canvas'); cv.width = 400; cv.height = 400; const c = cv.getContext('2d');
      out.frames = [];
      for (const pr of probes) {
        const rel = pr.f.replace(/^Sprites\//, '');
        let hit = null; for (const s of sets) for (const im of s) { const src = String((im && (im.src || (im._lxSrc && im._lxSrc.src))) || ''); if (src.endsWith(rel)) hit = { im, src }; }
        if (!hit) continue;
        let drew = true; try { _lxDrawSoft(c, hit.im, 0, 0, 400, 400); } catch (e) { drew = String(e).slice(0, 80); }
        const img = new Image(); img.src = hit.src; try { await img.decode(); } catch (e) {}
        const pc = document.createElement('canvas'); pc.width = 1; pc.height = 1; const g = pc.getContext('2d', { willReadFrequently: true });
        g.drawImage(img, pr.x, pr.y, 1, 1, 0, 0, 1, 1);
        out.frames.push({ f: rel, drew, w: img.naturalWidth, a: g.getImageData(0, 0, 1, 1).data[3], want: pr.a });
      }
      return out;
    }, { map, type, probes });
    const mine = SIDES.filter((s) => (type === 'towerArbiter') === /towerArbiter/.test(s.f));
    check(`${type} spawns on ${map} and runs ~240 game frames`, R.spawned && R.alive && R.ran >= 200, R);
    check(`every ${type} set decodes (${R.sets} sets)`, R.sets > 0 && R.notReady === 0, { sets: R.sets, notReady: R.notReady });
    const fr = R.frames || [], want = [...new Set(mine.map((s) => s.f.replace(/^Sprites\//, '')))];
    const miss = want.filter((f) => !fr.find((q) => q.f === f)), wrong = fr.filter((q) => q.drew !== true || Math.abs(q.a - q.want) > 24);
    check(`the game's ${type} frame tables serve the repaired pixels and draw them through _lxDrawSoft`, !miss.length && !wrong.length, { miss, wrong });
  }
  check('no page errors', errs.length === 0, errs.slice(0, 5));
} catch (e) {
  check('test ran to the end', false, String(e).slice(0, 300));
} finally {
  await browser.close(); srv.kill();
}
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
