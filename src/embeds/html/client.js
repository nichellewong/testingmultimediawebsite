// lock_scroll: a click (or tap) hands the mouse to the frame; leaving it, or
// tapping elsewhere, locks it again so page scrolling works over it.
document.querySelectorAll('.story-embed--lock').forEach((fig) => {
  const media = fig.querySelector('.story-embed__media');
  media.addEventListener('click', () => fig.classList.add('is-active'));
  fig.addEventListener('mouseleave', () => fig.classList.remove('is-active'));
  document.addEventListener('touchstart', (e) => { if (!fig.contains(e.target)) fig.classList.remove('is-active'); }, { passive: true });
});
