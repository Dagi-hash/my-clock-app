import math
from PIL import Image, ImageDraw, ImageChops

# Default theme palette: Midnight Navy #041B4A  +  Pearl Cream #F8F0E1
NAVY, NAVY_FACE, CREAM, SOFT, SLATE = (4, 27, 74), (6, 35, 92), (248, 240, 225), (170, 186, 222), (110, 132, 184)
S = 2048

def gradient_bg():
    """Midnight navy diagonal gradient, full bleed (the launcher applies its own mask)."""
    g = Image.linear_gradient('L').resize((S, S))
    d = ImageChops.add(g, g.transpose(Image.TRANSPOSE), scale=2)
    top, bottom = Image.new('RGB', (S, S), (14, 48, 122)), Image.new('RGB', (S, S), (2, 12, 38))
    return Image.composite(bottom, top, d)

def thick_line(d, p1, p2, width, fill):
    d.line([p1, p2], fill=fill, width=int(width))
    r = width / 2
    for x, y in (p1, p2):
        d.ellipse([x - r, y - r, x + r, y + r], fill=fill)

def make(size, scale, path):
    im = gradient_bg()
    d = ImageDraw.Draw(im)
    cx = S / 2
    R = 600 * scale
    fy = S / 2 + 70 * scale

    # bells
    for sgn in (-1, 1):
        a = math.radians(42)
        bx = cx + sgn * (R + 75 * scale) * math.sin(a)
        by = fy - (R + 75 * scale) * math.cos(a)
        br = 205 * scale
        d.ellipse([bx - br, by - br, bx + br, by + br], fill=CREAM)
        d.ellipse([bx - br * .6, by - br * .6, bx + br * .6, by + br * .6], fill=SOFT)
    # feet
    for sgn in (-1, 1):
        a = math.radians(32)
        p1 = (cx + sgn * R * .72 * math.sin(math.radians(60)), fy + R * .72 * math.cos(math.radians(60)) + 20 * scale)
        p2 = (cx + sgn * (R + 120 * scale) * math.sin(a), fy + (R + 120 * scale) * math.cos(a))
        thick_line(d, p1, p2, 80 * scale, CREAM)

    # body ring + face
    d.ellipse([cx - R - 46 * scale, fy - R - 46 * scale, cx + R + 46 * scale, fy + R + 46 * scale], fill=CREAM)
    d.ellipse([cx - R, fy - R, cx + R, fy + R], fill=NAVY_FACE)

    # dotted minute ring (matches the analog face in the app)
    for i in range(60):
        a = math.radians(i * 6)
        rr = R - 62 * scale
        big = i % 5 == 0
        r = (19 if big else 9) * scale
        x, y = cx + rr * math.sin(a), fy - rr * math.cos(a)
        d.ellipse([x - r, y - r, x + r, y + r], fill=CREAM if big else SLATE)

    def hand(deg, length, width, col):
        a = math.radians(deg)
        thick_line(d, (cx, fy), (cx + length * math.sin(a), fy - length * math.cos(a)), width * scale, col)
    hand(-60, 250, 66, CREAM)      # hour hand (10)
    hand(60, 370, 50, CREAM)       # minute hand (2)
    hand(165, 340, 18, SOFT)       # second hand
    # glowing second dot on the ring
    a = math.radians(165); rr = R - 62 * scale
    gx, gy = cx + rr * math.sin(a), fy - rr * math.cos(a)
    for k, col in ((70, (40, 78, 160)), (46, (110, 150, 230)), (30, CREAM)):
        r = k * scale
        d.ellipse([gx - r, gy - r, gx + r, gy + r], fill=col)
    cr = 62 * scale
    d.ellipse([cx - cr, fy - cr, cx + cr, fy + cr], fill=CREAM)
    cr = 24 * scale
    d.ellipse([cx - cr, fy - cr, cx + cr, fy + cr], fill=NAVY_FACE)

    im.resize((size, size), Image.LANCZOS).save(path)

make(192, 1.0, 'icons/icon-192.png'); make(512, 1.0, 'icons/icon-512.png')
make(512, 0.8, 'icons/maskable-512.png'); make(180, 1.0, 'icons/apple-touch-icon.png'); make(32, 1.0, 'icons/favicon-32.png')
