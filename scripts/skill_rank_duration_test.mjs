// Summons and buffs last 1 s longer per skill rank (v0.30.779; rank 10 = +10 s).
//
// Casts each of the 20 listed skills at rank 0, 3 and 10 and reads the timer the skill really set:
// buffs.*, the summon's life, the ward's life, the field's life (frames), the enrage deadline. The
// rank-5 / rank-10 perks are switched off for the rank comparison so the difference is the rank bonus
// alone; a second pass leaves them on and checks the two add up.
//
//   [SERVE_ROOT=<dir with serve.js + the game's data/>] node scripts/skill_rank_duration_test.mjs [candidate.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11093';
const env = { ...process.env }; if (process.argv[2]) env.MOJI_GAME_FILE = path.resolve(process.argv[2]); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
let pass = 0, fail = 0;
const check = (ok, msg, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (detail ? '  [' + detail + ']' : '')); ok ? pass++ : fail++; };
// base duration in ms at rank 0 - the numbers before this change
const BASE = {
  warCry: { buff: 7000 }, bloodlust: { buff: 20000 }, guardian: { buff: 30000 }, holyShield: { buff: 5000 }, eagleEye: { buff: 30000 },
  celestialAurora: { field: 10000 }, soulSiphon: { thrall: 16000, ward: 12000 }, darkPulse: { undead: 30000 }, wildBond: { wolf: 60000 },
  warlord_warcry: { warCry: 12000, bloodlust: 12000, reach: 12000, banner: 12000 }, crusader_aegis: { aegis: 9000 },
  shadowlord_clones: { clones: 11000 }, hexmaster_grandhex: { orbs: 7000 }, beastmaster_pack: { wolves: 100000 },
  warlord_ult: { enrage: 10000, bloodlust: 10000 }, shadowlord_ult: { shade: 20000 }, archbishop_ult: { invulnerable: 5000 },
  ballista_ult: { turret: 45000 }, beastmaster_ult: { werewolf: 51000, bloodlust: 12000 }, skyhunter_ult: { eagle: 42000 },
};
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof SKILL_FNS !== 'undefined', null, { timeout: 180000 });
  await page.waitForTimeout(6000);
  const r = await page.evaluate(async (ids) => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    loadMap('forest', 300); await sleep(1500);
    game.paused = true;   // nothing ticks between a cast and its read
    const fr = (f) => (f == null ? null : Math.round(f * 1000 / 60));
    const minion = () => (game.minions || []).reduce((a, m) => Math.max(a, m.life || 0), 0) || null;
    const READ = {
      warCry: () => ({ buff: player.buffs.warCry }), bloodlust: () => ({ buff: player.buffs.bloodlust }),
      guardian: () => ({ buff: player.buffs.guardian }), holyShield: () => ({ buff: player.buffs.holyShield }),
      eagleEye: () => ({ buff: player.buffs.eagleEye }),
      celestialAurora: () => ({ field: fr((game.hazards.find((h) => h.type === 'aurora_field') || {}).life) }),
      soulSiphon: () => ({ thrall: minion(), ward: player._necromancerOrbs && player._necromancerOrbs.life }),
      darkPulse: () => ({ undead: minion() }), wildBond: () => ({ wolf: player.pet && player.pet.life }),
      warlord_warcry: () => ({ warCry: player.buffs.warCry, bloodlust: player.buffs.bloodlust, reach: fr(player._warlordBanner - game.time),
        banner: fr((game.hazards.find((h) => h.type === 'warlord_banner') || {}).life) }),
      crusader_aegis: () => ({ aegis: player._aegis && player._aegis.life }),
      shadowlord_clones: () => ({ clones: player._clones && player._clones[0] && player._clones[0].life }),
      hexmaster_grandhex: () => ({ orbs: player._hexOrbs && player._hexOrbs.life }),
      beastmaster_pack: () => ({ wolves: player.pack && player.pack[0] && player.pack[0].life }),
      // _warlordEnrageUntil is a game.time stamp in FRAMES (set with _msFrames, compared against game.time), not a
      // performance.now() one - read as ms it came back ~-9,400
      warlord_ult: () => ({ enrage: Math.round(((player._warlordEnrageUntil - game.time) * (1000 / 60)) / 100) * 100, bloodlust: player.buffs.bloodlust }),
      shadowlord_ult: () => ({ shade: player._shade && player._shade.life }),
      archbishop_ult: () => ({ invulnerable: player.invulnerable }),
      ballista_ult: () => ({ turret: player._ballistaTurrets && player._ballistaTurrets[0] && player._ballistaTurrets[0].life }),
      beastmaster_ult: () => ({ werewolf: player.ultPet && player.ultPet.life, bloodlust: player.buffs.bloodlust }),
      skyhunter_ult: () => ({ eagle: player.ultPet && player.ultPet.life }),
    };
    const lv10 = window.getSkillLv10;
    const castAt = (id, rank, perks) => {
      const sk = SKILLS[id];
      player.cls = sk.cls; player.job = sk.job || null; player.masteries = {}; player.master = sk.master || null; if (sk.master) player.masteries[sk.master] = true;
      player._god = true; player.maxMp = 99999; player.mp = 99999; player.maxHp = 999999; player.hp = 999999; player.facing = 1; player.invulnerable = 0;
      player.buffs = player.buffs || {}; for (const k of Object.keys(player.buffs)) player.buffs[k] = 0;
      player.pet = null; player.pack = []; player.ultPet = null; player._ballistaTurrets = []; player._clones = null; player._hexOrbs = null;
      player._shade = null; player._aegis = null; player._necromancerOrbs = null; player._warlordEnrageUntil = 0; player._warlordBanner = 0;
      if (game.minions) game.minions.length = 0; if (game.hazards) game.hazards.length = 0; game.projectiles.length = 0;
      player.skillRanks = { [id]: rank };
      window.getSkillLv10 = perks ? lv10 : () => null;
      let err = null; try { SKILL_FNS[id](); } catch (e) { err = String(e.message).slice(0, 120); }
      const out = READ[id](); window.getSkillLv10 = lv10;
      return { out, err };
    };
    const res = {};
    for (const id of ids) res[id] = { r0: castAt(id, 0, false), r3: castAt(id, 3, false), r10: castAt(id, 10, false), r10perks: castAt(id, 10, true), lv10: lv10(id) };
    player.skillRanks = {};
    return { res, listed: [...LX_RANK_DUR_IDS], ver: GAME_VERSION };
  }, Object.keys(BASE));
  console.log('build ' + r.ver);
  check(r.listed.length === 20 && Object.keys(BASE).every((id) => r.listed.includes(id)), 'the rank-duration list names exactly the 20 summon / buff skills', r.listed.join(' '));
  for (const [id, base] of Object.entries(BASE)) {
    const x = r.res[id], errs2 = [x.r0.err, x.r3.err, x.r10.err].filter(Boolean);
    const tol = id === 'warlord_ult' ? 150 : 17;   // enrage is read off performance.now(); frames round to 17 ms
    const bad = [];
    for (const [k, ms] of Object.entries(base)) {
      const v0 = x.r0.out[k], v3 = x.r3.out[k], v10 = x.r10.out[k];
      if (!(Math.abs(v0 - ms) <= tol)) bad.push(`${k} rank 0 = ${v0}, want ${ms}`);
      if (!(Math.abs(v3 - v0 - 3000) <= tol)) bad.push(`${k} rank 3 = ${v3}`);
      if (!(Math.abs(v10 - v0 - 10000) <= tol)) bad.push(`${k} rank 10 = ${v10}`);
    }
    check(!errs2.length && !bad.length, `${id}: rank 0 unchanged, rank 3 +3 s, rank 10 +10 s`, errs2.concat(bad).join('; ') || Object.entries(x.r10.out).map(([k, v]) => `${k} ${v0s(x.r0.out[k])}->${v0s(v)}`).join(', '));
  }
  // with the rank perks on, the rank bonus adds on top of them
  const wc = r.res.warCry, ae = r.res.crusader_aegis;
  check(wc.r10perks.out.buff === 7000 + ((wc.lv10 && wc.lv10.buffMs) || 0) + 10000, 'War Cry at rank 10 keeps its perk time and adds 10 s', `${wc.r10perks.out.buff} ms, perk ${JSON.stringify(wc.lv10)}`);
  check(ae.r10perks.out.aegis === Math.floor(9000 * ((ae.lv10 && ae.lv10.orbDurMul) || 1)) + 10000, 'Divine Aegis at rank 10 keeps its x1.2 orb time and adds 10 s', `${ae.r10perks.out.aegis} ms`);
  check(!errs.length, 'no page errors', errs.slice(0, 3).join(' | '));
} finally { await browser.close(); server.kill(); }
function v0s(v) { return v == null ? '-' : (v / 1000) + 's'; }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
