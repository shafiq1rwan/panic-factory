// Dev helper: screenshot a URL in emulated phones (mobile viewport handling on).
import { chromium, devices } from 'playwright-core';
const url = process.argv[2];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
for (const [name, dev] of [['iphone13', devices['iPhone 13']], ['pixel7', devices['Pixel 7']], ['small', { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
  const ctx = await browser.newContext({ ...dev });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log(name, '[error]', m.text()); });
  page.on('pageerror', (e) => console.log(name, '[pageerror]', e.message));
  page.on('response', (r) => { if (r.status() >= 400) console.log(name, '[http]', r.status(), r.url()); });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(4000);
  const info = await page.evaluate(() => ({ iw: innerWidth, ih: innerHeight, dpr: devicePixelRatio, canvas: (() => { const c = document.querySelector('canvas'); if (!c) return null; const b = c.getBoundingClientRect(); return [b.x, b.y, b.width, b.height, c.width, c.height]; })(), rotate: getComputedStyle(document.getElementById('rotate')).display, title: document.title }));
  console.log(name, JSON.stringify(info));
  await page.screenshot({ path: `test-artifacts/phone-${name}-menu.png` });
  // tap PLAY (logical 360,680) using the canvas box
  const b = info.canvas;
  if (b) {
    await page.touchscreen.tap(b[0] + b[2] / 2, b[1] + b[3] * 0.53);
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `test-artifacts/phone-${name}-level.png` });
  }
  await ctx.close();
}
await browser.close();
