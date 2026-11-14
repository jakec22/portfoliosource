#!/usr/bin/env node
/**
 * The 13" iPad App Store screenshot (2048 x 2732).
 *
 *   node marketing/appstore/ipad.js
 *
 * Authored at 1024 x 1366 CSS and rendered at deviceScaleFactor 2.
 *
 * What the device shows is the whole point of the slide and also its one
 * constraint: iPad runs the phone layout in a 560pt column. It is not a
 * designed iPad layout — no sidebar, no split view — so the composition does
 * not imply one. The frame is cropped at the fold rather than showing a full
 * tablet of mostly empty gutters, and the copy sells the glance, not the
 * canvas.
 *
 * The day's figures come from shared.js, which derives the calorie goal from
 * the macro grams the way buildPlan does. See the comment there.
 */
const { fontCss, c, I, g, ICON, homeCard, trainingCard, dateHeader, statusBar, shoot } =
  require('./shared');

// Calories against goal per day, and whether that day had a session.
const WEEK = [['S', .82, 0], ['M', .94, 1], ['T', .71, 0], ['W', .88, 1],
              ['T', .96, 1], ['F', .63, 0], ['S', .74, 1]];

const weekCard = `
  <div class="card">
    <div class="wkHead"><span class="ctText">This week</span><span class="wkLink">All days ${g(I.right, 'lk2')}</span></div>
    <div class="wkRow">${WEEK.map(([d, p, t], i) => `<div class="wkCol">
      <div class="wkTrack"><i style="height:${p * 100}%;background:${i === 6 ? c.green : c.strong}"></i></div>
      <div class="wkDot"${t ? ` style="background:${c.green}"` : ''}></div>
      <div class="wkDay${i === 6 ? ' is' : ''}">${d}</div></div>`).join('')}</div>
    <div class="wkCap">Tap a day to see it · bar is calories against goal, dot means you trained</div>
  </div>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
${fontCss()}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1024px;height:1366px}
body{background:${c.bg};font-family:Manrope,sans-serif;overflow:hidden;position:relative}
.mdi{font-family:'MDI';font-style:normal;line-height:1;display:inline-block}
.glow{position:absolute;inset:0;background:
  radial-gradient(760px 540px at 78% 22%, rgba(44,188,112,.10), transparent 62%),
  radial-gradient(620px 460px at 6% 70%, rgba(255,255,255,.035), transparent 60%)}

.lock{position:absolute;top:72px;left:80px;display:flex;align-items:center;gap:16px}
.lockIcon{width:54px;height:54px;border-radius:13px;display:block}
.lockName{font-size:25px;font-weight:700;color:${c.text};letter-spacing:-.3px}
.copy{position:absolute;top:190px;left:80px;right:80px}
h1{font-family:'DM Serif Display',serif;font-size:92px;line-height:1.02;letter-spacing:-2px;color:${c.text}}
h1 em{font-style:normal;color:${c.green}}
.lede{font-size:24px;line-height:1.5;color:${c.sub};margin-top:24px;max-width:780px}

/* The iPad, at 1024pt of logical width scaled to fit. */
.pad{position:absolute;left:50%;transform:translateX(-50%);top:572px;
  width:940px;background:#0A0A0B;border-radius:40px;padding:13px;
  box-shadow:0 -10px 90px rgba(0,0,0,.6), 0 0 0 2px #2A2A2E}
.screen{width:914px;height:800px;background:${c.bg};border-radius:28px;overflow:hidden;position:relative}
/* 1024pt of iPad, scaled to the 914px the frame gives it. */
.ipadApp{width:1024px;transform:scale(.8926);transform-origin:top left}
.status{display:flex;justify-content:space-between;align-items:center;padding:16px 36px 0;font-size:15px;font-weight:700;color:${c.text}}
.statR{display:flex;gap:7px;align-items:center}
.statR .mdi{font-size:17px;color:${c.text}}
.statR .bt{transform:rotate(90deg)}
/* The 560pt cap, centred — the whole of what iPad support is. */
.col560{width:560px;margin:0 auto;padding:16px}

.dateRow{display:flex;align-items:center;gap:8px}
.nav{width:44px;height:44px;border-radius:999px;background:${c.card};display:flex;align-items:center;justify-content:center}
.nav .mdi{font-size:24px;color:${c.gray700}}.nav.off .mdi{color:${c.strong}}
.dateMid{flex:1;text-align:center}
.pageTitle{font-family:'DM Serif Display',serif;font-size:28px;line-height:34px;letter-spacing:-.5px;color:${c.text}}
.pageDate{font-size:13px;line-height:18px;color:${c.sub};margin-top:2px}
.dateFoot{height:34px;display:flex;align-items:center;justify-content:center;margin:8px 0 16px}
.streak{display:flex;align-items:center;gap:4px;background:#473C28;border:1px solid rgba(224,163,46,.5);border-radius:16px;padding:4px 12px}
.streak .mdi{font-size:14px;color:${c.carbs}}
.streak span{font-size:13px;line-height:18px;font-weight:600;color:${c.carbs}}
.card{background:${c.card};border-radius:16px;padding:24px;margin-bottom:16px}
.ringWrap{display:flex;flex-direction:column;align-items:center}
.ring{position:relative;width:160px;height:160px}
.ringCtr{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.hero{font-family:'DM Serif Display',serif;font-size:40px;line-height:44px;letter-spacing:-1px;color:${c.text};font-variant-numeric:tabular-nums}
.ovl{font-size:11px;line-height:14px;font-weight:600;letter-spacing:.8px;color:${c.faint};margin-top:2px}
.ovl.left{margin:16px 0 12px}
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
.logLink span{font-size:13px;font-weight:600;color:${c.green}}
.logLink .lk{font-size:16px;color:${c.green}}
.ctRow{display:flex;align-items:center;gap:8px}
.ctRow .ct{font-size:16px;color:${c.gray700}}
.ctText{font-size:15px;line-height:22px;font-weight:700;color:${c.gray700}}
.stats{display:flex}
.st{flex:1;text-align:center}
.stV{font-size:18px;line-height:24px;font-weight:600;color:${c.text};font-variant-numeric:tabular-nums}
.stU{font-size:11px;color:${c.faint};margin-left:2px;font-weight:400}
.stL{font-size:11px;line-height:15px;color:${c.sub};margin-top:2px}
.wkHead{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.wkLink{font-size:13px;color:${c.faint};display:flex;align-items:center;gap:2px}
.wkLink .lk2{font-size:16px;color:${c.faint}}
.wkRow{display:flex;gap:8px}
.wkCol{flex:1;display:flex;flex-direction:column;align-items:center}
.wkTrack{width:100%;height:56px;border-radius:3px;background:${c.muted};display:flex;align-items:flex-end;overflow:hidden}
.wkTrack i{display:block;width:100%;border-radius:3px}
.wkDot{width:5px;height:5px;border-radius:99px;background:transparent;margin-top:8px}
.wkDay{font-size:11px;line-height:15px;color:${c.faint};margin-top:4px}
.wkDay.is{color:${c.text};font-weight:700}
.wkCap{font-size:11px;line-height:15px;color:${c.faint};text-align:center;margin-top:12px}
</style></head><body>
<div class="glow"></div>
<div class="lock"><img class="lockIcon" src="data:image/png;base64,${ICON}"><div class="lockName">HolyMacro</div></div>
<div class="copy">
  <h1>The whole day.<br>In <em>one look.</em></h1>
  <div class="lede">How much is left to eat, whether you trained, and whether the streak
    is alive — answered before you scroll.</div>
</div>
<div class="pad"><div class="screen">
  <div class="ipadApp">
    ${statusBar()}
    <div class="col560">
      ${dateHeader()}
      ${homeCard()}
      ${trainingCard()}
      ${weekCard}
    </div>
  </div>
</div></div>
</body></html>`;

shoot({ html, file: 'appstore-ipad13-1.png', width: 1024, height: 1366, scale: 2 });
