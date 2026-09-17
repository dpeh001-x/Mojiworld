// SKILL RANK ATTRIBUTION (v0.30.854): a skill's RP rank boosts THAT SKILL'S hits - every one of them, and only once.
// Casts every skill of every class at a pinned dummy inside a small cluster with ONLY that skill at rank 10, hooks hitMonster and
// the pipeline's own getSkillRankMul call, and records per hit: its tag, the multiplier the pipeline really used, and which skill
// it was attributed to. Then a per-hit damage check at rank 4 vs rank 0 (x1.20, x1.08 for a basic) on skills from each attribution
// route - so a hit that is attributed AND tag-resolved is proven to be multiplied once, not twice.
//   [SERVE_ROOT=<dir>] node scripts/skill_rank_attribution_test.mjs [page.html] [--window=7000] [--only=cls,..] [--json=out.json] [--md=table.md]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync, writeFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11143';
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const WINDOW = Number(arg('window', 7000)), ONLY = arg('only', '').split(',').filter(Boolean), JSON_OUT = arg('json', ''), MD_OUT = arg('md', ''), RATIO_ONLY = process.argv.includes('--ratio-only');
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
let out = null;
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof castSkill === 'function' && typeof getSkillRankMul === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(6000);
  out = await page.evaluate(async ({ WINDOW, ONLY, RATIO_ONLY }) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; _playStoryBeat = function () { return false; }; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    loadMap('forest', 300); await sleep(2500); game.paused = false;
    for (let i = 0; i < 30 && !player.onGround; i++) await sleep(100);
    const _x0 = player.x, _y0 = player.y;
    Object.defineProperty(game, 'comboMult', { get: () => 1, set() {}, configurable: true });
    Object.defineProperty(game, 'critStreak', { get: () => 0, set() {}, configurable: true });
    Object.defineProperty(game, 'combo', { get: () => 0, set() {}, configurable: true });
    window.getCritDmg = () => 1; window.rollCrit = () => false; const _rnd = Math.random; Math.random = () => 0.95;
    const ALL = {}; for (const id of Object.keys(SKILLS)) ALL[id] = 10;
    // which skill's rank does a TAG resolve to? (the game's own resolution, replayed with every rank at 10)
    const resolve = (tag) => { if (tag === 'melee') return LX_BASIC_MELEE_ID_BY_CLS[player.cls] || null; if (!tag || SKILL_RANK_BLACKLIST.has(tag)) return null; if (SKILLS[tag]) return tag; const a = SKILL_HIT_TAG_TO_DEF_ID[tag]; return (a && SKILLS[a]) ? a : null; };
    let cur = null, log = null, dummies = [], cap = null; const NEVER = new Set(['thorns', 'burn', 'minion', 'pet', 'pack', 'afterimage']);
    // Record what the PIPELINE used: the first getSkillRankMul call made inside each hitMonster call (a stack, because a hit can
    // set off other hits from inside - chain lightning, overkill carry, the spell echo - and each of those asks for itself).
    const _hm = window.hitMonster, _grm = window.getSkillRankMul, stack = [];
    window.getSkillRankMul = function (tag, src) { const r = _grm.apply(this, arguments); const f = stack[stack.length - 1]; if (f && f.mul == null) { f.mul = r; f.src = src || null; } return r; };
    window.hitMonster = function (m, dmg, isCrit, skill) {
      const fr = { mul: null, src: null, depth: stack.length }; stack.push(fr); let r; const hp0 = (m && m.currentHp) || 0;
      try { r = _hm.apply(this, arguments); } finally { stack.pop(); }
      if (cap && fr.depth === 0 && dummies.indexOf(m) >= 0 && !NEVER.has(skill) && hp0 - m.currentHp > (cap.v || 0)) cap.v = Math.round(hp0 - m.currentHp);   // the biggest own hit of the window (a first hit can be a half-damage edge hit)
      if (log && dummies.indexOf(m) >= 0 && skill !== '__coop') {
        const mulOwn = fr.mul == null ? 1 : fr.mul; const to = fr.src || resolve(skill);
        const k = String(skill) + (fr.depth ? ' (nested)' : '') + '|' + (fr.src || ''); const b = log[k] = log[k] || { n: 0, mulOwn, to, g: _isGSkill(skill), cls: skill === player._classSkillMulSkillId, nested: fr.depth > 0, mixed: false }; b.n++; if (Math.abs(b.mulOwn - mulOwn) > 1e-9) { b.mixed = true; b.mulOwn = Math.min(b.mulOwn, mulOwn); }
      }
      return r;
    };
    const mk = () => { game.monsters.length = 0; dummies = [];
      for (const [dx, dy] of [[150, -10], [230, -10], [320, -10], [-160, -10], [60, -10], [150, -150]]) { const m = spawnMonster(player.x + dx, player.y + dy, 'slime', false); if (!m) continue;
        m.w = 60; m.h = 60; m.maxHp = 9e12; m.currentHp = 9e12; m.evasion = 0; m.speed = 0; m.atk = 0; m._pinX = m.x = player.x + dx; m._pinY = m.y = player.y + dy; m.vx = m.vy = 0; m.frozen = 99999; m.stunTimer = 99999; dummies.push(m); } };
    const setup = (id) => { const sk = SKILLS[id];
      player.x = _x0; player.y = _y0; player.vx = 0; player.vy = 0;
      player.cls = sk.cls; player.job = sk.job || null; player.masteries = {}; player.master = sk.master || null; if (sk.master) player.masteries[sk.master] = true;
      player._god = true; player.level = 90; player.baseAtk = 1000; player.baseCrit = 0; player.mods = player.mods || {}; player.mods.crit = 0;
      player.maxMp = 99999; player.mp = 99999; player.maxHp = 999999; player.hp = 999999; player.facing = 1; player._releasedCharge = 1;
      player.pet = null; player.pack = []; player.ultPet = null; player.buffs = player.buffs || {}; for (const k of Object.keys(player.buffs)) player.buffs[k] = 0;
      if (game.minions) game.minions.length = 0; player._ballistaTurrets = []; player._clones = null; player._hexOrbs = null; player._shade = null; player._judgeStacks = 0; player._mirrorBlink = false;
      player._ballistaChannel = null; if (typeof _LX_DE !== 'undefined' && _LX_DE) { _LX_DE.execTally = 0; _LX_DE.meter = 0; _LX_DE.protocolTotal = 0; _LX_DE.tally = 0; }
      player._msWin = null; player._aegis = null; player._eclipseRain = null; player._eclipseHold = null; player._doomWinBonus = null; player._necromancerOrbs = null;
      player.dragoonSlam = 0; player._dragoonExtraSlam = 0; player._slamPierceLeft = 0; player._ascended = false; player._dawnStored = 0; player._bastionArmAt = 0; player._bastionArmedUntil = 0; player._calamityHeat = 0;
      if (game.orbs) game.orbs.length = 0; for (const k of Object.keys(player._cd || {})) player._cd[k] = 0; if (player.cooldowns) for (const k of Object.keys(player.cooldowns)) player.cooldowns[k] = 0; if (player.skillCooldowns) for (const k of Object.keys(player.skillCooldowns)) player.skillCooldowns[k] = 0;
      game.projectiles.length = 0; if (game.hazards) game.hazards.length = 0;
      player.skillRanks = { [id]: 10 }; };
    const USES = { marksman_oneshot: [Math.floor(6000 / 430), 430], marksman_ult: [Math.floor(6000 / 260), 260] };
    const cast = async (id) => { const u = USES[id];
      if (id === 'crusader_ult') { castSkill(id); await sleep(150); player._bastionArmAt = game.time - 600; player._dawnStored = getMaxHp(); castSkill(id); return; }
      if (!u) { castSkill(id); return; }
      for (let i = 0; i < u[0]; i++) { for (const k of Object.keys(player.skillCooldowns || {})) player.skillCooldowns[k] = 0; player.mp = 99999; try { castSkill(id); } catch (e) {} await sleep(u[1]); } };
    const res = { ver: GAME_VERSION, window: WINDOW, skills: {} };
    for (const id of Object.keys(SKILLS)) { const sk = SKILLS[id]; if (RATIO_ONLY || (ONLY.length && !ONLY.includes(sk.cls))) continue;
      setup(id); mk(); await sleep(250); cur = id; log = {}; let err = null;
      try { await cast(id); } catch (e) { err = String(e.message).slice(0, 80); }
      const t0 = performance.now(); while (performance.now() - t0 < WINDOW) { await sleep(200); for (const m of dummies) { m.frozen = 99999; m.stunTimer = 99999; m.vx = 0; m.x = m._pinX; m.y = m._pinY; } }
      const expect = _skillRankMulAt(id, 10);
      res.skills[id] = { name: sk.name, cls: sk.cls, job: sk.job || '', master: sk.master || '', slot: sk.slot, expect, dur: (typeof LX_RANK_DUR_IDS !== 'undefined' && LX_RANK_DUR_IDS.has(id)), err, tags: log }; log = null;
    }
    // ---- per-hit damage at rank 4 (no milestone perk below rank 5) against rank 0: one skill per attribution route ----
    res.ratio = {};
    const firstHit = async (id, rank) => { setup(id); player.skillRanks = rank ? { [id]: rank } : {}; mk();
      // the previous sample ends the moment its first hit lands - its dash, leap or cast lock can still hold the hero, and the next cast is refused
      for (let i = 0; i < 40 && (!player.onGround || (player.attackTimer | 0) > 0 || (player.rushTimer | 0) > 0); i++) await sleep(100);
      player.attackTimer = 0; player.state = 'idle'; player.x = _x0; player.y = _y0; player.vx = 0; player.vy = 0; for (const k of Object.keys(player.skillCooldowns || {})) player.skillCooldowns[k] = 0; await sleep(400); cap = { v: null }; try { await cast(id); } catch (e) {}
      const t0 = performance.now(); while (performance.now() - t0 < 4000) { await sleep(100); for (const m of dummies) { m.frozen = 99999; m.stunTimer = 99999; m.vx = 0; m.x = m._pinX; m.y = m._pinY; } } const v = cap.v; cap = null; await sleep(600); return v; };
    for (const id of ['slash', 'fireball', 'arcaneBurst', 'groundSlam', 'multiShot', 'arrowRain', 'smokeBomb', 'dragoon_skylance', 'ballista_volley', 'shinobi_seal', 'sage_meteorshower']) { if (!SKILLS[id] || (ONLY.length && !ONLY.includes(SKILLS[id].cls))) continue;
      const r0 = await firstHit(id, 0), r4 = await firstHit(id, 4); res.ratio[id] = { r0, r4, want: _skillRankMulAt(id, 4) }; }
    // ---- the panel says what a rank really gives: '+N s' for a skill with no damage of its own, '+N%' for the rest ----
    try { setup('wildBond'); player.skillRanks = { wildBond: 3, multiShot: 3 }; player.skillRankPoints = 5; const host = document.createElement('div'); document.body.appendChild(host); renderSkillsReference(host);
      const tile = (id) => { const b = host.querySelector('[data-rankid="' + id + '"]'); const blk = b && b.closest('.skl-rank'); const pct = blk && blk.querySelector('.skl-rank-pct'); return pct ? pct.textContent.trim() : null; };
      res.panel = { wildBond: tile('wildBond'), multiShot: tile('multiShot'), set: (typeof LX_RANK_NO_DMG_IDS !== 'undefined') ? [...LX_RANK_NO_DMG_IDS].sort().join(',') : null }; host.remove(); } catch (e) { res.panel = { err: String(e.message).slice(0, 120) }; }
    Math.random = _rnd; window.hitMonster = _hm; window.getSkillRankMul = _grm; return res; }, { WINDOW, ONLY, RATIO_ONLY });
} catch (e) { console.log('HARNESS ERROR', String(e.message).slice(0, 300)); process.exitCode = 1; }
await browser.close(); server.kill();
if (out) {
  const rows = [], md = [`# Skill rank attribution — ${out.ver} (measured)`, '', 'Each skill cast once with ONLY that skill at RP rank 10. `mul used` is what the damage pipeline multiplied the hit by; `resolves to` is whose rank the tag looks up.', '', '| class | skill | id | key | expect | hit tag × n → mul used (resolves to) | verdict |', '|---|---|---|---|---:|---|---|'];
  const BL = new Set(['thorns', 'burn', 'minion', 'pet', 'pack', 'afterimage']);
  for (const [id, s] of Object.entries(out.skills)) { const tags = Object.entries(s.tags || {}); const dmgTags = tags.filter(([t, b]) => !BL.has(t.split('|')[0].replace(' (nested)', '')) && !b.nested);
    const ok = dmgTags.filter(([, b]) => Math.abs(b.mulOwn - s.expect) < 1e-9), miss = dmgTags.filter(([, b]) => Math.abs(b.mulOwn - s.expect) >= 1e-9);
    const verdict = s.err ? 'ERR ' + s.err : !tags.length ? 'no hits (utility / did not connect)' : !dmgTags.length ? 'summon / reactive only' : !miss.length ? 'OK' : !ok.length ? (miss.some(([, b]) => b.to && b.to !== id) ? 'WRONG SKILL' : 'NONE') : 'PARTIAL';
    rows.push({ id, verdict, ...s });
    md.push(`| ${s.cls}${s.master ? ' / ' + s.master : s.job ? ' / ' + s.job : ''} | ${s.name} | ${id} | ${s.slot.toUpperCase()} | x${s.expect.toFixed(2)} | ${tags.map(([t, b]) => `\`${t}\`×${b.n} → x${b.mulOwn.toFixed(2)}${b.to ? ' (' + (b.to === id ? 'own' : b.to) + ')' : ' (none)'}`).join('; ') || '—'} | ${verdict}${s.dur ? ' · +1 s/rank' : ''} |`); }
  const tally = {}; for (const r of rows) tally[r.verdict.replace(/^ERR.*/, 'ERR')] = (tally[r.verdict.replace(/^ERR.*/, 'ERR')] || 0) + 1;
  md.push('', 'Tally: ' + JSON.stringify(tally));
  console.log('build ' + out.ver + '  ' + JSON.stringify(tally)); if (errs.length) console.log('page errors: ' + errs.slice(0, 4).join(' | '));
  let pass = 0, fail = 0; const check = (ok, msg, d) => { if (!ok || process.argv.includes('--verbose')) console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
  const UTILITY = new Set(['bloodlust', 'guardian', 'shadowlord_ult']);                 // deal no damage of their own
  const SUMMON = new Set(['wildBond', 'beastmaster_pack', 'beastmaster_ult']);          // all their damage is the summon's (never ranked; +1 s a rank instead)
  for (const r of rows) { const tagsTxt = Object.entries(r.tags || {}).map(([t, b]) => t + ' x' + b.n + ' -> ' + b.mulOwn.toFixed(2)).join('; ');
    if (UTILITY.has(r.id)) check(/^no hits|^OK/.test(r.verdict), r.id + ': a utility skill (no damaging hit of its own)', r.verdict + ' ' + tagsTxt);
    else if (SUMMON.has(r.id)) check(/^summon/.test(r.verdict), r.id + ': only summon damage, which is never ranked', r.verdict + ' ' + tagsTxt);
    else check(r.verdict === 'OK', r.id + ': every hit of its own uses ITS rank (x' + r.expect.toFixed(2) + ' at rank 10)', r.verdict + ' ' + tagsTxt);
    for (const [t, b] of Object.entries(r.tags || {})) if (BL.has(t.split('|')[0].replace(' (nested)', ''))) check(Math.abs(b.mulOwn - 1) < 1e-9, r.id + ': ' + t.split('|')[0] + ' damage is never ranked', 'x' + b.mulOwn.toFixed(2)); }
  for (const [id, q] of Object.entries(out.ratio || {})) check(q.r0 > 0 && q.r4 > 0 && Math.abs(q.r4 / q.r0 - q.want) <= 0.02, id + ': the biggest hit at rank 4 deals x' + q.want.toFixed(2) + ' of rank 0 - once, not twice', JSON.stringify(q));
  { const p = out.panel || {}; check(p.wildBond === '+3 s' && p.multiShot === '+15%' && p.set === 'beastmaster_pack,beastmaster_ult,bloodlust,guardian,shadowlord_ult,wildBond', 'the Skills panel: Wild Bond rank 3 reads "+3 s" (it has no damage of its own), Multi Shot rank 3 reads "+15%"', JSON.stringify(p)); }
  check(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
  console.log(pass + '/' + (pass + fail) + ' checks passed'); process.exitCode = fail ? 1 : 0;
  if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(out, null, 1)); if (MD_OUT) writeFileSync(MD_OUT, md.join('\n') + '\n');
}
