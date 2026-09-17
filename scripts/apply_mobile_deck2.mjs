// Mobile controls, round two: layout from the user's edited screenshot, an N button, CHAT with the phone keyboard, a
// painted icon on every button, and the ghost click that shut a dialog the instant a button opened it.
// ============================================================================
// Per user, on an edited phone screenshot: "relocate the A (Block) key and reposition the Jump key, add in the N key (for
// NPC interaction)", "make the directional pad bigger", "Try to have custom icons for all buttons (I see MP needs to be
// done)", "remove the duplicate talk button at the top right, change it to chat and allow an onscreen keyboard to type",
// "The directional icons can be further improved".
//
// LAYOUT (landscape, measured off the screenshots; the phone is ~842x325 CSS px): Block leaves the HP potion it sat on
// for the top-left corner; the d-pad grows 168 -> 184 with 56 px arrows into the corner; Jump drops 14 px; N sits beside
// the potion dock between HP and MP (the gap the edit left is ON the potions, where Block had covered HP).
// ICONS: HP/MP take the painted HUD heart and mana drop; the d-pad a painted gold arrow (ludo.ai, Sprites/ui/hud/
// dpad_arrow.webp, turned per direction); N a waving hand; CHAT the speech bubble; F shows what a tap will do (the Q
// skill, a hand near a chest or NPC, else the class's block art); locked skill slots a padlock under their key letter;
// fullscreen / touch / settings / close painted icons in place of the glyphs.
// GHOST CLICK: a deck button presses its key on pointerdown, but the browser still fires one `click` after the finger
// lifts, at whatever is under it by then. Next to an NPC that was the dialog the key had just opened - measured in a
// phone emulation, TALK's click hit the modal close and N's hit a dialog option, and the dialog closed at once. One
// click near the touch, just after it, is eaten.
// Guarded + atomic + idempotent. EOL-aware. Every anchor is counted.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) mobile-deck2/.test(s)) { console.log('already applied'); process.exit(0); }
const EOL = ((s.match(/\r\n/g) || []).length > (s.match(/\n/g) || []).length / 2) ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const abort = (m) => { console.error('ABORT ' + m); process.exit(1); };
const sub = (label, a, b, n = 1) => { const c = s.split(a).length - 1; if (c !== n) abort(`${label}: matched ${c}, expected ${n}`); s = s.split(a).join(b); };
const T = 'v0.30.832 mobile-deck2';

