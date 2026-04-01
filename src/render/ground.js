(function(global) {
  'use strict';

  function computeGroundOffset(currentOffset, gameRunning, pipeSpeed) {
    if (!gameRunning) return currentOffset;
    return (currentOffset + pipeSpeed * 0.6) % 36;
  }

  function drawGroundAndGrass(ctx, canvasWidth, canvasHeight, groundHeight, groundOffset, grassTimer) {
    ctx.fillStyle = '#DED895';
    ctx.fillRect(0, canvasHeight - groundHeight, canvasWidth, groundHeight);
    ctx.fillStyle = '#755C48';
    ctx.fillRect(0, canvasHeight - groundHeight, canvasWidth, 20);

    ctx.fillStyle = 'rgba(100,70,40,0.25)';
    for (let dx = -groundOffset; dx < canvasWidth + 36; dx += 36) {
      ctx.fillRect(dx, canvasHeight - groundHeight, 18, 6);
    }

    const bladeSpacing = 18;
    const groundTop = canvasHeight - groundHeight;
    for (let gx = 0; gx < canvasWidth; gx += bladeSpacing) {
      const sway = Math.sin(grassTimer + gx * 0.1) * 4;
      const h = 10 + Math.sin(gx * 0.3) * 3;
      ctx.fillStyle = '#4a9e2f';
      ctx.beginPath();
      ctx.moveTo(gx - 3, groundTop);
      ctx.lineTo(gx + sway, groundTop - h);
      ctx.lineTo(gx + 3, groundTop);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawBirdGroundShadow(ctx, birdX, visualBirdY, groundY) {
    const distanceFromGround = Math.max(0, groundY - visualBirdY);
    const maxDist = groundY * 0.75;
    const ratio = Math.min(1, distanceFromGround / maxDist);
    const shadowW = 28 * (1 - ratio * 0.65);
    const shadowH = 7 * (1 - ratio * 0.65);
    const shadowAlpha = 0.45 * (1 - ratio * 0.82);
    if (shadowAlpha <= 0.01) return;

    ctx.save();
    ctx.globalAlpha = shadowAlpha;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(birdX, groundY - 4, shadowW, shadowH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const api = { computeGroundOffset, drawGroundAndGrass, drawBirdGroundShadow };
  global.DragonRenderGround = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
