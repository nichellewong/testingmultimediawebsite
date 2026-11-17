// Scroll video: map scroll progress through the section onto the video time
// (or onto a sequence of extracted frames drawn on a canvas).
document.querySelectorAll('[data-embed="scrollvideo"]').forEach((section) => {
  const config = JSON.parse(section.dataset.config);
  const video = section.querySelector('video');
  const canvas = section.querySelector('canvas');
  const frames = [];
  let ctx2d = null;
  let duration = 0;
  let lastIndex = -1;
  let active = false;
  let ticking = false;

  function progress() {
    const rect = section.getBoundingClientRect();
    const total = section.offsetHeight - window.innerHeight;
    return total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
  }

  function draw(p, force) {
    if (!ctx2d || !frames.length) return;
    const idx = Math.min(frames.length - 1, Math.round(p * (frames.length - 1)));
    if (idx === lastIndex && !force) return;
    const img = frames[idx];
    if (!img.complete || !img.naturalWidth) return;
    lastIndex = idx;
    const cw = canvas.width, ch = canvas.height;
    const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx2d.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  }

  function update() {
    ticking = false;
    const p = progress();
    if (video) {
      if (!duration) return;
      const t = p * duration;
      if (Math.abs(video.currentTime - t) > 0.03) video.currentTime = t;
    } else {
      draw(p);
    }
  }

  function onScroll() {
    if (!active || ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  function sizeCanvas() {
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    draw(progress(), true);
  }

  if (video) {
    video.pause();
    const ready = () => { duration = video.duration || 0; update(); };
    if (video.readyState >= 1) ready();
    video.addEventListener('loadedmetadata', ready);
  } else if (canvas && config.frames) {
    ctx2d = canvas.getContext('2d');
    const pad = (n) => String(n).padStart(config.frames.pad, '0');
    for (let i = 1; i <= config.frames.count; i++) {
      const img = new Image();
      img.decoding = 'async';
      img.src = config.frames.base + '/' + pad(i) + '.' + config.frames.ext;
      if (i === 1) img.onload = () => draw(progress(), true);
      frames.push(img);
    }
  }

  new IntersectionObserver(([e]) => {
    active = e.isIntersecting;
    if (active) {
      if (video && video.readyState < 1) video.load();
      update();
    }
  }, { rootMargin: '200px 0px' }).observe(section);

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { sizeCanvas(); onScroll(); });
  sizeCanvas();
});
