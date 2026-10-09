// THE DISTORTED MIRROR'S NEW COPIES (v0.30.1549). v0.30.1591 distorted-roster (per user): Deranged Kuro is back - he and Young Vermillion
// hold the Threshold; the Reflection holds the four captains' copies, Kuro and Vermillion; its Elder is Elder Arlen with his own art.
// Per user: Hera, Lady Hong and Taiga as caricatures in Willeo's style replace
// Future Lyra and the Potato Uncle, Taiger takes Deranged Kuro's place, all three in the mirror, "remove all instance of future
// lyra and potato uncle", and "the black outline thickness consistent at 1.5px".
//   static: the old three are gone from the game, the data tables and the files; the new three have stills, hitbox rows,
//           size rows, sounds (Lady Honk: the family clip) and (since v0.30.1582) nine-frame idle/walk/attack sets; every quest that named the old three names the new;
//           each still's outer outline, scaled to the size the game draws it, is within 20% of the v0.30.1559 size-aware weight;
//   in game: both distorted maps spawn the new three (Taiger in both), each draws its still at its box's size, the quests count
//           them, and nothing asks for a frame or a file that does not exist.
//   node scripts/distorted_mirror_test.mjs [port]      (MOJI_SERVE_ROOT overrides the served tree)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'package.json'));
const sharp = require('sharp'); const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || process.env.PORT || 10431);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 400) : '')); };
const rd = (p) => readFileSync(path.join(ROOT, p), 'utf8'); const game = rd('mojiworld_game.html');
const OLD = ['future_lyra', 'potato_uncle'], NEW = ['taiger', 'harea', 'lady_honk'];
const DATA = ['data/monster_stats.js', 'data/mob_offsets.js', 'data/monster_hitboxes.js', 'data/anim_calib.js', 'data/anim_calib_manifest.js', 'data/sprite_bbox.js', 'data/sprite_edges.js', 'data/sprite_frame_index.js', 'data/assets_manifest.json', 'data/sfx_manifest.js', 'monster_animator.html'];
const leftovers = []; for (const f of ['mojiworld_game.html', ...DATA]) { const t = rd(f); for (const o of [...OLD, 'Future Lyra', 'Potato Uncle']) if (t.includes(o)) leftovers.push(f + ':' + o); }
ok('the old two are named nowhere in the game, its data tables or the animator', !leftovers.length, leftovers);
const files = []; for (const d of ['Sprites/monsters', 'Sprites/monsters/idle', 'Sprites/monsters/walk', 'Sprites/monsters/attack', 'Sprites/fx', 'Sprites/fx/anim', 'audio/monster']) for (const f of readdirSync(path.join(ROOT, d))) if (OLD.some((o) => f.includes(o))) files.push(d + '/' + f);
ok('and none of their files are left (stills, frame sets, swing art, sounds)', !files.length, files.slice(0, 5));
ok('the new three have stills and nine-frame idle, walk and attack sets (v0.30.1582)', NEW.every((k) => existsSync(path.join(ROOT, `Sprites/monsters/${k}.webp`)) && ['idle', 'walk', 'attack'].every((s) => existsSync(path.join(ROOT, `Sprites/monsters/${s}/${k}_8.webp`)))));
const hb = rd('data/monster_hitboxes.js'), mo = rd('data/mob_offsets.js');
ok('each has a hitbox row and a size row (the animator and the draw read them)', NEW.every((k) => new RegExp(k + ':\\{w:\\d+,h:\\d+,mul:[0-9.]+\\}').test(hb) && new RegExp('"' + k + '": 0\\.[0-9]+,').test(mo)));
ok('Taiger and Harea carry the old sounds; Lady Honk uses her family clip without a 404 probe',
  ['taiger', 'harea'].every((k) => ['hit', 'die'].every((s) => existsSync(path.join(ROOT, `audio/monster/mob_${k}_${s}.mp3`)))) && game.includes("_MONSTER_NO_CUSTOM_SFX.add('lady_honk');"));
ok('Kuro is back with his still, three frame sets, swing art, sounds, hitbox and size rows', existsSync(path.join(ROOT, 'Sprites/monsters/deranged_kuro.webp')) &&
  ['idle', 'walk', 'attack'].every((s) => existsSync(path.join(ROOT, `Sprites/monsters/${s}/deranged_kuro_0.webp`))) && existsSync(path.join(ROOT, 'Sprites/fx/swing_deranged_kuro.webp')) &&
  ['hit', 'die'].every((s) => existsSync(path.join(ROOT, `audio/monster/mob_deranged_kuro_${s}.mp3`))) && /deranged_kuro:\{w:\d+,h:\d+,mul:[0-9.]+\}/.test(hb) && /"deranged_kuro": 0\.[0-9]+,/.test(mo));
