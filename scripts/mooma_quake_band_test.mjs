// MOOMA'S QUAKE BAND LIES ON WHAT YOU STAND ON (per user: the line of fire "is kinda misleading ... regenerate the sprite to suit her
// theme and there should be an indication to jump", then "the quake sprite has to be on the floor / platforms strictly"). In her arena
// (Queen's Hollow), her quake windup frozen half way:
//   [1] her own band (tg_smash_mooma) is drawn, never the shared molten crack
//   [2] every piece lies ON a surface: its bottom is the surface top + 5 (the crack on the edge), and it stays within that surface's ends
//   [3] every ground piece and platform in view carries it - the ledges too, since her quake lands on anyone standing on anything
//   [4] the jump arrow (tg_jump_mooma) is drawn over the surfaces, never over her own body; a short piece shows part of the tile (cropped)
//   [5] King Krook's earthquake keeps the shared crack across the floor (unchanged)
//   node scripts/mooma_quake_band_test.mjs      PORT / MOJI_SERVE_ROOT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15391);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 500) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT }); await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, channel: EXE ? undefined : 'msedge', headless: true, args: ['--mute-audio', '--no-sandbox'] });
const errs = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?lxhold=0`, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _lxAttackZones === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(4000);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((z) => setTimeout(z, ms));
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootGateDone = true; } catch (e) {} window._prologueActive = false;
    applyClass('warrior'); player.level = 30; player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS || {})) player._storyBeatsSeen[k] = true;
    loadMap('boss', 300); await sleep(3000); try { _lxCineHold(0); } catch (e) {} game.paused = false;
    const m = game.monsters.find((x) => x && x.type === 'mooma'); if (!m) return { err: 'no mooma on ' + game.currentMap };
    player._god = true; player.invulnerable = 1e9;
    for (let i = 0; i < 80 && !(typeof LX_FX !== 'undefined' && LX_FX.tg_smash_mooma && _lxFxReady(LX_FX.tg_smash_mooma) && LX_FX.tg_jump_mooma && _lxFxReady(LX_FX.tg_jump_mooma)); i++) await sleep(100);
    player.x = m.x + m.w + 220; player.y = m.y + m.h - player.h; await sleep(600);
    game.paused = true;
    m.patternState = 'quake'; m.patternTimer = 600; m._quakeFired = false; m._quakeAnnounced = true; m.currentHp = m.maxHp;
    const Z = _lxAttackZones().filter((z) => z.kind === 'smash');
    const camX = game.camera.x, camY = game.camera.y || 0, vw = W, vh = H;
    const plats = (game.mapData.platforms || []).filter((p) => p && p.w > 0 && !(p.x > camX + vw + 40 || p.x + p.w < camX - 40 || p.y < camY - 60 || p.y > camY + vh + 60));
    const on = Z.map((z) => plats.some((p) => Math.abs(z.y + z.h - 5 - p.y) <= 1 && z.x >= p.x - 0.5 && z.x + z.w <= p.x + p.w + 0.5));
    const covered = plats.map((p) => Z.some((z) => Math.abs(z.y + z.h - 5 - p.y) <= 1 && z.x >= p.x - 0.5 && z.x + z.w <= p.x + p.w + 0.5));
    // one real draw of the zones, its drawImage calls recorded
    const band = LX_FX.tg_smash_mooma, arrow = LX_FX.tg_jump_mooma, calls = [];
    const orig = ctx.drawImage;
    ctx.drawImage = function (...a) { if (a[0] === band || a[0] === arrow) calls.push({ img: a[0] === band ? 'band' : 'arrow', n: a.length, x: a.length === 9 ? a[5] : a[1], w: a.length === 9 ? a[7] : a[3] }); return orig.apply(this, a); };
    try { _drawAttackZones(); } finally { ctx.drawImage = orig; }
    const mx0 = m.x - camX, mx1 = m.x + m.w - camX;
    const arrows = calls.filter((c) => c.img === 'arrow'), onBody = arrows.filter((c) => c.x + c.w / 2 > mx0 - 40 && c.x + c.w / 2 < mx1 + 40);
    const short = Z.filter((z) => z.cropF > 0 && z.cropF < 0.999).length;
    const out = { n: Z.length, tg: [...new Set(Z.map((z) => z.tg))], prog: Z.length ? +Z[0].prog.toFixed(2) : null, onAll: on.every(Boolean), offs: on.filter((x) => !x).length,
      plats: plats.length, coveredAll: covered.every(Boolean), arrows: arrows.length, onBody: onBody.length, short, cropped: calls.filter((c) => c.img === 'band' && c.n === 9).length };
    // King Krook's earthquake, same arena: the shared crack across the floor
    game.monsters.length = 0;
    spawnMonster(player.x + 200, player.y - 40, 'kingKrook', true, false); const k = game.monsters[game.monsters.length - 1];
    k.patternState = 'earthquake'; k.patternTimer = 300; k._kFired = false;
    const KZ = _lxAttackZones().filter((z) => z.kind === 'smash');
    out.krook = { n: KZ.length, tg: [...new Set(KZ.map((z) => z.tg))], y: KZ.length ? Math.round(KZ[0].y) : null, feet: Math.round(k.y + k.h - 42) };
    return out;
  });
  ok('[1] her quake draws her own band, never the shared molten crack', !R.err && R.n > 0 && R.tg.join() === 'tg_smash_mooma' && Math.abs(R.prog - 0.5) < 0.05, R);
  ok('[2] every piece lies on a surface (the crack on its top edge) and stays within its ends', R.n > 0 && R.onAll, { n: R.n, off: R.offs });
  ok('[3] every ground piece and platform in view carries it (the ledges too)', R.plats >= 3 && R.coveredAll, { plats: R.plats });
  ok('[4] jump arrows over the surfaces, none over her body; a short surface shows a cropped tile', R.arrows >= 2 && R.onBody === 0 && (R.short === 0 || R.cropped >= 1), { arrows: R.arrows, onBody: R.onBody, short: R.short, cropped: R.cropped });
  ok('[5] King Krook\'s earthquake never wears her band (his own since v0.30.1778: quake_bands_test)', R.krook && R.krook.n >= 1 && !R.krook.tg.includes('tg_smash_mooma'), R.krook);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
