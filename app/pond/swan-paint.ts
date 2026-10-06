// @ts-nocheck
/**
 * Lifted from the standalone Swan Pond artifact, with these changes only:
 * the tuner/sliders/recorder/music helper are gone, the pieces the page needs
 * are exported, and the resolution guard in `frame` is fixed (see the note there).
 * It is plain JavaScript and is not type-checked here (hence the pragma above)
 * -- the typed surface the app uses is `pond-hero.tsx` and `time-of-day.ts`.
 */

/**
 * Painted swans — smooth, luminous, a little otherworldly.
 *
 * Each swan is a "look": its own proportions and pearl palette. Forms are
 * built from soft gradients rather than outlines: a lit core, a cool shadow
 * side, an inner rim of light on the sun side, and faint feather rows. The
 * water shader softens and blooms the whole layer afterwards, which is what
 * gives the glow.
 *
 * Units: one swan length = 1, facing +x. The caller sets up the transform.
 */
const PLUMAGE = [
    // champagne pearl
    { hi: [255, 252, 245], mid: [243, 237, 226], shade: [200, 195, 200], deep: [150, 150, 168], rim: [255, 247, 228], mottle: null },
    // moon blue
    { hi: [253, 254, 255], mid: [235, 241, 247], shade: [188, 201, 216], deep: [128, 146, 176], rim: [236, 246, 255], mottle: null },
    // dusky lavender, a few taupe feathers left from youth
    { hi: [249, 245, 241], mid: [229, 223, 221], shade: [186, 178, 188], deep: [132, 124, 144], rim: [255, 241, 232], mottle: [164, 146, 132] },
];
const BEAKS = [
    ["#c9522a", "#ee8048", "#ffc7a0"],
    ["#d65f30", "#f39256", "#ffd3b0"],
    ["#bd4b28", "#e2733f", "#f6b08a"],
];
const mixRGB = (a, b, t) => [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
];
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const css = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
export function makeLook(index, rnd = Math.random) {
    const r = (a, b) => a + rnd() * (b - a);
    const nose = r(0.34, 0.39);
    const rear = r(-0.68, -0.62);
    const look = {
        bw: [0.255, 0.228, 0.243][index % 3] + r(-0.022, 0.022),
        nose,
        rear,
        neckLen: r(0.44, 0.54),
        neckW: r(0.09, 0.11),
        headR: r(0.078, 0.09),
        tailLen: r(0.1, 0.16),
        wingLen: 0.15 - rear - 0.01,
        wingScale: r(0.86, 1.14),
        feathers: [],
        p: PLUMAGE[index % PLUMAGE.length],
        beak: BEAKS[index % BEAKS.length],
        rowJitter: Array.from({ length: 24 }, () => r(-1, 1)),
        mottle: [],
        tail: [],
    };
    if (look.p.mottle) {
        for (let i = 0; i < 7; i++)
            look.mottle.push({ x: r(-0.5, 0.05), y: r(-0.15, 0.15), r: r(0.04, 0.09) });
    }
    // wing feathers by tract: 0 primaries, 1 secondaries, 2 greater coverts,
    // 3 lesser coverts — drawn in that order so each layer overlaps the last
    const counts = [8, 8, 8, 11];
    counts.forEach((count, tract) => {
        for (let i = 0; i < count; i++) {
            look.feathers.push({
                tract,
                u: count === 1 ? 0 : i / (count - 1),
                len: r(0.88, 1.12),
                w: r(0.85, 1.15),
                ang: r(-0.07, 0.07),
                tone: r(-1, 1),
            });
        }
    });
    const n = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
        const u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
        look.tail.push({ a: u * r(0.28, 0.4), len: look.tailLen * (1 - Math.abs(u) * 0.3) });
    }
    return look;
}
/* --------------------------------------------------------------------------
   Shapes
   -------------------------------------------------------------------------- */
function bodyPath(l) {
    const { bw, nose, rear } = l;
    const p = new Path2D();
    p.moveTo(nose, 0);
    p.bezierCurveTo(nose, bw * 0.86, 0.14, bw, -0.04, bw);
    p.bezierCurveTo(-0.26, bw * 0.98, -0.5, bw * 0.5, rear, 0);
    p.bezierCurveTo(-0.5, -bw * 0.5, -0.26, -bw * 0.98, -0.04, -bw);
    p.bezierCurveTo(0.14, -bw, nose, -bw * 0.86, nose, 0);
    p.closePath();
    return p;
}
function cubicPts(out, p0, p1, p2, p3, n) {
    for (let i = 0; i < n; i++) {
        const t = i / n;
        const u = 1 - t;
        out.push([
            u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
            u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
        ]);
    }
}
/**
 * Wing outline in normalised wing space (b = 0 shoulder … 1 tip, backward;
 * o = outward). Folded it lies along the back with the tip crossing the
 * spine; opened, the trailing edge breaks into soft feather tips.
 */
