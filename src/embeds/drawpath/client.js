// Draw path: the stroke's dash offset follows the scroll position through the
// sticky section, so the line draws itself (or un-draws when scrolling up).
document.querySelectorAll('[data-embed="drawpath"]').forEach((section) => {
  const config = JSON.parse(section.dataset.config);
  const svg = section.querySelector('svg');
  if (!svg) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Every stroked shape, except those inside <defs>, clip paths or masks.
  const shapes = [...svg.querySelectorAll('path, polyline, line, polygon, circle, ellipse, rect')]
    .filter((el) => !el.closest('defs, clipPath, mask, pattern, marker'))
    .filter((el) => {
      const stroke = getComputedStyle(el).stroke;
      return stroke && stroke !== 'none' && typeof el.getTotalLength === 'function';
    })
    .map((el) => {
      let length = 0;
      try { length = el.getTotalLength(); } catch (e) { length = 0; }
      return { el, length };
    })
    .filter((s) => s.length > 0);
  if (!shapes.length) return;

  const sign = config.reverse ? -1 : 1;
  shapes.forEach((s) => {
    s.el.style.strokeDasharray = `${s.length} ${s.length}`;
    s.el.style.strokeDashoffset = `${sign * s.length}`;
    s.el.style.strokeLinecap = s.el.style.strokeLinecap || 'round';
    if (config.dot) {
      const stroke = getComputedStyle(s.el);
      const width = parseFloat(stroke.strokeWidth) || 4;
      const r = config.dotSize > 0 ? config.dotSize / 2 : width * 1.4;
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('r', r);
      dot.setAttribute('fill', config.dotColor || stroke.stroke);
      dot.setAttribute('stroke', '#ffffff');
      dot.setAttribute('stroke-width', Math.max(1, r * 0.4));
      dot.style.opacity = '0';
      dot.style.pointerEvents = 'none';
      s.el.parentNode.appendChild(dot);
      s.dot = dot;
    }
  });

  function apply(progress) {
    const d = config.deadzone;
    const q = Math.min(1, Math.max(0, (progress - d) / (1 - 2 * d)));
    shapes.forEach((s, i) => {
      const qi = config.sequence ? Math.min(1, Math.max(0, q * shapes.length - i)) : q;
      s.el.style.strokeDashoffset = `${sign * s.length * (1 - qi)}`;
      if (s.dot) {
        const at = config.reverse ? s.length * (1 - qi) : s.length * qi;
        const p = s.el.getPointAtLength(at);
        s.dot.setAttribute('cx', p.x);
        s.dot.setAttribute('cy', p.y);
        s.dot.style.opacity = qi > 0 ? '1' : '0';
      }
    });
  }

  if (reduceMotion) {
    apply(1);
    return;
  }

  let active = false;
  let ticking = false;
  function progress() {
    const rect = section.getBoundingClientRect();
    const total = section.offsetHeight - window.innerHeight;
    return total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 1;
  }
  function update() {
    ticking = false;
    apply(progress());
  }
  function onScroll() {
    if (!active || ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }
  new IntersectionObserver(([e]) => {
    active = e.isIntersecting;
    if (active) update();
  }, { rootMargin: '200px 0px' }).observe(section);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
});
