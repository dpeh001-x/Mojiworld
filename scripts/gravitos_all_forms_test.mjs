// Every Gravitos fight goes form 1 -> 2 -> 3, and only form 3's death is the win (v0.30.x boss-all-forms).
//   node scripts/gravitos_all_forms_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Per user: "beat echo gravitos form 1 and the battle just ends. please ensure all fights go through form 1 2 and 3".
// Each fight path is driven through the real game: the Echo Keeper's dialog (free echo, Nightmare echo), the Hall of Echoes
// (Boss Rush auto-start) and the story arena. Each form is knocked down through hitMonster (the real damage path) and the
// check reads which forms played, when the win / credit came (quest tick, Rush down, defeated stamp) and how many times.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11850';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof killMonster === 'function' && typeof openNPC === 'function' && typeof _bossRushAutoStart === 'function', null, { timeout: 150000 });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'rogue'; player.level = 70;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    try { for (const k of Object.keys(LX_KILL_FILMS)) if (LX_KILL_FILMS[k] && LX_KILL_FILMS[k].key) player._storyBeatsSeen[LX_KILL_FILMS[k].key] = true; } catch (e) {}   // no once-per-save film pauses the run
    loadMap('mushroom'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    player.invulnerable = 999999; game.monsters.length = 0;
    // credit spies: a quest tick for Gravitos, a Boss Rush echo laid to rest, a Rush finished
    const S = window.__spy = { qk: 0, rd: 0, rc: 0 };
    const _tq = tickQuestKill; window.tickQuestKill = function (t) { if (t === 'gravitos') S.qk++; return _tq.apply(this, arguments); };
    const _rd = _bossRushOnBossDown; window._bossRushOnBossDown = function (m) { if (m && m.type === 'gravitos') S.rd++; return _rd.apply(this, arguments); };
    const _rc = _bossRushComplete; window._bossRushComplete = function () { S.rc++; try { return _rc.apply(this, arguments); } catch (e) {} };
  });
  // Set up one fight path; resolves with the boss found (or null).
  const setup = (kind) => p.evaluate(async (kind) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {}
    document.getElementById('boss-rush-results')?.remove();
    game.bossRush = null; game.monsters.length = 0; if (game.hazards) game.hazards.length = 0;
    Object.assign(window.__spy, { qk: 0, rd: 0, rc: 0 });
    game.bossDefeated = game.bossDefeated || {};
    if (kind === 'rush') { game.mojidexSeen = { gravitos: true }; loadMap('boss_rush'); }
    else { game.bossDefeated.gravitosArena = kind !== 'story'; loadMap('gravitosArena'); }
    await sleep(2500); game.paused = false; player.invulnerable = 999999;
    const grav = () => (game.monsters || []).find((m) => m && m.type === 'gravitos' && m.currentHp > 0);
    if (kind === 'echo' || kind === 'nightmare') {
      const npc = (game.npcs || []).find((n) => n && n.role === 'echoKeeper');
      if (!npc) return { err: 'no Echo Keeper' };
      game.monsters.length = 0;   // the arena's own spawn (if any) is not the echo
      openNPC(npc); await sleep(400);
      const want = kind === 'echo' ? /Summon the echo/ : /NIGHTMARE/;
      const b = [...document.querySelectorAll('#dialog-options button')].find((x) => want.test(x.textContent));
      if (!b) return { err: 'no option', opts: [...document.querySelectorAll('#dialog-options button')].map((x) => x.textContent) };
      b.click(); await sleep(300);
    }
    const t0 = performance.now();
    while (!grav() && performance.now() - t0 < (kind === 'rush' ? 20000 : 6000)) await sleep(100);
    if (!grav() && kind === 'story') spawnMonster(1100, 380, 'gravitos', true, false);   // the arena's own spawn, if the entry did not place him
    try { closeDialog(); } catch (e) {} game.paused = false;
    const m = grav(); if (!m) return { err: 'no Gravitos', map: game.currentMap, br: game.bossRush && { q: game.bossRush.queue, idx: game.bossRush.idx } };
    window.__boss = m;
    return { ok: true, name: m.name, echo: !!m._echoBoss, rush: !!m._rushBoss, nightmare: !!m._nightmareEcho };
  }, kind);
  // Knock each form down through hitMonster; record the forms that played and when the credit came.
  const fight = () => p.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const frames = async (n) => { const g0 = game.time | 0, t0 = performance.now(); while ((game.time | 0) - g0 < n && performance.now() - t0 < 20000) await sleep(30); return (game.time | 0) - g0; };
    const m = window.__boss, S = window.__spy, rec = [];
    let ran = 0;
    for (let f = 1; f <= 4; f++) {
      ran += await frames(12);
      player.hp = getMaxHp(); player.invulnerable = 999999;
      if (!game.monsters.includes(m) || !(m.currentHp > 0)) break;
      rec.push({ phase: m._gravitosPhase || 1, sprite: m._phaseSprite || '', name: m.name, maxHp: m.maxHp, qk: S.qk, rd: S.rd,
        def: !!(game.bossDefeated && game.bossDefeated.gravitosArena), busy: typeof _lxEchoBusy === 'function' ? _lxEchoBusy() : null });
      const ph = m._gravitosPhase || 1;
      for (let k = 0; k < 60 && game.monsters.includes(m) && m.currentHp > 0 && (m._gravitosPhase || 1) === ph; k++) {
        m.invulnerable = 0; m.currentHp = 1; m.patternState = 'idle'; m.patternTimer = 0;   // held inert, one point from its fall
        hitMonster(m, 999999, false); await sleep(25);
      }
    }
    ran += await frames(30);
    return { rec, ran, gone: !game.monsters.includes(m), hp: m.currentHp, qk: S.qk, rd: S.rd, rc: S.rc, dying: !!game.dying,
      def: !!(game.bossDefeated && game.bossDefeated.gravitosArena), busy: typeof _lxEchoBusy === 'function' ? _lxEchoBusy() : null };
  });
  for (const kind of ['echo', 'nightmare', 'rush', 'story']) {
    const st = await setup(kind);
    if (!st.ok) { check(false, `${kind}: the fight starts`, st); continue; }
    const r = await fight();
    const R = r.rec, f1 = R[0] || {}, f2 = R[1] || {}, f3 = R[2] || {};
    check(r.ran > 0, `${kind}: the game clock ran (${r.ran} frames)`, r);
    check(R.length === 3 && f1.phase === 1 && f2.phase === 2 && f2.sprite === 'gravitos2' && f3.phase === 3 && f3.sprite === 'gravitos3',
      `${kind}: Gravitos plays form 1, then form 2 (Awakened), then form 3 (Ascendant)`, R.map((x) => [x.phase, x.sprite, x.name]));
    check(R.length === 3 && f2.maxHp === Math.max(1, Math.floor(f1.maxHp * 0.5)) && f3.maxHp === f1.maxHp,
      `${kind}: the forms have the story fight's HP (form 2 half of form 1, form 3 the full pool)`, R.map((x) => x.maxHp));
    const credit = (x) => kind === 'rush' ? x.rd : x.qk;
    check(R.length === 3 && credit(f2) === 0 && credit(f3) === 0 && (kind !== 'story' || (!f2.def && !f3.def)) && (kind === 'rush' || kind === 'story' || (f2.busy && f3.busy)),
      `${kind}: no win, credit or defeated stamp before form 3 falls`, R);
    check(r.gone && credit(r) === 1 && (kind !== 'rush' || r.rc === 1) && (kind !== 'story' || r.def) && (kind === 'rush' || kind === 'story' || r.busy === false),
      `${kind}: form 3's fall is the win, credited exactly once`, r);
    if (kind !== 'story') check(R.length === 3 && R.every((x) => / \((?:Echo|Nightmare)\)$/.test(x.name)), `${kind}: the shade keeps its echo name through the forms`, R.map((x) => x.name));
    check(!r.dying, `${kind}: the hero is still standing (the run is valid)`, r);
  }
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await ctx.close();
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
