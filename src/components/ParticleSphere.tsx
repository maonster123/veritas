"use client";

import { useEffect, useRef } from "react";

interface Particle {
  tx: number; ty: number; tz: number; // target position on sphere
  x: number; y: number; z: number;    // current position (spring)
  vx: number; vy: number; vz: number; // velocity
  baseSize: number;
  hue: number;
  glow: number;
}

export default function ParticleSphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999, tx: 0, ty: 0 });
  const angleRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const COUNT = 2500;
    const RADIUS = Math.min(window.innerWidth, window.innerHeight) * 0.28;
    const particles: Particle[] = [];
    const SPRING = 0.06;
    const DAMPING = 0.88;
    const REPEL_RADIUS = 180;
    const REPEL_FORCE = 0.12;

    // Fibonacci sphere distribution
    const phi = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < COUNT; i++) {
      const y = 1 - (i / (COUNT - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = phi * i;
      const ix = Math.cos(theta) * r;
      const iz = Math.sin(theta) * r;

      particles.push({
        tx: ix, ty: y, tz: iz,
        x: ix, y: y, z: iz,
        vx: 0, vy: 0, vz: 0,
        baseSize: 0.6 + Math.random() * 1.8,
        hue: 190 + Math.random() * 60, // 190-250: cyan to indigo
        glow: 0.3 + Math.random() * 0.7,
      });
    }
    particlesRef.current = particles;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    let mouseX = -9999;
    let mouseY = -9999;
    let smoothMouseX = -9999;
    let smoothMouseY = -9999;

    const onMouse = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    window.addEventListener("mousemove", onMouse);

    const animate = () => {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const dt = 1;

      // Smooth mouse tracking
      smoothMouseX += (mouseX - smoothMouseX) * 0.1;
      smoothMouseY += (mouseY - smoothMouseY) * 0.1;

      // Auto rotation
      angleRef.current.y += 0.004;
      angleRef.current.x += 0.0015;
      const ay = angleRef.current.y;
      const ax = angleRef.current.x;

      // Mouse influence on rotation
      const mx = ((smoothMouseX - cx) / cx) * 0.5;
      const my = ((smoothMouseY - cy) / cy) * 0.5;

      ctx.clearRect(0, 0, w, h);

      // Background glow
      const bgGrad = ctx.createRadialGradient(cx, cy, RADIUS * 0.3, cx, cy, RADIUS * 1.3);
      bgGrad.addColorStop(0, "rgba(100,140,255,0.06)");
      bgGrad.addColorStop(0.5, "rgba(80,200,240,0.03)");
      bgGrad.addColorStop(1, "transparent");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      for (const p of particles) {
        // Rotate target around Y axis
        const cosA = Math.cos(ay + my);
        const sinA = Math.sin(ay + my);
        let ttx = p.tx * cosA - p.tz * sinA;
        let ttz = p.tx * sinA + p.tz * cosA;

        // Rotate around X axis
        const cosB = Math.cos(ax + mx);
        const sinB = Math.sin(ax + mx);
        const tty = p.ty * cosB - ttz * sinB;
        ttz = p.ty * sinB + ttz * cosB;

        // Mouse repulsion
        const sx = cx + ttx * RADIUS;
        const sy = cy + tty * RADIUS;
        const sz = ttz * RADIUS;
        const mdx = smoothMouseX - sx;
        const mdy = smoothMouseY - sy;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);

        if (mdist < REPEL_RADIUS && smoothMouseX > 0) {
          const force = (1 - mdist / REPEL_RADIUS) * REPEL_FORCE;
          const nx = mdx / (mdist + 0.001);
          const ny = mdy / (mdist + 0.001);
          p.vx -= nx * force * 40;
          p.vy -= ny * force * 40;
          p.vz += (Math.random() - 0.5) * force * 20;
        }

        // Spring toward target
        p.vx += (ttx - p.x) * SPRING;
        p.vy += (tty - p.y) * SPRING;
        p.vz += (ttz - p.z) * SPRING;

        // Damping
        p.vx *= DAMPING;
        p.vy *= DAMPING;
        p.vz *= DAMPING;

        // Integrate
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;

        // Project
        const scale = 350 / (350 + p.z);
        const px = cx + p.x * RADIUS * scale;
        const py = cy + p.y * RADIUS * scale;
        const depth = (p.z + 1) / 2; // 0..1
        const alpha = 0.15 + depth * 0.85;
        const size = p.baseSize * scale * (1 + Math.abs(p.vx + p.vy) * 3);

        // Glow aura
        const aura = ctx.createRadialGradient(px, py, 0, px, py, size * 3);
        const h = p.hue;
        aura.addColorStop(0, `hsla(${h}, 80%, 70%, ${alpha * p.glow * 0.5})`);
        aura.addColorStop(0.3, `hsla(${h}, 70%, 60%, ${alpha * 0.2})`);
        aura.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(px, py, size * 3, 0, Math.PI * 2);
        ctx.fillStyle = aura;
        ctx.fill();

        // Core particle
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        const brightness = depth < 0.3 ? 40 : 60 + depth * 40;
        ctx.fillStyle = `hsla(${h}, 80%, ${brightness}%, ${alpha})`;
        ctx.fill();

        // Bright center for depth
        if (depth > 0.6) {
          ctx.beginPath();
          ctx.arc(px, py, size * 0.4, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${h}, 60%, 90%, ${alpha * 0.7})`;
          ctx.fill();
        }
      }

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouse);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-0"
      style={{ background: "#050510" }}
    />
  );
}