// ---- 1. CSS --------------------------------------------------------------------------------------------------------
sub('css', '  .mobile-deck .mc-block { display: none !important; }', J(
  '  .mobile-deck .mc-block { display: none !important; }',
  `  /* ${T} \u2014 per user, on an edited phone screenshot (see the apply script for the measurements). Landscape: Block to`,
  '     the top-left corner (it sat on the HP potion), a 184 px d-pad with 56 px arrows in the corner, Jump 14 px lower, N',
  '     beside the potions. #mobile-deck-scoped to outrank the class-only layers above; a (pointer: coarse) group so the',
  '     desktop touch-controls mode copies it too (_lxInjectMobileCssForDesktop). */',
  '  @media (pointer: coarse), (max-width: 900px) {',
  '    body.mc-landscape #mobile-deck .mc-block {',
  '      display: flex !important;',
  '      left: calc(12px + env(safe-area-inset-left)) !important;',
  '      top: calc(37px + env(safe-area-inset-top)) !important;',
  '      right: auto !important; bottom: auto !important;',
  '    }',
  '    body.mc-landscape #mobile-deck .mc-dpad {',
  '      width: 184px !important; height: 184px !important;',
  '      left: calc(0px + env(safe-area-inset-left)) !important;',
  '      bottom: calc(23px + env(safe-area-inset-bottom)) !important;',
  '    }',
  '    body.mc-landscape #mobile-deck .mc-dpad::before { inset: 26px !important; }',
  '    body.mc-landscape #mobile-deck .mc-dpad .mc-btn { width: 56px !important; height: 56px !important; }',
  '    body.mc-landscape #mobile-deck .mc-dpad .mc-up    { top: 7px !important;    left: 64px !important; right: auto !important; bottom: auto !important; }',
  '    body.mc-landscape #mobile-deck .mc-dpad .mc-down  { bottom: 7px !important; left: 64px !important; right: auto !important; top: auto !important; }',
  '    body.mc-landscape #mobile-deck .mc-dpad .mc-left  { top: 64px !important;   left: 7px !important;  right: auto !important; bottom: auto !important; }',
  '    body.mc-landscape #mobile-deck .mc-dpad .mc-right { top: 64px !important;   right: 7px !important; left: auto !important;  bottom: auto !important; }',
  '    body.mc-landscape #mobile-deck .mc-actions .mc-jump { right: 254px !important; bottom: -6px !important; }',
  '    #mobile-deck .mc-pot-dock .mc-talk {',
  '      position: absolute !important; left: calc(100% + 8px); top: 30px;',
  '      border-color: rgba(150,235,190,0.9) !important; color: #eafff3 !important; background: rgba(110,210,160,0.3) !important;',
  '    }',
  '    #mobile-deck .mc-pot-dock .ui-ico { width: 24px; height: 24px; }',
  '  }',
  '  @media (pointer: coarse) and (orientation: portrait), (max-width: 900px) and (orientation: portrait) {',
  '    #mobile-deck .mc-pot-dock .mc-talk { left: 0; top: -60px; }   /* portrait: above the potions, clear of the face cluster */',
  '  }',
  '  /* The top-right corner on a phone: the settings / fullscreen / touch-toggle column (30 px, right 10, down to y 102) sat',
  '     over the last menu button (CHAT) and over the B skill slot. Settings and fullscreen now sit side by side along the top',
  '     edge, nothing hangs below them over B, the touch toggle moves to the top-left corner above Block, and the menu row',
  '     (buttons 50 -> 46 px, gaps 8 -> 6) steps left of the pair. Measured clear of the HUD card from 740 px wide up.',
  '     (hover: none) = a real touch screen only; the desktop touch-controls mode keeps its own corner. */',
  '  @media (hover: none) {',
  '    body.mc-landscape .mobile-ctrl .mc-pots { right: calc(84px + env(safe-area-inset-right)) !important; gap: 6px !important; }',
  '    body.mc-landscape .mobile-ctrl .mc-menu { width: 46px !important; height: 46px !important; }',
  '    body.mc-landscape #fullscreen-btn { top: calc(4px + env(safe-area-inset-top)) !important; right: calc(46px + env(safe-area-inset-right)) !important; }',
  '    body.mc-landscape #mobile-mode-btn { top: calc(4px + env(safe-area-inset-top)) !important; right: auto !important; left: calc(12px + env(safe-area-inset-left)) !important; }',
  '    /* the small hide/show-controls toggle had been sitting UNDER the touch toggle; it docks beside it now */',
  '    body.mc-landscape #mobile-ctrl-toggle { top: calc(7px + env(safe-area-inset-top)) !important; right: auto !important; left: calc(44px + env(safe-area-inset-left)) !important; width: 24px !important; height: 24px !important; opacity: 0.9 !important; }',
  '  }',
  '  /* the hide/show-controls toggle: a painted X while the controls show, a gamepad while they are hidden (its script still',
  '     writes the old glyph into it; the glyph is kept out of sight) */',
  "  #mobile-ctrl-toggle { color: transparent !important; font-size: 0 !important; background-image: url('Sprites/ui/hud/close.webp') !important; background-size: 62% !important; background-position: center !important; background-repeat: no-repeat !important; }",
  '  #mobile-ctrl-toggle > * { display: none !important; }',
  "  body.hide-mobile-ctrl #mobile-ctrl-toggle { background-image: url('Sprites/ui/emoji/1f3ae.webp') !important; background-size: 74% !important; }",
  `  /* ${T} \u2014 A PAINTED ICON ON EVERY BUTTON (per user). The glyphs these replace (\u25B2 \u25C0 \u25B6 \u25BC \u25C6 \u26F6 \u2715) had no painted`,
  '     version, so they rendered as plain text beside the painted HUD set. */',
  "  .ico-wave { background-image: url('Sprites/ui/emoji/1f44b.webp'); }",
  "  .ico-fullscreen { background-image: url('Sprites/ui/hud/fullscreen.webp'); }",
  "  .ico-close { background-image: url('Sprites/ui/hud/close.webp'); }",
  "  .ico-settings { background-image: url('Sprites/ui/emoji/2699.webp'); }",
  "  .ico-touch { background-image: url('Sprites/ui/emoji/1f4f1.webp'); }",
  '  .lx-corner-ico { display: block; width: 74%; height: 74%; background-position: center; background-size: contain; background-repeat: no-repeat; pointer-events: none; }',
  "  #mobile-deck .mc-dpad .mc-arrow { display: block; width: 68%; height: 68%; background: url('Sprites/ui/hud/dpad_arrow.webp') center / contain no-repeat; pointer-events: none; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.55)); }",
  '  #mobile-deck .mc-dpad .mc-up .mc-arrow   { transform: rotate(-90deg); }',
  '  #mobile-deck .mc-dpad .mc-down .mc-arrow { transform: rotate(90deg); }',
  '  #mobile-deck .mc-dpad .mc-left .mc-arrow { transform: rotate(180deg); }',
  '  /* a locked skill slot: a padlock, with the key letter as the corner badge every other slot wears */',
  "  #mobile-deck .mc-skill[data-empty=\"1\"] { background-image: url('Sprites/ui/emoji/1f512.webp') !important; background-size: 46% !important; background-position: center 44% !important; background-repeat: no-repeat !important; }",
  '  #mobile-deck .mc-btn[data-empty="1"] .mc-key { position: absolute !important; bottom: 2px !important; right: 5px !important; font-size: 10px !important; letter-spacing: 0.5px !important; }',
  '  #mobile-deck [data-dynamic="f-block"] .mc-icon { display: block; width: 100%; height: 100%; background-position: center; background-repeat: no-repeat; pointer-events: none; }',
  '  /* CHAT on a phone: the bar leaves the scaled game wrapper for the top of the screen (fixed positioning does not work',
  '     inside a transformed ancestor, and the keyboard covers the bottom); 16 px so iOS does not zoom the page to it. */',
  '  #mp-chat-input.mc-chat-float {',
  '    position: fixed !important; top: calc(10px + env(safe-area-inset-top)); left: 50%; bottom: auto;',
  '    transform: translateX(-50%); width: min(560px, 92vw); box-sizing: border-box;',
  '    font-size: 16px; padding: 10px 14px; border-radius: 12px; z-index: 240;',
  '  }'));