function wingOutline(spread) {
    const pts = [];
    const tipO = -0.12 + spread * 0.42;
    const innerO = -0.24 - spread * 0.06;
    cubicPts(pts, [0, 0], [0.16, 1.05], [0.6, 1.0], [1, tipO], 20);
    const F = 7;
    for (let j = 0; j <= F * 2; j++) {
        const b = 1 - j / (F * 2);
        const base = innerO + (tipO - innerO) * Math.pow(b, 1.6);
        const notch = j % 2 === 1 ? spread * 0.2 * (0.4 + b) : 0;
        pts.push([b, base - notch]);
    }
    return pts;
}
/** Smooth closed curve through points (quadratic through midpoints). */
function smoothClosed(ctx, pts) {
    const n = pts.length;
    const m0x = (pts[n - 1][0] + pts[0][0]) / 2;
    const m0y = (pts[n - 1][1] + pts[0][1]) / 2;
    ctx.moveTo(m0x, m0y);
    for (let i = 0; i < n; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % n];
        ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    }
    ctx.closePath();
}
/* --------------------------------------------------------------------------
   Painting
   -------------------------------------------------------------------------- */
export function paintSwan(ctx, look, pose) {
    const { p } = look;
    const lx = pose.lx;
    const ly = pose.ly;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const roll = 1 + Math.sin(pose.paddle) * 0.014 * Math.min(pose.speedRatio, 1.5);
    /* feet, seen faintly through the water */
    const footA = Math.min(0.32, 0.08 + pose.speedRatio * 0.26);
    for (const side of [1, -1]) {
        const ph = pose.paddle + (side > 0 ? 0 : Math.PI);
        const fx = -0.28 + Math.sin(ph) * 0.07;
        const fy = side * look.bw * 0.72;
        ctx.fillStyle = `rgba(30,34,40,${footA})`;
        ctx.beginPath();
        ctx.moveTo(fx + 0.1, fy * 0.85);
        ctx.quadraticCurveTo(fx - 0.04, fy + side * 0.1, fx - 0.13, fy + side * 0.09 * (0.5 + 0.5 * Math.cos(ph)));
        ctx.lineTo(fx - 0.12, fy - side * 0.035);
        ctx.closePath();
        ctx.fill();
    }
    /* tail tuft, peeking past the crossed wingtips */
    ctx.save();
    ctx.translate(look.rear + 0.07, 0);
    ctx.rotate(pose.jig);
    for (const f of look.tail) {
        const a = f.a * (1 + pose.tailAmp * 1.6);
        const ex = -Math.cos(a) * (f.len + 0.07);
        const ey = Math.sin(a) * (f.len + 0.07);
        const nx = -Math.sin(a) * 0.028;
        const ny = -Math.cos(a) * 0.028;
        const g = ctx.createLinearGradient(0, 0, ex, ey);
        g.addColorStop(0, css(p.mid));
        g.addColorStop(1, css(p.shade, 0.9));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(nx, ny);
        ctx.quadraticCurveTo(ex * 0.55 + nx * 1.2, ey * 0.55 + ny * 1.2, ex, ey);
        ctx.quadraticCurveTo(ex * 0.55 - nx * 1.2, ey * 0.55 - ny * 1.2, -nx, -ny);
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();
    /* body */
    const body = bodyPath(look);
    ctx.save();
    ctx.scale(1, roll);
    {
        const cx = -0.08 + lx * 0.14;
        const cy = ly * look.bw * 0.55;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 0.66);
        g.addColorStop(0, css(p.hi));
        g.addColorStop(0.42, css(p.mid));
        g.addColorStop(0.78, css(p.shade));
        g.addColorStop(1, css(p.deep));
        ctx.fillStyle = g;
        ctx.fill(body);
        ctx.save();
        ctx.clip(body);
        // cool shadow pooled on the far side, warm rim of light on the near side
        ctx.lineWidth = 0.06;
        ctx.translate(-lx * 0.03, -ly * 0.03);
        ctx.strokeStyle = css(p.rim, 0.75);
        ctx.stroke(body);
        ctx.translate(lx * 0.06, ly * 0.06);
        ctx.strokeStyle = css(p.deep, 0.35);
        ctx.lineWidth = 0.07;
        ctx.stroke(body);
        ctx.restore();
        for (const m of look.mottle) {
            const g2 = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
            g2.addColorStop(0, css(p.mottle, 0.22));
            g2.addColorStop(1, css(p.mottle, 0));
            ctx.fillStyle = g2;
            ctx.fillRect(m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
        }
    }
    ctx.restore();
    /* wings */
    const spread = pose.spread;
    const outline = wingOutline(spread);
    for (const side of [1, -1]) {
        const theta = spread * 1.45;
        const len = (look.wingLen + spread * 0.78) * (0.94 + look.wingScale * 0.06);
        const cw = (look.bw * 0.86 + spread * 0.08) * (0.9 + look.wingScale * 0.1);
        const sx = 0.15;
        const sy = side * look.bw * 0.24;
        const c = Math.cos(-side * theta);
        const sn = Math.sin(-side * theta);
        const map = (b, o) => {
            const x = -b * len;
            const y = side * o * cw;
            return [sx + x * c - y * sn, sy + x * sn + y * c];
        };
        const mapped = outline.map(([b, o]) => map(b, o));
        const wing = new Path2D();
        smoothClosed(wing, mapped);
        // the wing lifts off the back: a soft shadow beneath it, away from the sun
        ctx.save();
        ctx.translate(-lx * 0.022, -ly * 0.022);
        ctx.fillStyle = css(p.deep, 0.16 + spread * 0.08);
        ctx.fill(wing);
        ctx.restore();
        // underdown: a darker wash so gaps between feathers read as depth
        ctx.fillStyle = css(mixRGB(p.shade, p.mid, 0.4));
        ctx.fill(wing);
        const [ccx, ccy] = map(0.45, 0.35);
        const ws = look.wingScale;
        const dirOf = (b, o, db, dO) => {
            const [x0, y0] = map(b, o);
            const [x1, y1] = map(b + db * 0.05, o + dO * 0.05);
            const dx = x1 - x0;
            const dy = y1 - y0;
            const dl = Math.hypot(dx, dy) || 1;
            return [dx / dl, dy / dl];
        };
        for (const f of look.feathers) {
            const u = f.u;
            let rb;
            let ro;
            let flen;
            let fw;
            let sb;
            let so;
            if (f.tract === 0) {
                // primaries: long, from the hand out to the tip, fanning when open
                rb = 0.5 + 0.26 * u;
                ro = 0.45 - 0.32 * u;
                flen = 0.36 + 0.06 * u;
                fw = 0.05;
                sb = 1 - 0.65 * (1 - u);
                so = -(0.15 + 0.85 * (1 - u));
            }
            else if (f.tract === 1) {
                // secondaries: broad, along the arm, trailing behind
                rb = 0.1 + 0.44 * u;
                ro = 0.2 + 0.08 * (1 - u);
                flen = 0.27;
                fw = 0.075;
                sb = 0.18;
                so = -1;
            }
            else if (f.tract === 2) {
                // greater coverts: a shorter row laid over the secondaries
                rb = 0.07 + 0.42 * u;
                ro = 0.52 + 0.12 * (1 - u);
                flen = 0.17;
                fw = 0.065;
                sb = 0.35;
                so = -1;
            }
            else {
                // lesser coverts: small, rounded, close along the leading edge
                rb = 0.02 + 0.4 * u;
                ro = 0.8 + 0.06 * Math.sin(u * 9);
                flen = 0.095;
                fw = 0.05;
                sb = 0.45;
                so = -1;
            }
            // folded, everything lies back along the body
            const db = 1 + (sb - 1) * spread;
            const dO = -0.2 + (so + 0.2) * spread;
            const [rx, ry] = map(rb, ro);
            let [dx, dy] = dirOf(rb, ro, db, dO);
            const ca = Math.cos(f.ang);
            const sa = Math.sin(f.ang);
            [dx, dy] = [dx * ca - dy * sa, dx * sa + dy * ca];
            const L = flen * f.len * ws * (0.78 + spread * 0.4);
            const Wd = fw * f.w * (1.25 - spread * 0.15);
            const nx = -dy * Wd * 0.5;
            const ny = dx * Wd * 0.5;
            const tx = rx + dx * L;
            const ty = ry + dy * L;
            const shape = new Path2D();
            shape.moveTo(rx + nx * 0.5, ry + ny * 0.5);
            shape.quadraticCurveTo(rx + dx * L * 0.5 + nx * 1.25, ry + dy * L * 0.5 + ny * 1.25, rx + dx * L * 0.86 + nx * 0.85, ry + dy * L * 0.86 + ny * 0.85);
            shape.quadraticCurveTo(tx + dx * Wd * 0.55, ty + dy * Wd * 0.55, rx + dx * L * 0.86 - nx * 0.85, ry + dy * L * 0.86 - ny * 0.85);
            shape.quadraticCurveTo(rx + dx * L * 0.5 - nx * 1.25, ry + dy * L * 0.5 - ny * 1.25, rx - nx * 0.5, ry - ny * 0.5);
            shape.closePath();
            // each feather casts a little shadow onto the one beneath it
            ctx.save();
            ctx.translate(-lx * 0.011, -ly * 0.011);
            ctx.fillStyle = css(p.deep, 0.24);
            ctx.fill(shape);
            ctx.restore();
            // light: where the feather sits on the wing, plus its own tone
            const mx = rx + dx * L * 0.5;
            const my = ry + dy * L * 0.5;
            const lf = clamp01(0.55 + ((mx - ccx) * lx + (my - ccy) * ly) * 2.2 + f.tone * 0.1 + (f.tract === 3 ? 0.08 : 0));
            const body = lf > 0.5 ? mixRGB(p.mid, p.hi, (lf - 0.5) * 2) : mixRGB(p.shade, p.mid, lf * 2);
            const g = ctx.createLinearGradient(rx, ry, tx, ty);
            g.addColorStop(0, css(body));
            g.addColorStop(0.75, css(mixRGB(body, p.shade, 0.18)));
            g.addColorStop(1, css(mixRGB(body, p.shade, 0.4)));
            ctx.fillStyle = g;
            ctx.fill(shape);
            // a lit edge on the sunny side and a faint shaft
            const lit = nx * lx + ny * ly > 0 ? 1 : -1;
            ctx.strokeStyle = css(p.rim, 0.45);
            ctx.lineWidth = 0.007;
            ctx.beginPath();
            ctx.moveTo(rx + nx * 0.6 * lit, ry + ny * 0.6 * lit);
            ctx.quadraticCurveTo(rx + dx * L * 0.5 + nx * 1.1 * lit, ry + dy * L * 0.5 + ny * 1.1 * lit, rx + dx * L * 0.84 + nx * 0.75 * lit, ry + dy * L * 0.84 + ny * 0.75 * lit);
            ctx.stroke();
            if (f.tract < 2) {
                ctx.strokeStyle = css(p.shade, 0.3);
                ctx.lineWidth = 0.0045;
                ctx.beginPath();
                ctx.moveTo(rx, ry);
                ctx.lineTo(rx + dx * L * 0.8, ry + dy * L * 0.8);
                ctx.stroke();
            }
        }
    }
    // the valley between folded wings
    if (spread < 0.6) {
        ctx.strokeStyle = css(p.deep, 0.12 * (1 - spread / 0.6));
        ctx.lineWidth = 0.045;
        ctx.beginPath();
        ctx.moveTo(0.1, 0);
        ctx.quadraticCurveTo(-0.2, 0.004, look.rear + 0.12, 0);
        ctx.stroke();
    }
    /* breast, where the neck rises */
    {
        const g = ctx.createRadialGradient(0.26 + lx * 0.04, ly * 0.04, 0, 0.26, 0, 0.14);
        g.addColorStop(0, css(p.hi));
        g.addColorStop(0.7, css(p.mid));
        g.addColorStop(1, css(p.mid, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0.26, 0, 0.14, 0, Math.PI * 2);
        ctx.fill();
    }
    /* neck — a cubic from the breast to the head */
    const bend = pose.bend;
    const nl = look.neckLen * pose.stretch;
    const bx = 0.2;
    const reachA = bend * 0.85;
    const reach = nl * (1 - Math.min(0.25, Math.abs(bend) * 0.08));
    const hx = bx + Math.cos(reachA) * reach;
    const hy = Math.sin(reachA) * reach;
    const ha = bend * 1.15 + pose.headTurn;
    const p1x = bx + Math.cos(bend * 0.15) * nl * 0.42;
    const p1y = Math.sin(bend * 0.15) * nl * 0.42;
    const p2x = hx - Math.cos(ha) * nl * 0.38;
    const p2y = hy - Math.sin(ha) * nl * 0.38;
    const neckAt = (t) => {
        const u = 1 - t;
        const x = u * u * u * bx + 3 * u * u * t * p1x + 3 * u * t * t * p2x + t * t * t * hx;
        const y = 3 * u * u * t * p1y + 3 * u * t * t * p2y + t * t * t * hy;
        const tx = 3 * u * u * (p1x - bx) + 6 * u * t * (p2x - p1x) + 3 * t * t * (hx - p2x);
        const ty = 3 * u * u * p1y + 6 * u * t * (p2y - p1y) + 3 * t * t * (hy - p2y);
        const tl = Math.hypot(tx, ty) || 1;
        return { x, y, nx: -ty / tl, ny: tx / tl, w: look.neckW * (1.25 - 0.6 * Math.sqrt(t)) };
    };
    const N = 18;
    const samples = Array.from({ length: N + 1 }, (_, i) => neckAt(i / N));
    const neck = new Path2D();
    samples.forEach((q, i) => {
        const x = q.x + q.nx * q.w;
        const y = q.y + q.ny * q.w;
        if (i === 0)
            neck.moveTo(x, y);
        else
            neck.lineTo(x, y);
    });
    for (let i = N; i >= 0; i--) {
        const q = samples[i];
        neck.lineTo(q.x - q.nx * q.w, q.y - q.ny * q.w);
    }
    neck.closePath();
    const neckFade = 1 - pose.sink * 0.5;
    ctx.globalAlpha = neckFade;
    ctx.fillStyle = css(p.mid);
    ctx.fill(neck);
    ctx.save();
    ctx.clip(neck);
    // highlight runs along whichever flank faces the sun
    const along = (sOf, color, w) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = w;
        ctx.beginPath();
        samples.forEach((q, i) => {
            const s = sOf(q);
            const x = q.x + q.nx * q.w * s;
            const y = q.y + q.ny * q.w * s;
            if (i === 0)
                ctx.moveTo(x, y);
            else
                ctx.lineTo(x, y);
        });
        ctx.stroke();
    };
    const facing = (q) => Math.max(-1, Math.min(1, (q.nx * lx + q.ny * ly) * 2.2));
    along((q) => facing(q) * 0.45, css(p.hi, 0.85), look.neckW * 1.0);
    along((q) => -facing(q) * 1.05, css(p.deep, 0.32), look.neckW * 0.7);
    ctx.restore();
    ctx.globalAlpha = 1;
    /* head */
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(ha);
    // a raised head is nearer the eye, so it reads a touch larger
    const lift = pose.lift ?? 0;
    if (lift > 0)
        ctx.scale(1 + lift * 0.16, 1 + lift * 0.16);
    ctx.globalAlpha = 1 - pose.sink * 0.85;
    const hr = look.headR;
    const hlx = lx * Math.cos(-ha) - ly * Math.sin(-ha);
    const hly = lx * Math.sin(-ha) + ly * Math.cos(-ha);
    {
        const g = ctx.createRadialGradient(hlx * hr * 0.4, hly * hr * 0.4, 0, 0, 0, hr * 1.2);
        g.addColorStop(0, css(p.hi));
        g.addColorStop(0.6, css(p.mid));
        g.addColorStop(1, css(p.shade));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0.01, 0, hr * 1.05, hr * 0.74, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    // beak: a soft tapering wedge, black knob and face, dark nail
    const b0 = hr * 0.8;
    const b1 = b0 + 0.16;
    const beak = ctx.createLinearGradient(b0, -0.03, b0, 0.03);
    beak.addColorStop(0, look.beak[0]);
    beak.addColorStop(0.45 - hly * 0.2, look.beak[1]);
    beak.addColorStop(1, look.beak[0]);
    ctx.fillStyle = beak;
    ctx.beginPath();
    ctx.moveTo(b0, 0.032);
    ctx.bezierCurveTo(b0 + 0.07, 0.03, b1 - 0.03, 0.016, b1, 0.004);
    ctx.quadraticCurveTo(b1 + 0.01, 0, b1, -0.004);
    ctx.bezierCurveTo(b1 - 0.03, -0.016, b0 + 0.07, -0.03, b0, -0.032);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = look.beak[2] + "aa";
    ctx.lineWidth = 0.008;
    ctx.beginPath();
    ctx.moveTo(b0 + 0.04, -hly * 0.006);
    ctx.lineTo(b1 - 0.03, -hly * 0.004);
    ctx.stroke();
    ctx.fillStyle = "rgba(22,20,22,0.95)";
    ctx.beginPath();
    ctx.ellipse(b0 - 0.005, 0, 0.034, 0.036, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(12,12,14,1)";
    ctx.beginPath();
    ctx.ellipse(b0 + 0.018, 0, 0.026, 0.017, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(38,30,28,0.9)";
    ctx.beginPath();
    ctx.ellipse(b1 - 0.008, 0, 0.012, 0.009, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(14,14,16,0.9)";
    for (const s of [1, -1]) {
        ctx.beginPath();
        ctx.arc(hr * 0.42, s * hr * 0.58, 0.01, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    return { hx, hy, ha };
}
