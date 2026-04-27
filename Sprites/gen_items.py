"""Generate items & pickups for LevelX.

Outputs (all transparent PNG):
  sprites/items/potion_hp.png         (12x16)
  sprites/items/potion_mp.png         (12x16)
  sprites/items/potion_orange.png     (12x16)
  sprites/items/potion_elixir.png     (12x16)
  sprites/items/coin.png              (48x12, 4 frames of 12x12)
  sprites/items/chest_wood_closed.png (28x24)
  sprites/items/chest_wood_open.png   (28x24)
  sprites/items/chest_silver_*.png
  sprites/items/chest_gold_*.png
  sprites/items/orb_common.png        (26x26)
  sprites/items/orb_rare.png
  sprites/items/orb_epic.png
  sprites/items/orb_legendary.png
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixart import (P, canvas, px, rect, hline, vline, line,
                    circle_fill, circle_outline, ellipse_fill,
                    outline_silhouette, lighten, darken, save, sheet)

OUT = '/sessions/friendly-compassionate-albattani/mnt/LevelX/sprites/items'


# ----------------------------------------------------------------------
# POTIONS — 12x16
# ----------------------------------------------------------------------
def make_potion(liquid_colors, shimmer=False):
    """liquid_colors: (dark, mid, light)."""
    img = canvas(12, 16)
    ld, lm, ll = liquid_colors

    # Cork (top, brown)
    rect(img, 4, 0, 7, 2, P['brown_m'])
    rect(img, 4, 0, 7, 0, P['brown_l'])   # highlight
    rect(img, 4, 2, 7, 2, P['brown_d'])   # shadow

    # Bottle neck (narrow)
    rect(img, 4, 3, 7, 5, P['cyan_l'])    # glass neck
    rect(img, 4, 3, 4, 5, P['white'])     # neck highlight

    # Bottle body — rounded flask shape
    # Row y=6: shoulders widen
    rect(img, 3, 6, 8, 6, P['cyan_l'])
    # Row y=7-14: full body
    rect(img, 2, 7, 9, 14, P['cyan_l'])
    # Row y=15: rounded bottom
    rect(img, 3, 15, 8, 15, P['cyan_l'])

    # Liquid fill inside the bottle (inset by 1 pixel from the glass outline)
    # Leave top of liquid around y=8 so there's airspace + meniscus
    rect(img, 3, 9, 8, 13, lm)   # mid tone
    rect(img, 3, 14, 8, 14, ld)  # shadow at bottom
    rect(img, 4, 15, 7, 15, ld)
    rect(img, 3, 8, 8, 8, lm)    # meniscus line
    # Liquid highlight on left
    rect(img, 3, 10, 3, 12, ll)
    px(img, 4, 9, ll)

    # Bubble dots inside liquid
    px(img, 6, 11, P['white'])
    px(img, 7, 13, lighten(ll, 20))

    # Glass highlight on the left side of body (vertical bright strip)
    vline(img, 2, 7, 13, P['white'])
    px(img, 3, 6, P['white'])

    # Glass right edge shadow
    vline(img, 9, 7, 13, darken(P['cyan_d'], 10))

    if shimmer:
        # Rainbow shimmer dots for elixir
        px(img, 5, 10, P['yellow'])
        px(img, 7, 11, P['cyan_l'])
        px(img, 4, 13, P['purple_l'])
        px(img, 6, 12, P['green_l'])

    outline_silhouette(img)
    return img


def gen_potions():
    potions = [
        ('potion_hp',     (P['red_d'], P['red_m'], P['red_l']),      False),
        ('potion_mp',     (P['blue_d'], P['blue_m'], P['blue_l']),   False),
        ('potion_orange', (P['orange_d'], P['orange_m'], P['orange_l']), False),
        ('potion_elixir', (P['purple_d'], P['magenta'], P['cyan_l']), True),
    ]
    for name, colors, shimmer in potions:
        img = make_potion(colors, shimmer=shimmer)
        save(img, f'{OUT}/{name}.png')


# ----------------------------------------------------------------------
# GOLD COIN — 12x12 per frame, 4 rotation frames → 48x12 sheet
# ----------------------------------------------------------------------
def make_coin_frame(ratio, emboss_char=True):
    """ratio: horizontal scale [0..1] — 1 = face-on, 0 = edge-on."""
    img = canvas(12, 12)
    rx = max(1, int(round(5 * ratio)))
    cx, cy = 6, 6
    # Gold body
    ellipse_fill(img, cx, cy, rx, 5, P['gold_m'])
    if rx >= 2:
        # Inner highlight
        ellipse_fill(img, cx - 1, cy - 1, max(1, rx - 2), 3, P['gold_l'])
    # Bottom rim shadow
    if rx >= 2:
        ellipse_fill(img, cx, cy + 1, rx, 4, P['gold_d'])
        ellipse_fill(img, cx, cy, rx, 4, P['gold_m'])
        ellipse_fill(img, cx - 1, cy - 1, max(1, rx - 2), 2, P['gold_l'])
    # Emboss: a small maple-leaf-ish "$" — only visible face-on
    if emboss_char and ratio > 0.85:
        px(img, cx, cy - 2, P['gold_d'])
        px(img, cx, cy - 1, P['gold_d'])
        px(img, cx - 1, cy, P['gold_d'])
        px(img, cx + 1, cy, P['gold_d'])
        px(img, cx, cy + 1, P['gold_d'])
        px(img, cx, cy + 2, P['gold_d'])
    elif emboss_char and ratio > 0.4:
        # Slight curve as it rotates
        vline(img, cx, cy - 2, cy + 2, P['gold_d'])
    # Edge-on: just a vertical dark line
    if ratio < 0.2:
        vline(img, cx, cy - 5, cy + 5, P['gold_d'])
        for y in range(cy - 3, cy + 4):
            px(img, cx, y, P['gold_m'])
    outline_silhouette(img)
    return img


def gen_coin():
    frames = [
        make_coin_frame(1.00),
        make_coin_frame(0.55),
        make_coin_frame(0.10),
        make_coin_frame(0.55),
    ]
    s = sheet(frames, 12, 12)
    save(s, f'{OUT}/coin.png')


# ----------------------------------------------------------------------
# CHEST — 28x24, closed & open states
# ----------------------------------------------------------------------
def make_chest(wood, metal, gem, glow_rgb=None, opened=False, lock_color=None):
    """wood: (dk,mid,lt) tuple. metal: (dk,mid,lt). gem: rgba."""
    img = canvas(28, 24)
    wd, wm, wl = wood
    md, mm, ml = metal
    lock = lock_color or md

    # --- Chest BASE (bottom half) 0..27 x, 10..22 y ---
    # Base box
    rect(img, 1, 12, 26, 22, wm)        # mid wood
    # Wood planks — vertical darker seams at x=7, 14, 21
    for sx in (7, 14, 21):
        vline(img, sx, 12, 22, wd)
    # Top rim of base (gets a highlight)
    hline(img, 1, 26, 12, wl)
    # Base bottom shadow
    hline(img, 1, 22, 22, wd)
    # Metal bands vertical on base
    for sx in (4, 23):
        vline(img, sx, 12, 22, mm)
        px(img, sx, 12, ml)
        px(img, sx, 22, md)
    # Metal feet
    rect(img, 0, 21, 2, 22, md)
    rect(img, 25, 21, 27, 22, md)

    # --- Chest LID (top half) ---
    if not opened:
        # Closed lid: arch from y=2 to y=11
        # Rounded top — rows get narrower toward y=2
        lid_rows = [
            (5, 22),   # y=2
            (4, 23),   # y=3
            (3, 24),   # y=4
            (2, 25),   # y=5
            (1, 26),   # y=6
            (1, 26),   # y=7
            (1, 26),   # y=8
            (1, 26),   # y=9
            (1, 26),   # y=10
            (1, 26),   # y=11
        ]
        for i, (x0, x1) in enumerate(lid_rows):
            y = 2 + i
            rect(img, x0, y, x1, y, wm)
            # Top highlight row
            if i < 3:
                rect(img, x0, y, x1, y, wl)
            # Bottom-row shadow just above base
            if i == len(lid_rows) - 1:
                rect(img, x0, y, x1, y, wd)
        # Wood planks (vertical) on lid
        for sx in (7, 14, 21):
            for y in range(4, 11):
                if sx == 14 or (3 <= (sx - 14) + 14 < 26):
                    px(img, sx, y, wd)
        # Metal bands on lid (vertical continuations of base bands)
        for sx in (4, 23):
            for y in range(3, 12):
                px(img, sx, y, mm)
        # Center lock + keyhole
        rect(img, 12, 9, 15, 14, lock)
        rect(img, 12, 9, 15, 9, lighten(lock, 40))
        rect(img, 12, 14, 15, 14, darken(lock, 40))
        # Keyhole
        px(img, 13, 11, P['black'])
        px(img, 14, 11, P['black'])
        px(img, 13, 12, P['black'])
        # Small gem centerpiece on top of lid
        px(img, 13, 4, gem)
        px(img, 14, 4, lighten(gem, 50))
        px(img, 13, 5, darken(gem, 40))
        px(img, 14, 5, gem)
    else:
        # Open: lid tipped backward. Inside glow visible.
        # Draw a small tilted lid behind (top-left area)
        rect(img, 2, 0, 24, 3, wm)
        rect(img, 2, 0, 24, 0, wl)
        rect(img, 2, 3, 24, 3, wd)
        # Underside of lid (darker)
        rect(img, 3, 4, 23, 6, wd)
        # Interior glow
        if glow_rgb is None:
            glow_rgb = (P['yellow'], P['gold_l'], P['gold_m'])
        gl, gm, gd = glow_rgb
        # Opening of chest — top of base becomes hollow
        rect(img, 2, 10, 25, 11, gd)
        rect(img, 3, 10, 24, 10, gm)
        rect(img, 4, 10, 23, 10, gl)
        # Inside has coins/sparkle dots
        for (sx, sy) in [(8, 11), (12, 12), (18, 11), (15, 13), (21, 12)]:
            px(img, sx, sy, P['yellow'])

    outline_silhouette(img)
    return img


def gen_chests():
    # Wood chest
    wood_set = (P['brown_d'], P['brown_m'], P['brown_l'])
    iron_set = (P['iron_d'], P['iron_m'], P['iron_l'])
    save(make_chest(wood_set, iron_set, P['gold_m'], opened=False,
                    lock_color=P['gold_m']),
         f'{OUT}/chest_wood_closed.png')
    save(make_chest(wood_set, iron_set, P['gold_m'], opened=True,
                    lock_color=P['gold_m']),
         f'{OUT}/chest_wood_open.png')

    # Silver chest (polished silver metal + blue gems + chrome lock)
    silver_wood = (P['grey_d'], P['grey_m'], P['grey_l'])  # "pale silver wood" — we'll use grey
    silver_set = (P['steel_d'], P['steel_m'], P['steel_l'])
    save(make_chest(silver_wood, silver_set, P['sapphire'], opened=False,
                    lock_color=P['steel_l']),
         f'{OUT}/chest_silver_closed.png')
    save(make_chest(silver_wood, silver_set, P['sapphire'], opened=True,
                    glow_rgb=(P['cyan_l'], P['blue_l'], P['blue_m']),
                    lock_color=P['steel_l']),
         f'{OUT}/chest_silver_open.png')

    # Gold chest (bright gold metal + ruby gems + ornate gold lock)
    gold_wood = (P['gold_d'], P['gold_m'], P['gold_l'])
    gold_set = (P['gold_d'], P['gold_m'], P['gold_l'])
    save(make_chest(gold_wood, gold_set, P['ruby'], opened=False,
                    lock_color=P['gold_l']),
         f'{OUT}/chest_gold_closed.png')
    save(make_chest(gold_wood, gold_set, P['ruby'], opened=True,
                    glow_rgb=(P['white'], P['yellow'], P['orange_l']),
                    lock_color=P['gold_l']),
         f'{OUT}/chest_gold_open.png')


# ----------------------------------------------------------------------
# POWERUP ORB — 26x26, 4 rarities
# ----------------------------------------------------------------------
def make_orb(core_colors, aura_rgb, stars_color, flame=False):
    """core_colors: (dk, mid, lt) for sphere body.
       aura_rgb: single color for swirling halo.
       stars_color: color for orbiting dots."""
    img = canvas(26, 26)
    cx, cy = 13, 13

    # Aura outer swirl — drawn as a few arcs around the orb
    r_outer = 11
    for angle_deg in range(0, 360, 8):
        import math
        ang = math.radians(angle_deg)
        # Main aura ring: every other pixel along a ring of radius 10-11
        rr = r_outer - (angle_deg % 2)
        ox = cx + int(round(rr * math.cos(ang)))
        oy = cy + int(round(rr * math.sin(ang)))
        if 0 <= ox < 26 and 0 <= oy < 26:
            # Only draw sparse aura dots
            if angle_deg % 16 == 0:
                px(img, ox, oy, aura_rgb)

    # Core sphere (radius 7)
    cd, cm, cl = core_colors
    circle_fill(img, cx, cy, 7, cm)
    circle_fill(img, cx - 1, cy - 2, 5, cl)   # highlight upper-left
    circle_fill(img, cx - 2, cy - 3, 3, lighten(cl, 30))
    # Bottom-right shadow band
    for dy in range(4, 8):
        for dx in range(4, 8):
            if dx * dx + dy * dy <= 7 * 7 and dx * dx + dy * dy > 5 * 5:
                px(img, cx + dx - 3, cy + dy - 3, cd)

    # Tiny inner spark (pure white star)
    px(img, cx - 2, cy - 2, P['white'])
    px(img, cx - 3, cy - 2, P['white'])
    px(img, cx - 2, cy - 3, P['white'])

    # Four orbiting stars at cardinal points (offset slightly)
    star_positions = [(cx, 1), (25, cy), (cx, 25), (0, cy)]
    for (sx, sy) in star_positions:
        # Tiny 4-point star
        px(img, sx, sy, stars_color)
        if 0 < sx < 25: px(img, sx - 1, sy, stars_color)
        if 0 < sx < 25: px(img, sx + 1, sy, stars_color)
        if 0 < sy < 25: px(img, sx, sy - 1, stars_color)
        if 0 < sy < 25: px(img, sx, sy + 1, stars_color)

    if flame:
        # Flame wisps around the top — orange flickers
        px(img, cx - 3, 4, P['orange_l'])
        px(img, cx - 2, 3, P['yellow'])
        px(img, cx - 1, 2, P['orange_m'])
        px(img, cx + 2, 3, P['orange_l'])
        px(img, cx + 4, 4, P['orange_m'])

    # Outline the core only (not the aura)
    # Quick hack: outline_silhouette will outline everything that's opaque,
    # but our aura dots are isolated pixels and we don't want them outlined.
    # So we skip outline_silhouette and rely on the 2-tone shading to define
    # the sphere's edge.
    return img


def gen_orbs():
    orbs = [
        ('orb_common',    (P['grey_d'], P['grey_l'], P['white']),       P['white']),
        ('orb_rare',      (P['blue_d'], P['blue_m'], P['blue_l']),      P['cyan_l']),
        ('orb_epic',      (P['purple_d'], P['purple_m'], P['purple_l']),P['magenta']),
        ('orb_legendary', (P['orange_d'], P['gold_m'], P['gold_l']),    P['yellow']),
    ]
    for (name, core, stars) in orbs:
        flame = (name == 'orb_legendary')
        aura = {
            'orb_common':    P['grey_l'],
            'orb_rare':      P['sapphire'],
            'orb_epic':      P['amethyst'],
            'orb_legendary': P['orange_l'],
        }[name]
        img = make_orb(core, aura, stars, flame=flame)
        save(img, f'{OUT}/{name}.png')


if __name__ == '__main__':
    gen_potions()
    gen_coin()
    gen_chests()
    gen_orbs()
    print('items done ->', OUT)
