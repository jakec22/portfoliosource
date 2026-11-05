// Playwright is usually a global install here, which a local require() won't find.
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

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 428, height: 926 },
    deviceScaleFactor: SCALE,
  });
  const page = await ctx.newPage();
  // Driven by the files gen.py actually wrote, so changing the slide count
  // takes one edit rather than two that can disagree.
  const slides = fs.readdirSync(DIR)
    .filter((f) => /^slide\d+\.html$/.test(f))
    .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));
  for (let n = 0; n < slides.length; n++) {
    const i = n + 1;
    await page.goto('file://' + path.join(DIR, `slide${i}.html`));
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    const file = path.join(DIR, `${OUT}-${i}.png`);
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 428, height: 926 } });
    console.log('wrote', file);
  }
  await browser.close();
})();
