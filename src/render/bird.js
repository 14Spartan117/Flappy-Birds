(function(global) {
  'use strict';

  function computeWingOffsets(velocity, wingTimer) {
    const wingAngle = Math.max(-0.5, Math.min(0.5, velocity * 0.05));
    const wingSin = Math.sin(wingTimer * 0.15) * 0.3;
    return {
      upper: wingAngle - wingSin,
      lower: wingAngle + wingSin
    };
  }

  function computeTiltAngle(velocity) {
    return Math.max(-0.4, Math.min(0.7, velocity * 0.06));
  }

  const api = { computeWingOffsets, computeTiltAngle };
  global.DragonRenderBird = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
