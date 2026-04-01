(function(global) {
  'use strict';

  function updateFadeParticles(particles, dt, fadeRate, bounds) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= fadeRate * dt;
      if (
        p.alpha <= 0.05 ||
        (p.x + p.radius < 0) ||
        (p.x - p.radius > bounds.width) ||
        (p.y + p.radius < 0) ||
        (p.y - p.radius > bounds.height)
      ) {
        particles.splice(i, 1);
      }
    }
  }

  function drawCircleParticles(ctx, particles) {
    particles.forEach((p) => {
      if (p.alpha < 0.05) return;
      ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function spawnFireBurst(fireParticles, x, y, colors) {
    for (let i = 0; i < 12; i++) {
      fireParticles.push({
        x,
        y,
        vx: Math.random() * 4 + 1,
        vy: (Math.random() - 0.5) * 2,
        radius: Math.random() * 4 + 2,
        alpha: 1,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
  }

  function updateFireParticles(fireParticles, dt) {
    for (let i = fireParticles.length - 1; i >= 0; i--) {
      const p = fireParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= 0.06 * dt;
      p.radius *= 0.97;
      if (p.alpha <= 0.05) fireParticles.splice(i, 1);
    }
  }

  function drawFireParticles(ctx, fireParticles) {
    fireParticles.forEach((p) => {
      if (p.alpha < 0.05) return;
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function updateScorePopups(scorePopups, dt) {
    for (let i = scorePopups.length - 1; i >= 0; i--) {
      const p = scorePopups[i];
      p.y += p.vy * dt;
      p.alpha -= 0.025 * dt;
      if (p.alpha <= 0) scorePopups.splice(i, 1);
    }
  }

  function drawScorePopups(ctx, scorePopups) {
    scorePopups.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 22px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y);
    });
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  const api = {
    updateFadeParticles,
    drawCircleParticles,
    spawnFireBurst,
    updateFireParticles,
    drawFireParticles,
    updateScorePopups,
    drawScorePopups
  };

  global.DragonRenderEffects = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
