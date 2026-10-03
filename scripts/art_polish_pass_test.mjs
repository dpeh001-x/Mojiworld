// Final art polish pass (per user: "ship and do final polishes to the game's art"). Pins the five fixes:
//   1. lettered mechs read the right way round: a left-facing Ticket Mech / Express mech draws its sprite un-mirrored
//      ("TICKET", "GO", not "TEKCIT", "OG"); in an attack frame it still mirrors (the ticket leaves from the facing side);
//      an unlettered mob still mirrors when it faces left
//   2. the margin outside a narrow world darkens over a feather: over a flat grey screen, no column steps by more than
//      12 levels (the old hard 0.55 edge + ice glow stepped ~80 in one column), and past the feather the margin keeps the old 0.55 tint
//   3. the Bastion Rampart lion's visible top clears the walkway above it (y:280, 14 thick)
//   4. Legosaurus's den paints one backdrop copy (bgNoMirror), no mirrored seam
//   5. an Express mech is named "Express Ticket Mech", never "Express Express Ticket Mech"
//   [MOJI_SERVE_ROOT / PORT] node scripts/art_polish_pass_test.mjs      (serves mojiworld_game.html)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10041); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof drawTowerSideWalls === 'function', null, { timeout: 180000 }); await page.waitForTimeout(4000);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._god = true;
    const out = { ver: GAME_VERSION };
    // 5 + 1: the Express map spawns both mech types through the real spawn path
    loadMap('clockworkExpress', 300); await sleep(2500); game._mapFadeTimer = 0;
    const gy = Math.min(...game.mapData.platforms.filter((p) => p.type === 'ground').map((p) => p.y));
    const mk = (type) => { spawnMonster(400, gy - 80, type); const m = game.monsters[game.monsters.length - 1]; return m && m.type === type ? m : null; };
    const tm = mk('ticketMech'), xm = mk('expressTicketMech');
    out.names = [tm && tm.name, xm && xm.name];
    // the sprite's drawn x-scale sign, read off the transform at the drawImage of the mob's own art
    const orig = window._monsterStateFrame; let force = null;
    window._monsterStateFrame = function (m) { const r = orig.apply(this, arguments); if (force != null) m._frameIsAttack = force; return r; };
    const cv = document.getElementById('game'), c2 = cv.getContext('2d'), dI = c2.drawImage;
    const signOf = async (m, facing, atk) => {
      // wait for the mob's art to decode: a mob with no decoded sprite draws its vector fallback
      for (let i = 0; i < 40; i++) { const im = m && typeof _monsterStateFrame === 'function' ? orig(m) : null; if (im && im.naturalWidth) break; await sleep(100); }
      let sgn = null; force = atk; m.facing = facing;
      c2.drawImage = function (img) { const src = String((img && (img.currentSrc || img.src || img._lxSrc)) || ''); if (sgn == null && (img === m._lxLastImg || src.indexOf(m.type) >= 0 || (img && img._lxBaseSrc && String(img._lxBaseSrc).indexOf(m.type) >= 0))) sgn = Math.sign(c2.getTransform().a); return dI.apply(this, arguments); };
      try { c2.save(); drawMonster(m); c2.restore(); } finally { c2.drawImage = dI; force = null; }
      if (sgn == null) { // tinted / baked copies carry no src: fall back to the transform at the first draw inside the call
        c2.drawImage = function () { if (sgn == null) sgn = Math.sign(c2.getTransform().a); return dI.apply(this, arguments); }; force = atk; m.facing = facing;
        try { c2.save(); drawMonster(m); c2.restore(); } finally { c2.drawImage = dI; force = null; }
      }
      return sgn;
    };
    const ctl = mk('conductorMech');
    out.flip = {};
    for (const [k, m] of [['ticketMech', tm], ['expressTicketMech', xm], ['conductorMech', ctl]]) {
      if (!m) { out.flip[k] = null; continue; }
      out.flip[k] = { leftWalk: await signOf(m, -1, false), leftAtk: await signOf(m, -1, true), right: await signOf(m, 1, false) };
    }
    window._monsterStateFrame = orig;
    // 2: the side walls over a flat grey screen on Frozen Peak (800 wide in a wider view)
    loadMap('frozenPeak', 300); await sleep(2500); game._mapFadeTimer = 0; game.monsters.length = 0;
    const k = cv.width / W; c2.save(); c2.setTransform(k, 0, 0, k, 0, 0); c2.fillStyle = 'rgb(128,128,128)'; c2.fillRect(0, 0, W, H); drawTowerSideWalls(); c2.restore();
    const row = c2.getImageData(0, Math.round(cv.height / 2), cv.width, 1).data; let maxStep = 0, at = -1; const lum = [];
    for (let x = 0; x < cv.width; x++) lum.push((row[x * 4] + row[x * 4 + 1] + row[x * 4 + 2]) / 3);
    for (let x = 1; x < lum.length; x++) { const d = Math.abs(lum[x] - lum[x - 1]); if (d > maxStep) { maxStep = d; at = x; } }
    const leftSx = Math.max(0, -game.camera.x) * k;
    out.walls = { maxStep: +maxStep.toFixed(1), at, leftSx: Math.round(leftSx), far: leftSx > 60 * k ? Math.round(lum[2]) : null, inside: Math.round(lum[Math.round(leftSx + 30 * k)]) };
    // 3: the Rampart lion's visible top vs the walkway it stands under
    loadMap('bastionRampart', 300); await sleep(2500);
    const pr = (MAP_PROPS.bastionRampart || []).find((q) => q.key === 'bastion_lion_statue' && q.x === 1039);
    for (let i = 0; i < 40 && !(LX_OBJECTS[pr.key] && LX_OBJECTS[pr.key].naturalWidth && LX_OBJECTS_META[pr.key]); i++) await sleep(100);
    const im = LX_OBJECTS[pr.key], meta = LX_OBJECTS_META[pr.key] || {};
    const f = Math.max(0.7, Math.min(1.4, Math.max(im.naturalWidth, im.naturalHeight) / 512)), h = PROP_DEFAULT_H * (pr.scale || 1) * f;
    const top = pr.y - h * ((meta.bboxBottomY + 1) - meta.bboxTopY) / im.naturalHeight;
    const walk = game.mapData.platforms.find((p) => p.y < pr.y && p.x <= pr.x && p.x + p.w >= pr.x);
    out.lion = { top: Math.round(top), walkBottom: walk ? walk.y + (walk.h || 14) : null, scale: pr.scale };
    // 4
    out.apexNoMirror = !!(MAPS.blockland_apex && MAPS.blockland_apex.bgNoMirror);
    return out;
  });
  console.log('build', R.ver, JSON.stringify(R.flip), JSON.stringify(R.walls), JSON.stringify(R.lion), JSON.stringify(R.names));
  for (const t of ['ticketMech', 'expressTicketMech']) {
    const f = R.flip[t];
    ok(`1. ${t} facing left is drawn un-mirrored`, !!f && f.leftWalk === 1, JSON.stringify(f));
    ok(`1. ${t} still mirrors in an attack frame`, !!f && f.leftAtk === -1, JSON.stringify(f));
    ok(`1. ${t} facing right is drawn as authored`, !!f && f.right === 1, JSON.stringify(f));
  }
  ok('1. an unlettered mob (Conductor Mech) still mirrors facing left', !!R.flip.conductorMech && R.flip.conductorMech.leftWalk === -1, JSON.stringify(R.flip.conductorMech));
  ok('2. no column steps by more than 12 levels at the narrow world edge', R.walls.maxStep <= 12, JSON.stringify(R.walls));
  ok('2. the far margin is still dark (<= 80 over grey 128: the old 0.55 tint) and the world untouched', R.walls.far != null && R.walls.far <= 80 && R.walls.inside === 128, JSON.stringify(R.walls));
  ok('3. the Rampart lion clears the walkway above it', R.lion.walkBottom != null && R.lion.top >= R.lion.walkBottom, JSON.stringify(R.lion));
  ok("4. Legosaurus's den paints one backdrop copy", R.apexNoMirror === true);
  ok('5. Express mechs are named "Express Ticket Mech"', R.names.length === 2 && R.names.every((n) => n === 'Express Ticket Mech'), JSON.stringify(R.names));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL  the harness runs to the end  ' + JSON.stringify(String(e.message).slice(0, 300))); }
finally { await browser.close(); server.kill(); }
console.log(fail ? `FAIL(${fail}) - ${pass} passed, ${fail} failed` : `PASS(0) - ${pass} passed, 0 failed`);
process.exit(fail ? 1 : 0);
