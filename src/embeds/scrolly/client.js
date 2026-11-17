// Scrolly: swap the sticky background as each step reaches the middle of the screen.
document.querySelectorAll('[data-embed="scrolly"]').forEach((section) => {
  const bgs = [...section.querySelectorAll('.scrolly__bg')];
  const steps = [...section.querySelectorAll('.scrolly__step')];
  let current = -1;

  function activate(i) {
    if (i === current || !bgs[i]) return;
    current = i;
    bgs.forEach((bg, n) => {
      const on = n === i;
      bg.classList.toggle('is-active', on);
      const v = bg.querySelector('video');
      if (v) on ? v.play().catch(() => {}) : v.pause();
    });
  }

  const stepWatcher = new IntersectionObserver(
    (entries) => entries.forEach((e) => { if (e.isIntersecting) activate(Number(e.target.dataset.bg)); }),
    { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
  );
  steps.forEach((s) => stepWatcher.observe(s));

  // Pause background videos while the whole section is off screen.
  new IntersectionObserver(([e]) => {
    const v = bgs[current]?.querySelector('video');
    if (!v) return;
    e.isIntersecting ? v.play().catch(() => {}) : v.pause();
  }).observe(section);

  activate(0);
});
