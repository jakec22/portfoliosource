#!/usr/bin/env python3
"""Generate the App Store screenshot slides (1284 x 2778).

Authored at 428 x 926 CSS and rendered by shoot.js at deviceScaleFactor 3,
which lands exactly on 1284 x 2778.

Three rules the layout is built around:

  * The in-phone UI has to survive being shrunk to a search-result thumbnail,
    so it runs a handful of large elements rather than a faithfully dense
    screen. Anything below ~8px CSS here is unreadable by the time the store
    scales it down.
  * Every screen mirrors one the app actually renders. Check the component
    before inventing a layout — a screen the app cannot draw is a lie about
    the product, and the two camera offers on LogFoodScreen, for instance,
    occupy one slot and never appear together.
  * The palette is read off src/theme/index.ts rather than chosen here. When
    the Executive pack went dark these slides kept painting the old light
    pack — cream #F8F5F1 grounds and a muted #3F6B52 green — so the store
    advertised an app that no longer existed.

There is no eyebrow above the headlines. The old slides had one; at thumbnail
size an 8.5px tracked label is a grey smudge, and the headline is the only
text that survives the store's scaling, so it gets the room.
"""
import base64
import pathlib

HERE = pathlib.Path(__file__).parent
# The wordmark's glyph is the shipping app icon, so the slides can never drift
# from what people tap on their Home Screen.
ICON = base64.b64encode((HERE / ".." / ".." / "assets" / "icon.png").read_bytes()).decode()

# A real photograph of a real meal, dropped in beside this script. There is no
# honest way to fake one: the slide advertises photo recognition, so a
# CSS-drawn bowl is a picture of something the app never saw. Without it the
# slot renders as an obvious placeholder rather than a fabricated plate.
MEAL = next((p for p in (HERE / "meal.jpg", HERE / "meal.jpeg", HERE / "meal.png")
             if p.exists()), None)
MEAL_SRC = (f"data:image/{'png' if MEAL.suffix == '.png' else 'jpeg'};base64,"
            + base64.b64encode(MEAL.read_bytes()).decode()) if MEAL else None

# ---------------------------------------------------------------------------
# Executive pack tokens, verbatim from src/theme/index.ts.
# ---------------------------------------------------------------------------
BG, CARD, CARD_MUTED = "#0E0E10", "#252527", "#1A1A1C"
TEXT, MUTED, FAINT = "#F4F4F5", "#A1A1A8", "#6E6E76"
BORDER, BORDER_STRONG = "#34343A", "#47474F"
PRIMARY, PRIMARY_DARK = "#34C77B", "#27A663"
PRIMARY_SOFT, ON_PRIMARY = "rgba(52,199,123,0.16)", "#07140D"
DANGER, WARNING, INFO, ACCENT = "#F4756D", "#E0A32E", "#5A9FD4", "#E2683C"
WARNING_SOFT = "rgba(224,163,46,0.18)"
PROTEIN, CARBS, FAT, FIBER = "#E2683C", "#E0A32E", "#D1699B", "#79C993"
Z1, Z2, Z3, Z4, Z5 = "#5A9FD4", "#79C993", "#E0A32E", "#E2683C", "#F4756D"
GRAY700 = "#D2D2D7"

# src/utils/heartRateZones.ts: no profile age, so the fallback max applies.
MAX_HR = 190
ZONES = [("Recovery", Z1, "0–114", "4:10", 8), ("Easy", Z2, "114–133", "11:28", 22),
         ("Aerobic", Z3, "133–152", "19:34", 38), ("Threshold", Z4, "152–171", "12:31", 24),
         ("Max", Z5, "171+", "4:11", 8)]