ok('the Elder is Arlen, drawn from his own still (no alias to Vermillion)', game.includes("  vigil_vermillion: { name:'Elder Arlen',") && !game.includes("  vigil_vermillion: 'young_bloodthirsty_vermillion',") && existsSync(path.join(ROOT, 'Sprites/monsters/vigil_vermillion.webp')) && game.includes('Elder Arlen walks the Reflection!'));
ok('Taiger swings his own violet lightning slash (swing art + its frame set + its path)', existsSync(path.join(ROOT, 'Sprites/fx/swing_taiger.webp')) && existsSync(path.join(ROOT, 'Sprites/fx/anim/swing_taiger_8.webp')) && game.includes('  taiger: ["PATH",'));
// the outline: the dark band at the silhouette edge, median width, scaled to the drawn size
const def = (k) => { const m = game.match(new RegExp('^  ' + k + ': +\\{ name:\'([^\']+)\', +w:(\\d+), h:(\\d+)', 'm')); return m && { name: m[1], w: +m[2], h: +m[3] }; };
const scale = (k) => +(mo.match(new RegExp('"' + k + '": (0\\.[0-9]+),')) || [])[1];
const widths = {};
for (const k of NEW) { const { data: d, info } = await sharp(path.join(ROOT, `Sprites/monsters/${k}.webp`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); const W = info.width, H = info.height;
  // the SOLID ink (alpha >= 128 - the anti-aliased fringe is not line) from the outside to the first colour, only where that band
  // is a line and not a dark costume (a hood or cloak runs 30+ canvas px deep)
  const dark = (q) => d[q * 4 + 3] >= 128 && Math.max(d[q * 4], d[q * 4 + 1], d[q * 4 + 2]) < 52, colour = (q) => d[q * 4 + 3] >= 128 && !dark(q);
  const D = new Int16Array(W * H).fill(-1); const st = []; for (let q = 0; q < W * H; q++) if (d[q * 4 + 3] < 128) { D[q] = 0; st.push(q); }
  for (let h = 0; h < st.length; h++) { const p = st[h]; if (D[p] >= 40) continue; const x = p % W, y = (p / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const qq = yy * W + xx; if (D[qq] >= 0 || !dark(qq)) continue; D[qq] = D[p] + 1; st.push(qq); } }
  const hist = []; for (let q = 0; q < W * H; q++) if (D[q] > 0) { const x = q % W, y = (q / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && colour(yy * W + xx)) { hist.push(D[q]); break; } } }
  const band = hist.filter((v) => v <= 30).sort((a, b) => a - b); const med = band[Math.floor(band.length / 2)]; const dv = def(k); const drawH = dv.h * 1.5 * Math.max(0.85, Math.min(1.2, Math.max(W, H) / 768)) * scale(k);   // the game's sizeFactor
  widths[k] = +(med * drawH / H).toFixed(2); }
