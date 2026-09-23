#!/usr/bin/env python3
"""Generate App Store screenshot slides (1284x2778) matching the HolyMacro template."""
import base64
import pathlib

HERE = pathlib.Path(__file__).parent
# The wordmark's glyph is the shipping app icon, so the slides can never drift
# from what people tap on their Home Screen.
ICON = base64.b64encode((HERE / ".." / ".." / "assets" / "icon.png").read_bytes()).decode()

# Editorial pack tokens, straight from src/theme/index.ts
BG, CARD, TEXT, MUTED, FAINT = "#F8F5F1", "#FFFFFF", "#221F1B", "#89807D", "#B5AB9E"
BORDER, BORDER_STRONG = "#E7E0D6", "#D6CBBC"
PRIMARY, PRIMARY_DARK, PRIMARY_SOFT = "#3F6B52", "#2F5340", "#E7EFEA"
PROTEIN, CARBS, FAT, FIBER = "#9C5B45", "#B98A3E", "#A46C74", "#6E7B63"
Z1, Z2, Z3, Z4, Z5 = "#4A6E85", "#74965C", "#C9A227", "#C4703A", "#A8342A"
GOLD = "#C9A227"

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
.brand span{{font-size:10.5px;font-weight:800;color:#E9EFE2;letter-spacing:.005em}}

.head{{position:absolute;top:139px;left:30px;right:30px}}
.kicker{{font-size:10px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:{GOLD}}}
h1{{font-family:'DM Serif Display',serif;font-weight:400;font-size:33px;line-height:1.20;
 color:#F1ECE0;margin-top:11px;letter-spacing:.002em}}
.sub{{font-size:11.5px;line-height:1.52;color:rgba(232,238,224,.70);margin-top:14px;max-width:300px}}

/* ---- device ---- */
.phone{{position:absolute;top:296px;left:50%;transform:translateX(-50%);
 width:238px;height:512px;background:#0B0C0B;border-radius:33px;padding:6px;
 box-shadow:0 26px 54px rgba(0,0,0,.46), 0 0 0 .8px rgba(255,255,255,.07)}}
.screen{{position:relative;width:100%;height:100%;border-radius:27px;overflow:hidden;background:{BG}}}
.screen.dark{{background:#111311}}
.island{{position:absolute;top:7px;left:50%;transform:translateX(-50%);
 width:66px;height:15px;border-radius:9px;background:#0B0C0B;z-index:5}}
.hibar{{position:absolute;bottom:6px;left:50%;transform:translateX(-50%);
 width:80px;height:3.5px;border-radius:2px;background:rgba(34,31,27,.30);z-index:5}}
.hibar.on-dark{{background:rgba(255,255,255,.34)}}
.body{{padding:36px 10px 14px}}
.body.cam{{position:absolute;inset:0;display:flex;flex-direction:column}}
.frame{{flex:none}}
.body.cam .frame{{flex:1;display:flex;min-height:0}}

/* ---- footer ---- */
.foot{{position:absolute;bottom:24px;left:30px;font-size:8px;font-weight:800;
 color:rgba(232,238,224,.46);letter-spacing:.02em}}
.dots{{position:absolute;bottom:25px;right:30px;display:flex;gap:5px;align-items:center}}
.dots i{{width:4px;height:4px;border-radius:50%;background:rgba(232,238,224,.26)}}
.dots i.on{{background:{GOLD}}}

/* ================= in-app UI ================= */
.navc{{display:flex;align-items:center;justify-content:center;gap:9px;margin-bottom:9px}}
.navc b{{font-size:10.5px;font-weight:800;color:{TEXT}}}
.navc s{{text-decoration:none;font-size:11px;color:{FAINT}}}
.navbar{{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:9px}}
.navbar .mid{{text-align:center;flex:1}}
.navbar .t{{font-family:'DM Serif Display',serif;font-size:16px;color:{TEXT};line-height:1.1}}
.navbar .st{{font-size:7px;color:{FAINT};margin-top:1px}}
.navbar a{{font-size:9px;font-weight:700;color:{PRIMARY};text-decoration:none}}
.navbar a.q{{color:{MUTED}}}
.eyebrow{{text-align:center;font-size:7.5px;font-weight:800;letter-spacing:.16em;
 text-transform:uppercase;color:{FAINT};margin-bottom:9px}}

.card{{background:{CARD};border-radius:13px;padding:11px;margin-bottom:8px;
 box-shadow:0 1px 3px rgba(34,31,27,.06)}}
.ct{{font-size:9.5px;font-weight:800;color:{TEXT};margin-bottom:7px}}
.sect{{font-size:9.5px;font-weight:800;color:{TEXT};margin:0 2px 6px}}

/* macro bar — mirrors src/components/MacroBar.tsx */
.mb{{margin-bottom:8px}}
.mb:last-child{{margin-bottom:0}}
.mbh{{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px}}
.mbl{{font-size:9px;font-weight:700;color:{TEXT}}}
.mbv{{font-family:'DM Serif Display',serif;font-size:10px;color:{TEXT}}}
.mbg{{font-family:'DM Serif Display',serif;font-size:8px;color:{FAINT}}}
.mbt{{height:4px;border-radius:2px;background:{BORDER_STRONG};overflow:hidden}}
.mbf{{height:100%;border-radius:2px}}

/* calorie ring */
.ring{{position:relative;width:108px;height:108px;margin:2px auto 0}}
.ringc{{position:absolute;inset:0;display:flex;flex-direction:column;
 align-items:center;justify-content:center}}
.rv{{font-family:'DM Serif Display',serif;font-size:23px;color:{TEXT};line-height:1.05}}
.rl{{font-size:7.5px;color:{FAINT};margin-top:1px}}
.rr{{font-family:'DM Serif Display',serif;font-size:14px;color:{PRIMARY};margin-top:6px;line-height:1}}
.rl2{{font-size:7px;color:{FAINT};margin-top:1px}}
.split{{display:flex;justify-content:center;align-items:baseline;gap:9px;margin-top:7px}}
.split div{{text-align:center}}
.split b{{font-family:'DM Serif Display',serif;font-size:11px;color:{TEXT};font-weight:400}}
.split b.g{{color:{PRIMARY}}}
.split s{{display:block;text-decoration:none;font-size:6.5px;color:{FAINT};margin-top:1px}}
.split u{{text-decoration:none;font-size:10px;color:{FAINT};align-self:center}}

/* goals-updated card — src/components/GoalsUpdatedCard.tsx */
.gu{{background:{PRIMARY_SOFT};border:1px solid {PRIMARY}55;border-radius:13px;
 padding:11px;margin-bottom:8px}}
.guh{{display:flex;justify-content:space-between;align-items:center}}
.gut{{font-family:'DM Serif Display',serif;font-size:11px;color:{PRIMARY_DARK}}}
.gux{{font-size:13px;color:{PRIMARY_DARK};line-height:1}}
.gub{{font-size:8.5px;line-height:1.5;color:{TEXT};margin-top:4px}}
.gur{{display:flex;justify-content:space-between;align-items:baseline;margin-top:6px}}
.gurl{{font-size:8.5px;color:{MUTED}}}
.gurv{{font-size:9px;font-weight:700;color:{TEXT}}}
.gurd{{color:{PRIMARY_DARK};font-weight:500}}
.guf{{margin-top:9px;padding-top:8px;border-top:1px solid {PRIMARY}33;
 font-size:8.5px;font-weight:700;color:{PRIMARY_DARK}}}

/* body heat map + split legend */
.bmrow{{display:flex;gap:6px;align-items:flex-start}}
.fig{{width:42px}}
.figcap{{text-align:center;font-size:6.5px;color:{FAINT};margin-top:3px}}
.legend{{flex:1;display:flex;flex-direction:column;gap:5px;padding-top:4px}}
.lrow{{display:flex;align-items:center;gap:6px}}
.lsw{{width:7px;height:7px;border-radius:2px}}
.lnm{{flex:1;font-size:8.5px;color:{TEXT}}}
.lpc{{font-size:8.5px;font-weight:700;color:{MUTED};font-variant-numeric:tabular-nums}}

/* consistency grid */
.grid{{display:flex;gap:3px}}
.gcol{{display:flex;flex-direction:column;gap:3px}}
.gc{{width:11px;height:11px;border-radius:2.5px}}
.gnote{{font-size:7.5px;color:{FAINT};margin-top:8px}}
.streak{{display:flex;gap:6px;margin-bottom:8px}}
.stile{{flex:1;background:{CARD};border-radius:11px;padding:9px;
 box-shadow:0 1px 3px rgba(34,31,27,.06)}}
.stile b{{font-family:'DM Serif Display',serif;font-size:16px;color:{TEXT};font-weight:400;line-height:1}}
.stile s{{display:block;text-decoration:none;font-size:6.5px;color:{FAINT};margin-top:2px}}
.stile i{{display:block;font-style:normal;font-size:8px;font-weight:700;color:{TEXT};margin-top:4px}}

/* HR zone chart */
.zlg{{display:flex;gap:7px;margin-top:8px;flex-wrap:wrap}}
.zi{{display:flex;align-items:center;gap:3.5px;font-size:7px;color:{MUTED}}}
.zi b{{width:6px;height:6px;border-radius:50%}}
.hrnow{{display:flex;align-items:baseline;gap:4px;margin-bottom:7px}}
.hrnow b{{font-family:'DM Serif Display',serif;font-size:20px;color:{Z4};font-weight:400;line-height:1}}
.hrnow s{{text-decoration:none;font-size:8px;color:{MUTED}}}
.hrnow em{{font-style:normal;margin-left:auto;font-size:7.5px;font-weight:700;
 color:{Z4};background:{Z4}1F;padding:2.5px 6px;border-radius:99px}}

/* set logger */
.ex{{font-size:9.5px;font-weight:800;color:{TEXT};margin-bottom:7px}}
.shrow{{display:flex;gap:5px;align-items:center;margin-bottom:4px}}
.sn{{width:15px;height:15px;border-radius:50%;background:{PRIMARY};color:#fff;
 font-size:7.5px;font-weight:800;display:flex;align-items:center;justify-content:center;flex:none}}
.sn.off{{background:{BORDER};color:{FAINT}}}
.sf{{flex:1;background:{BG};border:1px solid {BORDER};border-radius:6px;padding:4px 0;
 text-align:center;font-size:9px;font-weight:700;color:{TEXT}}}
.sck{{width:15px;height:15px;border-radius:5px;border:1px solid {BORDER_STRONG};flex:none;
 display:flex;align-items:center;justify-content:center;font-size:8px;color:#fff}}
.sck.on{{background:{PRIMARY};border-color:{PRIMARY}}}
.shdr{{display:flex;gap:5px;padding-left:20px;margin-bottom:3px}}
.shdr span{{flex:1;text-align:center;font-size:6.5px;color:{FAINT}}}
.shdr i{{width:15px;flex:none}}
.rest{{position:absolute;left:0;right:0;bottom:0;background:{PRIMARY_SOFT};
 border-top:1px solid {PRIMARY}33;padding:8px 10px 13px;display:flex;
 align-items:center;justify-content:space-between}}
.restb{{background:{PRIMARY};color:#fff;font-size:8px;font-weight:800;
 padding:5px 9px;border-radius:8px}}

/* camera */
.seg{{display:flex;justify-content:center;gap:0;margin:0 auto;background:rgba(255,255,255,.10);
 border-radius:99px;padding:2px;width:max-content}}
.seg span{{font-size:7.5px;font-weight:700;color:rgba(255,255,255,.62);padding:3.5px 10px;border-radius:99px}}
.seg span.on{{background:{PRIMARY};color:#fff}}
.camtop{{display:flex;align-items:center;justify-content:space-between;padding:0 4px}}
.close{{font-size:7.5px;font-weight:700;color:rgba(255,255,255,.75);
 background:rgba(255,255,255,.12);padding:3.5px 8px;border-radius:99px}}
.hint{{text-align:center;font-size:7.5px;font-weight:700;color:rgba(255,255,255,.88);margin-top:10px}}
.shutter{{width:38px;height:38px;border-radius:50%;border:2.5px solid rgba(255,255,255,.9);
 background:{PRIMARY};margin:8px auto 0}}
.frame{{position:relative;margin-top:9px;border-radius:5px;overflow:hidden;
 box-shadow:0 0 0 2px {PRIMARY}, 0 8px 22px rgba(0,0,0,.5)}}

/* FDA nutrition label */
.nl{{background:#fff;padding:9px 9px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
 color:#000;flex:1;display:flex;flex-direction:column}}
.nl-rows{{flex:1;display:flex;flex-direction:column;justify-content:space-between}}
.nl-t{{font-size:19px;font-weight:800;letter-spacing:-.5px;line-height:1}}
.nl-r1{{height:1px;background:#000;margin:2.5px 0}}
.nl-r2{{height:6px;background:#000;margin:2.5px 0}}
.nl-r3{{height:3px;background:#000;margin:2.5px 0}}
.nl-s{{font-size:7px}}
.nl-sz{{display:flex;justify-content:space-between;font-size:8.5px;font-weight:700;margin-top:1px}}
.nl-ca{{font-size:6.5px;margin-top:2px}}
.nl-cal{{display:flex;justify-content:space-between;align-items:flex-end;font-size:10.5px;font-weight:800}}
.nl-cal .big{{font-size:23px;letter-spacing:-.8px;line-height:.9}}
.nl-dv{{text-align:right;font-size:6.5px;font-weight:700;border-top:1px solid #000;padding-top:1px}}
.nl-row{{display:flex;justify-content:space-between;font-size:7.5px;border-top:1px solid #000;padding:1.2px 0}}
.nl-row.ind{{padding-left:9px}}
.nl-row.ind2{{padding-left:17px}}
.nl-fine{{font-size:5.5px;line-height:1.35;border-top:3px solid #000;padding-top:2px;margin-top:1px}}

/* meal photo */
.plate{{position:relative;height:102px;border-radius:10px;overflow:hidden;
 background:radial-gradient(120% 110% at 28% 14%,#57493C 0%,#3A3029 52%,#241D19 100%)}}
.bowl{{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
 width:90px;height:90px;border-radius:50%;background:#ECE3D4;overflow:hidden;
 box-shadow:0 7px 20px rgba(0,0,0,.5), inset 0 0 0 4px #F6F0E5}}
.bowl b{{position:absolute;border-radius:50%;display:block}}
.util{{position:absolute;width:5px;border-radius:3px;background:#C9C4BC}}
.chip{{display:inline-flex;align-items:center;gap:4px;background:{PRIMARY_SOFT};
 color:{PRIMARY_DARK};border-radius:99px;padding:3.5px 8px;font-size:7.5px;font-weight:800}}
.mealname{{font-family:'DM Serif Display',serif;font-size:13px;color:{TEXT};margin-top:8px}}
.mealkcal{{font-size:8px;color:{MUTED};margin-top:2px;margin-bottom:9px}}
.pills{{display:flex;gap:4px;margin-bottom:11px}}
.pills span{{flex:1;text-align:center;font-size:7.5px;font-weight:700;color:{MUTED};
 background:{CARD};border:1px solid {BORDER};border-radius:99px;padding:4.5px 0}}
.pills span.on{{background:{PRIMARY};border-color:{PRIMARY};color:#fff}}
.cta{{background:{PRIMARY};color:#fff;text-align:center;font-size:9.5px;font-weight:800;
 padding:9px 0;border-radius:10px}}

/* water */
.wrow{{display:flex;align-items:center;gap:6px}}
.wrow .wv{{font-family:'DM Serif Display',serif;font-size:14px;color:{TEXT}}}
.wrow .wg{{font-family:'DM Serif Display',serif;font-size:9px;color:{FAINT}}}
.wcup{{flex:1;height:14px;border-radius:3px;background:{BORDER}}}
.wcup.on{{background:#5E7A8C}}

/* meal rows */
.mrow{{display:flex;align-items:baseline;justify-content:space-between;
 padding:6px 0;border-top:1px solid {BORDER}}}
.mrow:first-of-type{{border-top:none;padding-top:0}}
.mrow .mn{{font-size:8.5px;font-weight:700;color:{TEXT}}}
.mrow .md{{font-size:7px;color:{FAINT};margin-top:1px}}
.mrow .mk{{font-family:'DM Serif Display',serif;font-size:11px;color:{TEXT}}}

/* 3-up stat strip */
.trio{{display:flex;justify-content:space-between;text-align:center}}
.trio div{{flex:1}}
.trio b{{font-family:'DM Serif Display',serif;font-size:15px;font-weight:400;line-height:1;display:block}}
.trio s{{text-decoration:none;font-size:6.5px;color:{FAINT};display:block;margin-top:2px}}
.trio i{{font-style:normal;font-size:7.5px;font-weight:700;color:{TEXT};display:block;margin-top:3px}}
.tfoot{{margin-top:9px;padding-top:8px;border-top:1px solid {BORDER};
 font-size:7.5px;color:{MUTED}}}
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
<div class="foot">HolyMacro — Nutrition &amp; Training</div>
<div class="dots">{dots}</div>
</body></html>"""


def bar(label, cur, goal, color, unit="g"):
    pct = min(cur / goal, 1) * 100
    return f"""<div class="mb"><div class="mbh"><span class="mbl">{label}</span>
<span><span class="mbv">{cur:,}</span><span class="mbg"> / {goal:,}{unit}</span></span></div>
<div class="mbt"><div class="mbf" style="width:{pct:.1f}%;background:{color}"></div></div></div>"""


def donut(size, stroke, pct, color, track=BORDER):
    r = (size - stroke) / 2
    c = 2 * 3.141592653589793 * r
    return f"""<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}" style="transform:rotate(-90deg)">
<circle cx="{size/2}" cy="{size/2}" r="{r}" fill="none" stroke="{track}" stroke-width="{stroke}"/>
<circle cx="{size/2}" cy="{size/2}" r="{r}" fill="none" stroke="{color}" stroke-width="{stroke}"
 stroke-linecap="round" stroke-dasharray="{c*pct:.2f} {c:.2f}"/></svg>"""


# ---------------------------------------------------------------- slide 1
plate = """<div class="plate">
<div class="bowl">
  <b style="width:48px;height:38px;left:1px;top:4px;background:#3E5C2A"></b>
  <b style="width:26px;height:22px;left:12px;top:2px;background:#557A38"></b>
  <b style="width:22px;height:19px;left:2px;top:22px;background:#4C6E31"></b>
  <b style="width:40px;height:33px;left:44px;top:1px;background:#EFE6CF"></b>
  <b style="width:17px;height:15px;left:52px;top:8px;background:#F7F1E2"></b>
  <b style="width:42px;height:30px;left:6px;top:46px;background:#CFA463"></b>
  <b style="width:19px;height:13px;left:14px;top:52px;background:#DBB579"></b>
  <b style="width:34px;height:28px;left:48px;top:48px;background:#BC8B42"></b>
  <b style="width:15px;height:11px;left:56px;top:54px;background:#D2A353"></b>
  <b style="width:15px;height:14px;left:9px;top:31px;background:#AE3E2C"></b>
  <b style="width:12px;height:11px;left:60px;top:34px;background:#BD4732"></b>
  <b style="width:10px;height:9px;left:38px;top:70px;background:#AE3E2C"></b>
  <b style="width:19px;height:12px;left:31px;top:60px;background:#7E9B52"></b>
  <b style="width:14px;height:9px;left:34px;top:36px;background:#8FAA5C"></b>
  <b style="width:9px;height:8px;left:24px;top:66px;background:#E8DFC8"></b>
  <b style="width:8px;height:7px;left:44px;top:26px;background:#E8DFC8"></b>
</div>
</div>"""

s1 = f"""<div class="body">
<div class="navbar"><a class="q">Retake</a><div class="mid"><div class="t">Meal Photo</div>
<div class="st">Analyzed in 3.1s</div></div><a>Save</a></div>
<div class="card">{plate}
<div style="margin-top:9px"><span class="chip">✓ Identified</span></div>
<div class="mealname">Grilled chicken &amp; rice bowl</div>
<div class="mealkcal">1 bowl · 612 kcal</div>
{bar("Protein", 48, 52, PROTEIN)}
{bar("Carbs", 61, 68, CARBS)}
{bar("Fat", 18, 22, FAT)}
{bar("Fiber", 9, 11, FIBER)}
</div>
<div class="sect" style="margin-top:11px">Add to</div>
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

s2 = f"""<div class="body cam" style="padding:36px 10px 22px">
<div class="camtop"><div class="seg"><span>Barcode</span><span class="on">Nutrition Label</span></div>
<div class="close">✕</div></div>
<div class="frame">{nl}</div>
<div style="margin-top:auto">
<div class="hint">Frame the Nutrition Facts panel</div>
<div class="shutter"></div></div>
</div>"""

# ---------------------------------------------------------------- slide 3
s3 = f"""<div class="body">
<div class="navc"><s>‹</s><b>Thu, Sep 18</b><s>›</s></div>
<div class="card"><div class="ct">Calories</div>
<div class="ring">{donut(108, 10, 0.836, PRIMARY)}
<div class="ringc"><div class="rv">1,840</div><div class="rl">consumed</div>
<div class="rr">360</div><div class="rl2">remaining</div></div></div>
<div class="split"><div><b>2,200</b><s>Goal</s></div><u>−</u><div><b>1,840</b><s>Food</s></div>
<u>=</u><div><b class="g">360</b><s>Left</s></div></div></div>
<div class="card"><div class="ct">Macros</div>
{bar("Protein", 148, 165, PROTEIN)}
{bar("Carbs", 196, 232, CARBS)}
{bar("Fat", 54, 68, FAT)}
{bar("Fiber", 26, 30, FIBER)}
</div>
<div class="card"><div class="ct">Water</div>
<div class="wrow"><span class="wv">6</span><span class="wg">/ 8 cups</span>
<span class="wcup on"></span><span class="wcup on"></span><span class="wcup on"></span>
<span class="wcup on"></span><span class="wcup on"></span><span class="wcup on"></span>
<span class="wcup"></span><span class="wcup"></span></div></div>
<div class="card" style="margin-bottom:0"><div class="ct">Today's meals</div>
<div class="mrow"><div><div class="mn">Breakfast</div><div class="md">Greek yogurt · berries · granola</div></div>
<span class="mk">412</span></div>
<div class="mrow"><div><div class="mn">Lunch</div><div class="md">Grilled chicken &amp; rice bowl</div></div>
<span class="mk">612</span></div>
<div class="mrow"><div><div class="mn">Dinner</div><div class="md">Salmon · sweet potato · greens</div></div>
<span class="mk">684</span></div>
</div></div>"""

# ---------------------------------------------------------------- slide 4
s4 = f"""<div class="body">
<div class="eyebrow">Key Insights</div>
<div class="gu"><div class="guh"><div class="gut">Goals updated</div><div class="gux">×</div></div>
<div class="gub">You're down 5.4 lb since these targets were set, so they've been
recalculated to keep you on plan.</div>
<div class="gur"><span class="gurl">Calories</span>
<span class="gurv">2,240 → 2,200 <span class="gurd">−40</span></span></div>
<div class="gur"><span class="gurl">Protein</span>
<span class="gurv">170 → 165 g <span class="gurd">−5</span></span></div>
<div class="guf">Turn off auto-update</div></div>
<div class="sect">Body weight</div>
<div class="card" style="padding:11px 11px 8px">
<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:6px">
<span style="font-family:'DM Serif Display',serif;font-size:17px;color:{TEXT}">178.2 lb</span>
<span style="font-size:9px;font-weight:700;color:{PRIMARY}">−5.4 lb</span>
<span style="margin-left:auto;font-size:7px;color:{FAINT}">12 weeks</span></div>
<svg width="100%" viewBox="0 0 194 58" preserveAspectRatio="xMidYMid meet">
<polyline points="2,6 18,9 34,7 50,14 66,18 82,16 98,25 114,29 130,27 146,36 162,40 178,44 192,46"
 fill="none" stroke="{PRIMARY}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<polyline points="2,6 18,9 34,7 50,14 66,18 82,16 98,25 114,29 130,27 146,36 162,40 178,44 192,46 192,58 2,58"
 fill="{PRIMARY}14" stroke="none"/>
<circle cx="192" cy="46" r="2.6" fill="{PRIMARY}"/>
<line x1="2" y1="46" x2="192" y2="46" stroke="{BORDER}" stroke-width="1" stroke-dasharray="2 3"/>
</svg>
<div style="display:flex;justify-content:space-between;font-size:6.5px;color:{FAINT};margin-top:2px">
<span>Jun 24</span><span>Sep 18</span></div></div>
<div class="sect">This week</div>
<div class="card" style="margin-bottom:0"><div class="trio">
<div><b style="color:{PRIMARY}">2,187</b><s>kcal</s><i>Avg / day</i></div>
<div><b style="color:{PROTEIN}">161</b><s>g</s><i>Avg protein</i></div>
<div><b style="color:{CARBS}">4</b><s>sessions</s><i>Workouts</i></div>
</div>
<div class="tfoot">Averaged across the 7 days you logged · 12-day streak</div></div>
<div class="sect">Hitting your targets</div>
<div class="card" style="margin-bottom:0">
{bar("Calories", 2187, 2200, PRIMARY, " avg")}
{bar("Protein", 161, 165, PROTEIN)}
{bar("Fiber", 28, 30, FIBER)}
</div>
</div>"""


# ---------------------------------------------------------------- slide 5
SKIN = "#D9CFC0"


def figure(front=True):
    """A body map: one silhouette, each muscle region tinted by training volume.

    Drawn as SVG rather than divs so the limbs actually join the torso — the
    div version left visible gaps at every seam and read as loose blocks.
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
    a(f'<circle cx="21" cy="7" r="6.4" fill="{SKIN}"/>')                 # head
    a(f'<rect x="18.4" y="12.4" width="5.2" height="4" rx="1.8" fill="{SKIN}"/>')  # neck
    a(f'<rect x="8.6" y="15.4" width="24.8" height="7.6" rx="3.8" fill="{shoulders}"/>')
    a(f'<path d="M10.6 20 H31.4 L29.6 34 H12.4 Z" fill="{torso_up}"/>')  # chest / upper back
    a(f'<path d="M12.4 33 H29.6 L28.4 45 H13.6 Z" fill="{torso_lo}"/>')  # abs / lumbar
    for sx in (0, 1):                                                     # arms, both sides
        x1 = 4.4 if sx == 0 else 32.2
        a(f'<rect x="{x1}" y="17.6" width="5.4" height="15" rx="2.7" fill="{upper_arm}"/>')
        a(f'<rect x="{x1 - .4}" y="30.4" width="4.8" height="14" rx="2.4" fill="{fore_arm}"/>')
    a(f'<rect x="13.2" y="43.4" width="15.6" height="5" rx="2.4" fill="{torso_lo}"/>')  # hips
    for sx in (0, 1):                                                     # legs
        x1 = 13.6 if sx == 0 else 21.8
        a(f'<rect x="{x1}" y="46.6" width="6.6" height="16.5" rx="3" fill="{thigh}"/>')
        a(f'<rect x="{x1 + .5}" y="61" width="5.6" height="15" rx="2.6" fill="{calf}"/>')
    return (f'<div class="fig"><svg width="42" height="78" viewBox="0 0 42 78">{"".join(p)}</svg>'
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

WEEKLY = [58, 64, 52, 71, 66, 78, 70, 83, 76, 88, 81, 95]
volbars = "".join(
    f'<rect x="{i*16.2:.1f}" y="{52-v*0.50:.1f}" width="11" height="{v*0.50:.1f}" rx="2.5" '
    f'fill="{PRIMARY_DARK if i == len(WEEKLY)-1 else "#8FAE9D"}"/>'
    for i, v in enumerate(WEEKLY))

s5 = f"""<div class="body">
<div class="eyebrow">Exercise</div>
<div class="sect">Training split</div>
<div class="card"><div class="bmrow">{figure(True)}{figure(False)}
<div class="legend">{legend}</div></div></div>
<div class="sect">Consistency</div>
<div class="streak">
<div class="stile"><b>6</b><s>weeks</s><i>Current streak</i></div>
<div class="stile"><b>27</b><s>sessions</s><i>Last 12 weeks</i></div></div>
<div class="card"><div class="grid">{gridcols}</div>
<div class="gnote">Sets logged per day · longest gap 3 days</div></div>
<div class="sect">Weekly volume</div>
<div class="card" style="margin-bottom:0">
<svg width="100%" viewBox="0 0 194 52" preserveAspectRatio="xMidYMid meet">{volbars}</svg>
<div style="display:flex;justify-content:space-between;font-size:6.5px;color:{FAINT};margin-top:3px">
<span>12 wks ago</span><span>48.2k lb this week</span></div></div>
</div>"""

# ---------------------------------------------------------------- slide 6
HR = [
    (0, 44, Z1), (14, 40, Z1), (28, 34, Z2), (42, 30, Z2), (56, 25, Z3),
    (70, 22, Z3), (84, 27, Z3), (98, 18, Z4), (112, 14, Z4), (126, 20, Z3),
    (140, 11, Z4), (154, 7, Z5), (168, 12, Z4), (182, 17, Z4), (194, 15, Z4),
]
segs = "".join(
    f'<line x1="{HR[i][0]}" y1="{HR[i][1]}" x2="{HR[i+1][0]}" y2="{HR[i+1][1]}" '
    f'stroke="{HR[i+1][2]}" stroke-width="2.2" stroke-linecap="round"/>'
    for i in range(len(HR) - 1))
zlegend = "".join(
    f'<div class="zi"><b style="background:{c}"></b>{n}</div>'
    for n, c in [("Easy", Z1), ("Aerobic", Z2), ("Tempo", Z3), ("Threshold", Z4), ("Max", Z5)])

s6 = f"""<div class="body" style="padding:36px 10px 0">
<div class="navbar"><a class="q">Cancel</a><div class="mid"><div class="t">24:18</div>
<div class="st">12 / 20 sets · Push Day</div></div><a>Finish</a></div>
<div class="card"><div class="hrnow"><b>162</b><s>bpm</s><em>Zone 4 · Threshold</em></div>
<svg width="100%" viewBox="0 0 194 52" preserveAspectRatio="xMidYMid meet">{segs}</svg>
<div class="zlg">{zlegend}</div></div>
<div class="card"><div class="ex">Barbell Bench Press</div>
<div class="shdr"><span>lbs</span><span>Reps</span><i></i></div>
<div class="shrow"><span class="sn">1</span><span class="sf">185</span><span class="sf">8</span>
<span class="sck on">✓</span></div>
<div class="shrow"><span class="sn">2</span><span class="sf">185</span><span class="sf">8</span>
<span class="sck on">✓</span></div>
<div class="shrow"><span class="sn off">3</span><span class="sf">185</span><span class="sf">6</span>
<span class="sck"></span></div></div>
<div class="card"><div class="ex">Incline Dumbbell Press</div>
<div class="shrow"><span class="sn">1</span><span class="sf">65</span><span class="sf">10</span>
<span class="sck on">✓</span></div>
<div class="shrow"><span class="sn off">2</span><span class="sf">65</span><span class="sf">10</span>
<span class="sck"></span></div></div>
<div class="card" style="margin-bottom:0"><div class="ex">Cable Fly</div>
<div class="shrow"><span class="sn off">1</span><span class="sf">30</span><span class="sf">12</span>
<span class="sck"></span></div>
<div class="shrow"><span class="sn off">2</span><span class="sf">30</span><span class="sf">12</span>
<span class="sck"></span></div></div>
<div class="rest"><span style="font-size:8px;font-weight:700;color:{PRIMARY_DARK}">Rest</span>
<span class="restb">1:30</span></div>
</div>"""

SLIDES = [
    ("AI meal photo", "Snap it.<br>It's logged.",
     "Photograph the plate and the macros land in seconds — no searching a database, no guessing at portions.",
     s1, False),
    ("Smart camera", "Read the label.<br>Know the truth.",
     "Barcode databases are often wrong. Point the camera at the actual Nutrition Facts panel and get the real numbers.",
     s2, True),
    ("Nutrition", "Every macro,<br>one glance.",
     "Calories, protein, carbs, fat, fiber and water on one screen — no tab-hopping to see where you stand.",
     s3, False),
    ("Adaptive goals", "Targets that<br>follow your weight.",
     "Weigh in and your calories and macros recalculate themselves. No wizard to re-run, no stale numbers.",
     s4, False),
    ("Training insights", "See where the<br>work actually went.",
     "A body map of your training volume, plus twelve weeks of consistency at a glance.",
     s5, False),
    ("Live training", "Every set.<br>Every beat.",
     "Log sets while your Apple Watch streams heart rate, colored by the zone you're actually in.",
     s6, False),
]

for i, (kick, h1, sub, screen, dark) in enumerate(SLIDES):
    out = HERE / f"slide{i+1}.html"
    out.write_text(page(i, len(SLIDES), kick, h1, sub, screen, dark))
    print("wrote", out.name)
