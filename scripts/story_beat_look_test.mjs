#!/usr/bin/env node
// Per user, on the two Gravitos dialogue cards: "make improve on the font and
// impactfulness, there should be some hints on the 3rd form that guguma is part
// of all this, make this look grander and not so basic".
//
// Everything here is read back from the LIVE overlay after playing a real beat
// through _showStoryBeat, because the defect this replaces was invisible in the
// source and obvious on screen: the stanza scripts have always wrapped stage
// directions in *asterisks*, the renderer has always used .textContent, and so
// every cinematic in the game printed its literal asterisks. Asserting on the
// stanza STRINGS would have happily passed the whole time.
//
//   node scripts/story_beat_look_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'mojiworld_game.html';
const URL = 'file:///' + path.join(ROOT, FILE).split(path.sep).join('/');

const browser = await chromium.launch({ channel: 'msedge', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof _playStoryBeat === 'function', { timeout: 90000 });

const out = await page.evaluate(async () => {
  window._lxBootGateDone = true;
  try { const bo = document.getElementById('loading-overlay'); if (bo) bo.remove(); } catch (e) {}
  const res = [];
  const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 150) });
  const show = _playStoryBeat;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // Replay a beat even if this save has already seen it.
  try { if (player && player._storyBeatsSeen) player._storyBeatsSeen = {}; } catch (e) {}
  const opened = show('gravitos_ascendant');
  await wait(260);
  const ov = document.getElementById('story-beat-overlay');
  const txt = document.getElementById('story-beat-text');
  const spk = document.getElementById('story-beat-speaker');
  ok('the ascendant beat opens', !!opened && ov && ov.classList.contains('on'));
  if (!txt) { ok('overlay text element exists', false); return res; }

  const cs = (el) => getComputedStyle(el);
  // NB: /serif/ also matches "sans-serif" — the first version of this file used
  // it, and the speaker check PASSED against the unfixed build Segoe UI stack.
  const _isSerif = (f) => /Iowan|Palatino|Book Antiqua|Georgia/i.test(f)
    || (/serif/i.test(f) && !/sans-serif/i.test(f));

  // ---- the asterisk defect -----------------------------------------------
  const shown = txt.textContent || '';
  ok('NO literal asterisks are printed on screen', shown.indexOf('*') === -1,
     shown.slice(0, 70).replace(/\n/g, ' | '));
  const dirs = txt.querySelectorAll('.sb-dir');
  ok('the stage direction is its own element', dirs.length >= 1, `${dirs.length} found`);
  if (dirs.length) {
    ok('...and it kept its words', /unclenches/.test(dirs[0].textContent || ''), (dirs[0].textContent || '').slice(0, 56));
    ok('...and it is set apart from the speech (italic)', cs(dirs[0]).fontStyle === 'italic', cs(dirs[0]).fontStyle);
    ok('...and lighter than the speech',
       parseInt(cs(dirs[0]).fontWeight, 10) < parseInt(cs(txt).fontWeight, 10),
       `direction ${cs(dirs[0]).fontWeight} vs speech ${cs(txt).fontWeight}`);
    ok('...and smaller than the speech',
       parseFloat(cs(dirs[0]).fontSize) < parseFloat(cs(txt).fontSize),
       `${cs(dirs[0]).fontSize} vs ${cs(txt).fontSize}`);
  }

  // ---- typography ---------------------------------------------------------
  const fam = cs(txt).fontFamily || '';
  ok('the body is set in a SERIF, not the UI sans', _isSerif(fam), fam.slice(0, 66));
  ok('...and it resolved to a real installed face, not a fallback',
     !/Times New Roman/i.test(fam.split(',')[0]), fam.split(',')[0]);
  ok('the body got bigger', parseFloat(cs(txt).fontSize) >= 23, cs(txt).fontSize);
  ok('the speaker is set in the same serif', _isSerif(cs(spk).fontFamily || ''), (cs(spk).fontFamily || '').slice(0, 50));
  ok('the speaker has real letter-spacing', parseFloat(cs(spk).letterSpacing) >= 6, cs(spk).letterSpacing);
  const stage = document.getElementById('story-beat-stage');
  ok('the stage is wider for the larger type', parseFloat(cs(stage).maxWidth) >= 860, cs(stage).maxWidth);

  // Nothing may overflow the card — the serif is bigger, so this is the check
  // that the width bump actually paid for it.
  ok('the text does not overflow its stage', txt.scrollWidth <= txt.clientWidth + 2,
     `scroll ${txt.scrollWidth} vs client ${txt.clientWidth}`);
  ok('the card fits the viewport vertically', stage.getBoundingClientRect().height <= 800,
     `card ${Math.round(stage.getBoundingClientRect().height)}px`);

  // ---- Guguma -------------------------------------------------------------
  // Walk the whole beat, collecting every stanza as the player would read it.
  const seen = [shown];
  for (let i = 0; i < 6; i++) {
    ov.click();
    await wait(120);
    if (!ov.classList.contains('on')) break;
    seen.push(txt.textContent || '');
  }
  const all = seen.join('\n');
  ok('form 3 now runs more stanzas than the original two', seen.length >= 4, `${seen.length} stanzas`);
  ok('GUGUMA: the three notes are referenced', /three notes/i.test(all));
  ok('GUGUMA: the anomaly is stated (it never missed a morning)', /did not miss a morning/i.test(all));
  ok('GUGUMA: it is tied to the seam Outsiders fall through', /seam above opens once/i.test(all));
  ok('GUGUMA: it stays a HINT — he admits he does not know', /do not know what it is counting/i.test(all));
  ok('GUGUMA: the bird is never actually named (no reveal)', !/guguma/i.test(all), 'name must not appear');
  ok('the original ascendant beats both survive',
     /take my hand instead of my life/i.test(all) && /THE WEIGHT DECIDES/.test(all));

  // The parser must not corrupt a beat that has no directions at all.
  try { if (player && player._storyBeatsSeen) player._storyBeatsSeen = {}; } catch (e) {}
  show('gravitos_gate');
  await wait(200);
  ok('a beat still renders correctly after the parser change',
     (txt.textContent || '').indexOf('*') === -1 && /Singularity does not echo/i.test(txt.textContent || ''),
     (txt.textContent || '').slice(0, 60).replace(/\n/g, ' | '));

  return res;
});
await browser.close();

const pad = Math.max(...out.map((r) => r.n.length));
console.log('\n  ' + FILE + '\n');
for (const r of out) console.log((r.pass ? '  PASS  ' : '  FAIL  ') + r.n.padEnd(pad) + (r.extra ? '   [' + r.extra + ']' : ''));
const bad = out.filter((r) => !r.pass).length;
console.log('\n' + (bad ? ('  ' + bad + '/' + out.length + ' FAILED') : ('  all ' + out.length + ' passed')));
process.exit(bad ? 1 : 0);
