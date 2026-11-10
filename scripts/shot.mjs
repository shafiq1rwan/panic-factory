// Dev helper: drive the running game in headless Edge/Chrome and save screenshots.
//   node scripts/shot.mjs <name> '<json steps>'
// steps: [["click",x,y],["wait",ms],["shot","label"],["key","Space"],["eval","js"],["drag",x1,y1,x2,y2]]
import { chromium } from 'playwright-core';

const name = process.argv[2] ?? 'shot';
const steps = JSON.parse(process.argv[3] ?? '[["wait",1500],["shot","menu"]]');
const url = process.env.TFP_URL ?? 'http://127.0.0.1:5273/?tfptest';
const W = +(process.env.W ?? 1280), H = +(process.env.H ?? 720);

async function launch() {
  for (const channel of ['msedge', 'chrome']) {
    try {
      return await chromium.launch({ channel, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
    } catch { /* try next */ }
  }
  throw new Error('No Edge/Chrome found');
}

const browser = await launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: process.env.TOUCH === '1' });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}]`, m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(url);
await page.waitForFunction(() => window.__TFP?.game?.scene?.isActive('Menu'), null, { timeout: 15000 });
for (const s of steps) {
  const [op, a, b, c, d] = s;
  if (op === 'click') await page.mouse.click(a, b);
  else if (op === 'wait') await page.waitForTimeout(a);
  else if (op === 'shot') await page.screenshot({ path: `test-artifacts/${name}-${a}.png` });
  else if (op === 'key') await page.keyboard.press(a);
  else if (op === 'eval') console.log('eval:', JSON.stringify(await page.evaluate(a)));
  else if (op === 'drag') {
    await page.mouse.move(a, b);
    await page.mouse.down();
    await page.mouse.move((a + c) / 2, (b + d) / 2, { steps: 6 });
    await page.mouse.move(c, d, { steps: 6 });
    await page.mouse.up();
  }
}
await browser.close();
