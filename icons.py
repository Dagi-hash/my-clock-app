"""
Draws the Flip Clock icon (light-theme colours: cream -> peach background, navy dial,
crimson second hand with a glowing dot, soft floating shadows).
Run from inside the www folder:  cd www && python3 ../icons.py
"""
import math
from PIL import Image, ImageDraw, ImageFilter

NAVY = (24, 26, 47)
CREAM = (255, 240, 230)
PEACH_TOP = (255, 232, 216)
PEACH_BOTTOM = (253, 164, 129)
CRIMSON = (180, 24, 45)
BURGUNDY = (84, 22, 43)


def shadow_of(layer, S, blur, dx, dy, color, opacity):
    """soft drop shadow of an RGBA layer (offset in px)"""
    alpha = layer.split()[3].point(lambda v: int(v * opacity))
    sh = Image.new('RGBA', (S, S), color + (0,))
    sh.putalpha(alpha)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    out.paste(sh, (dx, dy))
    return out


def make(size, scale, path):
    S = 2048
    bg = Image.new('RGB', (S, S))
    d = ImageDraw.Draw(bg)
    for y in range(S):
        t = y / (S - 1)
        d.line([(0, y), (S, y)], fill=tuple(int(PEACH_TOP[i] * (1 - t) + PEACH_BOTTOM[i] * t) for i in range(3)))
    im = bg.convert('RGBA')
    cx = cy = S / 2
    R = S * 0.40 * scale
    k = scale

    # translucent glass dial
    disc = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(disc).ellipse([cx - R, cy - R, cx + R, cy + R], fill=(255, 255, 255, 84),
                                 outline=(255, 255, 255, 200), width=max(2, int(S * 0.006 * k)))
    im = Image.alpha_composite(im, disc)

    # 60 dots, bigger on the 5-minute marks
    dots = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    dd = ImageDraw.Draw(dots)
    for i in range(60):
        a = math.radians(i * 6 - 90)
        big = i % 5 == 0
        r = S * (0.0105 if big else 0.0052) * k
        x, y = cx + R * 0.86 * math.cos(a), cy + R * 0.86 * math.sin(a)
        dd.ellipse([x - r, y - r, x + r, y + r], fill=NAVY + ((255 if big else 110),))
    im = Image.alpha_composite(im, dots)

    def hand_layer(angle, length, width, tail, color):
        layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        dr = ImageDraw.Draw(layer)
        a = math.radians(angle - 90)
        x2, y2 = cx + length * math.cos(a), cy + length * math.sin(a)
        x1, y1 = cx - tail * math.cos(a), cy - tail * math.sin(a)
        dr.line([(x1, y1), (x2, y2)], fill=color + (255,), width=int(width))
        for x, y in ((x1, y1), (x2, y2)):
            dr.ellipse([x - width / 2, y - width / 2, x + width / 2, y + width / 2], fill=color + (255,))
        return layer

    # hour + minute hands (10:10) with a floating shadow
    hm = Image.alpha_composite(hand_layer(305, R * 0.50, S * 0.040 * k, R * 0.06, NAVY),
                               hand_layer(62, R * 0.76, S * 0.030 * k, R * 0.06, NAVY))
    im = Image.alpha_composite(im, shadow_of(hm, S, S * 0.013 * k, int(S * 0.012 * k), int(S * 0.028 * k), BURGUNDY, 0.55))
    im = Image.alpha_composite(im, hm)

    # second hand + glowing dot (higher, so a bigger shadow)
    sec_angle = 148
    sec = hand_layer(sec_angle, R * 0.86, S * 0.010 * k, R * 0.16, CRIMSON)
    im = Image.alpha_composite(im, shadow_of(sec, S, S * 0.018 * k, int(S * 0.018 * k), int(S * 0.040 * k), BURGUNDY, 0.45))
    im = Image.alpha_composite(im, sec)
    a = math.radians(sec_angle - 90)
    gx, gy = cx + R * 0.86 * math.cos(a), cy + R * 0.86 * math.sin(a)
    glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    gr = S * 0.045 * k
    ImageDraw.Draw(glow).ellipse([gx - gr, gy - gr, gx + gr, gy + gr], fill=CRIMSON + (200,))
    im = Image.alpha_composite(im, glow.filter(ImageFilter.GaussianBlur(S * 0.022 * k)))
    dot = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    dr = S * 0.02 * k
    ImageDraw.Draw(dot).ellipse([gx - dr, gy - dr, gx + dr, gy + dr], fill=CRIMSON + (255,))
    ImageDraw.Draw(dot).ellipse([gx - dr * 0.45, gy - dr * 0.45, gx + dr * 0.45, gy + dr * 0.45], fill=CREAM + (255,))
    im = Image.alpha_composite(im, dot)

    # hub
    hub = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    hr = S * 0.026 * k
    ImageDraw.Draw(hub).ellipse([cx - hr, cy - hr, cx + hr, cy + hr], fill=CREAM + (255,), outline=NAVY + (255,), width=int(S * 0.008 * k))
    im = Image.alpha_composite(im, hub)

    im.convert('RGB').resize((size, size), Image.LANCZOS).save(path)


make(192, 1.0, 'icons/icon-192.png')
make(512, 1.0, 'icons/icon-512.png')
make(512, 0.80, 'icons/maskable-512.png')      # smaller dial = stays inside the round/squircle mask
make(180, 1.0, 'icons/apple-touch-icon.png')
make(32, 1.0, 'icons/favicon-32.png')
