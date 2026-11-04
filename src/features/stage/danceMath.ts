import type { DanceMove, PoseState, StageMember } from './types';

export const PI = Math.PI;
export const TAU = PI * 2;

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export const ease = (t: number) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};

export const easeOutBack = (t: number) => {
  t = clamp(t, 0, 1);
  const c = 1.6;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

export const rnd = (n: number) => Math.floor(Math.random() * n);
export const pick = <T>(a: T[]): T => a[rnd(a.length)];

export function getShirtBaseColor(shirt: string): string {
  if (shirt === 'bayern') return '#dc052d';
  if (shirt === 'mu') return '#c70101';
  if (shirt === 'mc') return '#589de6';
  if (shirt === 'zalo_ts') return '#141416';
  return shirt;
}

export const BASE_POSE: PoseState = {
  bob: 0,
  jump: 0,
  lean: 0,
  head: 0,
  nod: 0,
  la: 0.25,
  le: -0.3,
  ra: 0.25,
  re: -0.3,
  kl: 0,
  kr: 0,
  spread: 10,
};

export const P = (o: Partial<PoseState>): PoseState => Object.assign({}, BASE_POSE, o);

export const bobAt = (b: number) => (1 + Math.cos(TAU * b)) / 2;

export function getPose(mv: DanceMove | string, b: number): PoseState {
  const p = ((b % 1) + 1) % 1;
  const k = Math.floor(b);
  const even = ((k % 2) + 2) % 2 === 0;
  const bob = bobAt(b);

  switch (mv) {
    case 'lacDau': {
      const s = Math.cos(PI * b);
      return P({
        bob,
        head: s * 0.42,
        lean: s * 0.06,
        la: 0.8,
        le: -2.0,
        ra: 0.8,
        re: -2.0,
        nod: bob * 1.5,
      });
    }
    case 'chiTroi': {
      const t = ease(p / 0.22);
      const up = 2.75, rest = 0.75, upE = 0, restE = -2.0;
      const A = rest + (up - rest) * t;
      const AE = restE + (upE - restE) * t;
      const B = up + (rest - up) * t;
      const BE = upE + (restE - upE) * t;
      const pump = Math.exp(-p * 5) * 0.12 * t;
      const o = even
        ? { ra: A + pump, re: AE, la: B, le: BE }
        : { la: A + pump, le: AE, ra: B, re: BE };
      return P({
        ...o,
        bob,
        lean: (even ? -1 : 1) * 0.06,
        head: (even ? 1 : -1) * 0.12,
        nod: bob * 1.5,
      });
    }
    case 'xoayTay': {
      const c = TAU * b;
      return P({
        bob,
        la: 1.25 + 0.4 * Math.sin(c),
        le: -1.5 + 0.55 * Math.cos(c),
        ra: 1.25 + 0.4 * Math.sin(c + PI),
        re: -1.5 + 0.55 * Math.cos(c + PI),
        head: 0.1 * Math.sin(c),
        nod: bob * 2,
      });
    }
    case 'vayTay': {
      const s = Math.sin(PI * b * 0.5);
      return P({
        bob,
        ra: 2.75 - s * 0.45,
        la: 2.75 + s * 0.45,
        re: -0.25,
        le: -0.25,
        lean: s * 0.12,
        head: s * 0.18,
      });
    }
    case 'daChan': {
      const kk = Math.sin(PI * p);
      return P({
        bob: bob * 0.6,
        jump: 0.15 * kk,
        kl: even ? kk : 0,
        kr: even ? 0 : kk,
        la: 0.3 + (even ? 0 : 0.9 * kk),
        le: -0.9,
        ra: 0.3 + (even ? 0.9 * kk : 0),
        re: -0.9,
        lean: (even ? 1 : -1) * 0.05 * kk,
        spread: 8,
      });
    }
    case 'voTay': {
      const op = Math.sin(PI * p);
      const a = PI + 0.38 - op * 0.85;
      return P({
        bob,
        la: a,
        ra: a,
        le: -0.3 * op,
        re: -0.3 * op,
        nod: bob * 2,
      });
    }
    case 'nhayTung': {
      const j = Math.sin(PI * p);
      return P({
        jump: j,
        bob: Math.max(0, 1 - j * 3),
        la: 2.55 + 0.35 * j,
        ra: 2.55 + 0.35 * j,
        le: -0.6 + 0.4 * j,
        re: -0.6 + 0.4 * j,
        spread: 8,
        nod: -j * 1.5,
      });
    }
    default:
      return P({});
  }
}

export function idlePose(b: number): PoseState {
  return P({
    bob: 0.35 * bobAt(b / 2),
    lean: 0.05 * Math.sin((PI * b) / 4),
    head: 0.08 * Math.sin((PI * b) / 2),
  });
}

export function lerpPose(a: PoseState, c: PoseState, t: number): PoseState {
  const o = {} as PoseState;
  for (const k in BASE_POSE) {
    const key = k as keyof PoseState;
    o[key] = a[key] + (c[key] - a[key]) * t;
  }
  return o;
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawHead(
  ctx: CanvasRenderingContext2D,
  m: StageMember,
  u: number,
  ps: PoseState,
  curDrop: boolean,
  intensity: number,
  curTime: number
) {
  const R = 13 * u;
  if (m.hair === 4) {
    ctx.fillStyle = m.hairC;
    roundRect(ctx, -R - 2 * u, -R - 1 * u, 2 * R + 4 * u, 2 * R + 9 * u, 8 * u);
    ctx.fill();
  }
  ctx.fillStyle = m.skin;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();

  ctx.fillStyle = m.hairC;
  switch (m.hair) {
    case 0:
      ctx.beginPath();
      ctx.arc(0, -1 * u, R + 0.8 * u, PI * 1.12, PI * 1.88);
      ctx.closePath();
      ctx.fill();
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath();
        ctx.moveTo(k * 4.5 * u - 3 * u, -R * 0.7);
        ctx.lineTo(k * 5.5 * u, -R - 6 * u - (k === 0 ? 2 * u : 0));
        ctx.lineTo(k * 4.5 * u + 3 * u, -R * 0.7);
        ctx.closePath();
        ctx.fill();
      }
      break;
    case 1:
      ctx.beginPath();
      ctx.arc(0, -2 * u, R + 1.5 * u, PI, TAU);
      ctx.lineTo(R + 1.5 * u, 5 * u);
      ctx.lineTo(R - 2 * u, 5 * u);
      ctx.lineTo(R - 3 * u, -5 * u);
      ctx.lineTo(-R + 3 * u, -5 * u);
      ctx.lineTo(-R + 2 * u, 5 * u);
      ctx.lineTo(-R - 1.5 * u, 5 * u);
      ctx.closePath();
      ctx.fill();
      break;
    case 2:
      ctx.beginPath();
      ctx.arc(0, -1 * u, R + 0.8 * u, PI * 1.1, PI * 1.9);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -R - 3 * u, 5.5 * u, 0, TAU);
      ctx.fill();
      break;
    case 3:
      ctx.fillStyle = '#1d1a26';
      ctx.beginPath();
      ctx.arc(0, -1 * u, R + 1.2 * u, PI * 1.08, PI * 1.92);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = getShirtBaseColor(m.shirt);
      ctx.fillRect(-R * 0.92, -6.5 * u, R * 1.84, 2 * u);
      ctx.fillStyle = '#1d1a26';
      ctx.beginPath();
      ctx.arc(0, -R - 1.2 * u, 1.6 * u, 0, TAU);
      ctx.fill();
      break;
    case 4:
      ctx.beginPath();
      ctx.arc(0, -1 * u, R + 1 * u, PI * 1.1, PI * 1.9);
      ctx.closePath();
      ctx.fill();
      break;
  }

  if (m.glasses === 1) {
    ctx.fillStyle = '#0d0b14';
    roundRect(ctx, -10 * u, -3.5 * u, 8.5 * u, 5.5 * u, 2 * u);
    ctx.fill();
    roundRect(ctx, 1.5 * u, -3.5 * u, 8.5 * u, 5.5 * u, 2 * u);
    ctx.fill();
    ctx.fillRect(-2 * u, -2.6 * u, 4 * u, 1.2 * u);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = Math.max(0.6, 0.9 * u);
    ctx.beginPath();
    ctx.moveTo(-8 * u, -2 * u);
    ctx.lineTo(-6 * u, -2 * u);
    ctx.moveTo(3.5 * u, -2 * u);
    ctx.lineTo(5.5 * u, -2 * u);
    ctx.stroke();
  } else if (m.glasses === 2) {
    ctx.fillStyle = '#ff3d8b';
    for (const sd of [-1, 1]) {
      const cx = sd * 5.2 * u, cy = -1.5 * u;
      ctx.beginPath();
      ctx.moveTo(cx, cy + 3.6 * u);
      ctx.bezierCurveTo(cx - 4.8 * u, cy + 0.5 * u, cx - 3.2 * u, cy - 3.4 * u, cx, cy - 1.2 * u);
      ctx.bezierCurveTo(cx + 3.2 * u, cy - 3.4 * u, cx + 4.8 * u, cy + 0.5 * u, cx, cy + 3.6 * u);
      ctx.fill();
    }
    ctx.fillRect(-1.5 * u, -2.2 * u, 3 * u, u);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(sd * 5.2 * u - 1.4 * u, -2.4 * u, 0.7 * u, 0, TAU);
      ctx.fill();
    }
  } else {
    const blink = ((curTime * 0.7 + m.seed * 0.37) % 3) < 0.08;
    ctx.fillStyle = '#1a1220';
    ctx.strokeStyle = '#1a1220';
    ctx.lineWidth = Math.max(0.6, u);
    for (const sd of [-1, 1]) {
      if (blink) {
        ctx.beginPath();
        ctx.moveTo(sd * 4.5 * u - 1.8 * u, -1 * u);
        ctx.lineTo(sd * 4.5 * u + 1.8 * u, -1 * u);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(sd * 4.5 * u, -1 * u, 1.7 * u, 0, TAU);
        ctx.fill();
      }
    }
  }

  // Cheeks
  ctx.fillStyle = 'rgba(255,110,140,0.35)';
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(sd * 7.5 * u, 3.8 * u, 2.2 * u, 0, TAU);
    ctx.fill();
  }

  // Mouth
  if (curDrop && intensity > 0.6) {
    ctx.fillStyle = '#5a1a2a';
    ctx.beginPath();
    ctx.ellipse(0, 6 * u, 2.6 * u, 2.2 * u * (0.6 + 0.4 * ps.bob), 0, 0, TAU);
    ctx.fill();
  } else {
    ctx.strokeStyle = '#5a1a2a';
    ctx.lineWidth = Math.max(0.7, 1.2 * u);
    ctx.beginPath();
    ctx.arc(0, 3.5 * u, 3.5 * u, PI * 0.15, PI * 0.85);
    ctx.stroke();
  }

  // Accessories
  if (m.acc === 1) {
    // Headphones
    ctx.strokeStyle = '#2a2438';
    ctx.lineWidth = 2.6 * u;
    ctx.beginPath();
    ctx.arc(0, -1 * u, R + 2.2 * u, PI * 1.05, PI * 1.95);
    ctx.stroke();
    for (const sd of [-1, 1]) {
      ctx.fillStyle = '#2a2438';
      roundRect(ctx, sd * (R + 1 * u) - 3 * u, -3 * u, 6 * u, 9.5 * u, 2.5 * u);
      ctx.fill();
      ctx.fillStyle = getShirtBaseColor(m.shirt);
      ctx.beginPath();
      ctx.arc(sd * (R + 1 * u), 1.7 * u, 1.6 * u, 0, TAU);
      ctx.fill();
    }
  } else if (m.acc === 2) {
    // Bandana
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R + 0.8 * u, 0, TAU);
    ctx.clip();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-R - 1 * u, -9 * u, 2 * R + 2 * u, 3.6 * u);
    const sColor = getShirtBaseColor(m.shirt);
    ctx.fillStyle = sColor === '#f4f4f8' ? '#ff4fae' : sColor;
    ctx.fillRect(-R - 1 * u, -7.7 * u, 2 * R + 2 * u, 1.1 * u);
    ctx.restore();
  }
}

