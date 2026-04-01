(function(global) {
  'use strict';

  function getDayNightBlend(nowMs, cycleSpeed) {
    return (Math.sin(nowMs / cycleSpeed) + 1) / 2;
  }

  function getSkyColor(dayNightT, dayColor, nightColor) {
    const r = Math.floor(dayColor.r * dayNightT + nightColor.r * (1 - dayNightT));
    const g = Math.floor(dayColor.g * dayNightT + nightColor.g * (1 - dayNightT));
    const b = Math.floor(dayColor.b * dayNightT + nightColor.b * (1 - dayNightT));
    return `rgb(${r}, ${g}, ${b})`;
  }

  function getCelestialAlpha(dayNightT, mode) {
    if (mode === 'sun') return Math.min(1, (dayNightT - 0.5) * 4);
    return Math.min(1, (0.5 - dayNightT) * 4);
  }

  function drawTwinklingStars(ctx, stars, canvasWidth, canvasHeight, dayNightT, nowMs) {
    if (dayNightT >= 0.5) return;
    const starAlpha = Math.max(0, 1 - dayNightT * 2);
    stars.forEach((star) => {
      const twinkle = (Math.sin(nowMs * 0.001 * star.speed + star.phase) + 1) / 2;
      ctx.fillStyle = `rgba(255,255,255,${starAlpha * (0.4 + twinkle * 0.6)})`;
      ctx.beginPath();
      ctx.arc(star.x * canvasWidth, star.y * canvasHeight, star.radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function updateParallaxOffsets(gameRunning, parallaxOffset1, parallaxOffset2, canvasWidth) {
    if (!gameRunning) {
      return { parallaxOffset1, parallaxOffset2 };
    }
    return {
      parallaxOffset1: (parallaxOffset1 + 0.3) % canvasWidth,
      parallaxOffset2: (parallaxOffset2 + 0.8) % 200
    };
  }

  function drawParallaxLayers(ctx, canvasWidth, canvasHeight, groundHeight, dayNightT, parallaxOffset1, parallaxOffset2) {
    const mtnY = canvasHeight - groundHeight - 120;
    ctx.fillStyle = `rgba(100,140,100,${0.3 + dayNightT * 0.3})`;
    for (let i = -1; i <= 2; i++) {
      const bx = (i * canvasWidth - parallaxOffset1 + canvasWidth) % (canvasWidth * 2) - canvasWidth * 0.5;
      ctx.beginPath();
      ctx.moveTo(bx, canvasHeight - groundHeight);
      ctx.lineTo(bx + canvasWidth * 0.25, mtnY);
      ctx.lineTo(bx + canvasWidth * 0.5, canvasHeight - groundHeight);
      ctx.fill();
    }

    ctx.fillStyle = `rgba(60,120,60,${0.5 + dayNightT * 0.3})`;
    for (let bx = -parallaxOffset2; bx < canvasWidth + 200; bx += 200) {
      ctx.beginPath();
      ctx.arc(bx + 30, canvasHeight - groundHeight, 25, Math.PI, 0);
      ctx.arc(bx + 55, canvasHeight - groundHeight, 35, Math.PI, 0);
      ctx.arc(bx + 80, canvasHeight - groundHeight, 25, Math.PI, 0);
      ctx.fill();
    }
  }

  function updateAndDrawClouds(ctx, clouds, canvasWidth, canvasHeight) {
    clouds.forEach((cloud) => {
      cloud.x -= cloud.speed;
      if (cloud.x < -150) {
        cloud.x = canvasWidth + 50;
        cloud.y = Math.random() * canvasHeight * 0.5;
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, 40 * cloud.size, 0, Math.PI * 2);
      ctx.arc(cloud.x + 30, cloud.y - 10, 30 * cloud.size, 0, Math.PI * 2);
      ctx.arc(cloud.x + 60, cloud.y, 40 * cloud.size, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  const api = {
    getDayNightBlend,
    getSkyColor,
    getCelestialAlpha,
    drawTwinklingStars,
    updateParallaxOffsets,
    drawParallaxLayers,
    updateAndDrawClouds
  };
  global.DragonRenderBackground = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
