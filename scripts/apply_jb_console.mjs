// DJ Vinyl's jukebox becomes a DJ console: one backlit pad per track, each with its own icon.
// ============================================================================
// Per user: "make the jukebox design WAY More hip popular and stylish with drift phonk vibes, make sure that each BGM
// also has a unique icon, make it like DJ console concept where each button on the DJ console plays a specific music";
// then, on a photo of a pad controller (two jog wheels with rainbow LED rings, a rainbow fan meter, colour-zoned
// backlit pads): "Sort of this kind of interface: make it simple and cute, well mapped and organised".
//
// The window is rebuilt as that controller:
//   - top: a drift-car badge, the name plate, a katakana sticker (ドリフト・フォンク), a found counter, close;
//   - deck: the left jog wheel is the record - it spins while a track plays, the track's icon on its label; the
//     middle is a rainbow fan meter that dances while music plays, a screen with the track and its running time, and
//     STOP / SHUFFLE; the right jog wheel is the music volume (the Settings music slider, turned by hand);
//   - pads: one per track, 46, in four colour zones like the photo - A towns (cyan), B wilds (green), C sacred &
//     cosmic (violet), D bosses (pink) - numbered A1..D5, each with the track's own icon (Sprites/ui/jukebox/<id>.webp,
//     scripts/gen_jukebox_icons.mjs). The playing pad lights up in its zone colour; an undiscovered one keeps its slot
//     and number with a padlock.
// Discovery, the catalogue, what a pad plays and how Stop hands the map's music back are exactly as before; the pads
// keep the .jb-track / data-track-id / .locked contract. The Persona plate this window wore is replaced by the console
// (its test is updated by apply_jb_console_tests.mjs).
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) jb-console/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const count = (a) => s.split(a).length - 1;
const part = (f) => readFileSync(path.join(HERE, f), 'utf8').replace(/\r\n/g, '\n').replace(/\s+$/, '').split('\n').join(EOL);
// replace [start, end) where both anchors are unique and end follows start within `max` chars
const between = (label, startA, endA, text, max) => {
  if (count(startA) !== 1) die(label + ' start matched ' + count(startA));
  if (count(endA) !== 1) die(label + ' end matched ' + count(endA));
  const i0 = s.indexOf(startA), i1 = s.indexOf(endA);
  if (!(i1 > i0 && i1 - i0 < max)) die(label + ' bounds ' + i0 + '..' + i1);
  s = s.slice(0, i0) + text + s.slice(i1);
};

// 1. the stylesheet: everything inside the jukebox <style>
between('css', '  /* ===== Disco backdrop ===== */', '</style>' + EOL + '<div id="jukebox-modal-bg"',
  part('_jb_console.css.txt') + EOL + part('_jb_console2.css.txt') + EOL + part('_jb_console3.css.txt') + EOL, 12000);

