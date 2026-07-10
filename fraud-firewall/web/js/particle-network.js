/**
 * Particle network background — ported from verumglobal.foundation
 * (src/components/ParticleNetwork.tsx)
 */
export function mountParticleNetwork(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const isMobile = window.matchMedia("(max-width: 768px)").matches;
  const particleCount = isMobile ? 40 : 80;
  const linkDistance = 150;
  const mouseRadius = 120;
  const mouseForce = 2.5;
  const maxSpeed = 0.3;

  const mouse = { x: -9999, y: -9999 };
  let particles = [];
  let raf = 0;
  const startedAt = performance.now();

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    resize();
    const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    g.addColorStop(0, "#0A1628");
    g.addColorStop(0.5, "#0F1F3A");
    g.addColorStop(1, "#040D1B");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return () => {};
  }

  function resize() {
    const parent = canvas.parentElement;
    if (!parent) return;
    canvas.width = parent.offsetWidth;
    canvas.height = parent.offsetHeight;
    seed();
  }

  function seed() {
    const next = [];
    for (let i = 0; i < particleCount; i++) {
      next.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * maxSpeed * 2,
        vy: (Math.random() - 0.5) * maxSpeed * 2,
        radius: 1.5 + Math.random() * 1.5,
        opacity: 0,
        targetOpacity: 0.4 + Math.random() * 0.3,
        fadeDelay: Math.random() * 1500,
      });
    }
    particles = next;
  }

  function update() {
    const elapsed = performance.now() - startedAt;
    for (const p of particles) {
      if (elapsed > p.fadeDelay) {
        const t = elapsed - p.fadeDelay;
        const fade = 500;
        p.opacity = t < fade ? (t / fade) * p.targetOpacity : p.targetOpacity;
      }

      const dx = p.x - mouse.x;
      const dy = p.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < mouseRadius && dist > 0) {
        const force = mouseForce * (1 - dist / mouseRadius);
        p.vx += (dx / dist) * force * 0.1;
        p.vy += (dy / dist) * force * 0.1;
      }

      p.vx *= 0.98;
      p.vy *= 0.98;
      p.vx += (Math.random() - 0.5) * 0.02;
      p.vy += (Math.random() - 0.5) * 0.02;

      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (speed > maxSpeed) {
        p.vx = (p.vx / speed) * maxSpeed;
        p.vy = (p.vy / speed) * maxSpeed;
      }

      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -10) p.x = canvas.width + 10;
      if (p.x > canvas.width + 10) p.x = -10;
      if (p.y < -10) p.y = canvas.height + 10;
      if (p.y > canvas.height + 10) p.y = -10;
    }
  }

  function drawLinks() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i];
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= linkDistance) continue;

        const base = 0.25 * (1 - dist / linkDistance);
        const avgOpacity = (a.opacity + b.opacity) / 2;
        const alpha = base * avgOpacity;

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(74, 126, 199, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const mdx = mx - mouse.x;
        const mdy = my - mouse.y;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < mouseRadius) {
          const glow = 0.5 * (1 - mdist / mouseRadius) * avgOpacity;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(212, 168, 67, ${glow})`;
          ctx.lineWidth = 2;
          ctx.shadowBlur = 8;
          ctx.shadowColor = `rgba(212, 168, 67, ${glow})`;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(248, 249, 250, ${p.opacity})`;
      ctx.fill();
    }
  }

  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    update();
    drawLinks();
    drawParticles();
    raf = requestAnimationFrame(frame);
  }

  function onMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  }

  function onLeave() {
    mouse.x = -9999;
    mouse.y = -9999;
  }

  resize();
  frame();
  window.addEventListener("resize", resize);
  // Track mouse on window so the decorative canvas never intercepts clicks
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseleave", onLeave);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseleave", onLeave);
  };
}
