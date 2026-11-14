/**
 * Everything hero.js and ipad.js both need: the embedded faces, the palette,
 * and the day the in-device Home screen shows.
 *
 * The day's figures live here rather than in each generator because they
 * drifted once already. Both files had grown their own copy of "142 / 180g"
 * and a hand-typed "1,788 of 2,400 kcal", and the two disagreed with each
 * other by 32 kcal and with the app by more than that: 2,400 is not a goal
 * the app can hold any more. Since buildPlan started deriving calories from
 * the grams, the calorie goal *is* 4P + 4C + 9F, so a screenshot showing a
 * round 2,400 beside 180/240/70g is a picture of a state the app cannot
 * produce. Now the grams are the input and every other number is computed
 * from them, which is also what the app does.
 */
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const ROOT = path.join(HERE, '..', '..');

const b64 = (...p) => fs.readFileSync(path.join(...p)).toString('base64');

// The shipping app icon, so the lock-up can never drift from what people tap
// on their Home Screen. Same source gen.py uses.
const ICON = b64(ROOT, 'assets', 'icon.png');

// The icon font the app itself draws with, read out of node_modules so the
// glyphs can never drift from the ones Icon.tsx resolves.
const MDI = b64(ROOT, 'node_modules', '@expo', 'vector-icons', 'build', 'vendor',
                'react-native-vector-icons', 'Fonts', 'MaterialCommunityIcons.ttf');

// The app's own faces, from the packages src/theme/index.ts names. Embedded
// rather than pulled from the Google Fonts CDN: these renders have to be
// reproducible offline, and a webfont that 404s falls back to a system serif
// without failing the run.
const FACES = {
  serif: b64(ROOT, 'node_modules', '@expo-google-fonts', 'dm-serif-display',
             '400Regular', 'DMSerifDisplay_400Regular.ttf'),
  m400: b64(ROOT, 'node_modules', '@expo-google-fonts', 'manrope', '400Regular', 'Manrope_400Regular.ttf'),
  m500: b64(ROOT, 'node_modules', '@expo-google-fonts', 'manrope', '500Medium', 'Manrope_500Medium.ttf'),
  m600: b64(ROOT, 'node_modules', '@expo-google-fonts', 'manrope', '600SemiBold', 'Manrope_600SemiBold.ttf'),
  m700: b64(ROOT, 'node_modules', '@expo-google-fonts', 'manrope', '700Bold', 'Manrope_700Bold.ttf'),
};

const fontCss = () => `
@font-face{font-family:'DM Serif Display';src:url(data:font/ttf;base64,${FACES.serif}) format('truetype')}
@font-face{font-family:'Manrope';font-weight:400;src:url(data:font/ttf;base64,${FACES.m400}) format('truetype')}
@font-face{font-family:'Manrope';font-weight:500;src:url(data:font/ttf;base64,${FACES.m500}) format('truetype')}
@font-face{font-family:'Manrope';font-weight:600;src:url(data:font/ttf;base64,${FACES.m600}) format('truetype')}
@font-face{font-family:'Manrope';font-weight:700;src:url(data:font/ttf;base64,${FACES.m700}) format('truetype')}
@font-face{font-family:'MDI';src:url(data:font/ttf;base64,${MDI}) format('truetype')}`;

// Editorial dark, straight from src/theme/index.ts.
const c = {
  bg: '#0E0E10', card: '#252527', muted: '#1A1A1C', text: '#F4F4F5',
  sub: '#A1A1A8', faint: '#8C8C94', border: '#34343A', strong: '#47474F',
  green: '#2CBC70', greenDeep: '#1B7A48', info: '#68A7D8', gray700: '#D2D2D7',
  protein: '#E2683C', carbs: '#E0A32E', fat: '#D1699B', fiber: '#79C993',
};

const I = {
  cell: 'f08be', wifi: 'f05a9', batt: 'f0079', left: 'f0141', right: 'f0142',
  fire: 'f0238', lifter: 'f115d', water: 'f058c',
};
const g = (hex, cls = '') => `<span class="mdi ${cls}">&#x${hex};</span>`;

// The grams are the only typed-in numbers. Fiber is inside the carbs and so
// carries no calories of its own, exactly as tdee.ts has it.
const MACROS = {
  protein: [142, 180],
  carbs: [196, 240],
  fat: [52, 70],
  fiber: [21, 30],
};
const KCAL = { protein: 4, carbs: 4, fat: 9 };
const sum = (i) => ['protein', 'carbs', 'fat'].reduce((t, k) => t + MACROS[k][i] * KCAL[k], 0);

