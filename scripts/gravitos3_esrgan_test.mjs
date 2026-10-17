// GRAVITOS FORM 3 STEADIER FACE (v0.30.x gravitos3-esrgan). Per user ("Ship it"): the 69 form-3 frames of v0.30.1828 (paid AI upscale,
// face re-invented per frame) are replaced by a free local Real-ESRGAN redo from the same originals, same canvases, same outline.
// Checks, on this tree (PORT / MOJI_GAME_FILE from the environment; MOJI_SERVE_ROOT overrides the served tree, MOJI_REPO the git checkout):
//   FILES    : all 69 form-3 frames are the reviewed ESRGAN ones (sha256 listed in apply_gravitos3_esrgan_bake.mjs), each replacing
//              v0.30.1828's frame (its sha256 as committed in 92db897ce)
//   GEOMETRY : every frame keeps v0.30.1828's canvas size and its alpha plane byte for byte (feet, size, reach, outline tables unchanged)
//   CALIB    : form 3's calibration rows and player-attack hit boxes (every gravitos3* entry) are origin's, untouched
//   TABLES   : every pixel-table row the bake lists holds its new value; sw.js CACHE carries the gravitos3-esrgan bump
//   GAME     : in the game, every form-3 set loads all its frames, and the files the page fetches are the new ones
//   SUITES   : gravitos3_hq_test passes on this tree (its FILES / OUTLINE / CALIB / REACH rows plus gravitos3_anim_test,
//              gravitos_feet_plant_test, boss_anim_integrity_test and grav_star_fit_test on this tree's art + tables)
//   + no page errors.   node scripts/gravitos3_esrgan_test.mjs
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { spawn, execFileSync, spawnSync } from 'node:child_process'; import { readFileSync, existsSync } from 'node:fs';
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(HERE, '..'), REPO = process.env.MOJI_REPO || path.resolve(HERE, '..');
const require = createRequire(path.join(path.resolve(HERE, '..'), 'package.json'));
const { chromium } = require('playwright-core'); const sharp = require('sharp'); sharp.cache(false); const crypto = require('node:crypto');
const PORT = Number(process.env.PORT || 11730), GAME = process.env.MOJI_GAME_FILE || 'mojiworld_game.html', FILE = path.basename(GAME);
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info).slice(0, 700)}`); if (!ok) bad++; };
const REF1828 = '92db897ce', BASE = process.env.LX_BASE_REF || 'origin/main';
const show = (rel, ref) => { try { return execFileSync('git', ['show', ref + ':' + rel], { cwd: REPO, maxBuffer: 1 << 26 }); } catch (e) { return null; } };
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const J = (v) => JSON.stringify(v);
let A2 = ''; try { A2 = readFileSync(path.join(HERE, 'apply_gravitos3_esrgan_bake.mjs'), 'utf8'); } catch (e) {}
const ROWS = [...A2.matchAll(/\["(Sprites\/bosses\/[^"]+)",(\d+),"([0-9a-f]{64})",(\d+),"([0-9a-f]{64})"\]/g)].map((m) => ({ rel: m[1], oB: +m[2], oSha: m[3], nB: +m[4], nSha: m[5] }));
// ---- FILES + GEOMETRY
{
  const wrong = [], notFrom = [], geo = [];
  for (const r of ROWS) {
    const o = show(r.rel, REF1828); if (!o || o.length !== r.oB || sha(o) !== r.oSha) notFrom.push(r.rel.slice(15));
    let b = null; try { b = readFileSync(path.join(ROOT, r.rel)); } catch (e) {}
    if (!b || b.length !== r.nB || sha(b) !== r.nSha) { wrong.push(r.rel.slice(15)); continue; }
    if (!o) continue;
    const [n, l] = await Promise.all([sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true }), sharp(o).ensureAlpha().raw().toBuffer({ resolveWithObject: true })]);
    if (n.info.width !== l.info.width || n.info.height !== l.info.height) { geo.push(`${r.rel.slice(15)} ${n.info.width}x${n.info.height} vs ${l.info.width}x${l.info.height}`); continue; }
    let d = 0; for (let i = 3; i < n.data.length; i += 4) if (n.data[i] !== l.data[i]) d++;
    if (d) geo.push(`${r.rel.slice(15)} alpha differs on ${d} px`);
  }
  check(ROWS.length === 69 && !wrong.length, `FILES: all ${ROWS.length} form-3 frames are the reviewed ESRGAN ones (sha256)`, { n: ROWS.length, wrong: wrong.slice(0, 8), more: Math.max(0, wrong.length - 8) });
  check(ROWS.length === 69 && !notFrom.length, 'FILES: each one replaces v0.30.1828\'s frame of the same name (sha256 as committed in ' + REF1828 + ')', notFrom.slice(0, 8));
  check(ROWS.length === 69 && !wrong.length && !geo.length, 'GEOMETRY: every frame keeps v0.30.1828\'s canvas and its alpha plane byte for byte (0 px from the approved feet / size / reach)', geo.slice(0, 8));
}
// ---- CALIB (untouched) + TABLES + sw.js
const parseCal = (s) => { const a = s.indexOf('window.LX_ANIM_CALIB = '), b = s.indexOf('window.LX_ATK_HITBOX = '); return { c: JSON.parse(s.slice(a + 23, b).trim().replace(/;$/, '')), h: JSON.parse(s.slice(b + 22).trim().replace(/;\s*$/, '')) }; };
{
  let L = null, O = null; try { L = parseCal(readFileSync(path.join(ROOT, 'data/anim_calib.js'), 'utf8')); O = parseCal(String(show('data/anim_calib.js', BASE) || '')); } catch (e) {}
  const diff = []; if (!L || !O) diff.push('anim_calib.js unreadable');
  else for (const part of ['c', 'h']) for (const k of new Set([...Object.keys(L[part]), ...Object.keys(O[part])])) if (/^gravitos3/.test(k) && J(L[part][k]) !== J(O[part][k])) diff.push(part + ' ' + k);
  const n3 = L ? Object.keys(L.c).filter((k) => /^gravitos3/.test(k)).length : 0, nh = L ? Object.keys(L.h).filter((k) => /^gravitos3/.test(k)).length : 0;
  check(!diff.length && n3 >= 5 && nh >= 1, `CALIB: form 3's ${n3} calibration rows and ${nh} hit-box rows are origin's (${BASE}), untouched`, diff.slice(0, 8));
}
{
  const P = [...A2.matchAll(/^  (\["data\/.*\]),\r?$/gm)].map((m) => JSON.parse(m[1])), off = [];
  const objEnd = (s, j0) => { let d = 0, q = false; for (let k = j0; k < s.length; k++) { const ch = s[k]; if (q) { if (ch === String.fromCharCode(92)) k++; else if (ch === '"') q = false; continue; } if (ch === '"') q = true; else if (ch === '{') d++; else if (ch === '}') { d--; if (d === 0) return k + 1; } } return -1; };
  const cache = new Map();
  for (const [rel, prefix, at, , nv] of P) {
    if (!cache.has(rel)) { let o = null; try { const s = readFileSync(path.join(ROOT, rel), 'utf8'), i = s.indexOf(prefix); o = JSON.parse(s.slice(i + prefix.length, objEnd(s, i + prefix.length))); } catch (e) {} cache.set(rel, o); }
    let o = cache.get(rel); for (const k of at) o = o == null ? undefined : o[k];
    if (J(o) !== J(nv)) off.push(rel + ' ' + at.join('.'));
  }
  let sw = ''; try { sw = readFileSync(path.join(ROOT, 'sw.js'), 'utf8'); } catch (e) {}
  check(!off.length && /^const CACHE = 'mojiworld-assets-v\d+';\s+\/\/ gravitos3-esrgan/m.test(sw), `TABLES: all ${P.length} re-measured pixel-table rows hold their new values; sw.js CACHE bumped for the replaced frames`, { off: off.slice(0, 6), sw: /gravitos3-esrgan/.test(sw) });
}
// ---- GAME (the page loads every form-3 set; the frame files it fetches are the new ones) + no page errors
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT }); await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const errs = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }), p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(String(e.message || e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    const b = show(rel, 'origin/main'); if (b) r.fulfill({ status: 200, contentType: 'font/woff2', body: b }); else r.continue();
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function' && typeof _lxBossArtWant === 'function', null, { timeout: 180000 });
  const out = await p.evaluate(async (rels) => { const W8 = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) { el.classList.add('fade'); el.style.display = 'none'; } }
    player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._god = true; player.invulnerable = 999999; player._gravitosCineSeen = true; loadMap('forest', 300); await W8(2500);
    const t0f = game.time | 0, m = spawnMonster(player.x + 420, player.y - 200, 'gravitos', true); await W8(1000); game.paused = true; const mi = game.monsters.indexOf(m); if (mi >= 0) game.monsters.splice(mi, 1);   // hold him out of the fight (as gravitos3_hq_test)
    m._phaseSprite = 'gravitos3'; m._gravitosPhase = 3; m.phase = 3;
    const S = { idle: () => BOSS_IDLE_FRAMES.gravitos3, walk: () => BOSS_WALK_FRAMES.gravitos3, slam: () => BOSS_ATTACK_FRAMES.gravitos3, beam: () => BOSS_ATTACK_FRAMES.gravitos3laser,
      punch: () => BOSS_ATTACK_FRAMES.gravitos3punch, soul: () => BOSS_ATTACK_FRAMES.gravitos3soul, star: () => BOSS_ATTACK_FRAMES.gravitos3star };
    const ok = (im) => im && ((im.complete && im.naturalWidth > 0) || im.tagName === 'CANVAS'), t0 = performance.now();
    while (performance.now() - t0 < 150000 && !Object.values(S).every((f) => f() && f().length >= 9 && f().every(ok))) { try { _lxBossArtWant('gravitos', true); _lxBossArtWant('gravitos3', true); } catch (e) {} await W8(200); }
    const sets = {}; for (const [k, f] of Object.entries(S)) { const a = f(); sets[k] = a ? a.filter(ok).length + '/' + a.length : 'missing'; }
    const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join(''), shas = {};
    for (const rel of rels) { try { const r = await fetch(rel, { cache: 'no-store' }); shas[rel] = r.ok ? hex(await crypto.subtle.digest('SHA-256', await r.arrayBuffer())) : 'http ' + r.status; } catch (e) { shas[rel] = 'err ' + e.message; } }
    return { sets, shas, frames: (game.time | 0) - t0f };
  }, ROWS.map((r) => r.rel));
  const want = { idle: '9/9', walk: '15/15', slam: '9/9', beam: '9/9', punch: '9/9', soul: '9/9', star: '9/9' };
  check(J(out.sets) === J(want), 'GAME: every form-3 set loads all its frames in the game (idle 9, walk 15, slam / beam / punch / soul drain / supernova 9)', { sets: out.sets, framesRan: out.frames });
  const stale = ROWS.filter((r) => out.shas[r.rel] !== r.nSha).map((r) => r.rel.slice(15) + ' ' + String(out.shas[r.rel]).slice(0, 12));
  check(ROWS.length === 69 && !stale.length, 'GAME: the 69 frame files the page fetches are the new ESRGAN ones', stale.slice(0, 6));
  await ctx.close();
} finally { await browser.close(); srv.kill(); }
check(!errs.length, 'no page errors', errs.slice(0, 4));
// ---- SUITES: gravitos3_hq_test on this tree (it runs the anim / plant / integrity / star-fit suites itself, each retried up to 3 runs)
{
  const hq = path.join(HERE, 'gravitos3_hq_test.mjs');
  let out = '', ok = false, runs = 0;
  for (let a = 0; a < 2 && !ok && existsSync(hq); a++) { runs++;
    const r = spawnSync(process.execPath, [hq], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(PORT + 4), MOJI_REPO: REPO, MOJI_SERVE_ROOT: ROOT, MOJI_GAME_FILE: GAME }), encoding: 'utf8', timeout: 3600000, maxBuffer: 1 << 26 });
    out = String(r.stdout || '') + String(r.stderr || ''); ok = /^all \d+ passed/m.test(out.trim().split(/\r?\n/).slice(-3).join('\n')); }
  const lines = out.split(/\r?\n/), row = (re) => lines.find((l) => re.test(l)) || '', last = lines.filter((l) => l.trim()).pop() || '(no output)';
  for (const l of lines.filter((q) => /^(PASS|FAIL|INFO)/.test(q.trim()))) console.log('   hq| ' + l.trim().slice(0, 200));
  check(ok, `SUITE: gravitos3_hq_test passes on this tree (${last.trim()}${runs > 1 ? ', run ' + runs : ''})`, lines.filter((l) => /^FAIL/.test(l.trim())).map((l) => l.slice(0, 200)).slice(0, 5));
  const anim = row(/gravitos3_anim_test\.mjs still passes/), star = row(/grav_star_fit_test\.mjs .*still passes/);
  check(/^PASS/.test(anim.trim()), 'SUITE: gravitos3_anim_test passes (one body across every form-3 set)', anim.trim().slice(0, 200) || 'row missing');
  check(/^PASS/.test(star.trim()), 'SUITE: grav_star_fit_test passes on this tree\'s art + tables (the supernova plays all nine frames, hands back from f8)', star.trim().slice(0, 200) || 'row missing');
}
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