# Drawn icons, not glyphs: MaterialCommunityIcons paths, the family
# src/components/Icon.tsx ships, so a slide and the app draw the same shape.
GLYPH = {
    "streak": "M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 14.97 5.12 15.47 5.29 15.97C5.43 16.57 5.7 17.17 6 17.7C7.08 19.43 8.95 20.67 10.96 20.92C13.1 21.19 15.39 20.8 17.03 19.32C18.86 17.66 19.5 15 18.56 12.72L18.43 12.46C18.22 12 17.66 11.2 17.66 11.2M14.5 17.5C14.22 17.74 13.76 18 13.4 18.1C12.28 18.5 11.16 17.94 10.5 17.28C11.69 17 12.4 16.12 12.61 15.23C12.78 14.43 12.46 13.77 12.33 13C12.21 12.26 12.23 11.63 12.5 10.94C12.69 11.32 12.89 11.7 13.13 12C13.9 13 15.11 13.44 15.37 14.8C15.41 14.94 15.43 15.08 15.43 15.23C15.46 16.05 15.1 16.95 14.5 17.5H14.5Z",
    "ai": "M7.5,5.6L5,7L6.4,4.5L5,2L7.5,3.4L10,2L8.6,4.5L10,7L7.5,5.6M19.5,15.4L22,14L20.6,16.5L22,19L19.5,17.6L17,19L18.4,16.5L17,14L19.5,15.4M22,2L20.6,4.5L22,7L19.5,5.6L17,7L18.4,4.5L17,2L19.5,3.4L22,2M13.34,12.78L15.78,10.34L13.66,8.22L11.22,10.66L13.34,12.78M14.37,7.29L16.71,9.63C17.1,10 17.1,10.65 16.71,11.04L5.04,22.71C4.65,23.1 4,23.1 3.63,22.71L1.29,20.37C0.9,20 0.9,19.35 1.29,18.96L12.96,7.29C13.35,6.9 14,6.9 14.37,7.29Z",
    "left": "M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z",
    "right": "M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z",
    "up": "M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z",
    "heart": "M12,21.35L10.55,20.03C5.4,15.36 2,12.27 2,8.5C2,5.41 4.42,3 7.5,3C9.24,3 10.91,3.81 12,5.08C13.09,3.81 14.76,3 16.5,3C19.58,3 22,5.41 22,8.5C22,12.27 18.6,15.36 13.45,20.03L12,21.35Z",
}


def icon(name, size, color):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="{color}" '
            f'style="flex:none;display:block"><path d="{GLYPH[name]}"/></svg>')


# The barcode mark is drawn the way src/screens/LogFoodScreen.tsx draws it:
# nine bars, every other one inked.
def barcode(size, color):
    bars, x, rects = [2, 1, 3, 1, 2, 1, 3, 1, 2], 0, []
    total = sum(bars) + len(bars) - 1
    for i, w in enumerate(bars):
        if i % 2 == 0:
            rects.append(f'<rect x="{x}" y="0" width="{w}" height="{size}" fill="{color}"/>')
        x += w + 1
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 {total} {size}" '
            f'style="flex:none;display:block">{"".join(rects)}</svg>')


