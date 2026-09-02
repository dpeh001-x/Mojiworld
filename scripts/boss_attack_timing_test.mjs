// BOSS ATTACK TIMING: slightly longer intervals, critical frames held.
// ============================================================================
// Per user: "for bosses during their attack phase make sure the animation
// sprites have slightly longer intervals and hold critical sprite frames
// longer to make attacks not feel rushed".
//
// Three layers are checked. The DATA: every boss attack set in the manifest
// carries a per-frame timing in data/anim_calib.js - the artist's eight
// authored ramps untouched, the rest baked to the default rule (base 60ms,
// strike x2.2, sides x1.5, first x1.2, last x1.6). The GAME: _bossAttackFrame
// and the zodiac attack path walk that timing, so over a played attack the
// strike frame is on screen more than twice as long as a windup frame and the
// whole swing runs ~720ms instead of 432. The PARITY: the animator reads the
// same field, and the generator's --check passes on the shipped data.
// Run: node scripts/boss_attack_timing_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defaultAttackFt, LX_ATK_BASE_MS, LX_ATK_HOLD } from './gen_attack_timing.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 9849);
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 240) });

// ---- the data -----------------------------------------------------------------
const CAL = process.env.MOJI_CALIB_FILE || path.join(ROOT, 'data', 'anim_calib.js');
const src = readFileSync(CAL, 'utf8');
const mm = src.match(/window\.LX_ANIM_CALIB = ([\s\S]*?);\nwindow\.LX_ATK_HITBOX = /);
const calib = mm ? JSON.parse(mm[1]) : {};
const man = readFileSync(process.env.MOJI_MANIFEST_FILE || path.join(ROOT, 'data', 'anim_calib_manifest.js'), 'utf8');
const M = JSON.parse(man.slice(man.indexOf('{'), man.lastIndexOf('}') + 1));
const bossAtk = Object.keys(M).filter((k) => M[k].group === 'boss' && M[k].states && M[k].states.attack && (M[k].states.attack.count | 0) > 1);
const missing = bossAtk.filter((k) => !(calib[k] && calib[k].attack && Array.isArray(calib[k].attack.ft)));
ok(`every boss attack set (${bossAtk.length}) carries a per-frame timing`, missing.length === 0, missing.length ? 'missing: ' + missing.join(' ') : `${bossAtk.length} sets`);
const AUTHORED = { 'legosaurus': [70, 70, 75, 85, 100, 115, 100, 85, 75], 'gravitos2star': [110, 110, 120, 140, 170, 170, 140, 120, 110] };
ok('the artist\'s authored timings are untouched (legosaurus, gravitos2star spot-checked)',
  Object.keys(AUTHORED).every((k) => calib[k] && calib[k].attack && JSON.stringify(calib[k].attack.ft) === JSON.stringify(AUTHORED[k]) && !calib[k].attack.ftAuto),
  Object.keys(AUTHORED).map((k) => k + '=' + (calib[k] && calib[k].attack ? JSON.stringify(calib[k].attack.ft) : '-')).join(' '));
const auto = bossAtk.filter((k) => calib[k] && calib[k].attack && calib[k].attack.ftAuto);
const ruleOk = auto.every((k) => { const st = M[k].states.attack; return JSON.stringify(calib[k].attack.ft) === JSON.stringify(defaultAttackFt(st.count | 0, st.cb, st.h)); });
ok(`baked timings (${auto.length}) follow the default rule exactly`, auto.length > 0 && ruleOk);
const nine = auto.filter((k) => (M[k].states.attack.count | 0) === 9);
const totals = nine.map((k) => calib[k].attack.ft.reduce((a, b) => a + b, 0));
ok('a nine-frame swing now runs ~720ms (was a flat 432ms) — longer, not rushed',
  nine.length > 0 && totals.every((t) => t === 720), `${nine.length} nine-frame sets, totals ${[...new Set(totals)].join('/')}`);
const kk = calib.kingKrook && calib.kingKrook.attack && calib.kingKrook.attack.ft;
ok('King Krook: the strike frame is held 2.2x, its neighbours 1.5x, the settle 1.6x', !!kk && Math.max(...kk) === Math.round(LX_ATK_BASE_MS * LX_ATK_HOLD.strike) && kk[kk.length - 1] === Math.round(LX_ATK_BASE_MS * LX_ATK_HOLD.last),
  kk ? kk.join('/') : 'no timing');
try { execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'gen_attack_timing.mjs'), '--check'], { stdio: 'pipe' }); ok('the generator\'s --check passes on the shipped data (drift guard)', true); }
catch (e) { ok('the generator\'s --check passes on the shipped data (drift guard)', false, String(e.stdout || e.stderr || e).slice(0, 160)); }

