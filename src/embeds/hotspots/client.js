// Hotspots: hover/focus shows the info window; click opens the pop-up.
// On touch screens the first tap shows the info window and the second opens
// the pop-up.
document.querySelectorAll('[data-embed="hotspots"]').forEach((root) => {
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const spots = [...root.querySelectorAll('.hotspot')];
  const controls = new Map();
  let openSpot = null;

  spots.forEach((btn) => {
    const tpl = btn.dataset.info ? document.getElementById(btn.dataset.info) : null;
    const modalEl = btn.dataset.modal ? document.querySelector(btn.dataset.modal) : null;
    const popover = tpl && window.bootstrap
      ? new bootstrap.Popover(btn, { html: true, sanitize: false, content: tpl.innerHTML, trigger: 'manual', placement: 'auto', customClass: 'hotspot-popover', container: 'body', fallbackPlacements: ['top', 'bottom', 'left', 'right'] })
      : null;

    const hide = () => {
      if (popover) popover.hide();
      btn.classList.remove('is-open');
      if (openSpot === btn) openSpot = null;
    };
    const show = () => {
      btn.classList.remove('hotspot--pulse');
      if (!popover) return;
      if (openSpot && openSpot !== btn) controls.get(openSpot).hide();
      popover.show();
      btn.classList.add('is-open');
      openSpot = btn;
    };
    const openDetail = () => {
      hide();
      btn.classList.remove('hotspot--pulse');
      if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show();
    };
    controls.set(btn, { hide, show, openDetail });

    btn.addEventListener('mouseenter', () => { if (canHover) show(); });
    btn.addEventListener('mouseleave', () => { if (canHover) hide(); });
    btn.addEventListener('focus', () => { if (btn.matches(':focus-visible')) show(); });
    btn.addEventListener('blur', () => { if (canHover) hide(); });
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (modalEl && (canHover || btn.classList.contains('is-open') || !popover)) openDetail();
      else if (btn.classList.contains('is-open')) hide();
      else show();
    });
  });

  document.addEventListener('click', (e) => {
    if (openSpot && !openSpot.contains(e.target) && !e.target.closest('.hotspot-popover')) controls.get(openSpot).hide();
  });

  const legend = root.parentElement && root.parentElement.querySelector('.hotspots__legend');
  if (legend) {
    legend.querySelectorAll('.hotspots__legend-item').forEach((item) => {
      item.addEventListener('click', () => {
        const spot = spots[Number(item.dataset.target)];
        if (!spot) return;
        const c = controls.get(spot);
        spot.scrollIntoView({ block: 'center', behavior: 'smooth' });
        if (spot.dataset.modal) c.openDetail();
        else c.show();
      });
    });
  }
});