CSS = f"""
*{{box-sizing:border-box;margin:0;padding:0}}
html,body{{width:428px;height:926px;background:{BG}}}
body{{position:relative;font-family:'Manrope',-apple-system,Arial,sans-serif;
 -webkit-font-smoothing:antialiased}}

/* ---- slide ground ----
   Strictly neutral. The pack's own note explains why: a warm near-black read
   brown and pulled every surface with it, so #0E0E10 was chosen at -2
   red-over-blue precisely so the green reads as a chosen colour rather than
   the ground showing through. An olive slide would undo that on the store
   page, which is where most people meet the app first. */
.bg{{position:absolute;inset:0;
 background:
  radial-gradient(120% 62% at 84% -10%, rgba(255,255,255,.055) 0%, rgba(255,255,255,0) 60%),
  linear-gradient(176deg,#1B1B1F 0%,#141417 38%,#101012 70%,{BG} 100%);}}
.arcs{{position:absolute;inset:0;overflow:hidden}}
.arcs i{{position:absolute;border:1px solid rgba(244,244,245,.055);border-radius:50%}}

/* ---- header block ---- */
.brand{{position:absolute;top:38px;left:30px;display:flex;align-items:center;gap:8px}}
.brand img{{width:21px;height:21px;border-radius:6px}}
.brand span{{font-size:10.5px;font-weight:800;color:{TEXT};letter-spacing:.01em}}

.head{{position:absolute;top:128px;left:30px;right:30px}}
h1{{font-family:'DM Serif Display',serif;font-weight:400;font-size:37px;line-height:1.16;
 letter-spacing:-.015em;color:{TEXT}}}
.sub{{font-size:12px;line-height:1.55;color:{MUTED};margin-top:14px;max-width:306px}}

/* ---- device ---- */
.phone{{position:absolute;top:286px;left:50%;transform:translateX(-50%);
 width:264px;height:552px;background:#050506;border-radius:37px;padding:7px;
 box-shadow:0 26px 60px rgba(0,0,0,.62), 0 0 0 .8px rgba(255,255,255,.09)}}
.screen{{position:relative;width:100%;height:100%;border-radius:30px;overflow:hidden;
 background:{BG}}}
.island{{position:absolute;top:8px;left:50%;transform:translateX(-50%);
 width:72px;height:17px;border-radius:10px;background:#050506;z-index:5}}
.hibar{{position:absolute;bottom:7px;left:50%;transform:translateX(-50%);
 width:88px;height:4px;border-radius:2px;background:rgba(244,244,245,.30);z-index:5}}
.body{{padding:40px 12px 16px}}
.body.flush{{padding:34px 0 16px}}

/* ---- footer ---- */
.foot{{position:absolute;bottom:24px;left:30px;font-size:8px;font-weight:800;
 color:#8A8A92;letter-spacing:.02em}}
.dots{{position:absolute;bottom:25px;right:30px;display:flex;gap:5px;align-items:center}}
.dots i{{width:4px;height:4px;border-radius:50%;background:rgba(244,244,245,.22)}}
.dots i.on{{background:{PRIMARY}}}

/* ================= in-app UI ================= */
.row{{display:flex;align-items:center}}
.sp{{flex:1}}

/* date nav + pinned totals — src/screens/FoodScreen.tsx */
.datenav{{display:flex;align-items:center;justify-content:center;gap:16px}}
.datelabel{{font-family:'DM Serif Display',serif;font-size:19px;color:{TEXT};
 min-width:104px;text-align:center;letter-spacing:-.01em}}
.remrow{{display:flex;align-items:baseline;gap:4px;margin-top:9px}}
.remnum{{font-family:'DM Serif Display',serif;font-size:25px;color:{TEXT};
 font-variant-numeric:tabular-nums;letter-spacing:-.02em}}
.remlbl{{font-size:10.5px;color:{MUTED}}}
.caltot{{font-size:10.5px;color:{FAINT};font-variant-numeric:tabular-nums}}
.track{{height:5px;border-radius:2.5px;background:{BORDER_STRONG};overflow:hidden;margin-top:8px}}
.fill{{height:100%;border-radius:2.5px}}
.macgrid{{display:flex;gap:7px;margin-top:11px}}
.maccol{{flex:1}}
.macnm{{font-size:7.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;
 color:{FAINT}}}
.macval{{font-variant-numeric:tabular-nums;margin-top:2px}}
.macval b{{font-family:'DM Serif Display',serif;font-size:13px;color:{TEXT};font-weight:400}}
.macval i{{font-family:'DM Serif Display',serif;font-size:9.5px;color:{FAINT};font-style:normal}}
.mactr{{height:4px;border-radius:2px;background:{BORDER_STRONG};overflow:hidden;margin-top:5px}}
.hdrrule{{height:1px;background:{BORDER};margin:13px -12px 0}}

/* AI meal logger — src/screens/FoodScreen.tsx */
.snap{{display:flex;align-items:center;gap:10px;background:{PRIMARY};border-radius:14px;
 padding:13px;margin-top:13px;box-shadow:0 5px 16px rgba(52,199,123,.26)}}
.snap b{{display:block;font-size:11.5px;font-weight:800;color:{ON_PRIMARY}}}
.snap s{{display:block;text-decoration:none;font-size:9.5px;color:{ON_PRIMARY};opacity:.82;
 margin-top:2px}}

/* meal sections — src/components/MealSection.tsx */
.meal{{background:{CARD};border-radius:14px;padding:12px 13px;margin-top:9px;
 display:flex;align-items:center;box-shadow:0 1px 4px rgba(0,0,0,.3)}}
.mealname{{font-size:11px;font-weight:700;color:{TEXT}}}
.mealmac{{font-size:9.5px;color:{FAINT};margin-top:2px;font-variant-numeric:tabular-nums}}
.mealcal{{font-size:11px;color:{MUTED};font-variant-numeric:tabular-nums;margin-right:6px}}

/* Home — src/screens/HomeScreen.tsx */
.pagetitle{{font-family:'DM Serif Display',serif;font-size:25px;color:{TEXT};
 letter-spacing:-.02em}}
.streak{{display:flex;align-items:center;gap:4px;background:{WARNING_SOFT};
 border:1px solid rgba(224,163,46,.5);border-radius:13px;padding:3px 9px}}
.streak span{{font-size:9.5px;font-weight:700;color:{WARNING}}}
.pagedate{{font-size:10px;color:{MUTED};margin:2px 0 12px}}
.card{{background:{CARD};border-radius:14px;padding:13px;margin-bottom:10px;
 box-shadow:0 2px 8px rgba(0,0,0,.35)}}

/* goals-updated card — src/components/GoalsUpdatedCard.tsx */
.gu{{background:{PRIMARY_SOFT};border:1px solid {PRIMARY};border-radius:14px;
 padding:12px 13px;margin-bottom:10px}}
.gut{{font-family:'DM Serif Display',serif;font-size:13px;color:{TEXT}}}
.gub{{font-size:9.5px;line-height:1.5;color:{MUTED};margin-top:4px}}
.gur{{display:flex;justify-content:space-between;align-items:baseline;margin-top:7px}}
.gurl{{font-size:9.5px;color:{MUTED}}}
.gurv{{font-size:10px;font-weight:700;color:{TEXT};font-variant-numeric:tabular-nums}}
.gurd{{color:{PRIMARY};font-weight:700}}

/* calorie ring — src/components/CalorieSummary.tsx */
.ring{{position:relative;width:104px;height:104px;margin:0 auto}}
.ringc{{position:absolute;inset:0;display:flex;flex-direction:column;
 align-items:center;justify-content:center}}
.rv{{font-family:'DM Serif Display',serif;font-size:27px;color:{TEXT};line-height:1.05;
 font-variant-numeric:tabular-nums;letter-spacing:-.03em}}
.rl{{font-size:8px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;
 color:{FAINT};margin-top:3px}}
.rsum{{text-align:center;font-size:10px;color:{MUTED};margin-top:11px;
 font-variant-numeric:tabular-nums}}
.rsum b{{font-family:'DM Serif Display',serif;color:{TEXT};font-weight:400}}
.carddiv{{height:1px;background:{BORDER};margin:9px 0}}

/* macro bar — src/components/MacroBar.tsx */
.mb{{margin-bottom:7px}}
.mb:last-child{{margin-bottom:0}}
.mbh{{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px}}
.mbl{{font-size:10px;font-weight:700;color:{TEXT}}}
.mbv{{font-family:'DM Serif Display',serif;font-size:12px;color:{TEXT};
 font-variant-numeric:tabular-nums}}
.mbg{{font-family:'DM Serif Display',serif;font-size:9.5px;color:{FAINT}}}

/* live workout — src/screens/ActiveWorkoutScreen.tsx */
.wtop{{display:flex;align-items:center;justify-content:space-between;padding:0 2px}}
.wcancel{{font-size:10px;color:{MUTED}}}
.wtimer{{font-family:'DM Serif Display',serif;font-size:19px;color:{TEXT};line-height:1;
 font-variant-numeric:tabular-nums}}
.wprog{{font-size:8px;color:{FAINT};margin-top:2px;text-align:center}}
.wfinish{{font-size:10px;font-weight:800;color:{PRIMARY}}}
.excard{{background:{CARD};border-radius:14px;padding:11px 12px;margin-top:9px;
 box-shadow:0 1px 4px rgba(0,0,0,.3)}}
.exname{{font-size:11px;font-weight:700;color:{TEXT};margin-bottom:8px}}
.setrow{{display:flex;align-items:center;gap:6px;margin-bottom:6px}}
.setrow:last-child{{margin-bottom:0}}
.setno{{width:17px;height:17px;border-radius:50%;display:flex;align-items:center;
 justify-content:center;font-size:8px;font-weight:800;background:{CARD_MUTED};color:{FAINT}}}
.setno.on{{background:{PRIMARY};color:{ON_PRIMARY}}}
.field{{flex:1;background:{CARD_MUTED};border-radius:7px;padding:5px 0;text-align:center;
 font-size:10px;font-weight:700;color:{TEXT};font-variant-numeric:tabular-nums}}
.tick{{width:19px;height:19px;border-radius:6px;border:1px solid {BORDER_STRONG};
 display:flex;align-items:center;justify-content:center;font-size:9px;color:transparent}}
.tick.on{{background:{PRIMARY};border-color:{PRIMARY};color:{ON_PRIMARY};font-weight:800}}
.hrbar{{position:absolute;left:0;right:0;bottom:0;background:{CARD};
 border-top:1px solid {BORDER};padding:10px 13px 20px;display:flex;align-items:center}}
.hrv{{font-family:'DM Serif Display',serif;font-size:19px;color:{DANGER};line-height:1;
 font-variant-numeric:tabular-nums}}
.hru{{font-size:8.5px;color:{MUTED};margin-left:3px}}
.hrw{{font-size:7.5px;color:{FAINT};margin-top:2px}}
.addex{{text-align:center;font-size:10px;font-weight:800;color:{PRIMARY};
 padding:13px 0 0}}
.rest{{background:{PRIMARY};color:{ON_PRIMARY};font-size:10px;font-weight:800;
 padding:8px 14px;border-radius:9px}}

/* workout summary — src/screens/WorkoutSummaryScreen.tsx */
.badge{{display:inline-block;background:{PRIMARY_SOFT};color:{PRIMARY};
 font-size:8px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;
 padding:4px 9px;border-radius:99px}}
.wtitle{{font-family:'DM Serif Display',serif;font-size:23px;color:{TEXT};margin-top:9px;
 line-height:1.1;letter-spacing:-.02em}}
.wdate{{font-size:9.5px;color:{MUTED};margin-top:3px;margin-bottom:13px}}
.statgrid{{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:13px}}
.statcard{{width:calc((100% - 14px)/3);background:{CARD};border-radius:12px;padding:8px 7px;
 text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.3)}}
.statcard b{{display:block;font-family:'DM Serif Display',serif;font-size:15px;
 font-weight:400;line-height:1.1;font-variant-numeric:tabular-nums}}
.statcard s{{display:block;text-decoration:none;font-size:7.5px;color:{MUTED};margin-top:3px}}
.sect{{font-size:10.5px;font-weight:800;color:{TEXT};margin:0 2px 9px}}
.zbar{{display:flex;height:8px;border-radius:4px;overflow:hidden;background:{CARD_MUTED}}}
.zrow{{display:flex;align-items:center;gap:8px;margin-top:8px}}
.zdot{{width:8px;height:8px;border-radius:50%}}
.zname{{font-size:9.5px;font-weight:700;color:{TEXT};width:58px}}
.zrange{{flex:1;font-size:9px;color:{FAINT};font-variant-numeric:tabular-nums}}
.ztime{{font-size:9.5px;font-weight:700;color:{MUTED};font-variant-numeric:tabular-nums}}

.prrow{{display:flex;align-items:center}}
.prname{{font-size:10px;font-weight:700;color:{TEXT}}}
.prdetail{{font-size:9px;color:{FAINT};margin-top:2px;font-variant-numeric:tabular-nums}}

/* key insights — src/screens/KeyInsightsScreen.tsx */
.khdr{{display:flex;align-items:center;gap:4px;margin-bottom:12px}}
.khdr b{{font-family:'DM Serif Display',serif;font-size:20px;color:{TEXT};
 font-weight:400;letter-spacing:-.02em}}
.kback{{font-size:10px;font-weight:700;color:{PRIMARY}}}
.statsrow{{display:flex}}
.istat{{flex:1;text-align:center}}
.istat b{{font-family:'DM Serif Display',serif;font-size:19px;font-weight:400;line-height:1;
 font-variant-numeric:tabular-nums}}
.istat u{{display:block;text-decoration:none;font-size:7.5px;color:{FAINT};margin-top:3px}}
.istat s{{display:block;text-decoration:none;font-size:8.5px;color:{MUTED};margin-top:2px}}
.imeta{{font-size:9px;color:{MUTED};margin-top:11px;padding-top:10px;
 border-top:1px solid {BORDER};display:flex;align-items:center;gap:4px}}
.tiles{{display:flex;gap:9px;margin-bottom:10px}}
.tile{{flex:1;background:{CARD};border-radius:14px;padding:12px;
 box-shadow:0 1px 4px rgba(0,0,0,.3)}}
.tile b{{font-family:'DM Serif Display',serif;font-size:19px;color:{TEXT};font-weight:400;
 line-height:1;font-variant-numeric:tabular-nums}}
.tile u{{display:block;text-decoration:none;font-size:7.5px;color:{FAINT};margin-top:3px}}
.tile s{{display:block;text-decoration:none;font-size:9px;font-weight:700;color:{TEXT};
 margin-top:6px}}
.wrow{{display:flex;align-items:baseline;gap:14px;margin-bottom:10px}}
.wrow b{{font-family:'DM Serif Display',serif;font-size:19px;color:{TEXT};font-weight:400;
 font-variant-numeric:tabular-nums}}
.wrow em{{font-family:'DM Serif Display',serif;font-size:19px;color:{PRIMARY};
 font-style:normal;font-variant-numeric:tabular-nums}}
.wrow u{{text-decoration:none;font-size:8px;color:{FAINT};margin-left:3px}}
"""


