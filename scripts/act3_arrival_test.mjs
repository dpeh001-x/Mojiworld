// Live test: the ACT III arrival card fires at the bone graveyards and nowhere else.
//
// Per user: "ACT III arrival card should only play at bone graveyards." A tester
// met it walking into Lava Cavern, where a graveyard elegy over a volcanic cave
// reads as the wrong cutscene.
//
// Checked two ways: the pure lookup (_sbBeatForMap, which mirrors loadMap's
// precedence) across every map in the game, and the REAL loadMap path with
// _playStoryBeat spied on — a table can be right while the call site is not.
//   node scripts/act3_arrival_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof MAPS !== 'undefined' && typeof _sbBeatForMap === 'function'
  && typeof loadMap === 'function', null, { timeout: 120000 });
await page.waitForTimeout(1500);

const r = await page.evaluate(async () => {
  const out = {};
  // ---- 1) the pure lookup, over EVERY map in the game ----
  const byBeat = {};
  for (const id of Object.keys(MAPS)) {
    const beat = _sbBeatForMap(id);
    if (beat) (byBeat[beat] || (byBeat[beat] = [])).push(id);
  }
  out.act3Maps = (byBeat.arrival_broken_sky || []).sort();
  out.otherActs = {
    frontier: (byBeat.arrival_frontier || []).sort(),
    sundered: (byBeat.arrival_sundered_deep || []).sort(),
    chains: (byBeat.arrival_chains_end || []).sort(),
    sky: (byBeat.arrival_sky_beyond || []).sort(),
  };
  out.mapBeats = { forest: _sbBeatForMap('forest'), gate: _sbBeatForMap('wayfarersLantern2'),
                   forge: _sbBeatForMap('sundered_forge') };
  // the ten that were dropped must now resolve to NO beat at all
  out.dropped = {};
  for (const id of ['stardustAtrium', 'stormCrest', 'lavaCavern', 'coralReef', 'sauroSlope',
                    'kelpForest', 'bubbleGrotto', 'distortedThreshold', 'fracturedReflection', 'abyssalTrench'])
    out.dropped[id] = _sbBeatForMap(id);
  // the clip the card carries, so a future re-map cannot silently change it
  out.clip = (STORY_BEAT_CLIPS.arrival_broken_sky || '').split('/').pop();

  // ---- 2) the REAL loadMap path, with the beat player spied on ----
  const realPlay = window._playStoryBeat;
  const fired = [];
  window._playStoryBeat = function (id) { fired.push(id); return false; };   // record, never show
  const walk = (id) => { fired.length = 0;
    try { player._storyBeatsSeen = {}; loadMap(id); } catch (e) { out.loadThrew = String(e).slice(0, 120); }
    return fired.slice(); };
  out.walkLava = walk('lavaCavern');
  out.walkGrave = walk('boneGraveyard');
  out.walkGrave2 = walk('boneGraveyard2');
  out.walkReef = walk('coralReef');
  window._playStoryBeat = realPlay;
  return out;
});

const GRAVES = ['boneGraveyard', 'boneGraveyard2'];
ok('the Act III card is mapped to the two bone graveyards and nothing else',
  JSON.stringify(r.act3Maps) === JSON.stringify(GRAVES), { mapped: r.act3Maps });
ok('Lava Cavern no longer resolves to any arrival at all',
  r.dropped.lavaCavern === null, { lavaCavern: r.dropped.lavaCavern });
ok('...nor do the other nine that were dropped',
  Object.entries(r.dropped).every(([, v]) => v === null),
  { stillFiring: Object.entries(r.dropped).filter(([, v]) => v).map(([k, v]) => `${k}:${v}`) });
ok('walking into Lava Cavern through the real loadMap fires no beat',
  r.walkLava.length === 0, { fired: r.walkLava, threw: r.loadThrew });
ok('walking into either bone graveyard DOES fire it',
  r.walkGrave.includes('arrival_broken_sky') && r.walkGrave2.includes('arrival_broken_sky'),
  { boneGraveyard: r.walkGrave, boneGraveyard2: r.walkGrave2 });
ok('...and Coral Reef, also dropped, stays silent', r.walkReef.length === 0, { fired: r.walkReef });
ok('the card still carries its own clip', r.clip === 'clip_095142.mp4', { clip: r.clip });
// Act VI lists TWO maps but resolves to one: wayfarersLantern2 carries the
// dedicated first_gate_visit beat, and map beats outrank act beats — so the Gate
// never reports arrival_sky_beyond. Asserting 2 here was this test being wrong
// about the game, and the code says so ("in practice arrival_sky_beyond fires at
// the Zodiac Sanctum"). Pinned at 1, which is the behaviour.
ok('no other act was touched',
  r.otherActs.frontier.length === 3 && r.otherActs.sundered.length >= 8
  && r.otherActs.chains.length === 1
  && JSON.stringify(r.otherActs.sky) === JSON.stringify(['zodiacHall']), r.otherActs);
ok('the three map-specific beats still take precedence',
  r.mapBeats.forest === 'memory_echo' && r.mapBeats.gate === 'first_gate_visit'
  && r.mapBeats.forge === 'forge_first_visit', r.mapBeats);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
