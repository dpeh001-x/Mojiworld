// REFLECTED DAMAGE SHOWS IT (v0.30.1854, per user: "For damage reflection dealt to monsters have a visual sprite indicator that the
// damage done was due to damage reflection"). A number a reflection dealt carries d.refl and is drawn with LX_FX.reflect_badge.
//   1. the badge sprite loads (Sprites/fx/reflect_badge.webp, eager)
//   2. a Thorns reflect, a Knight Guardian reflect (the share AND the ATK retaliation) and a Holy Shield bounce each put up numbers
//      marked refl, and no "↩ N" text line any more
//   3. an ordinary hit is not marked
//   4. the badge is drawn while a reflected number lives - left of the number, about its size - and never for an ordinary one
//   5. no page errors
//   node scripts/reflect_badge_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11903), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 5000));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof _lxContactLanding === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player._tutorialSeen = true; player._gravitosCineSeen = true; window._lxAutoPause = () => {};
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    await sleep(3000); player.level = 40; player._god = false; loadMap('forest', 300); await sleep(2500);
    for (const el of document.querySelectorAll('[id$="-cine"], #story-beat-overlay, #void-intro-overlay')) { el.classList.remove('on', 'show'); el.style.display = 'none'; }
    game.paused = false; try { closeAllModals(); } catch (e) {}
    const img = LX_FX.reflect_badge; for (let i = 0; i < 40 && !(img && img.complete && img.naturalWidth); i++) await sleep(100);
    out.img = img ? { src: img.src.split('/').slice(-2).join('/'), w: img.naturalWidth, ready: _lxFxReady(img) } : null;
    // every badge draw, with where it lands relative to the number (device space via getTransform)
    const draws = []; const _di = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (im) { if (im === LX_FX.reflect_badge) draws.push({ dx: arguments[1], dw: arguments[3], dh: arguments[4], t: game.time }); return _di.apply(this, arguments); };
    const foe = () => { for (const m of [...game.monsters]) { const i = game.monsters.indexOf(m); if (i >= 0) game.monsters.splice(i, 1); }
      const m = spawnMonster(player.x + 120, player.y - 20, 'slime', false); m.maxHp = m.currentHp = 1e9; m.def = 0; m.evasion = 0; return m; };
    const run = async (label, fn) => { game.damageNumbers.length = 0; const m = foe(); fn(m); const nums = game.damageNumbers.map((d) => ({ text: String(d.text), refl: !!d.refl }));
      await sleep(250); return { nums }; };
    player.hp = player.maxHp;
    player.mods.thorns = 0.5;
    out.thorns = await run('thorns', (m) => _lxContactLanding(m, 200, 200, 200));
    player.mods.thorns = 0;
    player._guardianReflect = game.time + 600; player._guardianReflectPct = 50; player._guardianReflectAtk = 10;
    out.guardian = await run('guardian', (m) => _lxContactLanding(m, 200, 200, 200));
    player._guardianReflect = 0;
    out.holy = await run('holy', (m) => _lxContactHolyBounce(m));
    draws.length = 0;
    out.plain = await run('plain', (m) => hitMonster(m, 150, false));
    await sleep(600); out.plainDraws = draws.length;
    // a live reflected number: the badge draws, left of the number and about its size
    game.damageNumbers.length = 0; draws.length = 0; player.mods.thorns = 0.5;
    const m = foe(); _lxContactLanding(m, 200, 200, 200); player.mods.thorns = 0;
    const d = game.damageNumbers.find((q) => q.refl); await sleep(500);
    out.live = { draws: draws.length, sample: draws.slice(-1)[0] || null, size: d ? (d.size || 14) : null };
    await sleep(1500); const n0 = draws.length; await sleep(500); out.after = { alive: game.damageNumbers.filter((q) => q.refl).length, more: draws.length - n0 };
    CanvasRenderingContext2D.prototype.drawImage = _di;
    return out;
  });
  ok('1. the reflect badge sprite loads (Sprites/fx/reflect_badge.webp)', R.img && R.img.ready && R.img.w > 0 && R.img.src === 'fx/reflect_badge.webp', R.img);
  const arrowLine = (r) => r.nums.some((n) => n.text.includes('\u21a9'));
  ok('2a. a Thorns reflect: its number is marked reflected, no "↩" line', R.thorns.nums.some((n) => n.refl) && !arrowLine(R.thorns), R.thorns.nums);
  ok('2b. a Guardian reflect: the share and the ATK retaliation are both marked, no "↩" line', R.guardian.nums.filter((n) => n.refl).length >= 2 && !arrowLine(R.guardian), R.guardian.nums);
  ok('2c. a Holy Shield bounce: its number is marked, no "↩" line', R.holy.nums.some((n) => n.refl) && !arrowLine(R.holy), R.holy.nums);
  ok('3. an ordinary hit is not marked, and draws no badge', R.plain.nums.length >= 1 && R.plain.nums.every((n) => !n.refl) && R.plainDraws === 0, { nums: R.plain.nums, draws: R.plainDraws });
  const s = R.live.sample;
  ok('4a. the badge draws while a reflected number lives', R.live.draws >= 5, R.live.draws);
  // drawn in the number's own transform: x is relative to the number's centre, so the whole badge sits at negative x
  ok('4b. it sits left of its number (wholly left of the centre) and about the number\'s size', s && s.dx < 0 && s.dx + s.dw < 0 && s.dw === s.dh && s.dw >= R.live.size && s.dw <= (R.live.size + 4) * 2, { dx: s && Math.round(s.dx), w: s && Math.round(s.dw), size: R.live.size });
  ok('4c. once the number is gone the badge stops', R.after.alive === 0 && R.after.more === 0, R.after);
  ok('5. no page errors', errs.length === 0, errs);
} finally { await browser.close(); server.kill(); }
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
