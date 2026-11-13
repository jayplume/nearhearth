import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export interface FireHandle {
  /** A shower of sparks, for a round that roared or a pledge that landed. */
  burst(strength?: number): void;
}

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  ember: boolean;
}

// White-hot core to red to smoke, by how far a particle is through its life.
const STOPS: [number, [number, number, number]][] = [
  [0, [255, 246, 214]],
  [0.18, [255, 209, 102]],
  [0.4, [255, 140, 36]],
  [0.65, [222, 72, 26]],
  [0.85, [120, 40, 24]],
  [1, [60, 40, 34]],
];

function colorAt(t: number): [number, number, number] {
  for (let i = 1; i < STOPS.length; i++) {
    const [b, cb] = STOPS[i]!;
    const [a, ca] = STOPS[i - 1]!;
    if (t <= b) {
      const k = (t - a) / (b - a);
      return [ca[0] + (cb[0] - ca[0]) * k, ca[1] + (cb[1] - ca[1]) * k, ca[2] + (cb[2] - ca[2]) * k];
    }
  }
  return STOPS[STOPS.length - 1]![1];
}

/**
 * The hearth. `heat` is pledged ÷ line for the current round (0 = cold,
 * 1 = at the line, more = roaring). Move the cursor through it to fan the flames.
 */
export const Fire = forwardRef<FireHandle, { heat: number; label: string }>(function Fire({ heat, label }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const heatRef = useRef(heat);
  const bursts = useRef<number[]>([]);
  heatRef.current = heat;

  useImperativeHandle(ref, () => ({ burst: (s = 1) => bursts.current.push(s) }), []);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      const r = el.getBoundingClientRect();
      w = r.width;
      h = r.height;
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const ps: P[] = [];
    const pointer = { x: -999, y: -999, vx: 0, active: false };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      pointer.vx = pointer.active ? x - pointer.x : 0;
      pointer.x = x;
      pointer.y = y;
      pointer.active = true;
      // Moving through the fire throws a few sparks.
      if (!reduce && Math.abs(pointer.vx) > 2 && y < h * 0.9) for (let i = 0; i < 3; i++) spawn(x, y, true, pointer.vx * 0.04);
    };
    const onLeave = () => {
      pointer.active = false;
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);

    function spawn(x: number, y: number, ember: boolean, push = 0) {
      const heatNow = Math.max(0.08, Math.min(1.6, heatRef.current));
      const max = ember ? 1.4 + Math.random() * 1.6 : 0.5 + Math.random() * (0.5 + heatNow * 0.7);
      ps.push({
        x,
        y,
        vx: (Math.random() - 0.5) * (ember ? 60 : 26) + push * 60,
        vy: -(ember ? 70 + Math.random() * 120 : 50 + Math.random() * 60 + heatNow * 120),
        life: 0,
        max,
        size: ember ? 1.2 + Math.random() * 1.8 : (10 + Math.random() * 16) * (0.6 + heatNow * 0.5),
        ember,
      });
    }

    const drawLogs = () => {
      const cx = w / 2;
      const base = h - 18;
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#3a2418";
      for (const [dx, rot] of [
        [-40, -0.22],
        [40, 0.22],
        [0, 0],
      ] as const) {
        ctx.save();
        ctx.translate(cx + dx * 0.7, base);
        ctx.rotate(rot);
        ctx.beginPath();
        ctx.roundRect(-70, -9, 140, 18, 9);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    };

    if (reduce) {
      // One still flame, sized by heat.
      const draw = () => {
        ctx.clearRect(0, 0, w, h);
        const k = Math.max(0.15, Math.min(1.4, heatRef.current));
        const g = ctx.createRadialGradient(w / 2, h - 30, 4, w / 2, h - 30 - 120 * k, 200 * k);
        g.addColorStop(0, "rgba(255,240,200,0.95)");
        g.addColorStop(0.35, "rgba(255,150,40,0.8)");
        g.addColorStop(1, "rgba(255,90,30,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        drawLogs();
      };
      draw();
      const t = setInterval(draw, 2000);
      return () => {
        clearInterval(t);
        ro.disconnect();
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerleave", onLeave);
      };
    }

    let raf = 0;
    let last = performance.now();
    let carry = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const heatNow = Math.max(0.06, Math.min(1.6, heatRef.current));
      const cx = w / 2;
      const base = h - 26;
      const spread = 30 + heatNow * 70;
      carry += dt * (30 + heatNow * 260);
      while (carry >= 1) {
        carry -= 1;
        spawn(cx + (Math.random() - 0.5) * spread * 2 * Math.random(), base, Math.random() < 0.05 + heatNow * 0.05);
      }
      while (bursts.current.length) {
        const s = bursts.current.pop()!;
        for (let i = 0; i < 160 * s; i++) spawn(cx + (Math.random() - 0.5) * spread * 2, base - Math.random() * 60, true, (Math.random() - 0.5) * 3);
      }

      ctx.clearRect(0, 0, w, h);
      // Warm glow on the hearth floor, stronger with heat.
      const glow = ctx.createRadialGradient(cx, base, 10, cx, base, 220 + heatNow * 160);
      glow.addColorStop(0, `rgba(255,120,40,${0.18 + heatNow * 0.22})`);
      glow.addColorStop(1, "rgba(255,120,40,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = "lighter";
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i]!;
        p.life += dt;
        const t = p.life / p.max;
        if (t >= 1 || p.y < -20) {
          ps.splice(i, 1);
          continue;
        }
        // Flames pull toward the centre line as they rise; embers wander.
        if (!p.ember) p.vx += (cx - p.x) * dt * 1.6;
        else p.vx += (Math.random() - 0.5) * 40 * dt;
        if (pointer.active) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 9000) {
            p.vx += (dx / Math.sqrt(d2 + 1)) * 260 * dt + pointer.vx * 2 * dt;
          }
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const [r, g, b] = colorAt(t);
        const a = p.ember ? 1 - t : (1 - t) * 0.55;
        const size = p.ember ? p.size : p.size * (1 - t * 0.6);
        ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      drawLogs();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <canvas ref={canvas} className="fire" role="img" aria-label={label} />;
});
