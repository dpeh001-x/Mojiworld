# Prologue cleanup — suppress talent/tutorial/tip popups during the prologue,
# and make the prologue once-ever via a localStorage flag.
import os, io
P = os.path.join(os.path.dirname(__file__), '..', 'mojiworld_game.html')
s = io.open(P, encoding='utf-8').read()
assert len(s) > 4_000_000, 'file suspiciously small — aborting'

def rep(anchor, new, n=1):
    assert s.count(anchor) == n, 'anchor not unique (%d): %r' % (s.count(anchor), anchor[:70])
    return s.replace(anchor, new)

# G1 — talent picker: never during the prologue (the apex job apply schedules
# it at +700ms; it paused the game under the cinematic = "stuck at talent").
a = "function openTalentPick() {\n  const jobId = player && player.job;"
s = rep(a, "function openTalentPick() {\n  // v0.26.x — Prologue: the apex devSetMasterChain applies a job, which\n  // schedules this picker — it paused the game mid-flash-forward. The\n  // memory needs no talents; the snapshot restore wipes the state anyway.\n  if (window._prologueActive) return;\n  const jobId = player && player.job;")

# G2 — tutorial autostart: not while the prologue owns the screen (the apex\n# applyClass scheduled it; the real tutorial belongs to the real class pick).
a = """  if (!_alreadySeenTutorial) {
    setTimeout(() => {
      if (typeof _wireTutorialButtons === 'function') _wireTutorialButtons();
      if (typeof startTutorial === 'function') startTutorial();
    }, 600);
  }"""
s = rep(a, """  if (!_alreadySeenTutorial) {
    setTimeout(() => {
      if (window._prologueActive) return;   // v0.26.x — apex class apply is not the player's class pick
      if (typeof _wireTutorialButtons === 'function') _wireTutorialButtons();
      if (typeof startTutorial === 'function') startTutorial();
    }, 600);
  }""")

# G3 — first-time tips: suppress AND don't burn their one-shot flags mid-prologue.
a = "function _firstTimeTip(key, txt, rarity) {\n  try {\n    const sk = 'mojiworld_tip_' + key;"
s = rep(a, "function _firstTimeTip(key, txt, rarity) {\n  if (window._prologueActive) return false;   // v0.26.x — don't show OR burn one-shot tips during the prologue\n  try {\n    const sk = 'mojiworld_tip_' + key;")

# G4 — once-ever: boot only arms the prologue if it has never completed.
a = """  if (typeof _startPrologue === 'function') {
    // v0.26.x — Bugfix: the prologue used to start RIGHT HERE, at script-"""
s = rep(a, """  if (typeof _startPrologue === 'function'
      && (() => { try { return localStorage.getItem('mojiworld_prologue_seen') !== '1'; } catch (e) { return true; } })()) {
    // v0.26.x — Once-ever gate: the flag is stamped when the prologue ends
    // (finish OR skip), so a player who reached character creation never
    // sees it again — even if they quit before their first save existed.
    // v0.26.x — Bugfix: the prologue used to start RIGHT HERE, at script-""")

# G5 — stamp the flag when the prologue ends (finish or skip).
a = "  window._prologueSnapP = window._prologueSnapG = null;\n  window._prologueActive = false;"
s = rep(a, "  window._prologueSnapP = window._prologueSnapG = null;\n  window._prologueActive = false;\n  try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {}   // once-ever (see boot gate)")

# G6 — full save-wipe also re-arms the prologue (same treatment as tutorial).
a = "      if (_k && (_k.indexOf('mojiworld_tip_') === 0 || _k === 'mojiworld_tutorial_seen')) {"
s = rep(a, "      if (_k && (_k.indexOf('mojiworld_tip_') === 0 || _k === 'mojiworld_tutorial_seen' || _k === 'mojiworld_prologue_seen')) {")

# G7 — defensive sweep at apex start: close anything a class/job apply popped.
a = "  loadMap('gravitosArena', 300);\n  setTimeout(_prologueHardenBoss, 1600);"
s = rep(a, """  loadMap('gravitosArena', 300);
  // Defensive: if any advancement/ceremony modal opened during the apex
  // class chain, clear it — the prologue plays clean, no tabs, no pauses.
  setTimeout(() => {
    if (!window._prologueActive) return;
    const _adv = document.getElementById('advancement-modal');
    if (_adv) _adv.style.display = 'none';
    if (typeof closeAllModals === 'function') { try { closeAllModals(); } catch (e) {} }
    game.paused = false;
  }, 1000);
  setTimeout(_prologueHardenBoss, 1600);""")

assert not any(0xD800 <= ord(c) <= 0xDFFF for c in s), 'lone surrogate detected'
tmp = P + '.tmp'
with io.open(tmp, 'w', encoding='utf-8', newline='') as f:
    f.write(s)
assert os.path.getsize(tmp) > 4_000_000
os.replace(tmp, P)
print('cleanup patch OK, new size', os.path.getsize(P))
