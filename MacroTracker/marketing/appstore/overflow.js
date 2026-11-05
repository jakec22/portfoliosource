// Reports, per slide, how far the in-phone content exceeds the screen. The
// screen clips with overflow:hidden, so a slide can silently lose its last
// element — which is how slide 2 shipped a macro ladder missing Fiber.
const { execSync } = require('child_process');
function playwright() {
  try { return require('playwright'); } catch {}
  return require(execSync('npm root -g', { encoding: 'utf8' }).trim() + '/playwright');
}
const { chromium } = playwright();
const path = require('path'), fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 428, height: 926 } });
  const slides = fs.readdirSync(__dirname).filter(f => /^slide\d+\.html$/.test(f))
    .sort((a, z) => parseInt(a.match(/\d+/)) - parseInt(z.match(/\d+/)));
  let bad = 0;
  for (const f of slides) {
    await p.goto('file://' + path.join(__dirname, f));
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(250);
    const r = await p.evaluate(() => {
      const screen = document.querySelector('.screen');
      const sh = screen.clientHeight;
      // Lowest content edge inside the screen, ignoring the chrome overlays.
      let low = 0, who = '';
      screen.querySelectorAll('.body *').forEach(el => {
        const bottom = el.getBoundingClientRect().bottom;
        if (bottom > low) { low = bottom; who = el.className || el.tagName; }
      });
      const top = screen.getBoundingClientRect().top;
      return { over: Math.round(low - top - sh), sh, who };
    });
    const hi = p => p > -14;  // home indicator sits ~14px up from the bottom
    if (hi(r.over)) bad++;
    console.log(`${f}  overflow ${String(r.over).padStart(4)}px  ` +
      `${hi(r.over) ? 'CLIPPED -> ' + r.who : 'ok'}`);
  }
  await b.close();
  process.exit(bad ? 1 : 0);
})();
