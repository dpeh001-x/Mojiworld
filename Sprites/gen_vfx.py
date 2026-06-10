"""VFX sprite sheets for LevelX.

Produces horizontal strips — each frame the same size, stacked left to right:

  sprites/vfx/slash.png        4 frames × 32×32  (crescent arc)
  sprites/vfx/magic_bolt.png   4 frames × 32×32  (blue orb with trail)
  sprites/vfx/fireball.png     6 frames × 32×32  (flickering flame sphere)
  sprites/vfx/ice_spike.png    4 frames × 32×48  (crystal lance)
  sprites/vfx/meteor.png       6 frames × 48×48  (meteor + shockwave)
  sprites/vfx/level_up.png     8 frames × 48×48  (gold pillar)
  sprites/vfx/portal.png       4 frames × 48×48  (swirling vortex, loops)
  sprites/vfx/death.png        5 frames × 48×48  (red burst → smoke)
"""
import os, sys, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixart import (P, canvas, px, rect, hline, vline, line,
                    circle_fill, circle_outline, ellipse_fill,
                    outline_silhouette, lighten, darken, save, sheet)

OUT = '/sessions/friendly-compassionate-albattani/mnt/LevelX/sprites/vfx'


# ----------------------------------------------------------------------
# SLASH — 4 frames × 32×32
# White crescent arc that grows, peaks, and fades.
# ----------------------------------------------------------------------
def gen_slash():
    frames = []
    for i in range(4):
        img = canvas(32, 32)
        cx, cy = 16, 16
        # Arc grows with i, then fades
        progress = [0.35, 0.7, 1.0, 0.5][i]  # visual scale of arc
        alpha_t = [255, 255, 200, 90][i]
        inner_r = int(8 * progress)
        outer_r = inner_r + 3
        # Draw crescent: pixels within annulus with angle range
        for y in range(32):
            for x in range(32):
                dx, dy = x - cx, y - cy
                d2 = dx * dx + dy * dy
                if inner_r * inner_r <= d2 <= outer_r * outer_r:
                    # Only bottom-right arc (angles ~ -30° to 100°)
                    ang = math.degrees(math.atan2(dy, dx))
                    if -45 < ang < 100:
                        c = P['white'] if d2 <= (inner_r + 1) ** 2 else P['steel_l']
                        c = (c[0], c[1], c[2], alpha_t)
                        px(img, x, y, c)
        frames.append(img)
    s = sheet(frames, 32, 32)
    save(s, f'{OUT}/slash.png')


# ----------------------------------------------------------------------
# MAGIC BOLT — 4 frames × 32×32
# Blue orb with trail, moving left→right.
# ----------------------------------------------------------------------
def gen_magic_bolt():
    frames = []
    for i in range(4):
        img = canvas(32, 32)
        cx = 6 + i * 7   # orb advances across frame
        cy = 16
        # Trail: fading dots behind orb
        for t, off in enumerate([10, 8, 6, 4, 2]):
            if cx - off >= 0:
                col = [P['blue_l'], P['cyan_l'], P['blue_m'], P['blue_d'], P['blue_d']][min(t, 4)]
                circle_fill(img, cx - off, cy, max(1, 3 - t), col)
        # Main orb
        circle_fill(img, cx, cy, 4, P['blue_m'])
        circle_fill(img, cx - 1, cy - 1, 3, P['blue_l'])
        circle_fill(img, cx - 2, cy - 2, 1, P['white'])
        # Outer halo sparkles
        for (dx, dy) in [(-5, 0), (0, -5), (5, 0), (0, 5)]:
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < 32 and 0 <= ny < 32:
                px(img, nx, ny, P['cyan_l'])
        frames.append(img)
    save(sheet(frames, 32, 32), f'{OUT}/magic_bolt.png')


