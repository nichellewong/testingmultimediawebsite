// TimelineJS: build each timeline from its data-config.
document.querySelectorAll('[data-embed="timeline"]').forEach((el) => {
  if (typeof TL === 'undefined') return;
  const config = JSON.parse(el.dataset.config);
  new TL.Timeline(el.id, config.source, config.options);
});
