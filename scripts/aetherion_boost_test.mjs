// AETHERION, BOOSTED (per user: "a significant boost with skills from distorted mira, he is too easy to conquer, stats wise require
// a boost too" + "powerful brand new attacks and skills"). Drives the live boss in his Sanctum:
//   1. stats: HP 9,554,006 / ATK 13,918 off the table, speed 1.2, the Twin Verdict swing + echo on his row, 25% shorter gaps
//   2. the chooser: Scale Spiral only in form 1, Halo Discs and the Gate only once evolved (read off the weights he picks from)
//   3. Fallen Feathers: 5 (7 under 25%), flung on separate beats, homing, a wide fan; Scale Spiral: 36 darts on 3 arms
//   4. Halo Discs: three go OUT past 200 px, turn, and are caught back at him
//   5. the Gate's Question: three safe spots on real surfaces, and a mortal player standing in one lives through it
//   6. his columns floor at 20% of max HP even when armour absorbs 99%; the swing fires, then its echo
//   node scripts/aetherion_boost_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 9812);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(9000);
  await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
  await page.fill('#hero-name-input', 'Tear');
  await page.evaluate(() => { const m = document.getElementById('class-select-modal'); for (const el of m.querySelectorAll('button,div,li')) { if (el.children.length > 3) continue; if (getComputedStyle(el).display === 'none') continue; if (/warrior/i.test(el.textContent || '')) { el.click(); break; } } });
  await page.click('#cs-nav-next').catch(() => {});
  await page.waitForTimeout(2500);
  await page.evaluate(() => { player._storyBeatsSeen = player._storyBeatsSeen || {}; if (typeof STORY_BEATS === 'object') for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true; });
  await page.evaluate(() => { player.level = 80; player.maxHp = 20000; loadMap('sanctum', 300); });
  await page.waitForTimeout(9000);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((z) => setTimeout(z, ms));
    const frames = async (n) => { const t0 = game.time; const d = Date.now() + 20000; while (game.time - t0 < n && Date.now() < d) await sleep(4); };
    for (const id of ['story-beat-overlay', 'boss-intro', 'boss-intro-card']) { const e = document.getElementById(id); if (e) { e.classList.remove('on'); e.style.display = 'none'; } }
    try { _lxCineHold(0); } catch (e) {}
    game.paused = false; player._god = true;
    const m = game.monsters.find((x) => x && x.type === 'aetherion'); if (!m) return { err: 'no aetherion (map ' + game.currentMap + ')' };
    const out = {};
    const row = (LX_MONSTER_STATS || {}).aetherion || {};
    out.stats = { hp: m.maxHp, atk: m.atk, tHp: row.hp, tAtk: row.atk, tDef: row.def, speed: monsterTypes.aetherion.speed, bm: m.traits && m.traits.bigMelee && m.traits.bigMelee.kind, echo: m.traits && m.traits.echoStrike, gap: _AE_GAP_MS.slice() };
    const hold = (dx) => { m._stagger = 0; m._dirOpenT = 0; m._dirFleeT = 0; player.x = m.x + m.w / 2 + dx - player.w / 2; player.vx = 0; };
    // his AI wakes once the intro lets go: wait for its state before touching it
    for (let i = 0; i < 900 && !m._ae; i++) { for (const id of ['boss-intro', 'boss-intro-card']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; } game.paused = false; hold(380); await frames(1); }
    if (!m._ae) return { err: 'his AI never ticked (no m._ae)' };
    const setForm = (evolved, hp) => { m._aetherionEvolved = evolved; if (evolved) m._phaseSprite = 'aetherion2'; m.currentHp = m.maxHp * hp; };
    // force one move and collect his shots as they are pushed
    const force1 = async (move, n, dx) => {
      game.projectiles.length = 0; game.hazards.length = 0; hold(dx || 380); await frames(2);
      const A = m._ae; A.st = move; A.t = 0; A.vol = 0; A.gate = false; A.gateUntil = 0; m._bigMeleeCd = 1e9;
      const shots = []; const _push = game.projectiles.push;
      game.projectiles.push = function (...ps) { for (const p of ps) if (p && p._srcType === 'aetherion') shots.push({ p, t: game.time, a: Math.atan2(p.vy, p.vx) }); return _push.apply(this, ps); };
      try { for (let i = 0; i < n; i++) { hold(dx || 380); if (m._ae.st !== move) break; await frames(1); } } finally { game.projectiles.push = _push; }
      return shots;
    };
    // v0.30.1727: a move broken off before it fired (a punish window the test's own phase jumps can open) is forced again, up to 3 tries
    const force = async (move, n, dx) => { let s = []; for (let k = 0; k < 3; k++) { s = await force1(move, n, dx); if (s.length || move === 'gateWind') break; } return s; };
    // 2. the chooser
    const lists = []; const _ch = window._aeChoose;
    window._aeChoose = function (opts) { lists.push({ ev: !!m._aetherionEvolved, w: Object.fromEntries(opts.map((o) => [o.s, o.w])) }); return _ch(opts); };
    try {
      setForm(false, 0.9); m._ae.st = 'idle'; for (let i = 0; i < 900; i++) { hold(300); m._bigMeleeCd = 1e9; await frames(1); }
      setForm(true, 0.4); m._ae.st = 'idle'; m._ae.cd = {}; for (let i = 0; i < 900; i++) { hold(300); m._bigMeleeCd = 1e9; await frames(1); }
    } finally { window._aeChoose = _ch; }
    const f1 = lists.filter((l) => !l.ev), f2 = lists.filter((l) => l.ev);
    out.chooser = { n1: f1.length, n2: f2.length, spiral1: f1.some((l) => l.w.spiralWind > 0), spiral2: f2.some((l) => l.w.spiralWind > 0),
      halo1: f1.some((l) => l.w.haloWind > 0), gate1: f1.some((l) => l.w.gateWind > 0), halo2: f2.some((l) => l.w.haloWind > 0), gate2: f2.some((l) => l.w.gateWind > 0), feather: lists.some((l) => l.w.featherWind > 0) };
    // 6. a column against armour that absorbs 99% (the swing and its echo follow the halo; the Gate goes last)
    // one of his own columns (_aeColumn) dropped on the player for 1 raw damage - what armour leaves of a hit - must still land
    // for 20% of max HP. He is parked far off with every move on cooldown, so nothing else of his can be what hit.
    {
      setForm(false, 0.9); game.projectiles.length = 0; game.hazards.length = 0; m._ae.st = 'idle'; m._ae.t = 0;
      m._ae.cd = { feather: 1e9, spiral: 1e9, halo: 1e9, gate: 1e9, echo: 1e9, skybreak: 1e9, astral: 1e9 }; m._bigMeleeCd = 1e9;
      player._god = false; player.hp = getMaxHp(); player.invulnerable = 0; const hp0 = player.hp, pcx = player.x + player.w / 2;
      _aeColumn(pcx, 96, 30, 1, "Aetherion's Shardfall", 0, '#ffffff');
      const ww = game.mapData.worldWidth || 2000, parkX = pcx > ww / 2 ? 40 : ww - m.w - 40;   // the far side, clear of the player
      for (let i = 0; i < 90 && player.hp === hp0; i++) { m._ae.st = 'idle'; m._ae.t = 0; m.x = parkX; m.vx = 0; player.x = pcx - player.w / 2; player.vx = 0; await frames(1); }
      out.column = { lost: hp0 - player.hp, floor: Math.floor(getMaxHp() * 0.2), src: player._lastDamageSource || '' };
      player._god = true; player.hp = getMaxHp();
    }
    // 3. feathers, spiral
    setForm(false, 0.9); let s = await force('featherWind', 90);
    out.feather = { n: s.length, kinds: [...new Set(s.map((x) => x.p.skill))], beats: new Set(s.map((x) => x.t)).size, homing: s.every((x) => x.p.homing), fan: s.length ? Math.max(...s.map((x) => x.a)) - Math.min(...s.map((x) => x.a)) : 0 };
    // v0.30.1727: let the drop under 25% settle first - crossing it can open a punish window that breaks off a move forced at once
    setForm(true, 0.2); for (let i = 0; i < 40; i++) { hold(380); m._ae.st = 'idle'; m._ae.t = 0; await frames(1); } s = await force('featherWind', 90); out.feather3 = s.length;
    setForm(false, 0.9); s = await force('spiralWind', 140);
    out.spiral = { n: s.length, kinds: [...new Set(s.map((x) => x.p.skill))], beats: new Set(s.map((x) => x.t)).size };
    // 4. halo discs: out, then home
    // the player is untouchable here: a disc that hits you is spent (that is the game), and this checks the whole flight
    player.invulnerable = 1e9; setForm(true, 0.4); s = await force('haloWind', 60, 420);
    const discs = s.map((x) => x.p), far = discs.map(() => 0), back = discs.map(() => false);
    for (let i = 0; i < 300 && discs.some((p) => p.life > 0); i++) {
      hold(900); m.x = Math.max(60, Math.min(m.x, 1500)); player.invulnerable = 1e9; await frames(1);
      discs.forEach((p, k) => { if (p.life <= 0) return; const d = Math.hypot(p.x + p.w / 2 - (m.x + m.w / 2), p.y + p.h / 2 - (m.y + m.h * 0.3)); if (d > far[k]) far[k] = d; else if (far[k] > 200 && d < far[k] - 100) back[k] = true; });
    }
    player.invulnerable = 0;
    out.halo = { n: discs.length, kind: discs[0] && discs[0].skill, far: far.map(Math.round), back, caught: discs.every((p) => p.life <= 0), left: discs.filter((p) => p.life > 0).map((p) => ({ age: p._aeHaloAge, life: p.life, x: Math.round(p.x), y: Math.round(p.y), vx: +p.vx.toFixed(2), vy: +p.vy.toFixed(2), bx: Math.round(m.x + m.w / 2), by: Math.round(m.y + m.h * 0.3) })) };
    game.projectiles.length = 0; game.hazards.length = 0; m._ae.st = 'idle'; m._ae.cd = { feather: 1e9, spiral: 1e9, halo: 1e9, gate: 1e9, echo: 1e9, skybreak: 1e9, astral: 1e9 };
    const sw = []; const _p2 = game.projectiles.push;
    game.projectiles.push = function (...ps) { for (const p of ps) if (p && p._swingType === 'aetherion') sw.push({ t: game.time, echo: /echo/.test(p._sourceLabel || '') }); return _p2.apply(this, ps); };
    const gY = ((game.mapData.platforms || []).find((p) => p.type === 'ground') || { y: m.y + m.h }).y;
    try { m._bigMeleeCd = 0; for (let i = 0; i < 360 && sw.filter((x) => x.echo).length === 0; i++) { hold(m.facing >= 0 ? 170 : -170); player.y = gY - player.h; player.vy = 0; m._ae.st = 'idle'; m._ae.t = 0; await frames(1); } } finally { game.projectiles.push = _p2; }
    out.swing = { swings: sw.filter((x) => !x.echo).length, echoes: sw.filter((x) => x.echo).length };
    game.projectiles.length = 0; game.hazards.length = 0;
    // v0.30.1727 aetherion-feet: form 2's feet on the floor. Capture the form-2 rest sprites he draws, redraw each ALONE through
    // _drawBossSprite on a flat green canvas, and read every foot's lowest row against the foot line: the bottom profile within 40 px
    // of it, split into runs >= 8 px wide (a foot each). worst = the highest foot (+ = over the line). The old build read 0 here for the
    // back foot while it hovered ~3 px in the real draw, so a foot must reach 2 px INTO the floor.
    {
      setForm(true, 0.4); m._phaseSprite = 'aetherion2'; game.projectiles.length = 0; game.hazards.length = 0;
      const caps = new Map(), orig = window._drawBossSprite;
      window._drawBossSprite = function (sprite, mm, sx, sy, isAtk, anim) { if (mm === m && sprite && !isAtk) { const k = sprite.src || sprite; if (!caps.has(k)) caps.set(k, { sprite, anim }); } return orig.apply(this, arguments); };
      try { for (let i = 0; i < 150; i++) { hold(380); m._ae.st = 'idle'; m._ae.t = 0; m.vx = 0; m.speed = 0; await frames(1); } } finally { window._drawBossSprite = orig; }
      const cv = document.querySelector('canvas'), c2 = cv.getContext('2d'), W = cv.width, H = cv.height;
      game.paused = true; await sleep(50);
      const sx = Math.round(W / 2 - m.w / 2), sy = Math.round(H - 160 - m.h), lineY = sy + m.h; let worst = -1e9, n = 0; const per = [];
      for (const [, c] of caps) {
        c2.save(); c2.setTransform(1, 0, 0, 1, 0, 0); c2.fillStyle = '#00ff00'; c2.fillRect(0, 0, W, H);
        try { orig(c.sprite, m, sx, sy, false, c.anim); } catch (e) { c2.restore(); continue; }
        c2.restore();
        const d = c2.getImageData(0, 0, W, H).data, prof = [];
        for (let x = 0; x < W; x++) { let b = -1; for (let y = Math.min(H - 1, lineY + 30); y >= lineY - 40; y--) { const k = (y * W + x) * 4; if (d[k] + Math.abs(d[k + 1] - 255) + d[k + 2] > 90) { b = y; break; } } prof.push(b); }
        const runs = []; let cur = null, gap = 0;
        for (let x = 0; x < W; x++) { if (prof[x] >= 0) { if (!cur) cur = { x0: x, x1: x, low: prof[x] }; else { cur.x1 = x; cur.low = Math.max(cur.low, prof[x]); } gap = 0; } else if (cur && ++gap >= 6) { runs.push(cur); cur = null; gap = 0; } }
        if (cur) runs.push(cur);
        const feet = runs.filter((r) => r.x1 - r.x0 >= 8); if (!feet.length) continue;
        const f = Math.max(...feet.map((r) => lineY - 1 - r.low)); per.push(f); worst = Math.max(worst, f); n++;
      }
      game.paused = false;
      out.feet = { n, worst, per: per.slice(0, 12) };
    }
    // last: the Gate (nothing after it can be hit by its collapse)
    // 5. the Gate: stand in its first safe spot, mortal
    setForm(true, 0.4); m._ae.cd.gate = game.time + 1e9;   // one Gate: a second one cast after it would land in a later check
    // v0.30.1735 boss-polish: 90% -> 40% crosses his 50% form change, whose own windows can break off a Gate forced at once (no hazard at all, one run in four): let it settle, and force again if it was broken off
    for (let i = 0; i < 60; i++) { hold(380); m._ae.st = 'idle'; m._ae.t = 0; await frames(1); }
    for (let k = 0; k < 3 && !game.hazards.some((h) => h && h.type === 'gravitos_singularity'); k++) await force('gateWind', 50);
    const gate = game.hazards.find((h) => h && h.type === 'gravitos_singularity');
    const plats = (game.mapData.platforms || []).map((p) => p.y);
    out.gate = gate ? { label: gate._sourceLabel, life: gate.life, zones: gate.safeZones.length, onSurface: gate.safeZones.every((z) => plats.includes(z.y + z.h)), inWorld: gate.safeZones.every((z) => z.x >= 0 && z.x + z.w <= game.mapData.worldWidth), clearOfHim: gate.safeZones.every((z) => !(z.x < m.x + m.w + 60 && z.x + z.w > m.x - 60)) } : null;   // v0.30.1735 boss-polish
    if (gate) {
      const z = gate.safeZones[0]; player._god = false; player.hp = getMaxHp(); player.invulnerable = 0; let busy = 0; const drops = []; let lastHp = player.hp;
      for (let i = 0; i < 420 && gate.life > 0; i++) { player.x = z.x + z.w / 2 - player.w / 2; player.y = z.y + z.h - player.h; player.vx = 0; player.vy = 0; if (m._ae.st !== 'idle' && m._ae.st !== 'gateWind') busy++; await frames(1); if (player.hp !== lastHp) { drops.push([i, lastHp - player.hp, player._lastDamageSource]); lastHp = player.hp; } }
      await frames(4); out.gate.survived = player.hp > 0; out.gate.otherMoves = busy; out.gate.drops = drops.slice(0, 6); player._god = true; player.hp = getMaxHp();
    }
    return out;
  });
  if (R.err) ok('Aetherion spawned in his Sanctum', false, R.err);
  else {
    const S = R.stats;
    ok('stats: HP 9,554,006 and ATK 13,918 off his table row, spawned as such', S.tHp === 9554006 && S.tAtk === 13918 && S.tDef === 858 && S.hp === 9554006 && S.atk === 13918, S);
    ok('he walks at 1.2 (was 0.8) and pauses less between patterns (release18: 600 / 520 / 360 ms, were 980 / 710 / 490; release20: the evolved 360; v0.30.1770: 510)', S.speed === 1.2 && S.gap.join() === '0,600,510,360', S);
    ok("Distorted Mira's Twin Verdict is on his row: a heavy swing and its echo", S.bm === 'swing' && S.echo === 480, S);
    const C = R.chooser;
    ok('the chooser: Scale Spiral in form 1 only; Halo Discs and the Gate only once evolved; feathers in both', C.n1 > 0 && C.n2 > 0 && C.spiral1 && !C.spiral2 && !C.halo1 && !C.gate1 && C.halo2 && C.gate2 && C.feather, C);
    ok('Fallen Feathers: five homing feathers on separate beats, fanned wide (>= 100 deg)', R.feather.n === 5 && R.feather.kinds.join() === 'maefeather' && R.feather.beats >= 3 && R.feather.homing && R.feather.fan >= 1.75, R.feather);
    ok('...seven under 25%', R.feather3 === 7, R.feather3);
    ok('Scale Spiral: 36 darts on 3 arms over twelve beats', R.spiral.n === 36 && R.spiral.kinds.join() === 'maescale' && R.spiral.beats >= 10, R.spiral);
    ok('Halo Discs: three ring-blades go out past 200 px, turn back, and are caught at him', R.halo.n === 3 && R.halo.kind === 'maehalo' && R.halo.far.every((d) => d > 200) && R.halo.back.every(Boolean) && R.halo.caught, R.halo);
    ok("the Gate's Question: three safe spots, on real surfaces, inside the Sanctum", !!R.gate && R.gate.label === "Aetherion's Gate" && R.gate.zones === 3 && R.gate.onSurface && R.gate.inWorld && R.gate.clearOfHim, R.gate);
    ok('...a mortal player standing in a safe spot lives through it, and he starts nothing else while it is asked', !!R.gate && R.gate.survived && R.gate.otherMoves === 0, R.gate);
    ok('his columns land for at least 20% of max HP even when armour absorbs 99%', R.column.lost >= R.column.floor && R.column.floor > 0 && /Shardfall/.test(R.column.src), R.column);
    ok('the Twin Verdict swing fires, then its echo', R.swing.swings >= 1 && R.swing.echoes >= 1, R.swing);
  }
  if (!R.err) ok('form 2 stands on the floor: in every rest pose BOTH feet reach at least 2 px into the floor (the back foot used to hover over it)', !!R.feet && R.feet.n > 0 && R.feet.worst <= -2, R.feet);
  ok('no page errors', errs.length === 0, errs);
} finally { await browser.close(); server.kill(); }
let pass = 0;
console.log('\n=== AETHERION BOOST ===');
for (const t of results) { if (t.pass) pass++; console.log(`${t.pass ? 'PASS' : 'FAIL'}  ${t.n}  ${t.pass ? '' : String(JSON.stringify(t.x)).slice(0, 400)}`); }
console.log(`\n${pass}/${results.length} checks passed`);
process.exit(pass === results.length ? 0 : 1);
