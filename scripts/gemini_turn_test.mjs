// Gemini flows from idle to moving to attack, and its wing colours never swap sides.
// ============================================================================
// Per user: "use all the different views to make animation sequence that flows nicely from idle to moving to attack",
// then "the wing colour appears to change please ensure it does not get swapped". Gemini idles facing the camera, flies
// in a three-quarter view and lunges from the front; a TURN set bridges front <-> flight, and a colour TWIN of every
// set (pink and cyan exchanged) is drawn when it faces left, so the mirror no longer moves its pink wings to the right.
//   1. INDEX: the turn and twin dirs list Gemini's nine frames and no other sign (no 404 probing)
//   2. COLOURS: the front static has pink on the left and cyan on the right, and so does its twin once mirrored
//   3. LOADS: the turn and twin sets load for Gemini only, and the lazy-art release knows them
//   4. TURN: a walk entered from idle or an attack plays the turn forward, then the flight loop from its first frame;
//      an idle entered from a walk plays it backward, then the idle; the crossfade's outgoing draw is untouched
//   5. OTHER SIGNS: a sign without a turn set walks straight into its walk loop
//   6. TWIN: facing left, every frame (and the static) is swapped for its twin at the same index; facing right, none
//   7. DRAWN: a live left-facing Gemini is drawn from the twin sets, a right-facing one from the plain sets
// Run: node scripts/gemini_turn_test.mjs   (PORT=..., MOJI_GAME_FILE=... for another build)
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = (process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')).replace(/\\/g, '/');
const require = createRequire(import.meta.url);
const { chromium } = require(ROOT + '/node_modules/playwright-core');
const sharp = require(ROOT + '/node_modules/sharp');
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 12893);
const res = [];
const ok = (n, c, extra) => { res.push({ n, pass: !!c }); console.log((c ? 'PASS ' : 'FAIL ') + n + (extra === undefined ? '' : '  [' + String(extra).slice(0, 240) + ']')); };
const J = JSON.stringify;

// 1. the frame index
const fi = fs.readFileSync(ROOT + '/data/sprite_frame_index.js', 'utf8'), FI = JSON.parse(fi.slice(fi.indexOf('{'), fi.lastIndexOf('}') + 1)).frames;
const dirs = ['bosses/zodiac/turn', 'bosses/zodiac/twin/idle', 'bosses/zodiac/twin/walk', 'bosses/zodiac/twin/attack', 'bosses/zodiac/twin/turn'];
ok('1. INDEX: turn + twin dirs hold Gemini x9 and nobody else', dirs.every((d) => FI[d] && FI[d].gemini === 9 && Object.keys(FI[d]).length === 1), J(dirs.map((d) => FI[d])));

// 2. colours, from the files: mean hue family of the left and right thirds
const sides = async (buf, flop) => { let im = sharp(buf); if (flop) im = im.flop(); const { data, info } = await im.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cnt = { L: { pink: 0, cyan: 0 }, R: { pink: 0, cyan: 0 } };
  for (let p = 0; p < info.width * info.height; p++) { const k = p * 4; if (data[k + 3] < 200) continue; const x = p % info.width; const side = x < info.width * 0.42 ? 'L' : x > info.width * 0.58 ? 'R' : null; if (!side) continue;
    const r = data[k], g = data[k + 1], b = data[k + 2]; if (r > 170 && g < 140 && b > 90 && r - g > 70) cnt[side].pink++; else if (g > 150 && b > 150 && r < 120) cnt[side].cyan++; }
  return cnt; };
const Z = ROOT + '/Sprites/bosses/zodiac/';
const st = await sides(fs.readFileSync(Z + 'gemini.webp'), false), tw = await sides(fs.readFileSync(Z + 'twin/gemini.webp'), true);
const pinkLeft = (c) => c.L.pink > 5 * c.L.cyan && c.R.cyan > 5 * c.R.pink;
ok('2. COLOURS: facing right AND facing left (twin, mirrored) keep pink left / cyan right', pinkLeft(st) && pinkLeft(tw), J({ right: st, left: tw }));

