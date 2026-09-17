import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_CHANGELOG_FILE || 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const VER = process.env.LX_VER;
if (!VER) { console.error('ABORT: LX_VER unset'); process.exit(1); }
if (s.includes('>' + VER + ' <')) { console.log('already applied'); process.exit(0); }
const ANCHOR = '</header>' + EOL + EOL;
if ((s.split(ANCHOR).length - 1) !== 1) { console.error('ABORT: header anchor not unique'); process.exit(1); }
const ENTRY = J(
  '</header>',
  '',
  '<h2>' + VER + ' <span class="tag"><span class="pill feat">feat</span> Mobile controls: Block to the corner, a bigger d-pad, an N button, CHAT with the phone keyboard, and a painted icon on every button</span></h2>',
  '<p>Per user, on an edited phone screenshot: <em>&ldquo;relocate the A (Block) key and reposition the Jump key, add in the N key (for NPC interaction)&rdquo;</em>, <em>&ldquo;make the directional pad bigger&rdquo;</em>, <em>&ldquo;Try to have custom icons for all buttons (I see MP needs to be done)&rdquo;</em>, <em>&ldquo;remove the duplicate talk button at the top right, change it to chat and allow an onscreen keyboard to type&rdquo;</em> and <em>&ldquo;The directional icons can be further improved&rdquo;</em>.</p>',
  '<p><b>Layout</b> (landscape, measured off the two screenshots: the phone is about 842&times;325 CSS px). <b>Block</b> had been sitting on top of the HP potion &mdash; the landscape rule parked it right over the potion dock &mdash; and moves to the top-left corner. The <b>d-pad</b> grows from 168 to 184&nbsp;px with 56&nbsp;px arrows (were 50) and settles into the corner. <b>Jump</b> drops 14&nbsp;px. <b>N</b> (talk to the nearest NPC, open a chest, close the dialog) sits beside the potions, between HP and MP &mdash; the gap the edit left was on the potions themselves, where Block had covered HP. The top-right corner had its own pile-up: the settings / fullscreen / touch-toggle column covered the last menu button and the B skill slot, with a second hide-controls toggle hidden under it. Settings and fullscreen now sit side by side along the top edge, both toggles dock at the top-left above Block, and the menu row (buttons 50&nbsp;&rarr;&nbsp;46&nbsp;px) steps left of them. Portrait keeps its layout, with N above the potions.</p>',
  '<p><b>CHAT.</b> The top-row TALK was a second talk button; it is <b>CHAT</b> now. One tap opens the chat bar and raises the phone keyboard (the focus happens inside the tap, which is what mobile browsers require); the bar moves to the top of the screen, clear of the keyboard, in 16&nbsp;px text; the keyboard&rsquo;s key reads <b>Send</b>; and dismissing the keyboard closes the bar so the next tap opens it again.</p>',
  '<p><b>A painted icon on every button.</b> HP and MP take the HUD heart and mana drop (MP was a plain &#9670;). The d-pad arrows are a new painted gold arrow, generated with ludo.ai in the HUD icon style and turned per direction. The <b>Jump</b> icon is regenerated too: a gold arrow springing off a cloud, with the thick black sticker outline the rest of the HUD icons wear (<code>scripts/outline_icon.mjs</code>), matching the new arrows while the cloud keeps it from reading as the d-pad&rsquo;s Up (a new file, <code>jump_cloud.webp</code>, so a phone holding the old image in its cache still gets the new one). N is a waving hand, CHAT the speech bubble, locked skill slots a padlock under their key letter, and fullscreen, settings, the touch toggles and the modal close are painted icons instead of glyphs (fullscreen and close are new, same style). <b>F shows what a tap will do</b>: the Q skill once it is unlocked, a hand next to a chest or NPC, otherwise the class&rsquo;s block art &mdash; read from the same decision the tap dispatches from, so the icon can never promise one action and send another.</p>',
  '<p><b>Two bugs found on the way.</b> <b>The ghost click:</b> a deck button presses its key on touch-down, but the browser still fires one click after the finger lifts, at whatever is under it by then &mdash; and next to an NPC that was the dialog the key had just opened. In a phone emulation, TALK&rsquo;s click landed on the modal close and N&rsquo;s on a dialog option, and the dialog shut the instant it opened (it could also have picked an option). One click near the touch, just after it, is now eaten; the next real touch cancels the guard. <b>The swallowed space:</b> the dialog typewriter&rsquo;s key listener could outlive a dialog closed mid-reveal and eat every Space and Enter until the hidden reveal ran out &mdash; a jump that did nothing, and a chat line typed just after talking to an NPC posted as &ldquo;helloteam&rdquo;. It now acts only on a dialog that is on screen, and never on keys typed into a text field.</p>',
  '<p><b>Verified.</b> <code>scripts/mobile_deck2_test.mjs</code> &mdash; 24 checks on an emulated phone that taps the real buttons: Block in the corner, the 184&nbsp;px d-pad, Jump 14&nbsp;px lower, N between the potions, one talk button and a CHAT button; nothing overlaps on 842&times;325, 915&times;412, 740&times;360 or 789&times;304; every button carries a painted icon, no plain glyph is left as a label, every icon loads, and Jump wears the regenerated art; F shows a hand by an NPC and block art away from one; Block sends A; <b>N next to an NPC opens the dialog and it is still open a second later</b>; N alone opens nothing; CHAT focuses a bar at the top in 16&nbsp;px with a Send key, a typed line posts over the hero with its spaces, and the bar reopens and closes with the keyboard; portrait puts N above the potions; the desktop touch-controls mode gets the same deck. <code>hud_size_slider_test.mjs</code> 12/12 and <code>pad_vk_entry_test.mjs</code> 6/6 still pass.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 3000 || grew > 14000) { console.error('ABORT: moved ' + grew); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp small'); process.exit(1); }
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) { console.error('ABORT: rename kept failing: ' + lastErr.code); process.exit(1); }
}
console.log('applied: CHANGELOG ' + VER + ' (+' + grew + ' chars)');
