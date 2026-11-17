// Modal: start media on open, stop it on close.
document.querySelectorAll('[data-embed="modal"]').forEach((modal) => {
  const video = modal.querySelector('video, audio');
  const iframes = modal.querySelectorAll('iframe[data-src]');

  modal.addEventListener('shown.bs.modal', () => {
    iframes.forEach((f) => { if (!f.getAttribute('src')) f.setAttribute('src', f.dataset.src); });
    if (video && video.dataset.autoplay !== 'false') {
      video.currentTime = 0;
      video.play().catch(() => {});
    }
  });

  modal.addEventListener('hide.bs.modal', () => {
    if (video) { video.pause(); video.currentTime = 0; }
    // Removing the src is the only reliable way to stop a YouTube/Vimeo iframe.
    iframes.forEach((f) => f.removeAttribute('src'));
    if (document.activeElement && modal.contains(document.activeElement)) document.activeElement.blur();
  });
});