// ---- 2. markup -----------------------------------------------------------------------------------------------------
const dpad = (cls, mkey, label, glyph) => sub('dpad ' + cls,
  `    <button class="mc-btn ${cls}" data-mkey="${mkey}" aria-label="${label}" tabindex="-1" draggable="false" aria-hidden="true">${glyph}</button>`,
  `    <button class="mc-btn ${cls}" data-mkey="${mkey}" aria-label="${label}" tabindex="-1" draggable="false" aria-hidden="true"><span class="mc-arrow"></span></button>`);
dpad('mc-up', 'arrowup', 'Up / Enter portal', '\u25B2');
dpad('mc-left', 'arrowleft', 'Left', '\u25C0');
dpad('mc-right', 'arrowright', 'Right', '\u25B6');
dpad('mc-down', 'arrowdown', 'Drop / down', '\u25BC');
sub('hp', '<button class="mc-btn mc-pot mc-hp" data-mkey="pageup" aria-label="HP potion"><span class="mc-ico">\u2665</span>',
  '<button class="mc-btn mc-pot mc-hp" data-mkey="pageup" aria-label="HP potion"><span class="mc-ico ui-ico ico-hp"></span>');
sub('mp + N',
  '    <button class="mc-btn mc-pot mc-mp" data-mkey="pagedown" aria-label="MP potion"><span class="mc-ico">\u25C6</span><span class="mc-lbl">MP</span></button>',
  J('    <button class="mc-btn mc-pot mc-mp" data-mkey="pagedown" aria-label="MP potion"><span class="mc-ico ui-ico ico-mp"></span><span class="mc-lbl">MP</span></button>',
    `    <!-- ${T} \u2014 N: talk to the nearest NPC, open a chest, or close the dialog (per user). -->`,
    '    <button class="mc-btn mc-talk" data-mkey="n" aria-label="Talk to NPC / open chest (N)" title="Talk \u00B7 open chest (N)"><span class="mc-ico ui-ico ico-wave"></span><span class="mc-lbl">TALK</span><span class="mc-key">N</span></button>'));
