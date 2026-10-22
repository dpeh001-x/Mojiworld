// BUG HUNT, ROUND 4 (2026-10-11) - findings from four read-only hunters, each proven in the running game. Base FAIL / fix PASS.
//   [1] "Play in portrait anyway" lifts the rotate nag's pause at once (it waited ~6 s for the stuck-menu watchdog)
//   [2] a pause holds Elder Arlen's Coronation, the stat-set signatures, Aetherion's Gate hold and a held charge skill
//   [3] photo mode on a co-op host keeps the shared world running for the room (it froze every guest)
//   [4] a kill film waits for a boss lock and for a downed hero; a story beat waits for a boss lock
//   [5] the MojiMon key does nothing behind a pause menu
//   [6] a mob culled off-screen drops its attack-frame flag and Gravitos's star key (hit / touch boxes read them)
//   [7] two load notices both show (the second replaced the first); a down toll inside an Expedition costs no coins
//   [8] Aetherion's 20% column floor holds on the landing and on a co-op guest
//   [9] a Boss Rush echo plays no Sovereign film and is not counted as an Echo Keeper re-fight
//   [10] the Twin Verdict breaks off when Aetherion changes, and waits while he moves
//   [11] Barnaby's fall / the captains' teaser replay after a reload cut them short; a Gravitos change does not
//   [12] no page errors
//   node scripts/bughunt_round4_test.mjs        PORT / MOJI_GAME_FILE override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11954), FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, channel: EXE ? undefined : 'msedge', headless: true, args: ['--mute-audio'] });
const errs = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1600, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.removeItem('_mobile_nagDismissed'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  await page.evaluate(() => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { tutorial_intro: true, everdawn_welcome: true }); player._tutorialSeen = true; player._gravitosCineSeen = true;
    player.cls = 'warrior'; player.job = 'berserker'; player.level = 95; player.hp = player.maxHp = 9e6;
    window.__clear = () => { let n = 0; for (const id of ['grav-entry-skip', 'boss-intro-skip', 'plg-skip', 'plg-void-skip']) { const b = document.getElementById(id); if (b && b.offsetParent !== null) { b.click(); n++; } }
      for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o && o.classList.contains('on')) { o.classList.remove('on'); n++; } } if (game.paused) { game.paused = false; n++; } return n; };
    window.__boss = () => game.monsters.find((m) => m && (m.isBoss || m.boss || m.zodiacBoss) && m.currentHp > 0 && !m._miraShardOf) || null;
    window.__enter = async (id) => { loadMap(id); game.paused = false; let b = null; for (let i = 0; i < 300 && !b; i++) { await new Promise((r) => setTimeout(r, 100)); __clear(); b = __boss(); }
      let q = 0; for (let i = 0; i < 80 && q < 10; i++) { await new Promise((r) => setTimeout(r, 100)); q = __clear() ? 0 : q + 1; } return __boss(); };
    window.__steps = (n) => new Promise((r) => { const g0 = game.time; const f = () => (game.time - g0 >= n ? r() : requestAnimationFrame(f)); f(); });
    window.__wait = (ms) => new Promise((r) => setTimeout(r, ms));
    // close any film overlay the way a player does (any key), then let its 500 ms fade finish
    window.__closeFilms = async () => { let n = 0; if (['kill-film-overlay', 'barnaby-fall-overlay', 'captains-teaser-overlay'].some((id) => document.getElementById(id))) await new Promise((r) => setTimeout(r, 700));   /* v0.30.1756: a film ignores input for its first 600 ms */ for (const id of ['kill-film-overlay', 'barnaby-fall-overlay', 'captains-teaser-overlay']) { if (document.getElementById(id)) { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); n++; } }
      if (n) await __wait(800); for (const id of ['kill-film-overlay', 'barnaby-fall-overlay', 'captains-teaser-overlay']) { const o = document.getElementById(id); if (o) o.remove(); } game.paused = false; return n; };
  });
  // [1] the portrait nag (phones): turn to portrait mid-game, tap "Play in portrait anyway"
  await page.evaluate(async () => { loadMap('town'); game.paused = false; await __steps(5); });
  await page.setViewportSize({ width: 375, height: 812 }); await page.waitForTimeout(900);
  const n1 = await page.evaluate(async () => {
    const r = { nagOn: !!(document.getElementById('rotate-nag') || {}).classList?.contains('on'), pausedByNag: !!game.paused };
    const btn = [...document.querySelectorAll('#rotate-nag button')].find((b) => !b.classList.contains('nag-fs'));
    if (btn) btn.click(); await __wait(500);
    r.clicked = !!btn; r.pausedAfter = !!game.paused; return r;
  });
  await page.setViewportSize({ width: 1600, height: 900 }); await page.waitForTimeout(700);
  await page.evaluate(() => { try { localStorage.removeItem('_mobile_nagDismissed'); } catch (e) {} delete document.body.dataset.nagDismissed; game.paused = false; });
  ok('[1] "Play in portrait anyway" lifts the nag\'s pause at once', n1.nagOn && n1.pausedByNag && n1.clicked && n1.pausedAfter === false, n1);
  // [2] the pause clock
  const p = await page.evaluate(async () => {
    loadMap('forest'); game.paused = false; await __steps(5);
    const m = game.monsters.find((x) => x && x.currentHp > 0); if (!m) return { err: 'no mob' };
    const t = game.time | 0;
    player._regrowthCd = t + 3600; player._regrowthUntil = t + 300; player._graniteUntil = t + 300;
    m._ruinAt = t + 600; m._faultUntil = t + 240; m._ruin = { t0: t, last: t, fired: false, dir: 1 };
    m._ae = { cd: {}, lastTick: t, healAt: -1e9, gateUntil: t + 300, lanceLive: t + 200 };
    player._warCharge = { slotKey: '__bh4', start: game.time, power: 0 };
    const rd = () => { const n = game.time | 0; return { regrowthCd: player._regrowthCd - n, regrowth: player._regrowthUntil - n, granite: player._graniteUntil - n, ruinAt: m._ruinAt - n, fault: m._faultUntil - n,
      ruinT: n - m._ruin.t0, ruinLast: n - m._ruin.last, gate: m._ae.gateUntil - n, lance: m._ae.lanceLive - n, charge: Math.round(game.time - player._warCharge.start) }; };
    const before = rd(); game.paused = true; await __steps(60); const after = rd();
    delete m._ruin; delete m._ae; delete player._warCharge; game.paused = false;
    const drift = {}; for (const k in before) drift[k] = after[k] - before[k]; return drift;
  });
  ok('[2] a pause holds Arlen\'s Coronation, the set signatures, Aetherion\'s Gate hold and a held charge', !p.err && Object.values(p).every((v) => Math.abs(v) <= 2), p);
  // [3] photo mode on a co-op host
  const ph = await page.evaluate(async () => {
    const o = _lxCoopWorldStep; let n = 0; _lxCoopWorldStep = function () { n++; return o.apply(this, arguments); };
    try { togglePhotoMode(true); await __wait(600); } finally { togglePhotoMode(false); _lxCoopWorldStep = o; }
    return { worldSteps: n };
  });
  ok('[3] photo mode keeps the co-op world stepping (as a pause card does)', ph.worldSteps > 5, ph);
  // [4] films and beats wait for a boss lock and for a downed hero
  const fw = await page.evaluate(async () => {
    loadMap('forest'); game.paused = false; await __steps(5);
    const beat = Object.keys(STORY_BEATS).find((k) => !player._storyBeatsSeen[k] && STORY_BEATS[k] && STORY_BEATS[k].stanzas && STORY_BEATS[k].stanzas.length);
    for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;   // no other beat may hold the screen (a level-95 hero has a few queued)
    for (let i = 0; i < 6; i++) { __clear(); await __wait(150); }
    const row = LX_KILL_FILMS.sundered_smith, key = row.key, out = {};
    out.pre = { modal: !!(typeof _anyOtherModalOpen === 'function' && _anyOtherModalOpen()), beatOn: !!document.querySelector('#story-beat-overlay.on') };
    const tryFilm = async (name, set, unset) => {
      delete player._storyBeatsSeen[key]; set(); try { _lxPlayKillFilm(row); } finally { unset(); }
      out[name] = !!document.getElementById('kill-film-overlay');
      player._storyBeatsSeen[key] = true; delete player._lxFilmOpen;   // the waiting retry gives up on a seen film
      await __closeFilms(); window._lxKillFilmPending = 0;
    };
    await tryFilm('openedOverLock', () => { _QTE.active = true; }, () => { _QTE.active = false; });
    await tryFilm('openedWhileDown', () => { player.hp = 0; }, () => { player.hp = player.maxHp; });
    await tryFilm('openedClear', () => {}, () => {});   // the control: nothing holds it
    delete player._storyBeatsSeen[beat];
    _QTE.active = true; try { _playStoryBeat(beat); } finally { _QTE.active = false; }
    const so = document.getElementById('story-beat-overlay'); out.beatOverLock = !!(so && so.classList.contains('on'));
    player._storyBeatsSeen[beat] = true; delete player._lxBeatOpen; __clear(); out.beat = beat;
    return out;
  });
  ok('[4] a kill film waits for a boss lock and a downed hero; a story beat waits for a lock', fw.openedClear && !fw.openedOverLock && !fw.openedWhileDown && !fw.beatOverLock, fw);
  // [5] the MojiMon key behind a pause menu
  const mm = await page.evaluate(() => {
    const o = _mojimonEnsure; let n = 0; _mojimonEnsure = function () { n++; return o.apply(this, arguments); };
    game.paused = true; try { _mojimonQuickSummon(); } finally { game.paused = false; _mojimonEnsure = o; }
    return { reachedWhilePaused: n };
  });
  ok('[5] the MojiMon key does nothing behind a pause menu', mm.reachedWhilePaused === 0, mm);
  // [6] a culled draw drops the draw-side hit-box state
  const cd = await page.evaluate(() => {
    const m = game.monsters.find((x) => x && x.currentHp > 0); if (!m) return { err: 'no mob' };
    const cam = game.camera.x; m._frameIsAttack = true; m._gravStarKey = 'gravitos3star'; game.camera.x = m.x + 5000;
    try { ctx.save(); drawMonster(m); } finally { ctx.restore(); game.camera.x = cam; }
    return { type: m.type, frameIsAttack: !!m._frameIsAttack, starKey: m._gravStarKey || null };
  });
  ok('[6] a mob culled off-screen drops its attack-frame flag and star key', !cd.err && cd.frameIsAttack === false && cd.starKey === null, cd);
  // [7] load notices + the down toll inside an Expedition
  const nt = await page.evaluate(() => {
    const ov = document.getElementById('loading-overlay'), menu = document.getElementById('lo-menu');
    const was = { fade: ov.classList.contains('fade'), od: ov.style.display, md: menu.style.display };
    ov.classList.remove('fade'); ov.style.display = ''; menu.style.display = '';
    let txt = null;
    try { _lxSaveNotice('BH4 first notice', 'rare'); _lxSaveNotice('BH4 second notice', 'rare'); const n = document.getElementById('menu-save-notice'); txt = n ? n.textContent : null; if (n) n.remove(); }
    finally { if (was.fade) ov.classList.add('fade'); ov.style.display = was.od; menu.style.display = was.md; }
    const ex = game.expedition, coins = player.mojicoins; player.mojicoins = 500000;
    let toll = null; try { game.expedition = { active: true, floor: 3, bravoReady: false, currentQuest: null }; toll = _lxDeathToll(); } finally { game.expedition = ex; player.mojicoins = coins; }
    return { both: !!txt && txt.includes('BH4 first notice') && txt.includes('BH4 second notice'), txt, toll };
  });
  ok('[7] two load notices both show; a down toll inside an Expedition takes no coins (the EXP stands)', nt.both && nt.toll && nt.toll.coins === 0 && nt.toll.exp >= 0, nt);
  // [8] Aetherion's 20% column floor: the landing (host) and a co-op guest
  const fl = await page.evaluate(async () => {
    game.monsters.length = 0; player._god = false; player.blockTimer = 0;
    const mx = getMaxHp(); player.invulnerable = 0; player.hp = mx;
    _aeColumn(player.x + player.w / 2, 120, 12, 30, "Aetherion's Fracture"); game.hazards[game.hazards.length - 1]._passHit = true;   // the fall pass already spent: the landing alone
    await __steps(40); const land = mx - player.hp;
    const was = { host: net.isHost, hostId: net.hostId }, ofh = _coopFollowingHost; let guest = null;
    try {
      _coopFollowingHost = () => true; net.isHost = false; net.hostId = 7; player.invulnerable = 0; player.hp = mx;
      _coopApplyHazHit({ map: game.currentMap, id: 7, x: Math.round(player.x + player.w / 2), r: 120, d: 30, hf: 0.2, sl: "Aetherion's Fracture" });
      guest = mx - player.hp;
    } finally { _coopFollowingHost = ofh; net.isHost = was.host; net.hostId = was.hostId; player._god = true; player.hp = mx; player.invulnerable = 0; }
    return { maxHp: mx, landPct: +(land / mx).toFixed(3), guestPct: +(guest / mx).toFixed(3) };
  });
  ok('[8] Aetherion\'s column floor (20%) holds on the landing and on a co-op guest', fl.landPct >= 0.15 && fl.guestPct >= 0.15, fl);
  // [9] Boss Rush echoes: no Sovereign film, no Echo Keeper count
  const ru = await page.evaluate(async () => {
    loadMap('town'); game.paused = false; await __steps(5);
    const oc = _sovereignFallCutscene; let films = 0; _sovereignFallCutscene = () => { films++; };
    const k0 = ((player._zodiacEchoKills || {}).zodiac_leo) | 0; let sov = null, z = null;
    try {
      const s = spawnMonster(player.x + 200, player.y - 100, 'towerSovereign', true); if (s) { s._echoBoss = true; s._rushBoss = true; s._revivedOnce = true; s.currentHp = 1; killMonster(s); sov = !!s._sovFallPlayed; }   // he revives once: this is the second death
      const l = spawnMonster(player.x + 260, player.y - 100, 'zodiac_leo', true); if (l) { l._echoBoss = true; l._rushBoss = true; l.currentHp = 1; killMonster(l); z = (((player._zodiacEchoKills || {}).zodiac_leo) | 0) - k0; }
      await __wait(1900);
    } finally { _sovereignFallCutscene = oc; game.monsters.length = 0; for (let i = 0; i < 10; i++) { __clear(); await __wait(100); } }
    return { sovFilmMarked: sov, sovFilms: films, leoEchoCount: z };
  });
  ok('[9] a Boss Rush echo plays no Sovereign film and is not an Echo Keeper re-fight', ru.sovFilmMarked === false && ru.sovFilms === 0 && ru.leoEchoCount === 0, ru);
  // [10] Aetherion: the Twin Verdict breaks off when he changes, and waits while he moves
  const ae = await page.evaluate(async () => {
    player._god = true; const m = await __enter('sanctum'); if (!m || m.type !== 'aetherion') return { err: 'no aetherion', type: m && m.type };
    m._bigMeleeFiring = true; m._bigMeleeT = 300; m._echoT = 200; m._echoShot = { x: m.x, y: m.y }; m._bigMeleeCd = 0;
    _lxAeEvolveStart(m);
    const r = { firingAfterChange: !!m._bigMeleeFiring, echoAfterChange: !!m._echoShot };
    m._bigMeleeCd = 0; _lxAeEvolveTick(m, 16); r.cdDuringChange = Math.round(m._bigMeleeCd);
    await __wait(2600);   // let the change play out
    // his tick sits out while a cinematic score owns the mix (the arena's stays on here); the two direct calls below are synchronous
    const cine = _cineOwnsMix; _cineOwnsMix = false;
    try {
      _aetherionTick(m, 16); const A = m._ae;
      if (!A) return Object.assign(r, { err: 'no _ae', plg: !!window._prologueActive, hp: player.hp, bossHp: m.currentHp });
      A.st = 'idle'; A.t = 0; A.gateUntil = 0; A.cd = {}; m._bigMeleeFiring = false; m._dirOpenT = 0; m._stagger = 0; m._dirFleeT = 500; m._bigMeleeCd = -1;
      _aetherionTick(m, 16); r.started = A.st; r.cdAfterStart = Math.round(m._bigMeleeCd);
      A.st = 'idle'; A.t = 0; m._dirFleeT = 0;
    } finally { _cineOwnsMix = cine; }
    return r;
  });
  ok('[10] the Twin Verdict breaks off when Aetherion changes, and waits while he moves', !ae.err && !ae.firingAfterChange && !ae.echoAfterChange && ae.cdDuringChange >= 500 && ae.started === 'echoWind' && ae.cdAfterStart >= 500, ae);
  // [11] a film a reload cut short: Barnaby's fall and the teaser replay, a Gravitos change waits for the real one
  const rl = await page.evaluate(async () => {
    loadMap('town'); game.paused = false; await __steps(5); await __closeFilms();
    const out = {};
    delete player._storyBeatsSeen.barnaby_fall; delete player._lxFilmOpen;
    _lxPlayBarnabyFall(); out.openMarker = player._lxFilmOpen || null; await __closeFilms(); out.markerAfterClose = player._lxFilmOpen || null;
    // saveState() is debounced: flush, or the load reads the save from before the marker was set
    // a load opens what a load opens (the first of the day brings the daily-bonus card, which pauses): close it, as a player does,
    // so the replay - which waits for an unpaused world - gets its turn
    const settle = async (ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (game.paused) { try { closeAllModals(); } catch (e) {} game.paused = false; } await __wait(100); } };
    _flushSaveStateNow(); loadState(); await settle(2500);
    const obf = _lxPlayBarnabyFall, okf = _lxPlayKillFilm, calls = { bf: 0, kf: [] };
    _lxPlayBarnabyFall = () => { calls.bf++; return true; }; _lxPlayKillFilm = (f) => { calls.kf.push(f && f.key); return true; };
    try {
      for (const k of ['barnaby_fall', 'gravitos_awaken']) {
        player._storyBeatsSeen[k] = true; player._lxFilmOpen = k; _flushSaveStateNow(); loadState(); await settle(3500);
        out[k] = { seen: !!player._storyBeatsSeen[k] };
      }
    } finally { _lxPlayBarnabyFall = obf; _lxPlayKillFilm = okf; }
    out.barnabyReplayed = calls.bf; out.killFilms = calls.kf; player._storyBeatsSeen.barnaby_fall = true; player._storyBeatsSeen.gravitos_awaken = true;
    return out;
  });
  ok('[11] a reload replays Barnaby\'s fall but not a Gravitos change (that waits for the real one)', rl.openMarker === 'barnaby_fall' && rl.markerAfterClose === null && rl.barnabyReplayed === 1 && rl.killFilms.indexOf('gravitos_awaken') < 0 && rl.gravitos_awaken && rl.gravitos_awaken.seen === false, rl);
  ok('[12] no page errors', !errs.length, errs.slice(0, 3));
} catch (e) { ok('the run completes', false, String(e && e.message || e).slice(0, 300)); }
finally { server.kill(); await browser.close(); }
console.log(`${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
