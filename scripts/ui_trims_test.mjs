// Four UI trims (v0.30.402): the projectile tell at 40% (the windup tell keeps full),
// no red cross on the quake band or the meteor marker, no suffix after a damage
// number (no !, !!, star, WEAK, RESIST; no floating tags), no glow ellipse under chests.
//   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10131); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof hitMonster === 'function' && typeof drawChests === 'function' && typeof drawHazards === 'function' && typeof spawnChest === 'function', null, { timeout: 180000 }); await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const o = { ver: GAME_VERSION }; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { loadMap('forest', 300); } catch (e) {} await sleep(300); game.paused = true; player.level = 30; player.hp = player.maxHp || 1000; player.cls = 'warrior';
    // 1. the numbers: digits only, colour and size still carry the hierarchy
    spawnMonster(player.x + 140, player.y, 'snail', false); const m = game.monsters.filter((x) => x && x.type === 'snail').pop(); m.maxHp = 1000000; m.currentHp = m.maxHp; m.evasion = 0; m.invulnerable = 0; m._wardUntil = 0;
    const hit = (skill, crit) => { m.invulnerable = 0; m._lastHitAt = 0; game.time += 120; game.comboMult = 1; game.combo = 0; game.damageNumbers.length = 0; try { hitMonster(m, 1000, !!crit, skill); } catch (e) { return [{ err: String(e && e.message) }]; } m.currentHp = m.maxHp; return game.damageNumbers.map((d) => ({ t: String(d.text), c: d.color, s: d.size, crit: !!d.crit })); };
    o.weakCrit = hit('magic', true); o.resist = hit('melee', false); o.plainCrit = hit('thorns', true);
    // 2. the chest: no glow ellipse under it
    game.chests.length = 0; spawnChest(player.x + 80, 480, 'gold'); const c = game.chests[game.chests.length - 1]; if (c) { c.opened = false; }
    game.camera.x = Math.max(0, player.x - 200);
    const capFills = (fn) => { const out = []; const P = CanvasRenderingContext2D.prototype; const oE = P.ellipse, oF = P.fill; let lastEllipse = false; P.ellipse = function (...a) { lastEllipse = true; return oE.apply(this, a); }; P.fill = function (...a) { if (lastEllipse) out.push(String(this.fillStyle)); lastEllipse = false; return oF.apply(this, a); }; try { fn(); } catch (e) { out.push('err:' + (e && e.message)); } finally { P.ellipse = oE; P.fill = oF; } return out; };
    o.chestFills = capFills(() => drawChests()); game.chests.length = 0;
    // 3. the tells: projectile at <= 40%, windup at full, no red cross on hazards
    const capStrokes = (fn) => { const out = { strokes: [], texts: [] }; const P = CanvasRenderingContext2D.prototype; const oS = P.stroke, oT = P.fillText; P.stroke = function (...a) { out.strokes.push({ st: String(this.strokeStyle), a: +this.globalAlpha.toFixed(3) }); return oS.apply(this, a); }; P.fillText = function (t, ...a) { out.texts.push(String(t)); return oT.apply(this, [t, ...a]); }; try { fn(); } catch (e) { out.err = String(e && e.message); } finally { P.stroke = oS; P.fillText = oT; } return out; };
    game.projectiles.length = 0; game.projectiles.push({ x: player.x + 120, y: player.y, w: 8, h: 8, vx: 0, vy: 0, owner: 'enemy', damage: 10, skill: 'bolt', life: 100 }); const pj = capStrokes(() => drawProjectiles()); game.projectiles.length = 0;
    o.projTell = pj.strokes.filter((s) => s.st === '#ffd166').map((s) => s.a); o.projA = pj.texts.includes('A');
    m._tellUntil = _lxFrameNow() + 800; const mw = capStrokes(() => drawMonster(m)); m._tellUntil = 0; o.mobTell = mw.strokes.filter((s) => s.st === '#ffd166').map((s) => s.a);
    const cx = player.x + 200; game.hazards.length = 0;
    game.hazards.push({ type: 'meteor_warn', x: cx, cx, y: 440, radius: 90, life: 40, maxLife: 60, timer: 40, owner: 'enemy', damage: 10 }); const hm = capStrokes(() => drawHazards()); game.hazards.length = 0;
    game.hazards.push({ type: 'mob_quake', x: cx - 60, cx, y: 460, w: 120, h: 30, life: 30, maxLife: 60 }); const hq = capStrokes(() => drawHazards()); game.hazards.length = 0;
    o.red = { meteor: hm.strokes.some((s) => s.st === '#ff4d4d') || hm.texts.includes('\u2715'), quake: hq.strokes.some((s) => s.st === '#ff4d4d') || hq.texts.includes('\u2715'), err: hm.err || hq.err };
    // 4. the shipped source
    const src = await (await fetch(location.pathname)).text();
    o.src = { suffix: src.indexOf("const _suffix = '';") >= 0 && src.indexOf("_suffix = '!!'") < 0 && src.indexOf("_suffix += ' WEAK'") < 0, tags: src.indexOf("text: 'WEAK', life: 26") < 0 && src.indexOf("text: 'RESIST', life: 26") < 0, aura: src.indexOf('Ambient glow aura') < 0, move: src.indexOf("'move', t)") < 0 && src.indexOf("'move', prog)") < 0, faint: src.indexOf("'parry', null, 0.4)") >= 0 };
    return o;
  });
  const digits = (arr) => arr.length >= 1 && arr.every((d) => /^[\d,]+$/.test(d.t));
  console.log('build ' + r.ver + '  weakCrit ' + JSON.stringify(r.weakCrit) + '  resist ' + JSON.stringify(r.resist) + '  projTell ' + JSON.stringify(r.projTell) + '  mobTell ' + JSON.stringify(r.mobTell));
  ok('a weakness crit prints digits only, warm crit colour, crit flag, one number', digits(r.weakCrit) && r.weakCrit.length === 1 && r.weakCrit[0].c === '#ffb347' && r.weakCrit[0].crit, JSON.stringify(r.weakCrit));
  ok('a resisted hit prints digits only in grey-blue, and no floating tag', digits(r.resist) && r.resist.length === 1 && r.resist[0].c === '#9fb4c8', JSON.stringify(r.resist));
  ok('a plain crit prints digits only (no ! or !!)', digits(r.plainCrit) && r.plainCrit.length === 1, JSON.stringify(r.plainCrit));
  ok('no glow ellipse is filled under a closed gold chest', r.chestFills.length > 0 === false || !r.chestFills.some((f) => /255, ?210, ?90|200, ?210, ?240|220, ?170, ?110/.test(f)), JSON.stringify(r.chestFills));
  ok('the projectile tell draws at 40% or less; the windup tell over a monster keeps its full strength', r.projA && r.projTell.length >= 1 && r.projTell.every((a) => a <= 0.401) && r.mobTell.length >= 1 && r.mobTell.some((a) => a >= 0.55), JSON.stringify([r.projTell, r.mobTell]));
  ok('no red cross on the meteor marker or the quake band', !r.red.meteor && !r.red.quake && !r.red.err, JSON.stringify(r.red));
  ok('the shipped source: no suffixes, no tags, no aura, no move tells, the faint projectile tell', Object.values(r.src).every(Boolean), JSON.stringify(r.src));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
