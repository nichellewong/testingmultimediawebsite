// JuxtaposeJS: build each slider from its data-config.
document.querySelectorAll('[data-embed="juxtapose"]').forEach((el) => {
  if (typeof juxtapose === 'undefined') return;
  const config = JSON.parse(el.dataset.config);
  new juxtapose.JXSlider('#' + el.id, config.images, config.options);
});
