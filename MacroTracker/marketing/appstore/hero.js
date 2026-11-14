#!/usr/bin/env node
/**
 * The wide promotional hero (3840 x 2560).
 *
 *   node marketing/appstore/hero.js
 *
 * Authored at 1920 x 1280 CSS and rendered at deviceScaleFactor 2.
 *
 * The phone in it is not a stylised device: it is the real Home screen, drawn
 * at the real token sizes from src/theme/index.ts and scaled into the frame.
 * The first pass used an invented layout, which is a picture of an app that
 * does not exist — and the one someone compares against the moment they open
 * it. Everything inside .app mirrors HomeScreen: the date header with its
 * dimmed forward arrow on today, the streak chip, the calorie ring and its
 * macro ladder, the food link, the Training card.
 *
 * The day's figures come from shared.js, which derives the calorie goal from
 * the macro grams the way buildPlan does. See the comment there.
 */
const { fontCss, c, I, g, ICON, homeCard, trainingCard, dateHeader, statusBar, shoot } =
  require('./shared');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
${fontCss()}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1920px;height:1280px}
body{background:${c.bg};font-family:Manrope,sans-serif;overflow:hidden;position:relative}
.mdi{font-family:'MDI';font-style:normal;line-height:1;display:inline-block}
/* The same soft off-centre glow the shipped screenshots use. */
.glow{position:absolute;inset:0;background:
  radial-gradient(1100px 760px at 76% 34%, rgba(44,188,112,.10), transparent 62%),
  radial-gradient(900px 620px at 10% 82%, rgba(255,255,255,.035), transparent 60%)}
.stage{position:absolute;inset:0;display:flex;align-items:center;padding:0 0 0 128px;gap:40px}

