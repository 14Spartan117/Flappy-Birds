// Browser smoke tests: load the real game in headless Chromium, play it with a simple
// autopilot, and check the regressions fixed alongside these tests.
// Run with `npm run test:e2e` (the first time, also `npx playwright install chromium`).
'use strict';

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, devices } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const ARTIFACTS = path.join(ROOT, 'test-results');
// Pages are served from disk through request interception, both under a local origin
// and under the real GitHub Pages URL (the game used to change its layout on that host).
const LOCAL = 'http://dragon-flight.test/';
const PAGES = 'https://14spartan117.github.io/Flappy-Birds/';
const GAME_URL = `${LOCAL}index.html?e2e`;
const CONTENT_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  if (browser) await browser.close();
});

function serveFromDisk(route) {
  const { pathname } = new URL(route.request().url());
  let rel = decodeURIComponent(pathname).replace(/^\/Flappy-Birds(?=\/|$)/, '');
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    return route.fulfill({ status: 404, body: 'Not found' });
  }
  return route.fulfill({
    status: 200,
    contentType: CONTENT_TYPES[path.extname(file)] || 'application/octet-stream',
    body: fs.readFileSync(file)
  });
}

async function openPage({ url = GAME_URL, context: contextOptions, storage } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...contextOptions });
  await context.route('**/*', serveFromDisk);
  if (storage) {
    // Seed localStorage once per tab, not again on reloads.
    await context.addInitScript((entries) => {
      if (sessionStorage.getItem('e2e-seeded')) return;
      for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
      sessionStorage.setItem('e2e-seeded', '1');
    }, storage);
  }
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('dialog', (dialog) => dialog.dismiss().catch(() => {}));
  await page.goto(url);
  return { context, page, errors };
}

// Opens a page, runs `body`, fails on any uncaught page error, and saves a screenshot
// to test-results/ when the test fails.
async function withGame(t, options, body) {
  const game = await openPage(options);
  try {
    if (options.waitForGame !== false) {
      await game.page.waitForFunction(() => window.__dragonE2E !== undefined);
    }
    await body(game);
    assert.deepEqual(game.errors, [], 'uncaught errors in the page');
  } catch (err) {
    fs.mkdirSync(ARTIFACTS, { recursive: true });
    const name = t.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    await game.page.screenshot({ path: path.join(ARTIFACTS, `${name}.png`) }).catch(() => {});
    if (game.errors.length) err.message += `\nPage errors: ${game.errors.join(' | ')}`;
    throw err;
  } finally {
    await game.context.close();
  }
}

const gameState = (page) => page.evaluate(() => window.__dragonE2E.state());