def page(idx, total, h1, sub, screen_html):
    dots = "".join(f'<i class="{"on" if i == idx else ""}"></i>' for i in range(total))
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Manrope:wght@500;600;700;800&display=swap">
<style>{CSS}</style></head><body>
<div class="bg"></div>
<div class="arcs">
  <i style="width:760px;height:760px;right:-250px;top:-330px"></i>
  <i style="width:1080px;height:1080px;right:-420px;top:-500px"></i>
  <i style="width:1420px;height:1420px;right:-600px;top:-680px"></i>
</div>
<div class="brand"><img src="data:image/png;base64,{ICON}"/><span>HolyMacro</span></div>
<div class="head">
  <h1>{h1}</h1>
  <div class="sub">{sub}</div>
</div>
<div class="phone">
  <div class="screen">
    <div class="island"></div>
    {screen_html}
    <div class="hibar"></div>
  </div>
</div>
<div class="foot">HolyMacro &mdash; Nutrition &amp; Training</div>
<div class="dots">{dots}</div>
</body></html>"""


def bar(label, cur, goal, color, unit="g"):
    pct = min(cur / goal, 1) * 100
    return f"""<div class="mb"><div class="mbh"><span class="mbl">{label}</span>
<span><span class="mbv">{cur:,}</span><span class="mbg"> / {goal:,}{unit}</span></span></div>
<div class="track" style="margin-top:0"><div class="fill" style="width:{pct:.1f}%;background:{color}"></div></div></div>"""


def ring(size, stroke, consumed, goal):
    """The calorie ring as CalorieSummary.tsx now draws it: one lap, and a
    second lap in danger once the goal is passed. Under goal there is one arc."""
    r = (size - stroke) / 2
    circ = 2 * 3.141592653589793 * r
    first = min(consumed / goal, 1)
    return f"""<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}"
 style="transform:rotate(-90deg)">
