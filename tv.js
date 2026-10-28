// Drives the full-width TV from page scroll, so there is one scroll on every device:
//   1. watch: the TV holds still and the website scrolls inside the screen;
//   2. deck: at the end, the set slides up to show the DVD deck under the screen.
(() => {
  const track = document.getElementById('tv-track');
  const tv = document.getElementById('tv');
  const screen = document.getElementById('tv-screen');
  const content = document.getElementById('site-shell');
  let m = null;

  function measure() {
    const vh = window.innerHeight;
    const tvH = tv.offsetHeight;
    const scrH = screen.offsetHeight;
    // Centre the whole set if it fits, otherwise centre the screen and let the bezel crop.
    const pin = tvH <= vh ? (vh - tvH) / 2 : Math.min(0, Math.max(vh - tvH, (vh - scrH) / 2 - screen.offsetTop));
    const range = Math.max(0, screen.scrollHeight - scrH);
    const deck = Math.max(0, pin + tvH + vh * 0.04 - vh);
    m = { pin, range, deck };
    track.style.height = `${range + deck + vh}px`;
    update();
  }

  function update() {
    if (!m) return;
    const y = Math.max(0, window.scrollY);
    const top = m.pin - Math.min(m.deck, Math.max(0, y - m.range));
    screen.scrollTop = Math.min(m.range, y);
    tv.style.transform = `translateY(${top}px)`;
    document.documentElement.classList.toggle('tv-scrolled', y > 40);
  }

  // Find-in-page can scroll the screen on its own; move the page to match.
  screen.addEventListener('scroll', () => {
    if (m && Math.abs(screen.scrollTop - Math.min(m.range, window.scrollY)) > 1) window.scrollTo(0, screen.scrollTop);
  });

  // Tabbing to a link: bring it to the middle of the screen.
  screen.addEventListener('focusin', e => requestAnimationFrame(() => {
    if (!m) return;
    const sr = screen.getBoundingClientRect();
    const er = e.target.getBoundingClientRect();
    const target = screen.scrollTop + er.top - sr.top + (er.height - sr.height) / 2;
    window.scrollTo(0, Math.min(m.range, Math.max(0, Math.round(target))));
  }));

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', measure);
  window.addEventListener('hashchange', () => window.scrollTo(0, 0));
  new ResizeObserver(measure).observe(content);
  document.documentElement.classList.add('tv-js');
  measure();
})();
