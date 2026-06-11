# Smoothness fixes 2-6: feel one-liners at agent-verified anchors.
import os
p = 'mojiworld_game.html'
s = open(p, encoding='utf-8').read()
ch = []

def repl(old, new, expect, tag):
    global s
    c = s.count(old)
    if c != expect:
        print('ABORT count %d != %d: %s' % (c, expect, tag)); raise SystemExit(1)
    s = s.replace(old, new); ch.append(tag)

# 2) rogue post-skill attackTimer clamp 140 -> 180 (matches stab baseline)
repl("player.attackTimer = Math.min(player.attackTimer, 140);",
     "player.attackTimer = Math.min(player.attackTimer, 180);   /* v0.26.x feel: was 140 -- snapped skill-link anims; 180 matches the stab baseline */",
     1, 'rogue clamp 180')

# 3) dodge roll velocity 8 -> 11 (was slower than the quick-dash floor of 9)
repl("player.vx = player.dodgeDir * 8;",
     "player.vx = player.dodgeDir * 11;   /* v0.26.x feel: was 8 -- below the quick-dash momentum floor (9); a defensive roll should outpace walking */",
     1, 'dodge 11')

# 4) stardust atrium backfill 0.35 -> 0.25 (dead travel time across the 4000px map)
repl("respawnDelayMul: 0.35", "respawnDelayMul: 0.25", 1, 'stardust backfill')

# 5) camera look-ahead 12 -> 18, clamp 80 -> 120
repl("const lookAhead = Math.max(-80, Math.min(80, player.vx * 12));",
     "const lookAhead = Math.max(-120, Math.min(120, player.vx * 18));   /* v0.26.x feel: lead the runner (~genre-norm 100px+), was +-80 @ x12 */",
     1, 'camera look-ahead')

# 6) death-respawn input grace: align with the ~1050ms overlay animation
repl("_DEATH_INPUT_GRACE_MS = 700", "_DEATH_INPUT_GRACE_MS = 1100", 1, 'death grace 1100')

assert not any(0xD800 <= ord(c) <= 0xDFFF for c in s)
tmp = p + '.tmp'
with open(tmp, 'w', encoding='utf-8', newline='') as f: f.write(s)
os.replace(tmp, p)
print('OK:', ch)