<circle cx="{size/2}" cy="{size/2}" r="{r}" fill="none" stroke="{CARD_MUTED}" stroke-width="{stroke}"/>
<circle cx="{size/2}" cy="{size/2}" r="{r}" fill="none" stroke="{PRIMARY}" stroke-width="{stroke}"
 stroke-linecap="round" stroke-dasharray="{circ*first:.2f} {circ:.2f}"/></svg>"""


def macro_col(name, cur, goal, color):
    pct = min(cur / goal, 1) * 100
    return f"""<div class="maccol"><div class="macnm">{name}</div>
<div class="macval"><b>{cur}</b><i>/{goal}</i></div>
<div class="mactr"><div class="fill" style="width:{pct:.0f}%;background:{color}"></div></div></div>"""


# ---------------------------------------------------------------- slide 1
# The Food tab: the pinned header FoodScreen now draws, then the capture
# route, then the log. The header used to read "128p · 96c · 51f" in the
# faintest colour the theme has; it carries goals and bars now.
s1 = f"""<div class="body">
  <div class="datenav">{icon('left', 13, GRAY700)}
    <span class="datelabel">Today</span>{icon('right', 13, FAINT)}</div>
  <div class="remrow"><span class="remnum">580</span><span class="remlbl">kcal left</span>
    <span class="sp"></span><span class="caltot">1,420 / 2,000</span></div>
  <div class="track"><div class="fill" style="width:71%;background:{PRIMARY}"></div></div>
  <div class="macgrid">
    {macro_col('Protein', 128, 185, PROTEIN)}{macro_col('Carbs', 96, 240, CARBS)}
    {macro_col('Fat', 51, 70, FAT)}{macro_col('Fiber', 18, 30, FIBER)}
  </div>
  <div class="hdrrule"></div>
  <div class="snap">{icon('ai', 19, ON_PRIMARY)}
    <div><b>AI Meal Logger</b><s>Snap a photo or describe your meal in words</s></div></div>
  <div class="meal"><div><div class="mealname">Breakfast</div>
    <div class="mealmac">P 32g · C 41g · F 12g</div></div><span class="sp"></span>
    <span class="mealcal">410 kcal</span>{icon('up', 12, FAINT)}</div>
  <div class="meal"><div><div class="mealname">Lunch</div>
    <div class="mealmac">P 48g · C 35g · F 21g</div></div><span class="sp"></span>
    <span class="mealcal">612 kcal</span>{icon('up', 12, FAINT)}</div>
  <div class="meal"><div><div class="mealname">Dinner</div>
    <div class="mealmac">P 38g · C 16g · F 15g</div></div><span class="sp"></span>
    <span class="mealcal">330 kcal</span>{icon('up', 12, FAINT)}</div>
  <div class="meal"><div><div class="mealname">Snacks</div>
    <div class="mealmac">P 10g · C 4g · F 3g</div></div><span class="sp"></span>
    <span class="mealcal">68 kcal</span>{icon('up', 12, FAINT)}</div>