export function drawTorso(
  ctx: CanvasRenderingContext2D,
  m: StageMember,
  u: number
) {
  const shirt = m.shirt;

  if (shirt === 'bayern') {
    // 1. "Bảy Yến" (Bayern Munich: Red with horizontal white stripes & T logo)
    ctx.save();
    roundRect(ctx, -11.5 * u, -31 * u, 23 * u, 33 * u, 8 * u);
    ctx.clip();

    // Red base
    ctx.fillStyle = '#dc052d';
    ctx.fillRect(-12 * u, -32 * u, 24 * u, 35 * u);

    // Horizontal white stripes
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    for (let sy = -28 * u; sy <= -4 * u; sy += 3.6 * u) {
      ctx.fillRect(-12 * u, sy, 24 * u, 0.9 * u);
    }

    // White crew collar
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -31 * u, 4.8 * u, 0, PI);
    ctx.fill();
    ctx.fillStyle = m.skin;
    ctx.beginPath();
    ctx.arc(0, -31 * u, 3.2 * u, 0, PI);
    ctx.fill();

    // Bayern circular badge on left chest (observer's right: +x)
    ctx.fillStyle = '#0066b2';
    ctx.beginPath();
    ctx.arc(5 * u, -24 * u, 2.5 * u, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#dc052d';
    ctx.beginPath();
    ctx.arc(5 * u, -24 * u, 1.8 * u, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(5 * u, -24 * u, 1.1 * u, 0, TAU);
    ctx.fill();

    // 4 golden stars
    ctx.fillStyle = '#ffd700';
    for (let s = -1.5; s <= 1.5; s += 1) {
      ctx.fillRect(5 * u + s * 0.9 * u - 0.3 * u, -27.5 * u, 0.6 * u, 0.6 * u);
    }

    // Adidas 3 stripes on right chest (observer's left: -x)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-6.2 * u, -23.4 * u, 0.7 * u, 1.2 * u);
    ctx.fillRect(-5.2 * u, -24.0 * u, 0.7 * u, 1.8 * u);
    ctx.fillRect(-4.2 * u, -24.6 * u, 0.7 * u, 2.4 * u);

    // Center T-Mobile sponsor "T ▪▪▪"
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, -4.6 * u, -20.2 * u, 4.8 * u, 1.3 * u, 0.4 * u);
    ctx.fill();
    roundRect(ctx, -2.8 * u, -20.2 * u, 1.3 * u, 6.2 * u, 0.4 * u);
    ctx.fill();
    for (let d = 0; d < 3; d++) {
      roundRect(ctx, (1.2 + d * 1.8) * u, -18.2 * u, 1.2 * u, 1.2 * u, 0.3 * u);
      ctx.fill();
    }

    ctx.restore();
  } else if (shirt === 'mu') {
    // 2. "MU" (Manchester United 2008 Final Moscow: Red with AIG box logo & United crest)
    ctx.save();
    roundRect(ctx, -11.5 * u, -31 * u, 23 * u, 33 * u, 8 * u);
    ctx.clip();

    // Red base
    ctx.fillStyle = '#c70101';
    ctx.fillRect(-12 * u, -32 * u, 24 * u, 35 * u);

    // Subtle collar detail
    ctx.fillStyle = '#9e0000';
    ctx.beginPath();
    ctx.arc(0, -31 * u, 4.5 * u, 0, PI);
    ctx.fill();
    ctx.fillStyle = m.skin;
    ctx.beginPath();
    ctx.arc(0, -31 * u, 3.2 * u, 0, PI);
    ctx.fill();

    // Manchester United Crest on left chest
    ctx.fillStyle = '#ffd100';
    roundRect(ctx, 3.4 * u, -26 * u, 3.4 * u, 4.4 * u, 1 * u);
    ctx.fill();
    ctx.fillStyle = '#c70101';
    ctx.fillRect(4 * u, -24.8 * u, 2.2 * u, 2 * u);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(4.4 * u, -25.6 * u, 1.4 * u, 0.6 * u);

    // White Nike swoosh on right chest
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1 * u;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6 * u, -23.6 * u);
    ctx.lineTo(-4.8 * u, -22.6 * u);
    ctx.lineTo(-2.8 * u, -25.2 * u);
    ctx.stroke();

    // Moscow 2008 commemorative match gold text
    ctx.fillStyle = '#ffd100';
    roundRect(ctx, -4.5 * u, -21.4 * u, 9 * u, 0.7 * u, 0.3 * u);
    ctx.fill();

    // White rectangular AIG logo box
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.9 * u;
    roundRect(ctx, -7.5 * u, -19.4 * u, 15 * u, 7.2 * u, 1.6 * u);
    ctx.stroke();

    // AIG Letters
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(7, Math.round(4.6 * u))}px "DM Sans", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AIG', 0, -15.6 * u);

    ctx.restore();
  } else if (shirt === 'mc') {
    // 3. "MC" (Manchester City: Sky Blue gradient to white with Etihad Airways)
    ctx.save();
    roundRect(ctx, -11.5 * u, -31 * u, 23 * u, 33 * u, 8 * u);
    ctx.clip();

    // Gradient fill: Sky Blue to Light/White bottom
    const mcGrad = ctx.createLinearGradient(0, -31 * u, 0, 0);
    mcGrad.addColorStop(0, '#589de6');
    mcGrad.addColorStop(0.4, '#73aff0');
    mcGrad.addColorStop(0.8, '#d7ebfc');
    mcGrad.addColorStop(1, '#ffffff');
    ctx.fillStyle = mcGrad;
    ctx.fillRect(-12 * u, -32 * u, 24 * u, 35 * u);

    // White crew collar
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -31 * u, 4.8 * u, 0, PI);
    ctx.fill();
    ctx.fillStyle = m.skin;
    ctx.beginPath();
    ctx.arc(0, -31 * u, 3.2 * u, 0, PI);
    ctx.fill();

    // Man City circular badge on left chest
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(5 * u, -24 * u, 2.5 * u, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#00285e';
    ctx.beginPath();
    ctx.arc(5 * u, -24 * u, 2.1 * u, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#6cabdd';
    ctx.beginPath();
    ctx.arc(5 * u, -24 * u, 1.4 * u, 0, TAU);
    ctx.fill();

    // White Puma logo on right chest
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-4.6 * u, -24 * u, 1.1 * u, 0, TAU);
    ctx.fill();

    // "ETIHAD AIRWAYS" in Navy / White
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#00285e';
    ctx.lineWidth = 0.5 * u;
    ctx.font = `bold ${Math.max(6, Math.round(2.9 * u))}px "DM Sans", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText('ETIHAD', 0, -17.2 * u);
    ctx.fillText('ETIHAD', 0, -17.2 * u);

    ctx.font = `bold ${Math.max(4, Math.round(1.6 * u))}px "DM Sans", system-ui, sans-serif`;
    ctx.strokeText('AIRWAYS', 0, -14 * u);
    ctx.fillText('AIRWAYS', 0, -14 * u);

    ctx.restore();
  } else if (shirt === 'zalo_ts') {
    // 4. "Zalo Technical Sharing" (Black shirt, blue Zalo, white technical sharing on left chest)
    ctx.save();
    roundRect(ctx, -11.5 * u, -31 * u, 23 * u, 33 * u, 8 * u);
    ctx.clip();

    // Deep Black Base
    ctx.fillStyle = '#141416';
    ctx.fillRect(-12 * u, -32 * u, 24 * u, 35 * u);

    // Ribbed dark crew collar
    ctx.fillStyle = '#222228';
    ctx.beginPath();
    ctx.arc(0, -31 * u, 4.8 * u, 0, PI);
    ctx.fill();
    ctx.fillStyle = m.skin;
    ctx.beginPath();
    ctx.arc(0, -31 * u, 3.2 * u, 0, PI);
    ctx.fill();

    // Left Chest: character's left chest (observer's right: +x)
    const lx = 4.8 * u;

    // Mini Zalo speech bubble badge
    ctx.fillStyle = '#0068ff';
    roundRect(ctx, lx - 2.8 * u, -27.2 * u, 5.6 * u, 3.4 * u, 1.2 * u);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(lx - 1.2 * u, -23.8 * u);
    ctx.lineTo(lx - 2.0 * u, -23.0 * u);
    ctx.lineTo(lx - 0.4 * u, -23.8 * u);
    ctx.closePath();
    ctx.fill();

    // Inner white 'Z' icon
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(5, Math.round(2.3 * u))}px "DM Sans", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Z', lx, -25.5 * u);

    // Text: "Zalo" in vibrant Zalo blue
    ctx.fillStyle = '#0084ff';
    ctx.font = `bold ${Math.max(6, Math.round(2.7 * u))}px "DM Sans", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Zalo', lx, -22.0 * u);

    // Text: "TECHNICAL" in crisp white
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.max(4, Math.round(1.5 * u))}px "DM Sans", system-ui, sans-serif`;
    ctx.fillText('TECHNICAL', lx, -19.4 * u);

    // Text: "SHARING" in crisp white
    ctx.font = `600 ${Math.max(4, Math.round(1.4 * u))}px "DM Sans", system-ui, sans-serif`;
    ctx.fillText('SHARING', lx, -17.4 * u);

    ctx.restore();
  } else {
    // Standard solid color shirt
    ctx.fillStyle = shirt;
    roundRect(ctx, -11.5 * u, -31 * u, 23 * u, 33 * u, 8 * u);
    ctx.fill();

    // Torso detail / graphic
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(4 * u, -21 * u, 2.8 * u, 0, TAU);
    ctx.fill();
  }
}

export function drawDancer(
  ctx: CanvasRenderingContext2D,
  m: StageMember,
  ps: PoseState,
  alpha: number,
  yOff: number,
  curDrop: boolean = false,
  intensity: number = 0.5,
  curTime: number = 0
) {
  const u = m.s / 100;
  const x = m.x ?? 0;
  const fy = m.y + yOff;
  const jp = ps.jump * 16 * u;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(x, m.y, 20 * u * (1 - ps.jump * 0.25), 4.5 * u, 0, 0, TAU);
  ctx.fill();

  if (m.isYou) {
    ctx.strokeStyle = 'var(--accent, rgba(255,79,174,0.9))';
    ctx.lineWidth = Math.max(1.5, 1.6 * u);
    ctx.beginPath();
    ctx.ellipse(x, m.y, 24 * u, 6 * u, 0, 0, TAU);
    ctx.stroke();
  }

  const hipY = fy - 40 * u + ps.bob * 6 * u - jp;
  const hipX = x;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Legs & Shoes
  for (const sd of [-1, 1]) {
    const k = sd < 0 ? ps.kl : ps.kr;
    const hx = hipX + sd * 6 * u;
    const fx = x + sd * (ps.spread + k * 9) * u;
    const fyy = fy - jp - k * 15 * u;
    const L = Math.hypot(fx - hx, fyy - hipY);
    const nat = 40 * u;
    const bul = L < nat ? Math.sqrt(Math.max(0, (nat / 2) ** 2 - (L / 2) ** 2)) : 0;
    const mx = (hx + fx) / 2 + sd * bul * 0.85;
    const my = (hipY + fyy) / 2;

    ctx.strokeStyle = m.pants;
    ctx.lineWidth = 7.5 * u;
    ctx.beginPath();
    ctx.moveTo(hx, hipY);
    ctx.lineTo(mx, my);
    ctx.lineTo(fx, fyy);
    ctx.stroke();

    // Shoes
    ctx.fillStyle = '#f2f2f5';
    ctx.beginPath();
    ctx.ellipse(fx + sd * 2.5 * u, fyy + u, 6.5 * u, 3.4 * u, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e0367f';
    ctx.fillRect(fx + sd * 2.5 * u - 5 * u, fyy + 0.8 * u, 10 * u, 1.4 * u);
  }

  // Torso
  ctx.save();
  ctx.translate(hipX, hipY);
  ctx.rotate(ps.lean);
  
  // Custom or standard Torso
  drawTorso(ctx, m, u);

  // Pants waistband
  ctx.fillStyle = m.pants;
  roundRect(ctx, -11.5 * u, -3 * u, 23 * u, 5 * u, 2 * u);
  ctx.fill();

  // Head
  ctx.save();
  ctx.translate(0, -31 * u);
  ctx.rotate(ps.head);
  ctx.translate(0, -12 * u + ps.nod * u);
  drawHead(ctx, m, u, ps, curDrop, intensity, curTime);
  ctx.restore();

  // Arms
  for (const sd of [-1, 1]) {
    const a = sd < 0 ? ps.la : ps.ra;
    const e = sd < 0 ? ps.le : ps.re;
    const sx = sd * 10 * u;
    const sy = -26 * u;
    const ex = sx + sd * Math.sin(a) * 14 * u;
    const ey = sy + Math.cos(a) * 14 * u;
    const hx = ex + sd * Math.sin(a + e) * 13 * u;
    const hy = ey + Math.cos(a + e) * 13 * u;

    // Arm skin
    ctx.strokeStyle = m.skin;
    ctx.lineWidth = 5 * u;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.lineTo(hx, hy);
    ctx.stroke();

    // Shirt sleeve
    const cuffX = sx + (ex - sx) * 0.55;
    const cuffY = sy + (ey - sy) * 0.55;
    ctx.strokeStyle = getShirtBaseColor(m.shirt);
    ctx.lineWidth = 6.4 * u;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(cuffX, cuffY);
    ctx.stroke();

    // Cuff ring for special shirts
    if (['bayern', 'mu', 'mc'].includes(m.shirt)) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cuffX, cuffY, 3.4 * u, 0, TAU);
      ctx.fill();
    } else if (m.shirt === 'zalo_ts') {
      ctx.fillStyle = '#0084ff';
      ctx.beginPath();
      ctx.arc(cuffX, cuffY, 3.4 * u, 0, TAU);
      ctx.fill();
    }

    // Hand
    ctx.fillStyle = m.skin;
    ctx.beginPath();
    ctx.arc(hx, hy, 3.4 * u, 0, TAU);
    ctx.fill();
  }

  ctx.restore();
  ctx.restore();

  const ly = -66 * u;
  const c = Math.cos(ps.lean);
  const s = Math.sin(ps.lean);
  return { hx: hipX - ly * s, hy: hipY + ly * c, u };
}