// ---- the game --------------------------------------------------------------------
// MOJI_SERVE_ROOT serves a scratch tree (the tip's game + data, art junctioned
// in) so the browser half proves the shipped calib file, not the working copy.
const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const SERVE_JS = existsSync(path.join(SERVE_ROOT, 'serve.js')) ? path.join(SERVE_ROOT, 'serve.js') : path.join(ROOT, 'serve.js');
const server = spawn(process.execPath, [SERVE_JS, String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT });
await new Promise((r) => setTimeout(r, 1200));
const EXE = [process.env.PW_EXE, process.env.MOJI_PW_EXE,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));
const browser = await chromium.launch({ channel: EXE ? undefined : 'msedge', executablePath: EXE || undefined, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 150)));
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof game === 'object' && typeof _bossAttackFrame === 'function', null, { timeout: 180000 });
await page.waitForTimeout(6500);
const ev = async (fn, arg) => { try { return await page.evaluate(fn, arg); } catch (e) { return { err: String(e).slice(0, 140) }; } };

const g = await ev(async () => {
  const ft = _lxCalibFt('kingKrook', 'attack');
  const zft = _lxCalibFt('zodiac_leo', 'attack');
  // the pure index walk, over one full cycle at 1ms resolution
  const hist = (n, f) => { const h = new Array(n).fill(0); const total = f.reduce((a, b) => a + b, 0); for (let t = 0; t < total; t++) h[_lxFtIndex(n, f, t, false)]++; return h; };
  const hk = ft ? hist(ft.length, ft) : null;
  // the real boss picker, sampled on the wall clock over a stamped attack
  const frames = BOSS_ATTACK_FRAMES.kingKrook;
  for (let i = 0; i < 60 && !(frames && frames._readyN >= 2); i++) { try { _lxFtReadyN(frames); } catch (e) {} await new Promise((r) => setTimeout(r, 100)); }
  const m = { type: 'kingKrook', isBoss: true, x: 0, y: 0, w: 160, h: 160, currentHp: 1, atkAnimUntil: performance.now() + 2000 };
  const seen = new Map(); const t0 = performance.now();
  while (performance.now() - t0 < 720) { const f = _bossAttackFrame('kingKrook', m); if (f) { const i = frames.indexOf(f); seen.set(i, (seen.get(i) || 0) + 1); } await new Promise((r) => setTimeout(r, 4)); }
  const zn = (ZODIAC_ATTACK_FRAMES.leo || []).length;
  const zh = (zft && zn > 1) ? (() => { const h = new Array(zn).fill(0); for (let t = 0; t < 720; t += 1) { const fr = _zodiacStateImg('leo', 'attack', t, { patternState: 'attack' }); const i = ZODIAC_ATTACK_FRAMES.leo.indexOf(fr); if (i >= 0) h[i]++; } return h; })() : null;
  return { ft, hk, zft, zh, ready: frames ? frames._readyN : 0, seen: [...seen.entries()].sort((a, b) => a[0] - b[0]), total: ft ? ft.reduce((a, b) => a + b, 0) : 0 };
});
ok('the game reads King Krook\'s baked timing', !g.err && Array.isArray(g.ft) && g.total === 720, g.err || `ft ${g.ft && g.ft.join('/')} total ${g.total}`);
// Krook's strike sits at frame 6 - the frame after his raised apex, which the
// box rule picks over the middle frame - so read the strike off the timing.
const sIdx = Array.isArray(g.ft) ? g.ft.indexOf(Math.max(...g.ft)) : -1;
ok(`over one cycle the strike frame (${sIdx}) is on screen 2.2x as long as a windup frame (pure walk)`, !g.err && g.hk && sIdx > 0 && g.hk[sIdx] === 132 && g.hk[1] === 60 && g.hk[g.hk.length - 1] === 96, g.err || `dwells ${g.hk && g.hk.join('/')}`);
const peak = g.seen && g.seen.length ? g.seen.reduce((a, b) => (b[1] > a[1] ? b : a)) : null;
ok('the live boss picker holds the strike frame longest over a real 720ms attack (>= 1.8x a windup frame)', !g.err && g.ready >= 2 && peak && peak[0] === sIdx && peak[1] >= 1.8 * (g.seen.find((s) => s[0] === 1) || [0, 1])[1],
  g.err || `ready ${g.ready}; samples per frame ${g.seen && g.seen.map((s) => s[0] + ':' + s[1]).join(' ')}`);
ok('the zodiac attack path walks its baked timing too (Leo)', !g.err && g.zh && g.zh[4] === 132 && g.zh[0] === 72, g.err || `zodiac_leo ft ${g.zft && g.zft.join('/')} dwells ${g.zh && g.zh.join('/')}`);
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' · '));

await browser.close(); server.kill();
let fail = 0;
for (const r of res) { if (!r.pass) fail++; console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.extra ? '  — ' + r.extra : '')); }
console.log(`\n${res.length - fail}/${res.length} checks passed`);
process.exit(fail ? 1 : 0);
