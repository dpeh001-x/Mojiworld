// skill_damage_scan.js - finds every damage number a skill owns, in the game source, by reading the
// source itself: no manifest to go stale. Shared by tools/skill_tuner.html (browser <script>) and the
// node scripts (loaded with vm.runInNewContext). Exposes lxScanSkills(src) -> { skills, stats }.
//
// A skill's numbers are: its SKILLS row (mp, cd), every ATK multiplier / flat / area multiplier on a
// line of its own SKILL_FNS body, the LX_* constants that body names (numeric consts and the numeric
// fields of object consts), the same inside the _lx* helpers the body calls (one hop, helpers shared by
// 3+ skills are utilities and skipped), and a short curated list of indirections that a body never
// names because a later press or a hazard resolver fires them (Deadeye / Protocol lines, the Dawn
// curve, the doom heat). Every line is returned trimmed with its count in the file, so an edit can be
// applied as a count-gated substring replace - the same contract as scripts/apply_skill_patch.mjs.
(function (root) {
  'use strict';
  const N = '(\\d+(?:\\.\\d+)?)';
  // each pattern ENDS with the number, so its offset is match.index + match.length - number.length
  const LINE_PATTERNS = [
    [new RegExp('getAtk\\(\\)\\s*\\*\\s*' + N, 'g'), 'mul'],
    [new RegExp('baseAtk\\s*\\*\\s*' + N, 'g'), 'mul'],
    [new RegExp('perform(?:Around|Melee)\\(\\s*[^,()]+,\\s*' + N, 'g'), 'mul'],   // performAround(540, 1.16, ...) or performAround(_abAoe, 2.4, ...)
    [new RegExp('_sageDmgMul:\\s*' + N, 'g'), 'mul'],
    [new RegExp('\\b(?:dmg|damage|atk)Mul:\\s*' + N, 'g'), 'mul'],
    // "+ N" right after an ATK term: getAtk() * 1.4 + 12, (getAtk() * 0.9) + 6, getAtk() * 0.85 * _heatMul + 6
    [new RegExp('(?:getAtk\\(\\)|baseAtk)\\s*\\*\\s*\\d+(?:\\.\\d+)?(?:\\s*\\*\\s*[A-Za-z_$][\\w$.]*)*\\)?\\s*\\+\\s*' + N, 'g'), 'flat'],
    [new RegExp('\\bdmg:\\s*' + N, 'g'), 'mul'],                                                   // { delay: 180, dmg: 1.6, crit: true } -> getAtk() * s.dmg
    [new RegExp('\\b(?:const|let)\\s+\\w*(?:[Dd]mg|[Mm]ul)\\w*\\s*=\\s*' + N + '\\s*;', 'g'), 'mul'],     // const laneMul = 1.4;
    [new RegExp('\\braiseMinion\\([^()]*,\\s*(\\d+\\.\\d+)(?=\\s*\\))', 'g'), 'mul'],               // raiseMinion(x, y, type, life, 0.55) - the caller's bite (a fraction; the life before it is an integer)
    // ---- the other variables a skill is made of (shown and editable; never scaled by the tier generator) ----
    [new RegExp('\\bfor\\s*\\(\\s*(?:let|var)\\s+\\w+\\s*=\\s*0\\s*;\\s*\\w+\\s*<\\s*' + N + '(?=\\s*;)', 'g'), 'count'],   // for (let i = 0; i < 9; i++) - lances, shards, waves, summons
    [new RegExp('\\b(?:count|targets|waves|rings|shards|lances|orbs|bolts|hops|n)\\s*:\\s*' + N, 'g'), 'count'],
    [new RegExp('\\bperform(?:Around|Melee)\\(\\s*' + N + '(?=\\s*,)', 'g'), 'radius'],           // performAround(540, ...) - the reach
    [new RegExp('\\b(?:explode|aoeOnHit|radius|range|reach|aoe)\\s*:\\s*' + N, 'g'), 'radius'],
    [new RegExp('\\braiseMinion\\([^()]*,\\s*(\\d{3,})(?=\\s*[,)])', 'g'), 'time'],                 // raiseMinion(x, y, type, 30000[, bite]) - the summon's life in ms
    [new RegExp("\\b_applyMobStatus\\([^,()]+,\\s*'[a-z]+',\\s*" + N, 'g'), 'time'],              // _applyMobStatus(m, 'stun', 1200, ...) - the status duration in ms
    [new RegExp("\\b_applyMobStatus\\([^()]*\\{[^}]*\\bchance:\\s*" + N, 'g'), 'frac'],           // ...its chance
    [new RegExp('\\b(?:freezeTimer|stunTimer|burnTimer|slowTimer)\\s*=\\s*Math\\.max\\([^,()]+(?:\\([^()]*\\))?[^,()]*,\\s*' + N, 'g'), 'time'],   // m.freezeTimer = Math.max(m.freezeTimer || 0, 1500)
    [new RegExp('\\blife:\\s*' + N, 'g'), 'time'],                                                  // life: 130 - projectile / hazard / ward life (frames or ms, as the line says)
    [new RegExp('\\b(?:ms|dur|duration|until)\\s*:\\s*' + N, 'g'), 'time'],
    [new RegExp('\\b(?:vx|vy|speed|sp)\\s*:\\s*(?:Math\\.(?:cos|sin)\\([^()]*\\)\\s*\\*\\s*)?' + N, 'g'), 'speed'],   // vx: Math.cos(a) * 9 / speed: 13
    [new RegExp('\\bpierce\\w*:\\s*' + N, 'g'), 'count'],
  ];
  // const laneDmg = cond ? 1.4 : 1.0;  -> two numbers, both this skill's
  const NAMED_TERNARY = new RegExp('\\b(?:const|let)\\s+\\w*(?:[Dd]mg|[Mm]ul)\\w*\\s*=[^;?]*\\?\\s*' + N + '\\s*:\\s*' + N + '\\s*;', 'g');
  const OBJ_FIELDS = new RegExp('\\b(mul|flat|baseMul|timeMul|dmgAmp|dmg|atk|dps|perStack|cap)\\s*:\\s*' + N, 'g');
  // a constant is a damage number only when its NAME says so; caps, windows, ranges, heat budgets and
  // vulnerability stacks are not (LX_DOOM_CONSUME_CAP is how much heat the ult eats, not what it deals)
  const CONST_KIND = (name) => /VULN|CONSUME|_AT$|RESIST/.test(name) ? null
    : /_MS$|WINDOW|GATE|_ICD|_CD$|TICK_MS|DURATION/.test(name) ? 'time'      // durations, windows, gates: shown and editable, never scaled
    : /RANGE|RADIUS|REACH|_PX$/.test(name) ? 'radius'
    : /FRAC|SPLASH|SHARE|PCT$/.test(name) ? 'frac'          // a share of damage already dealt: shown, never scaled with the lines
    : /FLAT/.test(name) ? 'flat'
    : /_DMG|DMG_|_ATK|ATK_|_MUL|MUL_|DPS|_DOT|DOT_|BURST|RUPTURE|FINALE|HEAT_DMG|EXEC_FRAC/.test(name) ? 'mul'
    : /ORBS|LINES|COUNT|WAVES|SHARDS|LANCES|PRESSES|BOLTS|HOPS|_N$|PILLARS|COMETS/.test(name) ? 'count' : null;
  // indirections a body never names: fired on a later press, by a window table or a hazard resolver
  // An entry is a const name, a function name, or a LINE LOCATOR { frag, ctx, span }: every line that
  // contains `frag` (number-free on purpose, so it survives the number changing) and, when `ctx` is
  // given, has a line containing `ctx` within `span` lines of it. Locators cover damage dealt from an
  // update loop or a hazard resolver, which no body names: turrets, pets, the eagle, the aegis orbs,
  // the eclipse rain, the dive that lands on a timer, the meteor that lands from a warning marker.
  const EXTRA = {
    marksman_oneshot: ['LX_DEADEYE_LINE_ATK', 'LX_DEADEYE_LINE_FLAT', 'LX_DEADEYE_LINES'],
    marksman_ult: ['LX_PROTOCOL_LINE_ATK', 'LX_PROTOCOL_LINE_FLAT', 'LX_PROTOCOL_LINES', 'LX_PROTOCOL_EXEC_FRAC', '_lxProtocolExecute', '_lxProtocolVolley'],
    crusader_ult: ['LX_DAWN'],
    doombringer_ult: ['LX_DOOM_HEAT_DMG'], doombringer_apoc: ['LX_DOOM_HEAT_DMG'],
    hexmaster_grandhex: ['LX_GRANDHEX_DOT_PER_STACK', 'LX_GRANDHEX_BURST_MUL', 'LX_GRANDHEX_RUPTURE_MUL', 'LX_HEXORB_DMG_MUL'],
    hexmaster_ult: ['LX_PANDEMIC_ORB_MUL', 'LX_PANDEMIC_FINALE_BASE', 'LX_PANDEMIC_FINALE_PER_STACK', 'LX_PANDEMIC_FINALE_CAP', 'LX_PANDEMIC_ORBS'],
    shinobi_seal: ['LX_KAGE_DMG'],
    elementalist_ult: ['LX_APO_CAT'],
    magicBolt: ['performBolt'],
    meteor: [{ frag: ': getAtk() *', ctx: "typeof h._sageDmgMul === 'number'", span: 3 }],
    ballista_volley: [{ frag: "skill: 'siege'" }],
    ballista_ult: [{ frag: 'damage: Math.floor(getAtk() *', ctx: "bspr: 'bult_ballista'", span: 2 }],
    beastmaster_pack: [{ frag: "rollCrit(), 'pack')" }],
    wildBond: [{ frag: "rollCrit(), 'pet')" }], beastmaster_ult: [{ frag: "rollCrit(), 'pet')" }],
    skyhunter_ult: [{ frag: 'x: _eCx, y: _eCy' }],
    crusader_aegis: [{ frag: 'paladin/crusader "slightly"' }],
    nightreaper_mark: [{ frag: '* (isCrit ? getCritDmg() : 1)));' }],
    dragoon_skylance: [{ frag: "color:'#88ccff', kb:14, bossMul: 1.6" }],
    rush: [{ frag: "hitMonster(m, dmg, _rc, 'rush');", above: 3 }],   // the dash-through hit in the player update: 1.8x, computed on the line above
    soulSiphon: [{ frag: 'const dmg = Math.floor(getAtk() *', ctx: "'necromancerorb'", span: 20 }],   // the Soul Ward's orbs (12 s, one every 1.5 s) are most of what it deals
  };
  const UTIL = new Set(['_lxBoonPotency', '_lxVfxReady', '_lxDeNow', '_lxDeSfx', '_lxDeAlive', '_lxMobScale', '_lxAnimCalib', '_lxDeFmt', '_lxDeHit', '_lxDeMuzzle',
    'getEquipBonus', '_chibiApply', 'getMaxHp', 'getAtk', 'getCrit', 'getCritDmg', 'rollCrit', 'hasMilestone']);   // generic helpers two skills happen to share

  function lxScanSkills(src) {
    const lines = src.split(/\r?\n/);
    const count = (t) => src.split(t).length - 1;
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // ---- SKILLS rows ----
    const skills = []; const byId = {};
    {
      const start = lines.findIndex((l) => /^const SKILLS = \{/.test(l)); if (start < 0) return { skills, stats: { error: 'SKILLS not found' } };
      let end = lines.length; for (let i = start + 1; i < lines.length; i++) if (/^\};/.test(lines[i])) { end = i; break; }
      for (let i = start; i <= end; i++) {
        const L = lines[i]; const id = (L.match(/^\s{2}([A-Za-z_0-9]+)\s*:\s*\{/) || [])[1]; if (!id) continue;
        const str = (k) => { const m = L.match(new RegExp(k + ":\\s*'((?:[^'\\\\]|\\\\.)*)'")); return m ? m[1].replace(/\\'/g, "'") : ''; };
        const num = (k) => { const m = L.match(new RegExp('\\b' + k + ':\\s*(\\d+)')); return m ? +m[1] : null; };
        if (num('cd') === null && num('mp') === null) continue;
        const slot = str('slot');
        const s = { id, name: str('name'), cls: str('cls'), job: str('job'), master: str('master'), slot, mp: num('mp'), cd: num('cd'), desc: str('desc'),
          tier: 'xb'.includes(slot) ? 'master' : 'qc'.includes(slot) ? 'job' : 'base', rowLine: i + 1, lines: [] };
        skills.push(s); byId[id] = s;
      }
    }
    // ---- SKILL_FNS bodies + top-level function bodies ----
    const bodies = {}; const fns = {};
    {
      const start = lines.findIndex((l) => /^const SKILL_FNS = \{/.test(l));
      let end = lines.length; for (let i = start + 1; i < lines.length; i++) if (/^\};/.test(lines[i])) { end = i; break; }
      let cur = null;
      for (let i = start + 1; i < end; i++) {
        const m = lines[i].match(/^\s{2}([A-Za-z_0-9]+)\s*:\s*(?:\([^)]*\)\s*=>|function\b|async\b)/);   // () => {  or  (_o) => {
        if (m) { cur = m[1]; bodies[cur] = { from: i, to: i }; continue; }
        if (cur) bodies[cur].to = i;
      }
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/); if (!m) continue;
        let j = i + 1; while (j < lines.length && !/^\}/.test(lines[j])) j++;
        fns[m[1]] = { from: i, to: j };
      }
    }
    const constDef = (name) => {
      const re = new RegExp('^const\\s+' + esc(name) + '\\s*=\\s*(\\d+(?:\\.\\d+)?)\\s*[;,]', 'm');
      const m = src.match(re); if (m) return { kind: 'num', text: m[0], value: +m[1] };
      const i = lines.findIndex((l) => new RegExp('^const\\s+' + esc(name) + '\\s*=\\s*\\{').test(l)); if (i < 0) return null;
      let j = i + 1; while (j < lines.length && !/^\};/.test(lines[j])) j++;
      return { kind: 'obj', from: i, to: j };
    };
    // how many bodies name each helper: 3+ = a utility, not this skill's number
    const helperRefs = {};
    for (const id in bodies) { const seen = new Set(); for (let i = bodies[id].from; i <= bodies[id].to; i++) for (const m of lines[i].matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) if (fns[m[1]]) seen.add(m[1]); for (const h of seen) helperRefs[h] = (helperRefs[h] || 0) + 1; }
    const TERNARY = new RegExp('getAtk\\(\\)\\s*\\*\\s*\\([^()]*?\\?\\s*' + N + '\\s*:\\s*' + N + '\\)', 'g');   // getAtk() * (slot === 'ultPet' ? 0.51 : 1.1)
    const fieldsOf = (text, extra) => {
      const out = []; const seen = new Set();
      for (const [re, kind] of LINE_PATTERNS) for (const m of text.matchAll(re)) { const start = m.index + m[0].length - m[1].length; if (seen.has(start)) continue; seen.add(start); out.push({ kind, value: +m[1], start, end: start + m[1].length }); }
      for (const m of text.matchAll(TERNARY)) {
        const s2 = m.index + m[0].length - 1 - m[2].length, s1 = m.index + m[0].lastIndexOf(m[1], s2 - m.index - 1);
        for (const [v, st] of [[m[1], s1], [m[2], s2]]) { if (seen.has(st)) continue; seen.add(st); out.push({ kind: 'mul', value: +v, start: st, end: st + v.length }); }
      }
      for (const m of text.matchAll(NAMED_TERNARY)) {
        const tail = m[0].replace(/\s*;$/, ''); const s2 = m.index + tail.length - m[2].length, s1 = m.index + tail.lastIndexOf(m[1], s2 - m.index - 1);
        for (const [v, st] of [[m[1], s1], [m[2], s2]]) { if (seen.has(st)) continue; seen.add(st); out.push({ kind: 'mul', value: +v, start: st, end: st + v.length }); }
      }
      if (extra) for (const m of text.matchAll(extra)) { const start = m.index + m[0].length - m[2].length; if (seen.has(start)) continue; seen.add(start); out.push({ kind: /flat/i.test(m[1]) ? 'flat' : 'mul', name: m[1], value: +m[2], start, end: start + m[2].length }); }
      return out.sort((a, b) => a.start - b.start);
    };
    // a line carries a skill VARIABLE (count / reach / duration / speed) only when it is part of what the
    // skill deals or does - a projectile, a hazard, a hit, a status, a summon, a constant. Particle lives,
    // particle velocities and VFX loops match the same shapes and are noise.
    const DEALS = /damage:|\bdmg\b|\batk:|hitMonster|perform(?:Around|Melee)|raiseMinion|_applyMobStatus|hazards\.push|projectiles\.push|\bskill:|owner: 'player'|\bLX_|^const |Timer = Math\.max|homing/;
    const loopDeals = (lineNo) => { for (let j = lineNo + 1; j <= Math.min(lines.length - 1, lineNo + 14); j++) { if (/^\s*\}/.test(lines[j]) && lines[j].search(/\S/) <= lines[lineNo].search(/\S/)) return false; if (DEALS.test(lines[j]) && !/pixelBurst|_budgetedParticlePush|spawnSpriteBurst|spawnSmooth/.test(lines[j])) return true; } return false; };
    const addLine = (s, lineNo, via, fields, objFields) => {
      const raw = lines[lineNo]; if (/^\s*\/\//.test(raw)) return;                       // a comment
      const text = raw.trim(); if (!text) return;
      let f = fields || fieldsOf(text, objFields ? OBJ_FIELDS : null); if (!f.length) return;
      if (!fields) {
        // visual effects, not skill numbers: particle / burst option lines ("{ size: .., life: 40, spin: .. }"),
        // and a ward's starting state ("{ life: 0, maxLife: .. }")
        const noise = /pixelBurst|_budgetedParticlePush|spawnSpriteBurst|spawnSmooth|damageNumbers|particles\.push|Opts:|bodyAlpha|alpha:|\bspin:|\bopacity:|\bbehind:\s*true|maxLife:|\bsize:\s*[^,]+,\s*life:/.test(text);
        const deals = DEALS.test(text) && !noise;
        const isLoop = /^\s*for\s*\(/.test(raw);
        f = f.filter((x) => x.kind === 'mul' || x.kind === 'flat' || x.kind === 'frac' || (isLoop ? (!noise && loopDeals(lineNo)) : deals));
        // a bare loop header ("for (let i = 0; i < 3; i++) {") that appears elsewhere in the game is not this
        // skill's number: the text is identical in every copy, so an edit would rewrite all of them (one was in 91 places)
        if (isLoop && /^for\s*\([^)]*\)\s*\{?\s*$/.test(text) && count(text) > 1) f = f.filter((x) => x.kind !== 'count');
        if (!f.length) return;
      }
      if (s.lines.some((l) => l.text === text)) return;
      s.lines.push({ text, lineNo: lineNo + 1, count: count(text), via: via || '', fields: f });
    };
    const scanRange = (s, from, to, via) => { for (let i = from; i <= to; i++) addLine(s, i, via); };
    const addConst = (s, name, via) => {
      const d = constDef(name); if (!d) return;
      if (d.kind === 'num') {
        if (!CONST_KIND(name)) return; const ln = lines.findIndex((l) => l.startsWith(d.text.split('\n')[0])); if (ln < 0) return;
        const t = lines[ln].trim(); if (s.lines.some((l) => l.text === t)) return;
        // every NAME = number pair on the line (const LX_PROTOCOL_LINE_ATK = 0.006, LX_PROTOCOL_LINE_FLAT = 1;), each with its own kind
        const code = t.replace(/\/\/.*$/, ''); const fields = [];
        for (const m of code.matchAll(new RegExp('\\b([A-Z_][A-Z0-9_]*)\\s*=\\s*' + N, 'g'))) { const kind = CONST_KIND(m[1]); if (!kind) continue; const start = m.index + m[0].length - m[2].length; fields.push({ kind, name: m[1], value: +m[2], start, end: start + m[2].length }); }
        if (fields.length) s.lines.push({ text: t, lineNo: ln + 1, count: count(t), via: via || '', fields }); return;
      }
      for (let i = d.from + 1; i < d.to; i++) addLine(s, i, via || name, null, true);
    };
    const scanBody = (s, from, to, via) => {
      scanRange(s, from, to, via);
      const named = new Set(); for (let i = from; i <= to; i++) for (const m of lines[i].matchAll(/\bLX_[A-Z0-9_]+\b/g)) named.add(m[0]);
      for (const c of named) addConst(s, c, via);
    };
    const locate = (s, loc) => {
      for (let i = 0; i < lines.length; i++) {
        if (!lines[i].includes(loc.frag)) continue;
        if (loc.ctx) { let ok = false; for (let j = Math.max(0, i - (loc.span || 3)); j <= Math.min(lines.length - 1, i + (loc.span || 3)); j++) if (lines[j].includes(loc.ctx)) { ok = true; break; } if (!ok) continue; }
        if (loc.above) {   // the number is computed on a line just above the hit: take the nearest line above that carries one
          for (let j = i - 1; j >= Math.max(0, i - loc.above); j--) { const before = s.lines.length; addLine(s, j, 'locator'); if (s.lines.length > before) break; }
        } else addLine(s, i, 'locator');
      }
    };
    for (const s of skills) {
      const b = bodies[s.id];
      if (b) {
        scanBody(s, b.from, b.to, '');
        // one hop into the top-level functions the body calls; a function 3+ skills call is a utility
        const helpers = new Set(); for (let i = b.from; i <= b.to; i++) for (const m of lines[i].matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) if (fns[m[1]]) helpers.add(m[1]);
        for (const h of helpers) { if (UTIL.has(h) || helperRefs[h] >= 3) continue; scanBody(s, fns[h].from, fns[h].to, h); }
      }
      for (const x of (EXTRA[s.id] || [])) { if (typeof x === 'object') locate(s, x); else if (fns[x]) scanBody(s, fns[x].from, fns[x].to, x); else addConst(s, x, x); }
    }
    // a line two skills both own is a shared number: say so on both
    const owners = {}; for (const s of skills) for (const l of s.lines) (owners[l.text] = owners[l.text] || []).push(s.id);
    for (const s of skills) for (const l of s.lines) if (owners[l.text].length > 1) l.shared = owners[l.text].filter((id) => id !== s.id);
    const stats = { skills: skills.length, withLines: skills.filter((s) => s.lines.length).length, lines: skills.reduce((a, s) => a + s.lines.length, 0), bodies: Object.keys(bodies).length };
    return { skills, stats };
  }
  root.lxScanSkills = lxScanSkills;
})(typeof globalThis !== 'undefined' ? globalThis : this);
