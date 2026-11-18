/* =====================================================================
   AEROBOTIX IoT WORKSHOP - ANIMATION ENGINE
   ---------------------------------------------------------------------
   How it works
   - Every slide (<section>) can declare scenes:  data-scene="hook roadmap"
   - Every fragment can trigger a scene when shown: data-scene="..."
   - Scenes receive a context (ctx) whose timers / loops / packets are
     automatically cancelled when the slide is left -> no CPU waste.
   Reusable helpers: flowPacket, drawWires, countUp, liveChart, journeyBar
   ===================================================================== */
(function () {
  'use strict';

  // Backup slides: if a demo GIF fails to load, drop its whole <section>.
  // (Inline fallback in index.html <head> covers errors fired before this file loads.)
  if (!window.hideBackupSlide) {
    window.hideBackupSlide = function (img) {
      const s = img.closest('section');
      if (!s) return;
      s.remove();
      if (window.Reveal && Reveal.isReady && Reveal.isReady()) Reveal.sync();
    };
  }

  // -------------------------------------------------------------------
  // CONFIG - edit links here (QR codes are generated from these)
  // -------------------------------------------------------------------
  const CONFIG = {
    participantUrl: 'https://aerobotix-iot.vercel.app',
    repoUrl: 'https://github.com/Aerobotix-INSAT/IoT-workshop',
    feedbackUrl: '[FEEDBACK_FORM_URL]',
  };

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const JOURNEY = ['Sensor', 'Device', 'Network', 'Protocol', 'Broker', 'Data', 'Processing', 'Dashboard / Storage'];

  // -------------------------------------------------------------------
  // ICONS (Lucide-style, 24x24, stroke based). Same concept = same icon.
  // Usage: <span data-icon="chip"></span>  or  <g data-icon="chip" transform="..."></g>
  // -------------------------------------------------------------------
  const ICONS = {
    chip: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2"/>',
    hub: '<circle cx="12" cy="12" r="3"/><circle cx="4" cy="5" r="2"/><circle cx="20" cy="5" r="2"/><circle cx="4" cy="19" r="2"/><circle cx="20" cy="19" r="2"/><path d="M5.6 6.4l4.2 3.8M18.4 6.4l-4.2 3.8M5.6 17.6l4.2-3.8M18.4 17.6l-4.2-3.8"/>',
    chart: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
    phone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
    cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    wifi: '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><path d="M12 20h.01"/>',
    thermo: '<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>',
    bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6M10 22h4"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    sprout: '<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
    health: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>',
    factory: '<path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h1M12 18h1M7 18h1"/>',
    city: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
    truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
    drone: '<circle cx="5" cy="5" r="3"/><circle cx="19" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M7.2 7.2 9 9M16.8 7.2 15 9M7.2 16.8 9 15M16.8 16.8 15 15"/>',
    battery: '<rect x="2" y="7" width="16" height="10" rx="2"/><path d="M22 11v2M6 11v2"/>',
    signal: '<path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8"/><path d="m22 3-5 5M17 3l5 5"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    terminal: '<path d="m4 17 6-6-6-6M12 19h8"/>',
    motor: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    server: '<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><path d="M6 6h.01M6 18h.01"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    speaker: '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
    toggle: '<rect x="1" y="5" width="22" height="14" rx="7"/><circle cx="16" cy="12" r="3"/>',
    code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    brain: '<path d="M12 5a3 3 0 1 0-5.99.13 4 4 0 0 0-2.53 5.77 4 4 0 0 0 .52 6.6A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.99.13 4 4 0 0 1 2.53 5.77 4 4 0 0 1-.52 6.6A4 4 0 1 1 12 18Z"/><path d="M12 5v13"/>',
    rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
    plug: '<path d="M12 22v-5M9 8V2M15 8V2M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>',
    radio: '<circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14"/>',
    satellite: '<path d="M13 7 9 3 5 7l4 4M17 11l4 4-4 4-4-4M8 12l4 4 6-6-4-4ZM16 8l3-3M9 21a6 6 0 0 0-6-6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
  };

  function renderIcons(root) {
    root.querySelectorAll('[data-icon]').forEach((el) => {
      if (el.dataset.iconDone) return;
      const paths = ICONS[el.dataset.icon];
      if (!paths) { console.warn('[icons] unknown icon:', el.dataset.icon); return; }
      if (el instanceof SVGElement) {
        el.classList.add('ico-g');
        el.innerHTML = paths;
      } else {
        el.classList.add('ico');
        el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + paths + '</svg>';
      }
      el.dataset.iconDone = '1';
    });
  }

  // -------------------------------------------------------------------
  // Context: everything a scene starts is cleaned up on slide leave
  // -------------------------------------------------------------------
  class Ctx {
    constructor(slide) { this.slide = slide; this.alive = true; this.timers = new Set(); this.cleanups = []; }
    after(ms, fn) {
      const id = setTimeout(() => { this.timers.delete(id); if (this.alive) fn(); }, REDUCED ? Math.min(ms, 30) : ms);
      this.timers.add(id); return id;
    }
    every(ms, fn, immediate = true) {
      if (immediate) fn();
      if (REDUCED) return null;
      const id = setInterval(() => { if (this.alive) fn(); }, ms);
      this.timers.add(id); return id;
    }
    wait(ms) { return new Promise((resolve) => this.after(ms, resolve)); }
    frame(fn) {
      const loop = (t) => { if (!this.alive) return; if (fn(t) !== false) requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
    onStop(fn) { this.cleanups.push(fn); }
    stop() {
      this.alive = false;
      this.timers.forEach((id) => { clearTimeout(id); clearInterval(id); });
      this.timers.clear();
      this.cleanups.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
      this.cleanups = [];
    }
  }

  const ease = {
    inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    out: (t) => 1 - Math.pow(1 - t, 3),
    linear: (t) => t,
  };

  // -------------------------------------------------------------------
  // flowPacket: a glowing dot (optionally labelled) travelling along an
  // SVG path. Returns a Promise resolved on arrival ('lost' if dropped).
  // opts: duration, cls ('violet'|'ok'|'warn'|'bad'), r, reverse, label,
  //       dropAt (0..1 -> packet turns red and fades = lost)
  // -------------------------------------------------------------------
  function flowPacket(ctx, path, opts = {}) {
    const { duration = 1200, cls = '', r = 9, reverse = false, label = null, dropAt = null, easing = ease.inOut } = opts;
    return new Promise((resolve) => {
      if (!path || !ctx.alive) { resolve(); return; }
      const svg = path.ownerSVGElement;
      const layer = svg.querySelector('.packets') || svg;
      const g = document.createElementNS(SVGNS, 'g');
      const c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('r', r);
      c.setAttribute('class', ('packet ' + cls).trim());
      g.appendChild(c);
      if (label) {
        const tw = Math.max(36, label.length * 9.5 + 18);
        const bg = document.createElementNS(SVGNS, 'rect');
        bg.setAttribute('x', -tw / 2); bg.setAttribute('y', -r - 34); bg.setAttribute('width', tw);
        bg.setAttribute('height', 26); bg.setAttribute('rx', 7);
        bg.setAttribute('style', 'fill:#060a18;stroke:rgba(255,255,255,.25);stroke-width:1');
        const t = document.createElementNS(SVGNS, 'text');
        t.setAttribute('y', -r - 15); t.setAttribute('text-anchor', 'middle');
        t.setAttribute('class', 'lbl-mono'); t.textContent = label;
        g.appendChild(bg); g.appendChild(t);
      }
      const L = path.getTotalLength();
      const p0 = path.getPointAtLength(reverse ? L : 0);
      g.setAttribute('transform', 'translate(' + p0.x + ',' + p0.y + ')');
      layer.appendChild(g);
      ctx.onStop(() => g.remove());
      const d = REDUCED ? 1 : duration;
      const start = performance.now();
      ctx.frame((now) => {
        const t = Math.min(1, (now - start) / d);
        const e = easing(t);
        const p = path.getPointAtLength(L * (reverse ? 1 - e : e));
        g.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ')');
        if (dropAt !== null && t >= dropAt) {
          c.setAttribute('class', 'packet bad');
          g.style.transition = 'opacity .6s, transform .6s';
          g.style.opacity = '0';
          setTimeout(() => g.remove(), 650);
          resolve('lost');
          return false;
        }
        if (t >= 1) { g.remove(); resolve('ok'); return false; }
        return true;
      });
    });
  }

  // -------------------------------------------------------------------
  // drawWires: every element with class .draw inside root draws itself
  // -------------------------------------------------------------------
  function drawWires(ctx, root) {
    root.querySelectorAll('.draw').forEach((el) => {
      if (el.closest('.fragment:not(.visible)') && !root.classList.contains('fragment')) return;
      if (typeof el.getTotalLength !== 'function') return;
      const L = el.getTotalLength();
      el.style.transition = 'none';
      el.style.strokeDasharray = L;
      el.style.strokeDashoffset = L;
      el.getBoundingClientRect(); // force reflow
      el.style.transition = '';
      const delay = +(el.dataset.delay || 0);
      ctx.after(30 + delay, () => { el.style.strokeDashoffset = 0; });
      ctx.onStop(() => {
        // when leaving, restore a clean (fully drawn) state for overview mode
        el.style.transition = 'none'; el.style.strokeDashoffset = 0;
        if (el.classList.contains('dashed')) el.style.strokeDasharray = '';
      });
    });
  }

  // -------------------------------------------------------------------
  // countUp: <span data-count="18.8" data-decimals="1" data-suffix=" B">
  // -------------------------------------------------------------------
  function countUp(ctx, el) {
    const to = parseFloat(el.dataset.count);
    const dec = +(el.dataset.decimals || 0);
    const pre = el.dataset.prefix || '';
    const suf = el.dataset.suffix || '';
    const dur = REDUCED ? 1 : +(el.dataset.duration || 1800);
    const start = performance.now();
    ctx.frame((now) => {
      const t = Math.min(1, (now - start) / dur);
      el.textContent = pre + (to * ease.out(t)).toFixed(dec) + suf;
      return t < 1;
    });
  }

  // -------------------------------------------------------------------
  // liveChart: animated self-updating line chart inside an <svg>
  // opts: points, min, max, gen(prev) -> next value, interval, cls
  // -------------------------------------------------------------------
  function liveChart(ctx, svg, opts = {}) {
    const W = +(svg.dataset.w || 400), H = +(svg.dataset.h || 160);
    const { points = 30, min = 0, max = 100, interval = 400, gen = (v) => v + (Math.random() - 0.5) * 8,
            start = (min + max) / 2, color = 'var(--accent)' } = opts;
    let data = Array.from({ length: points }, () => start);
    for (let i = 1; i < points; i++) data[i] = clamp(gen(data[i - 1]), min, max);
    const line = document.createElementNS(SVGNS, 'polyline');
    line.setAttribute('style', 'fill:none;stroke:' + color + ';stroke-width:3;stroke-linejoin:round;filter:drop-shadow(0 0 6px ' + color + ')');
    const area = document.createElementNS(SVGNS, 'polygon');
    area.setAttribute('style', 'fill:' + color + ';opacity:.12');
    const head = document.createElementNS(SVGNS, 'circle');
    head.setAttribute('r', 5); head.setAttribute('class', 'packet');
    svg.append(area, line, head);
    ctx.onStop(() => { line.remove(); area.remove(); head.remove(); });
    const render = () => {
      const pts = data.map((v, i) => [(i / (points - 1)) * W, H - ((v - min) / (max - min)) * H]);
      line.setAttribute('points', pts.map((p) => p.join(',')).join(' '));
      area.setAttribute('points', '0,' + H + ' ' + pts.map((p) => p.join(',')).join(' ') + ' ' + W + ',' + H);
      const last = pts[pts.length - 1];
      head.setAttribute('cx', last[0]); head.setAttribute('cy', last[1]);
    };
    ctx.every(interval, () => { data.push(clamp(gen(data[data.length - 1]), min, max)); data.shift(); render(); });
    return { push: (v) => { data.push(clamp(v, min, max)); data.shift(); render(); } };
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // -------------------------------------------------------------------
  // journeyBar: "you are here" bar.
  // <div class="journey" data-step="3" data-from="2"></div>
  // data-step="all" lights everything; data-mode="sweep" walks 0 -> 7
  // -------------------------------------------------------------------
  function buildJourney(el) {
    if (el.dataset.built) return;
    el.innerHTML = '<div class="track"></div><div class="fill"></div><div class="stops">' +
      JOURNEY.map((n, i) => '<div class="stop" data-i="' + i + '"><div class="dot"></div><div class="lbl">' + n + '</div></div>').join('') +
      '</div>';
    el.dataset.built = '1';
  }
  function setJourney(el, i, all) {
    const dot = el.classList.contains('big') ? 44 : 28;
    el.querySelector('.fill').style.width = 'calc((100% - ' + dot + 'px) * ' + (i / (JOURNEY.length - 1)) + ')';
    el.querySelectorAll('.stop').forEach((s) => {
      const k = +s.dataset.i;
      s.classList.toggle('done', all || k < i);
      s.classList.toggle('current', !all && k === i);
    });
  }
  function journeyBar(ctx, el) {
    buildJourney(el);
    const fill = el.querySelector('.fill');
    const mode = el.dataset.mode;
    const step = el.dataset.step;
    fill.style.transition = 'none';
    if (mode === 'sweep') {
      setJourney(el, 0, false);
      fill.getBoundingClientRect();
      fill.style.transition = '';
      let i = 0;
      ctx.after(400, function next() {
        setJourney(el, i, false);
        i++;
        if (i < JOURNEY.length) ctx.after(650, next);
        else ctx.after(900, () => setJourney(el, JOURNEY.length - 1, true));
      });
      return;
    }
    if (step === 'all') {
      setJourney(el, 0, false); fill.getBoundingClientRect(); fill.style.transition = '';
      ctx.after(300, () => setJourney(el, JOURNEY.length - 1, true));
      return;
    }
    const to = +step;
    const from = el.dataset.from !== undefined ? +el.dataset.from : Math.max(0, to - 1);
    setJourney(el, from, false);
    fill.getBoundingClientRect();
    fill.style.transition = '';
    ctx.after(450, () => setJourney(el, to, false));
  }

  // -------------------------------------------------------------------
  // QR codes: <div class="qr" data-qr="participantUrl"></div>
  // -------------------------------------------------------------------
  function renderQRs() {
    document.querySelectorAll('[data-qr]').forEach((el) => {
      const url = CONFIG[el.dataset.qr] || el.dataset.qr;
      try {
        const qr = window.qrcode(0, 'M');
        qr.addData(url); qr.make();
        el.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
      } catch (e) { el.textContent = 'QR error'; console.error(e); }
      const cap = el.parentElement.querySelector('.qr-cap');
      if (cap) cap.textContent = url;
    });
  }

  // small DOM helpers for scenes
  const $ = (root, sel) => root.querySelector(sel);
  const $$ = (root, sel) => Array.from(root.querySelectorAll(sel));
  const wire = (root, name) => root.querySelector('[data-wire="' + name + '"]');
  const flash = (ctx, el, cls = 'on', ms = 600) => { if (!el) return; el.classList.add(cls); ctx.after(ms, () => el.classList.remove(cls)); };
  function svgEl(tag, attrs) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }

  // ===================================================================
  // SCENES
  // ===================================================================
  const SCENES = {};

  // ---- Title: living IoT network in the background ------------------
  SCENES['title-net'] = (ctx, slide) => {
    const svg = $(slide, 'svg.net');
    if (!svg) return;
    svg.innerHTML = '';
    const W = 1280, H = 720, N = 26;
    const rnd = mulberry(7);
    const nodes = Array.from({ length: N }, () => ({ x: 40 + rnd() * (W - 80), y: 40 + rnd() * (H - 80) }));
    const edges = [];
    nodes.forEach((a, i) => {
      const near = nodes.map((b, j) => ({ j, d: Math.hypot(a.x - b.x, a.y - b.y) }))
        .filter((o) => o.j !== i).sort((p, q) => p.d - q.d).slice(0, 2);
      near.forEach((o) => { if (!edges.find((e) => (e[0] === o.j && e[1] === i))) edges.push([i, o.j]); });
    });
    const gE = svgEl('g', {}), gN = svgEl('g', {}), gP = svgEl('g', { class: 'packets' });
    svg.append(gE, gN, gP);
    const paths = edges.map(([i, j]) => {
      const p = svgEl('path', { d: 'M' + nodes[i].x + ' ' + nodes[i].y + ' L' + nodes[j].x + ' ' + nodes[j].y,
        style: 'stroke:rgba(255,255,255,.08);stroke-width:1.5;fill:none' });
      gE.appendChild(p); return { p, j };
    });
    const circles = nodes.map((n) => {
      const c = svgEl('circle', { cx: n.x, cy: n.y, r: 4, style: 'fill:rgba(0,180,255,.35);transition:all .4s' });
      gN.appendChild(c); return c;
    });
    ctx.every(380, () => {
      const e = paths[Math.floor(Math.random() * paths.length)];
      const rev = Math.random() < 0.5;
      flowPacket(ctx, e.p, { duration: 1400, r: 3.5, reverse: rev, cls: Math.random() < 0.3 ? 'violet' : '' }).then(() => {
        const c = circles[e.j];
        if (!c) return;
        c.setAttribute('r', 8); c.style.fill = 'var(--accent)';
        ctx.after(350, () => { c.setAttribute('r', 4); c.style.fill = 'rgba(0,180,255,.35)'; });
      });
    });
  };
  function mulberry(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ---- Hook: phone -> broker -> ESP32 -> LED, confirmation back -----
  SCENES['hook'] = async (ctx, slide) => {
    const led = $(slide, '.led-bulb');
    const phoneBtn = $(slide, '.phone-btn');
    const phoneTxt = $(slide, '.phone-state');
    const broker = $(slide, '.broker-box');
    const esp = $(slide, '.esp-box');
    const chart = $(slide, 'svg.mini-chart');
    if (chart) liveChart(ctx, chart, { min: -30, max: 30, start: 0, interval: 260, gen: (v) => v * 0.85 + (Math.random() - 0.5) * 18, color: '#b794ff' });
    // continuous telemetry from phone (violet) to the projector screen
    ctx.every(1100, () => {
      flowPacket(ctx, wire(slide, 'tele1'), { duration: 900, r: 6, cls: 'violet' })
        .then(() => flowPacket(ctx, wire(slide, 'tele2'), { duration: 700, r: 6, cls: 'violet' }));
    });
    let on = false;
    while (ctx.alive) {
      on = !on;
      const cmd = on ? 'ON' : 'OFF';
      phoneBtn.textContent = 'LED ' + cmd;
      flash(ctx, phoneBtn, 'tap', 400);
      await flowPacket(ctx, wire(slide, 'cmd1'), { duration: 1000, label: cmd });
      flash(ctx, broker, 'on', 500);
      await flowPacket(ctx, wire(slide, 'cmd2'), { duration: 1000, label: cmd });
      flash(ctx, esp, 'on', 500);
      led.classList.toggle('lit', on);
      await ctx.wait(350);
      await flowPacket(ctx, wire(slide, 'ack1'), { duration: 900, cls: 'ok', label: 'state:' + cmd });
      await flowPacket(ctx, wire(slide, 'ack2'), { duration: 900, cls: 'ok', label: 'state:' + cmd });
      phoneTxt.textContent = 'LED is ' + cmd;
      phoneTxt.classList.toggle('ok', on);
      await ctx.wait(1500);
    }
  };

  // ---- Architecture: data goes UP, commands come DOWN ---------------
  SCENES['arch-flow'] = async (ctx, slide) => {
    const layers = [1, 2, 3, 4].map((n) => $(slide, '.layer.l' + n));
    const up = wire(slide, 'up'), down = wire(slide, 'down');
    while (ctx.alive) {
      const p1 = flowPacket(ctx, up, { duration: 2400, easing: ease.linear, label: '24.3°C' });
      for (const l of layers) { l.classList.add('active'); await ctx.wait(600); l.classList.remove('active'); }
      await p1;
      await ctx.wait(300);
      const p2 = flowPacket(ctx, down, { duration: 2400, easing: ease.linear, cls: 'warn', label: 'FAN ON' });
      for (const l of layers.slice().reverse()) { l.classList.add('active'); await ctx.wait(600); l.classList.remove('active'); }
      await p2;
      await ctx.wait(700);
    }
  };

  // ---- Edge / Fog / Cloud: filter at the edge, aggregate at the fog --
  SCENES['edge-fog-cloud'] = (ctx, slide) => {
    const fog = $(slide, '.fog-box'), cloud = $(slide, '.cloud-box'), dev = $(slide, '.dev-box');
    const counter = $(slide, '.agg-count');
    let n = 0;
    ctx.every(420, () => {
      flowPacket(ctx, wire(slide, 'd2f'), { duration: 700, r: 6 }).then(() => {
        flash(ctx, fog, 'on', 250);
        n++;
        if (counter) counter.textContent = (n % 5) + '/5';
        if (n % 5 === 0) {
          flowPacket(ctx, wire(slide, 'f2c'), { duration: 1400, r: 12, cls: 'violet', label: 'avg' }).then(() => flash(ctx, cloud, 'on', 500));
        }
        if (n % 9 === 0) {
          flowPacket(ctx, wire(slide, 'f2d'), { duration: 500, r: 7, cls: 'warn', label: 'react!' }).then(() => flash(ctx, dev, 'on', 400));
        }
      });
    });
  };

  // ---- Sensor pipeline: physical wave -> signal -> bits -> number ---
  SCENES['sensor-pipeline'] = (ctx, slide) => {
    const bits = $(slide, '.bits-text');
    const val = $(slide, '.val-text');
    const volt = $(slide, '.volt-text');
    let t = 24.3;
    ctx.every(700, () => {
      t = clamp(t + (Math.random() - 0.5) * 0.6, 22, 27);
      const raw = Math.round(((t - 0) / 50) * 4095);
      if (bits) bits.textContent = raw.toString(2).padStart(12, '0');
      if (val) val.textContent = t.toFixed(1) + ' °C';
      if (volt) volt.textContent = ((raw / 4095) * 3.3).toFixed(2) + ' V';
    });
    ctx.every(900, () => flowPacket(ctx, wire(slide, 'sp'), { duration: 1600, r: 6, easing: ease.linear }));
  };

  // ---- Actuators: digital -> physical --------------------------------
  SCENES['actuators'] = (ctx, slide) => {
    const code = $(slide, '.act-code');
    const led = $(slide, '.act-led');
    const relay = $(slide, '.act-relay');
    const fan = $(slide, '.act-fan');
    let on = false;
    ctx.every(1400, () => {
      on = !on;
      if (code) code.textContent = 'digitalWrite(PIN, ' + (on ? 'HIGH' : 'LOW') + ');';
      if (led) led.classList.toggle('lit', on);
      if (relay) relay.classList.toggle('closed', on);
      if (fan) fan.classList.toggle('spin', on);
      ['a1', 'a2', 'a3'].forEach((w) => flowPacket(ctx, wire(slide, w), { duration: 600, r: 6, cls: on ? 'warn' : '' }));
    });
  };

  // ---- Firmware loop: walk through boot then loop forever ------------
  SCENES['firmware-loop'] = async (ctx, slide) => {
    const box = (id) => $(slide, '[data-box="' + id + '"]');
    const visit = async (id, ms = 500) => { const b = box(id); if (b) b.classList.add('on'); await ctx.wait(ms); if (b) b.classList.remove('on'); };
    const go = (w, o) => flowPacket(ctx, wire(slide, w), Object.assign({ duration: 600, r: 7 }, o));
    await visit('boot'); await go('b-n');
    await visit('net'); await go('n-c');
    await visit('broker'); await go('c-l');
    while (ctx.alive) {
      await visit('loop', 300);
      await go('l-read'); await visit('read', 350);
      await go('read-fmt'); await visit('fmt', 350);
      await go('fmt-send', { label: '{"temp":24.3}' }); await visit('send', 350);
      await go('send-l');
      await visit('loop', 300);
      await go('l-recv', { cls: 'warn' }); await visit('recv', 350);
      await go('recv-act', { cls: 'warn', label: 'LED ON' }); await visit('act', 350);
      await go('act-l', { cls: 'warn' });
      await visit('loop', 300);
      await go('l-chk', { cls: 'ok' }); await visit('chk', 350);
      await go('chk-l', { cls: 'ok' });
    }
  };

  // ---- Serial monitor typewriter -------------------------------------
  SCENES['serial'] = async (ctx, slide) => {
    const body = $(slide, '.terminal .body');
    if (!body) return;
    body.innerHTML = '';
    const lines = [
      ['t-mut', 'ets Jun  8 2016 00:22:57  rst:0x1 (POWERON_RESET)'],
      ['', '========================================='],
      ['t-acc', '   AEROBOTIX IoT WORKSHOP - ESP32 DEMO'],
      ['', '========================================='],
      ['', '[SENSOR] DHT22 ready on GPIO 4'],
      ['', '[SENSOR] temp=24.3 C  hum=55.1 %'],
      ['', '[SENSOR] temp=24.4 C  hum=55.0 %'],
      ['', '[SENSOR] temp=24.4 C  hum=54.8 %'],
      ['', '[SENSOR] temp=24.5 C  hum=54.9 %'],
      ['t-warn', '[INFO] Data only travels on this USB cable...'],
      ['t-warn', '[INFO] Nobody else in the world can see it.'],
    ];
    const add = (cls, txt) => {
      const d = document.createElement('div');
      d.className = 'ln ' + cls; d.textContent = txt; body.appendChild(d);
      while (body.children.length > 13) body.firstChild.remove();
    };
    for (const [c, t] of lines) { add(c, t); await ctx.wait(420); }
    let temp = 24.5, hum = 54.9;
    ctx.every(900, () => {
      temp = clamp(temp + (Math.random() - 0.5) * 0.3, 23, 26);
      hum = clamp(hum + (Math.random() - 0.5) * 0.6, 50, 60);
      add('', '[SENSOR] temp=' + temp.toFixed(1) + ' C  hum=' + hum.toFixed(1) + ' %');
    });
  };

  // ===================================================================
  // SEQUENCE DIAGRAMS (generated SVG)
  // <div class="seq" data-actors="Client,Broker" [data-mode="auto"] [data-rowh="50"] [data-w="1136"] [data-margin="130"]>
  //   <i data-m="0>1 | CONNECT (clientId…) | accent"></i>   message
  //        flags: accent ok warn bad violet  resp (dashed reply)  lost (packet dropped)
  //               static (always visible)   same (appears with the previous one)
  //   <i data-note="0-1 | text | warn"></i>                  note spanning actors
  //   <i data-loop="every keepAlive | 2"></i>                frame around the next N messages
  // Fragment mode (default): one arrow per click, a packet flies along it.
  // Auto mode: arrows appear one after another in a loop (add data-scene="seq-auto" on the slide).
  // ===================================================================
  let seqUid = 0;
  const escXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function buildSeq(div) {
    if (div.dataset.built) return;
    const uid = 'seq' + (++seqUid);
    const actors = div.dataset.actors.split(',').map((s) => s.trim());
    const W = +(div.dataset.w || 1136);
    const rowh = +(div.dataset.rowh || 50);
    const margin = +(div.dataset.margin || 130);
    const auto = div.dataset.mode === 'auto';
    const ax = (i) => (actors.length === 1 ? W / 2 : margin + (i * (W - 2 * margin)) / (actors.length - 1));
    const items = Array.from(div.children);
    let y = 98;
    let frag = -1;
    const body = [];
    const frames = [];
    let loop = null;
    const fragAttr = (flags) => {
      if (flags.includes('static')) return { cls: '', attr: '' };
      if (auto) return { cls: 'seq-hidden', attr: '' };
      if (!flags.includes('same')) frag++;
      return { cls: 'fragment', attr: ' data-fragment-index="' + Math.max(frag, 0) + '"' };
    };
    items.forEach((it) => {
      const d = it.dataset;
      if (d.loop !== undefined) {
        const [label, n] = d.loop.split('|').map((s) => s.trim());
        loop = { label, left: +n || 1, y0: y - 14 };
        y += 30;
        return;
      }
      if (d.note !== undefined) {
        const [span, text, flags = ''] = d.note.split('|').map((s) => s.trim());
        const [a, b] = span.split('-').map(Number);
        const x1 = Math.min(ax(a), ax(isNaN(b) ? a : b)) - 110;
        const x2 = Math.max(ax(a), ax(isNaN(b) ? a : b)) + 110;
        const fa = fragAttr(flags.split(/\s+/));
        const tone = (flags.match(/\b(warn|bad|ok|violet)\b/) || [''])[0];
        body.push('<g class="seq-note ' + tone + ' ' + fa.cls + '"' + fa.attr + '>' +
          '<rect x="' + x1 + '" y="' + (y - 20) + '" width="' + (x2 - x1) + '" height="34" rx="8"/>' +
          '<text x="' + (x1 + x2) / 2 + '" y="' + (y + 3) + '" text-anchor="middle">' + escXml(text) + '</text></g>');
        y += rowh * 0.9;
      } else if (d.m !== undefined) {
        const [arrow, label = '', flagStr = ''] = d.m.split('|').map((s) => s.trim());
        const flags = flagStr.split(/\s+/);
        const [f, t] = arrow.split('>').map(Number);
        const x1 = ax(f), x2 = ax(t), dir = x2 > x1 ? 1 : -1;
        const xs = x1 + dir * 8, xe = x2 - dir * 14;
        const lost = flags.includes('lost');
        const xEnd = lost ? xs + (xe - xs) * 0.6 : xe;
        const tone = (flagStr.match(/\b(accent|ok|warn|bad|violet)\b/) || [''])[0];
        const fa = fragAttr(flags);
        body.push('<g class="seq-msg ' + fa.cls + '"' + fa.attr + ' data-scene="seq-pulse" data-tone="' + tone + '" data-lost="' + (lost ? 1 : 0) + '">' +
          '<path class="seq-line ' + tone + (flags.includes('resp') ? ' resp' : '') + '" d="M' + xs + ' ' + y + ' L' + xEnd + ' ' + y + '"' +
          (lost ? '' : ' marker-end="url(#' + uid + '-ah)"') + '/>' +
          (lost ? '<text x="' + (xEnd + dir * 16) + '" y="' + (y + 8) + '" text-anchor="middle" class="seq-x">✕</text>' : '') +
          '<text x="' + (x1 + x2) / 2 + '" y="' + (y - 11) + '" text-anchor="middle" class="seq-lbl">' + escXml(label) + '</text></g>');
        y += rowh;
      }
      if (loop && d.loop === undefined) {
        loop.left--;
        if (loop.left === 0) {
          frames.push('<g class="seq-loop"><rect x="' + (ax(0) - 120) + '" y="' + loop.y0 + '" width="' + (ax(actors.length - 1) - ax(0) + 240) +
            '" height="' + (y - loop.y0 - rowh + 22) + '" rx="10"/><rect class="tag" x="' + (ax(0) - 120) + '" y="' + loop.y0 + '" width="' +
            (loop.label.length * 9.4 + 34) + '" height="24" rx="6"/><text x="' + (ax(0) - 106) + '" y="' + (loop.y0 + 17) + '" class="seq-tag">↻ ' +
            escXml(loop.label) + '</text></g>');
          loop = null;
        }
      }
    });
    const H = y + 4;
    const head = actors.map((a, i) =>
      '<line class="seq-life" x1="' + ax(i) + '" y1="58" x2="' + ax(i) + '" y2="' + (H - 4) + '"/>' +
      '<rect class="box accent" x="' + (ax(i) - 100) + '" y="6" width="200" height="50" rx="12"/>' +
      '<text x="' + ax(i) + '" y="38" text-anchor="middle" style="font-weight:700">' + escXml(a) + '</text>').join('');
    div.innerHTML = '<svg class="dia seq-svg" viewBox="0 0 ' + W + ' ' + H + '"><defs><marker id="' + uid + '-ah" viewBox="0 0 10 10" refX="8" refY="5" ' +
      'markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" style="fill:rgba(255,255,255,.75)"/></marker></defs>' +
      frames.join('') + head + body.join('') + '<g class="packets"></g></svg>';
    div.dataset.built = '1';
  }

  const toneToPacket = { accent: '', ok: 'ok', warn: 'warn', bad: 'bad', violet: 'violet', '': '' };
  function pulseMsg(ctx, g, duration = 650) {
    const path = g.querySelector('.seq-line');
    const lost = g.dataset.lost === '1';
    return flowPacket(ctx, path, { duration, r: 8, cls: toneToPacket[g.dataset.tone || ''], dropAt: lost ? 0.97 : null });
  }
  SCENES['seq-pulse'] = (ctx, slide, g) => { if (g) pulseMsg(ctx, g); };
  SCENES['seq-auto'] = (ctx, slide) => {
    $$(slide, '.seq[data-mode="auto"]').forEach(async (seq) => {
      const steps = $$(seq, '.seq-msg.seq-hidden, .seq-note.seq-hidden');
      ctx.onStop(() => steps.forEach((s) => s.classList.remove('seq-hidden')));
      const pause = +(seq.dataset.pause || 2600);
      while (ctx.alive) {
        steps.forEach((s) => s.classList.add('seq-hidden'));
        await ctx.wait(500);
        for (const s of steps) {
          if (!ctx.alive) return;
          s.classList.remove('seq-hidden');
          if (s.classList.contains('seq-msg')) await pulseMsg(ctx, s, 700); else await ctx.wait(700);
          await ctx.wait(220);
        }
        await ctx.wait(pause);
      }
    });
  };

  // MQTT topic filter matching (spec-correct: + = one level, # = this level and below)
  function mqttMatch(filter, topic) {
    const f = filter.split('/'), t = topic.split('/');
    for (let i = 0; i < f.length; i++) {
      if (f[i] === '#') return true;
      if (i >= t.length) return false;
      if (f[i] !== '+' && f[i] !== t[i]) return false;
    }
    return f.length === t.length;
  }

  // ===================================================================
  // PHASE 2 SCENES: connectivity, protocols, MQTT
  // ===================================================================
  const fly = (ctx, slide, name, o) => flowPacket(ctx, wire(slide, name), Object.assign({ duration: 900 }, o || {}));

  // ---- Trade-off triangle ------------------------------------------
  SCENES['triangle'] = (ctx, slide) => {
    const dot = $(slide, '.tri-dot'), name = $(slide, '.tri-name'), desc = $(slide, '.tri-desc');
    const techs = [
      ['Wi-Fi', 232, 382, 'high data rate · power hungry'],
      ['BLE', 612, 392, 'tiny power · short range'],
      ['LoRaWAN', 532, 220, 'kilometres · a few bytes'],
      ['4G / 5G', 300, 225, 'far & fast · power hungry'],
      ['Zigbee / Thread', 575, 330, 'low-power mesh · home range'],
      ['NB-IoT / LTE-M', 480, 170, 'cellular coverage · low power'],
    ];
    let i = 0;
    ctx.every(2300, () => {
      const [n, x, y, d] = techs[i++ % techs.length];
      dot.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      name.textContent = n; desc.textContent = d;
    });
  };

  // ---- Every radio ends on the Internet ------------------------------
  SCENES['converge'] = (ctx, slide) => {
    const radios = [['r1', ''], ['r2', 'violet'], ['r3', 'ok'], ['r4', 'warn']];
    let k = 0;
    ctx.every(600, () => {
      const [w, cls] = radios[k++ % radios.length];
      fly(ctx, slide, w, { duration: 1100, r: 7, cls }).then(() => {
        flash(ctx, $(slide, '.inet-box'), 'on', 300);
        return fly(ctx, slide, 'i2b', { duration: 800, r: 7, cls });
      }).then(() => flash(ctx, $(slide, '.dest-box'), 'on', 300));
    });
  };

  // ---- HTTP polling vs MQTT push ------------------------------------
  SCENES['poll-vs-push'] = (ctx, slide) => {
    const req = $(slide, '.req-count'), useful = $(slide, '.useful-count'), push = $(slide, '.push-count');
    let tick = 0, nReq = 0, nUse = 0, nPush = 0;
    const show = () => { req.textContent = nReq; useful.textContent = nUse; push.textContent = nPush; };
    show();
    ctx.every(750, () => {
      tick++;
      const news = tick % 7 === 0;
      nReq++; show();
      fly(ctx, slide, 'lq', { duration: 420, r: 6, label: 'anything?' })
        .then(() => fly(ctx, slide, 'la', { duration: 420, r: 6, cls: news ? 'ok' : 'bad', label: news ? '24.3!' : 'no' }))
        .then(() => { if (news) { nUse++; show(); } });
      if (news) {
        fly(ctx, slide, 'rp', { duration: 700, r: 8, cls: 'ok', label: '24.3' }).then(() => {
          nPush++; show(); flash(ctx, $(slide, '.push-dev'), 'on', 400);
        });
      }
    });
  };

  // ---- WebSocket: handshake then a two-way pipe ----------------------
  SCENES['ws-pipe'] = async (ctx, slide) => {
    const pipe = $(slide, '.ws-pipe'), state = $(slide, '.ws-state');
    while (ctx.alive) {
      pipe.classList.remove('open');
      state.textContent = 'HTTP: one question, one answer';
      await ctx.wait(500);
      await fly(ctx, slide, 'hs1', { label: 'GET  Upgrade: websocket', duration: 1100 });
      await fly(ctx, slide, 'hs2', { label: '101 Switching Protocols', cls: 'ok', duration: 1100 });
      pipe.classList.add('open');
      state.textContent = 'WebSocket: open pipe, both sides talk anytime';
      await ctx.wait(500);
      for (let i = 0; i < 14 && ctx.alive; i++) {
        const up = Math.random() < 0.5;
        fly(ctx, slide, up ? 'fup' : 'fdown', { duration: 700, r: 7, cls: up ? 'violet' : '', easing: ease.linear });
        await ctx.wait(260 + Math.random() * 260);
      }
      await ctx.wait(1500);
    }
  };

  // ---- Publish / subscribe fan-out -----------------------------------
  SCENES['pubsub'] = async (ctx, slide) => {
    const broker = $(slide, '.broker-box');
    const subs = $$(slide, '.sub-box');
    while (ctx.alive) {
      await fly(ctx, slide, 'p1', { label: '24.3 °C' });
      flash(ctx, broker, 'on', 400);
      await Promise.all(['s1', 's2', 's3'].map((w) => fly(ctx, slide, w, { label: '24.3', duration: 1000 })));
      subs.forEach((s) => flash(ctx, s, 'on', 500));
      await ctx.wait(700);
      await fly(ctx, slide, 'p2', { label: '55 %', cls: 'violet' });
      flash(ctx, broker, 'on', 400);
      await Promise.all(['s1', 's2', 's3'].map((w) => fly(ctx, slide, w, { label: '55', cls: 'violet', duration: 1000 })));
      subs.forEach((s) => flash(ctx, s, 'on', 500));
      await ctx.wait(1100);
    }
  };

  // ---- Protocols are complementary ----------------------------------
  SCENES['complementary'] = (ctx, slide) => {
    ctx.every(1300, () => {
      fly(ctx, slide, 'm1', { label: 'MQTT', duration: 900 })
        .then(() => fly(ctx, slide, 'w1', { label: 'WebSocket', cls: 'violet', duration: 900 }));
    });
    ctx.every(3900, () => {
      fly(ctx, slide, 'h1', { label: 'HTTP: firmware.bin', cls: 'warn', duration: 1300 });
      fly(ctx, slide, 'h2', { label: 'HTTP: GET /history', cls: 'ok', duration: 1300 });
    }, false);
  };

  // ---- Everyone talks only to the broker -----------------------------
  SCENES['actors'] = (ctx, slide) => {
    const N = $$(slide, '[data-wire^="sp"]').length;
    const broker = $(slide, '.broker-box');
    const tones = ['', 'violet', 'ok', 'warn'];
    let k = 0;
    ctx.every(1000, () => {
      const src = Math.floor(Math.random() * N);
      let dst = Math.floor(Math.random() * (N - 1)); if (dst >= src) dst++;
      const cls = tones[k++ % tones.length];
      fly(ctx, slide, 'sp' + src, { duration: 700, r: 7, cls }).then(() => {
        flash(ctx, broker, 'on', 250);
        return fly(ctx, slide, 'sp' + dst, { duration: 700, r: 7, cls, reverse: true });
      }).then(() => flash(ctx, $(slide, '[data-client="' + dst + '"]'), 'on', 400));
    });
  };

  // ---- Wildcards: highlight matching topics ---------------------------
  SCENES['wildcards'] = async (ctx, slide) => {
    const filterEl = $(slide, '.wc-filter');
    const rows = $$(slide, '.wc-row');
    const filters = (slide.dataset.filters || 'aerobotix/+/telemetry;aerobotix/#').split(';');
    ctx.onStop(() => rows.forEach((r) => r.classList.remove('match', 'nomatch')));
    let i = 0;
    while (ctx.alive) {
      const f = filters[i++ % filters.length];
      rows.forEach((r) => r.classList.remove('match', 'nomatch'));
      filterEl.classList.remove('pop'); void filterEl.offsetWidth; filterEl.classList.add('pop');
      filterEl.innerHTML = escXml(f).replace(/\+/g, '<b class="wc-plus">+</b>').replace(/#/g, '<b class="wc-hash">#</b>');
      await ctx.wait(700);
      for (const r of rows) {
        r.classList.add(mqttMatch(f, r.dataset.topic) ? 'match' : 'nomatch');
        await ctx.wait(260);
      }
      await ctx.wait(2600);
    }
  };

  // ---- Retained message: the sticky note ------------------------------
  SCENES['retained'] = async (ctx, slide) => {
    const sticky = $(slide, '.sticky'), subB = $(slide, '.sub-b'), broker = $(slide, '.broker-box');
    ctx.onStop(() => { sticky.classList.add('show'); subB.classList.add('show'); });
    while (ctx.alive) {
      sticky.classList.remove('show'); subB.classList.remove('show');
      await ctx.wait(700);
      await fly(ctx, slide, 'rp', { label: 'ON  (retain = true)' });
      flash(ctx, broker, 'on', 400);
      sticky.classList.add('show');
      await fly(ctx, slide, 'ra', { label: 'ON' });
      flash(ctx, $(slide, '.sub-a'), 'on', 400);
      await ctx.wait(1300);
      subB.classList.add('show');
      await ctx.wait(800);
      await fly(ctx, slide, 'rbs', { label: 'SUBSCRIBE', cls: 'violet' });
      await fly(ctx, slide, 'rb', { label: 'ON (retained)', cls: 'warn' });
      flash(ctx, $(slide, '.sub-b .box'), 'on', 500);
      await ctx.wait(2800);
    }
  };

  // ---- Last Will & Testament -----------------------------------------
  SCENES['lwt'] = async (ctx, slide) => {
    const plug = $(slide, '.plug'), esp = $(slide, '.esp-g'), status = $(slide, '.lwt-status');
    const ring = $(slide, '.timer-ring'), ttxt = $(slide, '.timer-text'), broker = $(slide, '.broker-box');
    const C = 2 * Math.PI * 40;
    ring.style.strokeDasharray = C;
    const reset = () => {
      plug.classList.remove('unplugged'); esp.classList.remove('dead');
      status.textContent = '⚪ unknown'; status.setAttribute('class', 'lwt-status');
      ring.style.transition = 'none'; ring.style.strokeDashoffset = 0; ttxt.textContent = '';
    };
    ctx.onStop(reset);
    while (ctx.alive) {
      reset();
      await ctx.wait(600);
      await fly(ctx, slide, 'c1', { label: 'CONNECT (will = "offline")', duration: 1200 });
      flash(ctx, broker, 'on', 400);
      await fly(ctx, slide, 'c1', { label: 'status: online', cls: 'ok' });
      await fly(ctx, slide, 'w1', { label: 'online', cls: 'ok' });
      status.textContent = '🟢 online'; status.setAttribute('class', 'lwt-status ok');
      for (let k = 0; k < 3 && ctx.alive; k++) {
        await fly(ctx, slide, 'c1', { label: 'PINGREQ', cls: 'ok', r: 6, duration: 650 });
        await ctx.wait(450);
      }
      plug.classList.add('unplugged'); esp.classList.add('dead');
      await ctx.wait(500);
      ring.style.transition = 'none'; ring.style.strokeDashoffset = 0; ring.getBoundingClientRect();
      ring.style.transition = 'stroke-dashoffset 3.6s linear'; ring.style.strokeDashoffset = C;
      const start = performance.now();
      ctx.frame((t) => { const s = Math.max(0, 45 - ((t - start) / 3600) * 45); ttxt.textContent = Math.ceil(s) + ' s'; return s > 0; });
      await ctx.wait(3700);
      flash(ctx, broker, 'on', 400);
      await fly(ctx, slide, 'w1', { label: 'offline  (the Will)', cls: 'bad', duration: 1100 });
      status.textContent = '🔴 offline'; status.setAttribute('class', 'lwt-status bad');
      await ctx.wait(3200);
    }
  };

  // ---- Keepalive timeline ---------------------------------------------
  SCENES['keepalive'] = async (ctx, slide) => {
    const cursor = $(slide, '.ka-cursor'), dead = $(slide, '.ka-dead'), fire = $(slide, '.ka-fire');
    const X0 = 100, PX = 9.2, T = 7000, total = 108;
    while (ctx.alive) {
      dead.classList.remove('show'); fire.classList.remove('show');
      cursor.style.transition = 'none'; cursor.style.transform = 'translateX(' + X0 + 'px)'; cursor.getBoundingClientRect();
      await ctx.wait(300);
      cursor.style.transition = 'transform ' + T + 'ms linear';
      cursor.style.transform = 'translateX(' + (X0 + total * PX) + 'px)';
      [0, 30, 60].forEach((s, i) => ctx.after((s / total) * T, () => fly(ctx, slide, 'ka' + i, { duration: 420, r: 7, cls: 'ok', label: 'PINGREQ' })));
      ctx.after((66 / total) * T, () => dead.classList.add('show'));
      ctx.after((105 / total) * T, () => fire.classList.add('show'));
      await ctx.wait(T + 2500);
    }
  };

  // ---- Client ID collision --------------------------------------------
  SCENES['collision'] = async (ctx, slide) => {
    const links = { a: wire(slide, 'la'), b: wire(slide, 'lb') };
    const kick = { a: $(slide, '.kick-a'), b: $(slide, '.kick-b') };
    const counter = $(slide, '.coll-count');
    const broker = $(slide, '.broker-box');
    let cur = 'a', n = 0;
    const setLink = (k, s) => { links[k].classList.remove('active', 'kicked'); if (s) links[k].classList.add(s); };
    ctx.onStop(() => { setLink('a'); setLink('b'); kick.a.classList.remove('show'); kick.b.classList.remove('show'); });
    while (ctx.alive) {
      const other = cur === 'a' ? 'b' : 'a';
      await flowPacket(ctx, links[cur], { label: 'CONNECT id = esp32-01', duration: 1000 });
      flash(ctx, broker, 'on', 400);
      setLink(cur, 'active');
      if (n > 0) {
        setLink(other, 'kicked'); kick[other].classList.add('show');
        await flowPacket(ctx, links[other], { reverse: true, cls: 'bad', label: 'kicked out!', duration: 900 });
      }
      n++; counter.textContent = n;
      await ctx.wait(1100);
      kick[other].classList.remove('show');
      cur = other;
    }
  };

  // ---- Persistent session: the broker keeps the mail -----------------
  SCENES['persistent'] = async (ctx, slide) => {
    const phone = $(slide, '.phone-g'), link = wire(slide, 'bp'), envs = $$(slide, '.env'), label = $(slide, '.ps-state');
    const reset = () => { phone.classList.remove('dead'); link.classList.remove('kicked'); envs.forEach((e) => e.classList.remove('show')); label.textContent = 'online'; };
    ctx.onStop(reset);
    while (ctx.alive) {
      reset();
      await ctx.wait(900);
      phone.classList.add('dead'); link.classList.add('kicked'); label.textContent = 'offline (tunnel 🚇)';
      await ctx.wait(700);
      for (let k = 0; k < 3 && ctx.alive; k++) {
        await fly(ctx, slide, 'pp', { label: 'cmd ' + (k + 1) + ' · QoS 1', duration: 800 });
        envs[k].classList.add('show');
      }
      await ctx.wait(900);
      phone.classList.remove('dead'); link.classList.remove('kicked'); label.textContent = 'back online';
      await fly(ctx, slide, 'bp', { reverse: true, label: 'CONNECT (clean = false)', cls: 'violet', duration: 1000 });
      const burst = [];
      for (let k = 0; k < 3; k++) {
        envs[k].classList.remove('show');
        burst.push(fly(ctx, slide, 'bp', { label: 'cmd ' + (k + 1), cls: 'ok', duration: 800 }));
        await ctx.wait(280);
      }
      await Promise.all(burst);
      flash(ctx, $(slide, '.phone-g .box'), 'on', 600);
      await ctx.wait(2600);
    }
  };

  // ===================================================================
  // PHASE 3-5 SCENES
  // ===================================================================

  // ---- Generic flows: <section data-scene="flows" data-flows="a,b;c" data-every="2600">
  //      each wire may carry data-label, data-cls, data-dur, data-r, data-flash=".selector"
  SCENES['flows'] = (ctx, slide) => {
    const chains = (slide.dataset.flows || '').split(';').map((c) => c.trim()).filter(Boolean).map((c) => c.split(',').map((s) => s.trim()));
    const every = +(slide.dataset.every || 2600);
    const stagger = +(slide.dataset.stagger || 450);
    chains.forEach((chain, i) => ctx.after(i * stagger, () => ctx.every(every, async () => {
      for (const name of chain) {
        const el = wire(slide, name);
        if (!el || !ctx.alive) continue;
        await flowPacket(ctx, el, { duration: +(el.dataset.dur || 900), label: el.dataset.label || null,
          cls: el.dataset.cls || '', r: +(el.dataset.r || 8), reverse: el.dataset.rev === '1' });
        if (el.dataset.flash) $$(slide, el.dataset.flash).forEach((t) => flash(ctx, t, 'on', 450));
      }
    })));
  };

  // ---- Break countdown: <div class="countdown" data-minutes="10">
  SCENES['countdown'] = (ctx, slide) => {
    const box = $(slide, '.countdown');
    const total = +(box.dataset.minutes || 10) * 60;
    const txt = $(box, '.cd-time'), ring = $(box, '.cd-ring');
    const C = 2 * Math.PI * 140;
    ring.style.strokeDasharray = C;
    const start = performance.now();
    const tick = () => {
      const left = Math.max(0, total - Math.floor((performance.now() - start) / 1000));
      txt.textContent = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0');
      ring.style.strokeDashoffset = C * (1 - left / total);
      if (left === 0) box.classList.add('done');
    };
    box.classList.remove('done');
    tick();
    const id = setInterval(() => { if (ctx.alive) tick(); }, 500);
    ctx.onStop(() => clearInterval(id));
  };

  // ---- Typing helper for terminals
  async function typeInto(ctx, el, text, speed = 28) {
    for (let i = 0; i <= text.length && ctx.alive; i++) { el.textContent = text.slice(0, i); await ctx.wait(speed); }
  }
  function termLine(body, cls, text, max = 9) {
    const d = document.createElement('div'); d.className = 'ln ' + (cls || ''); d.textContent = text || '';
    body.appendChild(d); while (body.children.length > max) body.firstChild.remove(); return d;
  }

  // ---- Mosquitto: subscriber terminal + publisher terminal
  SCENES['mosq-term'] = async (ctx, slide) => {
    const [sub, pub] = $$(slide, '.terminal .body');
    sub.innerHTML = ''; pub.innerHTML = '';
    let l = termLine(sub, 't-acc', '');
    await typeInto(ctx, l, '$ mosquitto_sub -h localhost -t "aerobotix/#" -v');
    termLine(sub, 't-mut', '  (waiting for messages…)');
    const msgs = [['aerobotix/demo/led/set', 'ON'], ['aerobotix/demo/telemetry', '{"temp":24.3}'], ['aerobotix/demo/led/set', 'OFF']];
    let i = 0;
    while (ctx.alive) {
      const [t, m] = msgs[i++ % msgs.length];
      const p = termLine(pub, 't-acc', '');
      await typeInto(ctx, p, '$ mosquitto_pub -h localhost -t "' + t + '" -m \'' + m + '\'', 22);
      await ctx.wait(350);
      flash(ctx, $(slide, '.mosq-arrow'), 'on', 600);
      await ctx.wait(400);
      termLine(sub, 't-ok', t + ' ' + m);
      await ctx.wait(1600);
    }
  };

  // ---- Many live lines (audience phones on the projector)
  SCENES['multi-chart'] = (ctx, slide) => {
    const svg = $(slide, 'svg.multi');
    const colors = ['#00b4ff', '#a78bfa', '#22c55e', '#f59e0b', '#f472b6', '#facc15'];
    colors.forEach((c, i) => liveChart(ctx, svg, { min: -40, max: 40, start: (i - 2.5) * 8, interval: 300 + i * 30,
      gen: (v) => v * 0.9 + (Math.random() - 0.5) * 16, color: c }));
  };

  // ---- Mock dashboard: gauges, chart, status lights, command/state switch
  SCENES['dash-mock'] = (ctx, slide) => {
    const chart = $(slide, 'svg.dm-chart');
    if (chart) liveChart(ctx, chart, { min: 18, max: 32, start: 24, interval: 450, gen: (v) => v + (Math.random() - 0.5) * 0.9 });
    $$(slide, '.gauge').forEach((g) => {
      const arc = $(g, '.g-val'), num = $(g, '.g-num');
      const L = arc.getTotalLength(); arc.style.strokeDasharray = L; arc.style.strokeDashoffset = L;
      const min = +g.dataset.min, max = +g.dataset.max; let v = +g.dataset.v;
      const set = () => { arc.style.strokeDashoffset = L * (1 - (v - min) / (max - min)); num.textContent = v.toFixed(1) + (g.dataset.unit || ''); };
      ctx.after(200, set);
      ctx.every(1800, () => { v = clamp(v + (Math.random() - 0.5) * (max - min) * 0.08, min, max); set(); }, false);
    });
    const sw = $(slide, '.dm-switch'), st = $(slide, '.dm-state');
    if (sw) {
      let on = false;
      ctx.every(3400, async () => {
        on = !on;
        sw.classList.toggle('on', on); sw.classList.add('pending');
        st.textContent = 'sent ' + (on ? 'ON' : 'OFF') + '… waiting for device'; st.className = 'dm-state warn';
        await ctx.wait(1100);
        sw.classList.remove('pending');
        st.textContent = 'device confirmed: ' + (on ? 'ON' : 'OFF'); st.className = 'dm-state ok';
      }, false);
    }
  };

  // ---- Supabase: rows sliding into a table
  SCENES['supa-rows'] = (ctx, slide) => {
    const tbody = $(slide, '.supa-table tbody');
    const ticker = $(slide, '.supa-sql');
    tbody.innerHTML = '';
    let id = 1040, temp = 24.1;
    const devices = ['esp32', 'esp32', 'phone-amine', 'esp32', 'phone-sara'];
    ctx.every(1100, () => {
      id++; temp = clamp(temp + (Math.random() - 0.5) * 0.6, 22, 27);
      const dev = devices[id % devices.length];
      const hum = (50 + Math.random() * 10).toFixed(1);
      const now = new Date();
      const ts = now.toISOString().slice(0, 19).replace('T', ' ');
      const tr = document.createElement('tr'); tr.className = 'row-in';
      [id, dev, temp.toFixed(1), hum, ts].forEach((v) => { const td = document.createElement('td'); td.textContent = v; tr.appendChild(td); });
      tbody.prepend(tr);
      while (tbody.children.length > 6) tbody.lastChild.remove();
      if (ticker) ticker.textContent = "INSERT INTO telemetry (device, temp, hum) VALUES ('" + dev + "', " + temp.toFixed(1) + ', ' + hum + ');';
    });
  };

  // ---- Vercel: git push -> build -> deploy -> live URL
  SCENES['vercel'] = async (ctx, slide) => {
    const steps = $$(slide, '.vstep'), bar = $(slide, '.vbar > i'), url = $(slide, '.vurl');
    const reset = () => { steps.forEach((s) => s.classList.remove('active', 'done')); bar.style.transition = 'none'; bar.style.width = '0'; url.classList.remove('show'); };
    ctx.onStop(() => { steps.forEach((s) => s.classList.add('done')); url.classList.add('show'); bar.style.width = '100%'; });
    while (ctx.alive) {
      reset(); bar.getBoundingClientRect(); bar.style.transition = 'width .9s ease';
      await ctx.wait(600);
      for (let i = 0; i < steps.length && ctx.alive; i++) {
        steps[i].classList.add('active');
        bar.style.width = ((i + 1) / steps.length) * 100 + '%';
        await ctx.wait(1100);
        steps[i].classList.remove('active'); steps[i].classList.add('done');
      }
      url.classList.add('show');
      await ctx.wait(3200);
    }
  };

  // ---- Mirai: infected devices counter + spreading dots
  SCENES['mirai'] = (ctx, slide) => {
    const grid = $(slide, '.mirai-grid');
    if (!grid.children.length) for (let i = 0; i < +(grid.dataset.n || 160); i++) grid.appendChild(document.createElement('i'));
    const cells = $$(grid, 'i');
    cells.forEach((c) => c.classList.remove('inf'));
    let k = 0;
    const order = cells.map((_, i) => i).sort(() => Math.random() - 0.5);
    ctx.every(70, () => { if (k < order.length * 0.85) cells[order[k++]].classList.add('inf'); });
  };

  // ---- Raw MQTT traffic from the room (audience section)
  SCENES['raw-mqtt'] = (ctx, slide) => {
    const body = $(slide, '.terminal .body');
    body.innerHTML = '';
    const names = ['amine', 'sara', 'youssef', 'lina', 'omar', 'ines', 'rami'];
    ctx.every(650, () => {
      const n = names[Math.floor(Math.random() * names.length)];
      const r = Math.random();
      let line, cls = '';
      if (r < 0.55) line = 'aerobotix/phone-' + n + '/telemetry  {"tilt":' + (Math.random() * 80 - 40).toFixed(1) + '}';
      else if (r < 0.75) { line = 'aerobotix/esp32/led/set  ' + (Math.random() < 0.5 ? 'ON' : 'TOGGLE'); cls = 't-warn'; }
      else if (r < 0.9) { line = 'aerobotix/phone-' + n + '/status  online'; cls = 't-ok'; }
      else { line = 'aerobotix/phone-' + n + '/status  offline   ← Last Will'; cls = 't-acc'; }
      termLine(body, cls, line, 13);
    });
  };

  // ===================================================================
  // LIFECYCLE
  // ===================================================================
  let ctx = null;

  function runScene(name, root, trigger) {
    const fn = SCENES[name];
    if (!fn) { console.warn('[anim] unknown scene:', name); return; }
    try { const r = fn(ctx, root, trigger); if (r && r.catch) r.catch((e) => console.error(e)); }
    catch (e) { console.error('[anim] scene failed:', name, e); }
  }

  function enter(slide) {
    if (!slide) return;
    if (ctx) ctx.stop();
    ctx = new Ctx(slide);
    slide.querySelectorAll('.journey').forEach((j) => journeyBar(ctx, j));
    drawWires(ctx, slide);
    slide.querySelectorAll('[data-count]').forEach((el) => { if (!el.closest('.fragment')) countUp(ctx, el); });
    (slide.dataset.scene || '').split(/\s+/).filter(Boolean).forEach((n) => runScene(n, slide));
  }

  function onFragment(e) {
    if (!ctx) return;
    const frags = e.fragments && e.fragments.length ? e.fragments : [e.fragment];
    frags.forEach((f) => {
      if (!f) return;
      drawWires(ctx, f);
      if (f.dataset.count) countUp(ctx, f);
      f.querySelectorAll('[data-count]').forEach((el) => countUp(ctx, el));
      if (f.dataset.scene) f.dataset.scene.split(/\s+/).forEach((n) => runScene(n, ctx.slide, f));
    });
  }

  // prepare(): build generated markup BEFORE Reveal.initialize (so reveal sees generated fragments)
  function prepare() {
    document.querySelectorAll('.seq').forEach(buildSeq);
    renderIcons(document);
    renderQRs();
    document.querySelectorAll('.journey').forEach(buildJourney);
  }

  function init(Reveal) {
    const logo = document.querySelector('.corner-logo');
    if (logo) {
      const img = logo.querySelector('img');
      if (img) { img.addEventListener('error', () => logo.classList.add('no-img')); if (img.complete && !img.naturalWidth) logo.classList.add('no-img'); }
    }
    document.querySelectorAll('img.logo-main').forEach((img) => {
      const fallback = () => { img.style.display = 'none'; const n = img.nextElementSibling; if (n) n.style.display = 'block'; };
      img.addEventListener('error', fallback);
      if (img.complete && !img.naturalWidth) fallback();
    });
    // init() is called after Reveal.initialize() resolves -> start the current slide now
    Reveal.on('slidechanged', (e) => enter(e.currentSlide));
    Reveal.on('fragmentshown', onFragment);
    Reveal.on('overviewshown', () => { if (ctx) ctx.stop(); });
    Reveal.on('overviewhidden', () => enter(Reveal.getCurrentSlide()));
    enter(Reveal.getCurrentSlide());
  }

  window.IoTAnim = { CONFIG, ICONS, SCENES, prepare, init, buildSeq, mqttMatch, flowPacket, drawWires, countUp, liveChart, journeyBar, ease, REDUCED };
})();
