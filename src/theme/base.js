// Opener: hide the scroll hint once the reader starts scrolling, and respect
// "reduce motion" for background video.
(function () {
  const opener = document.querySelector('.opener');
  if (!opener) return;
  const onScroll = () => opener.classList.toggle('is-scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const video = opener.querySelector('video');
  if (video && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    video.pause();
    video.removeAttribute('autoplay');
  }

  // Sound for the background video: starts muted (browsers require it),
  // the button unmutes. Fades out when the opener scrolls away unless
  // fade_sound_after_scroll is off.
  const audioBtn = opener.querySelector('.opener__audio');
  if (video && audioBtn) {
    const labelOn = audioBtn.dataset.labelOn || 'Mute';
    const labelOff = audioBtn.dataset.labelOff || 'Click for audio';
    const fadeOnScroll = audioBtn.dataset.fade !== 'false';
    const label = audioBtn.querySelector('.opener__audio-label');
    let on = false;
    let fading = null;
    const fadeTo = (target) => {
      cancelAnimationFrame(fading);
      const start = video.volume, t0 = performance.now(), ms = 900;
      const step = (now) => {
        const p = Math.min(1, (now - t0) / ms);
        video.volume = start + (target - start) * p;
        if (p < 1) fading = requestAnimationFrame(step);
      };
      fading = requestAnimationFrame(step);
    };
    audioBtn.addEventListener('click', () => {
      on = !on;
      audioBtn.setAttribute('aria-pressed', String(on));
      label.textContent = on ? labelOn : labelOff;
      if (on) {
        video.muted = false;
        video.volume = 1;
        video.play().catch(() => {});
      } else {
        video.muted = true;
      }
    });
    if (fadeOnScroll) {
      new IntersectionObserver(([e]) => {
        if (!on) return;
        fadeTo(e.isIntersecting ? 1 : 0);
      }, { threshold: 0.15 }).observe(opener);
    }
  }
})();
