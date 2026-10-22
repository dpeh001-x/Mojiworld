// Gravitos: the Singularity is strictly spaced and the boss lock can never trap you in a one-shot (v0.30.x gravitos-singularity-spacing).
//   node scripts/gravitos_singularity_spacing_test.mjs        (MOJI_GAME_FILE=<build.html> to test a private build; PORT, SEG, TURBO)
// Per user: "Gravitos at all forms does OHKO singularity attack way too quickly, there needs to be strict spacing, also need to strictly
// space with celestial lock if not players are unable to escape", then "minimum 30s at the last form, longer for the earlier forms".
// One REAL fight (gravitosArena, his own AI, his own hazards and his own lock) through forms 1, 2 and 3, the player killing each form as a
// player does, the boss's HP running down through its tiers in every form. The hero stands in lock range with no hit i-frames (the worst
// case for a lock), HP topped up every step; a harness death is absorbed (the death would wipe the arena). Everything is measured on the
// fight clock (game.time steps, 60 a second); extra sim-only steps per drawn frame (the game's own catch-up pass) speed it up.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11795';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const SEG = Number(process.env.SEG || 24000), TURBO = Number(process.env.TURBO || 5);
const GAP_S = { 1: 50, 2: 40, 3: 30 }, FIRST_S = 20;        // the user's minimums: Singularity cast -> next cast, by form; first cast into a fight / form
const ESCAPE_F = 280, SPEED = 2.1, PW = 28;                  // a lock's end -> the next one-shot warning (4.7 s); the slowest hero's walk, px per step
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const cache = new Map();   // fonts + data tables from origin: the shared working copy may hold another session's unshipped files
const fromOrigin = (rel) => { if (!cache.has(rel)) cache.set(rel, execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 26 })); return cache.get(rel); };
const s1 = (f) => +(f / 60).toFixed(1);
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/](assets[/]fonts[/].*[.]woff2|data[/][a-z_]+[.]js)$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (rel.endsWith('.woff2') && existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: rel.endsWith('.woff2') ? 'font/woff2' : 'text/javascript', body: fromOrigin(rel) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof bossAI === 'function' && typeof _qteShackleStart === 'function', null, { timeout: 150000 });
  await p.evaluate(() => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth', 'lo-menu']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'warrior'; player.level = 100; player._gravitosCineSeen = true;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    loadMap('gravitosArena'); game.paused = false;
  });
  await p.waitForFunction(() => game.monsters.some((m) => m && m.type === 'gravitos' && m.currentHp > 0), null, { timeout: 60000 });
  // ---- the fight: install the recorder, then run each form for SEG steps and kill it
  await p.evaluate(({ TURBO }) => {
    const m = game.monsters.find((x) => x && x.type === 'gravitos' && x.currentHp > 0); window.__m = m;
    const formOf = () => (m._gravitosPhase | 0) || 1, OH = ['singularity', 'collapseRain', 'soulDrain'];
    const R = window.__R = { ev: [], deaths: 0, ai: 0, hp: [0.99, 0.03], seg0: null, seg: 1 };
    window.triggerDeath = function () { R.deaths++; R.ev.push({ k: 'DEATH', g: game.time | 0, lock: !!_QTE.active }); player.hp = player.maxHp; player._downed = false; };
    if (TURBO > 0) { const oF = window._lxFrame; window._lxFrame = function (t) { oF(t); for (let k = 0; k < TURBO; k++) { if (game.paused || !window._lxBootGateDone || window.__hold) break; _lxSimAccumMs += _LX_SIM_STEP_MS; _lxSimOnly = true; try { loop(t); } finally { _lxSimOnly = false; } } }; }
    { const oU = window.updatePlayer; window.updatePlayer = function () { if (player.hp > 0 && player.hp < player.maxHp) player.hp = player.maxHp; return oU.apply(this, arguments); }; }   // a 0-HP step skips the lock's clock
    { const oL = window.loop; window.loop = function () { if (!(player.hp > 0)) { player.hp = player.maxHp; player._downed = false; } const g0 = game.time, r = oL.apply(this, arguments); if (game.time !== g0) { const C = (window.__C = window.__C || { st: 0, pa: 0, hs: 0, sm: 0, ph: 0, dead: 0 }); C.st++; if (game.paused) C.pa++; if (game.hitStop > 0) C.hs++; if ((game._slowmoFrames | 0) > 0) C.sm++; if (game._photoMode) C.ph++; if (!(player.hp > 0)) C.dead++; } return r; }; }   // the world only runs while the hero lives: a 0-HP step would freeze the boss while the fight clock runs
    { const oT = window._qteShackleTry; window._qteShackleTry = function (mm) { if (mm === m && !window.__hold) { player._god = false; if (mm._shackleTele != null && mm._shackleTele <= 20) player.invulnerable = 0; } return oT.apply(this, arguments); }; }   // the worst case: no hit i-frames on the step a lock lands (only then - a hero stripped of them every step is hit every step, and the hit-stop that follows would hold the world)
    const oS = window._qteShackleStart; window._qteShackleStart = function () { const was = _QTE.active, r = oS.apply(this, arguments); if (!was && _QTE.active) { R.ev.push({ k: 'LOCK', g: game.time | 0 }); R.locked = true; } return r; };
    const oE = window._qteEnd; window._qteEnd = function () { const was = _QTE.active, r = oE.apply(this, arguments); if (was && !_QTE.active && R.locked) { R.ev.push({ k: 'UNLOCK', g: game.time | 0 }); R.locked = false; } return r; };
    let lastWarn = null, lastState = m.patternState, lastForm = null; const seen = new Map();
    const oAI = window.bossAI;
    window.bossAI = function (mm) {
      const r = oAI.apply(this, arguments);
      if (mm !== m || window.__hold) return r;
      R.ai++; const g = game.time | 0;
      if (R.locked && !_QTE.active) { R.ev.push({ k: 'UNLOCK', g }); R.locked = false; }   // a lock cleared by any other path
      if (formOf() !== lastForm) { R.ev.push({ k: 'FORM', g, form: formOf() }); lastForm = formOf(); }
      if (m._ohkoWarnUntil != null && lastWarn == null) R.ev.push({ k: 'WARN', g, move: m._ohkoQueued || 'singularity', form: formOf() });
      lastWarn = m._ohkoWarnUntil;
      if (m.patternState !== lastState) { if (OH.includes(m.patternState)) R.ev.push({ k: 'CAST', g, move: m.patternState, form: formOf() }); if (OH.includes(lastState)) R.ev.push({ k: 'END', g, move: lastState }); lastState = m.patternState; }
      for (const h of game.hazards) if (h && h.type === 'gravitos_singularity' && !seen.has(h)) { seen.set(h, { g, l: h.life }); R.ev.push({ k: 'FIELD', g, life: h.life, zones: (h.safeZones || []).map((q) => [Math.round(q.x), Math.round(q.y), Math.round(q.w), Math.round(q.h)]) }); }
      for (const [h, q] of seen) if (!q.done) { if (h.life > 0 && game.hazards.includes(h)) { q.g = g; q.l = h.life; } else { q.done = true; R.ev.push({ k: 'RESOLVE', g: q.g + q.l }); } }
      return r;
    };
    // the hero fights at his side, in lock range (never moved while locked or while a one-shot is up); his HP runs down through its tiers
    let side = 1;
    const keep = () => {
      game.paused = false; for (const id of ['story-beat-overlay', 'boss-intro-overlay', 'everdawn-welcome-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
      if (!window.__hold && m.currentHp > 0 && game.monsters.includes(m)) {
        if (R.seg0 == null) R.seg0 = R.ai;
        const el = Math.min(1, (R.ai - R.seg0) / window.__SEG); m.currentHp = Math.max(2, Math.floor(m.maxHp * (R.hp[0] + (R.hp[1] - R.hp[0]) * el)));
        const busy = _QTE.active || m._ohkoWarnUntil != null || OH.includes(m.patternState) || game.hazards.some((h) => h && h.type === 'gravitos_singularity');
        if (!busy) { const ww = (game.mapData && game.mapData.worldWidth) || 2200, want = m.x + m.w / 2 + side * 170; if (Math.abs(player.x + player.w / 2 - want) > 120) { player.x = Math.max(60, Math.min(ww - 90, want - player.w / 2)); player.vx = 0; } if (Math.random() < 0.003) side = -side; }
      }
      requestAnimationFrame(keep);
    };
    requestAnimationFrame(keep);
  }, { TURBO });
  const t0 = Date.now();
  for (let form = 1; form <= 3; form++) {
    const res = await p.evaluate(async ({ SEG, form }) => {
      const W8 = (ms) => new Promise((s) => setTimeout(s, ms)), m = window.__m, R = window.__R;
      if (form > 1) {   // kill the form before it, as a player does: his ascension runs
        let tries = 0; while (((m._gravitosPhase | 0) || 1) < form && tries++ < 6) { m.evasion = 0; m._dying = false; m.currentHp = 1; hitMonster(m, 99999999, false, 'phys'); for (let k = 0; k < 40 && ((m._gravitosPhase | 0) || 1) < form; k++) await W8(100); }
      }
      window.__SEG = SEG; R.seg0 = null; const a0 = R.ai, w0 = performance.now(); let g0 = game.time | 0;
      while (R.ai - a0 < SEG && performance.now() - w0 < 900000) { await W8(250); if (!game.monsters.includes(m)) break; }
      return { form: (m._gravitosPhase | 0) || 1, ai: R.ai - a0, steps: (game.time | 0) - g0, wall: Math.round((performance.now() - w0) / 1000), alive: game.monsters.includes(m) };
    }, { SEG, form });
    console.log(`  form ${form}: ${JSON.stringify(res)}`);
  }
  const R = await p.evaluate(() => { window.__hold = true; return window.__R; });
  console.log('  steps: ' + JSON.stringify(await p.evaluate(() => window.__C))); console.log(`  fight: ${R.ai} AI steps in ${Math.round((Date.now() - t0) / 1000)} s wall, harness deaths absorbed ${R.deaths}`);

  // ---- analysis, per form
  const ev = R.ev, forms = ev.filter((e) => e.k === 'FORM');
  const worstReach = (zones) => { const g = zones.filter((z) => z[1] + z[3] >= 470).map((z) => [z[0], z[0] + z[2]]); let w = 0; for (let x = 20 + PW / 2; x <= 2200 - 20 - PW / 2; x += 4) { let b = Infinity; for (const [a, c] of g) b = Math.min(b, x < a ? a - x : x > c ? x - c : 0); w = Math.max(w, b); } return w; };
  const locks = []; { let cur = null; for (const e of ev) { if (e.k === 'LOCK') cur = { a: e.g }; if (e.k === 'UNLOCK' && cur) { cur.b = e.g; locks.push(cur); cur = null; } } if (cur) { cur.b = Infinity; locks.push(cur); } }
  // one-shot windows: warning -> the later of its pattern end and its last field's resolve
  const wins = [];
  for (const w of ev.filter((e) => e.k === 'WARN')) {
    const c = ev.find((e) => e.k === 'CAST' && e.g >= w.g), en = c && ev.find((e) => e.k === 'END' && e.g >= c.g);
    let end = en ? en.g : Infinity; const fl = ev.filter((e) => e.k === 'FIELD' && e.g >= w.g && e.g <= end);
    for (const f of fl) { const r = ev.find((e) => e.k === 'RESOLVE' && e.g >= f.g); if (r) end = Math.max(end, r.g); }
    wins.push({ w: w.g, c: c ? c.g : null, end, move: c ? c.move : w.move, form: w.form });
  }
  const singAll = ev.filter((e) => e.k === 'CAST' && e.move === 'singularity');
  const singWarn = ev.filter((e) => e.k === 'WARN' && e.move === 'singularity');
  for (let fi = 0; fi < forms.length; fi++) {
    const F = forms[fi], f = F.form, a = F.g, b = fi + 1 < forms.length ? forms[fi + 1].g : Infinity, inF = (g) => g >= a && g < b, tag = `form ${f}`;
    const casts = singAll.filter((e) => inF(e.g)), warns = singWarn.filter((e) => inF(e.g));
    const prevCast = singAll.filter((e) => e.g < a).pop(), prevWarn = singWarn.filter((e) => e.g < a).pop();
    const cc = casts.map((c, i) => c.g - (i ? casts[i - 1].g : (prevCast ? prevCast.g : -Infinity))).filter(Number.isFinite);
    const ww = warns.map((w, i) => w.g - (i ? warns[i - 1].g : (prevWarn ? prevWarn.g : -Infinity))).filter(Number.isFinite);
    console.log(`  ${tag}: ${casts.length} Singularity casts at ${casts.map((c) => s1(c.g - a)).join(', ')} s into the form; cast->cast ${cc.map(s1).join(', ')} s (warning->warning ${ww.map(s1).join(', ')})`);
    check(casts.length >= 1 && cc.length >= 1, `${tag}: his own AI casts the Singularity, and a cast-to-cast gap is measured (${f === 1 ? 'two casts' : 'one cast, gap from the form before'})`, { casts: casts.length, gaps: cc.length });
    check(cc.every((g) => g >= GAP_S[f] * 60) && ww.every((g) => g >= GAP_S[f] * 60), `${tag}: every Singularity comes >= ${GAP_S[f]} s after the one before (cast and warning; a form change does not reset it)`, { castGapsS: cc.map(s1), warnGapsS: ww.map(s1) });
    const first = warns[0];
    check(first && first.g - a >= FIRST_S * 60, `${tag}: the first Singularity warning comes >= ${FIRST_S} s into the ${f === 1 ? 'fight' : 'form'}`, { firstS: first ? s1(first.g - a) : null });
    const fLocks = locks.filter((L) => inF(L.a)), fWins = wins.filter((W) => inF(W.w));
    const over = fLocks.filter((L) => wins.some((W) => L.a <= W.end && L.b >= W.w)).map((L) => [s1(L.a - a), s1(L.b - a)]);
    console.log(`  ${tag}: ${fLocks.length} locks landed, ${fWins.length} one-shots (${fWins.map((W) => W.move[0] + W.move[1]).join(' ')})`);
    check(fLocks.length >= 1, `${tag}: the boss lock still lands in the fight (spaced, not removed)`, { locks: fLocks.length });
    check(over.length === 0, `${tag}: no lock overlaps a one-shot (its warning through its last field's resolve)`, { overlapsS: over });
    const pre = fLocks.map((L) => { const W = wins.find((x) => x.w >= L.b); return W ? W.w - L.b : null; }).filter((x) => x != null);
    check(pre.every((x) => x >= ESCAPE_F), `${tag}: every lock ends >= ${s1(ESCAPE_F)} s (the escape time) before the next one-shot warning`, { lockEndToWarnS: pre.map(s1) });
    const fields = ev.filter((e) => e.k === 'FIELD' && inF(e.g) && e.zones.length >= 5), trap = [];
    for (const Fd of fields) {
      const r = ev.find((e) => e.k === 'RESOLVE' && e.g >= Fd.g); if (!r) continue;
      const L = locks.filter((x) => x.a <= r.g).pop(), from = Math.max(Fd.g, L ? L.b : -Infinity), need = Math.ceil(worstReach(Fd.zones) / SPEED);
      if (r.g - from < need) trap.push({ at: s1(Fd.g - a), freeS: s1(Math.max(0, r.g - from)), needS: s1(need) });
    }
    check(fields.length > 0 && trap.length === 0, `${tag}: wherever the hero stands when a lock ends, a shelter is in reach before each Singularity resolves`, { fields: fields.length, trapped: trap });
  }
  check(forms.map((F) => F.form).join(',') === '1,2,3', 'the fight ran forms 1, 2 and 3 in order', forms.map((F) => F.form));

  // ---- co-op: the host decides every lock and every one-shot, for a partner too
  const co = await p.evaluate(async () => {
    const m = window.__m, out = {}; game.paused = true; window.__hold = true;
    const sent = []; const oX = window._lxBossExec; window._lxBossExec = function (k, q) { if (k === 'qteLock') { sent.push({ g: game.time | 0, to: q.to }); return true; } return oX.apply(this, arguments); };
    const oActive = window._coopActive, oHost = net.isHost, oMy = net.myId;
    window._coopActive = () => true; net.isHost = true; net.myId = 1;
    const px = m.x + m.w / 2 + 150, py = m.y + m.h / 2 - 22;
    net.peers[7] = { id: 7, map: game.currentMap, x: px - 14, y: py - 22, vx: 0, vy: 0, hp: 5000, maxHp: 5000 };
    const aim = { id: 7, x: px - 14, y: py - 22, vx: 0, vy: 0, cx: px, cy: py, feet: py + 22 };
    const quiet = () => { m.patternState = 'idle'; m.patternTimer = 0; m._ohkoWarnUntil = null; m._ohkoQueued = null; m._shackleTele = null; m._shackleTgt = null; m._shackleCd = 0; for (let i = game.hazards.length - 1; i >= 0; i--) if (game.hazards[i] && game.hazards[i].type === 'gravitos_singularity') game.hazards.splice(i, 1); };
    const field = () => game.hazards.push({ type: 'gravitos_singularity', x: 0, y: 0, w: 2200, h: 560, cx: m.x + m.w / 2, cy: m.y + m.h / 2, life: 330, maxLife: 330, atk: 99999, safeZones: [{ x: 60, y: 410, w: 112, h: 70 }, { x: 500, y: 410, w: 112, h: 70 }, { x: 1044, y: 190, w: 112, h: 70 }, { x: 1300, y: 410, w: 112, h: 70 }, { x: 2000, y: 410, w: 112, h: 70 }] });
    // [1] a lethal field is up and the lock is ready, aimed at the partner: nothing is thrown at them
    quiet(); _QTE.active = false; field(); m._gsDueAt = null;
    for (let i = 0; i < 120; i++) { game.time++; _qteShackleTry(m, 1000 / 60, aim); }
    out.duringField = sent.length;
    // [2] no field, nothing due: the lock goes out to the partner - and the host's next one-shot waits for a full lock plus the escape
    quiet(); m._gsOhkoEndAt = -1e9; m._gsDueAt = (game.time | 0) + 99999; m._lastOhkoEndAt = -1e9;
    for (let i = 0; i < 120 && !sent.length; i++) { game.time++; _qteShackleTry(m, 1000 / 60, aim); }
    out.sent = sent.length ? sent[0] : null; delete net.peers[7]; window._coopActive = oActive; net.isHost = oHost; net.myId = oMy; window._lxBossExec = oX;
    if (out.sent) {
      m._shackleCd = 1e9; game.paused = false; window.__hold = false; const W8 = (ms) => new Promise((s) => setTimeout(s, ms));
      const w0 = performance.now(); let warnAt = null;
      while (performance.now() - w0 < 60000 && warnAt == null) {
        m._soulTimer = -1; m._lastOhkoAt = -1e9; m._lastOhkoEndAt = -1e9; m._lastSkillAt = -1e9; m._ohkoGapRoll = 0; m._shackleCd = 1e9; player._god = true; player.hp = player.maxHp;
        if (m._ohkoWarnUntil != null) warnAt = game.time | 0;
        await W8(16);
      }
      window.__hold = true; game.paused = true; out.warnAfter = warnAt == null ? null : warnAt - out.sent.g;
    }
    // [3] a guest refuses a lock that would land while a lethal field is up on its screen
    // (control first: with no field the same call locks the guest, so the refusal below is the field's doing)
    const guestTry = (withField) => {
      quiet(); if (withField) field(); if (_QTE.active) _qteEnd(false);
      player._god = false; player._downed = false; player.invulnerable = 0; player.stunTimer = 0; player.hp = player.maxHp; player.vx = player.vy = 0;
      player.x = m.x + m.w / 2 + 60 - player.w / 2; player.y = m.y + m.h / 2 - player.h / 2 + 40;
      net.myId = 7; let took = false; try { took = _lxBossExecLocal('qteLock', { to: 7, u: m.uid }); } catch (e) { out.err = String(e); }
      const locked = !!_QTE.active || !!took; if (_QTE.active) _qteEnd(false); player.stunTimer = 0; net.myId = oMy; return locked;
    };
    out.guestControl = guestTry(false); out.guestLocked = guestTry(true); quiet();
    return out;
  });
  console.log('  co-op: ' + JSON.stringify(co));
  check(co.duringField === 0, 'co-op: no lock is thrown at a partner while a lethal field is up', co);
  check(co.sent && co.warnAfter != null && co.warnAfter >= 306 + ESCAPE_F, `co-op: after a lock goes out to a partner, the next one-shot waits a full lock plus the escape (>= ${s1(306 + ESCAPE_F)} s)`, co);
  check(co.guestControl === true && co.guestLocked === false, 'co-op: a guest refuses a lock that would land while a lethal field is on its screen (the same lock lands with no field)', co);
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
