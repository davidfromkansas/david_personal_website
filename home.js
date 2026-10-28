// Home screen: five tiles select a section. Each section has a shareable #hash, works with
// back/forward, and swaps the background scene, hero copy and detailed content together.
(() => {
  const SECTIONS = ['home', 'work', 'writing', 'press', 'fun'];
  const TITLES = { home: 'David Lie-Tjauw', work: 'Work', writing: 'Writing', press: 'Press', fun: 'Fun' };
  const root = document.documentElement;
  const tiles = [...document.querySelectorAll('.tile')];
  const scenes = [...document.querySelectorAll('.scene')];
  const panels = [...document.querySelectorAll('.panel')];
  const details = [...document.querySelectorAll('.detail')];
  const content = document.getElementById('content');
  let current = null;

  const fromHash = () => {
    const name = location.hash.slice(1);
    return SECTIONS.includes(name) ? name : null;
  };

  function select(name) {
    if (name === current) return;
    current = name;
    root.dataset.section = name;
    for (const t of tiles) {
      const on = t.dataset.section === name;
      if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    }
    for (const s of scenes) s.classList.toggle('is-active', s.dataset.scene === name);
    for (const p of panels) {
      const on = p.dataset.panel === name;
      p.classList.toggle('is-active', on);
      p.inert = !on;
    }
    for (const d of details) d.hidden = d.dataset.detail !== name;
    document.title = name === 'home' ? TITLES.home : `${TITLES[name]} · ${TITLES.home}`;
    if (name === 'writing') loadWriting();
  }

  // Clicks follow the tile's #hash link; hashchange covers clicks, back and forward alike.
  window.addEventListener('hashchange', () => {
    const name = fromHash();
    if (name) select(name);
  });

  // Roving focus: Tab lands on one tile, arrows move between them, Enter or Space selects.
  const setRoving = (tile) => tiles.forEach(t => (t.tabIndex = t === tile ? 0 : -1));
  tiles.forEach((tile, i) => {
    tile.addEventListener('focus', () => setRoving(tile));
    tile.addEventListener('keydown', (e) => {
      let next = null;
      if (e.key === 'ArrowRight') next = tiles[Math.min(i + 1, tiles.length - 1)];
      else if (e.key === 'ArrowLeft') next = tiles[Math.max(i - 1, 0)];
      else if (e.key === 'Home') next = tiles[0];
      else if (e.key === 'End') next = tiles[tiles.length - 1];
      else if (e.key === ' ') { e.preventDefault(); tile.click(); return; }
      if (next) {
        e.preventDefault();
        next.focus();
        next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    });
  });

  // Primary action: move into the section's detailed content below the hero.
  const motion = matchMedia('(prefers-reduced-motion: no-preference)');
  document.querySelectorAll('.action').forEach(btn => btn.addEventListener('click', () => {
    const heading = document.querySelector(`.detail[data-detail="${btn.dataset.go}"] .detail-title`);
    content.scrollIntoView({ behavior: motion.matches ? 'smooth' : 'auto', block: 'start' });
    heading?.focus({ preventScroll: true });
  }));
  document.querySelector('.to-top')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: motion.matches ? 'smooth' : 'auto' });
    tiles.find(t => t.tabIndex === 0)?.focus({ preventScroll: true });
  });

  // Hint that the tile row scrolls when it doesn't fit.
  const row = document.getElementById('tiles');
  const wrap = row.parentElement;
  const hint = () => wrap.classList.toggle('can-scroll', row.scrollLeft + row.clientWidth < row.scrollWidth - 4);
  row.addEventListener('scroll', hint, { passive: true });

  // ---- Home scene: cover-fit the desk render and map the TV screensaver onto its glass ----
  // Measured from the renders by scripts/build_scene.py (0..1 of the image).
  const HOME = /* SCENES */ {"home":{"src":"art/home.webp","mask":"art/home-mask.png","width":960,"height":540,"screen":[[0.55228,0.34328],[0.68258,0.32723],[0.68296,0.5256],[0.55586,0.56292]]},"phone":{"src":"art/home-phone.webp","mask":"art/home-phone-mask.png","width":540,"height":960,"screen":[[0.26076,0.36082],[0.52133,0.34996],[0.5205,0.46912],[0.27118,0.49343]]}};
  const hero = document.querySelector('.hero');
  const stage = document.getElementById('home-stage');
  const img = document.getElementById('home-img');
  const glass = document.getElementById('tv-glass');
  const screen = document.getElementById('tv-screen');
  let homeScene = null;

  // CSS matrix3d that maps a w×h box onto the quad q = [tl, tr, br, bl].
  function quadTransform(w, h, q) {
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
    const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
    const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
    const den = dx1 * dy2 - dx2 * dy1;
    const g = (dx3 * dy2 - dx2 * dy3) / den;
    const k = (dx1 * dy3 - dx3 * dy1) / den;
    const a = x1 - x0 + g * x1, b = x3 - x0 + k * x3;
    const d = y1 - y0 + g * y1, e = y3 - y0 + k * y3;
    return `matrix3d(${[a / w, d / w, 0, g / w, b / h, e / h, 0, k / h, 0, 0, 1, 0, x0, y0, 0, 1].join(',')})`;
  }

  function layoutHome() {
    const box = stage.parentElement;                 // the drifting layer, a touch larger than the hero
    const vw = box.clientWidth, vh = box.clientHeight;
    const next = HOME[hero.clientWidth / hero.clientHeight < 0.9 ? 'phone' : 'home'];
    if (next !== homeScene) {
      homeScene = next;
      img.src = next.src;
      glass.style.setProperty('--mask', `url(${next.mask})`);
    }
    // Cover: centred on desktop; on phones keep the TV in view.
    const s = Math.max(vw / next.width, vh / next.height);
    const w = next.width * s, h = next.height * s;
    const fx = next === HOME.home ? 0.62 : 0.5;
    const left = Math.min(0, Math.max(vw - w, vw * 0.5 - w * fx));
    Object.assign(stage.style, { width: `${w}px`, height: `${h}px`, left: `${left}px`, top: `${(vh - h) / 2}px` });
    screen.style.transform = quadTransform(1080, 818, next.screen.map(([x, y]) => [x * w, y * h]));
  }

  function layout() {
    layoutHome();
    hint();
  }
  new ResizeObserver(layout).observe(hero);
  layout();

  // ---- Writing list, from data/writing.json (see WRITING.md) ----
  let writingLoaded = false;
  const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  async function loadWriting() {
    if (writingLoaded) return;
    writingLoaded = true;
    const list = document.getElementById('writing-list');
    const status = document.getElementById('writing-status');
    try {
      const res = await fetch('data/writing.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('unavailable');
      const data = await res.json();
      const articles = (data.articles || []).filter(a => {
        try { return new URL(a.url).hostname === 'davidfromkansas.substack.com' && typeof a.title === 'string' && Number.isFinite(Date.parse(a.publishedAt)); } catch { return false; }
      }).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
      list.replaceChildren(...articles.map(a => {
        const li = document.createElement('li');
        li.className = 'essay';
        const link = document.createElement('a');
        link.href = a.url;
        link.target = '_blank';
        link.rel = 'noopener';
        const time = document.createElement('time');
        time.dateTime = a.publishedAt;
        time.textContent = dateFormat.format(new Date(a.publishedAt));
        const title = document.createElement('h3');
        title.textContent = a.title;
        const excerpt = document.createElement('p');
        excerpt.textContent = [a.description, a.readingMinutes ? `${a.readingMinutes} min read` : ''].filter(Boolean).join(' · ');
        link.append(time, title, excerpt);
        li.append(link);
        return li;
      }));
      status.textContent = articles.length ? '' : 'No essays published yet.';
      status.hidden = articles.length > 0;
    } catch {
      writingLoaded = false;
      status.textContent = 'Couldn’t load the list right now. Everything is on Substack.';
    }
  }

  select(fromHash() || 'home');
  setRoving(tiles.find(t => t.dataset.section === current));
})();