// v0.30.1559 per user, size-aware: 1.62 x sqrt(size / median size), size = sqrt(w*h) of the hitbox rows, clamped 1.0-2.34
const _sz = [...hb.matchAll(/(\w+):\{w:(\d+),h:(\d+),mul:/g)].map((r) => Math.sqrt(+r[2] * +r[3])).sort((a, b) => a - b), _med = _sz[_sz.length >> 1];
const olWant = {}; for (const k of NEW) { const dv = def(k); olWant[k] = +Math.min(2.34, Math.max(1, 1.62 * Math.sqrt(Math.sqrt(dv.w * dv.h) / _med))).toFixed(2); }
ok('each still\'s outer outline draws its size-aware weight in game (solid-ink median within 20%)', NEW.every((k) => Math.abs(widths[k] / olWant[k] - 1) <= 0.2), { widths, olWant });
const q = (id) => { const i = game.indexOf('\n  ' + id + ': {'); return game.slice(i, game.indexOf('\n  },', i)); };
ok('Lyra\'s chapters I-II hunt Harea; chapter IV hunts Taiger and Lady Honk (with Willeo)', /target: 'harea', count: 100/.test(q('q_lyra_loan')) && /target: 'harea', count: 200/.test(q('q_lyra_tear')) && /target: 'taiger',/.test(q('q_lyra_kin')) && /\{ target: 'lady_honk', +count: 100 \}/.test(q('q_lyra_kin')));
ok('and their prose names the new keeper and the new copies', /Hera.'s starry robe/.test(q('q_lyra_tear')) && /Taiga, Lady Hong and Will stood in its mouth/.test(q('q_lyra_kin')) && /teacher.'s reflection holds a door/.test(q('q_kindest_hand')));
// ---- in game
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT }); await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [], bad = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
page.on('response', (r) => { if (r.status() >= 400 && /taiger|harea|lady_honk|deranged_kuro|future_lyra|potato_uncle/.test(r.url())) bad.push(r.status() + ' ' + r.url().split('/').slice(-2).join('/')); });
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof loadMap === 'function' && typeof monsterTypes === 'object', null, { timeout: 180000 }); await page.waitForTimeout(5000);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    try { window._perfTick = () => {}; } catch (e) {} player.level = 45; player._god = true; game.paused = false;
    const out = { maps: {}, draw: {}, old: ['future_lyra', 'potato_uncle'].filter((k) => monsterTypes[k]) };
    for (const id of ['distortedThreshold', 'fracturedReflection']) { loadMap(id); await sleep(2500); const c = {}; for (const m of game.monsters) c[m.type] = (c[m.type] || 0) + 1; out.maps[id] = c; }
    { const e = spawnMonster(player.x + 300, player.y - 10, 'vigil_vermillion', false, true); out.elder = e ? e.name : null; if (e) { e.speed = 0; e.atk = 0; }
      out.track = (typeof _lxQuestLocateLine === 'function') ? _lxQuestLocateLine('q_lyra_cut') : ''; }   // the Elder's name in the fight and in the tracker
    // each new type drawn: the still, at its box's size (m._visH = h * 1.5 * scale)
    for (const k of ['taiger', 'harea', 'lady_honk']) { const m = spawnMonster(player.x + 160, player.y - 10, k, false); if (m) { m.speed = 0; m.frozen = 99999; }   // beside the hero, so it is drawn
      const t0 = performance.now(); while (!(MONSTER_SPRITES[k] && MONSTER_SPRITES[k].naturalWidth) && performance.now() - t0 < 15000) await sleep(200); await sleep(600);
      out.draw[k] = { still: !!(MONSTER_SPRITES[k] && MONSTER_SPRITES[k].naturalWidth), visH: Math.round(m._visH || 0), want: Math.round(m.h * 1.5 * Math.max(0.85, Math.min(1.2, Math.max(MONSTER_SPRITES[k].naturalWidth, MONSTER_SPRITES[k].naturalHeight) / 768)) * _lxMobScale(k)),
        fig: (() => { const b = (LX_SPRITE_BBOX['monsters/' + k + '.webp'] || '').split(',').map(Number); return b.length === 4 ? Math.round((m._visH || 0) * (b[1] - b[0]) / b[3]) : 0; })(), w: m.w, h: m.h, name: m.name }; }
    return out;
  });
  console.log('rosters:', JSON.stringify(R.maps), ' draws:', JSON.stringify(R.draw));
  ok('the old types are gone from the running game', !R.old.length, R.old);
  ok('the Threshold spawns only Kuro and Young Vermillion; the Fractured Reflection spawns the four captains\' copies, Kuro and Vermillion', Object.keys(R.maps.distortedThreshold).sort().join() === 'deranged_kuro,young_bloodthirsty_vermillion' &&
    ['harea', 'lady_honk', 'willeo', 'taiger', 'deranged_kuro', 'young_bloodthirsty_vermillion'].every((k) => R.maps.fracturedReflection[k] > 0), R.maps);
  ok('the Elder spawns as Elder Arlen (never Elder Elder) and the quest tracker names him', /(^|\s)Elder Arlen$/.test(R.elder || '') && !/Elder Elder/.test(R.elder) && R.track.includes('Elder Arlen'), { elder: R.elder, track: R.track });
  ok('each new monster draws its still by the game\'s size rule, the figure as tall as its box', Object.values(R.draw).every((d) => d.still && d.visH > 0 && Math.abs(d.visH - d.want) <= 1 && Math.abs(d.fig - d.h) <= 3), R.draw);
  ok('no request for a missing frame, still or sound of the new or old three', !bad.length, bad.slice(0, 5));
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 300)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
