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

async function openPage({ url = GAME_URL, context: contextOptions, storage, random } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...contextOptions });
  await context.route('**/*', serveFromDisk);
  if (random !== undefined) {
    // Pin Math.random (no game code loops on it) to get a predictable pipe gap.
    await context.addInitScript((value) => { Math.random = () => value; }, random);
  }
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

// Opens a page, runs `body`, fails as soon as the page throws an uncaught error, and
// saves a screenshot to test-results/ when the test fails.
async function withGame(t, options, body) {
  const game = await openPage(options);
  let rejectOnCrash;
  const crashed = new Promise((resolve, reject) => { rejectOnCrash = reject; });
  crashed.catch(() => {});
  game.page.on('pageerror', (err) => rejectOnCrash(new Error(`uncaught error in the page: ${err.message}`)));
  try {
    if (options.waitForGame !== false) {
      await game.page.waitForFunction(() => window.__dragonE2E !== undefined);
    }
    await Promise.race([body(game), crashed]);
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
// animation frame inside the page, so its decisions are frame-accurate. A flap lifts the
// dragon about 95px, so flapping 42px below the centre keeps it inside any gap of 145px+.
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
          if (bird.y > target + 42 && bird.velocity >= 0) window.__dragonE2E.flap();
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
    // Each toggle key (F, M) appears exactly once, so a hotkey firing can't cancel itself out.
    const NAME = 'Fran W. Mole';
    await withGame(t, {}, async ({ page }) => {
      await startRun(page, { difficulty: 'Easy' });
      await waitForScore(page, 1);
      await setAutopilot(page, false);
      await page.waitForSelector('#name-input-modal.visible');
      const before = await gameState(page);
      const settingsBefore = await page.evaluate(() => localStorage.getItem('dragonSettings'));
      await page.click('#player-name-input');
      await page.keyboard.type(NAME);
      assert.equal(await page.inputValue('#player-name-input'), NAME);
      const after = await gameState(page);
      assert.equal(after.muted, before.muted, 'typing M must not toggle mute');
      assert.equal(after.showFPS, before.showFPS, 'typing F must not toggle the FPS counter');
      assert.equal(await page.evaluate(() => localStorage.getItem('dragonSettings')), settingsBefore, 'saved settings unchanged');
      await page.keyboard.press('Enter');
      const board = await page.evaluate(() => JSON.parse(localStorage.getItem('leaderboard')));
      assert.equal(board[0].name, NAME);
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

  test('Space presses a focused Mute or Shop button', async (t) => {
    await withGame(t, {}, async ({ page }) => {
      await page.focus('#mute-button');
      await page.keyboard.press('Space');
      assert.equal((await gameState(page)).muted, true, 'Space on a focused Mute mutes');
      await page.focus('#shop-button');
      await page.keyboard.press('Space');
      assert.ok(await page.isVisible('#coin-shop-modal.visible'), 'Space on a focused Shop opens the shop');
    });
  });

  test('after mouse-clicking Mute mid-run, Space pauses and leaves the sound alone', async (t) => {
    await withGame(t, {}, async ({ page }) => {
      await startRun(page, { difficulty: 'Easy' });
      await page.click('#mute-button');
      const before = await gameState(page);
      assert.notEqual(await page.evaluate(() => document.activeElement.id), 'mute-button', 'Mute kept focus after a mouse click');
      await page.keyboard.press('Space');
      const after = await gameState(page);
      assert.equal(after.paused, true, 'Space pauses');
      assert.equal(after.muted, before.muted, 'Space pressed Mute again');
    });
  });

  test('hotkeys do nothing while the shop is open', async (t) => {
    await withGame(t, {}, async ({ page }) => {
      await page.click('#shop-button');
      assert.ok(await page.isVisible('#coin-shop-modal.visible'));
      const before = await gameState(page);
      for (const key of ['KeyM', 'KeyF', 'ArrowUp', 'KeyW']) await page.keyboard.press(key);
      const after = await gameState(page);
      assert.equal(after.muted, before.muted, 'M behind the shop toggled mute');
      assert.equal(after.showFPS, before.showFPS, 'F behind the shop toggled the FPS counter');
      const runActive = await page.evaluate(() => document.getElementById('game-container').classList.contains('run-active'));
      assert.equal(runActive, false, 'ArrowUp behind the shop started a run');
    });
  });

  test('the shop is a modal dialog: focus moves in and stays in, and Escape closes it', async (t) => {
    await withGame(t, {}, async ({ page }) => {
      // Open it from a locked skin at game over, where Restart and Continue sit behind it.
      await startRun(page, { difficulty: 'Easy', autopilot: false });
      await waitForGameOver(page); // score 0, so no name prompt
      await page.focus('#diamond-skin-btn');
      await page.keyboard.press('Enter');
      assert.ok(await page.isVisible('#coin-shop-modal.visible'), 'a locked skin opens the shop');
      const focusIn = () => page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return 'page';
        return document.getElementById('coin-shop-modal').contains(el) ? 'dialog' : `#${el.id || el.tagName}`;
      });
      assert.equal(await focusIn(), 'dialog', 'focus moved into the shop');
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
        const where = await focusIn();
        assert.ok(where === 'dialog' || where === 'page', `Tab reached ${where} behind the shop`);
      }
      await page.keyboard.press('Escape');
      assert.equal(await page.isVisible('#coin-shop-modal.visible'), false, 'Escape closes the shop');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'diamond-skin-btn', 'focus returns to the skin button');
      assert.equal((await gameState(page)).gameRunning, false, 'no run started behind the shop');
    });
  });

  test('Pause is disabled while there is nothing to pause, and Restart clears the old score', async (t) => {
    await withGame(t, {}, async ({ page }) => {
      await startRun(page, { difficulty: 'Easy' });
      assert.equal(await page.isDisabled('#pause-button'), false, 'enabled while running');
      await waitForScore(page, 1);
      const muteLeft = () => page.evaluate(() => document.getElementById('mute-button').getBoundingClientRect().left);
      const leftWhileRunning = await muteLeft();
      await page.keyboard.press('Space');
      assert.equal(await page.isDisabled('#pause-button'), false, 'Resume is enabled while paused');
      assert.equal(await muteLeft(), leftWhileRunning, 'the "Resume" label does not shift the HUD');
      await page.keyboard.press('Space');
      assert.equal(await page.isDisabled('#pause-button'), true, 'disabled during the resume countdown');
      await page.waitForFunction(() => !window.__dragonE2E.state().paused, null, { timeout: 6_000 });
      assert.equal(await page.isDisabled('#pause-button'), false, 'enabled again after resuming');

      await setAutopilot(page, false);
      await page.waitForSelector('#name-input-modal.visible');
      await page.click('#name-skip-btn');
      await page.click('#restart-button');
      assert.equal((await page.textContent('#score-display')).trim(), '0', 'the countdown shows a fresh score');
      assert.equal(await page.isDisabled('#pause-button'), true, 'disabled during the start countdown');
    });
  });

  test('Continue hides the menu controls again and shows Pause', async (t) => {
    await withGame(t, { storage: { dragonCoins: '100' } }, async ({ page }) => {
      await startRun(page, { difficulty: 'Easy' });
      await waitForScore(page, 1);
      await setAutopilot(page, false);
      await page.waitForSelector('#name-input-modal.visible');
      await page.click('#name-skip-btn');
      await page.click('#continue-button');
      await setAutopilot(page, true);
      for (const sel of ['#leaderboard', '#shop-button', '#donate-button', '#bottom-controls']) {
        assert.equal(await page.isVisible(sel), false, `${sel} is hidden after Continue`);
      }
      assert.ok(await page.isVisible('#pause-button'), 'Pause is shown after Continue');
      assert.equal(await page.isDisabled('#pause-button'), false, 'Pause works after Continue');
    });
  });

  test('tapping the "Tap to start" message starts the game', async (t) => {
    await withGame(t, { context: devices['iPhone 13'] }, async ({ page }) => {
      const box = await page.locator('#start-message').boundingBox();
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForFunction(() => document.getElementById('game-container').classList.contains('run-active'),
        null, { timeout: 3_000 });
    });
  });
  test('Space after clicking Pause resumes the run', async (t) => {
    await withGame(t, {}, async ({ page }) => {
      await startRun(page, { difficulty: 'Easy' });
      await page.click('#pause-button');
      assert.equal((await gameState(page)).paused, true);
      assert.notEqual(await page.evaluate(() => document.activeElement.id), 'pause-button', 'Pause kept focus after a mouse click');
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

  // Long names (the field allows 20 characters) alternate with short ones.
  const LAYOUT_NAMES = ['Christopher Robinson', 'Ava', 'Elizabeth Richardson', 'Ben', 'Maximilian Fernandez',
    'Cleo', 'Alexandra Montgomery', 'Dev', 'Jonathan Livingstone', 'Eli'];
  const LAYOUT_DEVICES = [
    ['iPhone 13', devices['iPhone 13']],
    ['iPhone SE (3rd gen)', devices['iPhone SE (3rd gen)']],
    // The visible Safari area of an iPhone SE / 8 with both toolbars showing.
    ['iPhone SE in Safari (375x548)', { ...devices['iPhone SE (3rd gen)'], viewport: { width: 375, height: 548 } }],
    ['Galaxy S9+', devices['Galaxy S9+']],
    ['iPhone 13 landscape', devices['iPhone 13 landscape']],
    ['iPad (gen 11)', devices['iPad (gen 11)']]
  ];
  for (const [deviceName, contextOptions] of LAYOUT_DEVICES) {
    test(`${deviceName}: menu, run and game over layouts have no overlaps`, async (t) => {
      const leaderboard = JSON.stringify(LAYOUT_NAMES.map((name, i) => ({ name, score: 60 - i * 5 })));
      const options = { context: contextOptions, storage: { leaderboard, dragonCoins: '123456', highScore: '60' } };
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

        // 10+ points adds a medal to the game over panel, its tallest form.
        await waitForScore(page, 10);
        await setAutopilot(page, false);
        await page.waitForSelector('#name-input-modal.visible');
        await page.click('#name-skip-btn');
        assert.ok(await page.isVisible('#medal-display span'), 'the game over panel shows a medal');
        assertNoOverlap(await visibleBoxes(page, [
          '#game-over', '#leaderboard', '#coin-display', '#mute-button', '#shop-button', '#donate-button',
          '#bottom-controls'
        ]), 'game over');
      });
    });
  }

  test('the canvas re-renders when the pixel ratio changes without a resize', async (t) => {
    await withGame(t, { context: { viewport: { width: 1000, height: 700 }, deviceScaleFactor: 1 } }, async ({ page, context }) => {
      assert.equal(await page.evaluate(() => document.getElementById('game-canvas').width), 1000);
      // Like dragging the window onto a 2x display: same CSS size, new pixel ratio.
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1000, height: 700, deviceScaleFactor: 2, mobile: false });
      await page.waitForFunction(() => document.getElementById('game-canvas').width === 2000, null, { timeout: 5_000 });
    });
  });

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

  test('bottom pipes reach the ground while the camera follows a low dragon', async (t) => {
    await withGame(t, {}, async ({ page }) => {
      await startRun(page, { difficulty: 'Medium', autopilot: false });
      // Hover low, so the camera shifts the playfield up, before the first pipe arrives.
      await page.evaluate(() => {
        const tick = () => {
          const s = window.__dragonE2E.state();
          if (s.bird.y > s.viewHeight - s.groundHeight - 120 && s.bird.velocity >= 0) window.__dragonE2E.flap();
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      const handle = await page.waitForFunction(() => {
        const s = window.__dragonE2E.state();
        if (s.cameraOffsetY > -6) return false; // shifted up: a short bottom pipe would end above the ground
        const pipe = s.pipes.find((p) => p.x > s.bird.x + 200 && p.x + p.width < s.viewWidth);
        if (!pipe) return false;
        const ctx = document.getElementById('game-canvas').getContext('2d');
        const y = Math.round((s.viewHeight - s.groundHeight + s.cameraOffsetY / 2) * s.pixelRatio);
        const hex = window.DragonRules.getPipeColor(s.score).body;
        const expected = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
        let matches = 0;
        let samples = 0;
        // Sample across the pipe: grass blades poke up to 13px above the ground line.
        for (let x = pipe.x + 5; x < pipe.x + pipe.width - 5; x += 2) {
          const px = ctx.getImageData(Math.round(x * s.pixelRatio), y, 1, 1).data;
          samples++;
          if ([0, 1, 2].every((i) => Math.abs(px[i] - expected[i]) <= 6)) matches++;
        }
        return { matches, samples, camera: s.cameraOffsetY };
      }, null, { timeout: 45_000, polling: 'raf' });
      const { matches, samples, camera } = await handle.jsonValue();
      assert.ok(matches / samples >= 0.5,
        `${matches}/${samples} pixels just above the ground are pipe-coloured (camera ${camera.toFixed(1)}px)`);
    });
  });

  test('the dragon can reach the visible top of the screen', async (t) => {
    await withGame(t, {}, async ({ page }) => {
      await startRun(page, { difficulty: 'Easy', autopilot: false });
      await page.evaluate(() => {
        const tick = () => { window.__dragonE2E.flap(); requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      });
      const handle = await page.waitForFunction(() => {
        const s = window.__dragonE2E.state();
        return s.cameraOffsetY > 35 ? s : false; // the dragon has been pressed against the top for a while
      }, null, { timeout: 5_000, polling: 'raf' });
      const s = await handle.jsonValue();
      const topOnScreen = s.bird.y - s.bird.height / 2 + s.cameraOffsetY;
      assert.ok(Math.abs(topOnScreen) < 1, `dragon top on screen at ${topOnScreen.toFixed(1)}px (camera ${s.cameraOffsetY.toFixed(1)}px)`);
    });
  });

  test('the canvas buffer is capped at 2x on a 3x screen', async (t) => {
    await withGame(t, { context: { viewport: { width: 400, height: 700 }, deviceScaleFactor: 3 } }, async ({ page }) => {
      const m = await page.evaluate(() => {
        const canvas = document.getElementById('game-canvas');
        const box = canvas.getBoundingClientRect();
        return { width: box.width, height: box.height, bufferWidth: canvas.width, bufferHeight: canvas.height };
      });
      assert.equal(m.bufferWidth, Math.round(m.width * 2), 'buffer width is 2x the CSS width');
      assert.equal(m.bufferHeight, Math.round(m.height * 2), 'buffer height is 2x the CSS height');
    });
  });

  test('pipe gaps use the whole phone play area and stay on screen', async (t) => {
    const centres = [];
    for (const random of [0, 0.999999]) {
      await withGame(t, { context: devices['iPhone 13'], random }, async ({ page }) => {
        await startRun(page, { difficulty: 'Medium', tap: true });
        const handle = await page.waitForFunction(() => {
          const s = window.__dragonE2E.state();
          return s.pipes.length > 0 ? s : false;
        }, null, { timeout: 10_000 });
        const s = await handle.jsonValue();
        const playHeight = s.viewHeight - s.groundHeight;
        const { gapY } = s.pipes[0];
        assert.ok(gapY - s.pipeGap / 2 >= 0 && gapY + s.pipeGap / 2 <= playHeight,
          `gap centred at ${gapY} is fully on screen (play area ${playHeight}px)`);
        centres.push(gapY);
      });
    }
    const spread = centres[1] - centres[0];
    assert.ok(spread >= 150, `gap centres span ${spread.toFixed(1)}px on a 664px-tall phone (${centres.map((c) => c.toFixed(1))})`);
  });

  test('on a landscape phone, Easy gaps fit the sky so pipes stay visible', async (t) => {
    await withGame(t, { context: devices['iPhone 13 landscape'] }, async ({ page }) => {
      await startRun(page, { difficulty: 'Easy', tap: true });
      const handle = await page.waitForFunction(() => {
        const s = window.__dragonE2E.state();
        return s.pipes.length > 0 ? s : false;
      }, null, { timeout: 10_000 });
      const s = await handle.jsonValue();
      const playHeight = s.viewHeight - s.groundHeight;
      const { gapY } = s.pipes[0];
      assert.ok(s.pipeGap < 250 && s.pipeGap >= 160, `Easy gap fitted to the ${playHeight}px sky (got ${s.pipeGap})`);
      assert.ok(gapY - s.pipeGap / 2 >= 20, `top pipe shows (ends at ${gapY - s.pipeGap / 2})`);
      assert.ok(gapY + s.pipeGap / 2 <= playHeight - 20, `bottom pipe shows (starts at ${gapY + s.pipeGap / 2})`);
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
