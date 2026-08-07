// MOJIMON PLANT PARITY â€” does a summoned companion stand at the same Y as the
// same species does in the wild / the monster database?
// =============================================================================
// Measures where the sprite's FEET actually land by intercepting ctx.drawImage
// and reading the live transform, so it compares what is drawn on screen rather
// than re-deriving either formula. Same species, same x/y/w/h, one entity on
// screen at a time so attribution is unambiguous.
//   deltaFoot > 0  => companion's feet sit BELOW the wild one's (sunk)
//   deltaFoot < 0  => companion floats above the floor line
// Run: node scripts/mojimon_plant_test.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9024;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(11000);

const RES = await page.evaluate(async () => {
  for (const id of ['class-select-modal','advancement-modal','tutorial-modal','loading-overlay',
                    'story-beat-overlay','boss-intro-overlay','dialog']) {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  }
  loadMap('forest'); game.paused = false;
  const ctx = canvas.getContext('2d');

  // Record the world-space bottom/top edge of every sprite blit in a draw call.
  const capture = (fn) => {
    const orig = ctx.drawImage;
    const seen = [];
    ctx.drawImage = function (img, ...a) {
      try {
        // only the 9/5-arg forms carry an explicit destination rect
        let dx, dy, dw, dh;
        if (a.length >= 8) { dx = a[4]; dy = a[5]; dw = a[6]; dh = a[7]; }
        else if (a.length >= 4) { dx = a[0]; dy = a[1]; dw = a[2]; dh = a[3]; }
        if (dy != null) {
          const m = this.getTransform();
          // transform the rect's bottom-centre and top-centre into screen space
          const bx = dx + dw / 2, by = dy + dh, ty = dy;
          seen.push({
            foot: m.b * bx + m.d * by + m.f,
            head: m.b * bx + m.d * ty + m.f,
            h: Math.abs(m.d) * dh, w: Math.abs(m.a) * dw,
          });
        }
      } catch (e) {}
      return orig.apply(this, [img, ...a]);
    };
    try { fn(); } finally { ctx.drawImage = orig; }
    // the creature is the tallest blit (HP bars/pips are fillRect, not images)
    seen.sort((p, q) => q.h - p.h);
    return seen[0] || null;
  };

  // â”€â”€ EXTRACTION FIDELITY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // The wild ladder was moved into _lxMobPlantDy. Screen measurement cannot
  // prove that move was faithful: which animation frame is decoded at capture
  // time varies run to run (measured: 76/110 wild feet differ between two runs
  // of the SAME build). So compare the helper against the ORIGINAL ladder as a
  // pure function instead â€” deterministic, and it covers every type at once.
  const oldLadder = (type, isFloating, srcH, targetH) => {
    const meta = MONSTER_SPRITE_META[type];
    const bboxBottomY = (meta && meta.bboxBottomY != null) ? meta.bboxBottomY : Math.floor(srcH * 0.92);
    let dy = -((bboxBottomY + 1) / srcH) * targetH;
    if (isFloating) dy -= targetH * FLOATING_GROUND_BLEED;
    else dy += targetH * GROUND_BURY_FRAC;
    if (!isFloating && _MOB_SPRITE_FOOT_NUDGE[type]) dy += targetH * _MOB_SPRITE_FOOT_NUDGE[type];
    if (!isFloating && (type === 'boneGolem' || type === 'seastar')) dy += 5;
    if (!isFloating && type === 'seastar') dy += 5;
    if (!isFloating && type === 'boneGolem') dy += 5;
    if (!isFloating) {
      const _BURY_MAX_PX = 6;
      if (dy + targetH > _BURY_MAX_PX) dy = _BURY_MAX_PX - targetH;
    }
    if (!isFloating && type === 'boneGolem') dy += 10;
    if (!isFloating && type === 'grumpsquid') dy += 4;
    if (!isFloating && type === 'echoKnight') dy += 7;
    if (!isFloating && type === 'future_lyra') dy += 9;
    if (!isFloating && type === 'seastar') dy += 6;
    dy += _lxMobYOff(type);
    return dy;
  };
  let fidelityFails = 0, fidelityWorst = '';
  const allTypes = Object.keys(monsterTypes);
  for (const type of allTypes) {
    for (const srcH of [256, 512, 768, 1024]) {
      for (const targetH of [40, 96, 150, 300, 554]) {
        for (const fl of [false, true]) {
          const a = oldLadder(type, fl, srcH, targetH);
          const b = _lxMobPlantDy(type, fl, srcH, targetH);
          if (Math.abs(a - b) > 1e-9) {
            fidelityFails++;
            if (!fidelityWorst) fidelityWorst = `${type} src${srcH} tgt${targetH} float=${fl}: ${a} vs ${b}`;
          }
        }
      }
    }
  }
  const fidelityCases = allTypes.length * 4 * 5 * 2;

  const X = 600, Y = 300;
  const types = Object.keys(monsterTypes).filter(t => {
    const mt = monsterTypes[t];
    return mt && !mt.boss && !mt.isBoss && (mt.w | 0) > 0 && (mt.h | 0) > 0;
  });

  const rows = [];
  for (const type of types) {
    // ---- wild: the monster-database draw -------------------------------
    game.monsters.length = 0; game.minions = [];
    const m = spawnMonster(X, Y, type, false);
    if (!m) continue;
    m.x = X; m.y = Y; m.vx = 0; m.vy = 0; m.facing = 1;
    m.freezeTimer = 0; m.stunTimer = 0; m.spawn = 0; m.invulnerable = 0;
    // let the sprite decode
    for (let k = 0; k < 25; k++) {
      const s = (typeof MONSTER_SPRITES !== 'undefined') ? MONSTER_SPRITES[type] : null;
      if (s && s.complete && s.naturalWidth > 0) break;
      await new Promise(r => setTimeout(r, 40));
    }
    const wild = capture(() => { try { drawMonster(m); } catch (e) {} });

    // ---- companion: same species, same box ------------------------------
    game.monsters.length = 0;
    game.minions = [{
      x: X, y: Y, w: m.w, h: m.h, type, mojimon: true,
      life: 1e12, maxLife: 1e12, vx: 0, vy: 0, facing: 1,
      atk: 10, cd: 0, maxHp: 100, currentHp: 100, dmgCD: 0, spawn: 0, defRed: 0,
      // cancel the cosmetic idle bob (+/-1.5px sine) so this measures the PLANT
      // rather than which phase of the bob the sample happened to catch
      _bobSeed: -game.time,
    }];
    const comp = capture(() => { try { drawMinions(); } catch (e) {} });

    game.minions = [];
    if (!wild || !comp) continue;
    rows.push({
      type,
      yoff: (typeof _lxMobYOff === 'function') ? _lxMobYOff(type) : 0,
      scale: (typeof _lxMobScale === 'function') ? +(_lxMobScale(type)).toFixed(3) : 1,
      wildFoot: +wild.foot.toFixed(1), compFoot: +comp.foot.toFixed(1),
      deltaFoot: +(comp.foot - wild.foot).toFixed(1),
      wildH: +wild.h.toFixed(1), compH: +comp.h.toFixed(1),
      hRatio: +(comp.h / wild.h).toFixed(2),
    });
  }
  return { rows, fidelityFails, fidelityCases, fidelityWorst };
});

