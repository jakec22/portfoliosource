// Render every slide at each iPhone screenshot class App Store Connect takes.
//
// Apple has moved which class is *required* more than once (6.5 -> 6.7 -> 6.9,
// and more recently a 6.3 set), and a rejected upload costs a round trip. So
// this renders the whole set and lets the upload pick: the sizes below are the
// portrait pixel dimensions Apple lists, derived from each device's logical
// size at deviceScaleFactor 3.
//
// The slide composes on a fixed 428x926 canvas and scales to fit the viewport
// (see the stage script in gen.py), so one layout serves every class without
// being re-measured.
const { execSync } = require('child_process');
function playwright() {
  try { return require('playwright'); } catch {}
  const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
  return require(root + '/playwright');
}
const { chromium } = playwright();
const path = require('path');
const fs = require('fs');

const DIR = __dirname;
const SCALE = Number(process.argv[2] || 3);
const OUT = process.argv[3] || 'appstore';

// name: goes in the filename. w/h: logical CSS size; x3 gives Apple's pixels.
const CLASSES = [
  { name: '6.9', w: 440, h: 956 }, // 1320 x 2868
  { name: '6.7', w: 430, h: 932 }, // 1290 x 2796
  { name: '6.3', w: 402, h: 874 }, // 1206 x 2622
];

(async () => {
  const browser = await chromium.launch();
  const slides = fs.readdirSync(DIR)
    .filter((f) => /^slide\d+\.html$/.test(f))
    .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));
  if (!slides.length) {
    console.error('No slideN.html found — run `python3 gen.py` first.');
    process.exit(1);
  }

  for (const cls of CLASSES) {
    const ctx = await browser.newContext({
      viewport: { width: cls.w, height: cls.h },
      deviceScaleFactor: SCALE,
    });
    const page = await ctx.newPage();
    for (let n = 0; n < slides.length; n++) {
      await page.goto('file://' + path.join(DIR, slides[n]));
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);
      const file = path.join(DIR, `${OUT}-${cls.name}-${n + 1}.png`);
      await page.screenshot({
        path: file,
        clip: { x: 0, y: 0, width: cls.w, height: cls.h },
      });
      console.log(`wrote ${path.basename(file)}  ${cls.w * SCALE}x${cls.h * SCALE}`);
    }
    await ctx.close();
  }
  await browser.close();
})();
