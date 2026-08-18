// The world must stay still while the loading screen is still up.
//
// Per user: "at the login screen, i clicked my char, nothing loaded, skills
// play when i press keys i can hear sound effects, same with photomode" —
// then, on being shown the cause: "yes keep the game paused during that hold".
//
// After the click, _finishHide runs a sprite gate that can hold the overlay for
// up to 120 s while art finishes decoding, and the world behind it has already
// been handed to the player. Skills are cast from the keydown handler and the
// key-poll loop, both of which only ask game.paused — so during the hold a
// keypress really does fire a skill, play its sound and burn its cooldown while
// the screen is still black. That is the symptom, and that is what is measured
// here: real keydown events through the real handlers, counted at castSkill and
// audio.play.
//
// Driven through the actual title menu (the gate lives inside the boot IIFE and
// cannot be called directly), with a never-completing image injected into the
// watch list so the hold reliably engages.
//   node scripts/boot_gate_pause_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const net = await import('node:net');
const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function', null, { timeout: 120000 });

// The title menu mounts behind a decode gate capped at 30s.
await page.waitForFunction(() => { const a = document.getElementById('lo-auth'); return a && a.classList.contains('shown'); },
  null, { timeout: 90000 });

// Count every skill cast and every sound, through whatever path reaches them.
await page.evaluate(() => {
  window.__casts = []; window.__sounds = [];
  const realCast = window.castSkill;
  window.castSkill = function (id) { window.__casts.push(id); return realCast.apply(this, arguments); };
  try {
    const realPlay = audio.play.bind(audio);
    audio.play = function (n) { window.__sounds.push(n); return realPlay.apply(this, arguments); };
  } catch (e) {}
  // Make the gate hold: one watched image that never completes.
  const stuck = new Image();
  Object.defineProperty(stuck, 'complete', { get: () => false });
  stuck.src = 'Sprites/ui/panel_pause.webp?hold=' + Math.random();
  window._lxSpriteWatch = [stuck];
  window._lxSpriteGateDone = false;
  window._lxSpriteGateHolding = false;
  window._prologueActive = false;
  game.paused = false;                       // the world is running pre-click
});

// Click the real menu entry.
await page.evaluate(() => {
  const c = document.getElementById('menu-continue');
  if (c && !c.hidden) { c.click(); return; }
  document.getElementById('menu-newgame').click();
});
await page.waitForTimeout(400);
await page.evaluate(() => {
  const np = document.getElementById('menu-name-panel');
  if (np && !np.hidden) { document.getElementById('auth-user').value = 'Loser'; document.getElementById('auth-submit').click(); }
});
await page.waitForTimeout(1200);

await page.evaluate(() => {
  try { player.cls = 'warrior'; player.level = 30; player.hp = getMaxHp(); player.mp = 9999;
        player.hitStun = 0; player.skillCooldowns = {}; } catch (e) {}
  window.__casts.length = 0; window.__sounds.length = 0;
});

// Press skill keys the way a confused player would: real events, real handlers.
const mash = async () => {
  for (const k of ['z', 'x', 's', 'c']) {
    await page.keyboard.down(k); await page.waitForTimeout(90); await page.keyboard.up(k);
  }
  await page.waitForTimeout(400);
};
await mash();

const held = await page.evaluate(() => ({
  holding: !!window._lxSpriteGateHolding,
  paused: game.paused,
  overlayUp: (() => { const o = document.getElementById('loading-overlay');
    return !!o && getComputedStyle(o).display !== 'none' && +getComputedStyle(o).opacity > 0.05; })(),
  casts: window.__casts.slice(), sounds: window.__sounds.slice(),
  cdSpent: Object.keys(player.skillCooldowns || {}).filter(k => player.skillCooldowns[k] > 0),
}));
console.log('DURING HOLD:', JSON.stringify(held));

// Latch a key, then let the gate finish.
await page.keyboard.down('d');
const after = await page.evaluate(async () => {
  window._lxSpriteWatch = [];
  await new Promise(r => setTimeout(r, 1800));
  return { holding: !!window._lxSpriteGateHolding, done: !!window._lxSpriteGateDone,
    paused: game.paused, keysLatched: Object.keys(game.keys || {}).filter(k => game.keys[k]) };
});
console.log('AFTER RELEASE:', JSON.stringify(after));

// And the game is genuinely playable again once the screen is gone.
await page.evaluate(() => { window.__casts.length = 0; try { player.skillCooldowns = {}; player.mp = 9999; } catch (e) {} });
await mash();
const live = await page.evaluate(() => ({ casts: window.__casts.slice() }));
console.log('AFTER, MASHING AGAIN:', JSON.stringify(live));
await b.close(); try { srv.kill(); } catch (e) {}

ok('the sprite gate engages its hold after the click', held.holding === true, { holding: held.holding });
ok('the loading screen is genuinely still up during the hold', held.overlayUp === true, {});
ok('the world is PAUSED while it holds', held.paused === true, { paused: held.paused });
ok('no skill fires from a keypress during the hold — the reported bug',
   held.casts.length === 0, { casts: held.casts });
ok('...so no sound effects play behind the black screen',
   held.sounds.length === 0, { sounds: held.sounds.slice(0, 6) });
ok('...and no cooldowns are spent', held.cdSpent.length === 0, { spent: held.cdSpent });
ok('the hold releases once the sprites finish', after.holding === false && after.done === true, after);
ok('the pause state it found is restored (was running -> runs again)', after.paused === false, { after: after.paused });
ok('keys latched during the black screen are dropped so the hero does not bolt',
   after.keysLatched.length === 0, { latched: after.keysLatched });
ok('the game is fully playable once the screen is gone (skills cast again)',
   live.casts.length > 0, { casts: live.casts });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