sub('F', '<button class="mc-btn mc-skill" data-mkey="f" data-dynamic="f-block" aria-label="Skill F / Interact / Block">F</button>',
  '<button class="mc-btn mc-skill" data-mkey="f" data-dynamic="f-block" aria-label="Skill F / Interact / Block"><span class="mc-icon"></span><span class="mc-key">F</span></button>');
sub('talk -> chat',
  '<button class="mc-btn mc-menu" data-mkey="n" aria-label="Interact \u2014 chest / NPC" title="Open chest \u00B7 Talk to NPC"><span class="mc-ico ui-ico ico-talk"></span><span class="mc-lbl">TALK</span></button>',
  `<button class="mc-btn mc-menu mc-chat" id="mc-chat-btn" aria-label="Chat \u2014 type a message" title="Chat"><span class="mc-ico ui-ico ico-talk"></span><span class="mc-lbl">CHAT</span></button><!-- ${T} \u2014 was a second TALK; N has its own button now -->`);
sub('chat input', '<input id="mp-chat-input" type="text" maxlength="60" ',
  '<input id="mp-chat-input" type="text" maxlength="60" enterkeyhint="send" autocomplete="off" autocapitalize="sentences" ');
sub('modal close', 'aria-label="Close window">\u2715</button>', 'aria-label="Close window"><span class="lx-corner-ico ico-close"></span></button>');
sub('fullscreen', 'aria-label="Fullscreen toggle">\u26F6</button>', 'aria-label="Fullscreen toggle"><span class="lx-corner-ico ico-fullscreen"></span></button>');
sub('touch toggle', 'aria-label="Toggle touch controls">\uD83D\uDCF1</button>', 'aria-label="Toggle touch controls"><span class="lx-corner-ico ico-touch"></span></button>');
sub('settings', 'aria-label="Settings">\u2699</button>', 'aria-label="Settings"><span class="lx-corner-ico ico-settings"></span></button>');

// ---- 2a. the Jump button's art, regenerated (per user: "regenerate the jump icon" / "the mobile jump icon") ----------------
// A gold arrow springing off a cloud (ludo.ai, scripts/gen_mobile_deck_icons.mjs jump_v1; black sticker outline added per
// user by scripts/outline_icon.mjs --px 7, the width the HUD set wears), matching the new gold d-pad
// arrows while the cloud keeps it from reading as the d-pad's Up. A NEW file name, so a phone holding the old jump.webp in
// its cache still gets the new art; jump.webp itself is left as it was (nothing else uses it).
sub('jump icon', ".ico-jump { background-image: url('Sprites/ui/hud/jump.webp'); }",
  `.ico-jump { background-image: url('Sprites/ui/hud/jump_cloud.webp'); }   /* ${T} — regenerated (was hud/jump.webp) */`);

// ---- 2b. the dialog typewriter no longer eats Space / Enter typed elsewhere ------------------------------------------------
sub('typewriter skip',
  J("  const dlg = document.getElementById('dialog');",
    '  if (!dlg || !dlg._twTimer) return;',
    '  const k = e.key;',
    "  if (k === ' ' || k === 'Spacebar' || k === 'Enter') {"),
  J("  const dlg = document.getElementById('dialog');",
    '  if (!dlg || !dlg._twTimer) return;',
    `  // ${T} — only for the dialog on screen. The reveal timer can outlive the dialog (closed mid-reveal), and this`,
    '  // capture listener then swallowed every Space and Enter until the hidden reveal ran out: a jump that did nothing,',
    '  // and the spaces of a chat line typed just after talking to an NPC (measured: "hello team" posted as "helloteam").',
    "  if (dlg.style.display === 'none') return;",
    "  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;",
    '  const k = e.key;',
    "  if (k === ' ' || k === 'Spacebar' || k === 'Enter') {"));
