// THE HUD, POP PUNK INFLUENCED (v0.30.1195). Per user, with a screenshot of the stats card showing bare numbers:
// "This HUD can be more POP punk style influenced, and include the icons that were previously created, keep the
// compact feels". Read from the running game with the user's own numbers (596,543 ATK, 67,490 DEF, 700.4K HP):
//   - PRELOAD: the stats icons are preloaded in <head> (as CSS backgrounds they queued ~40 s behind the boot flood)
//   - COMPACT: ATK / DEF / ACC print compact like HP (596.5K), and every stat icon keeps its width (none squeezed)
//   - INK: the card, bars and wells carry an ink outline (outline survives the low-fx mode that strips box-shadows)
//   - STICKERS: the level badge and live SP pill are butter stickers; HP / MP / EXP carry heart / drop / arrow icons
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/hud_pop_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '12341';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const head = readFileSync(PAGE, 'utf8').split('</head>')[0];
const pre = ['hp', 'mp', 'lvup', 'atk', 'def', 'crit', 'acc', 'setshards', 'kills'].filter((f) => !head.includes('<link rel="preload" as="image" href="Sprites/ui/hud/' + f + '.webp" fetchpriority="high">'));
check(pre.length === 0, 'PRELOAD: every stats icon is preloaded at high priority in <head>', J(pre));
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
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof updateUI === 'function', null, { timeout: 180000 });
  const r = await page.evaluate(async () => {
    const W8 = (ms) => new Promise((res) => setTimeout(res, ms));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu', 'void-intro-overlay']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { tutorial_intro: true, everdawn_welcome: true }); player._tutorialSeen = true;
    applyClass('rogue'); player.level = 99; player.skillPoints = 991;
    // the user's numbers (their screenshot): the stats row overflowed and lost its icons at these sizes
    window.getAtk = () => 596543; window.getDef = () => 67490; window.getCrit = () => 100; player.baseAcc = 3550;
    window.getMaxHp = () => 700400; player.hp = 700400; player.mojicoins = 1415; player.setshards = 299; game.kills = 608;
    loadMap('town', 900); await W8(1200); try { closeAllModals(); } catch (e) {} game.paused = false;
    try { updateUI(); } catch (e) {} await W8(600);
    document.documentElement.classList.remove('lx-nobackdrop');
    const st = document.getElementById('stats'), scs = getComputedStyle(st);
    const icons = [...st.querySelectorAll('.stats-footer .stat-icon')].map((e) => Math.round(e.getBoundingClientRect().width));
    const lv = getComputedStyle(st.querySelector('.lx-idp-lv')), sp = st.querySelector('.lx-idp-sp'), spcs = getComputedStyle(sp);
    const bi = (id) => getComputedStyle(document.getElementById(id), '::before').backgroundImage;
    return {
      text: { atk: document.getElementById('hud-atk').textContent, def: document.getElementById('hud-def').textContent, acc: document.getElementById('hud-acc').textContent, hp: document.getElementById('hp-text').textContent },
      icons, ink: { card: scs.outlineStyle + ' ' + scs.outlineColor, bar: getComputedStyle(st.querySelector('.bar')).outlineStyle, row: getComputedStyle(st.querySelector('.stats-footer-row')).outlineStyle },
      lvBg: lv.backgroundColor, sp: { live: sp.classList.contains('sp-live'), bg: spcs.backgroundColor },
      barIcons: { hp: bi('hp-text'), mp: bi('mp-text'), exp: bi('exp-text') },
      barContent: { hp: getComputedStyle(document.getElementById('hp-text'), '::before').content, mp: getComputedStyle(document.getElementById('mp-text'), '::before').content },
      cardW: Math.round(st.getBoundingClientRect().width),
    };
  });
  check(r.text.atk === '596.5K' && r.text.def === '67.5K' && r.text.acc === '3550' && /700\.4K/.test(r.text.hp), 'COMPACT: ATK / DEF / ACC print compact like HP (596.5K, 67.5K; small numbers stay whole)', J(r.text));
  check(r.icons.length === 7 && r.icons.every((w) => w > 6 && w === r.icons[0]), 'COMPACT: every stat icon keeps its width with six-digit stats (they were squeezed to nothing)', J(r.icons));
  check(/solid rgb\(13, 10, 20\)/.test(r.ink.card) && r.ink.bar === 'solid' && r.ink.row === 'solid', 'INK: the card, the bars and the stat wells carry an ink outline', J(r.ink));
  check(r.lvBg === 'rgb(255, 224, 122)' && r.sp.live && r.sp.bg === 'rgb(255, 224, 122)', 'STICKERS: the level badge and the live SP pill are butter stickers', J({ lv: r.lvBg, sp: r.sp }));
  // d8ba43a4e v0.30.1276 (per user): no heart / droplet before the HP and MP figures - their ::before is content: none;
  // EXP keeps its level-up arrow
  check(r.barContent.hp === 'none' && r.barContent.mp === 'none' && !/hud\/(hp|mp)\.webp/.test(r.barIcons.hp + r.barIcons.mp) && /hud\/lvup\.webp/.test(r.barIcons.exp), 'ICONS: HP / MP carry no icon (v0.30.1276), EXP keeps the level-up arrow', J({ icons: r.barIcons, content: r.barContent }));
  check(r.cardW <= 370, 'COMPACT: the card stays as narrow as before (<= 370 px on screen with these numbers)', r.cardW);
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
