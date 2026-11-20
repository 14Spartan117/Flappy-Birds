const assert = require('assert');
const fs = require('fs');
const { execSync } = require('child_process');

const {
  DIFFICULTY_STEP,
  computeProgressiveDifficulty,
  crossedScoreStep,
  getPipeGapRange,
  settleRunScore,
  getComboMultiplier,
  getPipeColor,
  getMedal
} = require('../src/core/rules.js');

const { GAME_STATES, createStateMachine } = require('../src/core/stateMachine.js');
const { loadSettings, saveSettings, safeLoadJSON } = require('../src/core/storage.js');
const { computeWingOffsets, computeTiltAngle } = require('../src/render/bird.js');
const { renderComboText, calculateFPS } = require('../src/render/hud.js');
const { getDayNightBlend, getSkyColor, getCelestialAlpha, updateParallaxOffsets } = require('../src/render/background.js');
const { computeWarningAlpha } = require('../src/render/pipes.js');
const { computeGroundOffset } = require('../src/render/ground.js');

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

// Difficulty steps: combo multipliers jump the score past exact multiples of 10
{
  assert.strictEqual(DIFFICULTY_STEP, 10);
  assert(crossedScoreStep(9, 10));
  assert(crossedScoreStep(9, 12), '9 -> 12 (x3 combo) still crosses 10');
  assert(crossedScoreStep(27, 30));
  assert(crossedScoreStep(28, 31));
  assert(!crossedScoreStep(10, 12), 'no new step between 10 and 19');
  assert(!crossedScoreStep(0, 9));
  assert(!crossedScoreStep(12, 12));

  // Scaling starts from the run's base values (Challenge mode passes its own)
  const challenge = computeProgressiveDifficulty(12, 4.5, 160);
  assert.strictEqual(challenge.pipeGap, 158);
  assert(Math.abs(challenge.pipeSpeed - 4.65) < 1e-9);
}

// Pipe gap range: the whole gap stays on screen, with real variety on phones
{
  const sizes = [
    [564, 200], // 664px-tall phone, Medium
    [564, 250], // phone, Easy
    [467, 200], // 567px-tall phone
    [290, 200], // landscape phone: range must not invert
    [290, 250],
    [800, 150], // desktop, Hard
    [1300, 200], // tall monitor
    [120, 200] // gap taller than the play area
  ];
  sizes.forEach(([playHeight, gap]) => {
    const { min, max } = getPipeGapRange(playHeight, gap);
    assert(Number.isFinite(min) && Number.isFinite(max), `finite range for ${playHeight}/${gap}`);
    assert(min <= max, `range not inverted for ${playHeight}/${gap}`);
    if (playHeight >= gap) {
      assert(min - gap / 2 >= 0, `gap top on screen for ${playHeight}/${gap}`);
      assert(max + gap / 2 <= playHeight, `gap bottom above ground for ${playHeight}/${gap}`);
    }
  });

  const phone = getPipeGapRange(564, 200);
  assert(phone.max - phone.min >= 200, `phone spread ${phone.max - phone.min}px`);

  const tall = getPipeGapRange(1300, 200);
  assert(tall.max - tall.min <= 250, 'spread capped so consecutive gaps stay reachable');
  assert.strictEqual((tall.min + tall.max) / 2, 650, 'capped range stays centred');

  const tiny = getPipeGapRange(120, 200);
  assert.strictEqual(tiny.min, tiny.max);
}

// Run settlement: Continue keeps the score, so each point is paid out once
{
  const firstDeath = settleRunScore(3, 0, 1);
  assert.deepStrictEqual(firstDeath, { newPoints: 3, coinsEarned: 3, settledScore: 3 });
  const secondDeath = settleRunScore(6, firstDeath.settledScore, 1);
  assert.deepStrictEqual(secondDeath, { newPoints: 3, coinsEarned: 3, settledScore: 6 });
  assert.strictEqual(firstDeath.coinsEarned + secondDeath.coinsEarned, 6, 'a 6-point run pays 6 coins');
  assert.deepStrictEqual(settleRunScore(0, 0, 1), { newPoints: 0, coinsEarned: 0, settledScore: 0 });
  assert.strictEqual(settleRunScore(5, 6, 1).newPoints, 0, 'never negative');
  assert.strictEqual(settleRunScore(10, 4, 2).coinsEarned, 12);
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
}

console.log('All node tests passed.');

// Merge hygiene check: fail fast if conflict markers slipped into tracked files.
{
  const trackedFiles = execSync('git ls-files', { encoding: 'utf8' })
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean)
    .filter((file) => /\.(html|js|md)$/.test(file));

  trackedFiles.forEach((file) => {
    const contents = fs.readFileSync(file, 'utf8');
    const hasMergeMarkers = /^(<<<<<<<|=======|>>>>>>>)\s/m.test(contents);
    assert.strictEqual(
      hasMergeMarkers,
      false,
      `Merge conflict markers found in ${file}`
    );
  });
}