</div>"""

# ---------------------------------------------------------------- slide 2
# Home with the goals-updated notice showing — the one screen in the app that
# states a target changed and why, which is what the slide claims.
s2 = f"""<div class="body">
  <div class="row"><span class="pagetitle">Today</span><span class="sp"></span>
    <span class="streak">{icon('streak', 11, WARNING)}<span>12 days</span></span></div>
  <div class="pagedate">Wednesday, November 5</div>
  <div class="gu">
    <div class="gut">Goals updated</div>
    <div class="gub">Your smoothed weight moved 5.2 lb.</div>
    <div class="gur"><span class="gurl">Calories</span>
      <span class="gurv">2,340 &rarr; <span class="gurd">2,200</span></span></div>
  </div>
  <div class="card">
    <div class="ring">{ring(104, 11, 1420, 2000)}
      <div class="ringc"><div class="rv">580</div><div class="rl">left</div></div></div>
    <div class="rsum"><b>1,420</b> of <b>2,000</b> kcal</div>
    <div class="carddiv"></div>
    {bar('Protein', 128, 185, PROTEIN)}{bar('Carbs', 96, 240, CARBS)}
    {bar('Fat', 51, 70, FAT)}{bar('Fiber', 18, 30, FIBER)}
  </div>
</div>"""

# ---------------------------------------------------------------- slide 3
_set = lambda n, lb, reps, done: f"""<div class="setrow">
  <div class="setno{' on' if done else ''}">{n}</div>
  <div class="field">{lb}</div><div class="field">{reps}</div>
  <div class="tick{' on' if done else ''}">&#10003;</div></div>"""

