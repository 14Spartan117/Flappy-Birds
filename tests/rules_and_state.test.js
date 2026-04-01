const assert = require('assert');

const {
  computeProgressiveDifficulty,
  getComboMultiplier,
  getPipeColor,
  getMedal
} = require('../src/core/rules.js');
const { shouldStartGame, shouldFlap, toggleBoolean, normalizeJumpKey } = require('../src/core/input.js');
const { normalizeDelta, computeShakeOffset, updateCameraOffset } = require('../src/core/loop.js');

const { GAME_STATES, createStateMachine } = require('../src/core/stateMachine.js');
const { loadSettings, saveSettings, safeLoadJSON } = require('../src/core/storage.js');
const { computeWingOffsets, computeTiltAngle } = require('../src/render/bird.js');
const { renderComboText, calculateFPS } = require('../src/render/hud.js');
const { getDayNightBlend, getSkyColor, getCelestialAlpha, updateParallaxOffsets } = require('../src/render/background.js');
const { computeWarningAlpha } = require('../src/render/pipes.js');
const { computeGroundOffset } = require('../src/render/ground.js');
const { updateScorePopups } = require('../src/render/effects.js');

// Rules checks
{
  const r10 = computeProgressiveDifficulty(10, 3, 200);
  assert(r10.pipeSpeed > 3);
  assert(r10.pipeGap < 200);

  const r300 = computeProgressiveDifficulty(300, 3, 200);
  assert(r300.pipeSpeed <= 6);

  assert.strictEqual(getComboMultiplier(2), 1);
  assert.strictEqual(getComboMultiplier(4), 2);
  assert.strictEqual(getComboMultiplier(6), 3);

  assert.strictEqual(getPipeColor(9).body, '#75B91A');
  assert.strictEqual(getPipeColor(25).body, '#8E44AD');

  assert.strictEqual(getMedal(9), null);
  assert.strictEqual(getMedal(100).label, 'Platinum');
}

// State machine checks
{
  const machine = createStateMachine(GAME_STATES.BOOT);
  assert(machine.canTransition(GAME_STATES.BOOT, GAME_STATES.MENU));
  assert(!machine.canTransition(GAME_STATES.BOOT, GAME_STATES.RUNNING));

  assert(machine.transition(GAME_STATES.MENU));
  assert(machine.transition(GAME_STATES.COUNTDOWN));
  assert(machine.transition(GAME_STATES.RUNNING));
  assert(machine.transition(GAME_STATES.PAUSED));
  assert(machine.transition(GAME_STATES.RUNNING));
  assert(machine.transition(GAME_STATES.GAME_OVER));

  // Invalid unless force=true
  assert(!machine.transition(GAME_STATES.BOOT));
  assert(machine.transition(GAME_STATES.BOOT, true));
}

// Storage/settings checks
{
  const store = {};
  const fakeStorage = {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = v; },
    removeItem: (k) => { delete store[k]; }
  };

  const defaults = loadSettings(fakeStorage);
  assert.strictEqual(defaults.muted, false);
  assert.strictEqual(defaults.showFPS, false);

  saveSettings(fakeStorage, { muted: true, showFPS: true });
  const loaded = loadSettings(fakeStorage);
  assert.strictEqual(loaded.muted, true);
  assert.strictEqual(loaded.showFPS, true);

  const brokenStorage = { getItem: () => '{bad json' };
  const fallback = safeLoadJSON(brokenStorage, 'bad', { safe: true }, () => {});
  assert.strictEqual(fallback.safe, true);
}

// Render helpers checks
{
  const wing = computeWingOffsets(10, 100);
  assert(Number.isFinite(wing.upper));
  assert(Number.isFinite(wing.lower));
  const tilt = computeTiltAngle(12);
  assert(tilt <= 0.7);
  assert(tilt >= -0.4);

  const comboEl = { innerText: '', style: {} };
  renderComboText(comboEl, 4, 2);
  assert(comboEl.innerText.includes('Combo x2'));

  assert.strictEqual(calculateFPS(16.67), 60);
  assert.strictEqual(calculateFPS(0), 0);

  const blend = getDayNightBlend(5000, 5000);
  assert(blend >= 0 && blend <= 1);
  assert(getSkyColor(1, { r: 10, g: 20, b: 30 }, { r: 0, g: 0, b: 0 }).includes('rgb(10, 20, 30)'));
  assert(getCelestialAlpha(0.75, 'sun') > 0);
  assert(getCelestialAlpha(0.25, 'moon') > 0);
  const unchangedOffsets = updateParallaxOffsets(false, 10, 20, 800);
  assert.strictEqual(unchangedOffsets.parallaxOffset1, 10);
  const movedOffsets = updateParallaxOffsets(true, 10, 20, 800);
  assert(movedOffsets.parallaxOffset1 > 10);

  assert.strictEqual(computeWarningAlpha(200, 120, 1000), 0);
  assert(computeWarningAlpha(40, 120, 1000) >= 0);
  assert.strictEqual(computeGroundOffset(12, false, 3), 12);
  assert(computeGroundOffset(12, true, 3) > 12);
  const popups = [{ y: 0, vy: -1, alpha: 0.01 }];
  updateScorePopups(popups, 1);
  assert.strictEqual(popups.length, 0);

  assert.strictEqual(normalizeDelta(16.67, 16.67, 3), 1);
  assert(normalizeDelta(80, 16.67, 3) <= 3);
  const shake = computeShakeOffset(300, 8, 300, 16, () => 0.5);
  assert.strictEqual(shake.shakeX, 0);
  assert.strictEqual(shake.shakeY, 0);
  assert(shake.nextShakeTimer < 300);
  const nextCamera = updateCameraOffset(0, 200, 800, 1);
  assert(Number.isFinite(nextCamera));

  assert.strictEqual(shouldStartGame(false, false), true);
  assert.strictEqual(shouldFlap(true, false), true);
  assert.strictEqual(toggleBoolean(true), false);
  assert.strictEqual(normalizeJumpKey('KeyW'), true);
}

console.log('All node tests passed.');
