// Boss decode bench: what drawing each of a boss's animation sets for the FIRST time costs the main thread,
// deterministically - no AI, no luck about which attack the boss picks.
//
// The arena loads and its real flow runs for T ms (black hold, intro, the boss spawn and whatever prewarm
// the build does). Then the real boss is moved off-screen, and the bench draws it itself, every animation
// frame, at the centre of the game canvas, through the game's own path: _bossPingPongFrame (the picker, which
// also starts the draw-path bakes) and _drawBossSprite. One set at a time, SET_MS each: the form's idle,
// walk and attack sets, its attack variants, then each phase form's sets with m._phaseSprite set to that form.
// A Chrome trace brackets every set with a user-timing mark, so main-thread image decodes are attributed to
// the set that caused them.
//
//   SERVE_ROOT=<dir> MAP=gravitosArena T=11000 SET_MS=1200 node scripts/perf_boss_decode_bench.mjs [candidate.html]
// argv[2] is served by serve.js as /mojiworld_game.html (MOJI_GAME_FILE) - never as a URL path, which would
// 404 every relative Sprites/ path and measure the procedural fallbacks.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn as _spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, _PORT = process.env.PERF_PORT || '9611';
const MAP = process.env.MAP || 'gravitosArena', T = Number(process.env.T || 11000), SET_MS = Number(process.env.SET_MS || 1200);
const PHASES = process.env.PHASES !== '0';
const _env = { ...process.env }; if (process.argv[2]) _env.MOJI_GAME_FILE = process.argv[2]; else delete _env.MOJI_GAME_FILE;
const _srv = _spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), _PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env: _env });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const art404 = []; page.on('response', (r) => { if (r.status() >= 400 && /\/Sprites\//.test(r.url())) art404.push(r.url().replace(/^.*\/Sprites\//, '')); });
let out = null;
try {
  await page.goto('http://localhost:' + _PORT + '/mojiworld_game.html?dev=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _drawBossSprite === 'function', { timeout: 90000 });
  await page.evaluate((MAP) => {
    const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
    window._lxBootGateDone = true; window._prologueActive = false;
    const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
    player.level = 60; player.cls = 'warrior'; player.invulnerable = 9e9; player.hp = 99999; player.maxHp = 99999; player._god = true;
    loadMap(MAP); game.paused = false;
  }, MAP);
  await page.waitForTimeout(T);   // the arena's real flow: load hold, intro, spawn, prewarm
  const cdp = await page.context().newCDPSession(page); const events = [];
  cdp.on('Tracing.dataCollected', (e) => { for (const ev of e.value) events.push(ev); });
  await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline,blink.user_timing', transferMode: 'ReportEvents' });
  out = await page.evaluate(async ({ SET_MS, PHASES }) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (const id of ['story-beat-overlay', 'boss-intro-overlay', 'boss-intro']) { const o = document.getElementById(id); if (o) { o.classList.remove('on'); if (id === 'boss-intro') o.style.display = 'none'; } }
    game.paused = false;
    const m = game.monsters.find((x) => x && x.boss && x.currentHp > 0);
    if (!m) return { err: 'no boss (monsters: ' + game.monsters.map((x) => x && x.type).join(',') + ')' };
    const type = m._phaseSprite || m.type, sign = m.zodiacSign || null;
    const cap = (typeof _lxShrinkCap === 'function') ? _lxShrinkCap(720) : 1104;
    // the sets, in the order a fight meets them
    const sets = [];
    const add = (label, a, form, isAtk) => { if (Array.isArray(a) && a.length && !sets.some((s) => s.a === a)) sets.push({ label, a, form, isAtk }); };
    const letter = (k, base) => k.length > base.length && k.indexOf(base) === 0 && (k.charCodeAt(base.length) >= 97 && k.charCodeAt(base.length) <= 122);
    const digit = (k, base) => k.length > base.length && k.indexOf(base) === 0 && (k.charCodeAt(base.length) >= 48 && k.charCodeAt(base.length) <= 57);
    if (sign && typeof ZODIAC_IDLE_FRAMES !== 'undefined') {
      add('zodiac idle', ZODIAC_IDLE_FRAMES[sign], null, false); add('zodiac walk', ZODIAC_WALK_FRAMES[sign], null, false); add('zodiac attack', ZODIAC_ATTACK_FRAMES[sign], null, true);
      for (const [n, st] of [['charge', typeof ZODIAC_CHARGE_FRAMES !== 'undefined' && ZODIAC_CHARGE_FRAMES], ['pounce', typeof ZODIAC_POUNCE_FRAMES !== 'undefined' && ZODIAC_POUNCE_FRAMES], ['fly', typeof ZODIAC_FLY_FRAMES !== 'undefined' && ZODIAC_FLY_FRAMES]]) if (st) add('zodiac ' + n, st[sign], null, true);
    } else {
      add(type + ' idle', BOSS_IDLE_FRAMES[type], null, false); add(type + ' walk', BOSS_WALK_FRAMES[type], null, false); add(type + ' attack', BOSS_ATTACK_FRAMES[type], null, true);
      for (const k of Object.keys(BOSS_ATTACK_FRAMES)) if (letter(k, type)) add(k, BOSS_ATTACK_FRAMES[k], null, true);
      if (PHASES) {
        const forms = [...new Set(Object.keys(BOSS_IDLE_FRAMES).concat(Object.keys(BOSS_ATTACK_FRAMES)).filter((k) => digit(k, type)).map((k) => k.match(new RegExp('^' + type + '\\d+'))[0]))];
        for (const f of forms) {
          add(f + ' idle', BOSS_IDLE_FRAMES[f], f, false); add(f + ' walk', BOSS_WALK_FRAMES[f], f, false); add(f + ' attack', BOSS_ATTACK_FRAMES[f], f, true);
          for (const k of Object.keys(BOSS_ATTACK_FRAMES)) if (letter(k, f)) add(k, BOSS_ATTACK_FRAMES[k], f, true);
        }
      }
    }
    const state = (a) => { let raw = 0, baked = 0; for (const im of a) { if (!im) continue; if (im.tagName === 'IMG') { if (Math.max(im.naturalWidth, im.naturalHeight) > cap) raw++; } else baked++; } return { raw, baked, n: a.length }; };
    // raw over-cap blits inside the boss draw = main-thread decodes waiting to happen
    let inBoss = 0, rawBlits = 0;
    const P = CanvasRenderingContext2D.prototype, od = P.drawImage;
    const rawStacks = {};
    P.drawImage = function (im) { if (inBoss > 0 && im && im.tagName === 'IMG' && Math.max(im.naturalWidth, im.naturalHeight) > cap) { rawBlits++; const st = (new Error().stack || '').split(String.fromCharCode(10)).slice(2, 6).map((l) => (l.match(/at ([^ (]+)/) || [])[1] || '?').join('<'); rawStacks[st] = (rawStacks[st] || 0) + 1; } return od.apply(this, arguments); };
    const realX = m.x; m.x = -99999;   // the game culls the real boss; the bench draws it
    const W0 = (typeof W !== 'undefined') ? W : 960, H0 = (typeof H !== 'undefined') ? H : 560;
    const res = [];
    for (const s of sets) {
      const before = state(s.a);
      const savedForm = m._phaseSprite; if (s.form) m._phaseSprite = s.form;
      const gaps = []; let last = performance.now(); const b0 = rawBlits;
      performance.mark('bench:' + s.label);
      const t0 = performance.now();
      await new Promise((resolve) => {
        const step = () => {
          const now = performance.now(); gaps.push(now - last); last = now;
          try {
            const fr = _bossPingPongFrame(s.a, 70);
            if (fr) { ctx.save(); inBoss++; try { _drawBossSprite(fr, m, W0 / 2 - m.w / 2, H0 / 2 - m.h / 2, s.isAtk, true); } finally { inBoss--; ctx.restore(); } }
          } catch (e) { s.err = String(e.message).slice(0, 80); }
          if (now - t0 < SET_MS) requestAnimationFrame(step); else resolve();
        };
        requestAnimationFrame(step);
      });
      m._phaseSprite = savedForm;
      const g = gaps.slice(1).sort((p, q) => p - q);
      res.push({ label: s.label, frames: g.length, slow: g.filter((x) => x > 33).length, worst: +(g[g.length - 1] || 0).toFixed(1), p95: +(g[Math.floor(g.length * 0.95)] || 0).toFixed(1), rawBlits: rawBlits - b0, before, after: state(s.a), err: s.err });
    }
    performance.mark('bench:end');
    P.drawImage = od; m.x = realX;
    return { rawStacks, type, sign, cap, res, ver: typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : '' };
  }, { SET_MS, PHASES });
  await cdp.send('Tracing.end'); await new Promise((r) => cdp.once('Tracing.tracingComplete', r));
  if (out.err) { console.log('ERR ' + out.err); process.exit(1); }
  const mains = new Set(events.filter((e) => e.name === 'thread_name' && e.args && e.args.name === 'CrRendererMain').map((e) => e.pid + ':' + e.tid));
  const marks = events.filter((e) => /^bench:/.test(e.name) && (e.ph === 'R' || e.ph === 'I' || e.ph === 'n' || e.ph === 'b')).sort((a, b) => a.ts - b.ts);
  const dec = events.filter((e) => e.ph === 'X' && e.dur != null && mains.has(e.pid + ':' + e.tid) && /^Decode Image$|ImageDecodeTask|Decode LazyPixelRef/.test(e.name));
  const byMark = {};
  for (let i = 0; i < marks.length - 1; i++) {
    const a = marks[i], b = marks[i + 1], label = a.name.slice(6);
    const d = dec.filter((e) => e.ts >= a.ts && e.ts < b.ts && e.name !== 'Decode LazyPixelRef');   // LazyPixelRef nests inside Decode Image: count one
    byMark[label] = { n: d.length, ms: d.reduce((s, e) => s + e.dur / 1000, 0), max: d.reduce((s, e) => Math.max(s, e.dur / 1000), 0) };
  }
  console.log(`${out.ver} map ${MAP} boss ${out.type}${out.sign ? ' (' + out.sign + ')' : ''}, cap ${out.cap}px, bench after ${T} ms of the arena's own flow${art404.length ? '; WARNING ' + art404.length + ' art 404s' : ''}${marks.length < 2 ? '; WARNING no trace marks' : ''}`);
  console.log('set                          raw>cap before  baked  | frames slow  p95   worst | raw blits | main decodes');
  let tot = { slow: 0, raw: 0, n: 0, ms: 0, max: 0 };
  for (const r of out.res) {
    const d = byMark[r.label] || { n: 0, ms: 0, max: 0 };
    tot.slow += r.slow; tot.raw += r.rawBlits; tot.n += d.n; tot.ms += d.ms; tot.max = Math.max(tot.max, d.max);
    console.log(`${r.label.padEnd(28)} ${String(r.before.raw + '/' + r.before.n).padStart(13)} ${String(r.after.baked).padStart(6)}  | ${String(r.frames).padStart(6)} ${String(r.slow).padStart(4)} ${String(r.p95).padStart(5)} ${String(r.worst).padStart(7)} | ${String(r.rawBlits).padStart(9)} | ${d.n}x ${d.ms.toFixed(0)} ms (max ${d.max.toFixed(1)})${r.err ? ' ERR ' + r.err : ''}`);
  }
  console.log(`TOTAL sets ${out.res.length}: slow frames ${tot.slow}, raw over-cap blits ${tot.raw}, main-thread decodes ${tot.n}x ${tot.ms.toFixed(0)} ms (max ${tot.max.toFixed(1)})`);
  for (const [k, n] of Object.entries(out.rawStacks || {}).sort((p, q) => q[1] - p[1]).slice(0, 8)) console.log('raw blit from ' + k + ' x' + n);
  console.log('JSON ' + JSON.stringify({ map: MAP, T, boss: out.type, sign: out.sign, art404: art404.length, marks: marks.length, slow: tot.slow, raw: tot.raw, decodes: tot.n, decodeMs: Math.round(tot.ms), decodeMax: +tot.max.toFixed(1),
    sets: out.res.map((r) => { const d = byMark[r.label] || { n: 0, ms: 0 }; return { label: r.label, phase: !!out.res.find((x) => x.label === r.label) && /\d/.test(r.label.replace(out.type, '').split(' ')[0]), rawBefore: r.before.raw, n: r.before.n, rawBlits: r.rawBlits, decodes: d.n, decodeMs: Math.round(d.ms), slow: r.slow, worst: r.worst, err: r.err || null }; }),
    rawStacks: out.rawStacks }));
} finally { await browser.close(); _srv.kill(); }