# ----------------------------------------------------------------------
# FIREBALL — 6 frames × 32×32, flickering flame sphere
# ----------------------------------------------------------------------
def gen_fireball():
    random.seed(42)
    frames = []
    for i in range(6):
        img = canvas(32, 32)
        cx, cy = 16, 16
        # Outer red halo
        circle_fill(img, cx, cy, 9 + (i % 2), P['red_d'])
        # Orange middle
        circle_fill(img, cx, cy, 7, P['orange_m'])
        circle_fill(img, cx - 1, cy - 1, 5, P['orange_l'])
        circle_fill(img, cx - 2, cy - 2, 3, P['yellow'])
        # Hot-white core
        circle_fill(img, cx - 2, cy - 2, 1, P['white'])
        # Flickering flame tongues on top
        for _ in range(4 + i):
            tx = cx + random.randint(-8, 8)
            ty = cy + random.randint(-10, -4)
            if 0 <= tx < 32 and 0 <= ty < 32:
                px(img, tx, ty, P['orange_l'])
                if 0 <= ty + 1 < 32:
                    px(img, tx, ty + 1, P['orange_m'])
        # Sparks
        for _ in range(3):
            sx = cx + random.randint(-10, 10)
            sy = cy + random.randint(-10, 10)
            if 0 <= sx < 32 and 0 <= sy < 32:
                px(img, sx, sy, P['yellow'])
        frames.append(img)
    save(sheet(frames, 32, 32), f'{OUT}/fireball.png')