const OUT = RES.rows;
writeFileSync(path.join(ROOT, 'scripts', 'mojimon_plant.json'), JSON.stringify(OUT, null, 1));
const fidelityOK = RES.fidelityFails === 0;
console.log(fidelityOK
  ? `  PASS  extraction fidelity: _lxMobPlantDy == the original ladder across ${RES.fidelityCases} cases`
  : `  FAIL  extraction fidelity: ${RES.fidelityFails}/${RES.fidelityCases} mismatch â€” ${RES.fidelityWorst}`);
const bad = OUT.filter(r => Math.abs(r.deltaFoot) > 1.5);
console.log(`measured ${OUT.length} species; ${bad.length} plant the companion's feet >1.5px off the wild draw\n`);
console.log('type                 yoff  scale   wildFoot  compFoot   dFoot   wildH  compH  hRatio');
for (const r of [...OUT].sort((a, b) => Math.abs(b.deltaFoot) - Math.abs(a.deltaFoot)).slice(0, 22)) {
  console.log(`${r.type.padEnd(20)} ${String(r.yoff).padStart(4)}  ${String(r.scale).padStart(5)}   ` +
    `${String(r.wildFoot).padStart(8)}  ${String(r.compFoot).padStart(8)}  ${String(r.deltaFoot).padStart(6)}   ` +
    `${String(r.wildH).padStart(5)}  ${String(r.compH).padStart(5)}   ${r.hRatio}`);
}
const dFeet = OUT.map(r => Math.abs(r.deltaFoot));
if (dFeet.length) console.log(`\nfoot delta: max ${Math.max(...dFeet).toFixed(1)}px, mean ${(dFeet.reduce((s,v)=>s+v,0)/dFeet.length).toFixed(1)}px`);
console.log('pageerrors:', errs.length, errs.slice(0, 3));
await browser.close(); server.kill();
process.exit((bad.length || !fidelityOK || errs.length) ? 1 : 0);
