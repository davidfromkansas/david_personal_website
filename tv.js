// Drives the TV from page scroll, so there is one scroll on every device:
//   1. zoom: on screens too short for the whole set, start with the full TV in view
//      and push in until it fills the width;
//   2. read: the TV holds still and the website scrolls inside the screen;
//   3. deck: the set slides up to show the DVD deck under the screen.
(() => {
  const track = document.getElementById('tv-track');
  const tv = document.getElementById('tv');
  const screen = document.getElementById('tv-screen');
  const content = document.getElementById('site-shell');
  const motion = window.matchMedia('(prefers-reduced-motion: no-preference)');
  let m = null;

  function measure() {
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const tvH = tv.offsetHeight;
    const scrTop = screen.offsetTop;
    const scrH = screen.offsetHeight;
    const fits = tvH <= vh;
    // Where the full-width TV rests while reading: centred if it fits, else the screen centred.
    const pin = fits ? (vh - tvH) / 2 : Math.min(0, Math.max(vh - tvH, (vh - scrH) / 2 - scrTop));
    const s0 = fits ? 1 : Math.max(0.3, (vh * 0.86) / tvH);
    const zoom = fits || !motion.matches ? 0 : Math.round(vh * 0.7);
    const range = Math.max(0, screen.scrollHeight - scrH);
    const deck = Math.max(0, pin + tvH + vh * 0.04 - vh);
    m = { vw, vh, tvH, pin, s0: zoom ? s0 : 1, zoom, range, deck };
    track.style.height = `${zoom + range + deck + vh}px`;
    update();
  }

  const ease = t => 1 - Math.pow(1 - t, 3);

  function update() {
    if (!m) return;
    const y = Math.max(0, window.scrollY);
    let s = 1, top = m.pin;
    if (y < m.zoom) {
      const t = ease(y / m.zoom);
      s = m.s0 + (1 - m.s0) * t;
      const top0 = (m.vh - m.s0 * m.tvH) / 2;
      top = top0 + (m.pin - top0) * t;
    } else if (y > m.zoom + m.range) {
      top = m.pin - Math.min(m.deck, y - m.zoom - m.range);
    }
    screen.scrollTop = Math.min(m.range, Math.max(0, y - m.zoom));
    tv.style.transform = `translate(${(m.vw * (1 - s)) / 2}px, ${top}px) scale(${s})`;
    document.documentElement.classList.toggle('tv-scrolled', y > 40);
  }

  const expected = () => Math.min(m.range, Math.max(0, window.scrollY - m.zoom));

  // Find-in-page can scroll the screen on its own; move the page to match.
  screen.addEventListener('scroll', () => {
    if (m && Math.abs(screen.scrollTop - expected()) > 1) window.scrollTo(0, m.zoom + screen.scrollTop);
  });

  // Tabbing to a link: bring it to the middle of the screen.
  screen.addEventListener('focusin', e => requestAnimationFrame(() => {
    if (!m) return;
    const sr = screen.getBoundingClientRect();
    const er = e.target.getBoundingClientRect();
    const scale = sr.width / screen.offsetWidth;
    const target = screen.scrollTop + (er.top - sr.top + (er.height - sr.height) / 2) / scale;
    window.scrollTo(0, m.zoom + Math.min(m.range, Math.max(0, Math.round(target))));
  }));

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', measure);
  motion.addEventListener('change', measure);
  window.addEventListener('hashchange', () => window.scrollTo(0, m ? m.zoom : 0));
  new ResizeObserver(measure).observe(content);
  document.documentElement.classList.add('tv-js');
  measure();
})();
