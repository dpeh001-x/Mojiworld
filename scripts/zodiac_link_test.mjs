// THE TWELVE, ONE SONG - how the zodiac came about, and the link between all twelve.
//
// Per user: "Ensure lore consistency is good, improve the depth of the storyline especially how the zodiac comes about,
// they should all have some sort of mysterious link". Once each age this world asked for its dreaming back and the asking
// took a shape: a champion born at dawn to the same three notes. Each stopped mid-question and the sky kept it - a House.
// One page, a fresh warrior, real killMonster calls:
//   1. every sign has last words in its own voice (the question finished, the three notes remembered), each once per save,
//      on its first real defeat only - before the Amnesiac's first_zodiac_kill, which now hears the bird sing out of turn;
//   2. the twelfth plays its words, then zodiac_twelve_done with the one-song stanza, over its own film (clip_zodiac_one_song),
//      which plays WITH its soundtrack at the cinematic volume while the beat's score waits, then hands the score back;
//   3. Old Arlen notices the bird singing out of turn only once a House has gone dark;
//   4. the Codex tells the origin (epigraph, intro, House + age per card, last words once dark); arenas are Houses; the
//      entrance banner shows plain text;
//   5. the lore fixes: the Warden below the Houses, Gemini's and Virgo's fights, "Gem & Mini", the Vigil, the shard line,
//      Mira's name in the Codex and the ending.
// The build before fails 1-5.   node scripts/zodiac_link_test.mjs     MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11797), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });   // a player who just won a fight has interacted
const errs = [], J = (x) => JSON.stringify(x).slice(0, 320);
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof openNPC === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    const wc = (t) => String(t || '').replace(/<[^>]*>/g, ' ').split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length;
    const txt = (st) => (typeof st.text === 'function' ? st.text({}) : st.text) || '';
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) { applyClass('warrior'); player.level = 80; }
    player._tutorialSeen = true; player._gravitosCineSeen = true;
    const UNDER = ['first_zodiac_kill', 'zodiac_twelve_done', ...ZODIAC_SIGNS.map((z) => 'zodiac_words_' + z.id)];
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) if (!UNDER.includes(k)) player._storyBeatsSeen[k] = true;
    player._storyBeatsSeen.mira_twelve_reveal = true;   // her scene is mira_brother_test's; keep this chain to the Twelve's own
    if (!game.bestiary) game.bestiary = {}; game.bestiary.aetherion = 1;   // she has fallen: the Codex has opened its Twelve pages (the Twelve gate, per user) for (const z of ZODIAC_SIGNS) delete game.bestiary['_boss_zodiac_' + z.id];
    // ---- static: the words, the banner, the Houses, the Codex text, the quests, the beats
    out.words = ZODIAC_SIGNS.map((z) => { const b = STORY_BEATS['zodiac_words_' + z.id]; const st = b && b.stanzas && b.stanzas[0]; return { id: z.id, ok: !!st, speaker: st ? st.speaker : null, name: z.name, text: st ? txt(st) : '' }; });
    out.banner = ZODIAC_SIGNS.map((z) => (typeof _lxZodiacBanner === 'function') ? _lxZodiacBanner(z) : '');
    out.houses = ZODIAC_SIGNS.map((z) => (MAPS['zod_' + z.id] || {}).name || '');
    out.domains = Object.values(MAPS).filter((m) => m && /'s Domain$/.test(m.name || '')).length;
    out.epi = (CDX_SECTIONS.zodiac || {}).epi || '';
    out.qTwelve = (QUESTS.q_zodiac_twelve || {}).desc || ''; out.qVigil = (QUESTS.q_visit_wayfarer || {}).desc || '';
    const all = Object.entries(STORY_BEATS).flatMap(([k, b]) => (b.stanzas || []).map((st) => ({ k, t: txt(st) })));
    out.twelveDone = (STORY_BEATS.zodiac_twelve_done.stanzas || []).map(txt);
    out.shard = all.filter((x) => /same shard/.test(x.t)).map((x) => x.t.slice(0, 140));
    out.ending = (all.find((x) => /Her brother says it first/.test(x.t)) || {}).t || '';
    out.gemini = ZODIAC_SIGNS.find((z) => z.id === 'gemini').desc; out.virgo = ZODIAC_SIGNS.find((z) => z.id === 'virgo').desc;
    out.epitaph = { gemini: _bossEpitaph('zodiac_gemini', { zodiacBoss: true, zodiacSign: 'gemini', name: 'Gem & Mini the Twinstar' }), aries: _bossEpitaph('zodiac_aries', { zodiacBoss: true, zodiacSign: 'aries', name: 'Ariel the Ember Ram' }) };
    // the entrance banner a real zodiac spawn shows
    { const orig = window.spawnBossIntro; let got = null; window.spawnBossIntro = (n, sub) => { got = { n, sub }; };
      try { const m0 = spawnMonster(600, 300, 'zodiac_aries', true); const i = game.monsters.indexOf(m0); if (i >= 0) game.monsters.splice(i, 1); } catch (e) { got = { err: String(e.message).slice(0, 80) }; }
      window.spawnBossIntro = orig; out.spawnBanner = got;
      try { const bo = document.getElementById('boss-intro-overlay'); if (bo) bo.classList.remove('on'); closeAllModals(); } catch (e) {} game.paused = false; }
    // ---- the Codex, before any House is dark
    const codex = async (tab) => { openLoreMap(tab); await sleep(200); const t = (document.getElementById('lore-body') || {}).innerText || ''; try { closeLoreMap(); } catch (e) {} await sleep(100); return t; };
    out.cdxBefore = await codex('zodiac'); out.cdxWorld = await codex('world'); out.cdxFac = await codex('factions');
    // ---- Old Arlen, before
    const text = () => (document.getElementById('dialog-text') || {}).textContent || '';
    const click = async (re) => { const b = [...document.querySelectorAll('#dialog-options button')].find((x) => re.test(x.textContent || '')); if (b) { b.click(); await sleep(300); } return !!b; };
    const arlen = async () => { loadMap('town', 600); await sleep(1500); game.paused = false; try { closeAllModals(); } catch (e) {}
      const a = (game.npcs || []).find((n) => n && n.name === 'Old Arlen'); if (!a) return 'no Arlen'; openNPC(a); await sleep(300); await click(/canary on the top perch/); await sleep(200);
      { const d = document.getElementById('dialog'); for (let i = 0; i < 200 && d && d.classList.contains('typing'); i++) await sleep(50); await sleep(150); }   // the typewriter finishes first
      const t = text(); try { closeDialog(); } catch (e) {} return t; };
    out.arlenBefore = await arlen();
    // ---- the kills: the order of every scene that comes up
    const ov = () => document.getElementById('story-beat-overlay'), beatOn = () => !!(ov() && ov().classList.contains('on'));
    const spk = () => (document.getElementById('story-beat-speaker') || {}).textContent || '', btxt = () => (document.getElementById('story-beat-text') || {}).textContent || '';
    const film = {};   // hold: the page to stop on until the scene's film decodes (then it is read into film.clip)
    const watch = async (ms, hold) => { const seq = []; const t0 = Date.now(); let quiet = 0, held = false;
      while (Date.now() - t0 < ms) { if (beatOn()) { const s = spk() + ' | ' + btxt().slice(0, 60); if (s !== seq[seq.length - 1]) seq.push(s);
          if (hold && !held && hold.test(btxt())) { held = true; for (let i = 0; i < 150; i++) { const v = document.getElementById('story-beat-clip'); if (v && v.readyState >= 2) break; await sleep(100); }
            const v = document.getElementById('story-beat-clip'); film.clip = v ? { src: (v.currentSrc || v.src || '').split('/').pop(), ready: v.readyState, w: v.videoWidth, dur: Math.round(v.duration || 0) } : null;
            if (v) { await sleep(1500);   // its soundtrack: playing, audible, the score silent under it; then the score's hand-back
              film.clip.sound = { muted: v.muted, vol: +v.volume.toFixed(2), bytes: v.webkitAudioDecodedByteCount || 0, scoreSilent: _cineBgm.paused || _cineBgm.volume < 0.02, cine: +_cineVol().toFixed(2) };
              v.dispatchEvent(new Event('ended')); await sleep(3500);   // its end (serve.js has no Range support, so a seek cannot reach it here; in play it runs to the end)
              film.clip.rise = { vol: +_cineBgm.volume.toFixed(2), playing: !_cineBgm.paused }; } }
          ov().click(); quiet = 0; } else if (seq.length && ++quiet > 20) break; await sleep(150); }
      try { closeAllModals(); } catch (e) {} game.paused = false; return seq; };
    const kill = (id, tags) => { const m = { type: 'zodiac_' + id, name: 'Z', isZodiac: true, zodiacSign: id, x: player.x + 60, y: player.y, w: 60, h: 60, level: 85, exp: 0, mojicoins: 0,
      currentHp: 0, maxHp: 1, hp: 0, atk: 1, def: 1, vx: 0, vy: 0, dead: false, zodiacBoss: true, isBoss: true, ...(tags || {}) };
      game.monsters.push(m); let err = null; try { killMonster(m); } catch (e) { err = String(e.message).slice(0, 90); } const i = game.monsters.indexOf(m); if (i >= 0) game.monsters.splice(i, 1); return err; };
    out.k1err = kill('aries'); out.seq1 = await watch(9000);
    out.k1again = kill('aries'); out.seqAgain = await watch(3500);
    out.kEcho = kill('taurus', { _echoBoss: true }); out.seqEcho = await watch(3500);
    out.arlenAfter = await arlen();
    for (const z of ZODIAC_SIGNS) if (z.id !== 'pisces') game.bestiary['_boss_zodiac_' + z.id] = 1;
    out.k12err = kill('pisces'); out.seq12 = await watch(30000, /The twelfth sign exhales/); out.film = film.clip || null;
    { const s0 = _lxGetSettings(); try { _lxSaveSettings({ ...s0, mute: true }); _sbAttachClip('zodiac_twelve_done'); const v = document.getElementById('story-beat-clip'); out.muteCase = v ? { muted: v.muted } : null; }
      catch (e) { out.muteCase = { err: String(e.message).slice(0, 60) }; } try { _sbDetachClip(); _lxSaveSettings(s0); } catch (e) {} }
    out.cdxAfter = await codex('zodiac');
    out.seen = UNDER.filter((k) => player._storyBeatsSeen[k]).sort();
    out.wcArlen = wc(out.arlenAfter);
    return out;
  });
  const signs = R.words.map((w) => w.id), wcN = (t) => String(t || '').split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length;
  ok('1. all twelve signs have last words, spoken by the sign', R.words.length === 12 && R.words.every((w) => w.ok && w.speaker === w.name), J(R.words.filter((w) => !w.ok || w.speaker !== w.name).map((w) => w.id)));
  ok('1. each finishes the question and remembers the three notes', R.words.every((w) => /give them back their dreams/.test(w.text) && /three notes/i.test(w.text)), J(R.words.filter((w) => !/give them back their dreams/.test(w.text) || !/three notes/i.test(w.text)).map((w) => w.id)));
  ok('1. the first-born is first, the last-born asks who is counting', /^I was the first\./.test(R.words[0].text) && /^I was the last of us\./.test(R.words[11].text) && /Who is counting us\?$/.test(R.words[11].text), J([R.words[0].text.slice(0, 30), R.words[11].text.slice(-40)]));
  ok('1. twelve different voices, each within 60 words, none naming the bird or saying sent/stolen', new Set(R.words.map((w) => w.text)).size === 12 && R.words.every((w) => wcN(w.text) <= 60 && !/guguma|canary|stolen|\bsent\b/i.test(w.text)), J(R.words.map((w) => wcN(w.text))));
  ok('1. the first real defeat: its words, then the Amnesiac hears the bird sing out of turn', !R.k1err && /^Ariel the Ember Ram \| I was the first/.test(R.seq1[0] || '') && R.seq1.some((s) => /^The Amnesiac \| he looks up sharply/.test(s)) && R.seq1.some((s) => /^The Amnesiac \| Here in the plaza, the bird on the top perch just sang/.test(s)), J(R.seq1));
  ok('1. once per save: a second kill and an echo shade play nothing', !R.k1again && R.seqAgain.length === 0 && !R.kEcho && R.seqEcho.length === 0, J({ again: R.seqAgain, echo: R.seqEcho }));
  ok('2. the twelfth: its words, then zodiac_twelve_done with the one-song stanza', !R.k12err && /^Pisces the Twin Current \| I was the last of us/.test(R.seq12[0] || '') && R.seq12.some((s) => /^ \| Twelve ages\. Twelve champions\. One song\./.test(s)) && R.twelveDone.some((t) => /born at dawn to the same three notes/.test(t)) && R.twelveDone.some((t) => /the bird sings them one more time/.test(t) && /it waits\.$/.test(t)), J(R.seq12));
  ok('2. the reveal plays over its own film: clip_zodiac_one_song, 1280 wide, the 31 s trailer, decoding', !!R.film && R.film.src === 'clip_zodiac_one_song.mp4' && R.film.ready >= 2 && R.film.w === 1280 && R.film.dur >= 30, J(R.film));
  ok('2. the trailer plays WITH its soundtrack: unmuted at the cinematic volume, audio decoding, the score silent under it', !!R.film && !!R.film.sound && R.film.sound.muted === false && R.film.sound.bytes > 0 && Math.abs(R.film.sound.vol - Math.min(1, R.film.sound.cine / 0.62)) < 0.02 && R.film.sound.scoreSilent, J(R.film && R.film.sound));
  ok('2. when the trailer ends the score rises; with the game muted the trailer is silent', !!R.film && !!R.film.rise && R.film.rise.playing && R.film.rise.vol > 0.1 && !!R.muteCase && R.muteCase.muted === true, J({ rise: R.film && R.film.rise, mute: R.muteCase }));
  ok('3. Old Arlen: the bird sings out of turn only once a House is dark, within 60 words', /not one early, not one late/.test(R.arlenBefore) && !/out of turn/.test(R.arlenBefore) && /Lately it sings out of turn, whenever one of those Houses goes dark/.test(R.arlenAfter) && R.wcArlen <= 60, J({ before: R.arlenBefore.slice(-80), after: R.arlenAfter.slice(-120), words: R.wcArlen }));
  ok('4. the Codex tells the origin: epigraph, intro, a House and an age on every card', R.epi === 'Twelve ages. Twelve champions. One song.' && /first asking became Gravitos/.test(R.cdxBefore) && /born at dawn to the same three notes/.test(R.cdxBefore) && /ring of Houses/.test(R.cdxBefore) && /House of the Ram · the first age/.test(R.cdxBefore) && /House of the Fishes · the twelfth age/.test(R.cdxBefore), J({ epi: R.epi, cdx: R.cdxBefore.slice(0, 200) }));
  ok('4. a card keeps its last words only once its House is dark', !/I was the first\./.test(R.cdxBefore) && /I was the first\./.test(R.cdxAfter) && /Who is counting us\?/.test(R.cdxAfter), J({ before: /I was the first/.test(R.cdxBefore), after: /I was the first/.test(R.cdxAfter) }));
  ok('4. the arenas are Houses, and the banner is plain text naming its House', R.houses[0] === 'House of the Ram' && R.houses[11] === 'House of the Fishes' && R.domains === 0 && R.banner[0] === 'The First House · Burned too hot, too fast.' && R.banner.every((b) => /^The \w+ House · /.test(b) && !/</.test(b)) && R.spawnBanner && R.spawnBanner.sub === R.banner[0], J({ houses: R.houses, banner: R.banner.slice(0, 3), spawn: R.spawnBanner }));
  ok('4. the Twelve\'s quest says it too', /an age apart, to the same three notes/.test(R.qTwelve) && wcN(R.qTwelve) <= 120, wcN(R.qTwelve));
  ok('5. the Warden stands below the Houses; one champion each age; Mira named in the Codex', /one each age/.test(R.cdxWorld) && /Below their Houses stands Aetherion/.test(R.cdxWorld) && !/Above their Houses/.test(R.cdxWorld) && /Their oldest, the silver-haired Sage Mira, who kept her name/.test(R.cdxFac) && !/silver-haired \?\?\?/.test(R.cdxFac), J({ world: /Below their Houses/.test(R.cdxWorld), fac: R.cdxFac.slice(0, 80) }));
  ok('5. Gemini and Virgo are described by their real fights; the epitaph says Gem & Mini', /splits when wounded/.test(R.gemini) && /heals herself, banishes your shots/.test(R.virgo) && /^Gem & Mini exhale\./.test(R.epitaph.gemini) && /^Ariel exhales\./.test(R.epitaph.aries), J({ g: R.epitaph.gemini.slice(0, 30), a: R.epitaph.aries.slice(0, 20) }));
  ok('5. the Vigil quest, the shard line and the ending read true', !/Confused Vigil/.test(R.qVigil) && /so the Vigil burns clean/.test(R.qVigil) && R.shard.length === 1 && /same hand above the sky/.test(R.shard[0]) && !/Shardfather scattered/.test(R.shard[0]) && /hears her name said aloud/.test(R.ending), J({ shard: R.shard, ending: R.ending.slice(-120) }));
  ok('the scenes shown were marked seen, and only those', J(R.seen) === J(['first_zodiac_kill', 'zodiac_twelve_done', 'zodiac_words_aries', 'zodiac_words_pisces']), J(R.seen));
  await ctx.close();
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
