// Party support certification (v0.29.308). Proves the co-op heal/buff sharing
// added in v0.29.299-.302 works END TO END for players on the same map:
//   SEND    — casting each shared skill actually emits the right frame
//   RECEIVE — the frame is applied, with the whitelist/scope/clamp guards
//   EFFECT  — the applied buff drives a REAL stat change on the receiver
// The third layer is the one that matters: a buff timer that no stat function
// reads would be a HUD pill with no mechanic behind it.
//
//   node scripts/coop_party_support_test.mjs
// Env: PW_EXE (browser path) or PW_CHANNEL (default msedge), PORT (default 8843)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 8843;
const results = [];
const ok = (n, c, extra) => { results.push({ n, pass: !!c, extra }); };

const server = spawn(process.execPath, [join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1400));
const launch = process.env.PW_EXE
  ? { executablePath: process.env.PW_EXE, headless: true }
  : { channel: process.env.PW_CHANNEL || 'msedge', headless: true };
const browser = await chromium.launch(launch);
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const pageErrs = [];
page.on('pageerror', e => pageErrs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(7000);

const r = await page.evaluate(() => {
  const o = { recv: {}, effect: {}, send: {} };
  const MAP = game.currentMap;
  player.cls = player.cls || 'warrior';
  player.hp = Math.max(player.hp, 1);
  const clear = () => { for (const k in player.buffs) player.buffs[k] = 0; };

  // ---- RECEIVE: guards -----------------------------------------------------
  clear(); _coopApplyPartyBuff({ hm: MAP, bl: [['warCry', 7000]] });
  o.recv.applies = player.buffs.warCry === 7000;
  clear(); _coopApplyPartyBuff({ hm: MAP, bl: [['smokeBomb', 9000]] });
  o.recv.rejectsUnshared = player.buffs.smokeBomb === 0;
  clear(); _coopApplyPartyBuff({ hm: MAP, bl: [['__proto__', 9000], ['evilKey', 9000]] });
  o.recv.noNewSlots = !('evilKey' in player.buffs);
  clear(); _coopApplyPartyBuff({ hm: '__nope__', bl: [['guardian', 6000]] });
  o.recv.mapScoped = player.buffs.guardian === 0;
  clear(); player.buffs.holyShield = 9000;
  _coopApplyPartyBuff({ hm: MAP, bl: [['holyShield', 2000]] });
  o.recv.neverShortens = player.buffs.holyShield === 9000;
  clear(); _coopApplyPartyBuff({ hm: MAP, bl: [['guardian', 999999999]] });
  o.recv.clamped = player.buffs.guardian === 120000;
  clear(); _coopApplyPartyBuff({ hm: MAP, bl: [['warCry', 12000], ['bloodlust', 12000]] });
  o.recv.multiInOneFrame = player.buffs.warCry === 12000 && player.buffs.bloodlust === 12000;
  clear(); _coopApplyPartyBuff({ hm: MAP, bk: 'warCry', bms: 7000 });   // legacy single form
  o.recv.legacyForm = player.buffs.warCry === 7000;
  o.recv.allMetaDeclared = BUFF_META.every(b => b.key in player.buffs);

  // ---- EFFECT: buffs delivered over the wire must move real stats ----------
  const snap = () => ({ atk: getAtk(), def: getDef(), crit: getCrit(), spd: +getSpeed().toFixed(3) });
  const viaWire = (k, ms) => { clear(); _coopApplyPartyBuff({ hm: MAP, bl: [[k, ms]] }); return snap(); };
  clear(); const base = snap();
  const wc = viaWire('warCry', 12000);
  o.effect.warCry = wc.atk > base.atk && wc.def > base.def;
  o.effect.warCryDetail = `atk ${base.atk}->${wc.atk}, def ${base.def}->${wc.def}`;
  const gd = viaWire('guardian', 6000);
  o.effect.guardian = gd.def > base.def;
  o.effect.guardianDetail = `def ${base.def}->${gd.def}`;
  const hs = viaWire('holyShield', 5000);
  o.effect.holyShield = hs.def >= base.def + 9000;   // the 2.5s invuln window (DEF+9999)
  o.effect.holyShieldDetail = `def ${base.def}->${hs.def}`;
  o.effect.holyShieldWindowEnds = viaWire('holyShield', 2000).def < base.def + 9000;
  const bl = viaWire('bloodlust', 20000);
  o.effect.bloodlust = bl.atk > base.atk && bl.spd > base.spd;
  o.effect.bloodlustDetail = `atk ${base.atk}->${bl.atk}, spd ${base.spd}->${bl.spd}`;
  player.cls = 'archer'; clear(); const baseA = snap();
  const ee = viaWire('eagleEye', 30000);
  o.effect.eagleEye = ee.crit > baseA.crit;
  o.effect.eagleEyeDetail = `crit ${baseA.crit}->${ee.crit}`;
  player.cls = 'warrior';
  const rj = viaWire('rampage', 3500);
  o.effect.rejectedIsInert = rj.atk === base.atk && rj.def === base.def;

  // ---- SEND: each skill emits the frame it promises ------------------------
  const sent = [];
  window._coopActive = () => true;
  net.connected = true; net.myId = 1; net.roomId = 'test';
  net.ws = { readyState: 1, send: (s) => { try { sent.push(JSON.parse(s)); } catch (e) {} } };
  const CASES = [
    ['warCry', 'warrior', null, null, ['warCry'], false],
    ['guardian', 'warrior', 'knight', null, ['guardian'], false],
    ['holyShield', 'warrior', 'knight', null, ['holyShield'], false],
    ['bloodlust', 'warrior', 'berserker', null, ['bloodlust'], true],
    ['eagleEye', 'archer', null, null, ['eagleEye'], false],
    ['warlord_warcry', 'warrior', 'berserker', 'warlord', ['warCry', 'bloodlust'], true],
    ['warlord_ult', 'warrior', 'berserker', 'warlord', ['bloodlust'], true],
    ['beastmaster_ult', 'archer', 'ranger', 'beastmaster', ['bloodlust'], true],
    ['crusader_aegis', 'warrior', 'knight', 'crusader', [], true],
    ['crusader_ult', 'warrior', 'knight', 'crusader', [], true],
    ['holyLight', 'mage', 'priest', null, [], true],
    ['archbishop_ult', 'mage', 'priest', 'archbishop', [], true],
  ];
  for (const [id, cls, job, master, wantBuffs, wantHeal] of CASES) {
    sent.length = 0;
    net._lastPbufAt = 0; net._lastPhealAt = 0;
    player.cls = cls; player.job = job; player.master = master;
    player.hp = Math.max(1, Math.floor(getMaxHp() * 0.3));
    player.mp = getMaxMp();
    player.skillCooldowns = player.skillCooldowns || {};
    player._warlordEnrageUntil = 0;
    const fn = SKILL_FNS[id];
    if (typeof fn !== 'function') { o.send[id] = 'NO HANDLER'; continue; }
    try { fn(); } catch (e) { o.send[id] = 'THREW ' + String(e && e.message || e).slice(0, 60); continue; }
    const buffs = sent.filter(m => m && m.pbf).flatMap(m => (m.bl || []).map(p => p[0]));
    const heals = sent.filter(m => m && m.phl);
    const buffsOk = wantBuffs.every(b => buffs.includes(b)) && buffs.length === wantBuffs.length;
    const healOk = wantHeal ? heals.length > 0 : true;
    const scoped = sent.every(m => m.hm === game.currentMap);
    o.send[id] = { pass: buffsOk && healOk && scoped, buffs, heals: heals.length, scoped };
  }
  clear();
  return o;
});

for (const [k, v] of Object.entries(r.recv)) ok('recv: ' + k, v === true, v === true ? '' : v);
for (const [k, v] of Object.entries(r.effect)) {
  if (k.endsWith('Detail')) continue;
  ok('effect: ' + k, v === true, r.effect[k + 'Detail'] || '');
}
for (const [k, v] of Object.entries(r.send)) {
  ok('send: ' + k, v && v.pass === true, typeof v === 'string' ? v : `buffs=${JSON.stringify(v.buffs)} heals=${v.heals}`);
}
ok('no page errors', pageErrs.length === 0, pageErrs.slice(0, 2).join(' | '));

const failed = results.filter(x => !x.pass);
for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.n}${x.extra ? '   (' + x.extra + ')' : ''}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await browser.close();
server.kill();
process.exit(failed.length ? 1 : 0);
