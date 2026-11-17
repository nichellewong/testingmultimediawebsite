// Slideshow: start the carousel with its options and keep the caption and
// counter below it in step with the current slide.
document.querySelectorAll('[data-embed="slideshow"]').forEach((el) => {
  if (!window.bootstrap) return;
  const config = JSON.parse(el.dataset.config);
  const carousel = new bootstrap.Carousel(el, {
    interval: config.autoplay ? config.interval : false,
    ride: config.autoplay ? 'carousel' : false,
    pause: config.pause ? 'hover' : false,
    wrap: config.wrap,
    keyboard: true,
    touch: true,
  });
  if (!config.autoplay) carousel.pause();
  const caps = el.parentElement.querySelectorAll('.slideshow__cap');
  const counter = el.querySelector('.slideshow__counter-now');
  el.addEventListener('slid.bs.carousel', (e) => {
    caps.forEach((c) => c.classList.toggle('is-active', Number(c.dataset.slide) === e.to));
    if (counter) counter.textContent = e.to + 1;
  });
});
