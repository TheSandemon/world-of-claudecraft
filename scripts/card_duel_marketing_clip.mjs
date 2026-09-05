// Marketing capture for the Card Duel table: a frame sequence of a real bot
// match resolving, so the round narration beats and the match ending can be cut
// into a clip, plus stills at desktop and landscape-phone sizes.
//
// Not part of the gate and not a test. It drives the offline client the same way
// scripts/pr_screenshots.mjs does, and writes into OUT_DIR.
//
// Run:  npm run dev   (another terminal)
//       BROWSER_PATH=... GAME_URL=http://localhost:5173 node scripts/card_duel_marketing_clip.mjs
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { BROWSER_PATH } from './browser_path.mjs';
import { enterOfflineGame } from './enter_offline_game.mjs';
import { suppressGpuNotice } from './lib/gpu_notice_suppress.mjs';

const URL = process.env.GAME_URL ?? 'http://localhost:5173';
const OUT = process.env.OUT_DIR ?? 'card-duel-media';
const FPS = Number(process.env.CLIP_FPS ?? 12);
const SECONDS = Number(process.env.CLIP_SECONDS ?? 14);
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: BROWSER_PATH,
  headless: 'new',
  // Software GL, matching scripts/pr_screenshots.mjs: this has to run on a box
  // with no usable GPU.
  args: ['--window-size=1600,900', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  defaultViewport: { width: 1600, height: 900 },
});
const page = await browser.newPage();
page.setDefaultTimeout(120000);

async function dismissGreeting() {
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('button')) {
      if (b.offsetParent && /understood/i.test(b.textContent ?? '')) b.click();
    }
  });
}

async function sitDown() {
  // The HUD hook can land after the world boot hook, so the toggle is retried
  // rather than fired once into an undefined hud.
  await page.waitForFunction(() => typeof window.__game?.hud?.toggleCardDuel === 'function', {
    timeout: 120000,
  });
  for (let i = 0; i < 40; i++) {
    await page.evaluate(() => {
      const sim = window.__game?.sim;
      const p = sim?.player;
      const npc = [...(sim?.entities?.values?.() ?? [])].find(
        (e) => e.kind === 'npc' && e.templateId === 'card_master',
      );
      if (p?.pos && npc?.pos) {
        p.pos.x = npc.pos.x + 1;
        p.pos.y = npc.pos.y;
        p.pos.z = npc.pos.z + 1;
      }
    });
    const open = await page.evaluate(() => {
      const el = document.querySelector('#card-duel-window');
      if (el && el.style.display !== 'none' && el.getClientRects().length) return true;
      window.__game?.hud?.toggleCardDuel?.();
      return false;
    });
    if (open) break;
    await wait(1000);
  }
  await page.waitForSelector('#card-duel-window', { visible: true, timeout: 30000 });
  try {
    await page.waitForSelector('#card-duel-window .cd-regular', { visible: true, timeout: 30000 });
  } catch {
    const seen = await page.evaluate(
      () => document.querySelector('#card-duel-window')?.innerText?.slice(0, 500) ?? '(no window)',
    );
    throw new Error(`no opponent list; window shows:
${seen}`);
  }
  await page.evaluate(() => document.querySelector('#card-duel-window .cd-regular')?.click());
  await page.waitForSelector('#card-duel-window [data-cd-hand] .cf', {
    visible: true,
    timeout: 60000,
  });
}

/** Bring the opponent to the brink so the NEXT round both narrates and ends the
 *  match: one clip then carries a round, the outro beats and the summary. */
async function setUpFinale() {
  return page.evaluate(() => {
    const sim = window.__game?.sim;
    const match = sim?.cardDuelMatchFor?.(sim.primaryId);
    if (!match) return 'no match';
    match.state.b.hp = 1;
    return `opponent hp -> ${match.state.b.hp}`;
  });
}

const clip = async (name, frames) => {
  const el = await page.$('#card-duel-window');
  for (let i = 0; i < frames; i++) {
    await el.screenshot({ path: `${OUT}/${name}-${String(i).padStart(3, '0')}.png` });
    await wait(Math.round(1000 / FPS));
  }
};

// The GPU notice is a modal over the entry shell: without this the offline
// entry never completes and window.__game is never set.
await suppressGpuNotice(page);
// domcontentloaded, not networkidle0: the marketing shell polls /api/site-presence
// and /api/project-stats, and with no game server on :8787 those never go quiet,
// so networkidle0 burns the whole navigation timeout.
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
const entered = await enterOfflineGame(page, {
  charClass: 'warrior',
  charName: 'Thorgar',
  settleMs: 3000,
  selectorTimeoutMs: 120000,
  gameBootTimeoutMs: 240000,
});
if (!entered) {
  await page.screenshot({ path: `${OUT}/entry-failure.png` });
  const where = await page.evaluate(() => ({
    body: document.body?.innerText?.slice(0, 300),
    hasGame: !!window.__game,
  }));
  throw new Error(`offline entry never reached the world boot hook: ${JSON.stringify(where)}`);
}
await wait(2500);
await dismissGreeting();
await wait(500);
await sitDown();
await dismissGreeting();

// Stills first, while the table is idle and readable.
await page.$eval('#card-duel-window', (n) => n.scrollIntoView());
await (await page.$('#card-duel-window')).screenshot({ path: `${OUT}/still-desktop-table.png` });

console.log(await setUpFinale());
await wait(400);
// Play a card: the round resolves, narrates, and ends the match.
await page.evaluate(() => {
  document.querySelector('#card-duel-window [data-cd-hand] .cf:not([disabled])')?.click();
});
await clip('beats', FPS * SECONDS);
await (await page.$('#card-duel-window')).screenshot({ path: `${OUT}/still-desktop-summary.png` });

console.log(`wrote frames + stills into ${OUT}/`);
await browser.close();
