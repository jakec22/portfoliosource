#!/usr/bin/env python3
"""Regenerate every app-icon asset from one square source artwork.

    python3 scripts/make-icons.py assets/source/icon-source.png assets


The source is a two-colour drawing — one ink on one flat background — so the
alpha channel can be recovered exactly rather than threshold-keyed: every pixel
is a linear blend of those two colours, and solving for the blend factor keeps
the anti-aliased edge intact. Thresholding a 30px stroke would leave it ragged
at favicon size.

Sizes, framing and transparency all match what the assets already used, so the
only thing changing is the artwork.
"""
import sys, zlib, struct, pathlib

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from png import load

SRC = sys.argv[1]
OUT = pathlib.Path(sys.argv[2])

# The app's tokens, not whatever the artwork happens to be drawn in. The
# supplied file was a shade off #3F6B52, and an icon that nearly matches the
# in-app primary looks like a mistake rather than a choice.
INK = (0x3F, 0x6B, 0x52)      # theme primary
CREAM = (0xF8, 0xF5, 0xF1)    # theme bg


def unmatte(path):
    """(width, height, alpha[][]) with the ink isolated from its background."""
    w, h, px = load(path)
    bg = px(1, 1)[:3]
    # Ink colour = the darkest pixel present, which for a stroke drawing is a
    # fully-opaque interior sample.
    ink = min((px(x, y)[:3] for y in range(0, h, 4) for x in range(0, w, 4)),
              key=lambda c: c[0] + c[1] + c[2])
    d = [bg[i] - ink[i] for i in range(3)]
    denom = sum(v * v for v in d) or 1
    alpha = []
    for y in range(h):
        row = bytearray(w)
        for x in range(w):
            r, g, b, a = px(x, y)
            if a == 0:
                row[x] = 0
                continue
            t = sum((bg[i] - c) * d[i] for i, c in enumerate((r, g, b))) / denom
            row[x] = 0 if t <= 0 else (255 if t >= 1 else int(t * 255 + 0.5))
        alpha.append(row)
    return w, h, alpha, ink


def bbox(w, h, alpha, thresh=8):
    xs = [x for y in range(h) for x in range(w) if alpha[y][x] > thresh]
    ys = [y for y in range(h) for x in range(w) if alpha[y][x] > thresh]
    return min(xs), min(ys), max(xs), max(ys)


def resample(alpha, box, out_w, out_h):
    """Area-average the cropped mask down to out_w x out_h.

    Area, not nearest or bilinear: the artwork is a hairline stroke, and at
    favicon size anything else either drops parts of it or renders it crunchy.
    """
    x0, y0, x1, y1 = box
    sw, sh = x1 - x0 + 1, y1 - y0 + 1
    out = []
    for oy in range(out_h):
        sy0 = y0 + oy * sh / out_h
        sy1 = y0 + (oy + 1) * sh / out_h
        row = bytearray(out_w)
        iy0, iy1 = int(sy0), max(int(sy0) + 1, int(-(-sy1 // 1)))
        for ox in range(out_w):
            sx0 = x0 + ox * sw / out_w
            sx1 = x0 + (ox + 1) * sw / out_w
            ix0, ix1 = int(sx0), max(int(sx0) + 1, int(-(-sx1 // 1)))
            total = n = 0
            for yy in range(iy0, min(iy1, y1 + 1)):
                a = alpha[yy]
                for xx in range(ix0, min(ix1, x1 + 1)):
                    total += a[xx]
                    n += 1
            row[ox] = total // n if n else 0
        out.append(row)
    return out


def write_png(path, w, h, rgba):
    raw = b''.join(b'\x00' + bytes(rgba[y]) for y in range(h))
    def chunk(tag, data):
        c = tag + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c))
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(raw, 9))
           + chunk(b'IEND', b''))
    path.write_bytes(png)


def compose(mask, size, width_frac, ink, bg):
    """Centre the mask on a square canvas at the given fraction of its width."""
    mh = len(mask); mw = len(mask[0])
    ox = (size - mw) // 2
    oy = (size - mh) // 2
    canvas = []
    for y in range(size):
        row = bytearray(size * 4)
        for x in range(size):
            a = 0
            my, mx = y - oy, x - ox
            if 0 <= my < mh and 0 <= mx < mw:
                a = mask[my][mx]
            o = x * 4
            if bg is None:
                row[o:o+3] = bytes(ink)
                row[o+3] = a
            else:
                for i in range(3):
                    row[o+i] = (ink[i] * a + bg[i] * (255 - a)) // 255
                row[o+3] = 255
        canvas.append(row)
    return canvas


# Two framings, because the two platforms measure differently.
#
# 0.78 on a plain tile: this mark is far flatter than the one it replaces
# (aspect 0.36 against 0.64), so inheriting the old 0.71 left it looking
# stranded. 0.84 — near the source artwork's own framing — puts the tail into
# iOS's corner radius.
#
# 0.64 on the adaptive foreground, which is drawn into a 108dp canvas of which
# only the centre 72dp (66.7%) survives every launcher mask. Sitting just
# inside that lands the masked result at roughly the same visual size as iOS.
TARGETS = [
    # file,                          size, width%, ink,             background
    ('icon.png',                     1024, 0.78, INK,              CREAM),
    ('splash-icon.png',              1024, 0.78, INK,              None),
    ('logo-fish.png',                1024, 0.78, INK,              None),
    ('favicon.png',                    48, 0.78, INK,              CREAM),
    ('android-icon-foreground.png',   512, 0.64, INK,              None),
    ('android-icon-monochrome.png',   432, 0.64, (255, 255, 255),  None),
]

w, h, alpha, src_ink = unmatte(SRC)
box = bbox(w, h, alpha)
bw, bh = box[2] - box[0] + 1, box[3] - box[1] + 1
print(f'source {w}x{h}, ink {tuple(src_ink)}, art {bw}x{bh}')

for name, size, frac, ink, bg in TARGETS:
    tw = max(1, round(size * frac))
    th = max(1, round(tw * bh / bw))
    mask = resample(alpha, box, tw, th)
    write_png(OUT / name, size, size, compose(mask, size, frac, ink, bg))
    print(f'  {name:30} {size}x{size}  art {tw}x{th} ({frac:.0%})')

# Flat background plate for the adaptive icon.
plate = [bytearray(bytes(CREAM) + b'\xff') * 512 for _ in range(512)]
write_png(OUT / 'android-icon-background.png', 512, 512, plate)
print('  android-icon-background.png    512x512  flat')
