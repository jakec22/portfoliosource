#!/usr/bin/env node
/**
 * Generate the Apple Watch App Store screenshots (422 x 514).
 *
 *   node marketing/appstore/watch.js
 *
 * 422 x 514 is the Apple Watch Ultra 3 (49mm) slot, which is the one the live
 * listing uses and the only Watch size App Store Connect asks for.
 *
 * Unlike the phone slides, which are marketing compositions with a headline
 * and a stylised phone, these are the watch screens themselves. At 211 points
 * across there is no room for a frame, a caption or an interpretation: the
 * screen *is* the screenshot. So the rule here is stricter than "mirror a
 * screen the app renders" — every size, weight, colour, string and spacing
 * below is copied out of targets/watch/content.swift, and the faces are the
 * .ttf files the watch target itself ships.
 *
 * Authored at 211 x 257 CSS and rendered at deviceScaleFactor 2, so one CSS
 * pixel is one SwiftUI point and 211 * 2 lands exactly on 422.
 *
 * Two places where this is a drawing of the screen rather than the screen:
 *
 *   * WatchType.readout is SF Rounded, which cannot be embedded here. The
 *     clocks and heart rates use Manrope Bold, the nearest geometric face the
 *     app already ships. SF Rounded tabularises its digits but not its colon;
 *     Manrope's tnum widens both, so the colons are opted out individually.
 *   * The 58pt top inset, the 54pt button height and the status clock were
 *     measured off a real simulator grab rather than guessed — rebuild the
 *     empty state (SCREENS.calib below) and diff it against one if any of
 *     this ever looks off.
 *
 * What replaced what: the listing's only Watch screenshot used to be the
 * unsynced empty state — a sync glyph and "Open Holy Macro on your iPhone to
 * sync." The store advertised a watch app that could not do anything.
 */
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const ROOT = path.join(HERE, '..', '..');
const WATCH = path.join(ROOT, 'targets', 'watch');
const OUT = HERE;

const face = (file) => fs.readFileSync(file).toString('base64');
const ttf = (name) => face(path.join(WATCH, `${name}.ttf`));
// The same icon font the phone draws with, read out of node_modules so the
// glyphs can never drift from the ones Icon.tsx resolves.
const MDI = face(
  path.join(ROOT, 'node_modules', '@expo', 'vector-icons', 'build', 'vendor',
            'react-native-vector-icons', 'Fonts', 'MaterialCommunityIcons.ttf')
);
const g = (hex, cls = '') => `<span class="mdi ${cls}">&#x${hex};</span>`;

// Editorial pack, straight out of WatchPalette in content.swift.
const c = {
  ground: '#0E0E10',
  accent: '#34C77B',
  danger: '#F4756D',
  protein: '#E2683C',
  carbs: '#E0A32E',
  fat: '#D1699B',
  fiber: '#79C993',
  water: '#5A9FD4',
  zoneEasy: '#79C993',
  zoneMid: '#E0A32E',
};
// watchOS .primary / .secondary over a dark ground.
const PRIMARY = '#FFFFFF';
const SECONDARY = 'rgba(235,235,245,0.60)';

// The day's numbers, kept arithmetically honest: the calorie goal is derived
// from the macro grams exactly as buildPlan derives it (4/4/9), and what has
// been eaten is the sum of what the bars show. A store screenshot that does
// not add up is one the app could never produce.
//   180*4 + 240*4 + 72*9 = 2328      142*4 + 183*4 + 52*9 = 1768
const day = {
  goal: 2328,
  eaten: 1768,
  protein: [142, 180],
  carbs: [183, 240],
  fat: [52, 72],
  fiber: [22, 32],
  water: [64, 96],
};
const left = day.goal - day.eaten;

// calorieRing: 118pt across, 10pt stroke, track at 20%.
const ring = (() => {
  const R = (118 - 10) / 2;
  const CIRC = 2 * Math.PI * R;
  const p = day.eaten / day.goal;
  return `<svg class="ring" width="118" height="118" viewBox="0 0 118 118">
    <circle cx="59" cy="59" r="${R}" fill="none" stroke="${c.accent}" stroke-opacity="0.2" stroke-width="10"/>
    <circle cx="59" cy="59" r="${R}" fill="none" stroke="${c.accent}" stroke-width="10"
            stroke-linecap="round" stroke-dasharray="${CIRC}"
            stroke-dashoffset="${CIRC * (1 - p)}" transform="rotate(-90 59 59)"/>
  </svg>`;
})();

