// Screenshots the IN-GAME Card Duel window (the Card Master's table) at desktop
// and phone widths, over the live world.
//
// Sits down against one of the Card Master's regulars (always offered, online
// or offline), plays a card, and waits for the round theater to settle, so the
// shot carries the whole table rather than the queue affordance.
//
// Needs `npm run dev`.
//
// Usage:
//   node scripts/card_duel_window_shot.mjs
//   BASE=http://localhost:5174 TAG=before node scripts/card_duel_window_shot.mjs
//   FX=low node scripts/card_duel_window_shot.mjs          the lowest graphics preset
//   PEEK=1 node scripts/card_duel_window_shot.mjs          hovering a hand card
//
// FX stamps the tier the applier would stamp (`html[data-fx-level]`), which is
// the whole input to the Card Duel tier rules, so a low-preset table can be
// photographed without driving the settings window. PEEK hovers a hand card so
// the shot carries the card inspector rather than the bare table.
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { BROWSER_PATH } from './browser_path.mjs';
import { enterOfflineGame } from './enter_offline_game.mjs';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const OUT = process.env.OUT ?? 'docs/screenshots/card-duel-table';
const TAG = process.env.TAG ?? 'after';
const FX = process.env.FX ?? '';
const PEEK = process.env.PEEK === '1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: BROWSER_PATH,
  headless: 'new',
  args: ['--no-sandbox', '--use-angle=swiftshader'],
});

async function shot(name, width, height, mobile) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 2 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  // domcontentloaded, not networkidle: the game client keeps streaming assets,
  // so an idle wait can outlast the default timeout on a cold dev server.
  // enterOfflineGame waits for the real entry affordance anyway.
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await enterOfflineGame(page, { charClass: 'warrior', charName: 'Cardsharp' });
  if (mobile) await page.evaluate(() => document.body.classList.add('mobile-touch'));
  // The GPU-acceleration notice sits over the whole HUD in headless.
  await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button')) {
      if (btn.textContent?.trim() === 'Dismiss') btn.click();
    }
  });
  // A cold dev server can outlast enterOfflineGame's own boot wait, and the
  // next step reads window.__game, so wait for the world itself rather than
  // trusting the entry helper's timeout.
  await page.waitForFunction(() => Boolean(window.__game?.sim?.player), { timeout: 120000 });
  // Sitting down needs the player AT the table (cardMasterInRange), so walk
  // them there the short way rather than driving movement for a screenshot.
  await page.evaluate(() => {
    const sim = window.__game.sim;
    const npc = [...sim.entities.values()].find(
      (e) => e.kind === 'npc' && e.templateId === 'card_master',
    );
    if (!npc) throw new Error('the Card Master is not in this world');
    const p = sim.player;
    p.pos.x = npc.pos.x + 1;
    p.pos.z = npc.pos.z + 1;
    p.pos.y = npc.pos.y;
    p.prevPos = { ...p.pos };
  });
  if (FX)
    await page.evaluate((tier) => document.documentElement.setAttribute('data-fx-level', tier), FX);
  await page.evaluate(() => window.__game.hud.toggleCardDuel());
  await page.waitForSelector('#card-duel-window .cd-regular');
  // Sit down against the first regular: a bot match starts immediately, which
  // is the only way to reach the live table in a single-player world.
  await page.evaluate(() => {
    document.querySelector('#card-duel-window .cd-regular').click();
  });
  await page.waitForSelector('#card-duel-window [data-cd-hand] .cf', { timeout: 15000 });
  await page.evaluate(() => {
    document.querySelector('#card-duel-window [data-cd-hand] .cf:not([disabled])').click();
  });
  // The bot's commit delay plus the whole round timeline, with margin.
  await sleep(6000);
  if (PEEK) {
    // The card inspector, over a card still in hand: hover it and give the one
    // layout read a frame to land. The popup is fixed-position on <body>, so a
    // peeked shot is always the whole viewport.
    const card = await page.$('#card-duel-window [data-cd-hand] [data-inspect]');
    if (!card) throw new Error('no inspectable card in hand');
    await card.hover();
    await sleep(400);
    await page.screenshot({ path: `${OUT}/${name}-peek-${TAG}.png` });
    console.log('wrote', `${OUT}/${name}-peek-${TAG}.png`);
    await page.close();
    return;
  }
  if (mobile) {
    // The whole viewport on a phone: the window is a full-width sheet there,
    // and what a player actually sees INCLUDES how much of the table fits.
    await page.screenshot({ path: `${OUT}/${name}-${TAG}.png` });
  } else {
    const win = await page.$('#card-duel-window');
    await win.screenshot({ path: `${OUT}/${name}-${TAG}.png` });
  }
  console.log('wrote', `${OUT}/${name}-${TAG}.png`);
  await page.close();
}

await shot('duel-window-desktop', 1600, 1000, false);
// Landscape, because the game client's own orientation gate refuses portrait
// on a phone: a portrait shot would only ever photograph that gate.
await shot('duel-window-mobile', 844, 430, true);
await browser.close();
