// RELEASE 14b - co-op fixes from the two-client hunt on v0.30.1739, on the REAL local relay (mp/server.mjs, spawned here) with two pages:
//   TAKEOVER  the partner who takes over a boss continues it: Gravitos at form 2 dies into form 3 (right stats, base from the host),
//             a revived Sovereign dies for good, an evolved Aetherion does not evolve again
//   SCENES    a guest gets the boss-kill scenes: Gravitos's form film on a watched change, his ending (q_boss_gravitos held), the
//             zodiac badge + last words + first_zodiac_kill, Star-Toucher at once, the Smith's / Aetherion's films
//   LEAVE     "Leave the fight?" in co-op says the partner fights on / takes over; a guest's copy past a form change is underway
//   FIGHT     a following guest's door trial runs on the guest; a monster set-piece is refused (it was won on touch)
//   ECHO      a following guest's Echo Keeper summon says who must call it (it did nothing)
//   node release14b_test.mjs   (PORT default 15061; MOJI_SERVE_ROOT = the checkout to serve; MOJI_GAME_FILE picks the build)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15061), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const URL = `http://localhost:${PORT}/${FILE}`, WS = `ws://localhost:${PORT}`, MAP = 'glasswindSteppe';
const ROOM = 'r14b' + Math.floor(Math.random() * 1e6);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (page, fn, arg, ms = 6000) => { const t0 = Date.now(); for (;;) { const r = await page.evaluate(fn, arg); if (r.ok || Date.now() - t0 > ms) return r.v; await sleep(120); } };
let relay = null;
async function startRelay(port) {
  const env = { ...process.env, PORT: String(port) }; delete env.ROOM_CAP;
  relay = spawn(process.execPath, [path.join(ROOT, 'mp', 'server.mjs')], { cwd: path.join(ROOT, 'mp'), env, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('relay did not start')), 15000); relay.stdout.on('data', (d) => { if (String(d).includes('MP relay')) { clearTimeout(t); res(); } }); relay.on('exit', (c) => { clearTimeout(t); rej(new Error('relay exited ' + c)); }); });
}
async function boot(browser, name) {
  const ctx = await browser.newContext(); await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page._errors = [];
  page.on('pageerror', (e) => page._errors.push(String(e).slice(0, 180)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => typeof net === 'object' && typeof game === 'object' && typeof mpConnect === 'function' && typeof _coopApplyKill === 'function', null, { timeout: 90000 });
  await page.waitForTimeout(3500);
  await page.evaluate((nm) => { try { player.cls = 'warrior'; if (player.look) player.look.name = nm; player.channel = 1; game.paused = false; window._prologueActive = false; window._prologuePending = false; window._lxBootGateDone = true;
    player._tutorialSeen = true; document.body.classList.remove('sb-active'); const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none'; } catch (e) {}
    // what the scenes call is RECORDED, not played (films, beats, cutscenes, cards, boon wheels would hold the page)
    window.__rec = []; const R = (k, v) => window.__rec.push([k, v, Date.now()]);
    window._playStoryBeat = (id) => { R('beat', id); };
    window._lxPlayKillFilm = (f) => { R('film', f && f.key); window._lxKillFilmPending = 0; };
    window._lxPlayBarnabyFall = () => { R('film', 'barnaby_fall'); window._lxBarnabyFallPending = 0; };
    window._gravitosDefeatCutscene = () => { R('ending', 'gravitos_defeat'); };
    window._sovereignFallCutscene = () => { R('scene', 'sovereign_fall'); };
    window._lxEndingCard = (a) => { R('card', a); };
    window._lxDeliverPendingBoon = () => {}; window.showPowerupChoice = () => {};
    const _st = window.showToast; window.showToast = function (t) { R('toast', String(t).slice(0, 120)); try { return _st.apply(this, arguments); } catch (e) {} };
    window.uiConfirm = (o) => { R('confirm', o && o.body); return Promise.resolve(false); };
  }, name);
  return page;
}
const ev = (p, fn, arg) => p.evaluate(fn, arg);
const pump = (p) => p.evaluate(() => { window.__pump = setInterval(() => { try { _mpTick(); } catch (e) {} try { _coopTickMonsters(); } catch (e) {} try { if (net.isHost) for (let i = game.monsters.length - 1; i >= 0; i--) { const m = game.monsters[i]; if (m && !m._r14 && !m.isBoss) game.monsters.splice(i, 1); } } catch (e) {} try { game.paused = false; } catch (e) {} }, 80); });
const rec = (p, k, since) => ev(p, ({ k, since }) => window.__rec.filter((r) => r[0] === k && r[2] >= since).map((r) => r[1]), { k, since });
const now = (p) => ev(p, () => Date.now());
const goMap = (p, m) => ev(p, (m) => { game.visitedMaps = game.visitedMaps || {}; game.visitedMaps[m] = true; loadMap(m); }, m);
const steady = (p) => ev(p, () => { player.hp = player.maxHp = 100000; player._god = true; player.invulnerable = 1e9; player._downed = false; game.paused = false; });
// the runner spawns a boss beside the players (tagged so the pump keeps it)
const spawnBoss = (p, type) => ev(p, (type) => { const m = spawnMonster(player.x + 260, player.y - 40, type, true, false); if (!m || m._suppressed) return null; m._r14 = 1; game.paused = false; return m.uid; }, type);
const byUid = (u) => game.monsters.find((q) => q && q.uid === u);

await startRelay(PORT);
const EXE = [process.env.PW_EXE, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  const [A, B] = await Promise.all([boot(browser, 'Ann'), boot(browser, 'Bob')]);
  await ev(A, ({ ws, room }) => mpConnect(ws, 'Ann', room), { ws: WS, room: ROOM });
  await A.waitForFunction(() => net.myId != null, null, { timeout: 15000 }).catch(() => {});
  await ev(B, ({ ws, room }) => mpConnect(ws, 'Bob', room), { ws: WS, room: ROOM });
  await B.waitForFunction(() => net.myId != null, null, { timeout: 15000 }).catch(() => {});
  await sleep(900); for (const P of [A, B]) await pump(P);
  for (const P of [A, B]) await goMap(P, MAP);
  await sleep(2500); for (const P of [A, B]) await steady(P);
  ok('two clients on one map, Ann runs it', (await ev(A, () => net.isHost)) === true && (await ev(B, () => net.isHost)) === false);

  // ---------------- TAKEOVER, part 1: Ann takes Gravitos to form 2, revives the Sovereign, evolves Aetherion; Bob watches ----------------
  const G = await spawnBoss(A, 'gravitos'), SV = await spawnBoss(A, 'towerSovereign'), AE = await spawnBoss(A, 'aetherion');
  ok('Ann spawns Gravitos, the Sovereign and Aetherion', G != null && SV != null && AE != null, { G, SV, AE });
  await until(B, (u) => ({ ok: u.every((x) => game.monsters.some((q) => q && q.uid === x)), v: 0 }), [G, SV, AE], 8000);
  await sleep(700);
  const t1 = await now(B);
  const host = await ev(A, ({ G, SV, AE }) => { const byUid = (u) => game.monsters.find((q) => q && q.uid === u);
    const g = byUid(G); g.currentHp = 0; killMonster(g);
    const sv = byUid(SV); sv.currentHp = 0; killMonster(sv);
    const ae = byUid(AE); ae.currentHp = Math.floor(ae.maxHp * 0.4); const was = game.paused; game.paused = false; for (let i = 0; i < 4; i++) { try { updateMonsters(1000 / 60); } catch (e) {} } game.paused = was;
    const B0 = g._gravitosBase || {};
    return { ph: g._gravitosPhase, name: g.name, max2: g.maxHp, base: { maxHp: B0.maxHp, atk: B0.atk, def: B0.def }, svRev: !!sv._revivedOnce, svHp: sv.currentHp, aeEvo: !!ae._aetherionEvolved, aeAtk: ae.atk };
  }, { G, SV, AE });
  ok('on Ann: Gravitos is in form 2, the Sovereign revived once, Aetherion evolved', host.ph === 2 && host.svRev && host.svHp > 0 && host.aeEvo, host);
  const mir = await until(B, ({ G, SV, AE }) => { const byUid = (u) => game.monsters.find((q) => q && q.uid === u); const g = byUid(G), sv = byUid(SV), ae = byUid(AE);
    const v = { sp: g && g._phaseSprite, ph: g && g._gravitosPhase, base: g && g._gravitosBase && g._gravitosBase.maxHp, sv: !!(sv && sv._revivedOnce), ae: !!(ae && ae._aetherionEvolved) };
    return { ok: v.sp === 'gravitos2' && v.ph === 2 && v.base > 0 && v.sv && v.ae, v }; }, { G, SV, AE }, 6000);
  ok('Bob\'s copy knows the form (2), the host\'s base, the Sovereign\'s revive and Aetherion\'s change (was: only the sprite)', mir.ph === 2 && mir.base === host.base.maxHp && mir.sv && mir.ae, { mir, hostBase: host.base.maxHp });
  const films1 = await until(B, (t) => { const v = window.__rec.filter((r) => r[0] === 'film' && r[2] >= t).map((r) => r[1]); return { ok: v.includes('gravitos_awaken'), v }; }, t1, 4000);
  ok('Bob watched form 1 fall: his awakening film plays for Bob too (was: host only)', films1.includes('gravitos_awaken'), films1);
  // ---------------- LEAVE: Bob's copy at the top of form 2 counts as underway; both dialogs speak co-op ----------------
  const lv = await ev(B, async (G) => { const g = game.monsters.find((q) => q && q.uid === G); const u = _lxBossFightUnderway(g); window.__rec = window.__rec.filter((r) => r[0] !== 'confirm');
    const go = await _lxConfirmLeaveFight(); const c = window.__rec.filter((r) => r[0] === 'confirm').map((r) => r[1]); return { u, go, body: c[0] || null, full: g.currentHp === g.maxHp }; }, G);
  ok('Bob: Gravitos at full HP in form 2 is a fight underway (was: no prompt)', lv.u === true && lv.full, lv);
  ok('Bob\'s prompt says his partner fights on and he can rejoin (was: "restarts from full")', !!lv.body && /partner fights on/.test(lv.body) && !/restarts from full/.test(lv.body), lv.body);
  const lvA = await ev(A, async () => { window.__rec = window.__rec.filter((r) => r[0] !== 'confirm'); await _lxConfirmLeaveFight(); return window.__rec.filter((r) => r[0] === 'confirm').map((r) => r[1])[0] || null; });
  ok('Ann\'s prompt says her partner takes the fight over', !!lvA && /takes the fight over/.test(lvA), lvA);

  // ---------------- TAKEOVER, part 2: Ann walks out; Bob's copies become the bosses ----------------
  await goMap(A, 'town');
  const took = await until(B, (G) => { const g = game.monsters.find((q) => q && q.uid === G); return { ok: net.isHost && g && !g._coopMirror, v: net.isHost }; }, G, 10000);
  ok('Ann leaves: Bob takes the map over', took === true);
  const tk = await ev(B, ({ G, SV, AE }) => { const byUid = (u) => game.monsters.find((q) => q && q.uid === u); if (!byUid(G) || !byUid(SV) || !byUid(AE)) return { missing: [G, SV, AE].filter((u) => !byUid(u)) };
    const ae = byUid(AE), aeAtk0 = ae.atk; const was = game.paused; game.paused = false; for (let i = 0; i < 4; i++) { try { updateMonsters(1000 / 60); } catch (e) {} } game.paused = was;
    const g = byUid(G); g.currentHp = 0; killMonster(g);
    const sv = byUid(SV); sv.currentHp = 0; killMonster(sv);
    return { ph: g._gravitosPhase, fin: !!g._gravitosFinalForm, name: g.name, max: g.maxHp, atk: g.atk, svHp: sv.currentHp, aeAtk0, aeAtk1: ae.atk, aeEvo: !!ae._aetherionEvolved };
  }, { G, SV, AE });
  ok('Bob kills form 2: Gravitos ASCENDS to form 3 (was: "Awakened" again)', tk.ph === 3 && tk.fin && /Ascendant/.test(tk.name), tk);
  ok('...with form 3\'s stats built from the HOST\'s base: max HP = base, ATK = base x2 x1.28 (was: halved, compounding)', tk.max === host.base.maxHp && tk.atk === Math.floor(Math.floor(host.base.atk * 2) * 1.28), { tk, base: host.base });
  ok('Bob kills the revived Sovereign: it stays down (was: revived a second time)', !(tk.svHp > 0), tk.svHp);
  ok('Bob runs evolved Aetherion: no second evolve, ATK unchanged (was: x1.25 again)', tk.aeEvo && tk.aeAtk0 === host.aeAtk && tk.aeAtk1 === host.aeAtk, { host: host.aeAtk, a0: tk.aeAtk0, a1: tk.aeAtk1 });   // the page's own loop runs him too: compare with the host's ATK

  // ---------------- SCENES: Ann comes back as Bob's partner; Bob ends Gravitos and Aetherion ----------------
  await goMap(A, MAP); await sleep(1500); await steady(A);
  const back = await until(A, (G) => { const g = game.monsters.find((q) => q && q.uid === G); const v = { host: net.isHost, ph: g && g._gravitosPhase, fin: !!(g && g._gravitosFinalForm) }; return { ok: !v.host && v.ph === 3 && v.fin, v }; }, G, 10000);
  ok('Ann rejoins as Bob\'s partner; her copy knows Gravitos is in his final form', back.host === false && back.ph === 3 && back.fin, back);
  await ev(A, () => { player.quests = player.quests || { active: {}, completed: {} }; player.quests.active = player.quests.active || {}; player.quests.active.q_boss_gravitos = { progress: 0 }; player._storyBeatsSeen = {}; });
  const t2 = await now(A);
  await ev(B, ({ G, AE }) => { const byUid = (u) => game.monsters.find((q) => q && q.uid === u); const g = byUid(G); g.currentHp = 0; killMonster(g); }, { G, AE });
  await sleep(600);
  await ev(B, (AE) => { const ae = game.monsters.find((q) => q && q.uid === AE); ae.currentHp = 0; killMonster(ae); }, AE);
  const end = await until(A, (t) => { const v = window.__rec.filter((r) => r[2] >= t && (r[0] === 'ending' || r[0] === 'film' || r[0] === 'card')).map((r) => r[1]); return { ok: v.includes('gravitos_defeat') && v.includes('aetherion_release') && v.includes('I WAS THE ANSWER ONCE.'), v }; }, t2, 9000);
  ok('Ann (holding q_boss_gravitos) gets Gravitos\'s ending chain on Bob\'s kill (was: nothing)', end.includes('gravitos_defeat'), end);
  ok('Ann gets Aetherion\'s release film and his last words card (was: nothing)', end.includes('aetherion_release') && end.includes('I WAS THE ANSWER ONCE.'), end);

  // ---------------- SCENES: a zodiac and the Smith, killed by Bob with Ann beside him ----------------
  const ZT = await ev(B, () => Object.keys(monsterTypes).find((k) => monsterTypes[k] && monsterTypes[k].zodiacBoss && /aries/.test(k)) || Object.keys(monsterTypes).find((k) => monsterTypes[k] && monsterTypes[k].zodiacBoss));
  const Z = await spawnBoss(B, ZT), SM = await spawnBoss(B, 'sundered_smith');
  const zs = await ev(B, (Z) => { const m = game.monsters.find((q) => q && q.uid === Z); return m && m.zodiacSign; }, Z);
  await until(A, (u) => ({ ok: u.every((x) => game.monsters.some((q) => q && q.uid === x)), v: 0 }), [Z, SM], 8000);
  await ev(A, (zs) => { if (game.bestiary) delete game.bestiary['_boss_zodiac_' + zs]; if (game.achievements) delete game.achievements.zodiac1; for (const z of ZODIAC_SIGNS) if (game.bestiary) delete game.bestiary['_boss_zodiac_' + z.id];
    const o = window._coopApplyKill; window._coopApplyKill = function (msg) { const r = o.apply(this, arguments); window.__rec.push(['ach', !!(game.achievements && game.achievements.zodiac1), Date.now()]); return r; }; }, zs);
  const t3 = await now(A);
  await ev(B, ({ Z, SM }) => { const byUid = (u) => game.monsters.find((q) => q && q.uid === u); const z = byUid(Z); z.currentHp = 0; killMonster(z); const sm = byUid(SM); sm.currentHp = 0; killMonster(sm); if (sm.currentHp > 0) { sm.currentHp = 0; killMonster(sm); } }, { Z, SM });
  const zr = await until(A, ({ t, zs }) => { const R = window.__rec.filter((r) => r[2] >= t); const v = { toast: R.some((r) => r[0] === 'toast' && /BADGE EARNED/.test(r[1])), beats: R.filter((r) => r[0] === 'beat').map((r) => r[1]), ach: R.filter((r) => r[0] === 'ach').map((r) => r[1]), films: R.filter((r) => r[0] === 'film').map((r) => r[1]) };
    return { ok: v.toast && v.beats.includes('zodiac_words_' + zs) && v.beats.includes('first_zodiac_kill') && v.films.includes('mira_ashes'), v }; }, { t: t3, zs }, 7000);
  ok('Ann gets the zodiac badge flourish on Bob\'s kill (was: nothing)', zr.toast, { ZT, zs });
  ok('...the sign\'s last words and first_zodiac_kill (was: lost for good)', zr.beats.includes('zodiac_words_' + zs) && zr.beats.includes('first_zodiac_kill'), zr.beats);
  ok('...and Star-Toucher unlocks on that kill (was: the check ran before the badge stamp)', zr.ach[0] === true, zr.ach);
  ok('Ann gets the Smith\'s ashes film on Bob\'s kill (was: nothing)', zr.films.includes('mira_ashes'), zr.films);

  // ---------------- FIGHT: Ann (following Bob) touches a door trial, then a monster set-piece ----------------
  const fight = await ev(A, () => {
    const out = {}; const mk = { x: player.x, qid: 'q_r14b', mk: { id: 'r14b' } };
    window.__won = 0; const tr = { title: 'HOLD THE LINE', trial: { kind: 'hold', ms: 20000, radius: 130, volleys: 9, every: 2100, warn: 950, dmg: 0.09, color: '#bfe6ff' } };
    _lxFightStart(tr, mk, () => { window.__won++; });
    out.follow = _coopFollowingHost(); out.trialWon = window.__won; out.trialRuns = !!(game._lxFight && game._lxFight.def === tr);
    if (game._lxFight) { try { _lxFightTick(500); } catch (e) {} out.held = game._lxFight && game._lxFight.tr ? game._lxFight.tr.hold : null; _lxFightEnd(game._lxFight, false, 'test'); }
    window.__won = 0; const t0 = Date.now();
    _lxFightStart({ title: 'AMBUSH', waves: [{ at: 0, n: 2, types: ['slime'] }] }, mk, () => { window.__won++; });
    out.fightWon = window.__won; out.fightRuns = !!game._lxFight; out.toast = window.__rec.some((r) => r[0] === 'toast' && r[2] >= t0 && /yours alone/.test(r[1]));
    if (game._lxFight) _lxFightEnd(game._lxFight, false, 'test');
    return out;
  });
  ok('Ann follows Bob', fight.follow === true, fight);
  ok('Ann\'s door trial RUNS on her own screen (was: won on touch, no trial)', fight.trialRuns && fight.trialWon === 0 && fight.held > 0, fight);
  ok('Ann\'s monster set-piece is refused with a toast, not won (was: won on touch)', fight.fightWon === 0 && !fight.fightRuns && fight.toast, fight);

  // ---------------- ECHO: Ann asks the Echo Keeper for a shade in Bob's room ----------------
  const echo = await ev(A, async () => {
    try { openNPC({ id: 'r14bEcho', role: 'echoKeeper', name: 'Echo Keeper', _bossType: 'king', x: player.x, y: player.y, w: 40, h: 60 }); } catch (e) { return { err: String(e) }; }
    await new Promise((r) => setTimeout(r, 300));
    const btn = [...document.querySelectorAll('#dialog-options button')].find((el) => /Summon the echo/.test(el.textContent || ''));
    if (!btn) return { err: 'no option' };
    const n0 = game.monsters.length; btn.click(); await new Promise((r) => setTimeout(r, 2500));   // the dialog types its text out
    const dt = document.getElementById('dialog-text'); const open = !!(document.getElementById('dialog') && getComputedStyle(document.getElementById('dialog')).display !== 'none');
    const txt = dt ? dt.textContent : ''; try { closeDialog(); } catch (e) {}
    return { txt: txt.slice(0, 160), open, added: game.monsters.length - n0 };
  });
  ok('Ann\'s "Summon the echo" says the one who holds the room must call it (was: silently nothing)', /holds this room must call/.test(echo.txt || ''), echo);

  const errs = [...A._errors, ...B._errors].filter((e) => !/ResizeObserver|AbortError|play\(\)|NotAllowedError|Failed to load/.test(e));
  ok('no page errors', errs.length === 0, errs.slice(0, 4));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.stack || e)); }
finally { try { await browser.close(); } catch (e) {} try { relay && relay.kill(); } catch (e) {} }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