const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function' && game.mapData && typeof ZODIAC_TURN_FRAMES === 'object', null, { timeout: 180000 });
  await page.evaluate(() => { try { _lxBossArtWant('zodiac_gemini'); } catch (e) {} });
  const ready = (a) => a && a.length === 9 && a.every((x) => x && ((x.naturalWidth || x.width) > 0));
  await page.waitForFunction(() => ['idle', 'walk', 'attack', 'turn'].every((s) => { const a = ZODIAC_TWIN[s].gemini, b = (s === 'turn' ? ZODIAC_TURN_FRAMES : s === 'idle' ? ZODIAC_IDLE_FRAMES : s === 'walk' ? ZODIAC_WALK_FRAMES : ZODIAC_ATTACK_FRAMES).gemini;
    return [a, b].every((x) => x && x.length === 9 && x.every((i) => i && ((i.naturalWidth || i.width) > 0))); }) && ZODIAC_TWIN.static.gemini.naturalWidth > 0, null, { timeout: 90000 }).catch(() => {});
  const L = await page.evaluate(() => {
    const others = ZODIAC_SPRITE_TYPES.filter((s) => s !== 'gemini');
    const sets = _lxBossArtSets('zodiac_gemini');
    return { turn: ZODIAC_TURN_FRAMES.gemini.length, twins: ['idle', 'walk', 'attack', 'turn'].map((s) => ZODIAC_TWIN[s].gemini.length), otherTurn: others.map((s) => (ZODIAC_TURN_FRAMES[s] || []).length).reduce((a, b) => a + b, 0),
      lazy: [ZODIAC_TURN_FRAMES.gemini, ZODIAC_TWIN.idle.gemini, ZODIAC_TWIN.walk.gemini, ZODIAC_TWIN.attack.gemini, ZODIAC_TWIN.turn.gemini].every((a) => sets.indexOf(a) >= 0) };
  });
  ok('3. LOADS: turn 9 + four twin sets of 9 for Gemini, none for the other signs, all in the lazy release', L.turn === 9 && L.twins.every((n) => n === 9) && L.otherTurn === 0 && L.lazy, J(L));

  const T = await page.evaluate(() => {
    const idx = (img, set) => { if (!img || !set) return null; const s = img._lxSrc || img; for (let i = 0; i < set.length; i++) { const f = set[i]; if (f === img || f === s || (f && f._lxSrc === s)) return i; } return null; };
    const who = (img, sign) => { for (const [n, M] of [['turn', ZODIAC_TURN_FRAMES], ['walk', ZODIAC_WALK_FRAMES], ['idle', ZODIAC_IDLE_FRAMES], ['attack', ZODIAC_ATTACK_FRAMES]]) { const i = idx(img, M[sign]); if (i !== null) return n + i; } return '?'; };
    const at = (sign, state, prev, e) => { const m = { zodiacSign: sign, facing: 1, _zAnim: { state, prev, since: 0 } }; return who(_zodiacStateImg(sign, state, e, m), sign); };
    return {
      fwd: [0, 200, 404, 405, 485].map((e) => at('gemini', 'walk', 'idle', e)),
      fromAtk: at('gemini', 'walk', 'attack', 90),
      back: [0, 200, 404, 405].map((e) => at('gemini', 'idle', 'walk', e)),
      idleFromAtk: at('gemini', 'idle', 'attack', 0),
      xfadePrev: (() => { const m = { zodiacSign: 'gemini', facing: 1, _zAnim: { state: 'idle', prev: 'walk', since: 0 } }; return who(_zodiacStateImg('gemini', 'walk', 3000, m), 'gemini'); })(),
      virgo: at('virgo', 'walk', 'idle', 0),
    };
  });
  ok('4a. TURN: walk from idle plays turn 0 -> 4 -> 8, then the flight loop from frame 0', J(T.fwd) === J(['turn0', 'turn4', 'turn8', 'walk0', 'walk1']), J(T.fwd));
  ok('4b. TURN: walk after an attack turns too; idle after a walk turns back 8 -> 0, then idles', T.fromAtk === 'turn2' && J(T.back) === J(['turn8', 'turn4', 'turn0', 'idle0']) && T.idleFromAtk === 'idle0', J([T.fromAtk, T.back, T.idleFromAtk]));
  ok('4c. TURN: the crossfade\'s outgoing walk frame is the walk loop, not the turn', /^walk/.test(T.xfadePrev), T.xfadePrev);
  ok('5. OTHER SIGNS: Virgo walks straight into its walk loop', T.virgo === 'walk0', T.virgo);

  const W = await page.evaluate(() => {
    const src = (x) => (x && ((x._lxSrc && x._lxSrc.src) || x.src)) || '';
    const out = { left: [], right: [], other: null, stat: null };
    for (const s of ['idle', 'walk', 'attack', 'turn']) {
      const M = s === 'turn' ? ZODIAC_TURN_FRAMES : s === 'idle' ? ZODIAC_IDLE_FRAMES : s === 'walk' ? ZODIAC_WALK_FRAMES : ZODIAC_ATTACK_FRAMES;
      for (const i of [0, 4, 8]) { const img = M.gemini[i]; out.left.push(src(_zodiacTwin({ zodiacSign: 'gemini', facing: -1 }, img)).replace(/^.*zodiac\//, '')); out.right.push(src(_zodiacTwin({ zodiacSign: 'gemini', facing: 1 }, img)).replace(/^.*zodiac\//, '')); }
    }
    out.other = _zodiacTwin({ zodiacSign: 'virgo', facing: -1 }, ZODIAC_IDLE_FRAMES.virgo[0]) === ZODIAC_IDLE_FRAMES.virgo[0];
    out.stat = src(_zodiacTwin({ zodiacSign: 'gemini', facing: -1 }, ZODIAC_SPRITES.gemini)).replace(/^.*zodiac\//, '');
    return out;
  });
  const want = (tw) => ['idle', 'walk', 'attack', 'turn'].flatMap((s) => [0, 4, 8].map((i) => `${tw}${s}/gemini_${i}.webp`));
  ok('6. TWIN: facing left each frame becomes its twin at the same index (and the static); facing right none; other signs untouched',
    J(W.left) === J(want('twin/')) && J(W.right) === J(want('')) && W.other && W.stat === 'twin/gemini.webp', J({ left: W.left.slice(0, 3), right: W.right.slice(0, 3), other: W.other, stat: W.stat }));

  // 7. live draw
  await page.evaluate(() => { try { _lxBootGateDone = true; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player._storyBeatsSeen = player._storyBeatsSeen || {}; if (typeof STORY_BEATS === 'object') for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true; });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window._prologueActive = false; player.level = 45; loadMap('forest'); setInterval(() => { if ('maxHp' in player) player.maxHp = 1e7; for (const k of ['hp', 'currentHp']) if (k in player) player[k] = 1e7; game.paused = false; }, 60); });
  await page.waitForTimeout(2500);
  const D2 = await page.evaluate(async () => {
    for (const q of game.monsters) if (q) q.currentHp = 0; game.monsters = game.monsters.filter((q) => q && q.currentHp > 0);
    spawnMonster(player.x + 300, player.y - 150, 'zodiac_gemini', true);
    const m = game.monsters.find((q) => q && q.zodiacSign === 'gemini'); if (!m) return { err: 'no gemini' };
    const oB = window.bossAI; window.bossAI = function (mm) { if (mm === m) return; return oB.apply(this, arguments); };
    const oD = window._drawBossSprite, seen = { L: new Set(), R: new Set() }; let face = 1;
    window._drawBossSprite = function (spr, mm) { if (mm === m) { const u = String((spr && ((spr._lxSrc && spr._lxSrc.src) || spr.src)) || ''); seen[face < 0 ? 'L' : 'R'].add(/\/zodiac\/twin\//.test(u) ? 'twin' : /\/zodiac\//.test(u) ? 'plain' : 'other'); } return oD.apply(this, arguments); };
    for (const f of [1, -1]) { face = f; m.facing = f; m.vx = 0; m.patternState = 'idle'; m.atkAnimUntil = 0; await new Promise((r) => setTimeout(r, 700)); }
    window._drawBossSprite = oD; window.bossAI = oB;
    return { R: [...seen.R], L: [...seen.L] };
  });
  ok('7. DRAWN: a left-facing Gemini draws the twin sets, a right-facing one the plain sets', J(D2.L) === J(['twin']) && J(D2.R) === J(['plain']), J(D2));
  ok('8. no page errors', errs.length === 0, J(errs));
} finally { await browser.close(); server.kill(); }
const fail = res.filter((r) => !r.pass).length;
console.log(`\n${res.length - fail}/${res.length} passed`);
process.exit(fail ? 1 : 0);
