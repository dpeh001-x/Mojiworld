// Live test: CRITICAL DAMAGE NUMBERS END IN A STAR; NOTHING ELSE DOES.
//
// Per user: "For critical attack damage put a star at the back of the damage
// dealt so that players know it is a critical damage".
//   - a crit hit's floating number is drawn as "<damage>\u2605" through the
//     REAL drawDamageNumbers (spied fillText / strokeText), on every layer
//   - a non-crit hit's number carries no star
//   - damage the player TAKES carries no star (never flagged crit)
//   - the star glyph actually rasterises in the damage font (not a blank)
//   - the settled-number bake text (d._txt) carries the star, so the bitmap
//     path shows it too
//   node scripts/crit_star_test.mjs
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const free = (p) => new Promise((res) => { const s = net.createServer(); s.once('error', () => res(false)); s.once('listening', () => s.close(() => res(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2]; for (let p = 8961; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof hitMonster === 'function' && typeof drawDamageNumbers === 'function' && typeof spawnMonster === 'function', null, { timeout: 120000 });
await page.evaluate(() => new Promise((res) => { let n = 0; const t = () => { window._lxBootGateDone = true;
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  const c = document.querySelector('.cls-card'); if (c) c.click();
  const m = document.getElementById('class-select-modal'); if (m) m.style.display = 'none';
  if (++n > 150) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
await page.waitForTimeout(1200);

const g = await page.evaluate(async () => {
  const out = {}; const STAR = '\u2605';
  const frames = (n) => new Promise((res) => { let i = 0; const t = () => { game.paused = false; if (++i > n) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  try { loadMap('forest'); } catch (e) {} await frames(40);
  player.hp = 99999; player._god = true;
  game.monsters = []; spawnMonster(Math.round(player.x + 80), Math.round(player.y), 'slime', false);
  const m = game.monsters[game.monsters.length - 1]; m.hp = m.currentHp = 1e9; m.maxHp = 1e9;
  // drawn strings for one drawDamageNumbers pass
  const spy = () => { const drawn = []; const ft = CanvasRenderingContext2D.prototype.fillText, st = CanvasRenderingContext2D.prototype.strokeText;
    CanvasRenderingContext2D.prototype.fillText = function (t, ...r) { drawn.push(String(t)); return ft.call(this, t, ...r); };
    CanvasRenderingContext2D.prototype.strokeText = function (t, ...r) { drawn.push(String(t)); return st.call(this, t, ...r); };
    return { drawn, off: () => { CanvasRenderingContext2D.prototype.fillText = ft; CanvasRenderingContext2D.prototype.strokeText = st; } }; };
  // 1) crit
  game.damageNumbers = [];
  hitMonster(m, 1234, true, 'melee');
  const critEntry = game.damageNumbers[game.damageNumbers.length - 1];
  out.critFlag = !!(critEntry && critEntry.crit);
  let s = spy(); try { drawDamageNumbers(); } catch (e) { out.drawErr = String(e).slice(0, 120); } s.off();
  out.critDrawn = s.drawn.filter((t) => t.endsWith(STAR));
  out.critNumberOnly = s.drawn.filter((t) => /^[\d,]+$/.test(t));
  out.critTxt = critEntry && critEntry._txt;
  // 2) non-crit
  game.damageNumbers = [];
  hitMonster(m, 1234, false, 'melee');
  s = spy(); try { drawDamageNumbers(); } catch (e) {} s.off();
  out.nonCritStar = s.drawn.filter((t) => t.includes(STAR)).length;
  out.nonCritDrawn = s.drawn.length;
  // 3) damage the player takes
  game.damageNumbers = [];
  game.damageNumbers.push({ x: player.x + 14, y: player.y, vy: -2, text: '-' + 321, life: 40, color: '#ff5555', big: true });
  s = spy(); try { drawDamageNumbers(); } catch (e) {} s.off();
  out.takenStar = s.drawn.filter((t) => t.includes(STAR)).length;
  // 4) the star glyph rasterises in the damage font
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; const cx = cv.getContext('2d');
  cx.font = '900 32px Impact, "Arial Black", "Trebuchet MS", sans-serif'; cx.fillStyle = '#fff'; cx.fillText(STAR, 8, 44);
  const px = cx.getImageData(0, 0, 64, 64).data; let lit = 0; for (let i = 3; i < px.length; i += 4) if (px[i] > 40) lit++;
  out.starPixels = lit; out.starWidth = cx.measureText(STAR).width;
  game.damageNumbers = []; game.monsters = [];
  return out;
});

ok('a crit hit flags its damage number crit:true', g.critFlag === true, { flag: g.critFlag });
ok('drawDamageNumbers draws the crit as "<damage>\u2605" on every layer (shadow, outline, foil, fill)',
  !g.drawErr && g.critDrawn.length >= 3 && g.critNumberOnly.length === 0, { drawn: g.critDrawn.slice(0, 5), bare: g.critNumberOnly.slice(0, 3), err: g.drawErr });
ok('the cached text (what the settled-number bake uses) carries the star', typeof g.critTxt === 'string' && g.critTxt.endsWith('\u2605'), { txt: g.critTxt });
ok('a non-crit hit draws its number with NO star', g.nonCritDrawn > 0 && g.nonCritStar === 0, { drawn: g.nonCritDrawn, starred: g.nonCritStar });
ok('damage the player takes draws with NO star', g.takenStar === 0, { starred: g.takenStar });
ok('the star glyph rasterises in the damage font (not a blank)', g.starPixels > 60 && g.starWidth > 8, { pixels: g.starPixels, width: g.starWidth });
ok('no page errors', errs.length === 0, { errs: errs.slice(0, 3) });

await b.close(); srv.kill();
let pass = 0;
for (const t of results) { console.log((t.pass ? '  PASS  ' : '  FAIL  ') + t.n); if (!t.pass) console.log('        ' + JSON.stringify(t.x).slice(0, 320)); if (t.pass) pass++; }
console.log('\n' + pass + '/' + results.length + ' checks passed');
process.exit(pass === results.length ? 0 : 1);
