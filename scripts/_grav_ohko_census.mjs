// SCRATCH — every Gravitos OHKO in a live form-3 fight: warn start, cast, end, in game.time frames AND wall-clock seconds.
//   PORT=10341 SECS=300 HP=0.25 FORM=3 node scripts/_grav_ohko_census.mjs [build.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10341', SECS = Number(process.env.SECS || 300), HP = Number(process.env.HP || 0.25), HP1 = process.env.HP1 != null ? Number(process.env.HP1) : null, HITS = Number(process.env.HITS || 0), FORM = Number(process.env.FORM || 3);
const FILE = process.argv[2] || 'mojiworld_game.html';
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: { ...process.env, MOJI_GAME_FILE: FILE } });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
try {
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  const page = await ctxB.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  const TBL = path.join(process.env.TEMP, 'gs_tables');
  await page.route((u) => /data[/]sprite_(bbox|edges|frame_index)[.]js/.test(u.pathname), (r) => { try { r.fulfill({ status: 200, contentType: 'application/javascript', body: readFileSync(path.join(TBL, r.request().url().split('/').pop().split('?')[0])) }); } catch (e) { r.continue(); } });
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof hitMonster === 'function', null, { timeout: 120000 });
  await page.evaluate(() => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false;
    player.level = 100; player.cls = 'warrior'; player.invulnerable = 0; player.hp = player.maxHp = 99999; player._god = true;
    loadMap('gravitosArena'); game.paused = false;
  });
  await page.waitForFunction(() => game.monsters.some((m) => m && m.type === 'gravitos' && m.currentHp > 0), null, { timeout: 60000 }).catch(() => {});
  await page.waitForFunction(() => ![...document.querySelectorAll('video')].some((v) => v.offsetParent && !v.paused && v.id.indexOf('map-bg-video') !== 0), null, { timeout: 60000 }).catch(() => {});
  const info = await page.evaluate(async ({ FORM, HP, HP1, HITS, SECS }) => {
    const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
    const clear = () => { const sb = document.getElementById('story-beat-overlay'); for (let k = 0; k < 12 && sb && sb.classList.contains('on'); k++) sb.click(); const bi = document.getElementById('boss-intro-overlay'); if (bi) bi.classList.remove('on'); game.paused = false; };
    const boss = () => game.monsters.find((x) => x && x.type === 'gravitos' && x.currentHp > 0);
    const phaseOf = (m) => (m && (m._gravitosPhase || 1)) | 0;
    for (let want = 2; want <= FORM; want++) { let m = boss(), tries = 0; while (m && phaseOf(m) < want && tries++ < 6) { clear(); m.evasion = 0; m._dying = false; m.currentHp = 1; hitMonster(m, 99999999, false, 'phys'); for (let k = 0; k < 30; k++) { await sleep(250); clear(); const b = boss(); if (b && phaseOf(b) >= want) break; } m = boss(); } }
    clear(); await sleep(2500); clear();
    const m = boss(); if (!m) return { err: 'no boss' };
    m.currentHp = Math.floor(m.maxHp * HP);
    // the census: sampled every frame from inside the page
    window.__oc = { ev: [], t0: performance.now(), g0: game.time | 0, lastWarn: null, lastState: m.patternState, hz: new Set() };
    const OHKO = ['singularity', 'collapseRain', 'soulDrain'];
    const tick = () => {
      const b = boss(); const c = window.__oc;
      if (b) {
        clear(); const el = (performance.now() - c.t0) / 1000; const want = HP1 == null ? HP : HP + (HP1 - HP) * Math.min(1, el / SECS); b.currentHp = Math.max(1, Math.floor(b.maxHp * want)); player.hp = player.maxHp; player._god = true;
        if (HITS > 0 && el - (c.lastHit || 0) >= 1 / HITS) { c.lastHit = el; try { b.evasion = 0; hitMonster(b, 1200 + Math.floor(Math.random() * 800), Math.random() < 0.3, 'phys'); } catch (e) {} }
        if (b.phase !== c.lastPhase) { c.ev.push({ k: 'TIER', move: 'hp-tier ' + b.phase, t: +el.toFixed(2), g: (game.time | 0) - c.g0 }); c.lastPhase = b.phase; }
        const now = +((performance.now() - c.t0) / 1000).toFixed(2), g = (game.time | 0) - c.g0;
        if (b._ohkoWarnUntil != null && c.lastWarn == null) c.ev.push({ k: 'WARN', move: b._ohkoQueued, t: now, g, form: phaseOf(b), hpPhase: b.phase });
        c.lastWarn = b._ohkoWarnUntil;
        if (b.patternState !== c.lastState) {
          if (OHKO.includes(b.patternState)) c.ev.push({ k: 'CAST', move: b.patternState, t: now, g });
          if (OHKO.includes(c.lastState)) c.ev.push({ k: 'END', move: c.lastState, t: now, g });
          c.lastState = b.patternState;
        }
        for (const h of game.hazards || []) if (h && h.type === 'gravitos_singularity' && !c.hz.has(h)) { c.hz.add(h); c.ev.push({ k: 'zone', t: now, g, life: h.life, zones: (h.safeZones || []).length }); }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return { form: phaseOf(m), hpPhase: m.phase, hpPct: +(m.currentHp / m.maxHp).toFixed(2) };
  }, { FORM, HP, HP1, HITS, SECS });
  console.log('start', JSON.stringify(info));
  await page.waitForTimeout(SECS * 1000);
  const out = await page.evaluate(() => ({ ev: window.__oc.ev, secs: +((performance.now() - window.__oc.t0) / 1000).toFixed(1), frames: (game.time | 0) - window.__oc.g0 }));
  console.log(`ran ${out.secs}s wall = ${out.frames} game frames (${(out.frames / out.secs).toFixed(1)} frames/s)`);
  let lastEnd = null, lastCast = null;
  for (const e of out.ev) {
    if (e.k === 'zone') { console.log(`${String(e.t).padStart(7)}s  g${String(e.g).padStart(6)}    lethal field spawned, life ${e.life} frames, ${e.zones} safe zone(s)`); continue; }
    let note = '';
    if (e.k === 'WARN' && lastEnd != null) note = `  <- ${(e.t - lastEnd).toFixed(1)} s after the last OHKO ENDED` + (lastCast != null ? `, ${(e.t - lastCast).toFixed(1)} s after it was CAST` : '');
    if (e.k === 'CAST') lastCast = e.t;
    if (e.k === 'END') lastEnd = e.t;
    console.log(`${String(e.t).padStart(7)}s  g${String(e.g).padStart(6)}  ${e.k.padEnd(5)} ${String(e.move || '').padEnd(13)}${e.hpPhase ? ' hpPhase ' + e.hpPhase : ''}${note}`);
  }
  console.log('lethal zone hazards spawned:', out.ev.filter((e) => e.k === 'zone').length, '· errors:', errs.length ? errs.slice(0, 2).join(' | ') : 'none');
} finally { await browser.close().catch(() => {}); srv.kill(); }
