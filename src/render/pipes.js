(function(global) {
  'use strict';

  function drawPipePair(ctx, x, width, gapY, pipeGap, groundHeight, canvasHeight, bodyColor, capColor) {
    ctx.fillStyle = bodyColor;
    ctx.fillRect(x, 0, width, gapY - pipeGap / 2);
    ctx.fillRect(x, gapY + pipeGap / 2, width, canvasHeight - (gapY + pipeGap / 2) - groundHeight);
    ctx.fillStyle = capColor;
    ctx.fillRect(x - 5, gapY - pipeGap / 2 - 20, width + 10, 20);
    ctx.fillRect(x - 5, gapY + pipeGap / 2, width + 10, 20);
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
