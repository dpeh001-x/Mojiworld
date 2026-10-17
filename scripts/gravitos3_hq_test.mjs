// GRAVITOS FORM 3 IN HIGH DEFINITION (v0.30.x gravitos3-hq). Per user: "make the sprite art of the gravitos3 more HQ", keeping the approved
// "default-aligned" calibration. Checks, on this tree (PORT / MOJI_GAME_FILE from the environment; MOJI_SERVE_ROOT overrides the served tree,
// MOJI_REPO the git checkout):
//   FILES   : all 69 form-3 frames are the reviewed HQ ones (sha256 listed in apply_gravitos3_hq_bake.mjs), each on origin's unchanged canvas
//   OUTLINE : every frame's alpha plane is the approved alignment's byte for byte (origin's for idle / walk / supernova, the one-transform
//             re-bake for slam / beam / punch / soul drain) - so feet, size and reach sit exactly (0 px) where they were approved
//   CALIB   : form 3's one calibration dy 0.0259 on every body state; the supernova s 1.0485 / dy 0.0259 and its hit region x1.3/1.0485
//   REACH   : in the game, every frame of every form-3 set at both facings, his player-attack box (_atkMonBox) in world space against his
//             foot point is the same (<= 1 px) as with origin's calibration rows
//   SUITES  : gravitos3_anim_test, gravitos_feet_plant_test, boss_anim_integrity_test pass, and grav_star_fit_test (v0.30.1827: the
//             supernova plays all nine frames and hands over from f8) passes on THIS tree's art + tables
//   + no page errors.   node scripts/gravitos3_hq_test.mjs
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { spawn, execFileSync, spawnSync } from 'node:child_process'; import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(HERE, '..'), REPO = process.env.MOJI_REPO || path.resolve(HERE, '..');
const require = createRequire(path.join(path.resolve(HERE, '..'), 'package.json'));
const { chromium } = require('playwright-core'); const sharp = require('sharp'); sharp.cache(false); const crypto = require('node:crypto');
const PORT = Number(process.env.PORT || 11686), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info).slice(0, 700)}`); if (!ok) bad++; };
const ORIG_REF = '221030aa7';   // origin before this package (form 3's frames + calibration unchanged since v0.30.1449 / boss-feet-calib)
const show = (rel, ref = ORIG_REF) => { try { return execFileSync('git', ['show', ref + ':' + rel], { cwd: REPO, maxBuffer: 1 << 26 }); } catch (e) { return null; } };
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const ALPHA = {"idle/gravitos3_0":"3d39b189668b10b8157691f10af11e36","idle/gravitos3_1":"edde63ed62e6e955e62c54e498967288","idle/gravitos3_2":"95b56959020c74e8a0cdc60a046a5620","idle/gravitos3_3":"11d5826b1a5c19cfce7cc241250713e5","idle/gravitos3_4":"782febcb7abbecf3386642d43d8d3e4f","idle/gravitos3_5":"91687f9240f85ccda6a4959039317ac9","idle/gravitos3_6":"c2d1f95383ac6083e8fab67c24e9becb","idle/gravitos3_7":"edb5a81c6804086487088005919bbf47","idle/gravitos3_8":"e5bac57fd5064425ee768b54de41d139","walk/gravitos3_0":"8156f890749b6b59ae0152b49de0e5ca","walk/gravitos3_1":"88edb420845d04abca6ea4ce34850234","walk/gravitos3_2":"ee792e4017939287456b5bb62e4ffde4","walk/gravitos3_3":"e2a669ad35150dab8abf59936c5c53cc","walk/gravitos3_4":"ad42c53efd2610f7241ebcba0bbf37e9","walk/gravitos3_5":"872506afa5ee7882909508bdfcc46295","walk/gravitos3_6":"49e3ab3520901991fb1dfd4e98bf0dfe","walk/gravitos3_7":"106974f5f8eaa54d90716833c51af3ee","walk/gravitos3_8":"4f5aea52c41f59cdb4def691cac1a5c3","walk/gravitos3_9":"83745d9c0356f927ad4a8e7413afabbc","walk/gravitos3_10":"59199b4bf4b4016c45facd4d6a6a9ad2","walk/gravitos3_11":"e81ddd41795f84b2346937345585a766","walk/gravitos3_12":"a9d58a1a11b3ce7f493f7f7ffecbc157","walk/gravitos3_13":"54dee2c8785c8f94ecf9e22b4b2da56b","walk/gravitos3_14":"119d75e4d93391af6f4170c6f67c06e0","attack/gravitos3_0":"e5a5ba3fc5185193b8bbfffabf7a2600","attack/gravitos3_1":"9486163875b6c69948b51b9863bfaf28","attack/gravitos3_2":"4b27f93390a0d1f85ecd25487988ac02","attack/gravitos3_3":"0c4e9d1298f1aad57497dc9ef27a6aa7","attack/gravitos3_4":"62b1ca10445fbca7a207c79d2d4ed7d8","attack/gravitos3_5":"0dcd2686cc1751f0270cf22c70546726","attack/gravitos3_6":"9a9b858a0b1b4094fe8807dc1216b681","attack/gravitos3_7":"175900108867409222e9cc2ce5423131","attack/gravitos3_8":"9682979128f641570f0831b5cfe02e8c","attack/gravitos3laser_0":"668e6740aead35af9eebbb8e747097cf","attack/gravitos3laser_1":"6dbaa206b0fc0ae95b229bb11b50a47e","attack/gravitos3laser_2":"f084b2bf5a6eddbcecb9d2ef9b4bb09c","attack/gravitos3laser_3":"d2676ff3e4ced03985fde8206421cac4","attack/gravitos3laser_4":"b0ccf65177d831e23b705c37702e9c90","attack/gravitos3laser_5":"ec32186a69f51fe1f6e1f2b95448ef82","attack/gravitos3laser_6":"fccf3e8684b0a01e5becac263315fc5e","attack/gravitos3laser_7":"85695ab3588434e2d1d87ff82ced2025","attack/gravitos3laser_8":"e016ca014ad63b4ad9d492aaff7a6fa1","attack/gravitos3punch_0":"27cc0c095aced79faf1f0fd7a88094a5","attack/gravitos3punch_1":"eda5f7497991f7b201331af622f30582","attack/gravitos3punch_2":"bc97aa256bebc5c37000ae16e62de48c","attack/gravitos3punch_3":"647e2e61eacfaef237c91a61bfdbcff3","attack/gravitos3punch_4":"6c7927c549edba0ef7f5952663915270","attack/gravitos3punch_5":"bcf2cea49ab4731d7d2030cc67e6a468","attack/gravitos3punch_6":"1ccd5033e4544ac6a6976c1eb4b33c27","attack/gravitos3punch_7":"ba8977eb92c942ee60b3139b7bb46f91","attack/gravitos3punch_8":"8e7d98fadcc9554a92a831d416ac4319","attack/gravitos3soul_0":"2ba1103a3c0c928d5a4b6dad13caf346","attack/gravitos3soul_1":"12675d4e4dca5e23ca0271690fa3f085","attack/gravitos3soul_2":"626eaf48de1bbbbe16d55f523287d90f","attack/gravitos3soul_3":"c47b76fceeb0abc75e0d6367338b0ba4","attack/gravitos3soul_4":"dbe71b49505469eddaa12d03c0aaa3eb","attack/gravitos3soul_5":"813b666efb84b4308f29c8445bb55523","attack/gravitos3soul_6":"6b11226b63b5120da2571c67f19dc30b","attack/gravitos3soul_7":"391ef7842e9ef97d12926196f0b9d715","attack/gravitos3soul_8":"9373d38c408f504ab4d4ee4d50614eed","attack/gravitos3star_0":"f21e00d2c6a68ed6a04f85aa6ecd6e0f","attack/gravitos3star_1":"38ca05901932d9370b5ad454b815535e","attack/gravitos3star_2":"2100b8fd23ebea8f6519c2418690079c","attack/gravitos3star_3":"895726540cd3c187445c922f7ee167ad","attack/gravitos3star_4":"3f86d2ff2b5460cc515523f47107b5c6","attack/gravitos3star_5":"ef0acff17f2b88640fbd0103e600d5f5","attack/gravitos3star_6":"45f75bdabb8378661d8206ac64e32b2f","attack/gravitos3star_7":"1f0951dd853f479b28dc2373dc023a26","attack/gravitos3star_8":"6d56e1e7a03aa675274234dd25b4650b"};
// ---- FILES + OUTLINE
{
  // gravitos3-esrgan: the 69 frames were re-made (free Real-ESRGAN, same canvases and outline) - their checksums now live in the newer bake
  let A2 = ''; for (const f of ['apply_gravitos3_esrgan_bake.mjs', 'apply_gravitos3_hq_bake.mjs']) { try { A2 = readFileSync(path.join(HERE, f), 'utf8'); break; } catch (e) {} }
  const ROWS = [...A2.matchAll(/\["(Sprites\/bosses\/[^"]+)",\d+,"([0-9a-f]{64})",\d+,"([0-9a-f]{64})"\]/g)], wrong = [], dims = [], outline = [];
  for (const [, rel, , nSha] of ROWS) {
    let b = null; try { b = readFileSync(path.join(ROOT, rel)); } catch (e) {}
    if (!b || sha(b) !== nSha) { wrong.push(rel.slice(15)); continue; }
    const o = show(rel), [mn, mo] = await Promise.all([sharp(b).metadata(), o ? sharp(o).metadata() : null]);
    if (!mo || mn.width !== mo.width || mn.height !== mo.height) dims.push(`${rel.slice(15)} ${mn.width}x${mn.height} vs ${mo && mo.width}x${mo && mo.height}`);
    const { data, info } = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true }), a = Buffer.alloc(info.width * info.height);
    for (let i = 0; i < a.length; i++) a[i] = data[i * 4 + 3];
    const key = rel.slice(15, -5); if (ALPHA[key] !== sha(a).slice(0, 32)) outline.push(key);
  }
  check(ROWS.length === 69 && !wrong.length, `FILES: all ${ROWS.length} form-3 frames are the reviewed HQ ones (sha256)`, { n: ROWS.length, wrong: wrong.slice(0, 8), more: Math.max(0, wrong.length - 8) });
  check(ROWS.length === 69 && !wrong.length && !dims.length, 'FILES: every frame keeps origin\'s canvas size (drawn box, hit regions and bake bases unchanged)', dims.slice(0, 8));
  check(ROWS.length === 69 && !wrong.length && !outline.length && Object.keys(ALPHA).length === 69, 'OUTLINE: every frame\'s alpha is the approved alignment\'s byte for byte (0 px from the approved feet / size / reach)', outline.slice(0, 8));
}
// ---- CALIB
const parseCal = (s) => { const a = s.indexOf('window.LX_ANIM_CALIB = '), b = s.indexOf('window.LX_ATK_HITBOX = '); return { c: JSON.parse(s.slice(a + 23, b).trim().replace(/;$/, '')), h: JSON.parse(s.slice(b + 22).trim().replace(/;\s*$/, '')) }; };
{
  const L = parseCal(readFileSync(path.join(ROOT, 'data/anim_calib.js'), 'utf8')), O = parseCal(String(show('data/anim_calib.js') || '')), bad2 = [];
  const want = { 'gravitos3.idle': [1.04, 0.0259], 'gravitos3.walk': [1.04, 0.0259], 'gravitos3.attack': [1.04, 0.0259], 'gravitos3laser.attack': [1.04, 0.0259], 'gravitos3punch.attack': [1.04, 0.0259],
    'gravitos3soul.attack': [1.04, 0.0259], 'gravitos3star.idle': [1.04, 0.0259], 'gravitos3star.walk': [1.04, 0.0259], 'gravitos3star.attack': [1.0485, 0.0259] };
  for (const [k, [s, dy]] of Object.entries(want)) { const [e, st] = k.split('.'), l = (L.c[e] || {})[st], o = (O.c[e] || {})[st];
    if (!l || l.s !== s || (l.dx || 0) !== 0 || l.dy !== dy || JSON.stringify(Object.assign({}, l, { s: 0, dx: 0, dy: 0 })) !== JSON.stringify(Object.assign({}, o, { s: 0, dx: 0, dy: 0 }))) bad2.push(k + ' ' + JSON.stringify(l)); }
  const hb = L.h.gravitos3star && L.h.gravitos3star.attack, okHb = hb && hb.w === 1.30632 && hb.h === 1.24297 && hb.ox === 0.08902 && hb.oy === 0.04451
    && JSON.stringify(Object.assign({}, L.h.gravitos3star, { attack: 0 })) === JSON.stringify(Object.assign({}, O.h.gravitos3star, { attack: 0 }));
  check(!bad2.length && okHb, 'CALIB: form 3 stands at dy 0.0259 in every body state, the supernova at s 1.0485 / dy 0.0259 with its hit region x1.3/1.0485 (timings and other boxes kept)', { bad: bad2, hb });
}
// ---- REACH + no page errors
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT }); await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const errs = [];
const grab = async (origCalib) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }), p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(String(e.message || e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname) || (origCalib && /[/]data[/]anim_calib[.]js$/.test(u.pathname)), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (rel.endsWith('.js')) return r.fulfill({ status: 200, contentType: 'text/javascript', body: show(rel) });
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    const b = show(rel, 'origin/main'); if (b) r.fulfill({ status: 200, contentType: 'font/woff2', body: b }); else r.continue();
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof _drawBossSprite === 'function' && typeof _atkMonBox === 'function', null, { timeout: 180000 });
  const out = await p.evaluate(async () => { const W8 = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) { el.classList.add('fade'); el.style.display = 'none'; } }
    player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._god = true; player.invulnerable = 999999; player._gravitosCineSeen = true; loadMap('forest', 300); await W8(2500);
    const m = spawnMonster(player.x + 420, player.y - 200, 'gravitos', true); await W8(1000); game.paused = true; const i = game.monsters.indexOf(m); if (i >= 0) game.monsters.splice(i, 1);
    m._phaseSprite = 'gravitos3'; m._gravitosPhase = 3; m.phase = 3; m.vy = 0; m.patternState = 'idle';
    const S = { idle: [() => BOSS_IDLE_FRAMES.gravitos3, null, 0], walk: [() => BOSS_WALK_FRAMES.gravitos3, null, 1], attack: [() => BOSS_ATTACK_FRAMES.gravitos3, null, 2], laser: [() => BOSS_ATTACK_FRAMES.gravitos3laser, 'gravitos3laser', 2],
      punch: [() => BOSS_ATTACK_FRAMES.gravitos3punch, 'gravitos3punch', 2], soul: [() => BOSS_ATTACK_FRAMES.gravitos3soul, 'gravitos3soul', 2], star: [() => BOSS_ATTACK_FRAMES.gravitos3star, 'gravitos3star', 2] };
    const ok = (im) => im && ((im.complete && im.naturalWidth > 0) || im.tagName === 'CANVAS'), t0 = performance.now();
    while (performance.now() - t0 < 150000 && !Object.values(S).every(([f]) => f() && f().length >= 9 && f().every(ok))) { try { _lxBossArtWant('gravitos', true); _lxBossArtWant('gravitos3', true); } catch (e) {} await W8(200); }
    const cv = document.querySelector('canvas'), c2 = cv.getContext('2d'), res = {};
    for (const [name, [f, key, mode]] of Object.entries(S)) { const set = f(); if (!set) continue; set._lxStandInOff = true;
      for (let k = 0; k < set.length; k++) for (const face of [1, -1]) {
        m.facing = face; m._gravStarKey = key; m._lxCalE = null; m.vx = mode === 1 ? 1.7 * face : 0; m._frameIsAttack = mode === 2; m.patternState = mode === 2 ? 'attack' : 'idle'; m.atkAnimUntil = null;
        const sx = Math.round(cv.width / 2 - m.w / 2), sy = Math.round(cv.height - 150 - m.h);
        c2.save(); c2.setTransform(1, 0, 0, 1, 0, 0); _drawBossSprite(set[k], m, sx, sy, mode === 2, true); c2.restore();
        const b = _atkMonBox(m), fx = m.x + m.w / 2, fy = m.y + m.h;
        res[name + '_' + k + (face > 0 ? 'R' : 'L')] = b && b !== m ? [b.x - fx, b.x + b.w - fx, b.y - fy, b.y + b.h - fy].map((v) => +v.toFixed(2)) : null; } }
    return res; });
  await ctx.close(); return out; };
try {
  const A = await grab(true), B = await grab(false), off = []; let worst = 0, n = 0;
  for (const k of Object.keys(B)) { const a = A[k], b = B[k]; if (!a || !b) { off.push(k + ' missing'); continue; } n++; const d = Math.max(...a.map((v, i) => Math.abs(v - b[i]))); worst = Math.max(worst, d); if (d > 1) off.push(`${k} ${JSON.stringify(a)} vs ${JSON.stringify(b)}`); }
  console.log(`INFO  reach: ${n} frame x facing rows, worst ${worst.toFixed(2)} px`);
  check(n === 138 && !off.length, 'REACH: every form-3 frame at both facings keeps origin\'s player-attack box in world space (<= 1 px; the supernova box rescaled with its size)', { n, worst, off: off.slice(0, 6) });
} finally { await browser.close(); srv.kill(); }
check(!errs.length, 'no page errors', errs.slice(0, 4));
// ---- SUITES (a load-flaky row must fail in every run to count: up to 3 runs, as boss_feet_calib_test)
const passed = (out) => { const lines = out.trim().split(/\r?\n/), last = lines.slice(-3).join(' | ');
  return { ok: /(^|\s)all \d+ passed/.test(last) || /(^|\s)(\d+)\/\2 (checks )?passed/.test(last), fails: lines.filter((l) => /^FAIL/.test(l.trim())), last: lines[lines.length - 1] || '' }; };
const runSuite = (file, env) => { const r = spawnSync(process.execPath, [file], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(PORT + 2), MOJI_REPO: REPO, SERVE_ROOT: ROOT, MOJI_SERVE_ROOT: ROOT }, env || {}), encoding: 'utf8', timeout: 1800000, maxBuffer: 1 << 26 });
  return passed(String(r.stdout || '') + String(r.stderr || '')); };
const rowKey = (l) => l.trim().replace(/^FAIL\s+/, '').split(/\s{2,}/)[0];
// grav_star_fit_test serves Gravitos's art + data tables from origin/main by design; run it on THIS tree's art + tables (a local copy)
let STAR = null; { const src = existsSync(path.join(HERE, 'grav_star_fit_test.mjs')) ? readFileSync(path.join(HERE, 'grav_star_fit_test.mjs'), 'utf8') : String(show('scripts/grav_star_fit_test.mjs', 'origin/main') || '');
  const A = "cache.set(rel, execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 26 }))";
  if (src.split(A).length === 2) { STAR = path.join(HERE, '_g3hq_star_fit_' + process.pid + '.mjs'); writeFileSync(STAR, src.split(A).join("cache.set(rel, require('node:fs').readFileSync(path.join(ROOT, rel)))").replace("import { existsSync } from 'node:fs';", "import { existsSync } from 'node:fs'; import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);")); } }
for (const [name, file] of [['gravitos3_anim_test.mjs', path.join(HERE, 'gravitos3_anim_test.mjs')], ['gravitos_feet_plant_test.mjs', path.join(HERE, 'gravitos_feet_plant_test.mjs')], ['boss_anim_integrity_test.mjs', path.join(HERE, 'boss_anim_integrity_test.mjs')], ['grav_star_fit_test.mjs (this tree\'s art + tables)', STAR]]) {
  if (!file || !existsSync(file)) { check(false, `${name} still passes`, 'suite not found (grav_star_fit_test: its origin route anchor moved)'); continue; }
  let res = null, every = null, runs = 0;
  for (let a = 0; a < 3; a++) { runs++; res = runSuite(file); if (res.ok) break; if (!res.fails.length) continue; const keys = new Set(res.fails.map(rowKey)); every = every ? new Set([...every].filter((k) => keys.has(k))) : keys; if (!every.size) break; }
  const left = res.ok ? [] : every === null ? ['(no run reported: ' + res.last.slice(0, 80) + ')'] : [...every];
  check(res.ok || !left.length, `${name} still passes (${res.last}${runs > 1 ? ', run ' + runs : ''})`, left.map((k) => k.slice(0, 240)));
}
if (STAR) try { unlinkSync(STAR); } catch (e) {}
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