# ----------------------------------------------------------------------
# ICE SPIKE — 4 frames × 32×48, cyan crystal lance forming and releasing
# ----------------------------------------------------------------------
def gen_ice_spike():
    frames = []
    for i in range(4):
        img = canvas(32, 48)
        # Height of spike grows with i
        spike_h = [12, 24, 36, 40][i]
        tip_y = 48 - spike_h
        cx = 16
        # Draw tall triangular ice crystal
        for y in range(tip_y, 48):
            half_w = max(0, (y - tip_y) // 3)
            # Body
            for x in range(cx - half_w, cx + half_w + 1):
                px(img, x, y, P['cyan_m'])
            # Highlight left
            if half_w > 0:
                px(img, cx - half_w, y, P['cyan_l'])
            # Shadow right
            if half_w > 0:
                px(img, cx + half_w, y, P['cyan_d'])
            # White core down the middle
            if half_w > 1 and y > tip_y + 2:
                px(img, cx, y, P['white'])
        # Cracks / facet lines
        if i >= 2:
            line(img, cx - 2, tip_y + 8, cx - 3, 40, P['cyan_l'])
            line(img, cx + 2, tip_y + 6, cx + 3, 42, P['cyan_l'])
        # Little shards flying off on last frame
        if i == 3:
            px(img, cx - 6, tip_y + 4, P['cyan_l'])
            px(img, cx - 8, tip_y + 8, P['cyan_l'])
            px(img, cx + 7, tip_y + 6, P['cyan_l'])
            px(img, cx + 9, tip_y + 12, P['cyan_l'])
        outline_silhouette(img, color=darken(P['cyan_d'], 30))
        frames.append(img)
    save(sheet(frames, 32, 48), f'{OUT}/ice_spike.png')


# ----------------------------------------------------------------------
# METEOR IMPACT — 6 frames × 48×48 (fiery ball falls, impact ring expands)
# ----------------------------------------------------------------------
def gen_meteor():
    random.seed(7)
    frames = []
    for i in range(6):
        img = canvas(48, 48)
        if i < 3:
            # Falling meteor with flame trail
            fall_progress = i / 2.0   # 0, 0.5, 1.0
            y = int(4 + fall_progress * 30)
            x = int(4 + fall_progress * 20)
            # Flame trail
            for t in range(8):
                tx = x - int(t * 1.2)
                ty = y - int(t * 1.6)
                if 0 <= tx < 48 and 0 <= ty < 48:
                    circle_fill(img, tx, ty, max(1, 4 - t // 2),
                                [P['orange_l'], P['orange_m'], P['red_m'], P['red_d']][min(t // 2, 3)])
            # Meteor rock
            circle_fill(img, x, y, 5, P['grey_d'])
            circle_fill(img, x - 1, y - 1, 3, P['red_m'])
            circle_fill(img, x, y, 2, P['orange_l'])
        elif i == 3:
            # Impact flash — bright burst
            cx, cy = 24, 34
            circle_fill(img, cx, cy, 14, P['yellow'])
            circle_fill(img, cx, cy, 10, P['white'])
            # Rays
            for ang in range(0, 360, 30):
                rad = math.radians(ang)
                rx = cx + int(16 * math.cos(rad))
                ry = cy + int(16 * math.sin(rad))
                line(img, cx, cy, rx, ry, P['orange_l'])
        else:
            # Expanding shockwave ring
            cx, cy = 24, 34
            r_outer = 10 + (i - 3) * 6
            r_inner = r_outer - 2
            for y in range(48):
                for x in range(48):
                    dx, dy = x - cx, y - cy
                    d2 = dx * dx + dy * dy
                    if r_inner * r_inner <= d2 <= r_outer * r_outer:
                        col = P['orange_m'] if d2 > (r_inner + 1) ** 2 else P['yellow']
                        px(img, x, y, col)
            # Central glow
            circle_fill(img, cx, cy, 4, P['red_d'])
            # Small floating embers
            for _ in range(6):
                ex = cx + random.randint(-15, 15)
                ey = cy + random.randint(-15, 5)
                if 0 <= ex < 48 and 0 <= ey < 48:
                    px(img, ex, ey, P['orange_l'])
        frames.append(img)
    save(sheet(frames, 48, 48), f'{OUT}/meteor.png')


# ----------------------------------------------------------------------
# LEVEL UP — 8 frames × 48×48, golden pillar rises then settles
# ----------------------------------------------------------------------
def gen_level_up():
    frames = []
    for i in range(8):
        img = canvas(48, 48)
        cx = 24
        # Pillar height + intensity rises for first 5 frames, then fades
        if i < 5:
            height_px = 8 + i * 8
            intensity = min(255, 180 + i * 15)
        else:
            height_px = 44 - (i - 5) * 6
            intensity = max(60, 240 - (i - 5) * 40)
        base_y = 46
        top_y = max(2, base_y - height_px)
        # Pillar body: warm gradient
        for y in range(top_y, base_y + 1):
            ratio = (y - top_y) / max(1, base_y - top_y)
            # Outer width narrows near top
            w = max(1, int(6 * (0.3 + ratio * 0.7)))
            # Color: white at core, gold/orange outward
            for x in range(cx - w, cx + w + 1):
                d_from_center = abs(x - cx)
                if d_from_center == 0:
                    c = P['white']
                elif d_from_center == 1:
                    c = P['yellow']
                elif d_from_center < w:
                    c = P['gold_l']
                else:
                    c = P['orange_m']
                c = (c[0], c[1], c[2], intensity)
                px(img, x, y, c)
        # Rising sparkles around pillar
        for _ in range(6):
            sx = cx + random.randint(-12, 12)
            sy = random.randint(top_y, base_y)
            if 0 <= sx < 48:
                px(img, sx, sy, P['yellow'])
        frames.append(img)
    save(sheet(frames, 48, 48), f'{OUT}/level_up.png')


# ----------------------------------------------------------------------
# PORTAL — 4 frames × 48×48, swirling purple vortex (loops)
# ----------------------------------------------------------------------
def gen_portal():
    frames = []
    for i in range(4):
        img = canvas(48, 48)
        cx, cy = 24, 24
        rot_offset = i * (math.pi / 4)
        # Outer oval
        ellipse_fill(img, cx, cy, 18, 20, P['purple_d'])
        ellipse_fill(img, cx, cy, 15, 17, P['purple_m'])
        ellipse_fill(img, cx, cy, 11, 14, P['purple_l'])
        ellipse_fill(img, cx, cy, 6, 10, P['amethyst'])
        ellipse_fill(img, cx, cy, 3, 6, P['magenta'])
        # Inner darkness
        ellipse_fill(img, cx, cy, 2, 4, P['purple_d'])
        # Swirl streaks — points rotating with i
        for j in range(10):
            ang = (j * 2 * math.pi / 10) + rot_offset
            r = 6 + (j % 3) * 3
            sx = cx + int(r * math.cos(ang))
            sy = cy + int(r * 1.1 * math.sin(ang))
            if 0 <= sx < 48 and 0 <= sy < 48:
                px(img, sx, sy, P['white'])
        # Outer sparkles
        for (dx, dy) in [(-20, 0), (20, 0), (0, -22), (0, 22),
                         (-14, -14), (14, -14), (-14, 14), (14, 14)]:
            if (dx + dy + i) % 3 == 0:
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < 48 and 0 <= ny < 48:
                    px(img, nx, ny, P['purple_l'])
        frames.append(img)
    save(sheet(frames, 48, 48), f'{OUT}/portal.png')


# ----------------------------------------------------------------------
# DEATH EXPLOSION — 5 frames × 48×48, red burst → black smoke
# ----------------------------------------------------------------------
def gen_death():
    random.seed(99)
    frames = []
    for i in range(5):
        img = canvas(48, 48)
        cx, cy = 24, 24
        if i == 0:
            # Initial red flash
            circle_fill(img, cx, cy, 14, P['red_m'])
            circle_fill(img, cx, cy, 10, P['orange_l'])
            circle_fill(img, cx, cy, 6, P['yellow'])
            circle_fill(img, cx, cy, 2, P['white'])
        elif i == 1:
            # Big red burst with spikes
            circle_fill(img, cx, cy, 18, P['red_d'])
            circle_fill(img, cx, cy, 13, P['red_m'])
            circle_fill(img, cx, cy, 7, P['orange_l'])
            # Jagged spikes
            for ang in range(0, 360, 30):
                rad = math.radians(ang)
                rx = cx + int(20 * math.cos(rad))
                ry = cy + int(20 * math.sin(rad))
                line(img, cx, cy, rx, ry, P['red_l'])
        elif i == 2:
            # Darkening — red + smoke
            circle_fill(img, cx, cy, 18, P['red_d'])
            for _ in range(30):
                sx = cx + random.randint(-16, 16)
                sy = cy + random.randint(-18, 6)
                if 0 <= sx < 48 and 0 <= sy < 48:
                    px(img, sx, sy, P['grey_d'])
            # Embers
            for _ in range(8):
                sx = cx + random.randint(-14, 14)
                sy = cy + random.randint(-10, 10)
                if 0 <= sx < 48 and 0 <= sy < 48:
                    px(img, sx, sy, P['orange_m'])
        elif i == 3:
            # Mostly smoke
            for _ in range(80):
                sx = cx + random.randint(-18, 18)
                sy = cy + random.randint(-22, 4)
                if 0 <= sx < 48 and 0 <= sy < 48:
                    col = random.choice([P['grey_d'], P['grey_m'], P['black']])
                    px(img, sx, sy, col)
            # A few final embers
            for _ in range(3):
                sx = cx + random.randint(-10, 10)
                sy = cy + random.randint(-6, 6)
                if 0 <= sx < 48 and 0 <= sy < 48:
                    px(img, sx, sy, P['red_l'])
        else:
            # Dissipating smoke
            for _ in range(40):
                sx = cx + random.randint(-20, 20)
                sy = random.randint(-2, cy)
                if 0 <= sx < 48 and 0 <= sy < 48:
                    px(img, sx, sy, P['grey_m'])
        frames.append(img)
    save(sheet(frames, 48, 48), f'{OUT}/death.png')


if __name__ == '__main__':
    gen_slash()
    gen_magic_bolt()
    gen_fireball()
    gen_ice_spike()
    gen_meteor()
    gen_level_up()
    gen_portal()
    gen_death()
    print('vfx done ->', OUT)
