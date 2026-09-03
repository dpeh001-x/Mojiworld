// CRUSADER BASTION: a tap always counts.
// ============================================================================
// Per user (with a video): "B skill can spam as many time without resulting
// in any effect". The video: Bastion armed once, every later B press did
// nothing, and the release finally came ~15s later — the auto-eruption.
//
// Mechanism: a crusader's slot keys go through the warrior CHARGE system. A
// stale charge on ANOTHER key (kept alive by a stuck key state — a keyup that
// landed while an input had focus was dropped before the key state was
// cleared) made tryStartClassCharge answer "already charging" to every press,
// and the release of B never matched it. Fixes: a different key's charge is
// replaced; keyup always clears the key state; Bastion's own "same press"
// guard is a 200ms debounce, not a key-state read; a blocked release says why.
// Run: node scripts/bastion_release_test.mjs   (MOJI_GAME_FILE / MOJI_SERVE_ROOT override)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 9877);
const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const SERVE_JS = existsSync(path.join(SERVE_ROOT, 'serve.js')) ? path.join(SERVE_ROOT, 'serve.js') : path.join(ROOT, 'serve.js');
const server = spawn(process.execPath, [SERVE_JS, String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT });
await new Promise((r) => setTimeout(r, 1200));
const EXE = [process.env.PW_EXE, process.env.MOJI_PW_EXE,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));
const browser = await chromium.launch({ channel: EXE ? undefined : 'msedge', executablePath: EXE || undefined, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 150)));
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof game === 'object' && typeof castSkill === 'function', null, { timeout: 180000 });
await page.waitForTimeout(7000);
await page.evaluate(() => { window._lxBootGateDone = true; window._prologueActive = false; });
await page.fill('#hero-name-input', 'Bastion').catch(() => {});
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal'); if (!m) return;
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3 || getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 220) });
const ev = async (fn, arg) => { try { return await page.evaluate(fn, arg); } catch (e) { return { err: String(e).slice(0, 160) }; } };
const reset = () => page.evaluate(() => { player._bastionArmedUntil = 0; player._bastionArmHeld = false; player._warCharge = null; player.skillCooldowns.crusader_ult = 0; player._judgeStacks = 5; player.mp = 2000; player.frozenTimer = 0; player._cancerBubble = 0; player.hitStun = 0; for (const k in game.keys) game.keys[k] = false; });
await page.evaluate(() => {
  game.paused = false; player.level = 90; player.master = 'crusader'; player.job = 'knight'; player.cls = 'warrior';
  player.mp = 2000; player.maxMp = 2000; player._judgeStacks = 5; player.hp = player.maxHp = 40000; player._god = true;
  player.skillCooldowns = player.skillCooldowns || {}; player.skillCooldowns.crusader_ult = 0;
  try { _sbSlots.b = Object.assign(_sbSlots.b || {}, { skill: 'crusader_ult' }); } catch (e) {}
  window._toasts = []; const _st = window.showToast; window.showToast = (t, k) => { window._toasts.push(String(t)); try { _st(t, k); } catch (e) {} };
});
const armed = () => page.evaluate(() => (player._bastionArmedUntil | 0) > game.time);
const released = () => page.evaluate(() => (player._bastionArmedUntil | 0) === 0 && (player.skillCooldowns.crusader_ult | 0) > 0);

// 1. the video: a stale charge on ANOTHER key (stuck key state) — B must still arm and release
await reset();
await page.evaluate(() => { const other = Object.keys(KEY_TO_SLOT).find((k) => KEY_TO_SLOT[k] && KEY_TO_SLOT[k] !== 'b' && KEY_TO_SLOT[k] !== 'd') || 'v'; game.keys[other] = true; player._warCharge = { slotKey: other, start: game.time - 300, skillId: 'stale', power: 1, cls: 'warrior', frames: 60 }; window._staleKey = other; });
await page.keyboard.press('b'); await page.waitForTimeout(150);
const a1 = await armed();
await page.waitForTimeout(500); await page.keyboard.press('b'); await page.waitForTimeout(200);
const r1 = await released();
ok('with a stale charge stuck on another key, B still ARMS (the video\'s dead-B state)', a1, `armed ${a1}`);
ok('...and a second tap RELEASES it (no more waiting 15s for the auto-eruption)', r1, `released ${r1}`);

// 2. a keyup that lands while an input has focus still clears the key state
await reset();
const k2 = await ev(async () => {
  const inp = document.createElement('input'); inp.id = '_t_inp'; document.body.appendChild(inp);
  document.body.focus();
  return true;
});
await page.keyboard.down('b'); await page.waitForTimeout(60);
const downB = await page.evaluate(() => !!game.keys.b);
await page.evaluate(() => document.getElementById('_t_inp').focus());
await page.keyboard.up('b'); await page.waitForTimeout(60);
const upB = await page.evaluate(() => { const v = !!game.keys.b; document.getElementById('_t_inp').remove(); document.body.focus(); return v; });
ok('a keyup swallowed by a focused input still clears the key (the way keys got stuck)', !k2.err && downB && !upB, k2.err || `down ${downB} -> after keyup in input ${upB}`);

// 3. the "same press" guard is a 200ms debounce, not a key-state read
await reset();
const g = await ev(() => {
  castSkill('crusader_ult');                                  // arm
  const armedAt = (player._bastionArmedUntil | 0) > game.time;
  game.keys.b = true; player._bastionArmHeld = true;          // pretend the key state is stuck DOWN
  castSkill('crusader_ult');                                  // same press, 0 frames later: must NOT release
  const stillArmed = (player._bastionArmedUntil | 0) > game.time;
  game.time += 13;                                            // 200ms later: a stuck key state must not matter
  castSkill('crusader_ult');
  const releasedLater = (player._bastionArmedUntil | 0) === 0 && (player.skillCooldowns.crusader_ult | 0) > 0;
  game.keys.b = false;
  return { armedAt, stillArmed, releasedLater };
});
ok('a re-entry within 200ms of the arm is the same press (no release); 200ms later it releases even with a stuck key state', !g.err && g.armedAt && g.stillArmed && g.releasedLater, g.err || JSON.stringify(g));

// 4. a blocked release explains itself
await reset();
await page.evaluate(() => { castSkill('crusader_ult'); player.frozenTimer = 1500; window._toasts.length = 0; });
await page.keyboard.press('b'); await page.waitForTimeout(150);
const t4 = await page.evaluate(() => ({ armed: (player._bastionArmedUntil | 0) > game.time, toast: window._toasts.find((t) => /Bastion is armed/.test(t)) || null }));
ok('a B press while frozen keeps the arm and says why the release is blocked', t4.armed && /frozen/.test(t4.toast || ''), JSON.stringify(t4));

// 5. the ordinary tap-tap still works, and rapid spam ends in a release, not silence
await reset(); await page.evaluate(() => { player.frozenTimer = 0; });
await page.keyboard.press('b'); await page.waitForTimeout(400);
for (let i = 0; i < 4; i++) { await page.keyboard.press('b'); await page.waitForTimeout(220); }
const r5 = await released();
ok('tap, then spam: the Bastion releases (never "no effect")', r5, `released ${r5}`);
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' · '));

await browser.close(); server.kill();
let fail = 0;
for (const x of res) { if (!x.pass) fail++; console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.extra ? '  — ' + x.extra : '')); }
console.log(`\n${res.length - fail}/${res.length} checks passed`);
process.exit(fail ? 1 : 0);