// 2. the markup
const fan = [];
for (let k = 0; k < 17; k++) {
  const t = k / 16, ang = (-78 + 156 * t).toFixed(1), hue = Math.round(((280 - 300 * t) % 360 + 360) % 360);
  fan.push(`<i style="--c:hsl(${hue},100%,62%);--d:${(((k * 7) % 11) * 0.07).toFixed(2)}s;transform:rotate(${ang}deg)"></i>`);
}
const MARKUP = [
  '<div id="jukebox-modal-bg" onclick="if(event.target===this) closeJukebox()">',
  '  <div id="jukebox-modal" role="dialog" aria-label="DJ Vinyl\'s Jukebox">',
  '    <!-- v0.30.988 jb-console — DJ Vinyl\'s console: see the stylesheet above and openJukebox -->',
  '    <div class="jb-top">',
  '      <img class="jb-badge" src="Sprites/ui/jukebox/jb_badge.webp" alt="" draggable="false" onerror="this.style.display=\'none\'">',
  '      <div class="jb-plate"><h2>♪ DJ VINYL\'S JUKEBOX ♪</h2><span class="jb-model">VNL-46 · PERFORMANCE CONTROLLER</span></div>',
  '      <span class="jb-kata">ドリフト・フォンク</span>',
  '      <span class="jb-grow"></span>',
  '      <span class="jb-found" id="jukebox-found" title="Tracks you have found in the Everdawn"></span>',
  '      <button class="jb-x" type="button" onclick="closeJukebox()" aria-label="Close">✕</button>',
  '    </div>',
  '    <div class="jb-subtitle">~ spin any track in the realm ~</div>',
  '    <div class="jb-deck">',
  '      <div class="jb-deckcol"><div class="jb-wheel" title="The deck - it spins while a track plays"><div class="jb-platter"><div class="jb-label"><img id="jukebox-label" src="Sprites/ui/jukebox/jb_badge.webp" alt="" draggable="false"></div></div></div><span class="jb-silk">Deck A</span></div>',
  '      <div class="jb-mid">',
  '        <div class="jb-fan" aria-hidden="true">' + fan.join('') + '</div>',
  '        <div id="jukebox-now" class="idle">',
  '          <div class="jb-eq"><span></span><span></span><span></span><span></span><span></span></div>',
  '          <div class="jb-now-title" id="jukebox-now-title">— no track playing —</div>',
  '          <div class="jb-time" id="jukebox-time">--:--</div>',
  '        </div>',
  '        <div class="jb-btns">',
  '          <div class="jb-tb"><button id="jukebox-stop" type="button" onclick="jukeboxStop()" aria-label="Stop"><svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="2" width="8" height="8" rx="1.6"/></svg></button><span class="jb-silk">Stop</span></div>',
  '          <div class="jb-tb"><button class="jb-shuffle" type="button" onclick="jukeboxShuffle()" aria-label="Shuffle"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11 2l3 3-3 3V6H9.6L4.4 12H2v-2h1.6l5.2-6H11V2zm0 8l3 3-3 3v-2H8.8l-1.6-1.9 1.3-1.5 1.1 1.4H11v-2zM2 4h2.4l1.7 2-1.3 1.5L3.6 6H2V4z"/></svg></button><span class="jb-silk">Shuffle</span></div>',
  '        </div>',
  '      </div>',
  '      <div class="jb-deckcol">',
  '        <div class="jb-wheel jb-vol" id="jukebox-vol" role="slider" tabindex="0" aria-label="Music volume" aria-valuemin="0" aria-valuemax="100" aria-valuenow="90" title="Music volume - drag, scroll or use the arrow keys"><div class="jb-knob"><b id="jukebox-vol-num">90</b><small>VOL</small></div></div>',
  '        <div class="jb-volbtns"><button type="button" onclick="_jbVolStep(-10)" aria-label="Music volume down">−</button><button type="button" onclick="_jbVolStep(10)" aria-label="Music volume up">+</button></div>',
  '        <span class="jb-silk">Master</span>',
  '      </div>',
  '    </div>',
  '    <div class="jb-padhead"><span class="jb-silk">Performance pads</span><span class="jb-silk">Banks A · B · C · D</span></div>',
  '    <div id="jukebox-list"></div>',
  '    <div class="jb-footer">',
  '      <div class="jb-hint">Tap a pad to spin its track · Esc to close · the map\'s own music comes back when you leave</div>',
  '      <button type="button" onclick="closeJukebox()">✓ Done</button>',
  '    </div>',
  '  </div>',
  '</div>',
  '',
  '',
].join(EOL);
between('markup', '<div id="jukebox-modal-bg" onclick="if(event.target===this) closeJukebox()">', '<!-- v0.26.x — Gear Align calibration data', MARKUP, 3000);

// 3. the script: openJukebox .. jukeboxStop
between('js', 'function openJukebox() {', '// Esc closes the jukebox; takes priority over other Esc handlers when open.',
  part('_jb_console.js.txt') + EOL + part('_jb_console2.js.txt') + EOL, 9000);

const grew = s.length - n0;
if (grew < 9000 || grew > 30000) die('size moved ' + grew);
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 5000000) die('tmp small');
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) die('rename kept failing: ' + lastErr.code);
}
console.log('applied: jb-console (+' + grew + ' chars)');