s3 = f"""<div class="body" style="padding-bottom:0">
  <div class="wtop"><span class="wcancel">Cancel</span>
    <div><div class="wtimer">24:18</div><div class="wprog">12/20 sets &middot; Push Day</div></div>
    <span class="wfinish">Finish</span></div>
  <div class="excard"><div class="exname">Barbell Bench Press</div>
    {_set(1, 185, 8, True)}{_set(2, 185, 8, True)}{_set(3, 185, 6, False)}</div>
  <div class="excard"><div class="exname">Incline Dumbbell Press</div>
    {_set(1, 65, 10, True)}{_set(2, 65, 10, False)}</div>
  <div class="excard"><div class="exname">Cable Fly</div>
    {_set(1, 30, 12, False)}</div>
  <div class="addex">+ Add Exercise</div>
</div>
<div class="hrbar">
  <div class="row" style="gap:5px">{icon('heart', 13, DANGER)}
    <div><div class="row" style="align-items:baseline"><span class="hrv">128</span>
      <span class="hru">bpm</span></div><div class="hrw">just now</div></div></div>
  <span class="sp"></span><span class="rest">Rest 1:30</span>
</div>"""

# ---------------------------------------------------------------- slide 4
_zbar = "".join(f'<div style="width:{p}%;background:{c}"></div>' for _, c, _, _, p in ZONES)
_zrows = "".join(
    f'<div class="zrow"><div class="zdot" style="background:{c}"></div>'
    f'<span class="zname">{n}</span><span class="zrange">{rng} bpm</span>'
    f'<span class="ztime">{t}</span></div>' for n, c, rng, t, _ in ZONES)

