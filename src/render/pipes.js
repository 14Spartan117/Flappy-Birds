(function(global) {
  'use strict';

  // Pipes are drawn with the vertical camera offset, so each one extends a full
  // screen height past the top and bottom edges; otherwise the offset reveals their
  // ends. The ground is drawn over the bottom part (groundHeight is kept for callers).
  function drawPipePair(ctx, x, width, gapY, pipeGap, groundHeight, canvasHeight, bodyColor, capColor) {
    const overscan = canvasHeight;
    const topPipeEnd = gapY - pipeGap / 2;
    const bottomPipeStart = gapY + pipeGap / 2;
    ctx.fillStyle = bodyColor;
    ctx.fillRect(x, -overscan, width, topPipeEnd + overscan);
    ctx.fillRect(x, bottomPipeStart, width, canvasHeight + overscan - bottomPipeStart);
    ctx.fillStyle = capColor;
    ctx.fillRect(x - 5, topPipeEnd - 20, width + 10, 20);
    ctx.fillRect(x - 5, bottomPipeStart, width + 10, 20);
  }

  function drawPipeWarningOverlay(ctx, x, width, gapY, pipeGap, groundHeight, canvasHeight, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    drawPipePair(ctx, x, width, gapY, pipeGap, groundHeight, canvasHeight, '#FF4500', '#FF4500');
    ctx.restore();
  }

  function computeWarningAlpha(distToPipe, warnThreshold, nowMs) {
    if (distToPipe >= warnThreshold) return 0;
    const warnRatio = 1 - distToPipe / warnThreshold;
    const flash = Math.sin(nowMs * 0.015) * 0.5 + 0.5;
    return warnRatio * flash * 0.5;
  }

  const api = { drawPipePair, drawPipeWarningOverlay, computeWarningAlpha };
  global.DragonRenderPipes = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