// MacroBar: label + value on one line, a 5pt capsule under it.
const bar = (label, [v, goal], color) => `
  <div class="macro">
    <div class="mrow"><span class="mlab">${label}</span><span class="mval">${v}<span class="mgoal"> / ${goal}g</span></span></div>
    <div class="track" style="--t:${color}"><i style="width:${Math.min(1, v / goal) * 100}%"></i></div>
  </div>`;

const waterBar = `
  <div class="macro wtr">
    <div class="mrow"><span class="mlab sec">Water</span><span class="mval">${day.water[0]}<span class="mgoal"> / ${day.water[1]} oz</span></span></div>
    <div class="track tall" style="--t:${c.water}"><i style="width:${(day.water[0] / day.water[1]) * 100}%"></i></div>
  </div>`;

const setRow = (text, done) => `
  <div class="set">
    ${g(done ? 'f05e0' : 'f0130', done ? 'ok' : 'todo')}
    <span class="slab${done ? ' done' : ''}">${text}</span>
    ${g('f090c', 'pen')}
  </div>`;

// Rendered in this order; the numbered output files follow it.
const SCREENS = {
  // 1 — the day, as the wrist shows it.
  day: `
    <div class="pad col10 day">
      <div class="ringwrap">
        ${ring}
        <div class="rtext">
          <div class="rnum">${left.toLocaleString()}</div>
          <div class="rlab">CAL LEFT</div>
        </div>
      </div>
      <div class="col6">
        ${bar('Protein', day.protein, c.protein)}
        ${bar('Carbs', day.carbs, c.carbs)}
        ${bar('Fat', day.fat, c.fat)}
        ${bar('Fiber', day.fiber, c.fiber)}
      </div>
      ${waterBar}
    </div>`,

  // 2 — a live set, with the rest timer mirrored from the phone.
  workout: `
    <div class="pad col10">
      <div class="rest">${g('f13ab', 'ri')}<span class="restt">Rest 1<i>:</i>30</span></div>
      <div class="clock">24<i>:</i>18</div>
      <div class="hr"><span class="bpm" style="color:${c.zoneMid}">138</span><span class="bpml">bpm</span></div>
      <div class="cals">${g('f0238', 'flame')}<span>212 cal</span></div>
      <div class="brow">
        <button class="pill accent">${g('f03e4')}</button>
        <button class="pill danger">${g('f04db')}</button>
      </div>
      <button class="prom" style="margin-top:2px">${g('f012c', 'bi')}<span>Complete Workout</span></button>
    </div>`,

  // 3 — the set list: the thing the watch does that a tracker usually cannot,
  // which is check a set off and edit it with the phone in a bag.
  sets: `
    <div class="pad col12 left">
      <div class="exhead">Exercises</div>
      <div class="ex">
        <div class="exname">Back Squat</div>
        <div class="col6">
          ${setRow('185 × 8', true)}
          ${setRow('205 × 6', true)}
          ${setRow('205 × 6', false)}
        </div>
      </div>
      <div class="ex">
        <div class="exname">Romanian Deadlift</div>
        <div class="col6">
          ${setRow('155 × 10', false)}
        </div>
      </div>
    </div>`,

  // 4 — the recovery timer, counting down with the phone in a locker.
  recovery: `
    <div class="pad col8 scrolled">
      <div class="reclab">Sauna</div>
      <div class="clock">4<i>:</i>32</div>
      <div class="reccap">remaining</div>
      <div class="hr" style="margin-top:2px"><span class="bpm" style="color:${c.zoneEasy}">118</span><span class="bpml">bpm</span></div>
      <button class="prom" style="margin-top:4px"><span>Stop &amp; Save</span></button>
      <div class="discard">Discard</div>
    </div>`,

  // 5 — the recap, the moment the session ends.
  summary: `
    <div class="pad col8">
      <div class="done-h">Workout Complete</div>
      <div class="srow"><span class="slabel">Time</span><span class="sval">42:16</span></div>
      <div class="srow"><span class="slabel">Avg HR</span><span class="sval">131 bpm</span></div>
      <div class="srow"><span class="slabel">Calories</span><span class="sval">386</span></div>
      <button class="prom" style="margin-top:4px"><span>Done</span></button>
    </div>`,

  // Not shipped. The state the listing used to show, kept so the chrome can be
  // re-checked against a real simulator grab: render it, and the status clock,
  // the top inset and the button should land on the same pixels.
  calib: `
    <div class="pad col10">
      <div class="col6" style="padding-top:8px">
        ${g('f09d5', 'sync')}
        <div class="sync-t">Open Holy Macro on your iPhone to sync.</div>
      </div>
      <button class="prom" style="margin-top:4px">${g('f070e', 'bi')}<span>Start Workout</span></button>
    </div>`,
};

