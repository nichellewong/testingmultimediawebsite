// StoryMapJS: load the JSON, then build the map.
document.querySelectorAll('[data-embed="storymap"]').forEach(async (el) => {
  if (typeof KLStoryMap === 'undefined') return;
  const config = JSON.parse(el.dataset.config);
  try {
    const res = await fetch(config.source);
    if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
    const data = await res.json();
    const map = new KLStoryMap.StoryMap(el.id, data, config.options);
    window.addEventListener('resize', () => map.updateDisplay());
  } catch (err) {
    el.innerHTML = '<p class="story-error">Could not load the storymap data (' + err.message + ').</p>';
  }
});
