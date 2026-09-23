#!/usr/bin/env python3
"""Generate the App Store screenshot slides (1284 x 2778).

Authored at 428 x 926 CSS and rendered by shoot.js at deviceScaleFactor 3,
which lands exactly on 1284 x 2778.

Two rules the layout is built around:

  * The in-phone UI has to survive being shrunk to a search-result thumbnail,
    so it runs a handful of large elements rather than a faithfully dense
    screen. Anything below ~8px CSS here is unreadable by the time the store
    scales it down.
  * Every screen mirrors one the app actually renders. Check the component
    before inventing a layout — the heart-rate chart, for instance, lives on
    WorkoutSummaryScreen, not on the live workout screen.
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

# Editorial pack tokens, straight from src/theme/index.ts
BG, CARD, TEXT, MUTED, FAINT = "#F8F5F1", "#FFFFFF", "#221F1B", "#89807D", "#B5AB9E"
CARD_MUTED, BORDER, BORDER_STRONG = "#F1ECE5", "#E7E0D6", "#D6CBBC"
PRIMARY, PRIMARY_DARK, PRIMARY_SOFT = "#3F6B52", "#2F5340", "#E7EFEA"
DANGER, WARNING, INFO, ACCENT = "#B54A3B", "#B98A3E", "#5E7A8C", "#9C5B45"
PROTEIN, CARBS, FAT, FIBER = "#9C5B45", "#B98A3E", "#A46C74", "#6E7B63"
Z1, Z2, Z3, Z4, Z5 = "#4A6E85", "#74965C", "#C9A227", "#C4703A", "#A8342A"
GOLD = "#C9A227"

# src/utils/heartRateZones.ts: no profile age, so the fallback max applies.
MAX_HR = 190
ZONES = [("Recovery", Z1, "0–114"), ("Easy", Z2, "114–133"), ("Aerobic", Z3, "133–152"),
         ("Threshold", Z4, "152–171"), ("Max", Z5, "171+")]

CSS = f"""
*{{box-sizing:border-box;margin:0;padding:0}}
html,body{{width:428px;height:926px;background:#131C16}}
body{{position:relative;font-family:'Manrope',-apple-system,Arial,sans-serif;
 -webkit-font-smoothing:antialiased}}

/* ---- slide ground: olive wash falling off to near-black green ---- */
.bg{{position:absolute;inset:0;
 background:
  radial-gradient(130% 70% at 88% -8%, rgba(176,196,140,.30) 0%, rgba(176,196,140,0) 58%),
  radial-gradient(100% 60% at 12% 6%, rgba(120,150,110,.16) 0%, rgba(120,150,110,0) 55%),
  linear-gradient(176deg,#2B3A2D 0%,#22301F 34%,#1A251B 68%,#121A15 100%);}}
.arcs{{position:absolute;inset:0;overflow:hidden}}
.arcs i{{position:absolute;border:1px solid rgba(233,240,220,.055);border-radius:50%}}

/* ---- header block ---- */
.brand{{position:absolute;top:38px;left:30px;display:flex;align-items:center;gap:8px}}
.brand img{{width:20px;height:20px;border-radius:5px}}
.brand span{{font-size:10.5px;font-weight:800;color:#E9EFE2}}

.head{{position:absolute;top:132px;left:30px;right:30px}}
.kicker{{font-size:10px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:{GOLD}}}
h1{{font-family:'DM Serif Display',serif;font-weight:400;font-size:33px;line-height:1.20;
 color:#F1ECE0;margin-top:11px}}
.sub{{font-size:11.5px;line-height:1.52;color:rgba(232,238,224,.70);margin-top:13px;max-width:300px}}

/* ---- device ---- */
.phone{{position:absolute;top:282px;left:50%;transform:translateX(-50%);
 width:264px;height:552px;background:#0B0C0B;border-radius:37px;padding:7px;
 box-shadow:0 26px 54px rgba(0,0,0,.46), 0 0 0 .8px rgba(255,255,255,.07)}}
.screen{{position:relative;width:100%;height:100%;border-radius:30px;overflow:hidden;background:{BG}}}
.screen.dark{{background:#111311}}
.island{{position:absolute;top:8px;left:50%;transform:translateX(-50%);
 width:72px;height:17px;border-radius:10px;background:#0B0C0B;z-index:5}}
.hibar{{position:absolute;bottom:7px;left:50%;transform:translateX(-50%);
 width:88px;height:4px;border-radius:2px;background:rgba(34,31,27,.30);z-index:5}}
.hibar.on-dark{{background:rgba(255,255,255,.34)}}
.body{{padding:40px 12px 16px}}
.body.cam{{position:absolute;inset:0;display:flex;flex-direction:column;padding:40px 12px 24px}}

/* ---- footer ---- */
.foot{{position:absolute;bottom:24px;left:30px;font-size:8px;font-weight:800;
 color:rgba(232,238,224,.46);letter-spacing:.02em}}
.dots{{position:absolute;bottom:25px;right:30px;display:flex;gap:5px;align-items:center}}
.dots i{{width:4px;height:4px;border-radius:50%;background:rgba(232,238,224,.26)}}
.dots i.on{{background:{GOLD}}}

/* ================= in-app UI ================= */
.navc{{display:flex;align-items:center;justify-content:center;gap:11px;margin-bottom:11px}}
.navc b{{font-size:12px;font-weight:800;color:{TEXT}}}
.navc s{{text-decoration:none;font-size:13px;color:{FAINT}}}
.navbar{{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:11px}}
.navbar .mid{{text-align:center;flex:1}}
.navbar .t{{font-family:'DM Serif Display',serif;font-size:18px;color:{TEXT};line-height:1.1}}
.navbar .st{{font-size:8px;color:{FAINT};margin-top:2px}}
.navbar a{{font-size:10.5px;font-weight:700;color:{PRIMARY};text-decoration:none}}
.navbar a.q{{color:{MUTED}}}
.eyebrow{{text-align:center;font-size:8.5px;font-weight:800;letter-spacing:.16em;
 text-transform:uppercase;color:{FAINT};margin-bottom:11px}}

.card{{background:{CARD};border-radius:15px;padding:13px;margin-bottom:10px;
 box-shadow:0 1px 3px rgba(34,31,27,.06)}}
.ct{{font-size:11px;font-weight:800;color:{TEXT};margin-bottom:10px}}
.sect{{font-size:11px;font-weight:800;color:{TEXT};margin:0 2px 7px}}

/* macro bar — mirrors src/components/MacroBar.tsx */
.mb{{margin-bottom:12px}}
.mb:last-child{{margin-bottom:0}}
.mbh{{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px}}
.mbl{{font-size:10.5px;font-weight:700;color:{TEXT}}}
.mbv{{font-family:'DM Serif Display',serif;font-size:12.5px;color:{TEXT}}}
.mbg{{font-family:'DM Serif Display',serif;font-size:10px;color:{FAINT}}}
.mbt{{height:5px;border-radius:2.5px;background:{BORDER_STRONG};overflow:hidden}}
.mbf{{height:100%;border-radius:2.5px}}

/* calorie ring — src/components/CalorieSummary.tsx */
.ring{{position:relative;width:142px;height:142px;margin:2px auto 0}}
.ringc{{position:absolute;inset:0;display:flex;flex-direction:column;
 align-items:center;justify-content:center}}
.rv{{font-family:'DM Serif Display',serif;font-size:31px;color:{TEXT};line-height:1.05}}
.rl{{font-size:9px;color:{FAINT};margin-top:2px}}
.rr{{font-family:'DM Serif Display',serif;font-size:19px;color:{PRIMARY};margin-top:8px;line-height:1}}
.rl2{{font-size:8.5px;color:{FAINT};margin-top:2px}}
.split{{display:flex;justify-content:center;align-items:baseline;gap:12px;margin-top:11px}}
.split div{{text-align:center}}
.split b{{font-family:'DM Serif Display',serif;font-size:14px;color:{TEXT};font-weight:400}}
.split b.g{{color:{PRIMARY}}}
.split s{{display:block;text-decoration:none;font-size:8px;color:{FAINT};margin-top:2px}}
.split u{{text-decoration:none;font-size:12px;color:{FAINT};align-self:center}}

/* goals-updated card — src/components/GoalsUpdatedCard.tsx */
.gu{{background:{PRIMARY_SOFT};border:1px solid {PRIMARY}55;border-radius:15px;
 padding:13px;margin-bottom:10px}}
.guh{{display:flex;justify-content:space-between;align-items:center}}
.gut{{font-family:'DM Serif Display',serif;font-size:13px;color:{PRIMARY_DARK}}}
.gux{{font-size:15px;color:{PRIMARY_DARK};line-height:1}}
.gub{{font-size:9.5px;line-height:1.5;color:{TEXT};margin-top:5px}}
.gur{{display:flex;justify-content:space-between;align-items:baseline;margin-top:8px}}
.gurl{{font-size:9.5px;color:{MUTED}}}
.gurv{{font-size:10.5px;font-weight:700;color:{TEXT}}}
.gurd{{color:{PRIMARY_DARK};font-weight:500}}
.guf{{margin-top:11px;padding-top:10px;border-top:1px solid {PRIMARY}33;
 font-size:9.5px;font-weight:700;color:{PRIMARY_DARK}}}

/* body heat map + split legend — src/components/BodyHeatMap.tsx */
.bmrow{{display:flex;gap:8px;align-items:flex-start}}
.figcap{{text-align:center;font-size:8px;color:{FAINT};margin-top:4px}}
.legend{{flex:1;display:flex;flex-direction:column;gap:7px;padding-top:6px}}
.lrow{{display:flex;align-items:center;gap:7px}}
.lsw{{width:8px;height:8px;border-radius:2px}}
.lnm{{flex:1;font-size:10px;color:{TEXT}}}
.lpc{{font-size:10px;font-weight:700;color:{MUTED};font-variant-numeric:tabular-nums}}

/* consistency — src/components/TrainingCalendar.tsx */
.grid{{display:flex;gap:3.5px;justify-content:space-between}}
.gcol{{display:flex;flex-direction:column;gap:3.5px}}
.gc{{width:13px;height:13px;border-radius:3px}}
.gnote{{font-size:8.5px;color:{FAINT};margin-top:10px}}
.streak{{display:flex;gap:8px;margin-bottom:10px}}
.stile{{flex:1;background:{CARD};border-radius:13px;padding:11px;
 box-shadow:0 1px 3px rgba(34,31,27,.06)}}
.stile b{{font-family:'DM Serif Display',serif;font-size:20px;color:{TEXT};font-weight:400;line-height:1}}
.stile s{{display:block;text-decoration:none;font-size:8px;color:{FAINT};margin-top:3px}}
.stile i{{display:block;font-style:normal;font-size:9.5px;font-weight:700;color:{TEXT};margin-top:5px}}

/* workout summary — src/screens/WorkoutSummaryScreen.tsx */
.badge{{display:inline-block;background:{PRIMARY_SOFT};color:{PRIMARY_DARK};
 font-size:8.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;
 padding:4px 9px;border-radius:99px}}
.wtitle{{font-family:'DM Serif Display',serif;font-size:22px;color:{TEXT};margin-top:8px;line-height:1.1}}
.wdate{{font-size:9.5px;color:{MUTED};margin-top:3px;margin-bottom:12px}}
.statgrid{{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:12px}}
.statcard{{width:calc((100% - 14px)/3);background:{CARD};border-radius:12px;padding:9px 7px;
 text-align:center;box-shadow:0 1px 3px rgba(34,31,27,.06)}}
.statcard b{{display:block;font-family:'DM Serif Display',serif;font-size:15px;
 font-weight:400;line-height:1.1;font-variant-numeric:tabular-nums}}
.statcard s{{display:block;text-decoration:none;font-size:8px;color:{MUTED};margin-top:3px}}
.hrstats{{display:flex;justify-content:space-around;margin-bottom:9px}}
.hrstat{{text-align:center}}
.hrstat b{{font-family:'DM Serif Display',serif;font-size:21px;font-weight:400;line-height:1;
 font-variant-numeric:tabular-nums}}
.hrstat s{{display:block;text-decoration:none;font-size:8.5px;color:{MUTED};margin-top:3px}}
.zbar{{display:flex;height:8px;border-radius:4px;overflow:hidden;background:{CARD_MUTED};margin-top:11px}}
.zrow{{display:flex;align-items:center;gap:8px;margin-top:8px}}
.zdot{{width:8px;height:8px;border-radius:50%}}
.zname{{font-size:10px;font-weight:700;color:{TEXT};width:62px}}
.zrange{{flex:1;font-size:9.5px;color:{FAINT}}}
.ztime{{font-size:10px;font-weight:700;color:{MUTED};font-variant-numeric:tabular-nums}}

/* camera — src/components/BarcodeScanner.tsx */
.seg{{display:flex;margin:0 auto;background:rgba(255,255,255,.10);
 border-radius:99px;padding:2px;width:max-content}}
.seg span{{font-size:9px;font-weight:700;color:rgba(255,255,255,.62);padding:4.5px 12px;border-radius:99px}}
.seg span.on{{background:{PRIMARY};color:#fff}}
.camtop{{display:flex;align-items:center;justify-content:space-between;padding:0 2px}}
.close{{font-size:9px;font-weight:700;color:rgba(255,255,255,.75);
 background:rgba(255,255,255,.12);padding:4.5px 9px;border-radius:99px}}
.hint{{text-align:center;font-size:9px;font-weight:700;color:rgba(255,255,255,.88);margin-top:12px}}
.shutter{{width:44px;height:44px;border-radius:50%;border:3px solid rgba(255,255,255,.9);
 background:{PRIMARY};margin:10px auto 0}}
.frame{{margin-top:11px;border-radius:6px;overflow:hidden;
 box-shadow:0 0 0 2px {PRIMARY}, 0 8px 22px rgba(0,0,0,.5);flex:1;display:flex;min-height:0}}

/* FDA nutrition label */
.nl{{background:#fff;padding:10px 10px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
 color:#000;flex:1;display:flex;flex-direction:column}}
.nl-rows{{flex:1;display:flex;flex-direction:column;justify-content:space-between}}
.nl-t{{font-size:22px;font-weight:800;letter-spacing:-.5px;line-height:1}}
.nl-r1{{height:1px;background:#000;margin:3px 0}}
.nl-r2{{height:7px;background:#000;margin:3px 0}}
.nl-r3{{height:4px;background:#000;margin:3px 0}}
.nl-s{{font-size:8px}}
.nl-sz{{display:flex;justify-content:space-between;font-size:10px;font-weight:700;margin-top:2px}}
.nl-ca{{font-size:7.5px;margin-top:2px}}
.nl-cal{{display:flex;justify-content:space-between;align-items:flex-end;font-size:12px;font-weight:800}}
.nl-cal .big{{font-size:27px;letter-spacing:-.8px;line-height:.9}}
.nl-dv{{text-align:right;font-size:7.5px;font-weight:700;border-top:1px solid #000;padding-top:1px}}
.nl-row{{display:flex;justify-content:space-between;font-size:8.5px;border-top:1px solid #000;padding:1.4px 0}}
.nl-row.ind{{padding-left:10px}}
.nl-row.ind2{{padding-left:19px}}
.nl-fine{{font-size:6px;line-height:1.35;border-top:4px solid #000;padding-top:3px;margin-top:2px}}

/* meal photo — src/screens/MealPhotoScreen.tsx */
.shot{{height:132px;border-radius:12px;overflow:hidden;background:{CARD_MUTED}}}
.shot img{{width:100%;height:100%;object-fit:cover;display:block}}
.slot{{height:132px;border-radius:12px;border:1.5px dashed {BORDER_STRONG};
 background:{CARD_MUTED};display:flex;flex-direction:column;align-items:center;
 justify-content:center;gap:7px;color:{MUTED};text-align:center;padding:0 18px}}
.slot b{{font-size:10.5px;font-weight:800;color:{TEXT}}}
.slot s{{text-decoration:none;font-size:9px;line-height:1.45}}
.chip{{display:inline-flex;align-items:center;gap:5px;background:{PRIMARY_SOFT};
 color:{PRIMARY_DARK};border-radius:99px;padding:4.5px 10px;font-size:9px;font-weight:800}}
.mealname{{font-family:'DM Serif Display',serif;font-size:15px;color:{TEXT};margin-top:10px}}
.mealkcal{{font-size:9.5px;color:{MUTED};margin-top:3px;margin-bottom:12px}}
.pills{{display:flex;gap:5px;margin-bottom:12px}}
.pills span{{flex:1;text-align:center;font-size:9px;font-weight:700;color:{MUTED};
 background:{CARD};border:1px solid {BORDER};border-radius:99px;padding:5.5px 0}}
.pills span.on{{background:{PRIMARY};border-color:{PRIMARY};color:#fff}}
.cta{{background:{PRIMARY};color:#fff;text-align:center;font-size:11px;font-weight:800;
 padding:11px 0;border-radius:12px}}
"""


def page(idx, total, kicker, h1, sub, screen_html, dark=False):
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
  <div class="kicker">{kicker}</div>
  <h1>{h1}</h1>
  <div class="sub">{sub}</div>
</div>
<div class="phone">
  <div class="screen{' dark' if dark else ''}">
    <div class="island"></div>
    {screen_html}
    <div class="hibar{' on-dark' if dark else ''}"></div>
  </div>
</div>
<div class="foot">HolyMacro &mdash; Nutrition &amp; Training</div>
<div class="dots">{dots}</div>
</body></html>"""


def bar(label, cur, goal, color, unit="g"):
    pct = min(cur / goal, 1) * 100
    return f"""<div class="mb"><div class="mbh"><span class="mbl">{label}</span>
<span><span class="mbv">{cur:,}</span><span class="mbg"> / {goal:,}{unit}</span></span></div>
<div class="mbt"><div class="mbf" style="width:{pct:.1f}%;background:{color}"></div></div></div>"""


def donut(size, stroke, pct, color, track=BORDER):
    r = (size - stroke) / 2
    circ = 2 * 3.141592653589793 * r
    return f"""<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}" style="transform:rotate(-90deg)">
<circle cx="{size/2}" cy="{size/2}" r="{r}" fill="none" stroke="{track}" stroke-width="{stroke}"/>
<circle cx="{size/2}" cy="{size/2}" r="{r}" fill="none" stroke="{color}" stroke-width="{stroke}"
 stroke-linecap="round" stroke-dasharray="{circ*pct:.2f} {circ:.2f}"/></svg>"""


# ---------------------------------------------------------------- slide 1
if MEAL_SRC:
    shot = f'<div class="shot"><img src="{MEAL_SRC}"/></div>'
else:
    shot = ('<div class="slot"><b>Drop a real meal photo here</b>'
            '<s>Save one as marketing/appstore/meal.jpg and re-run gen.py.<br>'
            'A drawn plate would be advertising a photo the app never analyzed.</s></div>')

s1 = f"""<div class="body">
<div class="navbar"><a class="q">Retake</a><div class="mid"><div class="t">Meal Photo</div>
<div class="st">Analyzed in 3.1s</div></div><a>Save</a></div>
<div class="card">{shot}
<div style="margin-top:11px"><span class="chip">&#10003; Identified</span></div>
<div class="mealname">Grilled chicken &amp; rice bowl</div>
<div class="mealkcal">1 bowl &middot; 612 kcal</div>
{bar("Protein", 48, 52, PROTEIN)}
{bar("Carbs", 61, 68, CARBS)}
{bar("Fat", 18, 22, FAT)}
</div>
<div class="pills"><span>Breakfast</span><span class="on">Lunch</span><span>Dinner</span><span>Snack</span></div>
<div class="cta">Save to today</div>
</div>"""

# ---------------------------------------------------------------- slide 2
nl = """<div class="nl">
<div class="nl-t">Nutrition Facts</div><div class="nl-r1"></div>
<div class="nl-s">8 servings per container</div>
<div class="nl-sz"><span>Serving size</span><span>2/3 cup (55g)</span></div>
<div class="nl-r2"></div>
<div class="nl-ca">Amount per serving</div>
<div class="nl-cal"><span>Calories</span><span class="big">230</span></div>
<div class="nl-r3"></div>
<div class="nl-dv">% Daily Value*</div>
<div class="nl-rows">
<div class="nl-row"><span><b>Total Fat</b> 8g</span><span><b>10%</b></span></div>
<div class="nl-row ind"><span>Saturated Fat 1g</span><span><b>5%</b></span></div>
<div class="nl-row ind"><span><i>Trans</i> Fat 0g</span><span></span></div>
<div class="nl-row"><span><b>Cholesterol</b> 0mg</span><span><b>0%</b></span></div>
<div class="nl-row"><span><b>Sodium</b> 160mg</span><span><b>7%</b></span></div>
<div class="nl-row"><span><b>Total Carbohydrate</b> 37g</span><span><b>13%</b></span></div>
<div class="nl-row ind"><span>Dietary Fiber 4g</span><span><b>14%</b></span></div>
<div class="nl-row ind"><span>Total Sugars 12g</span><span></span></div>
<div class="nl-row ind2"><span>Includes 10g Added Sugars</span><span><b>20%</b></span></div>
<div class="nl-row"><span><b>Protein</b> 3g</span><span></span></div>
</div>
<div class="nl-fine">*The % Daily Value tells you how much a nutrient in a serving of food
contributes to a daily diet. 2,000 calories a day is used for general nutrition advice.</div>
</div>"""

s2 = f"""<div class="body cam">
<div class="camtop"><div class="seg"><span>Barcode</span><span class="on">Nutrition Label</span></div>
<div class="close">&#10005;</div></div>
<div class="frame">{nl}</div>
<div><div class="hint">Frame the Nutrition Facts panel</div>
<div class="shutter"></div></div>
</div>"""

# ---------------------------------------------------------------- slide 3
s3 = f"""<div class="body">
<div class="navc"><s>&lsaquo;</s><b>Thu, Sep 18</b><s>&rsaquo;</s></div>
<div class="card"><div class="ct">Calories</div>
<div class="ring">{donut(142, 13, 0.836, PRIMARY)}
<div class="ringc"><div class="rv">1,840</div><div class="rl">consumed</div>
<div class="rr">360</div><div class="rl2">remaining</div></div></div>
<div class="split"><div><b>2,200</b><s>Goal</s></div><u>&minus;</u><div><b>1,840</b><s>Food</s></div>
<u>=</u><div><b class="g">360</b><s>Left</s></div></div></div>
<div class="card"><div class="ct">Macros</div>
{bar("Protein", 148, 165, PROTEIN)}
{bar("Carbs", 196, 232, CARBS)}
{bar("Fat", 54, 68, FAT)}
{bar("Fiber", 26, 30, FIBER)}
</div></div>"""

# ---------------------------------------------------------------- slide 4
s4 = f"""<div class="body">
<div class="eyebrow">Key Insights</div>
<div class="gu"><div class="guh"><div class="gut">Goals updated</div><div class="gux">&times;</div></div>
<div class="gub">You're down 5.4 lb since these targets were set, so they've been
recalculated to keep you on plan.</div>
<div class="gur"><span class="gurl">Calories</span>
<span class="gurv">2,240 &rarr; 2,200 <span class="gurd">&minus;40</span></span></div>
<div class="gur"><span class="gurl">Protein</span>
<span class="gurv">170 &rarr; 165 g <span class="gurd">&minus;5</span></span></div>
<div class="guf">Turn off auto-update</div></div>
<div class="sect">Body weight</div>
<div class="card" style="padding:13px 13px 10px">
<div style="display:flex;align-items:baseline;gap:9px;margin-bottom:8px">
<span style="font-family:'DM Serif Display',serif;font-size:21px;color:{TEXT}">178.2 lb</span>
<span style="font-size:10.5px;font-weight:700;color:{PRIMARY}">&minus;5.4 lb</span>
<span style="margin-left:auto;font-size:8.5px;color:{FAINT}">12 weeks</span></div>
<svg width="100%" viewBox="0 0 194 70" preserveAspectRatio="xMidYMid meet">
<polyline points="2,6 18,9 34,7 50,15 66,20 82,18 98,29 114,34 130,32 146,43 162,48 178,53 192,56 192,70 2,70"
 fill="{PRIMARY}14" stroke="none"/>
<polyline points="2,6 18,9 34,7 50,15 66,20 82,18 98,29 114,34 130,32 146,43 162,48 178,53 192,56"
 fill="none" stroke="{PRIMARY}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="192" cy="56" r="3" fill="{PRIMARY}"/>
</svg>
<div style="display:flex;justify-content:space-between;font-size:8px;color:{FAINT};margin-top:3px">
<span>Jun 24</span><span>Sep 18</span></div></div>
<div class="sect">This week</div>
<div class="card" style="margin-bottom:0">
{bar("Calories", 2187, 2200, PRIMARY, " avg")}
{bar("Protein", 161, 165, PROTEIN)}
</div>
</div>"""


# ---------------------------------------------------------------- slide 5
SKIN = "#D9CFC0"


def figure(front=True):
    """A body map: one silhouette, each muscle region tinted by training volume.

    Drawn as SVG rather than divs so the limbs actually meet the torso.
    """
    if front:
        shoulders, torso_up, torso_lo = "#6E8F79", PRIMARY, "#C5D6CB"
        upper_arm, fore_arm = "#9DBAA8", "#C5D6CB"
        thigh, calf = PRIMARY_DARK, "#8FAE9D"
    else:
        shoulders, torso_up, torso_lo = PRIMARY, PRIMARY_DARK, "#9DBAA8"
        upper_arm, fore_arm = "#8FAE9D", "#C5D6CB"
        thigh, calf = PRIMARY, "#6E8F79"

    p = []
    a = p.append
    a(f'<circle cx="21" cy="7" r="6.4" fill="{SKIN}"/>')
    a(f'<rect x="18.4" y="12.4" width="5.2" height="4" rx="1.8" fill="{SKIN}"/>')
    a(f'<rect x="8.6" y="15.4" width="24.8" height="7.6" rx="3.8" fill="{shoulders}"/>')
    a(f'<path d="M10.6 20 H31.4 L29.6 34 H12.4 Z" fill="{torso_up}"/>')
    a(f'<path d="M12.4 33 H29.6 L28.4 45 H13.6 Z" fill="{torso_lo}"/>')
    for sx in (0, 1):
        x1 = 4.4 if sx == 0 else 32.2
        a(f'<rect x="{x1}" y="17.6" width="5.4" height="15" rx="2.7" fill="{upper_arm}"/>')
        a(f'<rect x="{x1 - .4}" y="30.4" width="4.8" height="14" rx="2.4" fill="{fore_arm}"/>')
    a(f'<rect x="13.2" y="43.4" width="15.6" height="5" rx="2.4" fill="{torso_lo}"/>')
    for sx in (0, 1):
        x1 = 13.6 if sx == 0 else 21.8
        a(f'<rect x="{x1}" y="46.6" width="6.6" height="16.5" rx="3" fill="{thigh}"/>')
        a(f'<rect x="{x1 + .5}" y="61" width="5.6" height="15" rx="2.6" fill="{calf}"/>')
    return (f'<div><svg width="50" height="93" viewBox="0 0 42 78">{"".join(p)}</svg>'
            f'<div class="figcap">{"Front" if front else "Back"}</div></div>')


LEG = [("Legs", "32%", "#2F5340"), ("Back", "24%", "#3F6B52"),
       ("Chest", "19%", "#6E8F79"), ("Arms", "14%", "#9DBAA8"),
       ("Shoulders", "11%", "#C5D6CB")]
legend = "".join(
    f'<div class="lrow"><span class="lsw" style="background:{c}"></span>'
    f'<span class="lnm">{n}</span><span class="lpc">{p}</span></div>'
    for n, p, c in LEG)

VOL = [
    [3, 2, 0, 3, 1, 0, 0], [2, 0, 3, 0, 2, 0, 0], [3, 1, 0, 2, 3, 0, 0],
    [0, 3, 2, 0, 1, 2, 0], [3, 0, 2, 3, 0, 0, 0], [1, 2, 0, 3, 2, 0, 0],
    [3, 0, 3, 0, 2, 1, 0], [2, 3, 0, 2, 0, 0, 0], [0, 2, 3, 0, 3, 0, 0],
    [3, 1, 0, 3, 2, 0, 0], [2, 0, 3, 1, 0, 2, 0], [3, 2, 0, 3, 0, 0, 0],
]
SHADE = [BORDER, "#B7CCBF", "#6E8F79", PRIMARY_DARK]
gridcols = "".join(
    '<div class="gcol">' + "".join(
        f'<div class="gc" style="background:{SHADE[v]}"></div>' for v in col
    ) + "</div>" for col in VOL)

s5 = f"""<div class="body">
<div class="eyebrow">Exercise</div>
<div class="sect">Training split</div>
<div class="card"><div class="bmrow">{figure(True)}{figure(False)}
<div class="legend">{legend}</div></div></div>
<div class="sect">Consistency</div>
<div class="streak">
<div class="stile"><b>6</b><s>weeks</s><i>Current streak</i></div>
<div class="stile"><b>27</b><s>sessions</s><i>Last 12 weeks</i></div></div>
<div class="card" style="margin-bottom:0"><div class="grid">{gridcols}</div>
<div class="gnote">Sets logged per day &middot; longest gap 3 days</div></div>
</div>"""

# ---------------------------------------------------------------- slide 6
# WorkoutSummaryScreen: stat grid, then HeartRateGraph — Avg/Peak/Low, a
# polyline split into same-zone runs, then the stacked zone bar and legend.
HR = [
    (34, 52, Z1), (46, 47, Z1), (58, 40, Z2), (70, 36, Z2), (82, 30, Z3),
    (94, 26, Z3), (106, 33, Z3), (118, 22, Z4), (130, 17, Z4), (142, 24, Z3),
    (154, 14, Z4), (166, 9, Z5), (178, 15, Z4), (190, 19, Z4), (200, 17, Z4),
]
segs = "".join(
    f'<line x1="{HR[i][0]}" y1="{HR[i][1]}" x2="{HR[i+1][0]}" y2="{HR[i+1][1]}" '
    f'stroke="{HR[i+1][2]}" stroke-width="2.4" stroke-linecap="round"/>'
    for i in range(len(HR) - 1))
gridlines = "".join(
    f'<line x1="34" y1="{y}" x2="206" y2="{y}" stroke="{BORDER}" stroke-width="1"/>'
    f'<text x="4" y="{y + 3}" font-size="9" fill="{FAINT}">{v}</text>'
    for y, v in [(12, 190), (36, 148), (60, 90)])

ZONE_SHARE = [("Aerobic", Z3, 34, "18m"), ("Threshold", Z4, 48, "25m"), ("Max", Z5, 18, "9m")]
zbar = "".join(f'<div style="flex:{s};background:{c}"></div>' for _, c, s, _ in ZONE_SHARE)
zrows = "".join(
    f'<div class="zrow"><span class="zdot" style="background:{c}"></span>'
    f'<span class="zname">{n}</span>'
    f'<span class="zrange">{next(r for zn, _, r in ZONES if zn == n)} bpm</span>'
    f'<span class="ztime">{t}</span></div>'
    for n, c, _, t in ZONE_SHARE)

STATS = [("52:18", PRIMARY, "Duration"), ("8,420 lb", ACCENT, "Volume"),
         ("20/20", WARNING, "Sets"), ("148", PROTEIN, "Reps"),
         ("5", INFO, "Exercises"), ("412 kcal", DANGER, "Active Energy")]
statcards = "".join(
    f'<div class="statcard"><b style="color:{col}">{v}</b><s>{lbl}</s></div>'
    for v, col, lbl in STATS)

s6 = f"""<div class="body">
<div><span class="badge">Completed</span></div>
<div class="wtitle">Push Day</div>
<div class="wdate">Thursday, September 18</div>
<div class="statgrid">{statcards}</div>
<div class="sect">Heart rate</div>
<div class="card" style="margin-bottom:0">
<div class="hrstats">
<div class="hrstat"><b style="color:{PRIMARY}">148</b><s>Avg bpm</s></div>
<div class="hrstat"><b style="color:{DANGER}">176</b><s>Peak bpm</s></div>
<div class="hrstat"><b style="color:{INFO}">102</b><s>Low bpm</s></div></div>
<svg width="100%" viewBox="0 0 210 84" preserveAspectRatio="xMidYMid meet">
{gridlines}{segs}
<text x="34" y="80" font-size="9" fill="{FAINT}">0min</text>
<text x="206" y="80" font-size="9" fill="{FAINT}" text-anchor="end">52min</text>
</svg>
<div class="zbar">{zbar}</div>
{zrows}
</div>
<div class="sect" style="margin-top:12px">Personal records</div>
<div class="card" style="margin-bottom:0">
<div style="display:flex;align-items:baseline;justify-content:space-between">
<span style="font-size:10.5px;font-weight:700;color:{TEXT}">Barbell Bench Press</span>
<span style="font-size:9.5px;color:{MUTED}">185 lb &times; 8</span></div>
</div></div>"""

SLIDES = [
    ("AI meal photo", "Snap it.<br>It's logged.",
     "Photograph the plate and the macros land in seconds — no searching a database, no guessing at portions.",
     s1, False),
    ("Smart camera", "Read the label.<br>Know the truth.",
     "Barcode databases are often wrong. Point the camera at the actual Nutrition Facts panel and get the real numbers.",
     s2, True),
    ("Nutrition", "Every macro,<br>one glance.",
     "Calories, protein, carbs, fat and fiber on one screen — no tab-hopping to see where you stand.",
     s3, False),
    ("Adaptive goals", "Targets that<br>follow your weight.",
     "Weigh in and your calories and macros recalculate themselves. No wizard to re-run, no stale numbers.",
     s4, False),
    ("Training insights", "See where the<br>work actually went.",
     "A body map of your training volume, plus twelve weeks of consistency at a glance.",
     s5, False),
    ("Every session", "Every set.<br>Every beat.",
     "Finish a workout and get the whole picture — volume, records, and how long you actually spent in each heart-rate zone.",
     s6, False),
]

for i, (kick, h1, sub, screen, dark) in enumerate(SLIDES):
    out = HERE / f"slide{i+1}.html"
    out.write_text(page(i, len(SLIDES), kick, h1, sub, screen, dark))
    print("wrote", out.name)

if not MEAL_SRC:
    print("\n!! No meal photo found. Slide 1 renders a placeholder.\n"
          "   Save a real photo as marketing/appstore/meal.jpg and re-run.")