/* ---- left column ---- */
.left{width:720px;flex:0 0 720px}
.lock{display:flex;align-items:center;gap:20px;margin-bottom:76px}
.lockIcon{width:76px;height:76px;border-radius:18px;overflow:hidden;display:block}
.lockName{font-size:34px;font-weight:700;color:${c.text};letter-spacing:-.4px}
h1{font-family:'DM Serif Display',serif;font-size:116px;line-height:1.0;letter-spacing:-2.5px;color:${c.text}}
h1 em{font-style:normal;color:${c.green}}
.lede{font-size:27px;line-height:1.52;color:${c.sub};margin-top:36px;max-width:620px}
.foot{position:absolute;left:128px;bottom:72px;font-size:19px;color:#5E5E66;letter-spacing:.2px}

/* ---- phone ---- */
.phoneWrap{position:absolute;right:124px;top:84px}
.phone{width:697px;height:1460px;background:#000;border-radius:76px;padding:13px;
  box-shadow:0 70px 150px rgba(0,0,0,.72), 0 0 0 2px #2A2A2E}
.screen{width:100%;height:100%;background:${c.bg};border-radius:64px;overflow:hidden;position:relative}
.island{position:absolute;top:22px;left:50%;transform:translateX(-50%);width:204px;height:59px;background:#000;border-radius:999px;z-index:5}
/* 390pt of app, scaled to the 746px screen. Everything inside is written at
   the real token sizes, so the proportions are the shipped ones. */
.app{width:390px;transform:scale(1.7205);transform-origin:top left}
.status{display:flex;justify-content:space-between;align-items:center;padding:20px 28px 0;font-size:15px;font-weight:700;color:${c.text}}
.statR{display:flex;gap:6px;align-items:center}
.statR .mdi{font-size:16px;color:${c.text}}
.statR .bt{transform:rotate(90deg)}

.pad{padding:16px}
.dateRow{display:flex;align-items:center;gap:8px}
.nav{width:44px;height:44px;border-radius:999px;background:${c.card};display:flex;align-items:center;justify-content:center}
.nav .mdi{font-size:24px;color:${c.gray700}}
.nav.off .mdi{color:${c.strong}}
.dateMid{flex:1;text-align:center}
.pageTitle{font-family:'DM Serif Display',serif;font-size:28px;line-height:34px;letter-spacing:-.5px;color:${c.text}}
.pageDate{font-size:13px;line-height:18px;color:${c.sub};margin-top:2px}
.dateFoot{height:34px;display:flex;align-items:center;justify-content:center;margin-top:8px;margin-bottom:16px}
.streak{display:flex;align-items:center;gap:4px;background:#473C28;border:1px solid rgba(224,163,46,.5);border-radius:16px;padding:4px 12px}
.streak .mdi{font-size:14px;color:${c.carbs}}
.streak span{font-size:13px;line-height:18px;font-weight:600;color:${c.carbs}}

.card{background:${c.card};border-radius:16px;padding:24px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,.06)}
.ringWrap{display:flex;flex-direction:column;align-items:center}
.ring{position:relative;width:160px;height:160px}
.ringCtr{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.hero{font-family:'DM Serif Display',serif;font-size:40px;line-height:44px;letter-spacing:-1px;color:${c.text};font-variant-numeric:tabular-nums}
.ovl{font-size:11px;line-height:14px;font-weight:600;letter-spacing:.8px;color:${c.faint};margin-top:2px}
.ovl.left{margin:16px 0 12px;text-align:left}
.ringSum{font-size:13px;line-height:18px;color:${c.sub};margin-top:12px;font-variant-numeric:tabular-nums}
.ringSum b{font-family:'DM Serif Display',serif;font-weight:400;color:${c.text}}
.div{height:1px;background:${c.border};margin:16px 0}
.macros{display:flex;flex-direction:column;gap:12px}
.mac{display:flex;flex-direction:column;gap:8px}
.mHead{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.mLabel{font-size:13px;line-height:18px;font-weight:600;color:${c.text}}
.mRead{font-variant-numeric:tabular-nums}
.mRead b{font-family:'DM Serif Display',serif;font-weight:400;font-size:15px;color:${c.text}}
.mGoal{font-family:'DM Serif Display',serif;font-size:13px;color:${c.faint}}
.mTrack{height:6px;border-radius:3px;background:${c.strong};overflow:hidden}
.mTrack i{display:block;height:100%;border-radius:3px}
.logLink{display:flex;align-items:center;justify-content:center;gap:4px;padding:4px 0}
.logLink span{font-size:13px;line-height:18px;font-weight:600;color:${c.green}}
.logLink .lk{font-size:16px;color:${c.green}}
.ctRow{display:flex;align-items:center;gap:8px}
.ctRow .ct{font-size:16px;color:${c.gray700}}
.ctText{font-size:15px;line-height:22px;font-weight:700;color:${c.gray700}}
.stats{display:flex}
.st{flex:1;text-align:center}
.stV{font-size:18px;line-height:24px;font-weight:600;letter-spacing:-.2px;color:${c.text};font-variant-numeric:tabular-nums}
.stU{font-size:11px;color:${c.faint};margin-left:2px;font-weight:400}
.stL{font-size:11px;line-height:15px;color:${c.sub};margin-top:2px}
</style></head><body>
<div class="glow"></div>
<div class="stage">
  <div class="left">
    <div class="lock">
      <img class="lockIcon" src="data:image/png;base64,${ICON}">
      <div class="lockName">HolyMacro</div>
    </div>
    <h1>The whole day.<br>In <em>one look.</em></h1>
    <div class="lede">How much is left to eat, whether you trained, and whether the
      streak is alive — answered before you scroll.</div>
  </div>

  <div class="phoneWrap"><div class="phone"><div class="screen">
    <div class="island"></div>
    <div class="app">
      ${statusBar()}
      <div class="pad">
        ${dateHeader()}
        ${homeCard()}
        ${trainingCard()}
      </div>
    </div>
  </div></div>
</div>
<div class="foot">HolyMacro — Nutrition &amp; Training</div>
</body></html>`;

shoot({ html, file: 'holymacro-hero-3840x2560.png', width: 1920, height: 1280, scale: 2 });