// Flaps toward the next gap centre with the same flap a tap triggers. It runs on every
// animation frame inside the page, so its decisions are frame-accurate.
async function setAutopilot(page, enabled) {
  await page.evaluate((on) => {
    window.__e2eAutopilot = on;
    if (window.__e2eAutopilotInstalled) return;
    window.__e2eAutopilotInstalled = true;
    const tick = () => {
      if (window.__e2eAutopilot) {
        const s = window.__dragonE2E.state();
        if (s.gameRunning && !s.paused) {
          const { bird } = s;
          const next = s.pipes.find((p) => p.x + p.width > bird.x - bird.width / 2);
          const target = next ? next.gapY : (s.viewHeight - s.groundHeight) / 2;
          if (bird.y > target + 30 && bird.velocity >= 0) window.__dragonE2E.flap();
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, enabled);
}

async function startRun(page, { difficulty = 'Medium', autopilot = true, tap = false } = {}) {
  await page.click(`#${difficulty.toLowerCase()}-btn`);
  await setAutopilot(page, autopilot);
  const { width, height } = page.viewportSize();
  const position = { x: Math.round(width * 0.6), y: Math.round(height * 0.4) };
  if (tap) await page.tap('#game-canvas', { position });
  else await page.click('#game-canvas', { position });
  await page.waitForFunction(() => window.__dragonE2E.state().gameRunning, null, { timeout: 10_000 });
}

// Resolves once the score reaches `min`; fails fast if the run ends first.
async function waitForScore(page, min, timeout = 90_000) {
  await page.waitForFunction((target) => {
    const s = window.__dragonE2E.state();
    if (!s.gameRunning) throw new Error(`run ended at score ${s.score} before reaching ${target}`);
    return s.score >= target;
  }, min, { timeout, polling: 100 });
}

async function waitForGameOver(page) {
  await page.waitForFunction(() => !window.__dragonE2E.state().gameRunning, null, { timeout: 15_000 });
}

// On-screen boxes of the visible elements among `selectors`. A `::text` suffix measures
// the element's text instead of its box (the score row spans the full width).
async function visibleBoxes(page, selectors) {
  return page.evaluate((sels) => sels.map((sel) => {
    const textOnly = sel.endsWith('::text');
    const el = document.querySelector(textOnly ? sel.slice(0, -'::text'.length) : sel);
    if (!el || getComputedStyle(el).visibility === 'hidden') return null;
    let rect = el.getBoundingClientRect();
    if (textOnly) {
      const range = document.createRange();
      range.selectNodeContents(el);
      rect = range.getBoundingClientRect();
    }
    if (rect.width === 0 || rect.height === 0) return null;
    return { sel, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
  }).filter(Boolean), selectors);
}

function assertNoOverlap(boxes, label) {
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const overlap = a.left < b.right - 0.5 && b.left < a.right - 0.5 &&
        a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
      assert.ok(!overlap, `${label}: ${a.sel} overlaps ${b.sel}\n${JSON.stringify(a)}\n${JSON.stringify(b)}`);
    }
  }
}

describe('Dragon Flight smoke tests', { concurrency: 3 }, () => {
  test('loads the menu without errors', async (t) => {
    await withGame(t, {}, async ({ page }) => {
      assert.ok(await page.isVisible('#start-message'));
      assert.ok(await page.isVisible('#leaderboard'));
      assert.ok(await page.isVisible('#shop-button'));
      assert.equal(await page.isVisible('#pause-button'), false, 'Pause only shows during a run');
    });
  });

  test('an Easy run gets past 10 points (the game loop used to crash there)', async (t) => {
    await withGame(t, {}, async ({ page }) => {
      await startRun(page, { difficulty: 'Easy' });
      await waitForScore(page, 12);
      const s = await gameState(page);
      assert.equal(s.pipeGap, 250 - 2 * Math.floor(s.score / 10), 'difficulty stepped up at 10');
    });
  });

  test('a Medium run gets past 30 points while combos skip multiples of 10', async (t) => {
    await withGame(t, {}, async ({ page }) => {
      await startRun(page, { difficulty: 'Medium' });
      // Medium pipes arrive inside the combo window, so the score runs 1, 2, 4, 6, 9, 12, ..., 21:
      // it never lands on 10 or 20, but the difficulty must still have stepped twice by now.
      for (const target of [21, 31]) {
        await waitForScore(page, target);
        const s = await gameState(page);
        const steps = Math.floor(s.score / 10);
        assert.equal(s.pipeGap, 200 - 2 * steps, `gap after ${steps} difficulty steps (score ${s.score})`);
        assert.ok(Math.abs(s.pipeSpeed - (3 + 0.15 * steps)) < 1e-9, `speed after ${steps} difficulty steps (score ${s.score})`);
      }
    });
  });

  test('the leaderboard name field receives W, M, F and spaces', async (t) => {
    await withGame(t, {}, async ({ page }) => {
      await startRun(page, { difficulty: 'Easy' });
      await waitForScore(page, 1);
      await setAutopilot(page, false);
      await page.waitForSelector('#name-input-modal.visible');
      const before = await gameState(page);
      await page.click('#player-name-input');
      await page.keyboard.type('Will Moffat');
      assert.equal(await page.inputValue('#player-name-input'), 'Will Moffat');
      const after = await gameState(page);
      assert.equal(after.muted, before.muted, 'typing M must not toggle mute');
      assert.equal(after.showFPS, before.showFPS, 'typing F must not toggle the FPS counter');
      await page.keyboard.press('Enter');
      const board = await page.evaluate(() => JSON.parse(localStorage.getItem('leaderboard')));
      assert.equal(board[0].name, 'Will Moffat');
    });
  });

  test('Continue pays each point once, counts one game and keeps one leaderboard entry', async (t) => {
    await withGame(t, { storage: { dragonCoins: '100' } }, async ({ page }) => {
      await startRun(page, { difficulty: 'Easy' });
      await waitForScore(page, 3);
      await setAutopilot(page, false);
      await page.waitForSelector('#name-input-modal.visible');
      const first = await gameState(page);
      assert.equal(first.coins, 100 + first.score);
      await page.fill('#player-name-input', 'Tester');
      await page.press('#player-name-input', 'Enter');

      await page.click('#continue-button');
      await setAutopilot(page, true);
      await waitForScore(page, first.score + 3);
      await setAutopilot(page, false);
      await waitForGameOver(page);
      const final = await gameState(page);

      assert.equal(final.coins, 100 - 50 + final.score, 'every point paid once, minus the Continue');
      const stats = await page.evaluate(() => JSON.parse(localStorage.getItem('dragonStats')));
      assert.equal(stats.totalGames, 1);
      assert.equal(stats.totalScore, final.score);
      assert.equal(await page.isVisible('#name-input-modal.visible'), false, 'no second name prompt');
      const board = await page.evaluate(() => JSON.parse(localStorage.getItem('leaderboard')));
      assert.equal(board.length, 1);
      assert.deepEqual([board[0].name, board[0].score], ['Tester', final.score]);
    });
  });

  test('Shop, Mute and Pause work from the keyboard', async (t) => {
    await withGame(t, {}, async ({ page }) => {
      await page.focus('#shop-button');
      await page.keyboard.press('Enter');
      assert.ok(await page.isVisible('#coin-shop-modal.visible'), 'Enter opens the shop');
      await page.click('#shop-close-btn');

      await page.focus('#mute-button');
      await page.keyboard.press('Enter');
      assert.equal((await gameState(page)).muted, true, 'Enter toggles mute');
      assert.equal(await page.getAttribute('#mute-button', 'aria-pressed'), 'true');

      await startRun(page, { difficulty: 'Easy' });
      await page.focus('#pause-button');
      await page.keyboard.press('Enter');
      assert.equal((await gameState(page)).paused, true, 'Enter on Pause pauses');
      assert.equal(await page.getAttribute('#pause-button', 'aria-label'), 'Resume game');
    });
  });

  test('Space after clicking Pause resumes the run', async (t) => {
    await withGame(t, {}, async ({ page }) => {
      await startRun(page, { difficulty: 'Easy' });
      await page.click('#pause-button');
      assert.equal((await gameState(page)).paused, true);
      await page.keyboard.press('Space');
      await page.waitForFunction(() => !window.__dragonE2E.state().paused, null, { timeout: 6_000 });
      assert.ok((await gameState(page)).gameRunning);
    });
  });

  test('menu controls hide during a run and the dragon lands on the visible ground', async (t) => {
    await withGame(t, {}, async ({ page }) => {
      await startRun(page, { difficulty: 'Medium' });
      for (const sel of ['#leaderboard', '#shop-button', '#donate-button', '#bottom-controls']) {
        assert.equal(await page.isVisible(sel), false, `${sel} is hidden during a run`);
      }
      assert.ok(await page.isVisible('#pause-button'));
      assert.ok(await page.isVisible('#score-display'));

      // Fall to the ground before the first pipe arrives; the camera follows the fall.
      await setAutopilot(page, false);
      await waitForGameOver(page);
      await page.waitForTimeout(700); // the camera must not keep drifting after the crash
      const s = await gameState(page);
      const birdBottomOnScreen = s.bird.y + s.cameraOffsetY + s.bird.height / 2;
      const groundTop = s.viewHeight - s.groundHeight;
      assert.ok(Math.abs(birdBottomOnScreen - groundTop) < 1,
        `dragon rests on the ground (bottom ${birdBottomOnScreen.toFixed(1)}, ground ${groundTop}, camera ${s.cameraOffsetY.toFixed(1)})`);
      assert.ok(await page.isVisible('#shop-button'), 'Shop is back after the run');
      assert.ok(await page.isVisible('#leaderboard'), 'leaderboard is back after the run');
    });
  });

  for (const deviceName of ['iPhone 13', 'iPhone SE (3rd gen)', 'Galaxy S9+']) {
    test(`${deviceName}: menu, run and game over layouts have no overlaps`, async (t) => {
      const leaderboard = JSON.stringify(Array.from({ length: 10 }, (_, i) => ({ name: `Player ${i + 1}`, score: 60 - i * 5 })));
      const options = { context: devices[deviceName], storage: { leaderboard, dragonCoins: '1250', highScore: '60' } };
      await withGame(t, options, async ({ page }) => {
        const { width } = page.viewportSize();
        assertNoOverlap(await visibleBoxes(page, [
          '#leaderboard', '#coin-display', '#mute-button', '#shop-button', '#donate-button',
          '#start-message', '#bottom-controls'
        ]), 'menu');
        const skins = await page.$$eval('.skin-btn', (els) => els.map((el) => {
          const r = el.getBoundingClientRect();
          return { id: el.id, left: r.left, right: r.right };
        }));
        for (const skin of skins) {
          assert.ok(skin.left >= 0 && skin.right <= width, `${skin.id} fits on screen (${skin.left}-${skin.right})`);
        }

        await startRun(page, { difficulty: 'Medium', tap: true });
        await waitForScore(page, 4); // the combo text appears from the third pipe in a row
        assert.equal(await page.isVisible('#leaderboard'), false, 'leaderboard hidden during a run');
        assertNoOverlap(await visibleBoxes(page, [
          '#score-display::text', '#combo-display::text', '#coin-display', '#mute-button', '#pause-button'
        ]), 'run');

        await setAutopilot(page, false);
        await page.waitForSelector('#name-input-modal.visible');
        await page.click('#name-skip-btn');
        assertNoOverlap(await visibleBoxes(page, [
          '#game-over', '#leaderboard', '#coin-display', '#mute-button', '#shop-button', '#donate-button',
          '#bottom-controls'
        ]), 'game over');
      });
    });
  }

  test('the canvas is sharp and undistorted at 2x, also on the GitHub Pages URL', async (t) => {
    for (const url of [GAME_URL, `${PAGES}?e2e`]) {
      const options = { url, context: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 } };
      await withGame(t, options, async ({ page }) => {
        const m = await page.evaluate(() => {
          const canvas = document.getElementById('game-canvas');
          const box = canvas.getBoundingClientRect();
          return {
            top: box.top,
            width: box.width,
            height: box.height,
            bufferWidth: canvas.width,
            bufferHeight: canvas.height,
            innerHeight: window.innerHeight,
            hudTop: document.getElementById('leaderboard').getBoundingClientRect().top
          };
        });
        assert.equal(m.top, 0, `${url}: canvas starts at the top of the window`);
        assert.equal(m.height, m.innerHeight, `${url}: canvas fills the window height`);
        assert.equal(m.bufferWidth, Math.round(m.width * 2), `${url}: buffer width is 2x its CSS width`);
        assert.equal(m.bufferHeight, Math.round(m.height * 2), `${url}: buffer height is 2x its CSS height`);
        assert.equal(m.hudTop, 20, `${url}: HUD sits 20px from the top`);
      });
    }
  });

  test('top pipes reach the top of the screen while the camera follows the dragon', async (t) => {
    await withGame(t, {}, async ({ page }) => {
      await startRun(page, { difficulty: 'Medium' });
      const handle = await page.waitForFunction(() => {
        const s = window.__dragonE2E.state();
        if (s.cameraOffsetY < 2) return false; // camera shifted down: a gap would show sky
        const pipe = s.pipes.find((p) => p.x > s.bird.x + 200 && p.x + p.width < s.viewWidth);
        if (!pipe) return false;
        const ctx = document.getElementById('game-canvas').getContext('2d');
        const x = Math.round((pipe.x + pipe.width / 2) * s.pixelRatio);
        const pixel = Array.from(ctx.getImageData(x, 0, 1, 1).data.slice(0, 3));
        const hex = window.DragonRules.getPipeColor(s.score).body;
        const expected = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
        return { pixel, expected, camera: s.cameraOffsetY };
      }, null, { timeout: 45_000, polling: 'raf' });
      const { pixel, expected, camera } = await handle.jsonValue();
      const matches = pixel.every((value, i) => Math.abs(value - expected[i]) <= 6);
      assert.ok(matches, `top pixel ${pixel} should be the pipe colour ${expected} (camera ${camera.toFixed(1)}px)`);
    });
  });

  test('tests.html passes in the browser', async (t) => {
    await withGame(t, { url: `${LOCAL}tests.html`, waitForGame: false }, async ({ page }) => {
      const summary = (await page.textContent('.summary')).trim();
      const [, passed, total] = summary.match(/(\d+)\/(\d+) tests passed/) || [];
      assert.ok(total && passed === total, summary);
    });
  });
});
