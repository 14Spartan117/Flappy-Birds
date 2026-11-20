(function(global) {
  'use strict';

  // Score interval at which progressive difficulty steps up.
  const DIFFICULTY_STEP = 10;

  function computeProgressiveDifficulty(score, basePipeSpeed, basePipeGap) {
    let pipeSpeed = basePipeSpeed;
    let pipeGap = basePipeGap;
    const maxPipeSpeed = basePipeSpeed + 3;
    const minGap = 80;
    const ticks = Math.floor(score / DIFFICULTY_STEP);

    for (let i = 0; i < ticks; i++) {
      pipeSpeed = Math.min(pipeSpeed + 0.15, maxPipeSpeed);
      pipeGap = Math.max(pipeGap - 2, minGap);
    }

    return { pipeSpeed, pipeGap };
  }

  // True when a score change passes a multiple of `step`. Combo multipliers add
  // 2-3 points at a time (9 -> 12), so `score % step === 0` would skip steps.
  function crossedScoreStep(previousScore, newScore, step = DIFFICULTY_STEP) {
    return Math.floor(newScore / step) > Math.floor(previousScore / step);
  }

  // Range for a pipe gap's centre inside the play area (the sky above the ground).
  // The whole gap plus `edgeMargin` of pipe stays on screen; on short screens the
  // margin shrinks instead of the range inverting, and on tall screens the spread
  // is capped at `maxSpan` so consecutive gaps stay reachable.
  function getPipeGapRange(playHeight, pipeGap, { edgeMargin = 60, maxSpan = 250 } = {}) {
    const spare = Math.max(0, playHeight - pipeGap);
    const margin = Math.min(edgeMargin, spare / 4);
    let min = margin + pipeGap / 2;
    let max = playHeight - margin - pipeGap / 2;
    if (max <= min) {
      const mid = playHeight / 2;
      return { min: mid, max: mid };
    }
    if (max - min > maxSpan) {
      const mid = (min + max) / 2;
      min = mid - maxSpan / 2;
      max = mid + maxSpan / 2;
    }
    return { min, max };
  }

  // Coins and stats are settled at every game over, but Continue keeps the same
  // run (and score) going, so only points earned since the last settlement are new.
  function settleRunScore(score, alreadySettledScore, coinsPerPoint) {
    const newPoints = Math.max(0, score - alreadySettledScore);
    return {
      newPoints,
      coinsEarned: newPoints * coinsPerPoint,
      settledScore: Math.max(score, alreadySettledScore)
    };
  }

  function getComboMultiplier(comboCount) {
    if (comboCount >= 5) return 3;
    if (comboCount >= 3) return 2;
    return 1;
  }

  function getPipeColor(score) {
    if (score >= 50) return { body: '#C0392B', cap: '#962d22' };
    if (score >= 25) return { body: '#8E44AD', cap: '#6c3483' };
    if (score >= 10) return { body: '#2980B9', cap: '#1a6391' };
    return { body: '#75B91A', cap: '#5A9117' };
  }

  function getMedal(score) {
    if (score >= 100) return { label: 'Platinum', color: '#E5E4E2', glow: '#fff' };
    if (score >= 50) return { label: 'Gold', color: '#FFD700', glow: '#ffa500' };
    if (score >= 25) return { label: 'Silver', color: '#C0C0C0', glow: '#aaa' };
    if (score >= 10) return { label: 'Bronze', color: '#CD7F32', glow: '#8B4513' };
    return null;
  }

  const api = {
    DIFFICULTY_STEP,
    computeProgressiveDifficulty,
    crossedScoreStep,
    getPipeGapRange,
    settleRunScore,
    getComboMultiplier,
    getPipeColor,
    getMedal
  };

  global.DragonRules = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
