// Screenshots the Card Duel playtest table (/cards) at desktop and phone
// widths, in the SETTLED-ROUND state: the one frame that carries the whole
// grammar at once (both seat bands with their commit lamps and score pips, the
// stage with the two cards that clashed and the verdict, the hand, the piles).
//
// Needs `npm run dev` running. The empty table is not worth a screenshot, so
// this seats a computer opponent, plays a card, and waits for the round theater
// to settle before it shoots.
//
// Usage:
//   node scripts/card_table_shot.mjs
//   BASE=http://localhost:5174 TAG=before node scripts/card_table_shot.mjs
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { BROWSER_PATH } from './browser_path.mjs';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const OUT = process.env.OUT ?? 'docs/screenshots/card-duel-table';
const TAG = process.env.TAG ?? 'after';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: BROWSER_PATH,
  headless: 'new',
  args: ['--no-sandbox'],
});

async function shot(name, width, height) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 2 });
  // A headless Chrome defaults to reduced motion, which collapses the round
  // theater. Ask for the full timeline so the shot shows what a player sees.
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await page.goto(`${BASE}/cards.html`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('.dt-hand .cf');
  await page.evaluate(() => {
    const seatA = document.querySelectorAll('.cards-bot')[0];
    seatA.value = 'steady';
    seatA.dispatchEvent(new Event('change'));
  });
  await sleep(200);
  await page.evaluate(() => {
    document.querySelectorAll('.dt-hand')[1].querySelector('.cf').click();
  });
  // The bot's think beat plus the whole round timeline, with margin.
  await sleep(3200);
  await page.screenshot({ path: `${OUT}/${name}-${TAG}.png`, fullPage: true });
  console.log('wrote', `${OUT}/${name}-${TAG}.png`);
  await page.close();
}

await shot('cards-slice-desktop', 1280, 900);
await shot('cards-slice-mobile', 390, 844);
await browser.close();