const day = {
  macros: MACROS,
  eaten: sum(0),          // 1,820
  goal: sum(1),           // 2,310
  get left() { return this.goal - this.eaten; },
  get progress() { return this.eaten / this.goal; },
};

// The Home ring: r = 73 inside a 160 box, 14pt stroke.
const RING_R = 73;
const RING_C = 2 * Math.PI * RING_R;
const ringDash = () => ({
  array: RING_C.toFixed(2),
  offset: (RING_C * (1 - day.progress)).toFixed(2),
});

const n = (v) => v.toLocaleString('en-US');

// MacroBar.tsx: label and reading on one line, a 6pt track under it.
const macro = (label, key, col) => {
  const [cur, goal] = MACROS[key];
  return `<div class="mac">
  <div class="mHead"><span class="mLabel">${label}</span>
    <span class="mRead"><b>${cur}</b><span class="mGoal"> / ${goal}g</span></span></div>
  <div class="mTrack"><i style="width:${Math.min(cur / goal, 1) * 100}%;background:${col}"></i></div></div>`;
};

const stat = (v, u, l) =>
  `<div class="st"><div class="stV">${v}${u ? `<span class="stU">${u}</span>` : ''}</div><div class="stL">${l}</div></div>`;

// The Home card both renders, at the real token sizes. The phone and the iPad
// draw the identical component — the iPad just caps it at 560pt — so it is
// written once and the two pages supply their own frame and scale.
const homeCard = () => {
  const d = ringDash();
  return `
  <div class="card">
    <div class="ringWrap">
      <div class="ring">
        <svg width="160" height="160" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r="${RING_R}" stroke="${c.muted}" stroke-width="14" fill="none"/>
          <circle cx="80" cy="80" r="${RING_R}" stroke="${c.green}" stroke-width="14" fill="none"
            stroke-linecap="round" stroke-dasharray="${d.array}" stroke-dashoffset="${d.offset}"
            transform="rotate(-90 80 80)"/>
        </svg>
        <div class="ringCtr"><div class="hero">${n(day.left)}</div><div class="ovl">LEFT</div></div>
      </div>
      <div class="ringSum"><b>${n(day.eaten)}</b> of <b>${n(day.goal)}</b> kcal</div>
    </div>
    <div class="div"></div>
    <div class="macros">
      ${macro('Protein', 'protein', c.protein)}${macro('Carbs', 'carbs', c.carbs)}
      ${macro('Fat', 'fat', c.fat)}${macro('Fiber', 'fiber', c.fiber)}
    </div>
    <div class="div"></div>
    <div class="logLink"><span>See today&rsquo;s food</span>${g(I.right, 'lk')}</div>
  </div>`;
};

const trainingCard = () => `
  <div class="card">
    <div class="ctRow">${g(I.lifter, 'ct')}<span class="ctText">Training</span></div>
    <div class="ovl left">TODAY</div>
    <div class="stats">${stat('412', 'kcal', 'Burned')}${stat('48:20', '', 'Duration')}${stat('14.2k', 'lb', 'Volume')}${stat('138', 'bpm', 'Avg HR')}</div>
  </div>`;

const dateHeader = () => `
  <div class="dateRow">
    <div class="nav">${g(I.left)}</div>
    <div class="dateMid"><div class="pageTitle">Today</div>
      <div class="pageDate">Saturday, November 8</div></div>
    <div class="nav off">${g(I.right)}</div>
  </div>
  <div class="dateFoot"><div class="streak">${g(I.fire)}<span>12 days</span></div></div>`;

const statusBar = () =>
  `<div class="status"><div>9:41</div><div class="statR">${g(I.cell)}${g(I.wifi)}${g(I.batt, 'bt')}</div></div>`;

/** Render one standalone page to one PNG at the given scale. */
async function shoot({ html, file, width, height, scale }) {
  const { chromium } = require('playwright');
  const page = path.join(HERE, path.basename(file).replace(/\.png$/, '.html'));
  fs.writeFileSync(page, html);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  await p.goto('file://' + page);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(600);
  await p.screenshot({ path: path.join(HERE, file), clip: { x: 0, y: 0, width, height } });
  await b.close();
  console.log(`${file}  ${width * scale}x${height * scale}`);
}

module.exports = {
  HERE, ROOT, ICON, MDI, fontCss, c, I, g, day, macro, stat,
  homeCard, trainingCard, dateHeader, statusBar, shoot,
};
