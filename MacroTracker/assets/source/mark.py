#!/usr/bin/env python3
"""Draw the HolyMacro ichthys and render every icon asset from it.

The mark used to exist only as PNGs, so every colour change meant repainting
pixels and every size inherited whatever stroke weight the 1024px export
happened to have. Measuring those PNGs turned up two defects a vector source
fixes for good:

  * The stroke was 4.3% of the canvas — 1.2px at the 29pt Settings size. On
    the old cream ground that survived on sheer contrast; as #34C77B on a
    near-black ground it is a hairline that aliases.
  * The Android foreground spanned 92–419 of 512 against a 100–412 guaranteed
    safe circle, so a launcher cropping to 66/108 clipped the nose and tail.

Both are now parameters. `WIDTH_FRAC` differs per platform because the
constraint differs: iOS masks to a squircle and wants the mark to fill it,
Android guarantees only the inner 66/108 circle. For a mark this flat the
circle binds on width — a w x 0.33w box fits a circle of diameter d when
w*sqrt(1 + 0.33^2) <= d, so 0.61 canvas of circle allows 0.57 of width.

Run:  python3 assets/source/mark.py        (from the MacroTracker root)
"""
import json
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
ASSETS = HERE.parent

# Executive pack, verbatim from src/theme/index.ts. The icon is the one place
# the app's ground and its primary meet with nothing in between, so it is the
# palette's plainest statement.
GROUND = "#0E0E10"
MARK = "#34C77B"


def ichthys(width_frac: float, stroke_frac: float, color: str) -> str:
    """The mark as two crossing strokes in a 100x100 box.

    Each stroke runs from one tail tip, through the crossing, and along one
    side of the body to the nose — which is what makes the tail an X rather
    than two arcs that happen to meet. Drawn once at unit scale and scaled to
    the requested width, so every asset shares one geometry.
    """
    # Unit geometry: nose right, tail tips left, body centred on y=50.
    # The proportions are measured off the shipped mark — 0.36 height-to-width
    # overall, tail tips the vertical extremes — so the silhouette people
    # already have on their Home Screen survives the recolour.
    nose_x, cx, cy = 96.0, 4.0, 50.0
    span = nose_x - cx
    cross_x = 25.0
    tail_dy = span * 0.18   # tip to centre; 0.36 of width tip-to-tip
    bulge = span * 0.205    # control offset setting body depth; the interior
                            # opening has to stay several stroke-widths tall or
                            # the body reads as a slit at 29pt

    # Each stroke: tail tip, a sweep into the crossing, then one side of the
    # body out to the nose. The tail sweeps rather than running straight —
    # a straight tail reads as a letter X with a lens stuck to it.
    upper = (f"M {cx} {cy + tail_dy} C {cx + 7} {cy + tail_dy * 0.72} "
             f"{cross_x - 9} {cy + tail_dy * 0.42} {cross_x} {cy} "
             f"C {cross_x + 15} {cy - bulge} {nose_x - 19} {cy - bulge} {nose_x} {cy}")
    lower = (f"M {cx} {cy - tail_dy} C {cx + 7} {cy - tail_dy * 0.72} "
             f"{cross_x - 9} {cy - tail_dy * 0.42} {cross_x} {cy} "
             f"C {cross_x + 15} {cy + bulge} {nose_x - 19} {cy + bulge} {nose_x} {cy}")

    # width_frac is the INKED width — what a ruler on the PNG measures —
    # not the path span. Round caps add half a stroke past each endpoint, so
    # the path has to be shorter than the mark by one full stroke. Getting
    # this backwards inked the mark 74% wide when 68% was asked for, which
    # is what pushed the Android foreground back out of its safe circle.
    stroke = stroke_frac * width_frac * 100   # viewBox units
    path_span = width_frac * 100 - stroke
    scale = path_span / span
    tx = 50 - (cx + span / 2) * scale         # centre the ink, not the box
    ty = 50 - cy * scale

    return (
        f'<g transform="translate({tx:.3f} {ty:.3f}) scale({scale:.5f})">'
        f'<path d="{upper}" fill="none" stroke="{color}" '
        f'stroke-width="{stroke / scale:.3f}" stroke-linecap="round"/>'
        f'<path d="{lower}" fill="none" stroke="{color}" '
        f'stroke-width="{stroke / scale:.3f}" stroke-linecap="round"/></g>'
    )


