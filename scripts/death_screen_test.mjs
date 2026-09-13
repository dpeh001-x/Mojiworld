#!/usr/bin/env node
// The death screen - v0.30.663. Per user: "This page is rather bare generate something AAA standard
// for this, make it sensational".
//
// The redesign rebuilt the overlay's markup, so the checks that matter are the ones that keep a dead
// player able to LEAVE: the ids the rest of the game reaches for by name (#death-overlay,
// #death-sub, #death-loss, #death-respawn-btn), the ticker that rewrites the button's text every
// 200 ms (so the button must stay a plain text node), and the click that actually respawns. The look
// is checked where it can be measured: the key art is served, the killer is named, the toll counts
// to the real figures, and the whole thing is gradients and transforms - no per-frame JS.
//   node scripts/death_screen_test.mjs      MOJI_GAME_FILE / PORT
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 10481);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errs = []; const seen = {};
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
page.on('response', (r) => { if (r.url().includes('death_keyart')) seen.keyart = r.status(); });
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof player === 'object', null, { timeout: 180000 });
  await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    loadMap('forest', 300); await sleep(2200);
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    game.paused = false; game.monsters.length = 0;
    player.mojicoins = 7520; player.exp = 26000; player._lastDamageSource = 'Shardlich';
    player._god = false; player.invulnerable = 0;
    const o = {};
    const coins0 = player.mojicoins | 0, exp0 = player.exp | 0;
    player.hp = 0;
    const ov = document.getElementById('death-overlay');
    // the death sequence runs its burst before the overlay comes up - measured ~5 s, so this waits 15
    for (let i = 0; i < 150 && !ov.classList.contains('on'); i++) await sleep(100);
    o.shown = ov.classList.contains('on');
    await sleep(1600);
    const btn = document.getElementById('death-respawn-btn');
    o.ids = ['death-sub', 'death-loss', 'death-respawn-btn', 'death-slain'].filter((id) => !!document.getElementById(id));
    o.btnIsText = btn ? (btn.children.length === 0) : false;
    o.art = /death_keyart/.test(getComputedStyle(ov.querySelector('.death-art')).backgroundImage);
    o.slain = (document.getElementById('death-slain').textContent || '').trim();
    o.slainShown = !document.getElementById('death-slain').hidden;
    o.plates = [...ov.querySelectorAll('.toll-plate .n')].map((n) => n.textContent);
    // the figures the GAME took, not numbers typed into this test: the coin toll is a share of what
    // was carried and moves with level and class, so a hardcoded 752 fails on a different character
    o.lostCoins = coins0 - (player.mojicoins | 0);
    o.lostExp = (game._pendingExpLoss | 0) || (exp0 - (player.exp | 0));
    o.labels = [...ov.querySelectorAll('.toll-plate .l')].map((n) => n.textContent);
    o.subText = (document.getElementById('death-sub').textContent || '').trim();
    o.layers = ['.death-art', '.death-rift', '.death-fog.f1', '.death-fog.f2', '.death-motes', '.death-vig', '.death-bar.top', '.death-bar.bot'].filter((s) => !!ov.querySelector(s)).length;
    o.moteSpread = new Set([...ov.querySelectorAll('.death-motes i')].map((i) => i.style.left)).size;
    await sleep(900);
    o.tick = btn.textContent;                       // the 200 ms ticker must still be writing this
    // and the click must still get the player out
    btn.click();
    await sleep(1200);
    o.closed = !ov.classList.contains('on');
    o.dying = game.dying | 0;
    o.hpAfter = player.hp;
    return o;
  });
  ok('the overlay opens on death', r.shown === true);
  ok('every id the rest of the game reaches for by name survives the rebuild', r.ids.length === 4, r.ids.join(', '));
  ok('the respawn button is still a plain text node (the ticker overwrites it)', r.btnIsText === true);
  ok('the key art is served and applied as the ground', r.art === true && seen.keyart === 200, 'HTTP ' + seen.keyart);
  ok('all eight scene layers are in the DOM', r.layers === 8, r.layers + '/8');
  ok('the ash motes are scattered, not stacked', r.moteSpread >= 12, r.moteSpread + ' distinct positions');
  ok('the killer is named on its own line', r.slainShown && /shardlich/i.test(r.slain), r.slain);
  ok('...and the prose no longer repeats the name', !/shardlich/i.test(r.subText), r.subText);
  const want = (n) => '−' + n.toLocaleString();
  ok('the toll plates show the figures the game actually took', r.plates.length === 2 && r.plates[0] === want(r.lostCoins) && r.plates[1] === want(r.lostExp),
    r.plates.join(' | ') + '  vs took ' + want(r.lostCoins) + ' / ' + want(r.lostExp));
  ok('the respawn ticker still counts', /\(\d+s\)/.test(r.tick), r.tick);
  ok('clicking respawn closes the overlay and revives the player', r.closed === true && r.dying === 0 && r.hpAfter > 0, `closed ${r.closed}, dying ${r.dying}, hp ${r.hpAfter}`);
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
