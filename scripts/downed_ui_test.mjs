// A down shows the DOWNED card and reads 0 HP on the HUD (v0.30.x downed-ui).
//   node scripts/downed_ui_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Per user: "when I am downed it puts my HP as 1 instead of 0 and does not show the DOWNED UI HUD". Each case takes a
// lethal hit through the real revive chain (hp 0 -> _tryCheatDeathRevive -> _coopTryDowned) and reads the card + HUD.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11535';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await p.route((u) => /[/](Sprites|backgrounds|audio|assets|data)[/]/.test(u.pathname), async (r) => {   // art missing from the working copy comes from origin
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 26 }) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof _coopTryDowned === 'function' && typeof _tryCheatDeathRevive === 'function', null, { timeout: 150000 });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; window._prologuePending = false; player.cls = 'warrior'; player.level = 20;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    loadMap('forest'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    try { if (typeof _closeTutorial === 'function') _closeTutorial(false); } catch (e) {}
    window.__frames = async (n, capMs) => { const g0 = game.time | 0, t0 = performance.now(); while ((game.time | 0) - g0 < n && performance.now() - t0 < capMs) await new Promise((r) => setTimeout(r, 16)); return (game.time | 0) - g0; };
    // one down, read back: the card, its countdown, the HUD number + bar, and the held hp inside
    window.__down = async (setup) => {
      player._downed = false; player._downedSilent = false; player._noDownUntil = 0; document.getElementById('coop-downed-banner')?.remove();
      document.body.classList.remove('sb-active'); const tut = document.getElementById('tutorial-modal'); if (tut) tut.style.display = 'none';
      game.monsters.length = 0; player.hp = getMaxHp(); await __frames(10, 4000);
      setup();
      player.invulnerable = 0; player.hp = 0; const went = _tryCheatDeathRevive();
      const ran = await __frames(30, 8000);
      const b = document.getElementById('coop-downed-banner'), bs = b ? getComputedStyle(b) : null;
      const secs = (document.getElementById('coop-downed-secs') || {}).textContent || null;
      const hpText = (document.getElementById('hp-text') || {}).textContent || '';
      const bar = document.getElementById('hp-bar'); const barW = bar ? parseFloat(bar.style.width) : null;
      const out = { went, ran, downed: !!player._downed, silent: !!player._downedSilent, hp: player.hp, hpText, barW, secs,
        card: !!(b && bs.display !== 'none' && bs.visibility !== 'hidden' && +bs.opacity > 0.05) };
      // stand back up for the next case (no death flow in between)
      player._downed = false; player._downedSilent = false; player.hp = getMaxHp(); document.getElementById('coop-downed-banner')?.remove();
      document.body.classList.remove('sb-active'); if (tut) tut.style.display = 'none'; await __frames(10, 4000);
      return out;
    };
  });
  const zero = (r) => /^0 \//.test(r.hpText) && r.barW === 0;
  // 1) an ordinary down, tour done
  const a = await p.evaluate(() => __down(() => { player._tutorialSeen = true; }));
  check(a.downed && a.card && zero(a) && a.hp === 1, 'an ordinary down shows the DOWNED card, and the HUD reads 0 HP (hp held at 1 inside)', a);
  // 2) the reported case: this character's tour flag was never stamped, and no tour is on screen
  const b = await p.evaluate(() => __down(() => { player._tutorialSeen = false; }));
  check(b.downed && b.card && !b.silent, 'a character whose tour flag was never stamped still gets the DOWNED card (it was a silent down forever)', b);
  check(zero(b), 'that down reads 0 HP on the HUD too', b);
  check(/^\d+s$/.test(b.secs || '') && +(b.secs || '0').replace('s', '') > 5, 'and it is the full down window, not the 5 s onboarding one', b);
  // 3) a story beat is playing: the card stays out of the cinematic
  const c = await p.evaluate(() => __down(() => { player._tutorialSeen = true; document.body.classList.add('sb-active'); }));
  check(c.downed && c.silent && !c.card, 'during a story beat the down stays silent (the card would sit over the cinematic)', c);
  // 4) the tour card is on screen: the short onboarding down, but with the card and its countdown
  const d = await p.evaluate(() => __down(() => { player._tutorialSeen = false; const t = document.getElementById('tutorial-modal'); if (t) { t.hidden = false; t.style.display = 'block'; } }));
  check(d.downed && d.card && /^[1-5]s$/.test(d.secs || ''), 'during the tour the down keeps its short window but shows the card and countdown', d);
  // 5) standing up again: the HUD shows the real HP (the 0 is only while downed)
  const e = await p.evaluate(async () => { player._downed = false; player.hp = 123; await __frames(15, 5000); return { hpText: (document.getElementById('hp-text') || {}).textContent || '', barW: parseFloat((document.getElementById('hp-bar') || { style: {} }).style.width) }; });
  check(/^123 \//.test(e.hpText) && e.barW > 0, 'up again, the HUD shows the real HP', e);
  check(errs.length === 0, 'no page errors', errs);
} finally { await browser.close(); srv.kill(); }
console.log('');
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