const SHIP = ['day', 'workout', 'sets', 'recovery', 'summary'];

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'DMSerif';src:url(data:font/ttf;base64,${ttf('DMSerifDisplay-Regular')}) format('truetype')}
@font-face{font-family:'Manrope';font-weight:500;src:url(data:font/ttf;base64,${ttf('Manrope-Medium')}) format('truetype')}
@font-face{font-family:'Manrope';font-weight:600;src:url(data:font/ttf;base64,${ttf('Manrope-SemiBold')}) format('truetype')}
@font-face{font-family:'Manrope';font-weight:700;src:url(data:font/ttf;base64,${ttf('Manrope-Bold')}) format('truetype')}
@font-face{font-family:'MDI';src:url(data:font/ttf;base64,${MDI}) format('truetype')}

*{margin:0;padding:0;box-sizing:border-box}
body{background:#222;display:flex;flex-wrap:wrap;gap:24px;padding:24px;
     font-family:'Manrope',sans-serif;-webkit-font-smoothing:antialiased}
.mdi{font-family:'MDI';font-style:normal;line-height:1;display:inline-block}

.screen{position:relative;width:211px;height:257px;overflow:hidden;background:${c.ground};color:${PRIMARY}}
/* watchOS draws the time over the app's ground — the app ignores the safe
   area — and the scroll view's content begins below it. Measured against a
   real grab: the clock's ink sits at 22.5-34pt and content starts at 58. */
.clockbar{position:absolute;top:19px;right:17px;font-size:16px;letter-spacing:-0.2px;color:#fff;
          font-family:-apple-system,'SF Pro Text','Inter',system-ui,sans-serif;font-weight:600}
.pad{position:absolute;top:58px;left:0;right:0;padding:0 16px;display:flex;
     flex-direction:column;align-items:center}
.left{align-items:stretch}
/* The recovery screen's content is 3pt taller than the screen, so Discard
   falls just under the fold; shown a few points scrolled, which is a state
   the device reaches with one notch of the crown. */
.scrolled{top:50px}
/* The glance is a scroll view too: the ring plus two bars is what the
   unscrolled screen holds (see the comment on calorieRing), so this is shown
   fourteen points in, where the third bar completes and nothing is half-cut. */
.day{top:44px}
.col6>*+*,.col6{gap:6px}.col8{gap:8px}.col10{gap:10px}.col12{gap:12px}
.col6,.col8,.col10,.col12{display:flex;flex-direction:column}
.col6{width:100%;align-items:stretch}

/* --- empty state (calibration only) --- */
.sync{font-size:20px;color:${c.accent};align-self:center}
.sync-t{font-weight:500;font-size:13px;line-height:16px;color:${SECONDARY};text-align:center}

/* --- buttons: watchOS .borderedProminent, white label on the tint --- */
.prom{width:100%;border:0;border-radius:999px;background:${c.accent};color:#fff;
      font-family:'Manrope';font-weight:600;font-size:13px;min-height:54px;
      display:flex;align-items:center;justify-content:center;gap:5px}
.prom .bi{font-size:15px}
.brow{display:flex;gap:8px;width:100%;margin-top:4px}
.pill{flex:1;border:0;border-radius:999px;min-height:40px;font-size:17px;
      display:flex;align-items:center;justify-content:center}