// ---- 3. the ghost click ----------------------------------------------------------------------------------------------
sub('ghost helper', 'function _mkeyBind(btn) {', J(
  `// ${T} \u2014 THE GHOST CLICK. A deck button presses its key on pointerdown and cancels the pointer events, but the browser`,
  '// still fires one compatibility `click` after the finger lifts, aimed at whatever is under the finger by then. When the',
  '// key opened a window \u2014 N or F next to an NPC or a chest \u2014 that is the window: measured in a phone emulation, the click',
  '// hit a dialog option (or the modal close) and the dialog shut the instant it opened. One click near the touch point is',
  '// eaten, if it comes within 600 ms of the finger lifting; the next touch anywhere cancels the guard, so a real second tap',
  '// is never swallowed.',
  'function _lxEatGhostClick(ev) {',
  "  if (!ev || ev.pointerType !== 'touch' || typeof document === 'undefined') return;",
  '  const x = ev.clientX, y = ev.clientY, id = ev.pointerId;',
  '  let t = 0;',
  '  const done = () => {',
  "    document.removeEventListener('click', eat, true);",
  "    document.removeEventListener('pointerdown', done, true);",
  "    document.removeEventListener('pointerup', up, true);",
  "    document.removeEventListener('pointercancel', up, true);",
  '    clearTimeout(t);',
  '  };',
  '  const eat = (e) => {',
  '    if (Math.abs(e.clientX - x) > 48 || Math.abs(e.clientY - y) > 48) return;',
  '    e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();',
  '    done();',
  '  };',
  '  const up = (e) => { if (e.pointerId === id) { clearTimeout(t); t = setTimeout(done, 600); } };',
  "  document.addEventListener('click', eat, true);",
  "  document.addEventListener('pointerdown', done, true);",
  "  document.addEventListener('pointerup', up, true);",
  "  document.addEventListener('pointercancel', up, true);",
  '  t = setTimeout(done, 8000);   // a finger that never lifts cleanly still lets go of the guard',
  '}',
  'function _mkeyBind(btn) {'));
sub('ghost call (key buttons + F)', '  const press = (ev) => {' + EOL + '    if (ev) ev.preventDefault();',
  '  const press = (ev) => {' + EOL + '    if (ev) ev.preventDefault();' + EOL + `    _lxEatGhostClick(ev);   // ${T}`, 2);

// ---- 4. F shows what a tap will do ---------------------------------------------------------------------------------------
{
  const a = '  const pick = () => {';
  const i0 = s.indexOf(a); if (i0 < 0 || s.indexOf(a, i0 + 1) >= 0) abort('pick not unique');
  const i1 = s.indexOf(EOL + '  const press = (ev) => {', i0); if (i1 < 0 || i1 - i0 > 3000) abort('pick end not found');
  const old = s.slice(i0, i1);
  if (!old.includes("return 'a';") || !old.includes("skillBySlot('q')")) abort('pick body changed');
  const neu = J(
    `  // ${T} \u2014 ONE decision, two readers: pick() dispatches from it on a tap and the icon tick below paints it, so the`,
    '  // button can never show one action and send another. Thresholds unchanged (chest 40/60, NPC 60, Q at its level).',
    '  const fState = () => {',
    '    try {',
    "      if (typeof game !== 'undefined' && typeof player !== 'undefined' && player) {",
    '        const px = player.x + player.w/2;',
    '        const py = player.y + player.h;',
    '        for (const c of (game.chests || [])) {',
    "          if (!c.opened && Math.abs(px - (c.x + c.w/2)) < 40 && Math.abs(py - (c.y + c.h)) < 60) return 'interact';",
    '        }',
    '        // (v0.26.949 \u2014 no portal branch: portals are entered with \u25B2 only)',
    '        for (const npc of (game.npcs || [])) {',
    "          if (Math.abs(px - npc.x) < 60) return 'interact';",
    '        }',
    "        const qSkill = (typeof skillBySlot === 'function') ? skillBySlot('q') : null;",
    "        const lvReq = (typeof slotLevelReq === 'function') ? slotLevelReq('q') : 25;",
    "        if (qSkill && player.level >= lvReq) return 'q';",
    '      }',
    '    } catch (e) { /* fall through to block */ }',
    "    return 'block';",
    '  };',
    "  const pick = () => (fState() === 'block' ? 'a' : 'f');",
    "  const fIco = btn.querySelector('.mc-icon');",
    '  const paintF = () => {',
    '    if (!fIco) return;',
    '    const st = fState();',
    '    let url = null;',
    "    if (st === 'q') { const q = (typeof skillBySlot === 'function') ? skillBySlot('q') : null; url = (q && typeof _skillIconUrl === 'function') ? _skillIconUrl(q.id) : null; }",
    "    else if (st === 'interact') url = 'Sprites/ui/emoji/1f91a.webp';",
    "    else url = (typeof _lxBlockIconSrc === 'function') ? _lxBlockIconSrc() : 'Sprites/ui/block_shield.webp';",
    "    const key = st + '|' + url;",
    '    if (btn._fIcoKey === key) return;   // DOM writes only when the action changes',
    '    btn._fIcoKey = key;',
    '    btn.dataset.fstate = st;',
    "    fIco.style.backgroundImage = url ? 'url(\"' + url + '\")' : 'none';",
    "    fIco.style.backgroundSize = (st === 'q') ? '116%' : '64%';",
    '  };',
    '  paintF();',
    '  if (!window._lxFIconTick) {',
    '    window._lxFIconTick = setInterval(() => {   // 4 Hz, a few distance checks; idle off mobile, hidden or paused',
    '      const b = document.body;',
    "      if (!b || b.classList.contains('hide-mobile-ctrl') || b.classList.contains('force-desktop')) return;",
    "      if (!b.classList.contains('mc-landscape') && !b.classList.contains('mc-portrait')) return;",
    "      if (typeof game !== 'undefined' && game && game.paused) return;",
    '      paintF();',
    '    }, 250);',
    '  }');
  s = s.slice(0, i0) + neu + s.slice(i1);
}

