"use client";

type Koi = {
  x: number;
  y: number;
  tx: number;
  ty: number;
  vx: number;
  vy: number;
  angle: number;
  speed: number;
  size: number;
  phase: number;
  tailPhase: number;
  palette: {
    body: string;
    light: string;
    patch: string;
    shadow: string;
  };
};

const PALETTES = [
  { body: "#b97855", light: "#f0d8b5", patch: "#a9493f", shadow: "#473b43" },
  { body: "#a69a88", light: "#ded4bf", patch: "#b86a49", shadow: "#46434b" },
  { body: "#8e8780", light: "#d2c5b6", patch: "#9f5f4d", shadow: "#3f4049" },
];

const INITIAL = [
  [0.22, 0.72],
  [0.56, 0.46],
  [0.78, 0.68],
];

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function pickTarget(koi: Koi, width: number, height: number) {
  const margin = Math.min(width, height) * 0.11;
  const x = margin + Math.random() * Math.max(1, width - margin * 2);
  const y = margin + Math.random() * Math.max(1, height - margin * 2);
  koi.tx = x;
  koi.ty = y;
}

function brushEllipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rotation: number,
  fill: string,
  alpha: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawKoi(ctx: CanvasRenderingContext2D, koi: Koi, scale: number, time: number) {
  const s = koi.size * scale;
  const bob = Math.sin(time * 0.0017 + koi.phase) * s * 0.025;
  const wiggle = Math.sin(time * 0.004 + koi.tailPhase) * 0.07;

  ctx.save();
  ctx.translate(koi.x, koi.y + bob);
  ctx.rotate(koi.angle + wiggle);

  // Soft underwater shadow.
  brushEllipse(ctx, -s * 0.02, s * 0.2, s * 0.72, s * 0.16, 0, koi.palette.shadow, 0.16);

  // Tail — built from translucent brush strokes.
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = koi.palette.body;
  ctx.beginPath();
  ctx.moveTo(-s * 0.42, 0);
  ctx.quadraticCurveTo(-s * 0.88, -s * 0.28, -s * 1.02, -s * 0.05);
  ctx.quadraticCurveTo(-s * 0.87, 0, -s * 1.02, s * 0.05);
  ctx.quadraticCurveTo(-s * 0.88, s * 0.28, -s * 0.42, 0);
  ctx.closePath();
  ctx.fill();

  // Layered body, deliberately soft-edged.
  brushEllipse(ctx, 0, 0, s * 0.62, s * 0.29, 0, koi.palette.body, 0.86);
  brushEllipse(ctx, -s * 0.18, -s * 0.03, s * 0.38, s * 0.20, -0.06, koi.palette.light, 0.47);

  // Orange/red painterly markings.
  brushEllipse(ctx, s * 0.18, -s * 0.08, s * 0.19, s * 0.11, 0.15, koi.palette.patch, 0.7);
  brushEllipse(ctx, -s * 0.28, s * 0.04, s * 0.15, s * 0.10, -0.22, koi.palette.patch, 0.52);

  // Small translucent fins.
  brushEllipse(ctx, s * 0.03, -s * 0.26, s * 0.24, s * 0.06, -0.08, koi.palette.shadow, 0.28);
  brushEllipse(ctx, s * 0.03, s * 0.26, s * 0.24, s * 0.06, 0.08, koi.palette.light, 0.28);

  // A handful of loose brush dabs suggest scales.
  for (let i = 0; i < 7; i++) {
    const u = -0.34 + i * 0.095;
    const yy = Math.sin(i * 1.9 + koi.phase) * 0.05;
    brushEllipse(
      ctx,
      s * u,
      s * yy,
      s * 0.032,
      s * 0.019,
      0,
      koi.palette.light,
      0.18
    );
  }

  // Tiny eye.
  ctx.globalAlpha = 0.82;
  ctx.fillStyle = "#26242b";
  ctx.beginPath();
  ctx.arc(s * 0.54, -s * 0.075, Math.max(0.8, s * 0.026), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function mountKoiLayer(host: HTMLElement, canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const koi: Koi[] = INITIAL.map(([x, y], i) => ({
    x: x * host.clientWidth,
    y: y * host.clientHeight,
    tx: x * host.clientWidth,
    ty: y * host.clientHeight,
    vx: 0,
    vy: 0,
    angle: i === 0 ? 0.3 : i === 1 ? -0.5 : 2.7,
    speed: 0.0009 + i * 0.00012,
    size: [34, 30, 32][i],
    phase: Math.random() * Math.PI * 2,
    tailPhase: Math.random() * Math.PI * 2,
    palette: PALETTES[i],
  }));

  const resize = () => {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    const oldWidth = canvas.width || width;
    const oldHeight = canvas.height || height;
    const sx = width / oldWidth;
    const sy = height / oldHeight;

    for (const fish of koi) {
      fish.x *= sx;
      fish.y *= sy;
      fish.tx *= sx;
      fish.ty *= sy;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
  };

  const pickTargets = () => {
    for (const fish of koi) pickTarget(fish, host.clientWidth, host.clientHeight);
  };

  let raf = 0;
  let last = performance.now();
  let targetTimer = 0;

  const frame = (now: number) => {
    const dt = Math.min(50, now - last);
    last = now;
    targetTimer -= dt;

    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    const scale = width / 680;

    if (targetTimer <= 0) {
      pickTargets();
      targetTimer = 8500 + Math.random() * 5500;
    }

    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    ctx.clearRect(0, 0, width, height);

    for (const fish of koi) {
      const dx = fish.tx - fish.x;
      const dy = fish.ty - fish.y;
      const dist = Math.hypot(dx, dy) || 1;

      if (dist < 18 * scale) pickTarget(fish, width, height);

      const desiredAngle = Math.atan2(dy, dx);
      let delta = desiredAngle - fish.angle;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));

      fish.angle += clamp(delta, -0.015, 0.015) * dt;

      const cruise = reduceMotion ? fish.speed * 0.45 : fish.speed;
      fish.vx += (Math.cos(fish.angle) * cruise * 680 - fish.vx) * Math.min(1, dt * 0.0013);
      fish.vy += (Math.sin(fish.angle) * cruise * 680 - fish.vy) * Math.min(1, dt * 0.0013);

      fish.x += fish.vx * dt;
      fish.y += fish.vy * dt;
      fish.tailPhase += dt * 0.0035;

      const edge = 46 * scale;
      if (fish.x < edge || fish.x > width - edge) fish.tx = width * (0.18 + Math.random() * 0.64);
      if (fish.y < edge || fish.y > height - edge) fish.ty = height * (0.18 + Math.random() * 0.64);

      drawKoi(ctx, fish, scale, now);
    }

    raf = requestAnimationFrame(frame);
  };

  resize();
  pickTargets();
  raf = requestAnimationFrame(frame);

  const ro = new ResizeObserver(resize);
  ro.observe(host);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
}