.pill.accent{background:${c.accent};color:#fff}
.pill.danger{background:${c.danger};color:#fff}

/* --- calorie ring --- */
.ringwrap{position:relative;width:118px;height:118px;display:flex;
          align-items:center;justify-content:center}
.rtext{position:absolute;inset:0 12px;display:flex;flex-direction:column;
       align-items:center;justify-content:center;gap:2px}
.rnum{font-family:'DMSerif';font-size:36px;line-height:1;color:${c.accent}}
.rlab{font-weight:600;font-size:10px;letter-spacing:0.7px;color:${SECONDARY}}

/* --- macro bars --- */
.macro{display:flex;flex-direction:column;gap:3px}
.mrow{display:flex;align-items:baseline;justify-content:space-between}
.mlab{font-weight:600;font-size:11px}
.mlab.sec{color:${SECONDARY}}
.mval{font-weight:700;font-size:11px}
.mgoal{font-weight:500;font-size:10px;color:${SECONDARY}}
.track{height:5px;border-radius:2.5px;background:color-mix(in srgb,var(--t) 22%,transparent);overflow:hidden}
.track.tall{height:6px;border-radius:3px}
.track i{display:block;height:100%;border-radius:3px;background:var(--t)}
.wtr{width:100%;gap:4px}

/* --- live workout --- */
.rest{display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;
      background:color-mix(in srgb,${c.accent} 18%,transparent)}
.rest .ri{font-size:13px;color:${c.accent}}
.restt{font-weight:700;font-size:13px;font-variant-numeric:tabular-nums}
.clock{font-weight:700;font-size:30px;line-height:1.1;color:${c.accent};
       font-variant-numeric:tabular-nums}
/* SF Rounded's monospacedDigit tabularises the digits, not the colon; Manrope's
   tnum widens both, which opens a gap the device does not have. */
.clock i,.restt i{font-style:normal;font-variant-numeric:normal}
.hr{display:flex;align-items:baseline;gap:4px}
.bpm{font-weight:700;font-size:20px;font-variant-numeric:tabular-nums}
.bpml{font-weight:600;font-size:11px;color:${SECONDARY}}
.cals{display:flex;align-items:center;gap:5px;font-weight:600;font-size:13px}
.flame{font-size:14px;color:#FF9F0A}

/* --- exercises --- */
.exhead{font-weight:600;font-size:11px;letter-spacing:0.7px;color:${c.accent}}
.ex{display:flex;flex-direction:column;gap:6px}
.exname{font-weight:700;font-size:13px}
.set{display:flex;align-items:center;gap:8px;padding:3px 6px;border-radius:8px;
     background:rgba(142,142,147,0.12)}
.set .ok{font-size:14px;color:${c.accent}}
.set .todo{font-size:14px;color:${SECONDARY}}
.slab{flex:1;font-weight:500;font-size:11px}
.slab.done{color:${SECONDARY}}
.pen{font-size:11px;color:${c.accent}}

/* --- recovery --- */
.reclab{font-weight:600;font-size:11px;letter-spacing:0.7px;color:${c.accent}}
.reccap{font-weight:500;font-size:11px;color:${SECONDARY}}
.discard{font-weight:500;font-size:13px;color:${c.danger}}

/* --- summary --- */
.done-h{font-family:'DMSerif';font-size:18px;color:${c.accent}}
.srow{display:flex;width:100%;justify-content:space-between;align-items:baseline}
.slabel{font-weight:500;font-size:11px;color:${SECONDARY}}
.sval{font-weight:600;font-size:13px}
</style></head><body>
${Object.entries(SCREENS).map(([id, body]) => `
  <div class="screen" id="${id}">
    ${body}
    <div class="clockbar">10:09</div>
  </div>`).join('\n')}
</body></html>`;

const HTML = path.join(OUT, 'watch.html');
fs.writeFileSync(HTML, html);

(async () => {
  const { chromium } = require('playwright');
  const b = await chromium.launch();
  // deviceScaleFactor 2: 211 x 257 points -> 422 x 514 pixels, exactly.
  const p = await b.newPage({ viewport: { width: 760, height: 900 }, deviceScaleFactor: 2 });
  await p.goto('file://' + HTML);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(700);
  for (let i = 0; i < SHIP.length; i++) {
    const out = path.join(OUT, `appstore-watch-${i + 1}.png`);
    await p.locator('#' + SHIP[i]).screenshot({ path: out });
    console.log(`${path.basename(out)}  ${SHIP[i]}  422x514`);
  }
  await b.close();
  // The ground is opaque, so Chromium writes these without an alpha channel
  // and App Store Connect takes them as they are. Check with
  // `identify -format '%[channels]'` if that ever stops being true.
})();
