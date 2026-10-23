// Gravitos one-shot rework (v0.30.x gravitos-ohko-rework): Collapse Rain drains to 1 HP / 1 MP (kills only at 1 HP), Soul Drain is
// a 10 s status (10% of max HP a second, never below 1 HP), the Singularity is unchanged (a one-shot, v0.30.1852 spacing).
//   node scripts/gravitos_ohko_rework_test.mjs        (MOJI_GAME_FILE=<build.html> to test a private build; PORT)
// Per user: "Change collapse rain to a 1hp and 1mp attack", "If youre at 1 hp you die", "Soul drain should not be a OHKO move, it
// should be a move whereby the players HP drops by 10% every second for 10 seconds with a unique status affliction", "10% of max HP,
// but it can't kill", "Then bring back singularity OHKO". Live arena (gravitosArena, form 2), the real hazard resolver, the real
// drain exec and the real co-op handlers; his AI is held still (no stray hits) while each case runs on the fight clock.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11843';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const cache = new Map();   // fonts + data tables from origin: the shared working copy may hold another session's unshipped files
const fromOrigin = (rel) => { if (!cache.has(rel)) cache.set(rel, execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 26 })); return cache.get(rel); };
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
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof bossAI === 'function' && typeof _lxBossExecLocal === 'function', null, { timeout: 150000 });
  await p.evaluate(() => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth', 'lo-menu']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'warrior'; player.level = 100; player._gravitosCineSeen = true;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    loadMap('gravitosArena'); game.paused = false;
  });
  await p.waitForFunction(() => game.monsters.some((m) => m && m.type === 'gravitos' && m.currentHp > 0), null, { timeout: 60000 });
  const R = await p.evaluate(async () => {
    const W8 = (ms) => new Promise((s) => setTimeout(s, ms)), out = {};
    const m = game.monsters.find((x) => x && x.type === 'gravitos');
    // his AI holds still unless a case lets it run; the world keeps stepping; a death is counted, not played
    window.__ai = false; const oAI = window.bossAI; window.bossAI = function (mm) { if (mm === m && !window.__ai) { mm.patternState = mm.patternState === 'singularity' ? 'singularity' : 'idle'; mm.patternTimer = 0; mm.vx = 0; return; } return oAI.apply(this, arguments); };
    window.__deaths = 0; window.triggerDeath = function () { window.__deaths++; player._diedHere = true; };
    window._tryCheatDeathRevive = () => false;   // a revive charge would turn the death under test into a save
    const keep = () => { game.paused = false; for (const id of ['story-beat-overlay', 'boss-intro-overlay', 'everdawn-welcome-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); } requestAnimationFrame(keep); };
    requestAnimationFrame(keep);
    m._phaseSprite = 'gravitos2'; m._gravitosPhase = 2; m.currentHp = Math.floor(m.maxHp * 0.5); m._warpTimer = 1e9; m._shackleCd = 1e9; m._wardNextAt = 1e12; m._dirRollT = 1e9;
    const ww = game.mapData.worldWidth || 2200; m.x = ww - 260 - m.w; m.y = 480 - m.h;
    const steps = async (n) => { const g0 = game.time | 0, t0 = performance.now(); while ((game.time | 0) - g0 < n && performance.now() - t0 < 120000) await W8(16); return (game.time | 0) - g0; };
    const hero = (hp, mp, x) => { player._god = false; player._downed = false; game.dying = false; player._diedHere = false; player.invulnerable = 0; player._hitIframeAt = null; player.hp = hp; player.mp = mp; player.x = x; player.y = 480 - player.h; player.vx = player.vy = 0; player.blockTimer = 0; };
    const clearHz = () => { for (let i = game.hazards.length - 1; i >= 0; i--) if (game.hazards[i] && game.hazards[i].type === 'gravitos_singularity') game.hazards.splice(i, 1); };
    // ---- Collapse Rain: his own pattern spawns the boxes (tagged), then one box at a time against the hero
    clearHz(); window.__ai = true; m._soulTimer = m._instaTimer = 1e9; m.patternState = 'collapseRain'; m.patternTimer = 0; m._rainIdx = 0; m._rainSafe = null; m._rainNextAt = null; m._rainRestF = 0;
    player._god = true; player.invulnerable = 999999;
    { const t0 = performance.now(); let h = null; while (!h && performance.now() - t0 < 45000) {   // an HP-tier step resets him to idle: start the rain again until its first box is down
        if (m.patternState !== 'collapseRain') { m.patternState = 'collapseRain'; m.patternTimer = 0; m._rainIdx = 0; m._rainSafe = null; m._rainNextAt = null; m._rainRestF = 0; m._soulTimer = m._instaTimer = 1e9; }
        h = game.hazards.find((q) => q && q.type === 'gravitos_singularity' && q.life > 0); await W8(16); }
      out.rainBox = h ? { drain: h._rainDrain === true, label: h._sourceLabel || null, zones: (h.safeZones || []).length, maxLife: h.maxLife, atk: h.atk } : null; }
    window.__ai = false; m.patternState = 'idle'; clearHz(); await steps(4);
    const box = async (inside, hp, mp) => {   // one rain box as the pattern builds it, 20 steps from its resolve
      clearHz(); m.x = ww - 160 - m.w; m.y = 480 - m.h; m.vx = 0;   // he stands at the far wall: no contact hits
      const MH = Math.max(1, getMaxHp()), MM = player.maxMp || 100, zx = 620, z = { x: zx, y: 480 - 60, w: 102, h: 60 };
      hero(Math.min(MH, hp), Math.min(MM, mp), inside ? zx + 51 - player.w / 2 : 1100);
      const h = { type: 'gravitos_singularity', x: 0, y: 0, w: ww, h: 720, cx: m.x + m.w / 2, cy: m.y + m.h / 2, life: 20, maxLife: 84, atk: 99999, safeZones: [z], _rainDrain: true, _sourceLabel: "Gravitos' Collapse Rain" };
      if (out.rainBox && !out.rainBox.drain) { delete h._rainDrain; delete h._sourceLabel; }   // the unpatched build: its own box
      game.hazards.push(h); const d0 = window.__deaths;
      const t0 = performance.now(); while (game.hazards.includes(h) && performance.now() - t0 < 30000) { player.hp = Math.max(player.hp, 0); player.x = inside ? zx + 51 - player.w / 2 : 1100; await W8(16); }
      const r = { hp: player.hp, mp: player.mp, died: window.__deaths > d0 || player.hp <= 0, inv: player.invulnerable | 0, gone: !game.hazards.includes(h), src: player._lastDamageSource || null, y: Math.round(player.y), mons: game.monsters.filter((q) => q && q.currentHp > 0 && Math.abs(q.x - player.x) < 300).map((q) => q.type) };
      return { r, h };
    };
    { const { r, h } = await box(false, 99999, 99999); out.above = r;
      // one application per box: the same box, resolved again by hand after its own resolve, with the hero stripped of i-frames
      player.invulnerable = 0; player.hp = 500; const again = (typeof _lxRainDrainHit === 'function') ? _lxRainDrainHit(h) : null; out.again = { ret: again, hp: player.hp }; }
    out.inside = (await box(true, 4000, 80)).r; out.insideMax = { hp: Math.min(Math.max(1, getMaxHp()), 4000), mp: Math.min(player.maxMp || 100, 80) };   // the box sits clear of the vents (240 / 1840)
    { player.invulnerable = 0; const MH = player.maxHp; hero(MH, 50, 1100); player.invulnerable = 500; clearHz();
      const h = { type: 'gravitos_singularity', x: 0, y: 0, w: ww, h: 720, cx: 0, cy: 0, life: 20, maxLife: 84, atk: 99999, safeZones: [{ x: 300, y: 420, w: 102, h: 60 }], _rainDrain: true };
      game.hazards.push(h); const t0 = performance.now(); while (game.hazards.includes(h) && performance.now() - t0 < 30000) { player.x = 1100; await W8(16); }
      out.iframes = { hp: player.hp, max: MH }; }
    // co-op: the host's snapshot carries the tag; a guest's mirror resolves on the guest's own HP / MP
    { clearHz(); const MH = player.maxHp; hero(MH, 50, 1100);
      const h = { type: 'gravitos_singularity', x: 0, y: 0, w: ww, h: 720, cx: 0, cy: 0, life: 40, maxLife: 84, atk: 99999, safeZones: [{ x: 300, y: 420, w: 102, h: 60 }], _rainDrain: true, _sourceLabel: "Gravitos' Collapse Rain", _huid: 4242 };
      if (out.rainBox && !out.rainBox.drain) { delete h._rainDrain; delete h._sourceLabel; }
      game.hazards.push(h); let list = []; try { list = _coopHazList(); } catch (e) { out.listErr = String(e); }
      const e = list.find((q) => q && q.u === 4242); clearHz(); out.wire = e ? { xf: e.xf || null } : null;
      const oF = window._coopFollowingHost, oHost = net.isHost, oHid = net.hostId;
      window._coopFollowingHost = () => true; net.isHost = false; net.hostId = 1;
      try { _coopApplyHazards({ t: 'haz', id: 1, map: game.currentMap, list: e ? [e] : [] }); } catch (er) { out.applyErr = String(er); }
      const mh = game.hazards.find((q) => q && q._coopMirror && q._huid === 4242); out.mirror = mh ? { drain: mh._rainDrain === true, zones: (mh.safeZones || []).length } : null;
      const d0 = window.__deaths, t0 = performance.now(); while (mh && game.hazards.includes(mh) && performance.now() - t0 < 30000) { player.x = 1100; await W8(16); }
      out.guestRain = { hp: player.hp, mp: player.mp, died: window.__deaths > d0 };
      // and the guest's Soul Drain arrives as the host's exec
      player._sdLeft = 0; hero(MH, 50, 900);
      try { _coopApplyBossHit({ t: 'bosshit', id: 1, map: game.currentMap, x: 900, y: 300, k: 'gvDrain', p: { x: 1000, y: 380, ph: 2 } }); } catch (er) { out.bhErr = String(er); }
      out.guestDrain = { left: player._sdLeft | 0, hp: player.hp, max: MH };
      player._sdLeft = 0; window._coopFollowingHost = oF; net.isHost = oHost; net.hostId = oHid; clearHz(); }
    out.atOne = (await box(false, 1, 50)).r;   // the death case last: a dead hero holds the world still until revived
    hero(Math.max(1, getMaxHp()), 50, 900); await steps(20);
    window.__out = out; return out;
  });
  console.log('  rain: ' + JSON.stringify(R));
  const S = await p.evaluate(async () => {
    const W8 = (ms) => new Promise((s) => setTimeout(s, ms)), out = {}, m = game.monsters.find((x) => x && x.type === 'gravitos');
    const steps = async (n) => { const g0 = game.time | 0, t0 = performance.now(); while ((game.time | 0) - g0 < n && performance.now() - t0 < 120000) await W8(16); return (game.time | 0) - g0; };
    const hero = (hp, x) => { player._god = false; player._downed = false; game.dying = false; player.invulnerable = 0; player.hp = hp; player.mp = 50; player.x = x; player.y = 480 - player.h; player.vx = player.vy = 0; };
    // record each tick: the step it lands on and the HP it takes (wrapping the game's own tick; no regen between the two reads)
    const ticks = []; const oT = window._lxSoulDrainTick;
    if (typeof oT === 'function') window._lxSoulDrainTick = function () { const l0 = player._sdLeft | 0, h0 = player.hp, r = oT.apply(this, arguments); if ((player._sdLeft | 0) === l0 - 1 && l0 > 0) ticks.push({ g: game.time | 0, d: Math.round(h0 - player.hp), hp: player.hp }); return r; };
    const pin = () => { player.x = window.__px; player.vx = 0; if (window.__sdHold) requestAnimationFrame(pin); };
    const drain = (bx, by) => _lxBossExecLocal('gvDrain', { x: bx, y: by, ph: 2 });
    const MH = Math.max(1, (typeof getMaxHp === 'function') ? getMaxHp() : player.maxHp), tick = Math.max(1, Math.floor(MH * 0.10));
    out.MH = MH; out.tick = tick;
    // [1] caught at full HP with a clear line: the status, then 10 ticks of 10% a second, never below 1
    player._sdLeft = 0; hero(MH, 900); window.__px = 900; window.__sdHold = true; requestAnimationFrame(pin);
    out.los1 = (typeof _lxLosBlocked === 'function') ? _lxLosBlocked(1000, 380, player.x + player.w / 2, player.y + player.h / 2) : null;
    const g0 = game.time | 0; drain(1000, 380);
    out.applied = { left: player._sdLeft | 0, hpAfter: player.hp, mpAfter: player.mp, pill: false, icon: typeof _LX_PSI !== 'undefined' && !!_LX_PSI.soul };
    await steps(30); { const pill = document.querySelector('#buff-row [data-buff="soulDrain"]'); out.applied.pill = !!pill; }
    await steps(700); out.run1 = { ticks: ticks.map((t) => ({ at: t.g - g0, d: t.d })), hp: player.hp, minHp: Math.min(...ticks.map((t) => t.hp)), left: player._sdLeft | 0, died: player.hp <= 0 || player._downed };
    // [2] from low HP: the drain floors at 1 and the hero lives
    ticks.length = 0; player._sdLeft = 0; hero(Math.ceil(MH * 0.25), 900); drain(1000, 380); await steps(700);
    out.low = { n: ticks.length, hp: player.hp, minHp: Math.min(...ticks.map((t) => t.hp)), clamped: ticks.some((t) => t.d < tick), alive: player.hp > 0 && !player._downed };
    // [3] caught again while it runs: back to 10, no stacking (one tick a second, 3 + 10 in all)
    ticks.length = 0; player._sdLeft = 0; hero(MH, 900); const g1 = game.time | 0; drain(1000, 380); await steps(200);
    const before = ticks.length; drain(1000, 380); out.reapply = { before, leftAfter: player._sdLeft | 0 }; await steps(760);
    const gaps = ticks.map((t, i) => i ? t.g - ticks[i - 1].g : t.g - g1);
    out.reapply.n = ticks.length; out.reapply.gaps = gaps; out.reapply.maxD = Math.max(0, ...ticks.map((t) => t.d));
    // [4] a form change ends it
    ticks.length = 0; player._sdLeft = 0; hero(MH, 900); drain(1000, 380); await steps(130); const n4 = ticks.length; m._gravitosPhase = 3; await steps(130);
    out.form = { before: n4, after: ticks.length, left: player._sdLeft | 0 }; m._gravitosPhase = 2;
    window.__sdHold = false;
    // [5] line of sight broken: he is above the centre platform, the hero below it
    player._sdLeft = 0; ticks.length = 0; hero(MH, 1080); window.__px = 1080; window.__sdHold = true; requestAnimationFrame(pin);
    out.los5 = (typeof _lxLosBlocked === 'function') ? _lxLosBlocked(1100, 120, player.x + player.w / 2, player.y + player.h / 2) : null;
    drain(1100, 120); await steps(150); out.blocked = { left: player._sdLeft | 0, hp: player.hp, mp: player.mp, max: MH }; window.__sdHold = false;
    // ---- the Singularity: still a one-shot (form 2, a hero outside every shelter, no i-frames)
    player._sdLeft = 0; for (let i = game.hazards.length - 1; i >= 0; i--) if (game.hazards[i] && game.hazards[i].type === 'gravitos_singularity') game.hazards.splice(i, 1);
    m.phase = 2; hero(MH, 60); const d0 = window.__deaths; m._sgSpawned = false; m.patternState = 'singularity'; m.patternTimer = 0; window.__ai = true;
    let hz = null; const t0 = performance.now();
    while (performance.now() - t0 < 60000) {
      const h = game.hazards.find((q) => q && q.type === 'gravitos_singularity'); if (h) hz = hz || { zones: (h.safeZones || []).length, life: h.maxLife, drain: !!h._rainDrain };
      if (hz && !h) break;
      if (h) { player.invulnerable = 0; player._hitIframeAt = null; let x = 60; for (let k = 0; k < 3; k++) for (const z of h.safeZones) if (x + player.w > z.x - 30 && x < z.x + z.w + 30) x = z.x + z.w + 60; player.x = x; player.y = 480 - player.h; }
      await W8(16);
    }
    window.__ai = false; out.sing = { hz, died: window.__deaths > d0, hp: player.hp };
    // and its v0.30.1852 spacing: 40 s from one cast to the next warning in form 2, none in the first 20 s of a form
    { const now = game.time | 0, keep = [m._gsSingAt, m._gsFormAt];
      m._gsFormAt = now - 99999; m._gsSingAt = now - 39 * 60; const w39 = _lxGsSingWait(m, now); m._gsSingAt = now - 41 * 60; const w41 = _lxGsSingWait(m, now);
      m._gsSingAt = null; m._gsFormAt = now - 19 * 60; const f19 = _lxGsSingWait(m, now); m._gsFormAt = now - 21 * 60; const f21 = _lxGsSingWait(m, now);
      m._gsSingAt = keep[0]; m._gsFormAt = keep[1];
      out.spacing = { gaps: JSON.stringify(_GRAV_SING_GAP_S), first: _GRAV_SING_FIRST_S, w39, w41, f19, f21 }; }
    return out;
  });
  console.log('  soul + singularity: ' + JSON.stringify(S));
  // ---- Collapse Rain
  check(R.rainBox && R.rainBox.drain && R.rainBox.label === "Gravitos' Collapse Rain" && R.rainBox.zones === 1 && R.rainBox.maxLife === 84, 'Collapse Rain: his own pattern still drops one-shelter 1.4 s boxes, now tagged as a drain', R.rainBox);
  check(R.above && R.above.gone && R.above.hp === 1 && R.above.mp === 1 && !R.above.died, 'Collapse Rain: caught above 1 HP -> exactly 1 HP and 1 MP, alive', R.above);
  check(R.above && R.above.inv >= 600, 'Collapse Rain: the drain grants the normal hit i-frames', R.above);
  check(R.again && R.again.ret === false && R.again.hp === 500, 'Collapse Rain: a box applies once - resolving the same box again takes nothing', R.again);
  check(R.atOne && R.atOne.died, 'Collapse Rain: caught at 1 HP -> the hero dies (the normal death path)', R.atOne);
  check(R.inside && R.inside.hp === R.insideMax.hp && R.inside.mp === R.insideMax.mp && !R.inside.died, 'Collapse Rain: inside the safe box it takes nothing', { got: R.inside, want: R.insideMax });
  check(R.iframes && R.iframes.hp === R.iframes.max, 'Collapse Rain: live invulnerability skips it, as it skips any hit', R.iframes);
  check(R.wire && R.wire.xf && R.wire.xf._rainDrain === true && R.mirror && R.mirror.drain && R.mirror.zones === 1, "co-op: the host's snapshot carries the drain tag and the guest's mirror keeps it", { wire: R.wire, mirror: R.mirror, err: R.listErr || R.applyErr });
  check(R.guestRain && R.guestRain.hp === 1 && R.guestRain.mp === 1 && !R.guestRain.died, 'co-op: a guest caught by a rain box drops to 1 HP / 1 MP on its own bar, alive', R.guestRain);
  // ---- Soul Drain
  check(S.los1 === false && S.applied.left === 10 && S.applied.hpAfter === S.MH && S.applied.icon && S.applied.pill, 'Soul Drain: caught -> the SOUL DRAIN status (10 ticks), no instant clamp, its status sticker and HUD pill show', S.applied);
  const t1 = (S.run1 && S.run1.ticks) || [];
  check(t1.length === 10 && t1.every((t, i) => Math.abs(t.at - 60 * (i + 1)) <= 2) && t1.slice(0, 9).every((t) => t.d === S.tick), 'Soul Drain: 10 ticks of 10% max HP, one a second', { ticks: t1, tick: S.tick });
  check(S.run1 && S.run1.minHp >= 1 && S.run1.hp >= 1 && !S.run1.died && S.run1.left === 0, 'Soul Drain: from full HP all 10 ticks land and the hero lives (it ends after the tenth)', S.run1);
  check(S.low && S.low.n === 10 && S.low.minHp === 1 && S.low.clamped && S.low.alive, 'Soul Drain: from a quarter HP the ticks floor at exactly 1 HP - the drain alone never kills', S.low);
  const rp = S.reapply || {};
  check(rp.leftAfter === 10 && rp.n === rp.before + 10 && (rp.gaps || []).every((g) => Math.abs(g - 60) <= 2) && rp.maxD === S.tick, 'Soul Drain: caught again while it runs -> back to 10 ticks, one a second, never doubled', rp);
  check(S.form && S.form.before >= 1 && S.form.after === S.form.before && S.form.left === 0, 'Soul Drain: a form change ends it', S.form);
  check(S.los5 === true && S.blocked && S.blocked.left === 0 && S.blocked.hp === S.blocked.max, 'Soul Drain: breaking line of sight still avoids it', { los: S.los5, blocked: S.blocked });
  check(R.guestDrain && R.guestDrain.left === 10 && R.guestDrain.hp === R.guestDrain.max, "co-op: the host's drain reaches a guest as the same status on the guest's own HP", R.guestDrain);
  // ---- the Singularity, unchanged
  check(S.sing && S.sing.hz && S.sing.hz.zones === 5 && S.sing.hz.life === 330 && !S.sing.hz.drain && S.sing.died, 'Singularity: unchanged - a five-shelter 5.5 s field that still kills a hero outside it', S.sing);
  const sp = S.spacing || {};
  check(sp.gaps === '{"1":50,"2":40,"3":30}' && sp.first === 20 && sp.w39 > 0 && sp.w41 === 0 && sp.f19 > 0 && sp.f21 === 0, 'Singularity: the v0.30.1852 spacing holds (40 s cast-to-warning in form 2, none in the first 20 s of a form)', sp);
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
