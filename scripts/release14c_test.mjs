// RELEASE 14c (bug hunt round 14, part C - levels, elders, the mirror) stays fixed:
//   [1] every door's level tag tells the truth about where it leads: for each door into a map with an ordinary roster (no boss,
//       no spawnChance rare elite), the "(Lv a-b)" it shows matches the levels the map REALLY spawns (loaded and read off the
//       nameplates, _mobLevel) within 2 at both ends - or is the door's own gate ("Lv g+") when that is above the start. Checked
//       for the drawn label (the bake's measureText), the derived label of every door, and the authored po.name of every door
//       that carries a tag (the hand-written ones were rewritten at boot)
//   [2] a rare elite (a spawnChance roster entry) is never promoted to Elder, so it keeps its table HP; an ordinary miniElite
//       mob (Tomb Keeper) still is, on the same roll
//   [3] Mirror Self's ATK is the documented 0.4x the hero's ATK after the stat table, not the table's flat 21
//   node scripts/release14c_test.mjs        PORT / MOJI_GAME_FILE / SERVE_ROOT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15142), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1600, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  const R = await page.evaluate(async () => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior');
    player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
    player._tutorialSeen = true; player._gravitosCineSeen = true; player._god = true;
    const steps = (n) => new Promise((r) => { const g0 = game.time; const f = () => (game.time - g0 >= n ? r() : requestAnimationFrame(f)); f(); });
    const clear = () => { try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {} game.paused = false; };
    const load = (id) => { game._worldStateByMap = game._worldStateByMap || {}; game._worldStateByMap[id] = null; clear(); loadMap(id); game.paused = false; };
    const out = {};
    // [1] what each destination REALLY spawns (its ordinary roster, read off the nameplates)
    const rareOf = (md) => new Set((md.spawns || []).filter((s) => s && !s.boss && s.spawnChance != null).map((s) => s.type));
    const ordinary = (md) => (md.spawns || []).some((s) => s && s.type && !s.boss && s.spawnChance == null && monsterTypes[s.type] && !monsterTypes[s.type].boss);
    const doors = [];
    for (const id of Object.keys(MAPS)) for (const po of (MAPS[id].portals || [])) if (po && po.dest && MAPS[po.dest] && ordinary(MAPS[po.dest])) doors.push({ src: id, po });
    const meas = {};
    for (const d of new Set(doors.map((x) => x.po.dest))) {
      try { load(d); } catch (e) { meas[d] = { err: String(e).slice(0, 80) }; continue; }
      const rare = rareOf(MAPS[d]);
      const lv = game.monsters.filter((m) => m && !m.isBoss && !m.boss && !rare.has(m.type)).map((m) => _mobLevel(m)).filter((n) => n > 0);
      meas[d] = lv.length ? { lo: Math.min(...lv), hi: Math.max(...lv), n: lv.length } : { n: 0 };
    }
    // the label a door shows: this build's helper if it has one, else the draw rule it shipped with
    const shown = (po, name) => (typeof _lxPortalLabel === 'function') ? _lxPortalLabel(po, name)
      : (/Lv\s*\d/.test(name) ? name : (() => { const dl = po.levelGate || _mapDangerLv(po.dest); return dl >= 10 ? name + ' (Lv ' + dl + ')' : name; })());
    const judge = (po, label) => {
      const mm = meas[po.dest]; if (!mm || !mm.n) return null;   // nothing measurable (spawned nothing ordinary)
      const t = /\(Lv\s*(\d+)(?:\s*-\s*(\d+))?(\+)?\)/.exec(label);
      if (!t) return mm.hi < 10 ? null : 'no tag';
      const a = +t[1], b = t[2] ? +t[2] : a;
      if (t[3] && a === (po.levelGate | 0) && a >= mm.lo) return null;   // the door's own gate, above where its monsters start
      return (Math.abs(a - mm.lo) <= 2 && Math.abs(b - mm.hi) <= 2) ? null : ('spawns ' + mm.lo + '-' + mm.hi);
    };
    out.bad = []; out.badName = []; out.nDoors = doors.length; out.nNamed = 0; out.meas = meas;
    for (const { src, po } of doors) {
      const lab = shown(po, po.name || ''); const j = judge(po, lab);
      if (j) out.bad.push(src + '>' + po.dest + ' "' + lab + '" ' + j);
      if (/\(Lv\s*\d/.test(po.name || '')) { out.nNamed++; const jn = judge(po, po.name); if (jn) out.badName.push(src + '>' + po.dest + ' "' + po.name + '" ' + jn); }
    }
    // the DRAWN label (the bake measures its text): the Crypt of Whispers' door to the Bone Graveyard, and an untagged door
    const seen = []; const _mt = CanvasRenderingContext2D.prototype.measureText;
    CanvasRenderingContext2D.prototype.measureText = function (t) { seen.push(String(t)); return _mt.apply(this, arguments); };
    out.drawn = {};
    for (const [src, dest] of [['cryptHollow', 'boneGraveyard'], ['forest', 'glimmerwood']]) {
      load(src); await steps(2);
      const po = game.portals.find((p) => p.dest === dest); if (!po) { out.drawn[dest] = 'no door'; continue; }
      const py = (typeof po.y === 'number') ? po.y : _defaultPortalY(po.x);
      player.x = po.x - player.w / 2; player.y = py - player.h; player.vx = player.vy = 0; po._lblSprite = null; seen.length = 0;
      await steps(40);   // the camera has to reach the door before it draws
      const nm = String(MAPS[dest].name || dest).split(/\s+[—-]\s+/)[0];
      const txt = seen.find((x) => x.indexOf(nm) >= 0 && /\(Lv/.test(x)) || null;
      out.drawn[dest] = { txt, bad: txt ? judge(po, txt) : 'not drawn' };
    }
    CanvasRenderingContext2D.prototype.measureText = _mt;
    // [2] the Elder roll, forced: every roll lands low (rare entries pass their spawnChance, the 15% Elder roll fires)
    const _r = Math.random;
    const forced = (id) => { game._worldStateByMap = game._worldStateByMap || {}; game._worldStateByMap[id] = null; clear();
      Math.random = () => 0.01; try { loadMap(id); } finally { Math.random = _r; } game.paused = false;
      return game.monsters.filter((m) => m && !m.isBoss).map((m) => ({ t: m.type, mini: !!m.isMiniBoss, elite: !!m.isElite, hp: m.maxHp })); };
    const VV = (typeof LX_MONSTER_VARIANTS !== 'undefined' && LX_MONSTER_VARIANTS) || {}; const V = VV.elder || { hp: 5 };
    out.elder = {};
    for (const [map, rare, plain] of [['ossuarySprawl', 'ossuaryTyrant', 'tombKeeper'], ['wayfarersLantern1', 'pathsBane', null], ['gloomsporeVerge', 'blightElder', null]]) {
      const ms = forced(map); const r = ms.find((m) => m.t === rare); const p = plain ? ms.find((m) => m.t === plain) : null;
      const T = LX_MONSTER_STATS[rare] || {};
      out.elder[rare] = { found: !!r, mini: r && r.mini, elite: r && r.elite, hp: r && r.hp, tableHp: T.hp, wantHp: Math.floor((T.hp || 0) * ((r && r.elite && VV.elite && VV.elite.hp) || 1)),   // the same roll makes it an Elite (xelite.hp) - that variant is not this fix's
        jit: (typeof LX_MONSTER_JITTER === 'number') ? LX_MONSTER_JITTER : 0, elderHp: Math.floor((T.hp || 0) * (V.hp || 5)),
        miniElite: !!(monsterTypes[rare].traits && monsterTypes[rare].traits.miniElite), plain: p ? { t: plain, mini: p.mini } : null, flag: !!game._lxRareSpawn };
    }
    // [3] Mirror Self at Lv 20
    player.level = 20; player._god = true; if (game.bossDefeated) game.bossDefeated.innerDimension = false;
    { let lo = 1, hi = 1181 * 4; for (let i = 0; i < 44; i++) { const mid = Math.floor((lo + hi) / 2); player.baseAtk = mid; if (getAtk() < 1181) lo = mid + 1; else hi = mid; } player.baseAtk = lo; }   // a geared Lv 20 berserker's ATK
    load('innerDimension'); await steps(2);
    const mir = game.monsters.find((m) => m && m.type === 'mirrorSelf');
    out.mir = mir ? { atk: mir.atk, want: Math.max(20, Math.floor(getAtk() * 0.4)), heroAtk: getAtk(), table: (LX_MONSTER_STATS.mirrorSelf || {}).atk, touch: _lxContactBase(mir), heroHp: getMaxHp() } : { err: 'no mirror' };
    return out;
  });
  const J = (x) => JSON.stringify(x).slice(0, 600);
  ok('[1] every door into a monster map is tagged with the levels it really spawns (within 2 at both ends, or its own gate above the start)', R.nDoors > 100 && R.bad.length === 0, J({ doors: R.nDoors, bad: R.bad.length, first: R.bad.slice(0, 8) }));
  ok('[1] ...and every hand-tagged door name in MAPS says the same (no "Bone Graveyard (Lv 36)" left to read)', R.nNamed >= 15 && R.badName.length === 0, J({ named: R.nNamed, bad: R.badName.slice(0, 8) }));
  ok('[1] the drawn label says it: the Crypt\'s door reads the Bone Graveyard\'s Lv 43-50 roster, and an untagged door its own roster', R.drawn.boneGraveyard && !R.drawn.boneGraveyard.bad && R.drawn.glimmerwood && !R.drawn.glimmerwood.bad, J(R.drawn));
  for (const k of Object.keys(R.elder)) {
    const e = R.elder[k];
    ok(`[2] a rare ${k} (spawnChance entry, miniElite ${e.miniElite}) on a forced-low roll is not an Elder and keeps its table HP (${e.hp}, an Elder would be ${e.elderHp})`, e.found && e.mini === false && Math.abs(e.hp / e.wantHp - 1) <= e.jit + 0.01 && e.hp < e.elderHp && e.flag === false, J(e));
  }
  const tk = R.elder.ossuaryTyrant && R.elder.ossuaryTyrant.plain;
  ok('[2] ...while an ordinary miniElite (Tomb Keeper, same map, same roll) still becomes an Elder', tk && tk.mini === true, J(tk));
  ok('[3] Mirror Self hits with 0.4x the Lv 20 hero\'s ATK after the stat table (not the table\'s flat atk)', R.mir && R.mir.atk === R.mir.want && R.mir.want !== R.mir.table, J(R.mir));
  ok('[last] no page errors', errs.length === 0, errs.slice(0, 4));
} catch (e) { fail++; console.log('FAIL harness: ' + String(e && e.stack || e).slice(0, 500)); }
finally { await browser.close(); try { server.kill(); } catch (e) {} }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
