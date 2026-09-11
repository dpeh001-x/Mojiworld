// Photograph the boss bar as the game draws it, so a regenerated frame can be judged at real
// size instead of at 1024px in an image viewer. Boots the game, builds a super boss the way
// boss_bar_test.mjs does (already acquired, 60% HP, phase 2 so the tint and pips show), calls the
// real drawSuperBossBar over a dark arena plate, and saves the top band of the canvas.
//
//   node scripts/boss_bar_capture.mjs <out.png>      MOJI_SERVE_ROOT / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync, writeFileSync } = require('node:fs');
const OUT = process.argv[2] || path.join(ROOT, 'scripts', '_tmp_bossbar', 'capture.png');
const PORT = Number(process.env.PORT || 11481); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof drawSuperBossBar === 'function' && typeof monsterTypes === 'object', null, { timeout: 180000 });
  await page.waitForFunction(() => typeof LX_FX !== 'undefined' && LX_FX.ui_bossbar_frame && LX_FX.ui_bossbar_frame.complete && LX_FX.ui_bossbar_frame.naturalWidth > 0
    && LX_FX.ui_bossbar_fill && LX_FX.ui_bossbar_fill.complete && LX_FX.ui_bossbar_fill.naturalWidth > 0, null, { timeout: 60000 }).catch(() => {});
  await page.waitForFunction(() => window._lxBossFontReady === true, null, { timeout: 20000 }).catch(() => {});
  await page.evaluate(([hp, ph]) => { window.__bbHp = hp; window.__bbPhase = ph; }, [Number(process.env.BOSSBAR_HP || 0.62), Number(process.env.BOSSBAR_PHASE || 2)]);
  const r = await page.evaluate(() => {
    game.paused = true;
    for (const id of ['class-select-modal', 'loading-overlay']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.x = 800; player.y = 400;
    const t = monsterTypes.gravitos || monsterTypes.aetherion || {};
    const HP = Number(window.__bbHp) || 0.62, PH = Number(window.__bbPhase) || 2;   // BOSSBAR_HP / BOSSBAR_PHASE env
    const mon = { type: 'gravitos', name: t.name || 'Gravitos', w: t.w || 90, h: t.h || 90, x: 900, y: 400, currentHp: Math.floor((t.hp || 21000000) * HP), maxHp: t.hp || 21000000,
      isBoss: true, boss: true, superBoss: true, hyperBoss: false, level: t.level || 60, traits: t.traits, _bbSeen: 0, phase: PH };
    game.monsters.length = 0; game._superBossRef = null; game.monsters.push(mon);
    const cv = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
    const c = cv.getContext('2d');
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#1a1030'; c.fillRect(0, 0, cv.width, cv.height);
    const g = c.createLinearGradient(0, 0, cv.width, 0); g.addColorStop(0, '#2a1a4a'); g.addColorStop(0.5, '#3b2560'); g.addColorStop(1, '#22143d'); c.fillStyle = g; c.fillRect(0, 0, cv.width, 160); c.restore();
    let threw = null; try { drawSuperBossBar(); } catch (e) { threw = String(e.message || e); }
    const frame = LX_FX.ui_bossbar_frame;
    // Read the bar's placement back the way drawSuperBossBar computes it, and walk the middle row
    // for where the fill's pink actually starts and ends - so "there is a cutoff at the edge" can be
    // answered with columns instead of guesses.
    const uiK = (game._uiScale > 0) ? game._uiScale : 1, W = cv.width, barW = Math.min(660 * uiK, W - 120), barH = Math.round(22 * uiK), bx = Math.round((W - barW) / 2), by = 34;
    const mid = c.getImageData(0, by + (barH >> 1), W, 1).data; const isPink = (x) => { const i = x * 4; return mid[i] > 180 && mid[i + 1] < 170 && mid[i + 2] > 90; };
    let p0 = -1, p1 = -1; for (let x = 0; x < W; x++) if (isPink(x)) { if (p0 < 0) p0 = x; p1 = x; }
    return { url: cv.toDataURL('image/png'), w: cv.width, h: cv.height, threw, frameNat: frame.naturalWidth + 'x' + frame.naturalHeight, geom: (typeof _BB_GEOM === 'object') ? _BB_GEOM : null,
      place: { uiK, bx, by, barW, barH, midRow: by + (barH >> 1), pinkFrom: p0, pinkTo: p1, hp: HP } };
  });
  console.log('placement', JSON.stringify(r.place));
  const sharp = require('sharp'); const buf = Buffer.from(r.url.split(',')[1], 'base64');
  const band = await sharp(buf).extract({ left: 0, top: 0, width: r.w, height: Math.min(r.h, 130) }).png().toBuffer();
  writeFileSync(OUT, band);
  console.log(`canvas ${r.w}x${r.h}  frame ${r.frameNat}  geom ${JSON.stringify(r.geom)}  threw ${r.threw || 'no'}  errors ${errs.length}\nwrote ${OUT}`);
  if (r.threw || errs.length) { console.log(errs.join('\n')); process.exitCode = 1; }
} finally { await browser.close(); server.kill(); }
