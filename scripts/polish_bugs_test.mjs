// FINAL POLISH, SECOND PASS - BUGS (audit C4, R3, U7, A8; per user "continue working on bugs and final polish touches").
// A dead boss's body is gone in about a second (it stood 10 s: ms constants against a frame clock) while a mob keeps
// its 0.83 s; Sagittarius's arrows wear the arrow art instead of a yellow blob; a dangerous confirm focuses Cancel and
// Erase takes a backup first; the Fiery Hideout and the Bastion's Rampart play their neighbours' tracks.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/polish_bugs_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11214';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _drawFadingMonsters === 'function', null, { timeout: 120000 });
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.level = 40; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    loadMap('forest', 300); await sleep(2000); try { closeAllModals(); } catch (e) {} game.paused = true;
    // C4 - fade a real boss and a real mob, read the fade list at fixed ages (frames) in one synchronous pass
    const mk = (type, boss) => { spawnMonster(player.x + 150, player.y - 40, type, boss, false); const m = game.monsters.pop(); return m; };
    const at = (m, frames) => { game._fadingMonsters = []; _beginMonsterFade(m); m._fadeStart = game.time - frames; _drawFadingMonsters(); return game._fadingMonsters.includes(m); };
    const b = mk('mooma', true), s = mk('slime', false);
    out.boss = { f30: at(b, 30), f55: at(b, 55), f62: at(b, 62), f120: at(b, 120) };
    out.mob = { f45: at(s, 45), f51: at(s, 51) };
    game._fadingMonsters = [];
    // R3 - one enemy arrow, drawn once, with drawImage / ellipse counted
    for (let i = 0; i < 40 && !(LX_PLAYER_PROJ.arrow && _lxPlayerProjReady(LX_PLAYER_PROJ.arrow)); i++) await sleep(100);
    game.projectiles.length = 0; game.monsters.length = 0;
    game.projectiles.push({ x: player.x + 420, y: player.y - 60, vx: 6, vy: -1, w: 18, h: 8, life: 200, damage: 0, owner: 'enemy', skill: 'arrow', color: '#ffcc44', noGravity: true });
    const di = [], el = []; const _di = ctx.drawImage, _el = ctx.ellipse;
    ctx.drawImage = function (...a) { di.push(a.slice(-2).map((v) => Math.round(v))); return _di.apply(this, a); };
    ctx.ellipse = function (...a) { el.push(1); return _el.apply(this, a); };
    try { drawProjectiles(); } finally { ctx.drawImage = _di; ctx.ellipse = _el; }
    out.arrow = { images: di, ellipses: el.length };
    game.projectiles.length = 0;
    // U7 - which button a dangerous and a plain confirm focus
    const focusOf = async (o) => { const p = uiConfirm(o); await sleep(60); const id = document.activeElement && document.activeElement.id; document.getElementById('confirm-no').click(); await p; return id; };
    out.focusDanger = await focusOf({ title: 't', body: 'b', danger: true });
    out.focusPlain = await focusOf({ title: 't', body: 'b' });
    // A8 - the two maps' tracks
    const src = (id) => { try { const e = _bgmMapEl(id); return e ? decodeURIComponent(e.src).split('/').pop() : null; } catch (e) { return 'err'; } };
    out.tracks = { fieryHideout: src('fieryHideout'), sauroSlope: src('sauroSlope'), bastionRampart: src('bastionRampart'), bastion: src('bastion') };
    // U7 - Erase backs up first (last: resetSave arms a reload; clearSave and the 400 ms reload are held off here)
    try { _flushSaveStateNow(); } catch (e) {}
    out.hasSave = !!localStorage.getItem(SAVE_KEY);
    const before = _lxGetBackups().length;
    window.clearSave = () => {}; const _st = window.setTimeout; window.setTimeout = (f, ms, ...a) => (ms === 400 ? 0 : _st(f, ms, ...a));
    resetSave(); await sleep(60);
    out.eraseBody = document.getElementById('confirm-body').textContent;
    out.eraseFocus = document.activeElement && document.activeElement.id;
    document.getElementById('confirm-yes').click(); await sleep(150);
    window.setTimeout = _st;
    const after = _lxGetBackups();
    out.backups = { before, after: after.length, label: after[0] && after[0].label };
    return out;
  });
  check(r.boss.f30 && r.boss.f55 && !r.boss.f62 && !r.boss.f120, 'a dead boss dissolves over about a second, not ten', J(r.boss));
  check(r.mob.f45 && !r.mob.f51, 'an ordinary mob keeps the 0.83 s it has always had', J(r.mob));
  const art = r.arrow.images.filter(([w, h]) => w >= 27 && w <= 31 && h >= 27 && h <= 31);
  check(art.length === 1 && r.arrow.ellipses <= 1, 'an enemy arrow (Sagittarius) draws the arrow art, not a yellow blob', J(r.arrow));
  check(r.focusDanger === 'confirm-no' && r.focusPlain === 'confirm-yes', 'a dangerous confirm focuses Cancel; an ordinary one still focuses Confirm', J({ danger: r.focusDanger, plain: r.focusPlain }));
  check(r.eraseFocus === 'confirm-no' && /Save Backups/.test(r.eraseBody), '"Erase ALL progress?" opens on Keep playing and says a copy is kept', J({ focus: r.eraseFocus, body: r.eraseBody }));
  check(r.hasSave && r.backups.after === Math.min(r.backups.before + 1, 5) && r.backups.label === 'auto · before Erase', 'Erase takes a backup before it wipes', J(r.backups));
  check(r.tracks.fieryHideout === r.tracks.sauroSlope && r.tracks.fieryHideout === 'bgm_lava_cavern.mp3', 'the Fiery Hideout plays the lava theme it sits in, not the world theme', J(r.tracks));
  check(r.tracks.bastionRampart === r.tracks.bastion && r.tracks.bastion === 'bgm_bastion.mp3', 'the Bastion\'s Rampart plays the Bastion theme', J(r.tracks));
  check(errs.length === 0, 'no page errors', errs.slice(0, 2).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
