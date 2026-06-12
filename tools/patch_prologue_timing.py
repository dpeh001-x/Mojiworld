# Prologue timing fix — defer past the asset loader + login gate.
import os, io
P = os.path.join(os.path.dirname(__file__), '..', 'mojiworld_game.html')
s = io.open(P, encoding='utf-8').read()
assert len(s) > 4_000_000, 'file suspiciously small — aborting'

def rep(anchor, new, n=1):
    assert s.count(anchor) == n, 'anchor not unique (%d): %r' % (s.count(anchor), anchor[:70])
    return s.replace(anchor, new)

# T1 — boot block: arm a pending flag instead of starting under the loader.
a = """  if (typeof _startPrologue === 'function') {
    _startPrologue();
  } else {"""
s = rep(a, """  if (typeof _startPrologue === 'function') {
    // v0.26.x — Bugfix: the prologue used to start RIGHT HERE, at script-
    // parse time — overlapping the asset loader + login gate (both still
    // on screen). Now the boot just preloads the void hub and arms a
    // pending flag; _finishHide() — the login-dismiss path — starts the
    // cinematic once the gate has actually dissolved. Defensive fallback:
    // if this build has no loading overlay at all, start immediately.
    loadMap('void', 400);
    window._prologuePending = true;
    if (!document.getElementById('loading-overlay')) {
      window._prologuePending = false;
      _startPrologue();
    }
  } else {""")

# T2 — _finishHide: launch the pending prologue after the 220ms dissolve.
a = """    // v0.25.233 — Start the looping BGM the moment the world reveals.
    startBgm();
  }"""
s = rep(a, """    // v0.25.233 — Start the looping BGM the moment the world reveals.
    startBgm();
    // v0.26.x — Flash-forward prologue, deferred (see the boot block): on a
    // fresh save the boot armed _prologuePending instead of starting the
    // cinematic underneath this very overlay. Start it now, just after the
    // gate's 220 ms dissolve completes.
    if (window._prologuePending) {
      window._prologuePending = false;
      setTimeout(() => { if (typeof _startPrologue === 'function') _startPrologue(); }, 320);
    }
  }""")

# T3/T4 — save gates also cover the pending window (tab-close at the login
# screen must not write a fresh save and burn the prologue for next boot).
a = "  if (window._prologueActive) return;\n  try {"
s = rep(a, "  if (window._prologueActive || window._prologuePending) return;\n  try {")
a = "  if (window._prologueActive) return;   // v0.26.x — Prologue save gate (see _flushSaveStateNow)"
s = rep(a, "  if (window._prologueActive || window._prologuePending) return;   // v0.26.x — Prologue save gate (see _flushSaveStateNow)")

assert not any(0xD800 <= ord(c) <= 0xDFFF for c in s), 'lone surrogate detected'
tmp = P + '.tmp'
with io.open(tmp, 'w', encoding='utf-8', newline='') as f:
    f.write(s)
assert os.path.getsize(tmp) > 4_000_000
os.replace(tmp, P)
print('timing patch OK, new size', os.path.getsize(P))
