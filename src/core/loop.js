(function(global) {
  'use strict';

  function normalizeDelta(elapsedMs, targetFrameMs, maxDtMultiplier) {
    return Math.min(elapsedMs / targetFrameMs, maxDtMultiplier);
  }

  function computeShakeOffset(shakeTimer, shakeIntensity, shakeDuration, elapsedMs, randomFn = Math.random) {
    if (shakeTimer <= 0) return { shakeX: 0, shakeY: 0, nextShakeTimer: 0 };
    const nextShakeTimer = shakeTimer - elapsedMs;
    const intensity = shakeIntensity * (nextShakeTimer / shakeDuration);
    return {
      shakeX: (randomFn() - 0.5) * intensity * 2,
      shakeY: (randomFn() - 0.5) * intensity * 2,
      nextShakeTimer
    };
  }

  function updateCameraOffset(currentOffset, birdY, canvasHeight, dt) {
    const targetOffsetY = -(birdY - canvasHeight / 2) * 0.1;
    let nextOffset = currentOffset + (targetOffsetY - currentOffset) * 0.05 * dt;
    nextOffset = Math.max(Math.min(nextOffset, canvasHeight * 0.15), -canvasHeight * 0.15);
    return nextOffset;
  }

  const api = {
    normalizeDelta,
    computeShakeOffset,
    updateCameraOffset
  };

  global.DragonLoop = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
