(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Nav: solid after hero, highlight current section ---------- */
  const nav = document.getElementById('nav');
  const hero = document.querySelector('.hero');
  if (nav && hero) {
    new IntersectionObserver(([e]) => nav.classList.toggle('scrolled', !e.isIntersecting), {
      rootMargin: '-64px 0px 0px 0px',
    }).observe(hero);

    const links = new Map(
      [...nav.querySelectorAll('.nav-links a')].map((a) => [a.getAttribute('href').slice(1), a])
    );
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          links.forEach((a) => a.classList.remove('active'));
          const a = links.get(e.target.id);
          if (a) a.classList.add('active');
        });
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );
    links.forEach((_, id) => {
      const s = document.getElementById(id);
      if (s) spy.observe(s);
    });
  }

  /* ---------- Scroll reveal ---------- */
  const revealEls = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('in'));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px' }
    );
    revealEls.forEach((el) => io.observe(el));
  }

  /* ---------- Older news toggle ---------- */
  const more = document.querySelector('.more');
  if (more) {
    more.addEventListener('click', () => {
      const list = more.previousElementSibling;
      const open = list.classList.toggle('show-all');
      list.querySelectorAll('.is-older').forEach((el) => el.classList.add('in'));
      more.setAttribute('aria-expanded', String(open));
      more.textContent = open ? 'Show less' : 'Show older news';
    });
  }

  /* ---------- Hero: multiplexed tissue field ----------
     Cells in four marker channels drift slowly; nearby cells are linked as in
     a spatial neighbourhood graph; cells near the pointer brighten.
     Dark hero: glowing fluorescence. Light hero: soft stained-tissue dots. */
  const canvas = document.querySelector('.hero-canvas');
  if (!canvas || !hero) return;
  const ctx = canvas.getContext('2d');
  const style = hero.dataset.style || 'glow';
  const light = hero.classList.contains('hero-light') &&
    !window.matchMedia('(prefers-color-scheme: dark)').matches;
  const CHANNELS = light
    ? [
        { rgb: [14, 150, 180], w: 0.38 },  // cyan
        { rgb: [190, 60, 200], w: 0.24 },  // magenta
        { rgb: [220, 140, 20], w: 0.18 },  // amber
        { rgb: [30, 160, 90], w: 0.2 },    // green
      ]
    : [
        { rgb: [64, 220, 240], w: 0.38 },
        { rgb: [236, 110, 240], w: 0.24 },
        { rgb: [250, 190, 70], w: 0.18 },
        { rgb: [90, 230, 140], w: 0.2 },
      ];
  const LINE_RGB = light ? '70,90,130' : '160,190,255';
  const LINE_ALPHA = style === 'glow' ? (light ? 0.14 : 0.16) : (light ? 0.42 : 0.4);
  const LINE_WIDTH = style === 'glow' ? 0.6 : 0.9;
  const LINK = 78;
  const LENS = 150;

  // Pre-rendered glow sprite per channel (cheaper than per-frame gradients).
  const sprites = CHANNELS.map(({ rgb: [r, g, b] }) => {
    const s = document.createElement('canvas');
    s.width = s.height = 64;
    const c = s.getContext('2d');
    const grd = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    const stops = light
      ? [[0, 0.55], [0.22, 0.38], [0.5, 0.1], [1, 0]]
      : [[0, 0.95], [0.18, 0.55], [0.5, 0.12], [1, 0]];
    stops.forEach(([o, a]) => grd.addColorStop(o, `rgba(${r},${g},${b},${a})`));
    c.fillStyle = grd;
    c.fillRect(0, 0, 64, 64);
    return s;
  });

  let W = 0, H = 0, dpr = 1, cells = [];
  const pointer = { x: -1e4, y: -1e4, on: false };

  function pickChannel() {
    let t = Math.random();
    for (let i = 0; i < CHANNELS.length; i++) {
      if ((t -= CHANNELS[i].w) <= 0) return i;
    }
    return 0;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width;
    H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const panel = hero.classList.contains('hero-panel');
    const target = Math.min(320, Math.round((W * H) / ((style === 'segmentation' ? 4200 : 3400) * (panel ? 0.6 : 1))));
    // Cells cluster loosely, like tissue regions, using a few seed centres.
    const seeds = Array.from({ length: 6 }, () => ({ x: Math.random() * W, y: Math.random() * H, ch: pickChannel() }));
    cells = Array.from({ length: target }, () => {
      const s = seeds[(Math.random() * seeds.length) | 0];
      const clustered = Math.random() < (panel ? 0.3 : 0.55);
      const x = clustered ? s.x + (Math.random() - 0.5) * W * 0.35 : Math.random() * W;
      const y = clustered ? s.y + (Math.random() - 0.5) * H * 0.45 : Math.random() * H;
      return {
        x: (x + W) % W,
        y: (y + H) % H,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        r: style === 'segmentation' ? 7 + Math.random() * 7 : 5 + Math.random() * 9,
        ch: clustered && Math.random() < 0.6 ? s.ch : pickChannel(),
        base: 0.35 + Math.random() * 0.45,
        phase: Math.random() * Math.PI * 2,
      };
    });
  }

  function frame(t) {
    ctx.clearRect(0, 0, W, H);
    const time = t / 1000;

    // Neighbourhood graph.
    ctx.lineWidth = LINE_WIDTH;
    for (let i = 0; i < cells.length; i++) {
      const a = cells[i];
      for (let j = i + 1; j < cells.length; j++) {
        const b = cells[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < LINK * LINK) {
          const alpha = (1 - Math.sqrt(d2) / LINK) * LINE_ALPHA;
          ctx.strokeStyle = `rgba(${LINE_RGB},${alpha})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // Cells.
    ctx.globalCompositeOperation = light ? 'source-over' : 'lighter';
    for (const c of cells) {
      if (!reduceMotion) {
        c.x += c.vx + Math.sin(time * 0.3 + c.phase) * 0.05;
        c.y += c.vy + Math.cos(time * 0.27 + c.phase) * 0.05;
        if (c.x < -20) c.x = W + 20; else if (c.x > W + 20) c.x = -20;
        if (c.y < -20) c.y = H + 20; else if (c.y > H + 20) c.y = -20;
      }
      let lens = 0;
      if (pointer.on) {
        const dx = c.x - pointer.x, dy = c.y - pointer.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < LENS) lens = (1 - d / LENS) * 0.8;
      }
      const pulse = 0.12 * Math.sin(time * 1.3 + c.phase);
      const k = Math.min(1.6, c.base + pulse + lens);
      const [r, g, b] = CHANNELS[c.ch].rgb;
      if (style === 'glow') {
        const size = c.r * (2.6 + k * 1.4);
        ctx.globalAlpha = Math.min(1, 0.25 + k * 0.6);
        ctx.drawImage(sprites[c.ch], c.x - size / 2, c.y - size / 2, size, size);
      } else if (style === 'crisp') {
        // Small halo plus a sharp nucleus.
        const size = c.r * (1.6 + k * 0.7);
        ctx.globalAlpha = Math.min(1, 0.2 + k * 0.45);
        ctx.drawImage(sprites[c.ch], c.x - size / 2, c.y - size / 2, size, size);
        ctx.globalAlpha = Math.min(1, 0.55 + k * 0.35);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 1.6 + c.r * 0.14, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Segmentation overlay: membrane outline, faint fill, nucleus.
        ctx.globalAlpha = 1;
        ctx.fillStyle = `rgba(${r},${g},${b},${0.06 + k * 0.08})`;
        ctx.strokeStyle = `rgba(${r},${g},${b},${0.35 + k * 0.35})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = `rgba(${r},${g},${b},${0.6 + k * 0.3})`;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  let running = false, raf = 0, visible = true;
  function loop(t) {
    frame(t);
    raf = requestAnimationFrame(loop);
  }
  function start() {
    if (running || reduceMotion) return;
    running = true;
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  resize();
  frame(performance.now());
  start();

  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { resize(); frame(performance.now()); }, 150);
  });
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    visible && !document.hidden ? start() : stop();
  }).observe(hero);
  document.addEventListener('visibilitychange', () => (document.hidden || !visible ? stop() : start()));

  hero.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
    pointer.on = e.pointerType === 'mouse';
    if (reduceMotion) frame(performance.now());
  });
  hero.addEventListener('pointerleave', () => { pointer.on = false; });
})();
