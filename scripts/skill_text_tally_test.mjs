#!/usr/bin/env node
// v0.30.1519 - THE SKILL TEXTS TALLY WITH THE CODE (per user: "make sure it all tallies accurately"). Static: each claim the text audit
// added is read against the number or the rule it describes in the same file, so a later balance edit that moves the number
// without the text fails here.
//   CAP     - War Cry / Bloodlust / Rampage name the +80% self-buff ATK cap getAtk() really applies
//   BURN    - DOT texts say "per second" and quote the per-tick cap and the boss cap the burn tick really uses
//   CLASS   - each class bonus text names exactly the skills whose hits carry the cast's own id (where the bonus lands)
//   JOBS    - each job label names the four base skills its JOB_ENHANCE really scales, with its own basicDmg
//   [MOJI_GAME_FILE=x.html] node scripts/skill_text_tally_test.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(process.env.MOJI_GAME_FILE ? path.resolve(process.env.MOJI_GAME_FILE) : path.join(ROOT, 'mojiworld_game.html'), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + x + ']' : '')); };
const desc = (id) => { const m = src.match(new RegExp('^ {2}' + id + ":\\s*\\{ name:'(?:[^'\\\\]|\\\\.)*',[^\\n]*?desc:'((?:[^'\\\\]|\\\\.)*)'", 'm')); return m ? m[1] : ''; };
// CAP
const cap = (src.match(/pct \+= Math\.min\(([\d.]+), _selfBuff\)/) || [])[1];
const capPct = Math.round(+cap * 100) + '%';
ok('CAP: getAtk caps the self-buff pool, and War Cry, Bloodlust and Rampage quote that cap', !!cap && ['warCry', 'bloodlust', 'rampage'].every((id) => desc(id).includes('+' + capPct + ' ATK cap')), capPct);
// BURN
const tick = +(src.match(/const LX_BURN_TICK_MS = (\d+);/) || [])[1], pct = +(src.match(/const LX_BURN_TICK_MAXHP_PCT = ([\d.]+);/) || [])[1];
const bossPct = +(src.match(/const LX_BURN_TICK_MAXHP_PCT_BOSS = ([\d.]+);/) || [])[1];
const burnTxt = `each ${tick / 1000}s tick is capped at ${+(pct * 100).toFixed(2)}% of the foe max HP, ${+(bossPct * 100).toFixed(2)}% on bosses`;
for (const id of ['elemental', 'hexmaster_grandhex', 'hexmaster_ult'])
  ok(`BURN: ${id} gives its DOT per second, with the real tick cap`, desc(id).includes('per second') && desc(id).includes(burnTxt) && !/ATK\/tick/.test(desc(id)), burnTxt);
// CLASS - the hit tags. A skill gets the class bonus when its hits are tagged with its own id (hitMonster: skill === _classSkillMulSkillId)
const own = (id) => new RegExp("(?:_ag\\d+\\.hit|hitMonster)\\([^;\\n]*'" + id + "'\\)").test(src) || new RegExp("skill: '" + id + "'").test(src);
const cls = (name) => (src.match(new RegExp("identity: \\{ name:'" + name + "', desc:'([^']*)'")) || [])[1] || '';
ok('CLASS: Charge & Release names Rush and Holy Shield, whose hits carry their own id', own('rush') && own('holyShield') && /Rush \(its dash\) or Holy Shield \(its waves\)/.test(cls('Charge & Release')), cls('Charge & Release').slice(0, 90));
ok('CLASS: Chain Cast names Blink, Meteor, Holy Light and the Holy Grail, whose hits carry their own id', ['blink', 'meteor', 'holyLight', 'archbishop_grail'].every(own) && /Blink, Meteor, Holy Light or Judgment of the Holy Grail/.test(cls('Chain Cast')));
ok('CLASS: Hold to Draw names Deadeye Protocol, whose rounds carry its own id', own('marksman_ult') && /\+50 % damage to Deadeye Protocol rounds/.test(cls('Hold to Draw')));
// JOBS
const enh = (job) => { const m = src.match(new RegExp('^ {2}' + job + ":\\s*\\{ basicDmg: ([\\d.]+)[^\\n]*?label: '([^']*)'", 'm')); return m ? { mul: +m[1], label: m[2] } : null; };
const JOBS = { berserker: 'Slash, Somersault Smash (its smash) and Ground Slam', knight: 'Slash, Somersault Smash (its smash) and Ground Slam', ninja: 'Stab and Shuriken', assassin: 'Stab and Shuriken',
  archmage: 'Magic Bolt, Fireball, Ice Spike and Arcane Burst', warlock: 'Magic Bolt, Fireball, Ice Spike and Arcane Burst', priest: 'Magic Bolt, Fireball, Ice Spike and Arcane Burst',
  sniper: 'Arrow Shot, Multi Shot, Charged Shot and Evade Burst', ranger: 'Arrow Shot, Multi Shot, Charged Shot and Evade Burst' };
for (const [job, list] of Object.entries(JOBS)) { const e = enh(job);
  ok(`JOBS: the ${job} label names its skills and its own +${e ? Math.round((e.mul - 1) * 100) : '?'}%`, !!e && e.label.includes(list) && e.label.includes('+' + Math.round((e.mul - 1) * 100) + '% harder') && !/basic/i.test(e.label), e && e.label.slice(0, 80)); }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
