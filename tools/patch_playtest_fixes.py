# Playtest round-1 fixes (live-agent findings).
import os, io
P = os.path.join(os.path.dirname(__file__), '..', 'mojiworld_game.html')
s = io.open(P, encoding='utf-8').read()
assert len(s) > 4_000_000, 'file suspiciously small — aborting'

def rep(anchor, new, n=1):
    assert s.count(anchor) == n, 'anchor not unique (%d): %r' % (s.count(anchor), anchor[:70])
    return s.replace(anchor, new)

# F1 — prologue keydown lockdown: only movement/combat keys during the apex.
a = "  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;\n  const rawKey = e.key.toLowerCase();"
s = rep(a, """  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
  // v0.26.x — Prologue lockdown (live-playtest finding): Q/W/E/Esc etc. open
  // wardrobe / world map / quests / settings, each pausing the game under the
  // flash-forward. Allow only movement + combat keys; the cinematic overlay's
  // own capture listener (Enter/Esc/click) runs before this and is unaffected.
  if (window._prologueActive) {
    const _plgOk = [' ', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown',
                    'z', 'x', 's', 'c', 'd', 'f', 'v', 'g', 'b', 'shift'];
    if (!_plgOk.includes(e.key.toLowerCase())) { e.preventDefault(); return; }
  }
  const rawKey = e.key.toLowerCase();""")

# F2 — HUD hint: advertise the REAL keys (Z attack; X S C D F V G skills).
a = "      + '<br><span style=\"font-size:11px;color:#bdaaff;\">skills: Z · X · A · S · D · Q · W · E · C</span>';"
s = rep(a, "      + '<br><span style=\"font-size:11px;color:#bdaaff;\">Z attack · X S C D F V G skills · SPACE jump</span>';")

# F3 — timer: no wall-clock drain while the tab is hidden; clamp catch-up dumps.
a = "  if (!game.paused) window._prologueLeftMs -= dt;"
s = rep(a, "  // Hidden-tab guard + catch-up clamp (live-playtest): rAF freezes when the\n  // tab hides but this interval kept draining wall-clock time — a tabbed-out\n  // player lost the whole memory; and a long pause used to dump its entire\n  // accumulated delta in one tick the moment the game unpaused.\n  if (!game.paused && !document.hidden) window._prologueLeftMs -= Math.min(dt, 600);")

# F4 — boss attack sprites: fall back to animation frame 0 as the static pose
# (8 bosses ship <type>_0..8.webp with no base file; the loader warned x4 each).
a = """(function _loadBossAttackSprites() {
  // v0.25.498 — `.webp`/`.png` fallback via the shared helper.
  for (const type of BOSS_SPRITE_TYPES) {
    _loadEntitySprite(BOSS_ATTACK_SPRITES, BOSS_ATTACK_META, 'Sprites/bosses/attack/', type, 'BossAttackSprite');
  }
})();"""
s = rep(a, """(function _loadBossAttackSprites() {
  // v0.25.498 — `.webp`/`.png` fallback via the shared helper.
  // v0.26.x — (live-playtest) 8 bosses ship animation frames (<type>_0..8)
  // but no base attack pose, spamming load warnings. Chain a 3rd/4th
  // fallback to frame 0 as the static pose; warn only when nothing exists.
  for (const type of BOSS_SPRITE_TYPES) {
    const tryFile = (fname, ext, onMiss) => {
      const img = new Image();
      img.onload = () => { BOSS_ATTACK_SPRITES[type] = img; BOSS_ATTACK_META[type] = { bboxBottomY: _detectSpriteBboxBottom(img) }; };
      img.onerror = onMiss;
      img.src = 'Sprites/bosses/attack/' + fname + ext;
    };
    tryFile(type, '.webp', () => tryFile(type, '.png', () =>
      tryFile(type + '_0', '.webp', () => tryFile(type + '_0', '.png', () =>
        console.warn('[BossAttackSprite] failed to load', type)))));
  }
})();""")

# F5 — spawn beside (not ON) the town portal in The Void.
a = "  loadMap('void', 400);\n  if (typeof renderSkillBar === 'function')"
s = rep(a, "  loadMap('void', 260);   // beside the portal, not ON it — keep the walk-out beat\n  if (typeof renderSkillBar === 'function')")
a = "    loadMap('void', 400);\n    window._prologuePending = true;"
s = rep(a, "    loadMap('void', 260);\n    window._prologuePending = true;")
a = "  } else {\n    loadMap('void', 400);\n    openClassSelect();"
s = rep(a, "  } else {\n    loadMap('void', 260);\n    openClassSelect();")

# F6 — tutorial text: weapon step matches auto-equip reality.
a = "          'Open the <kbd>U</kbd> panel\\'s <b>Items</b> tab to find it, then <b>click the weapon to equip it</b>.<br><br>' +"
s = rep(a, "          'If your hands were empty it <b>auto-equips on the spot</b> — open the <kbd>U</kbd> panel\\'s <b>Items</b> tab to admire it (and click any gear there to swap, any time).<br><br>' +")

# F7 — tutorial text: mention the master ultimate key B.
a = "<kbd>X</kbd>, <kbd>S</kbd>, <kbd>C</kbd>, <kbd>D</kbd>, <kbd>F</kbd>, <kbd>V</kbd>, <kbd>G</kbd>. Press <kbd>K</kbd> to adjust your key settings.'"
s = rep(a, "<kbd>X</kbd>, <kbd>S</kbd>, <kbd>C</kbd>, <kbd>D</kbd>, <kbd>F</kbd>, <kbd>V</kbd>, <kbd>G</kbd> — and your master ultimate lands on <kbd>B</kbd> at Lv 50. Press <kbd>K</kbd> to adjust your key settings.'")

# F8 — tutorial text: say where you ARE (Void + Hall of Echoes portals).
a = "so you won\\'t get dropped into a zone that hits too hard.',"
s = rep(a, "so you won\\'t get dropped into a zone that hits too hard.<br><br>You begin in <b>The Void</b>: the ⭐ star portal leads to town, and the <b>⚔ Hall of Echoes</b> beside it is a boss-rush arena that replays bosses you\\'ve already faced — it wakes once you\\'ve met your first boss.',")

assert not any(0xD800 <= ord(c) <= 0xDFFF for c in s), 'lone surrogate detected'
tmp = P + '.tmp'
with io.open(tmp, 'w', encoding='utf-8', newline='') as f:
    f.write(s)
assert os.path.getsize(tmp) > 4_000_000
os.replace(tmp, P)
print('playtest fixes OK, new size', os.path.getsize(P))