def svg(width_frac: float, stroke_frac: float, color: str, ground: str | None) -> str:
    bg = f'<rect width="100" height="100" fill="{ground}"/>' if ground else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
            f'{bg}{ichthys(width_frac, stroke_frac, color)}</svg>')


# Inked width as a fraction of the canvas. iOS masks to a squircle, so the
# mark can fill it; Android guarantees only the inner 66/108 circle, and a
# mark this flat is bound by its bounding box's diagonal, not its width —
# measured, then set with margin rather than trusted to the algebra.
IOS_WIDTH, ANDROID_WIDTH = 0.68, 0.55
# Fraction of the mark's own inked width.
#
# Lighter than the shipped mark's measured 5.5%, which still read heavy on a
# near-black ground: dark ink on cream looks finer than it measures, and the
# same weight in #34C77B on #0E0E10 gains apparent mass. Rendered as a ladder
# (0.055 / 0.046 / 0.038 / 0.031) at 180, 60 and 29pt, this is the lightest
# weight that still holds at the 29pt Settings slot — 0.031 starts to
# disappear there.
STROKE = 0.038

ASSET_SPECS = [
    # (filename, px, width_frac, color, ground)
    ("icon.png", 1024, IOS_WIDTH, MARK, GROUND),
    ("splash-icon.png", 1024, IOS_WIDTH, MARK, None),
    ("logo-fish.png", 1024, IOS_WIDTH, MARK, None),
    ("favicon.png", 64, IOS_WIDTH, MARK, GROUND),
    ("android-icon-foreground.png", 512, ANDROID_WIDTH, MARK, None),
    ("android-icon-background.png", 512, ANDROID_WIDTH, GROUND, GROUND),
    ("android-icon-monochrome.png", 512, ANDROID_WIDTH, "#FFFFFF", None),
    # iOS 18 appearance variants. A near-black icon loses its edge on a dark
    # wallpaper, so the dark variant drops the ground and lets the system
    # supply it; the tinted variant is drawn in greyscale for the same reason.
    ("icon-dark.png", 1024, IOS_WIDTH, MARK, None),
    ("icon-tinted.png", 1024, IOS_WIDTH, "#FFFFFF", None),
]


def render(out_dir: pathlib.Path) -> list[pathlib.Path]:
    """Rasterise each asset through headless Chromium (the only renderer here)."""
    jobs = []
    for name, px, wf, color, ground in ASSET_SPECS:
        # The background asset is a flat field; drawing the mark into it would
        # double it against the foreground layer.
        body = svg(wf, STROKE, color, ground) if name != "android-icon-background.png" \
            else f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' \
                 f'<rect width="100" height="100" fill="{ground}"/></svg>'
        jobs.append({"path": str(out_dir / name), "px": px, "svg": body})

    script = HERE / "_render.js"
    script.write_text(
        "const { chromium } = require('playwright');\n"
        # json.dumps, not repr: the SVG carries double quotes of its own, so
        # quote-swapping a repr produces broken JSON.
        "const jobs = " + json.dumps(jobs) + ";\n"
        "(async () => {\n"
        "  const b = await chromium.launch({ args: ['--no-sandbox'] });\n"
        "  for (const j of jobs) {\n"
        "    const p = await b.newPage({ viewport: { width: j.px, height: j.px },\n"
        "      deviceScaleFactor: 1 });\n"
        "    await p.setContent(`<style>html,body{margin:0;padding:0;background:transparent}\n"
        "      svg{display:block;width:${j.px}px;height:${j.px}px}</style>` + j.svg);\n"
        "    await p.screenshot({ path: j.path, omitBackground: true });\n"
        "    await p.close();\n"
        "    console.log('wrote', j.path);\n"
        "  }\n"
        "  await b.close();\n"
        "})();\n"
    )
    subprocess.run(["node", str(script)], check=True, cwd=str(HERE))
    script.unlink()
    return [out_dir / n for n, *_ in ASSET_SPECS]


if __name__ == "__main__":
    out = ASSETS if len(sys.argv) < 2 else pathlib.Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    # The vector source ships beside the PNGs so the next change edits a path,
    # not pixels.
    (ASSETS / "source" / "mark.svg").write_text(svg(IOS_WIDTH, STROKE, MARK, GROUND))
    for p in render(out):
        print("ok", p.name)
