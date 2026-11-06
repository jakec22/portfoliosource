#!/usr/bin/env python3
"""Generate App Store featuring/promotional artwork (3840 x 1646).

Apple asks for this when an app is under consideration for editorial
featuring; the Promotional Artwork tab only appears in App Store Connect once
that happens, and it wants a PSD built on Apple's own template. This script
produces the flat artwork to place into that template, plus the centre crops
it gets cut down to.

Two rules the composition is built around:

  * Apple crops this. One 4320 x 1080 file feeds placements from a full-width
    hero down to a near-square card, so everything that has to be read lives
    inside the central 1080 x 1080 square. The wide canvas carries ground and
    nothing else — check the crops this script writes, not just the master.
  * It is the same world as the slides and the app: the neutral near-black
    ground from src/theme/index.ts, the ichthys, DM Serif Display for the
    name, Manrope underneath. Promotional art in a different palette from the
    product it promotes is a picture of a different app.

The subtitle is the App Store subtitle verbatim, not a new claim invented for
the artwork.

Run:  python3 promo.py        (from marketing/appstore)
"""
import base64
import importlib.util
import json
import pathlib
import subprocess

HERE = pathlib.Path(__file__).parent
ASSETS = HERE / ".." / ".." / "assets"

# The mark comes from its vector source rather than a PNG, so the artwork can
# never drift from the shipping icon's geometry.
_spec = importlib.util.spec_from_file_location("mark", ASSETS / "source" / "mark.py")
mark = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mark)

# Executive pack, verbatim from src/theme/index.ts.
BG, TEXT, MUTED = "#0E0E10", "#F4F4F5", "#A1A1A8"
PRIMARY = "#34C77B"

# The App Store subtitle, from PRODUCT.md, so the artwork and the listing
# say the same thing. Not a claim written for the artwork.
NAME = "HolyMacro"
SUBTITLE = "Tracking Simplified"

# The master size Apple's template asks for. Everything else is derived from
# its height, so changing this one tuple re-sizes the whole set.
MASTER = (3840, 1646)

# The crops Apple cuts the master down to, each taken from the centre — which
# is why the lockup lives there and the flanks carry ground only.
_W, _H = MASTER
CROPS = [("wide", _W, _H), ("half", _H * 2, _H), ("square", _H, _H)]


def page(w: int, h: int) -> str:
    """One artwork canvas. The lockup is sized off the shorter edge so the
    same composition holds whatever aspect it is rendered at."""
    unit = h / 1080  # everything scales from the canvas height
    mark_w = 372 * unit
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Manrope:wght@500;600&display=swap">
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
html,body{{width:100%;height:100%;overflow:hidden}}
body{{position:relative;background:
  radial-gradient(90% 150% at 50% -34%, rgba(52,199,123,.10) 0%, rgba(52,199,123,0) 62%),
  radial-gradient(120% 180% at 82% -18%, rgba(255,255,255,.055) 0%, rgba(255,255,255,0) 60%),
  linear-gradient(170deg,#1B1B1F 0%,#141417 40%,#101012 72%,{BG} 100%);
  font-family:'Manrope',sans-serif;-webkit-font-smoothing:antialiased}}

/* Concentric hairlines, the same device the slides use, centred on the mark
   so they read as a ripple rather than as decoration pinned to a corner. */
.arcs{{position:absolute;inset:0;overflow:hidden}}
.arcs i{{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
 border:1px solid rgba(244,244,245,.075);border-radius:50%}}

.lock{{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
 display:flex;flex-direction:column;align-items:center;
 width:{1080*unit}px}}
.mark{{width:{mark_w}px;height:{mark_w}px;display:block}}
.name{{font-family:'DM Serif Display',serif;font-weight:400;
 font-size:{120*unit}px;line-height:1;letter-spacing:{-0.03*120*unit}px;
 color:{TEXT};margin-top:{46*unit}px}}
.sub{{font-size:{40*unit}px;line-height:1.4;color:{MUTED};
 margin-top:{26*unit}px;font-weight:500}}
</style></head><body>
<div class="arcs">
  <i style="width:{900*unit}px;height:{900*unit}px"></i>
  <i style="width:{1420*unit}px;height:{1420*unit}px"></i>
  <i style="width:{2060*unit}px;height:{2060*unit}px"></i>
  <i style="width:{2820*unit}px;height:{2820*unit}px"></i>
</div>
<div class="lock">
  <div class="mark">{mark.ichthys(1.0, mark.STROKE, PRIMARY).replace(
      '<g', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" '
            'style="width:100%;height:100%;display:block"><g', 1) + '</svg>'}</div>
  <div class="name">{NAME}</div>
  <div class="sub">{SUBTITLE}</div>
</div>
</body></html>"""


def main() -> None:
    jobs = []
    for name, w, h in CROPS:
        f = HERE / f"promo-{name}-{w}x{h}.html"
        f.write_text(page(w, h))
        jobs.append({"html": str(f), "png": str(HERE / f"promo-{name}-{w}x{h}.png"),
                     "w": w, "h": h})

    runner = HERE / "_promo.js"
    runner.write_text(
        "const { execSync } = require('child_process');\n"
        "function pw(){ try { return require('playwright'); } catch {}\n"
        "  return require(execSync('npm root -g',{encoding:'utf8'}).trim()+'/playwright'); }\n"
        "const { chromium } = pw();\n"
        "const jobs = " + json.dumps(jobs) + ";\n"
        "(async () => {\n"
        "  const b = await chromium.launch({ args: ['--no-sandbox'] });\n"
        "  for (const j of jobs) {\n"
        "    const p = await b.newPage({ viewport: { width: j.w, height: j.h },\n"
        "      deviceScaleFactor: 1 });\n"
        "    await p.goto('file://' + j.html);\n"
        "    await p.evaluate(() => document.fonts.ready);\n"
        "    await p.waitForTimeout(400);\n"
        "    await p.screenshot({ path: j.png });\n"
        "    await p.close();\n"
        "    console.log('wrote', require('path').basename(j.png), j.w + 'x' + j.h);\n"
        "  }\n"
        "  await b.close();\n"
        "})();\n")
    subprocess.run(["node", str(runner)], check=True, cwd=str(HERE))
    runner.unlink()
    for j in jobs:
        pathlib.Path(j["html"]).unlink()


if __name__ == "__main__":
    main()
