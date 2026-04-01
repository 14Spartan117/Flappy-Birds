(function(global) {
  'use strict';

  function computeProgressiveDifficulty(score, basePipeSpeed, basePipeGap) {
    let pipeSpeed = basePipeSpeed;
    let pipeGap = basePipeGap;
    const maxPipeSpeed = basePipeSpeed + 3;
    const minGap = 80;
    const ticks = Math.floor(score / 10);

    for (let i = 0; i < ticks; i++) {
      pipeSpeed = Math.min(pipeSpeed + 0.15, maxPipeSpeed);
      pipeGap = Math.max(pipeGap - 2, minGap);
    }

    return { pipeSpeed, pipeGap };
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
    computeProgressiveDifficulty,
    getComboMultiplier,
    getPipeColor,
    getMedal
  };

  global.DragonRules = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
