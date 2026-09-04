// Monster attack animation (v0.30.382): every monster attack set carries its own
// baked per-frame timing (strike from its own frames, held by its prominence); the
// game walks it ONCE per attack, lands the strike frame on the hit, holds the settle
// instead of wrapping, and rests between proximity swings.
//   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT / MOJI_CALIB_FILE / MOJI_MANIFEST_FILE override the inputs.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { defaultMobAttackFt, LX_MOB_ATK_BASE_BY_TYPE } from './gen_attack_timing.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
// ---- data ----
const CALIB = process.env.MOJI_CALIB_FILE || path.join(ROOT, 'data', 'anim_calib.js');
const MANIFEST = process.env.MOJI_MANIFEST_FILE || path.join(ROOT, 'data', 'anim_calib_manifest.js');
const cs = readFileSync(CALIB, 'utf8'); const calib = JSON.parse(cs.match(/window\.LX_ANIM_CALIB = ([\s\S]*?);\nwindow\.LX_ATK_HITBOX/)[1]);
const ms = readFileSync(MANIFEST, 'utf8'); const M = JSON.parse(ms.slice(ms.indexOf('{'), ms.lastIndexOf('}') + 1));
const mobs = Object.keys(M).filter((k) => M[k].group === 'monster' && M[k].states && M[k].states.attack && (M[k].states.attack.count | 0) > 1).sort();
const ftOf = (k) => (calib[k] && calib[k].attack && Array.isArray(calib[k].attack.ft)) ? calib[k].attack.ft : null;
const missing = mobs.filter((k) => !ftOf(k));
ok(`every monster attack set (${mobs.length}) carries a per-frame timing`, missing.length === 0, missing.length ? 'missing: ' + missing.slice(0, 6).join(' ') : `${mobs.length} sets`);
const ruleBad = mobs.filter((k) => { const st = M[k].states.attack; const want = defaultMobAttackFt(st.count | 0, st.cb, st.h, LX_MOB_ATK_BASE_BY_TYPE[k]); const got = ftOf(k); return !(got && calib[k].attack.ftAuto === true && got.length === want.length && got.every((v, i) => v === want[i])); });
ok('baked monster timings follow the individualised rule exactly', mobs.length > 0 && ruleBad.length === 0, ruleBad.slice(0, 5).join(' '));
const strikeOf = (ft) => ft ? ft.indexOf(Math.max(...ft)) : -1;
const distinct = new Set(mobs.map((k) => (ftOf(k) || []).join('/')));
ok(`the timings are individual: ${distinct.size} distinct patterns across ${mobs.length} monsters (>= 12)`, distinct.size >= 12);
const strikes = { snail: strikeOf(ftOf('snail')), thornmaw: strikeOf(ftOf('thornmaw')), tideling: strikeOf(ftOf('tideling')), towerWisp: strikeOf(ftOf('towerWisp')) };
ok("the strike frame follows each monster's own apex (snail 5, thornmaw 4, tideling 6, towerWisp 7)", strikes.snail === 5 && strikes.thornmaw === 4 && strikes.tideling === 6 && strikes.towerWisp === 7, JSON.stringify(strikes));
const sn = ftOf('snail'), gq = ftOf('grumpsquid');
ok('a rearing snail holds its strike 2.8x (200ms); a squid that barely moves 1.8x (130ms)', !!sn && !!gq && Math.max(...sn) === 200 && Math.max(...gq) === 130, `snail ${sn && sn.join('/')}  grumpsquid ${gq && gq.join('/')}`);
const fd = ftOf('fatDragon'); ok('Plumpdrake keeps its authored 96ms base', !!fd && Math.min(...fd) === 96, fd && fd.join('/'));
const perFrame = mobs.map((k) => { const f = ftOf(k) || [0]; return f.reduce((a, b) => a + b, 0) / f.length; }).sort((a, b) => a - b);
ok('every swing averages 88-130ms a frame (not rushed, not a crawl; was a flat 72)', perFrame.length > 0 && perFrame[0] >= 88 && perFrame[perFrame.length - 1] <= 130, perFrame[0].toFixed(1) + '..' + perFrame[perFrame.length - 1].toFixed(1));
try { execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'gen_attack_timing.mjs'), '--check'], { stdio: 'pipe' }); ok("the generator's --check passes on the shipped data (drift guard)", true); }
catch (e) { ok("the generator's --check passes on the shipped data (drift guard)", false, String(e.stdout || e.stderr || e).slice(0, 160)); }
// ---- the game ----
const PORT = Number(process.env.PORT || 9931); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof _monsterStateFrame === 'function' && typeof spawnMonster === 'function', null, { timeout: 180000 }); await page.waitForTimeout(6000);
  await page.evaluate(() => { try { _lxBootGateDone = true; } catch (e) {} try { _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; } });
  const g = await page.evaluate(async () => {
    const o = {}; const ft = (typeof _lxCalibFt === 'function') ? _lxCalibFt('snail', 'attack') : null; o.ft = ft;
    if (!ft) return o;
    try { loadMap('forest', 300); } catch (e) { o.mapErr = String(e && e.message); }   // the boot map is a town: no spawns there
    await new Promise((r) => setTimeout(r, 400));
    const spawnSnail = (dx) => { spawnMonster(player.x + dx, player.y, 'snail'); const list = game.monsters.filter((x) => x && x.type === 'snail'); return list[list.length - 1]; };
    const set = _monsterFramesFor('snail'); const t0 = performance.now();
    while (!(set.attack && set.attack[8] && set.attack[8].complete && set.attack[8].naturalWidth > 0) && performance.now() - t0 < 15000) await new Promise((r) => setTimeout(r, 50));
    o.ready = set.attack ? set.attack.filter((f) => f && f.complete && f.naturalWidth > 0).length : 0;
    const idx = (f) => set.attack.indexOf(f);
    const m = spawnSnail(400); if (!m) return Object.assign(o, { spawnErr: 'no snail spawned' });
    m.vx = 0; m.currentHp = m.maxHp || 100; o.type = m.type;
    const now = performance.now();
    // an instant hit: the strike is on screen at the hit, then the swing plays out and holds its settle
    m._animSt = null; m._atkStrikeMs = undefined; m._swingUntil = 0; m.atkAnimUntil = now + 3000;
    const seq = []; const s0 = performance.now();
    while (performance.now() - s0 < 900) { const f = _monsterStateFrame(m); seq.push([Math.round(performance.now() - s0), idx(f)]); await new Promise((r) => setTimeout(r, 8)); }
    o.instFirst = seq[0][1]; o.instLast = seq[seq.length - 1][1]; o.instMin = Math.min(...seq.map((x) => x[1])); o.instMax = Math.max(...seq.map((x) => x[1]));
    const on5 = seq.filter((x) => x[1] === 5); o.instStrikeMs = on5.length ? on5[on5.length - 1][0] - on5[0][0] : 0;
    o.instMonotone = seq.every((x, i) => i === 0 || x[1] >= seq[i - 1][1]); o.instSamples = seq.filter((x, i) => i % 6 === 0).map((x) => x[0] + ':' + x[1]).join(' ');
    // a telegraphed attack: the strike frame begins as the telegraph ends
    m._animSt = null; m._atkStrikeMs = 450; m._swingUntil = 0; m.atkAnimUntil = performance.now() + 2000;
    const tseq = []; const t1 = performance.now();
    while (performance.now() - t1 < 700) { const f = _monsterStateFrame(m); tseq.push([Math.round(performance.now() - t1), idx(f)]); await new Promise((r) => setTimeout(r, 8)); }
    const before = tseq.filter((x) => x[0] < 430).map((x) => x[1]); const at = tseq.filter((x) => x[0] >= 465 && x[0] < 640).map((x) => x[1]);
    o.teleBeforeMax = Math.max(...before); o.teleAtStrike = at.length > 0 && at.every((v) => v === 5); o.teleFirst = tseq[0][1]; o.teleSamples = 'n=' + at.length + ' ' + tseq.filter((x) => x[0] >= 380).map((x) => x[0] + ':' + x[1]).join(' ');
    // proximity: one swing then a rest, not a loop
    const m2 = spawnSnail(10); if (!m2) return Object.assign(o, { spawnErr: 'no second snail' }); m2.vx = 0; m2.currentHp = m2.maxHp || 100; m2.atkAnimUntil = 0; m2._swingUntil = 0; m2._proxRestUntil = 0;
    const isAtk = (f) => set.attack.indexOf(f) >= 0;
    const p0 = _monsterStateFrame(m2); o.proxStarts = isAtk(p0); o.proxFirst = idx(p0);
    const swingLen = ft.reduce((a, b) => a + b, 0);
    await new Promise((r) => setTimeout(r, swingLen + 120));
    const p1 = _monsterStateFrame(m2); o.proxRests = !isAtk(p1);
    await new Promise((r) => setTimeout(r, 500));
    const p2 = _monsterStateFrame(m2); o.proxAgain = isAtk(p2);
    return o;
  });
  ok("the game reads the snail's baked timing", !!g.ft && g.ft.length === 9, g.ft && g.ft.join('/'));
  ok('snail attack frames decoded in the harness', g.ready === 9, String(g.ready));
  ok('instant hit: the strike frame (5) is on screen at the hit, held ~200ms, then the swing settles', g.instFirst === 5 && g.instStrikeMs >= 150 && g.instLast === 8, JSON.stringify([g.instFirst, g.instStrikeMs, g.instLast]));
  ok('the swing plays once - frames only ever advance, no wrap back to the windup', g.instMonotone === true && g.instMin === 5 && g.instMax === 8, JSON.stringify([g.instMonotone, g.instMin, g.instMax]) + ' ' + (g.instMonotone ? '' : g.instSamples));
  ok('telegraphed 450ms attack: windup frames before the telegraph ends, the strike frame right after', g.teleFirst === 0 && g.teleBeforeMax <= 4 && g.teleAtStrike === true, JSON.stringify([g.teleFirst, g.teleBeforeMax, g.teleAtStrike]) + ' ' + (g.teleAtStrike ? '' : g.teleSamples));
  ok('standing beside the player: one full swing from the windup, then a rest, then another', g.proxStarts === true && g.proxFirst === 0 && g.proxRests === true && g.proxAgain === true, JSON.stringify([g.proxStarts, g.proxFirst, g.proxRests, g.proxAgain]));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