s4 = f"""<div class="body">
  <span class="badge">Completed</span>
  <div class="wtitle">Push Day</div>
  <div class="wdate">Wednesday, November 5</div>
  <div class="statgrid">
    <div class="statcard"><b style="color:{PRIMARY}">52:08</b><s>Duration</s></div>
    <div class="statcard"><b style="color:{ACCENT}">14,240</b><s>Volume</s></div>
    <div class="statcard"><b style="color:{WARNING}">18/20</b><s>Sets</s></div>
    <div class="statcard"><b style="color:{PROTEIN}">164</b><s>Reps</s></div>
    <div class="statcard"><b style="color:{INFO}">6</b><s>Exercises</s></div>
    <div class="statcard"><b style="color:{DANGER}">412</b><s>Active Energy</s></div>
  </div>
  <div class="sect">Heart Rate</div>
  <div class="card" style="padding:13px">
    <div class="zbar">{_zbar}</div>
    {_zrows}
  </div>
  <div class="sect">Personal Records</div>
  <div class="card" style="padding:12px 13px">
    <div class="prrow"><div><div class="prname">Barbell Bench Press</div>
      <div class="prdetail">185 lb &times; 8 &mdash; best set volume</div></div></div>
    <div class="prrow" style="margin-top:7px"><div>
      <div class="prname">Incline Dumbbell Press</div>
      <div class="prdetail">65 lb &times; 10 &mdash; heaviest to date</div></div></div>
  </div>
</div>"""

# ---------------------------------------------------------------- slide 5
s5 = f"""<div class="body">
  <div class="khdr">{icon('left', 12, PRIMARY)}<span class="kback">Back</span>
    <span class="sp"></span></div>
  <div style="margin:-6px 0 13px"><b style="font-family:'DM Serif Display',serif;
    font-size:21px;color:{TEXT};font-weight:400;letter-spacing:-.02em">Key Insights</b></div>
  <div class="sect">This Week</div>
  <div class="card">
    <div class="statsrow">
      <div class="istat"><b style="color:{PRIMARY}">2,140</b><u>kcal</u><s>Avg / day</s></div>
      <div class="istat"><b style="color:{PROTEIN}">148</b><u>g</u><s>Avg protein</s></div>
      <div class="istat"><b style="color:{WARNING}">4</b><u>sessions</u><s>Workouts</s></div>
    </div>
    <div class="imeta">Logged 7/7 days {icon('streak', 10, WARNING)} 12-day streak</div>
  </div>
  <div class="sect">Consistency</div>
  <div class="tiles">
    <div class="tile"><b>6</b><u>weeks</u><s>Current streak</s></div>
    <div class="tile"><b>58:20</b><u>h:mm:ss</u><s>Avg duration</s></div>
  </div>
  <div class="sect">Body Weight</div>
  <div class="card">
    <div class="wrow"><div><b>178.2</b><u>lb</u><br>
      <span style="font-size:7.5px;color:{FAINT}">Current</span></div>
      <div><em>&minus;4.6</em><u>lb</u><br>
      <span style="font-size:7.5px;color:{FAINT}">Change</span></div></div>
    <svg width="100%" height="46" viewBox="0 0 216 56" preserveAspectRatio="none">
      <polyline fill="none" stroke="{INFO}" stroke-width="2" stroke-linecap="round"
        stroke-linejoin="round" points="4,12 38,16 72,9 106,24 140,31 174,42 212,38"/>
    </svg>
  </div>
</div>"""

SLIDES = [
    ("Snap it.<br>It's logged.",
     "Photograph the plate and AI estimates every item, or read the real Nutrition "
     "Facts panel when a barcode's numbers are wrong.", s1),
    ("Targets that follow<br>your weight.",
     "Weigh in and your calories and macros rebuild themselves. No wizard to "
     "re-run, no stale numbers.", s2),
    ("Log sets.<br>Watch it climb.",
     "Live Apple Watch heart rate while you train, set by set.", s3),
    ("Every set.<br>Every beat.",
     "Finish and get the whole picture — volume, records, and how long you "
     "actually spent in each heart-rate zone.", s4),
    ("Your progress,<br>decoded.",
     "Weight, nutrition and training trends — all on one page.", s5),
]

for i, (h1, sub, screen) in enumerate(SLIDES):
    out = HERE / f"slide{i+1}.html"
    out.write_text(page(i, len(SLIDES), h1, sub, screen))
    print("wrote", out.name)

if not MEAL_SRC:
    print("\n   (no meal photo present; no slide currently uses one)\n")
