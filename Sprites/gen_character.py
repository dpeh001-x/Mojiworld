"""Character base bodies + every overlay sheet.

All sheets are 192 x 48 (6 frames of 32 x 48). Frame order:
  0 idle, 1 walk-1, 2 walk-2, 3 jump, 4 attack-mid, 5 attack-end.

Convention per 32x48 cell:
  anchor (facing camera-right)
  feet line      y = 46
  head top       y = 3   (body center x = 16)
  head center    (16, 10)
  neck           (16, 17)
  chest center   (16, 24)
  belt           (16, 32)
  right-hand     frame-dependent (see POSES)
  left-hand      frame-dependent
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixart import (P, canvas, px, rect, hline, vline, line,
                    circle_fill, circle_outline, ellipse_fill,
                    outline_silhouette, lighten, darken, save, sheet)

OUT = '/sessions/friendly-compassionate-albattani/mnt/LevelX/sprites/character'

CELL_W, CELL_H = 32, 48
FRAMES = 6


# ----------------------------------------------------------------------
# POSE TABLE — joint coordinates in each cell's local coord (origin TL).
# These drive both base bodies and overlays.
# ----------------------------------------------------------------------
POSES = [
    # 0 idle — straight standing
    {'head_y_off': 0, 'body_tilt': 0,
     'r_hand': (23, 27), 'l_hand': (9, 27),
     'r_shoulder': (21, 19), 'l_shoulder': (11, 19),
     'r_foot': (19, 46), 'l_foot': (13, 46),
     'knee_bend': 0,  'cape_hem': (16, 42), 'cape_tilt': 0,
     'weapon_pose': 'down_side'},

    # 1 walk-1 — LEFT foot forward, RIGHT arm back
    {'head_y_off': -1, 'body_tilt': -1,
     'r_hand': (23, 29), 'l_hand': (9, 25),
     'r_shoulder': (21, 19), 'l_shoulder': (11, 19),
     'r_foot': (15, 46), 'l_foot': (18, 44),
     'knee_bend': 1,  'cape_hem': (15, 42), 'cape_tilt': -1,
     'weapon_pose': 'sway_back'},

    # 2 walk-2 — RIGHT foot forward, LEFT arm back (mirror)
    {'head_y_off': -1, 'body_tilt': 1,
     'r_hand': (23, 25), 'l_hand': (9, 29),
     'r_shoulder': (21, 19), 'l_shoulder': (11, 19),
     'r_foot': (18, 44), 'l_foot': (15, 46),
     'knee_bend': 1,  'cape_hem': (17, 42), 'cape_tilt': 1,
     'weapon_pose': 'sway_forward'},

    # 3 jump — knees tucked slightly, arms flared BACK
    {'head_y_off': -1, 'body_tilt': 0,
     'r_hand': (25, 21), 'l_hand': (7, 21),
     'r_shoulder': (22, 18), 'l_shoulder': (10, 18),
     'r_foot': (19, 44), 'l_foot': (13, 44),
     'knee_bend': 2,  'cape_hem': (16, 38), 'cape_tilt': 0,
     'weapon_pose': 'raised_back'},

    # 4 attack-mid — body coiled, RIGHT arm raised HIGH OVERHEAD
    {'head_y_off': 0, 'body_tilt': -1,
     'r_hand': (20, 8), 'l_hand': (7, 27),
     'r_shoulder': (21, 19), 'l_shoulder': (11, 19),
     'r_foot': (19, 46), 'l_foot': (13, 46),
     'knee_bend': 0,  'cape_hem': (14, 42), 'cape_tilt': -2,
     'weapon_pose': 'overhead'},

    # 5 attack-end — RIGHT arm swept down-forward, front foot planted
    {'head_y_off': 0, 'body_tilt': 2,
     'r_hand': (2, 30), 'l_hand': (10, 27),
     'r_shoulder': (21, 20), 'l_shoulder': (11, 20),
     'r_foot': (21, 46), 'l_foot': (13, 44),
     'knee_bend': 0,  'cape_hem': (19, 42), 'cape_tilt': 2,
     'weapon_pose': 'forward_low'},
]


# ----------------------------------------------------------------------
# BASE BODY — draw a cute chibi into a 32x48 cell for a given pose.
# `gender` 'm' or 'f' slightly varies shoulder width + foot size.
# ----------------------------------------------------------------------
def draw_base_body(img, pose, gender='m'):
    """Draw directly into a 32x48 canvas."""
    hy = pose['head_y_off']
    tilt = pose['body_tilt']
    # ---- HEAD (huge round for chibi feel) ----
    head_cx, head_cy = 16 + tilt, 10 + hy
    # Skin
    for y in range(3, 17):
        for x in range(9, 24):
            dx, dy = x - head_cx, y - head_cy
            # Elliptical head
            if (dx * dx) / 49 + (dy * dy) / 49 <= 1.0:
                px(img, x, y, P['skin_l'])
    # Shadow on right side of head
    for y in range(7, 16):
        for x in range(18, 23):
            dx, dy = x - head_cx, y - head_cy
            if (dx * dx) / 49 + (dy * dy) / 49 <= 1.0 and dx > 3:
                px(img, x, y, P['skin_m'])
    # Eyes (big expressive dots with white catchlight)
    left_eye = (13, 11 + hy)
    right_eye = (18, 11 + hy)
    for (ex, ey) in (left_eye, right_eye):
        px(img, ex, ey, P['black'])
        px(img, ex, ey + 1, P['black'])
        px(img, ex + 1, ey, P['white'])  # catchlight
    # Eyebrows (tiny 1-px arches)
    px(img, 12, 9 + hy, P['brown_d'])
    px(img, 13, 8 + hy, P['brown_d'])
    px(img, 17, 8 + hy, P['brown_d'])
    px(img, 18, 9 + hy, P['brown_d'])
    # Mouth — tiny smile (or open for jump/attack-end)
    mouth_y = 14 + hy
    if pose is POSES[3] or pose is POSES[5]:
        # Open-mouth shout
        px(img, 15, mouth_y, P['red_d'])
        px(img, 16, mouth_y, P['red_d'])
        px(img, 15, mouth_y + 1, P['red_d'])
        px(img, 16, mouth_y + 1, P['red_d'])
    else:
        # Gentle smile
        px(img, 14, mouth_y, P['brown_d'])
        px(img, 15, mouth_y + 1, P['brown_d'])
        px(img, 16, mouth_y + 1, P['brown_d'])
        px(img, 17, mouth_y, P['brown_d'])
    # Blush circles
    px(img, 11, 12 + hy, P['blush'])
    px(img, 20, 12 + hy, P['blush'])

    # ---- NECK ----
    rect(img, 15 + tilt, 16, 17 + tilt, 18, P['skin_m'])

    # ---- TORSO (grey tank-top) ----
    # Torso body
    t_x_off = tilt
    shoulder_narrow = -1 if gender == 'f' else 0
    torso_left = 10 + t_x_off - shoulder_narrow
    torso_right = 22 + t_x_off + shoulder_narrow
    rect(img, torso_left, 19, torso_right, 33, P['grey_m'])
    # Tank-top highlight (left side)
    vline(img, torso_left, 19, 33, P['grey_l'])
    # Shadow right side
    vline(img, torso_right, 19, 33, P['grey_d'])
    # Neckline (skin peeks through)
    rect(img, 14 + t_x_off, 19, 18 + t_x_off, 20, P['skin_m'])
    if gender == 'f':
        # Slightly fitted at waist
        vline(img, torso_left + 1, 28, 32, P['grey_d'])
        vline(img, torso_right - 1, 28, 32, P['grey_d'])

    # ---- ARMS ----
    # Right arm: shoulder -> hand (draw as a thick 2-px line + small fist blob)
    def arm(sh, hand):
        line(img, sh[0], sh[1], hand[0], hand[1], P['skin_l'])
        # Thicker outer edge for depth
        line(img, sh[0], sh[1] + 1, hand[0], hand[1] + 1, P['skin_m'])
        # Fist (3px blob)
        for (ox, oy) in [(-1, 0), (0, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = hand[0] + ox, hand[1] + oy
            if 0 <= nx < 32 and 0 <= ny < 48:
                px(img, nx, ny, P['skin_m'])
        px(img, hand[0], hand[1], P['skin_l'])
    arm(pose['r_shoulder'], pose['r_hand'])
    arm(pose['l_shoulder'], pose['l_hand'])

    # ---- LEGS ----
    # Thighs + calves, bare peach skin
    r_foot = pose['r_foot']
    l_foot = pose['l_foot']
    # Right leg: hip near (19, 33) -> foot
    line(img, 19, 33, r_foot[0], r_foot[1] - 2, P['skin_l'])
    line(img, 20, 33, r_foot[0] + 1, r_foot[1] - 2, P['skin_m'])
    # Left leg: hip near (13, 33) -> foot
    line(img, 13, 33, l_foot[0], l_foot[1] - 2, P['skin_l'])
    line(img, 12, 33, l_foot[0] - 1, l_foot[1] - 2, P['skin_m'])
    # Knee bend: add a small dot at mid-leg for bent frames
    if pose['knee_bend']:
        px(img, 19, 38, P['skin_m'])
        px(img, 13, 38, P['skin_m'])

    # ---- DEFAULT BROWN ANKLE BOOTS (base only — overlays replace) ----
    for foot in (r_foot, l_foot):
        fx, fy = foot
        rect(img, fx - 1, fy - 1, fx + 1, fy, P['brown_m'])
        px(img, fx - 1, fy - 1, P['brown_l'])
        px(img, fx + 1, fy, P['brown_d'])


def build_base_sheet(gender):
    frames = []
    for p in POSES:
        img = canvas(CELL_W, CELL_H)
        draw_base_body(img, p, gender=gender)
        outline_silhouette(img)
        frames.append(img)
    return sheet(frames, CELL_W, CELL_H)


# ----------------------------------------------------------------------
# HAIR OVERLAYS — sit on top of head. Each style = a set of pixels.
# ----------------------------------------------------------------------
def _hair_frame(style, pose):
    """Draw hair-only into a 32x48 cell. Head center is (16+tilt, 10+hy)."""
    img = canvas(CELL_W, CELL_H)
    tilt = pose['body_tilt']
    hy = pose['head_y_off']
    cx, cy = 16 + tilt, 10 + hy

    if style == 'spiky_brown':
        base, hi = P['brown_m'], P['brown_l']
        # Spiky caps
        # Row y = 3 (top of head): irregular spikes
        spikes = [(cx - 5, 4), (cx - 3, 3), (cx - 1, 4), (cx + 1, 3), (cx + 3, 4), (cx + 5, 3)]
        for (sx, sy) in spikes:
            px(img, sx, sy, base)
            px(img, sx, sy - 1, base)
            px(img, sx, sy - 2, hi)
        # Fill top-of-head cap
        for y in range(4, 7):
            for x in range(cx - 6, cx + 7):
                dx, dy = x - cx, y - cy
                if (dx * dx) / 49 + (dy * dy) / 49 <= 1.0:
                    px(img, x, y, base)
        # Side bangs
        for y in range(5, 8):
            px(img, cx - 6, y, base)
            px(img, cx + 6, y, base)
        # Highlight streak
        for y in range(4, 6):
            px(img, cx - 2, y, hi)

    elif style == 'spiky_gold':
        base, hi = P['gold_m'], P['yellow']
        spikes = [(cx - 5, 4), (cx - 3, 2), (cx - 1, 3), (cx + 1, 2), (cx + 3, 3), (cx + 5, 4)]
        for (sx, sy) in spikes:
            for ty in range(sy - 2, sy + 1):
                px(img, sx, ty, base)
            px(img, sx, sy - 2, hi)
        for y in range(4, 7):
            for x in range(cx - 6, cx + 7):
                dx, dy = x - cx, y - cy
                if (dx * dx) / 49 + (dy * dy) / 49 <= 1.0:
                    px(img, x, y, base)
        for y in range(5, 8):
            px(img, cx - 6, y, base)
            px(img, cx + 6, y, base)
        for y in range(4, 6):
            px(img, cx - 2, y, hi)

    elif style == 'long_silver':
        base, hi = P['steel_l'], P['white']
        # Full head cap
        for y in range(3, 9):
            for x in range(cx - 7, cx + 8):
                dx, dy = x - cx, y - cy
                if (dx * dx) / 49 + (dy * dy) / 49 <= 1.0:
                    px(img, x, y, base)
        # Forehead fringe
        hline(img, cx - 5, cx + 5, 7, base)
        hline(img, cx - 4, cx + 4, 8, base)
        # Long trailing hair (down past shoulders)
        # Behind body — drawn here, will be covered by most layers
        hair_trail_x_off = -2 if pose['body_tilt'] < 0 else (2 if pose['body_tilt'] > 0 else 0)
        for y in range(9, 28):
            for x in range(cx - 8 + hair_trail_x_off, cx - 5 + hair_trail_x_off):
                if 0 <= x < 32:
                    px(img, x, y, base)
            for x in range(cx + 6 + hair_trail_x_off, cx + 9 + hair_trail_x_off):
                if 0 <= x < 32:
                    px(img, x, y, base)
        # Highlight streak
        for y in range(4, 10):
            px(img, cx - 3, y, hi)

    elif style == 'ponytail_blonde':
        base, hi = P['gold_l'], P['yellow']
        # Cap
        for y in range(3, 9):
            for x in range(cx - 7, cx + 8):
                dx, dy = x - cx, y - cy
                if (dx * dx) / 49 + (dy * dy) / 49 <= 1.0:
                    px(img, x, y, base)
        # Fringe
        hline(img, cx - 5, cx + 5, 8, base)
        # Ponytail trailing behind (on the left when facing right)
        # Frame-dependent tail sway
        tail_sway = pose['body_tilt']
        tail_x = cx - 6 + tail_sway
        for y in range(9, 22):
            if 0 <= tail_x < 32:
                px(img, tail_x, y, base)
            if 0 <= tail_x - 1 < 32:
                px(img, tail_x - 1, y, base)
            if 0 <= tail_x + 1 < 32:
                px(img, tail_x + 1, y, hi)
        # Ribbon at base of ponytail
        px(img, cx - 5, 9, P['red_m'])
        px(img, cx - 6, 9, P['red_l'])
        # Highlight
        for y in range(4, 8):
            px(img, cx - 2, y, hi)

    outline_silhouette(img)
    return img


def build_hair_sheet(style):
    return sheet([_hair_frame(style, p) for p in POSES], CELL_W, CELL_H)


# ----------------------------------------------------------------------
# ARMOR OVERLAY — chest/torso piece (shoulders y=14..20, belt line ~32).
# ----------------------------------------------------------------------
def _armor_frame(style, pose):
    img = canvas(CELL_W, CELL_H)
    tilt = pose['body_tilt']
    # The torso area in our base is x=10..22, y=19..33 (approx).
    L = 10 + tilt
    R = 22 + tilt

    def _shade(body_colors, trim=None, extras=None):
        bd, bm, bl = body_colors
        # Main cuirass
        rect(img, L, 19, R, 33, bm)
        # Top neckline (slight V)
        rect(img, L + 4, 19, R - 4, 20, bd)
        # Highlight left edge
        vline(img, L, 19, 33, bl)
        # Shadow right edge
        vline(img, R, 19, 33, bd)
        # Shoulder pauldrons raise above y=19
        # Left pauldron
        ellipse_fill(img, L + 1, 18, 2, 1, bm)
        # Right pauldron
        ellipse_fill(img, R - 1, 18, 2, 1, bm)
        # Belt line
        rect(img, L, 31, R, 32, darken(bd, 15))
        # Belt buckle
        rect(img, 15 + tilt, 31, 17 + tilt, 32, P['gold_m'])
        # Skirt hem
        rect(img, L + 1, 33, R - 1, 34, bd)
        if trim:
            hline(img, L + 1, R - 1, 20, trim)
            hline(img, L + 1, R - 1, 33, trim)
        if extras:
            extras(img, L, R, bd, bm, bl)

    if style == 'cloth_tunic':
        _shade((P['brown_d'], P['tan_m'], P['tan_l']))
        # Stitched neckline
        for x in range(L + 5, R - 4):
            if x % 2 == 0:
                px(img, x, 20, P['brown_d'])

    elif style == 'leather_vest':
        _shade((P['brown_d'], P['brown_m'], P['tan_l']))
        # Straps
        vline(img, L + 3, 20, 32, P['brown_d'])
        vline(img, R - 3, 20, 32, P['brown_d'])
        # Buckles
        px(img, L + 3, 25, P['gold_l'])
        px(img, R - 3, 25, P['gold_l'])

    elif style == 'chain_mail':
        _shade((P['iron_d'], P['iron_m'], P['steel_l']))
        # Ring pattern
        for y in range(20, 33):
            for x in range(L + 1, R):
                if (x + y) % 2 == 0:
                    px(img, x, y, P['iron_d'])

    elif style == 'plate_armor':
        _shade((P['steel_d'], P['steel_m'], P['steel_l']), trim=P['gold_m'])
        # Central plate seam
        vline(img, 16 + tilt, 20, 30, darken(P['steel_m'], 30))
        # Rivets
        for (rx, ry) in [(L + 1, 20), (R - 1, 20), (L + 1, 30), (R - 1, 30),
                         (15 + tilt, 23), (15 + tilt, 28)]:
            px(img, rx, ry, P['gold_l'])

    elif style == 'dragon_scale':
        _shade((P['green_d'], P['green_m'], P['green_l']), trim=P['gold_m'])
        # Scales
        for y in range(20, 32, 2):
            for x in range(L + 1, R, 2):
                px(img, x, y, P['green_d'])
                px(img, x + 1, y, P['green_l'])
        # Shoulder spikes
        px(img, L, 16, P['steel_l'])
        px(img, R, 16, P['steel_l'])
        px(img, L + 1, 15, P['steel_l'])
        px(img, R - 1, 15, P['steel_l'])

    elif style == 'dawnshard_aegis':
        _shade((P['eggshell'], P['steel_l'], P['white']), trim=P['gold_l'])
        # Maple leaf center chest
        leaf = [(15, 24), (16, 24), (17, 24),
                (14, 25), (15, 25), (16, 25), (17, 25), (18, 25),
                (14, 26), (18, 26),
                (15, 27), (16, 27), (17, 27)]
        for (x, y) in leaf:
            px(img, x + tilt, y, P['emerald_l'])
        # Holy glow dots
        px(img, L, 17, P['yellow'])
        px(img, R, 17, P['yellow'])
        # Feathered pauldrons
        for dx in range(-1, 3):
            px(img, L - 1 + dx, 17, P['white'])
            px(img, R - 2 + dx, 17, P['white'])

    outline_silhouette(img)
    return img


def build_armor_sheet(style):
    return sheet([_armor_frame(style, p) for p in POSES], CELL_W, CELL_H)


# ----------------------------------------------------------------------
# CAPE OVERLAY — trails behind body (appears to the left when facing right)
# ----------------------------------------------------------------------
def _cape_frame(style, pose):
    img = canvas(CELL_W, CELL_H)
    tilt = pose['body_tilt']
    hem_x, hem_y = pose['cape_hem']
    cape_tilt = pose['cape_tilt']
    is_jump = pose is POSES[3]

    colors = {
        'wine_red':  (P['red_d'], P['crimson'], P['crimson_l']),
        'royal_blue':(P['navy'], P['blue_m'], P['blue_l']),
        'dawnshard': (P['orange_d'], P['gold_m'], P['gold_l']),
    }
    cd, cm, cl = colors[style]

    # Collar attaches at shoulders y=16-17
    collar_cx = 16 + tilt
    # Cape body: trapezoid from collar (width 8) down to hem (width ~14)
    for y in range(16, hem_y + 1):
        t = (y - 16) / max(1, (hem_y - 16))  # 0..1
        half_w = int(4 + t * 3)
        # Tilt drift: cape x shifts with cape_tilt
        cx_at_y = collar_cx + int(cape_tilt * t * 2)
        if is_jump:
            # Cape flared up — render behind the character at top
            cx_at_y -= int(1 * t)
        # Fill row
        for x in range(cx_at_y - half_w, cx_at_y + half_w + 1):
            if 0 <= x < 32:
                px(img, x, y, cm)
        # Left highlight
        if cx_at_y - half_w >= 0:
            px(img, cx_at_y - half_w, y, cl)
        # Right shadow
        if cx_at_y + half_w < 32:
            px(img, cx_at_y + half_w, y, cd)

    # Collar trim
    rect(img, collar_cx - 4, 15, collar_cx + 4, 16, P['gold_m'])
    px(img, collar_cx, 15, P['gold_l'])

    if style == 'dawnshard':
        # Small emerald leaf emblem on cape
        px(img, collar_cx, 22, P['emerald_l'])
        px(img, collar_cx - 1, 23, P['emerald_l'])
        px(img, collar_cx + 1, 23, P['emerald_l'])
        px(img, collar_cx, 24, P['emerald'])

    # Tattered lower hem
    for x in range(0, 32):
        if not (0 <= hem_y < 48):
            continue
        # Only draw hem on cape pixels
        if img.getpixel((x, hem_y))[3] > 0:
            if x % 3 == 0:
                px(img, x, hem_y + 1 if hem_y + 1 < 48 else hem_y, cd)

    outline_silhouette(img)
    return img


def build_cape_sheet(style):
    return sheet([_cape_frame(style, p) for p in POSES], CELL_W, CELL_H)


# ----------------------------------------------------------------------
# HELMET OVERLAY — sits on top of head
# ----------------------------------------------------------------------
def _helmet_frame(style, pose):
    img = canvas(CELL_W, CELL_H)
    tilt = pose['body_tilt']
    hy = pose['head_y_off']
    cx, cy = 16 + tilt, 10 + hy

    if style == 'iron_cap':
        base, hi = P['iron_m'], P['iron_l']
        # Dome cap
        for y in range(3, 8):
            for x in range(cx - 6, cx + 7):
                dx, dy = x - cx, y - cy
                if (dx * dx) / 49 + (dy * dy) / 49 <= 1.0 and y - cy < -2:
                    px(img, x, y, base)
        # Brim line
        hline(img, cx - 7, cx + 7, 7, P['iron_d'])
        hline(img, cx - 6, cx + 6, 8, base)
        # Highlight
        for y in range(4, 7):
            px(img, cx - 3, y, hi)

    elif style == 'knight_plume':
        base, hi = P['steel_m'], P['steel_l']
        # Full helmet covering forehead
        for y in range(3, 9):
            for x in range(cx - 6, cx + 7):
                dx, dy = x - cx, y - cy
                if (dx * dx) / 49 + (dy * dy) / 49 <= 1.0:
                    px(img, x, y, base)
        # Visor slit (horizontal cross)
        hline(img, cx - 3, cx + 3, 7, P['black'])
        px(img, cx, 5, P['black'])
        px(img, cx, 6, P['black'])
        # Rivets
        px(img, cx - 5, 5, P['gold_l'])
        px(img, cx + 5, 5, P['gold_l'])
        # Tall blue plume on top
        for y in range(0, 4):
            px(img, cx - 1, y, P['blue_m'])
            px(img, cx, y, P['blue_l'])
            px(img, cx + 1, y, P['blue_m'])
        # Highlight streak on visor dome
        for y in range(4, 6):
            px(img, cx - 3, y, hi)

    elif style == 'dawnshard_crown':
        base, hi = P['gold_m'], P['yellow']
        # Crown band
        hline(img, cx - 6, cx + 6, 6, base)
        hline(img, cx - 6, cx + 6, 7, base)
        # Spikes
        for sx in (cx - 5, cx - 2, cx + 1, cx + 4):
            for sy in range(3, 6):
                px(img, sx, sy, base)
            px(img, sx, 3, hi)
        # Central tall spike w/ gem
        px(img, cx - 1, 2, base)
        px(img, cx, 1, base)
        px(img, cx + 1, 2, base)
        px(img, cx, 2, P['emerald_l'])
        # Gems inset in band
        px(img, cx - 3, 6, P['ruby'])
        px(img, cx + 3, 6, P['sapphire'])

    outline_silhouette(img)
    return img


def build_helmet_sheet(style):
    return sheet([_helmet_frame(style, p) for p in POSES], CELL_W, CELL_H)


# ----------------------------------------------------------------------
# SHIELD OVERLAY — in LEFT hand
# ----------------------------------------------------------------------
def _shield_frame(style, pose):
    img = canvas(CELL_W, CELL_H)
    lhx, lhy = pose['l_hand']
    # Shield centered on left hand
    if style == 'wooden':
        # Round wooden buckler
        circle_fill(img, lhx, lhy, 4, P['brown_m'])
        circle_fill(img, lhx - 1, lhy - 1, 3, P['brown_l'])
        # Iron boss
        px(img, lhx, lhy, P['iron_m'])
        px(img, lhx, lhy - 1, P['iron_l'])
        # Rim
        circle_outline(img, lhx, lhy, 4, P['iron_d'])

    elif style == 'iron':
        # Round steel shield
        circle_fill(img, lhx, lhy, 5, P['steel_m'])
        circle_fill(img, lhx - 1, lhy - 1, 3, P['steel_l'])
        circle_outline(img, lhx, lhy, 5, P['iron_d'])
        # Boss stud
        px(img, lhx, lhy, P['gold_m'])

    elif style == 'knight_kite':
        # Kite shield (teardrop)
        # Top wider, bottom tapering to a point
        for y in range(-3, 7):
            half_w = max(0, 4 - abs(y - 1) // 2)
            for x in range(-half_w, half_w + 1):
                nx, ny = lhx + x, lhy + y
                if 0 <= nx < 32 and 0 <= ny < 48:
                    px(img, nx, ny, P['steel_m'])
        # Highlight top-left
        for dy in range(-3, 1):
            nx, ny = lhx - 2, lhy + dy
            if 0 <= nx < 32 and 0 <= ny < 48:
                px(img, nx, ny, P['steel_l'])
        # Cross emblem (red)
        vline(img, lhx, lhy - 2, lhy + 4, P['red_m'])
        hline(img, lhx - 2, lhx + 2, lhy + 1, P['red_m'])
        # Gold rim
        px(img, lhx - 4, lhy + 1, P['gold_m'])
        px(img, lhx + 4, lhy + 1, P['gold_m'])
        px(img, lhx, lhy - 3, P['gold_m'])
        px(img, lhx, lhy + 6, P['gold_m'])

    outline_silhouette(img)
    return img


def build_shield_sheet(style):
    return sheet([_shield_frame(style, p) for p in POSES], CELL_W, CELL_H)


# ----------------------------------------------------------------------
# WEAPON OVERLAY — in RIGHT hand. Position + orientation depend on pose.
# ----------------------------------------------------------------------
def _weapon_frame(style, pose):
    img = canvas(CELL_W, CELL_H)
    rhx, rhy = pose['r_hand']
    wp = pose['weapon_pose']

    # Pick colors per weapon
    COLORS = {
        'sword_wood':     (P['brown_d'], P['brown_m'], P['brown_l']),  # "blade" is also brown
        'sword_iron':     (P['iron_d'], P['iron_m'], P['iron_l']),
        'sword_steel':    (P['steel_d'], P['steel_m'], P['steel_l']),
        'sword_runed':    (P['steel_d'], P['steel_l'], P['cyan_l']),
        'sword_katana':   (P['iron_m'], P['iron_l'], P['purple_l']),
        'sword_dawnshard':(P['emerald'], P['emerald_l'], P['white']),
    }
    bd, bm, bl = COLORS[style]
    guard = P['gold_m'] if 'dawnshard' in style or 'steel' in style or 'runed' in style else P['brown_m']
    if style == 'sword_katana':
        guard = P['gold_m']
    grip = P['brown_m'] if 'dawnshard' not in style else P['gold_m']

    def draw_sword(grip_x, grip_y, dir_x, dir_y, length=14):
        """Draw a sword with grip at (gx, gy), extending in direction (dx, dy)."""
        # Normalize direction
        import math
        mag = math.hypot(dir_x, dir_y) or 1.0
        dx = dir_x / mag
        dy = dir_y / mag
        # Perpendicular vector for guard thickness
        pxv, pyv = -dy, dx
        # Blade: from grip along (dx, dy) for `length` pixels
        for i in range(2, length):
            x = int(round(grip_x + dx * i))
            y = int(round(grip_y + dy * i))
            if 0 <= x < 32 and 0 <= y < 48:
                px(img, x, y, bm)
                # Center highlight
                x2 = int(round(grip_x + dx * i - pxv))
                y2 = int(round(grip_y + dy * i - pyv))
                if 0 <= x2 < 32 and 0 <= y2 < 48:
                    px(img, x2, y2, bl)
                # Far edge shadow
                x3 = int(round(grip_x + dx * i + pxv))
                y3 = int(round(grip_y + dy * i + pyv))
                if 0 <= x3 < 32 and 0 <= y3 < 48:
                    px(img, x3, y3, bd)
        # Tip highlight
        tip_x = int(round(grip_x + dx * length))
        tip_y = int(round(grip_y + dy * length))
        if 0 <= tip_x < 32 and 0 <= tip_y < 48:
            px(img, tip_x, tip_y, bl)
        # Guard: perpendicular bar at grip
        for i in range(-2, 3):
            gx = int(round(grip_x + pxv * i))
            gy = int(round(grip_y + pyv * i))
            if 0 <= gx < 32 and 0 <= gy < 48:
                px(img, gx, gy, guard)
        # Grip wrap: below grip_x along opposite dir
        for i in range(1, 4):
            gx = int(round(grip_x - dx * i))
            gy = int(round(grip_y - dy * i))
            if 0 <= gx < 32 and 0 <= gy < 48:
                px(img, gx, gy, grip)
        # Pommel
        pm_x = int(round(grip_x - dx * 4))
        pm_y = int(round(grip_y - dy * 4))
        if 0 <= pm_x < 32 and 0 <= pm_y < 48:
            px(img, pm_x, pm_y, P['gold_l'] if style == 'sword_dawnshard' else P['iron_l'])

    # Orientation by pose
    if wp == 'down_side':
        draw_sword(rhx, rhy, 0, 1, length=12)       # pointing down
    elif wp == 'sway_back':
        draw_sword(rhx, rhy, -0.3, 1, length=12)    # down-slightly-back
    elif wp == 'sway_forward':
        draw_sword(rhx, rhy, 0.3, 1, length=12)
    elif wp == 'raised_back':
        draw_sword(rhx, rhy, 0.5, -1, length=13)    # up-forward
    elif wp == 'overhead':
        draw_sword(rhx, rhy, 0, -1, length=13)      # straight up
    elif wp == 'forward_low':
        draw_sword(rhx, rhy, -1, 0.1, length=14)    # forward-swept

    # Weapon-specific embellishments
    if style == 'sword_runed':
        # Blue runic dots along the blade — we'll just sprinkle on existing blade pixels
        for x in range(32):
            for y in range(48):
                pxv = img.getpixel((x, y))
                if pxv == bm and ((x + y) % 5 == 0):
                    px(img, x, y, P['cyan_l'])
    elif style == 'sword_katana':
        # Purple mist trail
        for x in range(32):
            for y in range(48):
                pxv = img.getpixel((x, y))
                if pxv == bm:
                    # Add purple tint next to some pixels
                    if (x * 3 + y) % 7 == 0 and y > 0:
                        px(img, x, y - 1, P['purple_l'])
    elif style == 'sword_dawnshard':
        # Leaf particle sparkles
        sparkles = [(rhx - 2, rhy - 5), (rhx + 3, rhy - 2), (rhx + 1, rhy - 9)]
        for (sx, sy) in sparkles:
            if 0 <= sx < 32 and 0 <= sy < 48:
                px(img, sx, sy, P['emerald_l'])

    outline_silhouette(img)
    return img


def build_weapon_sheet(style):
    return sheet([_weapon_frame(style, p) for p in POSES], CELL_W, CELL_H)


# ----------------------------------------------------------------------
# BOOTS OVERLAY — replace default brown boots at feet
# ----------------------------------------------------------------------
def _boots_frame(style, pose):
    img = canvas(CELL_W, CELL_H)
    r_foot = pose['r_foot']
    l_foot = pose['l_foot']
    COLORS = {
        'leather':  (P['brown_d'], P['brown_m'], P['tan_l']),
        'plate':    (P['iron_d'], P['steel_m'], P['steel_l']),
        'dawnshard':(P['gold_d'], P['gold_m'], P['yellow']),
    }
    bd, bm, bl = COLORS[style]
    for foot in (r_foot, l_foot):
        fx, fy = foot
        # Boot body (slightly taller than base boots)
        rect(img, fx - 2, fy - 3, fx + 2, fy, bm)
        # Highlight top-left
        hline(img, fx - 2, fx + 2, fy - 3, bl)
        vline(img, fx - 2, fy - 3, fy, bl)
        # Shadow bottom
        hline(img, fx - 2, fx + 2, fy, bd)
        # Sole
        rect(img, fx - 2, fy, fx + 2, fy, bd)
        if style == 'plate':
            # Gold rivets
            px(img, fx - 1, fy - 2, P['gold_l'])
            px(img, fx + 1, fy - 2, P['gold_l'])
        elif style == 'dawnshard':
            # White radiant stripe
            px(img, fx, fy - 2, P['white'])
            px(img, fx - 1, fy - 1, P['emerald_l'])
    outline_silhouette(img)
    return img


def build_boots_sheet(style):
    return sheet([_boots_frame(style, p) for p in POSES], CELL_W, CELL_H)


# ----------------------------------------------------------------------
# DISPATCH — save everything
# ----------------------------------------------------------------------
def main():
    # Bases
    save(build_base_sheet('m'), f'{OUT}/base_male.png')
    save(build_base_sheet('f'), f'{OUT}/base_female.png')

    # Hair
    for s in ['spiky_brown', 'spiky_gold', 'long_silver', 'ponytail_blonde']:
        save(build_hair_sheet(s), f'{OUT}/overlays/hair/{s}.png')

    # Armor
    for s in ['cloth_tunic', 'leather_vest', 'chain_mail',
              'plate_armor', 'dragon_scale', 'dawnshard_aegis']:
        save(build_armor_sheet(s), f'{OUT}/overlays/armor/{s}.png')

    # Cape
    for s in ['wine_red', 'royal_blue', 'dawnshard']:
        save(build_cape_sheet(s), f'{OUT}/overlays/cape/{s}.png')

    # Helmet
    for s in ['iron_cap', 'knight_plume', 'dawnshard_crown']:
        save(build_helmet_sheet(s), f'{OUT}/overlays/helmet/{s}.png')

    # Shield
    for s in ['wooden', 'iron', 'knight_kite']:
        save(build_shield_sheet(s), f'{OUT}/overlays/shield/{s}.png')

    # Weapon
    for s in ['sword_wood', 'sword_iron', 'sword_steel',
              'sword_runed', 'sword_katana', 'sword_dawnshard']:
        save(build_weapon_sheet(s), f'{OUT}/overlays/weapon/{s}.png')

    # Boots
    for s in ['leather', 'plate', 'dawnshard']:
        save(build_boots_sheet(s), f'{OUT}/overlays/boots/{s}.png')

    print('character done ->', OUT)


if __name__ == '__main__':
    main()
