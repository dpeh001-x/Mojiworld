// PHONE DECK: THE RIGHT CLUSTER SITS AT THE RIGHT EDGE (v0.30.1717, per user: "can be positioned more rightward near the end of the
// right border"). The jump, the skill arc and the attack button share one box (.mc-actions); it moved 18px -> 2px from the edge.
//   1. on 740x360, 844x390 and 667x375 landscape phones the attack button ends 10-16px from the right edge
//   2. every button of the cluster is fully on screen, and the arc keeps its shape (each skill sits where it sat beside the attack)
//   3. nothing in the cluster overlaps the D-pad or the quest tracker; no page errors
//   node scripts/mobile_cluster_right_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11902), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
// each skill's offset from the attack button's right/bottom corner, as authored before the move (x, s, c, d, f, v, g, b)
const ARC = { x: [115, -20], s: [102, -68], c: [68, -102], d: [20, -115], f: [170, -48], v: [137, -118], g: [73, -163], b: [-4, -170] };
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 5000));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  for (const [w, h] of [[740, 360], [844, 390], [667, 375]]) {
    const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
      userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36' });
    await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
    const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
    await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadMap === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
    const R = await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
      for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
      applyClass('warrior'); player._tutorialSeen = true; window._lxAutoPause = () => {}; player._gravitosCineSeen = true;
      player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
      await sleep(4000); player.level = 30; loadMap('forest', 300); await sleep(4000);
      for (const el of document.querySelectorAll('[id$="-cine"], #story-beat-overlay, #void-intro-overlay, #kill-film-overlay')) { el.classList.remove('on', 'show'); el.style.display = 'none'; }
      game.paused = false; try { closeAllModals(); } catch (e) {} await sleep(800);
      const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return b.width ? { l: b.left, r: b.right, t: b.top, b: b.bottom } : null; };
      const sk = {}; for (const b of document.querySelectorAll('.mc-skill-grid .mc-btn')) sk[b.dataset.mkey] = r(b);
      return { vw: innerWidth, vh: innerHeight, land: document.body.classList.contains('mc-landscape'), basic: r(document.querySelector('.mc-basic')), jump: r(document.querySelector('.mc-jump')), sk,
        dpad: r(document.querySelector('.mobile-deck .mc-dpad')), tracker: r(document.getElementById('quest-tracker')) };
    });
    const tag = `${w}x${h}`, gap = R.vw - R.basic.r;
    ok(`1. ${tag}: the attack button ends 10-16px from the right edge (landscape deck)`, R.land && gap >= 10 && gap <= 16, { gap: Math.round(gap) });
    const all = [R.basic, R.jump, ...Object.values(R.sk)].filter(Boolean);
    ok(`2a. ${tag}: every cluster button is fully on screen`, all.every((b) => b.l >= 0 && b.r <= R.vw && b.t >= 0 && b.b <= R.vh), all.length);
    const drift = Object.entries(ARC).map(([k, [dx, dy]]) => { const b = R.sk[k]; return b ? Math.abs((R.basic.r - b.r) - dx) + Math.abs((b.b - R.basic.b) - dy) : 99; });
    ok(`2b. ${tag}: the arc keeps its shape beside the attack button`, drift.every((d) => d <= 2), drift.map(Math.round));
    const hit = (a, b) => a && b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
    ok(`3. ${tag}: nothing in the cluster overlaps the D-pad or the quest tracker`, !all.some((b) => hit(b, R.dpad) || hit(b, R.tracker)), { dpad: !!R.dpad, tracker: !!R.tracker });
    await ctx.close();
  }
  ok('no page errors', errs.length === 0, errs);
} finally { await browser.close(); server.kill(); }
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
