import { useEffect, useRef } from 'react';

interface GraphNode {
  label: string;
  color: string;
  r: number;
  bx?: number;
  by?: number;
  x?: number;
  y?: number;
  ph?: number;
}

const BASE_NODES: GraphNode[] = [
  { label: 'apps/web', color: '#2a7c6f', r: 30 },
  { label: 'apps/api', color: '#d4654a', r: 26 },
  { label: 'packages/ui', color: '#5b6abf', r: 28 },
  { label: 'packages/types', color: '#c4922a', r: 24 },
  { label: 'tsconfig', color: '#b0aaa2', r: 18 },
  { label: 'turbo', color: '#3d3a36', r: 22 },
];

const EDGES = [
  [0, 2],
  [0, 3],
  [0, 4],
  [1, 3],
  [1, 4],
  [2, 3],
  [5, 0],
  [5, 1],
  [5, 2],
  [5, 3],
] as const;

export function HeroGraph() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const nodes = BASE_NODES.map((node, index) => ({
      ...node,
      ph: index * 0.9,
    }));

    let width = 0;
    let height = 0;
    let dpr = 1;
    let t = 0;
    let frame = 0;
    const start = performance.now();
    const mouse = { x: -9999, y: -9999 };

    const resize = () => {
      const host =
        rootRef.current?.closest('.hero-graph-shell') ??
        rootRef.current ??
        canvas.parentElement;
      if (!host) return;

      const rect = host.getBoundingClientRect();
      dpr = window.devicePixelRatio || 1;
      width = rect.width;
      height = rect.height;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cx = width / 2;
      const cy = height * 0.48;
      const spread = Math.min(width, height) * 0.26;
      const layout = [
        { x: 0.94, y: 0.1 },
        { x: 0.9, y: 0.88 },
        { x: -0.82, y: 0.72 },
        { x: -0.96, y: -0.14 },
        { x: 0, y: -1.02 },
        { x: -0.16, y: -0.02 },
      ];

      nodes.forEach((node, index) => {
        const point = layout[index]!;
        node.bx = cx + point.x * spread;
        node.by = cy + point.y * spread;
        node.x = node.bx;
        node.y = node.by;
      });

      draw(prefersReducedMotion ? 1 : 0);
    };

    const onMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = event.clientX - rect.left;
      mouse.y = event.clientY - rect.top;
    };

    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };

    const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);

    const draw = (intro: number) => {
      const easedIntro = easeOutCubic(intro);
      ctx.clearRect(0, 0, width, height);

      const entryOffset = (1 - easedIntro) * 26;

      nodes.forEach((node) => {
        if (node.bx == null || node.by == null || node.ph == null) return;
        const floatX = prefersReducedMotion
          ? 0
          : Math.sin(t + node.ph) * 5 + Math.cos(t * 0.55 + node.ph * 1.6) * 3;
        const floatY = prefersReducedMotion
          ? 0
          : Math.cos(t * 0.6 + node.ph) * 5 +
            Math.sin(t * 0.45 + node.ph * 1.2) * 3;

        node.x = node.bx + floatX;
        node.y = node.by + floatY + entryOffset;

        if (!prefersReducedMotion) {
          const dx = node.x - mouse.x;
          const dy = node.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 170 && dist > 0) {
            const force = ((170 - dist) / 170) * 16;
            node.x += (dx / dist) * force;
            node.y += (dy / dist) * force;
          }
        }
      });

      EDGES.forEach(([a, b]) => {
        const na = nodes[a]!;
        const nb = nodes[b]!;
        if (na.x == null || na.y == null || nb.x == null || nb.y == null)
          return;

        const mx = (na.x + nb.x) / 2 + (nb.y - na.y) * 0.1;
        const my = (na.y + nb.y) / 2 - (nb.x - na.x) * 0.1;

        ctx.beginPath();
        ctx.moveTo(na.x, na.y);
        ctx.quadraticCurveTo(mx, my, nb.x, nb.y);
        ctx.strokeStyle = `rgba(26,24,22,${0.04 * easedIntro})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        if (!prefersReducedMotion) {
          const p = Math.sin(t * 0.9 + a * 0.7 + b * 1.1) * 0.5 + 0.5;
          const px = na.x * (1 - p) + nb.x * p;
          const py = na.y * (1 - p) + nb.y * p;

          ctx.beginPath();
          ctx.arc(px, py, 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(42,124,111,${0.12 * easedIntro})`;
          ctx.fill();
        }
      });

      nodes.forEach((node) => {
        if (node.x == null || node.y == null) return;

        const glow = ctx.createRadialGradient(
          node.x,
          node.y,
          0,
          node.x,
          node.y,
          node.r * 3,
        );
        glow.addColorStop(0, `${node.color}09`);
        glow.addColorStop(1, `${node.color}00`);

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r * 3, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        ctx.fillStyle = '#fdfcfa';
        ctx.fill();
        ctx.strokeStyle = node.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(node.x, node.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();

        ctx.font = '500 10px "Source Code Pro", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(122,117,112,${0.9 * easedIntro})`;
        ctx.fillText(node.label, node.x, node.y + node.r + 18);
      });

      const fog = ctx.createRadialGradient(
        width / 2,
        height * 0.46,
        0,
        width / 2,
        height * 0.46,
        Math.max(width, height) * 0.45,
      );
      fog.addColorStop(0, 'rgba(255,255,255,0)');
      fog.addColorStop(1, 'rgba(248,245,240,0.65)');

      ctx.fillStyle = fog;
      ctx.fillRect(0, 0, width, height);
    };

    const loop = (now: number) => {
      t += 0.005;
      const intro = Math.min(1, (now - start) / 1500);
      draw(intro);

      if (!prefersReducedMotion || intro < 1) {
        frame = requestAnimationFrame(loop);
      } else {
        draw(1);
      }
    };

    resize();
    window.addEventListener('resize', resize);
    if (!prefersReducedMotion) {
      canvas.addEventListener('mousemove', onMove);
      canvas.addEventListener('mouseleave', onLeave);
    }
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      if (!prefersReducedMotion) {
        canvas.removeEventListener('mousemove', onMove);
        canvas.removeEventListener('mouseleave', onLeave);
      }
    };
  }, []);

  return (
    <div className="hero-graph-root" ref={rootRef}>
      <canvas id="graphCanvas" ref={canvasRef} />
    </div>
  );
}
