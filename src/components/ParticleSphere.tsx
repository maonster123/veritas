"use client";

import { useEffect, useRef } from "react";

interface Particle {
  el: HTMLDivElement;
  x: number; y: number; z: number;
  lat: number; lon: number;
}

export default function ParticleSphere() {
  const containerRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const radiusRef = useRef(200);
  const frameRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const COUNT = 500;
    const calcRadius = () => Math.min(window.innerWidth, window.innerHeight) * 0.3;
    radiusRef.current = calcRadius();
    window.addEventListener("resize", () => { radiusRef.current = calcRadius(); });
    const particles: Particle[] = [];

    // Fibonacci sphere distribution for even spacing
    const phi = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < COUNT; i++) {
      const y = 1 - (i / (COUNT - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = phi * i;

      const px = Math.cos(theta) * radiusAtY;
      const py = y;
      const pz = Math.sin(theta) * radiusAtY;

      const el = document.createElement("div");
      el.className = "absolute rounded-full";
      const size = 2 + Math.random() * 4;
      const opacity = 0.35 + Math.random() * 0.5;
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      // Color range: indigo → cyan → violet
      const r = 99 + Math.random() * 100;
      const g = 120 + Math.random() * 80;
      const b = 220 + Math.random() * 35;
      el.style.background = `rgba(${r},${g},${b},${opacity})`;
      el.style.boxShadow = `0 0 ${6 + size}px rgba(${r},${g},${b},${opacity})`;
      container.appendChild(el);

      particles.push({ el, x: px, y: py, z: pz, lat: 0, lon: 0 });
    }

    particlesRef.current = particles;

    // Mouse tracking
    const onMouse = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      mouseRef.current = {
        x: (e.clientX - cx) / cx,
        y: (e.clientY - cy) / cy,
      };
    };
    window.addEventListener("mousemove", onMouse);

    // Animation loop
    let baseAngle = 0;
    const animate = () => {
      baseAngle += 0.003;
      const mx = mouseRef.current.x * 0.8;
      const my = mouseRef.current.y * 0.8;
      const cx = container.offsetWidth / 2;
      const cy = container.offsetHeight / 2;

      for (const p of particles) {
        // Rotate around Y axis (base rotation)
        const cosA = Math.cos(baseAngle);
        const sinA = Math.sin(baseAngle);
        let x = p.x * cosA - p.z * sinA;
        let z = p.x * sinA + p.z * cosA;

        // Mouse influence (tilt)
        const cosMx = Math.cos(mx);
        const sinMx = Math.sin(mx);
        let y = p.y * cosMx - z * sinMx;
        z = p.y * sinMx + z * cosMx;

        const cosMy = Math.cos(my);
        const sinMy = Math.sin(my);
        const x2 = x * cosMy - z * sinMy;
        const z2 = x * sinMy + z * cosMy;

        // Project to screen
        const scale = 400 / (400 + z2);
        const sx = cx + x2 * radiusRef.current * scale;
        const sy = cy + y * radiusRef.current * scale;
        const alpha = 0.3 + (z2 + 1) * 0.35;

        p.el.style.transform = `translate(${sx}px, ${sy}px)`;
        p.el.style.opacity = String(Math.max(0.1, alpha));
      }

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("mousemove", onMouse);
      for (const p of particles) p.el.remove();
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 z-0 overflow-hidden" style={{ background: "black" }}>
      {/* Subtle center glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-cyan-500/8 rounded-full blur-2xl pointer-events-none" />
    </div>
  );
}
