// KING KROOK NO LONGER DOES THE ROYAL CHARGE / ROYAL MARCH, AND ITS WARNING LANE IS GONE (per user: "Can we remove that attack and that warning sprite").
// His phase-2 signature (internally 'shellSpin': a 700 ms warning, a march to the wall, then dizzy) and its lane sprite (tg_dash_kingKrook) are removed; his other patterns and Legosaurus's lane stay.
//   art    : no tg_dash_kingKrook still or frame on disk, none in the frame index / asset list / edge table, none registered in the game; Legosaurus's lane is still served
//   code   : the march-speed constant is gone and no lane zone is ever built for him
//   live   : in a 50 s phase-2 fight with every special off cooldown he never enters 'shellSpin', still throws his other specials, and the arena draws no lane for him
//   node scripts/krook_no_royal_charge_test.mjs [port]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync, readFileSync } from 'node:fs';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'package.json')); const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || process.env.PORT || 10401);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 420) : '')); };
const files = ['Sprites/fx/tg_dash_kingKrook.webp', ...Array.from({ length: 9 }, (_, i) => 'Sprites/fx/anim/tg_dash_kingKrook_' + i + '.webp')];
ok('no tg_dash_kingKrook still or frame is left on disk', files.every((f) => !existsSync(path.join(ROOT, f))), files.filter((f) => existsSync(path.join(ROOT, f))));
const idx = readFileSync(path.join(ROOT, 'data/sprite_frame_index.js'), 'utf8'), man = readFileSync(path.join(ROOT, 'data/assets_manifest.json'), 'utf8'), edg = readFileSync(path.join(ROOT, 'data/sprite_edges.js'), 'utf8');
ok('and none is in the frame index, the asset list or the edge table', !/tg_dash_kingKrook/.test(idx) && !/tg_dash_kingKrook/.test(man) && !/tg_dash_kingKrook/.test(edg), { idx: /tg_dash_kingKrook/.test(idx), man: /tg_dash_kingKrook/.test(man), edg: /tg_dash_kingKrook/.test(edg) });
ok('Legosaurus\'s own lane art is untouched (still, nine frames in the index, in the asset list)', existsSync(path.join(ROOT, 'Sprites/fx/tg_dash_legosaurus.webp')) && /"tg_dash_legosaurus": 9/.test(idx) && /tg_dash_legosaurus_8\.webp/.test(man), {});
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT }); await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [], miss = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  page.on('response', (r) => { if (r.status() >= 400 && /tg_dash_/.test(r.url())) miss.push(r.url().replace(/^.*Sprites\//, '')); });
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function' && typeof _lxAttackZones === 'function', null, { timeout: 180000 }); await page.waitForTimeout(3000);
  const R = await page.evaluate(async () => {
    const W8 = (ms) => new Promise((r) => setTimeout(r, ms)), frame = () => new Promise((r) => requestAnimationFrame(r));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu', 'story-beat-overlay']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._tutorialSeen = true; window._perfTick = () => {}; applyClass('warrior'); player.level = 99; player._god = true; player.invulnerable = 9e9; player.maxHp = player.hp = 9e9; player._gravitosCineSeen = true;
    const out = { reg: !!LX_FX.tg_dash_kingKrook, animKey: _FX_ANIM_KEYS.has('tg_dash_kingKrook'), marchVx: typeof LX_KROOK_MARCH_VX, lego: !!LX_FX.tg_dash_legosaurus, legoKey: _FX_ANIM_KEYS.has('tg_dash_legosaurus') };
    loadMap('krookThrone', 300); await W8(3500); game.paused = false; for (const id of ['story-beat-overlay', 'boss-intro-overlay', 'dialog']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    const m = game.monsters.find((x) => x && x.type === 'kingKrook'); if (!m) return { ...out, err: 'no Krook' }; m._introDone = true; m.aggroTarget = player; m.currentHp = m.maxHp * 0.4;
    const seen = {}; let lane = 0, t0 = performance.now();
    while (performance.now() - t0 < 50000) { await frame(); if (!game.monsters.includes(m)) break;
      m._bossPhase2 = true; m.currentHp = m.maxHp * 0.4; m._lastShellAt = 0; m._lastMegaAt = 0; m._lastFirebombAt = 0; m._stagger = 0; m._staggerCd = 1e12; player.hp = player.maxHp; player.x = Math.max(60, m.x - 520); player.y = m.y + m.h - player.h; player.vx = 0;
      for (const id of ['story-beat-overlay', 'boss-intro-overlay', 'dialog']) { const el = document.getElementById(id); if (el && el.style.display !== 'none') el.style.display = 'none'; }
      const ps = m.patternState || 'idle'; seen[ps] = (seen[ps] || 0) + 1;
      if (frame.n === undefined) frame.n = 0; if ((++frame.n % 6) === 0) lane += (_lxAttackZones() || []).filter((z) => z && z.kind === 'dash' && /kingKrook/.test(z.tg || '')).length; }
    out.seen = seen; out.lane = lane; return out;
  });
  ok('the game registers no tg_dash_kingKrook and has no march-speed constant (Legosaurus\'s lane stays registered and animated)', !R.reg && !R.animKey && R.marchVx === 'undefined' && R.lego && R.legoKey, { reg: R.reg, animKey: R.animKey, marchVx: R.marchVx, lego: R.lego, legoKey: R.legoKey });
  ok('live: in 50 s of phase 2 with every special off cooldown he never enters shellSpin', !R.err && !(R.seen && R.seen.shellSpin), R.seen || R.err);
  const others = ['megaFireball', 'firebomb', 'earthquake', 'fireballRain', 'stomp', 'fireBreath', 'jumpSlam', 'claw'].filter((k) => R.seen && R.seen[k]);
  ok('...and he still fights: at least two of his other patterns ran', others.length >= 2, { others });
  ok('no dash lane is ever built for him', R.lane === 0, { lane: R.lane });
  ok('no tg_dash_ file 404s', miss.length === 0, miss);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 400)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
