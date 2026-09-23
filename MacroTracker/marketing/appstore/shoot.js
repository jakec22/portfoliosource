// Playwright is usually a global install here, which a local require() won't find.
const { execSync } = require('child_process');
function playwright() {
  try { return require('playwright'); } catch {}
  const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
  return require(root + '/playwright');
}
const { chromium } = playwright();
const path = require('path');

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
  for (let i = 1; i <= 6; i++) {
    await page.goto('file://' + path.join(DIR, `slide${i}.html`));
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    const file = path.join(DIR, `${OUT}-${i}.png`);
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 428, height: 926 } });
    console.log('wrote', file);
  }
  await browser.close();
})();