// ---- 5. TALK becomes CHAT --------------------------------------------------------------------------------------------------
{
  const a = 'function _wireMobileTalkChat() {', b = 'try { _wireMobileTalkChat(); } catch (_) {}';
  const i0 = s.indexOf(a); if (i0 < 0 || s.indexOf(a, i0 + 1) >= 0) abort('_wireMobileTalkChat not unique');
  const i1 = s.indexOf(b, i0); if (i1 < 0 || i1 - i0 > 3000) abort('_wireMobileTalkChat end not found');
  const neu = J(
    `// ${T} \u2014 CHAT (per user: "remove the duplicate talk button at the top right, change it to chat and allow an onscreen`,
    '// keyboard to type"). N has its own button beside the potions now; the top-row button is CHAT, and one tap opens the chat',
    '// bar and raises the phone keyboard. The focus happens inside the tap (touchend / click), which mobile browsers require',
    '// before they show a keyboard. The bar moves to the top of the screen (see .mc-chat-float); the keyboard\'s Send key is',
    '// Enter, which sends; dismissing the keyboard closes the bar, so the next tap opens it again rather than doing nothing.',
    'function _wireMobileTalkChat() {',
    "  const btn = document.getElementById('mc-chat-btn');",
    '  if (!btn || btn._talkChatWired) return;',
    '  btn._talkChatWired = true;',
    '  const openChat = (ev) => {',
    '    if (ev && ev.cancelable) ev.preventDefault();   // on touchend: no synthetic click after it',
    "    if (typeof net !== 'undefined' && net.chatOpen) return;",
    "    const inp = document.getElementById('mp-chat-input');",
    "    if (!inp || typeof _mpOpenChat !== 'function') return;",
    '    if (!inp._lxFloat) {',
    '      inp._lxFloat = true;',
    '      document.body.appendChild(inp);',
    "      inp.classList.add('mc-chat-float');",
    "      inp.addEventListener('blur', () => {",
    "        setTimeout(() => { if (typeof net !== 'undefined' && net.chatOpen && document.activeElement !== inp) _mpCloseChat(false); }, 150);",
    '      });',
    '    }',
    '    _mpOpenChat();',
    '  };',
    "  btn.addEventListener('touchend', openChat, { passive: false });",
    "  btn.addEventListener('click', openChat);",
    '}',
    '');
  s = s.slice(0, i0) + neu + s.slice(i1);
}

const grew = s.length - n0;
if (grew < 9000 || grew > 22000) abort(`content moved ${grew}`);
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) abort('tmp suspiciously small');
renameSync(F + '.tmp', F);
console.log(`applied: mobile-deck2 \u2014 layout, N, CHAT + keyboard, painted icons, ghost click (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
