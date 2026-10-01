// THE 25 ONE-STILL SKILLS PLAY ANIMATED EFFECTS (v0.30.1520). Per user: "Generate high quality animated effects for 25 skills
// that use one still frame ... ensure there are no cut offs", reviewed over five rounds. Their 30 effects play 16-frame
// one-shots built up from an orb / kunai / icicle / puff (multi_shot keeps a 9-frame loop); ten stills were redrawn first.
//   static: the 30 keys are animated keys; every frame decodes on its still's canvas; nothing reaches the canvas edge; every
//           set moves; the size table is sane; the frame index, the offline manifest, the edge rows and each skill's
//           art-table row list them;
//   in game: each of the 25 skills, cast for real at dummies, draws its effect's frames (not the still); the Ice Spike and
//           Fireball rings build up once and then hold their last frame; Railshot's hold rings run ONE build-up across
//           the draw (no ring restarts at the orb once the circle has formed).
//   node scripts/skill_anim_fx_test.mjs [port]      (MOJI_SERVE_ROOT overrides the served tree)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'package.json'));
const sharp = require('sharp'); const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || process.env.PORT || 10291);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + JSON.stringify(x).slice(0, 400) : '')); };
const game = readFileSync(path.join(ROOT, 'mojiworld_game.html'), 'utf8');
const m = game.match(/const _LX_SKILL_ANIM = new Set\(\[([^\]]*)\]\);/); const KEYS = m ? [...m[1].matchAll(/'([a-z0-9_]+)'/g)].map((x) => x[1]) : [];
ok('30 skill effects are listed as animated (_LX_SKILL_ANIM, spread into _FX_ANIM_KEYS)', KEYS.length === 30 && game.includes('..._LX_SKILL_ANIM,'), KEYS.length);
const NF = (k) => (k === 'multi_shot' ? 9 : 16);
const stillOf = (k) => { for (const l of game.split('\n')) { const t = l.trim(); if (t.startsWith(k + ':')) { const q1 = t.indexOf("'"), q2 = t.indexOf("'", q1 + 1); const v = t.slice(q1 + 1, q2); if (/\.(webp|png)$/.test(v)) return 'Sprites/fx/' + v; } } return 'Sprites/fx/' + k + '.webp'; };
const px = async (rel) => { const { data, info } = await sharp(path.join(ROOT, rel)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, W: info.width, H: info.height }; };
const edge = (r) => { let n = 0; for (let y = 0; y < r.H; y++) for (let x = 0; x < r.W; x++) if ((x < 2 || y < 2 || x >= r.W - 2 || y >= r.H - 2) && r.data[(y * r.W + x) * 4 + 3] > 24) n++; return n; };
const step = (a, b) => { let d = 0, n = 0; for (let p = 0; p < a.data.length; p += 16) { d += Math.abs(a.data[p + 3] - b.data[p + 3]) + Math.abs(a.data[p] - b.data[p]); n++; } return d / n; };
const bad = { missing: [], extra: [], size: [], edge: [], still: [], still_edge: [], frozen: [] };
for (const k of KEYS) {
  const st = await px(stillOf(k)).catch(() => null); if (!st) { bad.still.push(k); continue; } if (edge(st)) bad.still_edge.push(k);
  const n = NF(k), fr = []; for (let i = 0; i < n; i++) { const f = `Sprites/fx/anim/${k}_${i}.webp`; if (!existsSync(path.join(ROOT, f))) { bad.missing.push(f); continue; } fr.push(await px(f)); }
  if (existsSync(path.join(ROOT, `Sprites/fx/anim/${k}_${n}.webp`))) bad.extra.push(k);
  if (fr.length !== n) continue;
  if (fr.some((f) => f.W !== st.W || f.H !== st.H)) bad.size.push(k);
  if (fr.some((f) => edge(f))) bad.edge.push(k);
  const steps = fr.slice(0, -1).map((f, i) => step(f, fr[i + 1])).sort((a, b) => a - b); if (steps[Math.floor(steps.length / 2)] < 2) bad.frozen.push(k + ' ' + steps[Math.floor(steps.length / 2)].toFixed(1));
}
ok('all 473 frames exist and decode, on their still\'s own canvas (16 a set, multi_shot 9)', !bad.missing.length && !bad.size.length && !bad.still.length && !bad.extra.length, { missing: bad.missing.slice(0, 3), size: bad.size, still: bad.still, extra: bad.extra });
ok('no frame and no still reaches within 2 px of its canvas edge (no cut-offs)', !bad.edge.length && !bad.still_edge.length, { frames: bad.edge, stills: bad.still_edge });
ok('every set moves (median frame-to-frame change above a still image\'s noise)', !bad.frozen.length, bad.frozen);
const mm = game.match(/const _LX_FX_SIZE_MUL = \{([^}]*)\};/); const MUL = mm ? Object.fromEntries([...mm[1].matchAll(/([a-z0-9_]+): ([\d.]+)/g)].map((x) => [x[1], +x[2]])) : null;
ok('the size table names only these sets, each between 1x and 2.1x', MUL && Object.keys(MUL).length >= 20 && Object.entries(MUL).every(([k, v]) => KEYS.includes(k) && v > 1 && v <= 2.1), MUL);
const fi = readFileSync(path.join(ROOT, 'data/sprite_frame_index.js'), 'utf8'); const FI = JSON.parse(fi.slice(fi.indexOf('{'), fi.lastIndexOf('}') + 1)).frames;
ok('the frame index counts every set (16, multi_shot 9)', KEYS.every((k) => FI['fx/anim'][k] === NF(k)), KEYS.filter((k) => FI['fx/anim'][k] !== NF(k)).map((k) => k + '=' + FI['fx/anim'][k]));
const MAN = new Set(JSON.parse(readFileSync(path.join(ROOT, 'data/assets_manifest.json'), 'utf8')));
ok('every frame is in the offline pre-cache list', KEYS.every((k) => Array.from({ length: NF(k) }, (_, i) => `Sprites/fx/anim/${k}_${i}.webp`).every((f) => MAN.has(f))));
const ed = readFileSync(path.join(ROOT, 'data/sprite_edges.js'), 'utf8'); const E = JSON.parse(ed.slice(ed.indexOf('window.LX_SPRITE_EDGES = ') + 25, ed.lastIndexOf(';')));
ok('every frame has its measured edge-probe row', KEYS.every((k) => Array.from({ length: NF(k) }, (_, i) => `fx/anim/${k}_${i}.webp`).every((f) => f in E)));
const L = game.split('\n'); const s0 = L.findIndex((l) => l.startsWith('const _LX_FX_SKILL = {')); const rows = {};
let i1 = s0 + 1; for (; !/^\};/.test(L[i1]); i1++) { const t = L[i1].trim(); const c = t.indexOf(':'); const q1 = t.indexOf("'"), q2 = t.indexOf("'", q1 + 1); if (c > 0 && q1 > 0) rows[t.slice(0, c)] = t.slice(q1 + 1, q2).split(' '); }
// a row that is a gate marker keeps its line; its additions follow the table as  _LX_FX_SKILL.<id> += ' ...';
for (let i = i1 + 1; i < i1 + 6 && L[i].startsWith('_LX_FX_SKILL.'); i++) { const mm2 = L[i].match(/^_LX_FX_SKILL\.([A-Za-z0-9_]+) \+= '([^']*)'/); if (mm2) rows[mm2[1]] = (rows[mm2[1]] || []).concat(mm2[2].split(' ').filter(Boolean)); }
const SKILLS25 = ['arrowRain', 'arrowShot', 'backstab', 'blink', 'celestialAurora', 'chargedShot', 'darkPulse', 'deathBlossom', 'eagleEye', 'elemental', 'elementalArrows', 'evadeRoll', 'fireball', 'flurry', 'holyLight', 'iceSpike', 'multiShot', 'phantom_cut', 'rush', 'shadowStrike', 'smokeBomb', 'smokeDash', 'snipe_railgun', 'throwDagger', 'wildBond'];
const noFa = []; for (const id of SKILLS25) for (const t of rows[id] || []) if (t.startsWith('fx:') && KEYS.includes(t.slice(3)) && !(rows[id] || []).includes('fa:' + t.slice(3))) noFa.push(id + ' ' + t);
ok('each skill\'s art-table row loads its effects\' frames with it (fa: beside fx:)', !noFa.length, noFa);
// ---- in game: cast each skill at dummies and see which animated frames get drawn
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT }); await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof castSkill === 'function' && typeof _fxAnimFrames === 'function', null, { timeout: 180000 }); await page.waitForTimeout(5000);
  const R = await page.evaluate(async ({ SKILLS25, KEYS }) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {} try { _cineScoreStop(1, false); } catch (e) {}
    loadMap('forest', 300); await sleep(2500); game.paused = false; for (let i = 0; i < 30 && !player.onGround; i++) await sleep(100);
    try { window._perfTick = () => {}; } catch (e) {}   // the headless frame watchdog flips FX tiers on its own
    const X0 = player.x, Y0 = player.y;
    for (const k of KEYS) { _fxAnimFrames(k); try { _lxFxReady(LX_FX[k]); } catch (e) {} }   // warm every set and its still (the rings draw only once the still is in, as they always have)
    const ready = (k) => { const a = FX_ANIM_FRAMES[k]; return a && a.length && a.every((f) => f && (f.tagName === 'CANVAS' || (f.complete && f.naturalWidth > 0))); };
    const t0 = performance.now(); while (KEYS.some((k) => !ready(k)) && performance.now() - t0 < 90000) await sleep(250);
    const keyOf = (img) => { const s = String((img && (img.src || (img._lxSrc && img._lxSrc.src))) || ''); const mm = s.match(/fx\/anim\/([a-z0-9_]+)_(\d+)\.webp/); return mm ? [mm[1], +mm[2]] : null; };
    let rec = null; const P = CanvasRenderingContext2D.prototype, oDI = P.drawImage;
    // on-screen draws only: the shrink bake draws every frame once into a detached canvas, which is not the effect playing
    P.drawImage = function (img) { if (rec && this.canvas && this.canvas.isConnected) { const k = keyOf(img); if (k) rec.push([performance.now(), k[0], k[1]]); } return oDI.apply(this, arguments); };
    const mk = () => { game.monsters.length = 0; for (const dx of [140, 220, 300, -150]) { const mm = spawnMonster(player.x + dx, player.y - 10, 'slime', false); if (mm) { mm.maxHp = mm.currentHp = 9e12; mm.speed = 0; mm.atk = 0; mm.frozen = 99999; } } };
    const as = (sk) => { player.cls = sk.cls; player.job = sk.job || null; player.master = sk.master || null; player.masteries = {}; if (sk.master) player.masteries[sk.master] = true; };
    const out = { ready: KEYS.filter((k) => !ready(k)), skills: {}, rings: {}, hold: null, base: {} };
    for (const k of ['blink', 'throw_dagger', 'holy_light', 'hexmaster_darkpulse']) { const a = FX_ANIM_FRAMES[k]; out.base[k] = [a._lxBase, Math.max(...a.map((f) => (f && (f.width || f.naturalWidth)) || 0))]; }
    for (const id of SKILLS25) {
      const sk = SKILLS[id]; if (!sk) { out.skills[id] = 'no skill'; continue; }
      player.x = X0; player.y = Y0; player.vx = player.vy = 0; as(sk);
      player._god = true; player.level = 90; player.maxMp = player.mp = 99999; player.maxHp = player.hp = 999999; player.facing = 1; player._releasedCharge = 1; player.attackTimer = 0; player.state = 'idle';
      for (const k of Object.keys(player.skillCooldowns || {})) player.skillCooldowns[k] = 0; if (player.cooldowns) for (const k of Object.keys(player.cooldowns)) player.cooldowns[k] = 0; if (player._cd) for (const k of Object.keys(player._cd)) player._cd[k] = 0;
      if (game.smoothFx) game.smoothFx.length = 0; mk(); await sleep(250);
      rec = []; try { castSkill(id); } catch (e) {}
      const e = performance.now() + 1800; while (performance.now() < e) { player._releasedCharge = 1; await sleep(60); }
      out.skills[id] = rec.map((r) => r[1] + '#' + r[2]);
      if (id === 'iceSpike' || id === 'fireball') { const rk = id === 'iceSpike' ? 'ice_spike_ring' : 'fireball_ring'; const seq = rec.filter((r) => r[1] === rk).map((r) => r[2]); out.rings[rk] = { first: seq.slice(0, 3), max: Math.max(-1, ...seq), back: seq.some((v, i) => i && v < seq[i - 1]) }; }
      rec = null;
    }
    // Railshot held: a ring respawns every 5-9 ticks; all of them must share ONE build-up across the hold
    { const sk = SKILLS.snipe_railgun; as(sk); player.x = X0; player.y = Y0; game.monsters.length = 0; if (game.smoothFx) game.smoothFx.length = 0;
      const slot = Object.keys(KEY_TO_SLOT).find((k) => KEY_TO_SLOT[k] === 'q') || 'f'; game.keys[slot] = true;
      player._warCharge = { slotKey: slot, start: game.time | 0, skillId: 'snipe_railgun', power: 0, cls: 'archer', frames: 45 };
      rec = []; const h0 = performance.now(); await sleep(1600);
      const seq = rec.filter((r) => r[1] === 'railshot_charge'); rec = null; game.keys[slot] = false; player._warCharge = null;
      const late = seq.filter((r) => r[0] - h0 > 1100).map((r) => r[2]);
      out.hold = { n: seq.length, first: seq.slice(0, 3).map((r) => r[2]), maxIdx: Math.max(-1, ...seq.map((r) => r[2])), back: seq.some((r, i) => i && r[2] < seq[i - 1][2]), lateMin: late.length ? Math.min(...late) : -1, late: late.length }; }
    P.drawImage = oDI; return out;
  }, { SKILLS25, KEYS });
  const own = (id) => (rows[id] || []).filter((t) => t.startsWith('fx:') && KEYS.includes(t.slice(3))).map((t) => t.slice(3));
  const drew = {}, missing = [];
  for (const id of SKILLS25) { const got = (R.skills[id] || []); const mine = own(id); const keysDrawn = new Set(got.map((s) => s.split('#')[0]).filter((k) => mine.includes(k))); const nFrames = new Set(got.filter((s) => mine.includes(s.split('#')[0]))).size; drew[id] = [...keysDrawn].join('+') + ' ' + nFrames + 'f'; if (mine.length && nFrames < 2) missing.push(id); }
  console.log('distinct frames drawn per skill:', JSON.stringify(drew));
  ok('every set decoded in the running game', !R.ready.length, R.ready);
  ok('each skill, cast for real, draws its effect\'s animation frames (2+ distinct frames of its own sets)', !missing.length, missing);
  for (const rk of ['ice_spike_ring', 'fireball_ring']) { const r = R.rings[rk] || {}; ok(`${rk}: the cast ring builds up from its first frames to the last, once, then holds (never steps back)`, r.first && r.first.length && r.first[0] <= 3 && r.max === 15 && !r.back, r); }
  const h = R.hold || {}; ok('Railshot hold: the respawning rings start at the orb and form the circle ONCE across the draw (never step back to an earlier frame)', h.n > 0 && h.first[0] <= 3 && h.maxIdx === 15 && !h.back, h);
  ok('small sets bake to their own ceiling, big ones keep the 640 fx base', R.base.blink[0] === 256 && R.base.throw_dagger[0] === 256 && R.base.holy_light[0] === 620 && R.base.hexmaster_darkpulse[0] === 640 && R.base.blink[1] < R.base.hexmaster_darkpulse[1], R.base);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 300)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
