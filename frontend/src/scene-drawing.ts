/**
 * Ambient background scenes. Each scene is a small pure drawing routine so the canvas component only owns the
 * animation loop. Colours stay dim on purpose: text on top must keep its contrast.
 */
export type SceneId = 'stars' | 'constellation' | 'telemetry' | 'radar' | 'dust' | 'orbits' | 'pulse';

export interface Scene {
  /** Draws one frame. `time` is seconds since the scene started; `width`/`height` are CSS pixels. */
  draw(ctx: CanvasRenderingContext2D, time: number, width: number, height: number): void;
}

/** Deterministic pseudo-random numbers so a scene looks the same on every visit and in tests. */
function seeded(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

const TAU = Math.PI * 2;

interface Star { x: number; y: number; size: number; speed: number; phase: number; drift: number }

function makeStars(count: number, seed: number): Star[] {
  const random = seeded(seed);
  return Array.from({ length: count }, () => ({
    x: random(), y: random(), size: 0.5 + random() * 1.4, speed: 0.4 + random() * 1.6,
    phase: random() * TAU, drift: 0.004 + random() * 0.012,
  }));
}

function drawStars(ctx: CanvasRenderingContext2D, stars: Star[], time: number, width: number, height: number) {
  for (const star of stars) {
    const x = ((star.x + time * star.drift) % 1) * width;
    const y = star.y * height;
    const twinkle = 0.45 + 0.55 * Math.sin(time * star.speed + star.phase);
    ctx.globalAlpha = 0.15 + 0.6 * twinkle;
    ctx.fillStyle = star.size > 1.4 ? '#bcd7ff' : '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, star.size, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function starsScene(withLinks: boolean): Scene {
  const stars = makeStars(withLinks ? 70 : 110, withLinks ? 11 : 7);
  const shooting = { start: 0 };
  return {
    draw(ctx, time, width, height) {
      drawStars(ctx, stars, time, width, height);
      if (withLinks) {
        // Constellation: faint lines between stars that drift close together.
        const limit = Math.min(width, height) * 0.16;
        ctx.lineWidth = 1;
        for (let i = 0; i < stars.length; i += 1) {
          const a = stars[i];
          const ax = ((a.x + time * a.drift) % 1) * width;
          const ay = a.y * height;
          for (let j = i + 1; j < stars.length; j += 1) {
            const b = stars[j];
            const bx = ((b.x + time * b.drift) % 1) * width;
            const by = b.y * height;
            const distance = Math.hypot(ax - bx, ay - by);
            if (distance < limit) {
              ctx.globalAlpha = (1 - distance / limit) * 0.22;
              ctx.strokeStyle = '#8fb8ff';
              ctx.beginPath();
              ctx.moveTo(ax, ay);
              ctx.lineTo(bx, by);
              ctx.stroke();
            }
          }
        }
        ctx.globalAlpha = 1;
        return;
      }
      // One shooting star every ~9 seconds.
      const cycle = 9;
      const local = (time - shooting.start) % cycle;
      if (local < 1.1) {
        const progress = local / 1.1;
        const x = width * (0.15 + 0.5 * progress);
        const y = height * (0.08 + 0.22 * progress);
        const gradient = ctx.createLinearGradient(x - 110, y - 40, x, y);
        gradient.addColorStop(0, 'rgb(180 210 255 / 0%)');
        gradient.addColorStop(1, `rgb(210 230 255 / ${0.7 * (1 - Math.abs(progress - 0.5) * 2)})`);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x - 110, y - 40);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    },
  };
}

/** A faint heartbeat trace sweeping across the screen with a glowing head. */
function telemetryScene(): Scene {
  const stars = makeStars(45, 23);
  const trace = (phase: number) => {
    // One ECG-like beat per period, flat baseline between beats.
    const p = phase % 1;
    if (p < 0.40) return 0;
    if (p < 0.44) return -0.18 * Math.sin(((p - 0.40) / 0.04) * Math.PI);
    if (p < 0.47) return 0.12 * Math.sin(((p - 0.44) / 0.03) * Math.PI);
    if (p < 0.51) return -1 * Math.sin(((p - 0.47) / 0.04) * Math.PI);
    if (p < 0.55) return 0.55 * Math.sin(((p - 0.51) / 0.04) * Math.PI);
    if (p < 0.70) return 0;
    if (p < 0.82) return -0.22 * Math.sin(((p - 0.70) / 0.12) * Math.PI);
    return 0;
  };
  return {
    draw(ctx, time, width, height) {
      drawStars(ctx, stars, time, width, height);
      const baseline = height * 0.78;
      const amplitude = Math.min(70, height * 0.09);
      const beats = Math.max(3, Math.round(width / 280));
      const head = (time * 0.12) % 1.25;
      const steps = Math.ceil(width / 3);
      for (let line = 0; line < 2; line += 1) {
        const y0 = baseline + line * 64;
        ctx.lineWidth = line === 0 ? 1.6 : 1;
        for (let s = 0; s < steps; s += 1) {
          const u = s / steps;
          const behind = head - u;
          if (behind < 0 || behind > 0.45) continue;
          const alpha = (1 - behind / 0.45) * (line === 0 ? 0.55 : 0.18);
          const x0 = u * width;
          const x1 = ((s + 1) / steps) * width;
          ctx.strokeStyle = line === 0 ? `rgb(52 211 153 / ${alpha})` : `rgb(110 168 255 / ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(x0, y0 + trace(u * beats) * amplitude);
          ctx.lineTo(x1, y0 + trace(((s + 1) / steps) * beats) * amplitude);
          ctx.stroke();
        }
        if (head <= 1 && line === 0) {
          const hx = head * width;
          const hy = y0 + trace(head * beats) * amplitude;
          const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, 18);
          glow.addColorStop(0, 'rgb(110 255 200 / 85%)');
          glow.addColorStop(1, 'rgb(52 211 153 / 0%)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(hx, hy, 18, 0, TAU);
          ctx.fill();
        }
      }
    },
  };
}

/** A radar sweep in the lower right corner; blips fade in as the beam passes them. */
function radarScene(): Scene {
  const random = seeded(41);
  const blips = Array.from({ length: 9 }, () => ({ angle: random() * TAU, radius: 0.25 + random() * 0.7 }));
  return {
    draw(ctx, time, width, height) {
      const radius = Math.min(width, height) * 0.62;
      const cx = width * 0.86;
      const cy = height * 0.9;
      ctx.lineWidth = 1;
      for (let ring = 1; ring <= 4; ring += 1) {
        ctx.strokeStyle = `rgb(110 168 255 / ${0.16 - ring * 0.02})`;
        ctx.beginPath();
        ctx.arc(cx, cy, (radius * ring) / 4, 0, TAU);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgb(110 168 255 / 10%)';
      ctx.beginPath();
      ctx.moveTo(cx - radius, cy); ctx.lineTo(cx + radius, cy);
      ctx.moveTo(cx, cy - radius); ctx.lineTo(cx, cy + radius);
      ctx.stroke();
      const sweep = (time * 0.7) % TAU;
      const trailSteps = 36;
      for (let i = 0; i < trailSteps; i += 1) {
        const a0 = sweep - (i / trailSteps) * 1.1;
        const a1 = sweep - ((i + 1) / trailSteps) * 1.1;
        ctx.fillStyle = `rgb(52 211 153 / ${0.2 * (1 - i / trailSteps)})`;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, a1, a0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = 'rgb(110 255 200 / 55%)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweep) * radius, cy + Math.sin(sweep) * radius);
      ctx.stroke();
      for (const blip of blips) {
        const since = ((sweep - blip.angle) % TAU + TAU) % TAU;
        const alpha = Math.max(0, 1 - since / 3.2) * 0.9;
        if (alpha <= 0) continue;
        ctx.fillStyle = `rgb(245 166 35 / ${alpha})`;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(blip.angle) * radius * blip.radius, cy + Math.sin(blip.angle) * radius * blip.radius,
          3, 0, TAU);
        ctx.fill();
      }
    },
  };
}

/** Wind-blown dust in three parallax layers, tinted like the Martian sky. */
function dustScene(): Scene {
  const random = seeded(59);
  const grains = Array.from({ length: 130 }, () => ({
    x: random(), y: random(), layer: Math.floor(random() * 3), size: 0.6 + random() * 1.6, phase: random() * TAU,
  }));
  return {
    draw(ctx, time, width, height) {
      const glow = ctx.createLinearGradient(0, height * 0.55, 0, height);
      glow.addColorStop(0, 'rgb(232 132 90 / 0%)');
      glow.addColorStop(1, 'rgb(232 132 90 / 10%)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, height * 0.55, width, height * 0.45);
      for (const grain of grains) {
        const speed = 0.012 + grain.layer * 0.014;
        const x = ((grain.x + time * speed) % 1) * width;
        const y = (grain.y * height + Math.sin(time * 0.6 + grain.phase) * (6 + grain.layer * 5)) % height;
        ctx.globalAlpha = 0.18 + grain.layer * 0.16;
        ctx.fillStyle = grain.layer === 2 ? '#f0a27a' : '#c9825f';
        ctx.beginPath();
        ctx.arc(x, y, grain.size * (1 + grain.layer * 0.35), 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
  };
}

/** Tilted elliptical orbits with small bodies, for the comparison between scenarios. */
function orbitsScene(): Scene {
  const orbits = [
    { rx: 0.34, ry: 0.13, tilt: -0.35, speed: 0.22, color: '110 168 255', size: 4 },
    { rx: 0.46, ry: 0.19, tilt: -0.35, speed: -0.15, color: '167 139 250', size: 5 },
    { rx: 0.58, ry: 0.25, tilt: -0.35, speed: 0.09, color: '52 211 153', size: 3.5 },
  ];
  const stars = makeStars(50, 71);
  return {
    draw(ctx, time, width, height) {
      drawStars(ctx, stars, time, width, height);
      const cx = width * 0.78;
      const cy = height * 0.42;
      const scale = Math.min(width, height * 1.7);
      for (const orbit of orbits) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(orbit.tilt);
        ctx.strokeStyle = `rgb(${orbit.color} / 18%)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(0, 0, orbit.rx * scale, orbit.ry * scale, 0, 0, TAU);
        ctx.stroke();
        const angle = time * orbit.speed;
        const bx = Math.cos(angle) * orbit.rx * scale;
        const by = Math.sin(angle) * orbit.ry * scale;
        const glow = ctx.createRadialGradient(bx, by, 0, bx, by, orbit.size * 4);
        glow.addColorStop(0, `rgb(${orbit.color} / 70%)`);
        glow.addColorStop(1, `rgb(${orbit.color} / 0%)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(bx, by, orbit.size * 4, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = 'rgb(255 255 255 / 70%)';
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, TAU);
      ctx.fill();
    },
  };
}

/** Expanding rings from a fixed point, like a scanner reading a reading in. */
function pulseScene(): Scene {
  const stars = makeStars(40, 83);
  return {
    draw(ctx, time, width, height) {
      drawStars(ctx, stars, time, width, height);
      const cx = width * 0.82;
      const cy = height * 0.3;
      const reach = Math.min(width, height) * 0.75;
      for (let ring = 0; ring < 4; ring += 1) {
        const progress = ((time * 0.16) + ring / 4) % 1;
        ctx.strokeStyle = `rgb(110 168 255 / ${(1 - progress) * 0.28})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, progress * reach, 0, TAU);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgb(110 168 255 / 55%)';
      ctx.beginPath();
      ctx.arc(cx, cy, 3 + Math.sin(time * 2.4) * 1, 0, TAU);
      ctx.fill();
    },
  };
}

export function createScene(id: SceneId): Scene {
  switch (id) {
    case 'constellation': return starsScene(true);
    case 'telemetry': return telemetryScene();
    case 'radar': return radarScene();
    case 'dust': return dustScene();
    case 'orbits': return orbitsScene();
    case 'pulse': return pulseScene();
    default: return starsScene(false);
  }
}
