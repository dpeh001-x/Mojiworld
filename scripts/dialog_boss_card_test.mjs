// THE BOSS ARENA CARD, TAGGED (v0.30.981).
//
// Per user, on the v0.30.979 card: "Add the 1px pale keyline inside the black on the boss card. The
// graffiti can put around the boss silhouette instead of inside. Can stylise the hazard sign and the round
// purple circle, make it graffiti, more artistic." Reads the live "Boss Arena Ahead" card (opened the way
// tryPortal opens it, with the boss shade):
//   - the ink layer's ::after is a 1 px pale ring drawn with polygon(evenodd) inside the black stroke
//   - the ink layer's ::before carries the spray: an aura plus at least sixteen paint hits, none of them
//     centred where the silhouette stands (x > 70% and y > 40% of the box)
//   - the badge is a spray blob (no radius, no ring, transparent colour, nine gradient dots) tilted six
//     degrees with a stencilled triangle in its pseudo-elements and the emoji glyph hidden
//   - the white paper plate stays hidden and the black stroke stays; an ordinary NPC card is untouched
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/dialog_boss_card_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11363';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const src = readFileSync(PAGE, 'utf8');
check(src.includes('THE BOSS CARD, TAGGED PROPERLY') && /#dialog\.boss-arena \.dlg-ink::after \{[\s\S]{0,400}polygon\(evenodd,/.test(src), 'static: the keyline block is present (evenodd ring on the ink layer)');
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, MOJI_GAME_FILE: PAGE } });
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } });
await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _openConfirmDialog === 'function', null, { timeout: 180000 });
  const r = await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { tutorial_intro: true, everdawn_welcome: true }); player._tutorialSeen = true;
    applyClass('warrior'); player.level = 60; player.talents = { warrior: 'x' }; player._tutorialSeen = true;
    try { closeAllModals(); } catch (e) {}
    loadMap('sauroSlope', 300); await new Promise((r) => setTimeout(r, 1500)); try { closeAllModals(); } catch (e) {} game.paused = false;
    document.documentElement.classList.remove('lx-nobackdrop');
    const sh = (typeof _arenaBossSpriteUrl === 'function') ? _arenaBossSpriteUrl(MAPS.krookThrone) : null;
    _openConfirmDialog('\u26a0 Boss Arena Ahead', 'Step into Krook Throne? A boss awaits.', 'Enter the arena', () => { closeDialog(); }, 'Not yet', closeDialog, sh ? { bossSprite: sh } : null);
    await new Promise((r) => setTimeout(r, 300));
    const dlg = document.getElementById('dialog'), ink = dlg.querySelector(':scope > .dlg-ink'), skin = dlg.querySelector(':scope > .dlg-skin'), port = document.getElementById('dialog-portrait');
    const ka = getComputedStyle(ink, '::after'), kb = getComputedStyle(ink, '::before'), sb = getComputedStyle(skin, '::before'), sa = getComputedStyle(skin, '::after');
    const cp = getComputedStyle(port), pb = getComputedStyle(port, '::before'), pa = getComputedStyle(port, '::after');
    // where the paint hits are centred: parse "circle at X% Y%"
    const hits = [...kb.backgroundImage.matchAll(/circle at ([\d.]+)% ([\d.]+)%/g)].map((m) => [+m[1], +m[2]]);
    return { bossArena: dlg.classList.contains('boss-arena'), shade: dlg.style.getPropertyValue('--boss-shade').slice(0, 20),
      keyline: { content: ka.content, clip: ka.clipPath.slice(0, 18), bg: ka.backgroundColor, blend: ka.mixBlendMode },
      // Chrome serialises radial sizes without the 'ellipse' keyword: "radial-gradient(42% 58% at 84% 78%, ..." / "(2.2px 22px at ..."
      // v0.30.982 - per user the spray went back BEHIND the silhouette (the v0.30.979 arrangement): a halo at 84% 82%,
      // hits in the bottom-right where the boss stands, drips, and the light scatter in the top-left corner
      spray: { hits: hits.length, onBoss: hits.filter(([x, y]) => x > 70 && y > 40).length, corner: hits.filter(([x, y]) => x < 30 && y < 30).length, aura: /radial-gradient\((ellipse )?38% 50% at 84% 82%/.test(kb.backgroundImage), drips: (kb.backgroundImage.match(/radial-gradient\((ellipse )?[\d.]+px [\d.]+px at/g) || []).length },
      frame: { plate: sb.display, stroke: sa.backgroundColor },
      // v0.30.983 - the hazard tape along the floor of the box, in the ink layer's own background; no monogram (per user)
      tape: { strip: /repeating-linear-gradient\(135deg, rgba\(255, 210, 63, 0\.62\)/.test(getComputedStyle(ink).backgroundImage), sized: /100% 10px/.test(getComputedStyle(ink).backgroundSize), monogram: /data:image\/svg\+xml/.test(getComputedStyle(ink).backgroundImage) },
      badge: { radius: cp.borderTopLeftRadius, shadow: cp.boxShadow, bgColor: cp.backgroundColor, dots: (cp.backgroundImage.match(/radial-gradient/g) || []).length, fontSize: cp.fontSize, transform: cp.transform,
        tri1: pb.clipPath, tri1bg: pb.backgroundColor, tri2: pa.clipPath, tri2bg: pa.backgroundColor, mark: pa.content, outline: /drop-shadow\(rgb\(12, 11, 16\) 1\.6px/.test(cp.filter) } };
  });
  check(r.bossArena && r.shade.startsWith('url('), 'the arena confirm opens as a boss card with its silhouette', J({ bossArena: r.bossArena, shade: r.shade }));
  check(r.keyline.content !== 'none' && /^polygon\(evenodd/.test(r.keyline.clip) && /rgba\(240, 232, 255/.test(r.keyline.bg) && r.keyline.blend === 'normal', 'KEYLINE: a 1 px pale evenodd ring on the ink layer, inside the black stroke', J(r.keyline));
  check(r.spray.hits >= 12 && r.spray.onBoss >= 4 && r.spray.corner >= 3 && r.spray.aura && r.spray.drips >= 3, 'SPRAY: the halo and the hits behind the silhouette, drips, a light scatter in the far corner (the first arrangement, per user)', J(r.spray));
  check(r.frame.plate === 'none' && /rgb\(12, 11, 16\)/.test(r.frame.stroke), 'FRAME: the paper stays hidden, the stroke stays black', J(r.frame));
  check(r.tape.strip && r.tape.sized && !r.tape.monogram, 'TAPE: a 10 px hazard stripe along the floor of the box, and no monogram behind the speech', J(r.tape));
  check(r.badge.radius === '0px' && r.badge.shadow === 'none' && /rgba\(0, 0, 0, 0\)/.test(r.badge.bgColor) && r.badge.dots >= 9 && r.badge.fontSize === '0px' && r.badge.transform !== 'none' && r.badge.outline, 'BADGE: a tilted spray blob - no disc, no ring, nine dots, the emoji hidden, a 1.6 px black line', J({ radius: r.badge.radius, dots: r.badge.dots, fontSize: r.badge.fontSize, outline: r.badge.outline }));
  check(/polygon\(50% 0(px|%)?, 100% 100%, 0(px|%)? 100%\)/.test(r.badge.tri1) && /rgb\(12, 11, 16\)/.test(r.badge.tri1bg) && /polygon\(50% 0/.test(r.badge.tri2) && /rgb\(255, 210, 63\)/.test(r.badge.tri2bg) && r.badge.mark === '"!"', 'BADGE: a stencilled hazard triangle - black under yellow, a "!" on it', J({ tri1: r.badge.tri1, tri2bg: r.badge.tri2bg, mark: r.badge.mark }));
  // an ordinary NPC card is untouched by all of this
  const npc = await page.evaluate(async () => {
    closeDialog(); loadMap('town', 300); await new Promise((r) => setTimeout(r, 1200)); try { closeAllModals(); } catch (e) {} game.paused = false;
    const milo = (game.npcs || []).find((n) => n && n.role === 'usher'); if (!milo) return { no: 'no Milo' };
    openNPC(milo); await new Promise((r) => setTimeout(r, 300));
    const dlg = document.getElementById('dialog'), ink = dlg.querySelector(':scope > .dlg-ink'), port = document.getElementById('dialog-portrait');
    const ka = getComputedStyle(ink, '::after'), cp = getComputedStyle(port);
    const out = { bossArena: dlg.classList.contains('boss-arena'), keyline: ka.content, figure: dlg.classList.contains('dlg-figure'), portRadius: cp.borderTopLeftRadius, portFont: cp.fontSize };
    closeDialog(); return out;
  });
  check(!npc.no && !npc.bossArena && npc.keyline === 'none' && npc.figure && npc.portFont !== '0px', 'an ordinary NPC card carries none of it (no keyline, figure layout intact)', J(npc));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
