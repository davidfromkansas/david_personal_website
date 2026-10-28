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

  // ---- Interface sounds: soft console-style ticks and chimes, synthesized (no audio files).
  // They only play in response to the visitor's own input, and the speaker button mutes them.
  const sound = (() => {
    const toggle = document.getElementById('sound-toggle');
    let on = true;
    try { on = localStorage.getItem('sound') !== 'off'; } catch {}
    let ctx = null;
    const show = () => toggle.setAttribute('aria-pressed', String(on));
    show();
    toggle.addEventListener('click', () => {
      on = !on;
      try { localStorage.setItem('sound', on ? 'on' : 'off'); } catch {}
      show();
      if (on) play('confirm');
    });
    // One voice: a sine that glides from f0 to f1 with a quick attack and an exponential tail.
    function tone(at, f0, f1, dur, peak, type = 'sine') {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f0, at);
      osc.frequency.exponentialRampToValueAtTime(f1, at + dur);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(peak, at + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + dur + 0.02);
    }
    const SOUNDS = {
      tick: (t) => { tone(t, 2400, 1700, 0.035, 0.035); },                       // moving focus
      move: (t) => { tone(t, 1480, 1240, 0.07, 0.05); tone(t, 2960, 2480, 0.05, 0.012); }, // changing section
      confirm: (t) => { tone(t, 660, 660, 0.16, 0.05); tone(t + 0.05, 990, 990, 0.22, 0.045); tone(t + 0.05, 1980, 1980, 0.12, 0.008, 'triangle'); },
    };
    function play(name) {
      if (!on) return;
      try {
        ctx ??= new AudioContext();
        if (ctx.state === 'suspended') ctx.resume();
        SOUNDS[name](ctx.currentTime + 0.005);
      } catch {}
    }
    return { play };
  })();

  function select(name) {
    if (name === current) return;
    if (current) sound.play('move');
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

  // Roving focus: Tab lands on the selected tile; Enter or Space selects the focused one.
  const setRoving = (tile) => tiles.forEach(t => (t.tabIndex = t === tile ? 0 : -1));
  tiles.forEach((tile) => {
    tile.addEventListener('focus', () => setRoving(tile));
    tile.addEventListener('keydown', (e) => {
      if (e.key === ' ') { e.preventDefault(); tile.click(); }
    });
  });

  const motion = matchMedia('(prefers-reduced-motion: no-preference)');
  const behavior = () => (motion.matches ? 'smooth' : 'auto');

  // Step to the previous or next section, like moving along a console's row. Arrow keys and swipes
  // replace the history entry so browsing the row doesn't fill up the back button.
  function step(delta, { focus }) {
    const i = SECTIONS.indexOf(current) + delta;
    if (i < 0 || i >= SECTIONS.length) return;
    const name = SECTIONS[i];
    history.replaceState(null, '', `#${name}`);
    select(name);
    const tile = tiles[i];
    setRoving(tile);
    if (focus) tile.focus({ preventScroll: true });
    tile.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: behavior() });
  }

  // Up and down jump between the things you can select (the tile row, the section's button, then
  // its links and cards) instead of scrolling a little at a time.
  const FOCUSABLE = 'a[href], button, [tabindex="0"]';
  function stops() {
    return [...document.querySelectorAll(FOCUSABLE)].filter(el =>
      el.tabIndex >= 0 && !el.classList.contains('skip-link') &&
      !el.closest('[hidden], [inert]') && el.getClientRects().length);
  }
  function move(delta) {
    const list = stops();
    const active = document.activeElement;
    let i = list.indexOf(active);
    if (i < 0) {
      // Nothing selectable has focus (the page itself, or a heading the button moved to):
      // continue from where that element sits in the page.
      const after = active && active !== document.body
        ? list.findIndex(el => active.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
        : 1;
      i = after < 0 ? list.length : after;
      if (delta > 0) i -= 1;
    }
    const next = list[Math.max(0, Math.min(list.length - 1, i + delta))];
    if (!next || next === active) return;
    next.focus({ preventScroll: true });
    sound.play('tick');
    if (next.closest('.hero')) window.scrollTo({ top: 0, behavior: behavior() });
    else next.scrollIntoView({ block: 'center', behavior: behavior() });
  }

  const KEYS = {
    ArrowLeft: () => step(-1, { focus: true }), a: () => step(-1, { focus: true }),
    ArrowRight: () => step(1, { focus: true }), d: () => step(1, { focus: true }),
    ArrowUp: () => move(-1), w: () => move(-1),
    ArrowDown: () => move(1), s: () => move(1),
  };
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.closest('input, textarea, select, [contenteditable]')) return;
    const fn = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (!fn) return;
    e.preventDefault();
    fn();
  });

  // Phones: swipe left or right across the hero to change section. A swipe that starts on the
  // tile row is left alone when that row scrolls sideways itself.
  const heroEl = document.querySelector('.hero');
  let touch = null;
  heroEl.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    const row = document.getElementById('tiles');
    const rowScrolls = row.scrollWidth > row.clientWidth + 4;
    touch = e.touches.length === 1 && !(rowScrolls && e.target.closest('#tiles'))
      ? { x: t.clientX, y: t.clientY, at: e.timeStamp } : null;
  }, { passive: true });
  heroEl.addEventListener('touchend', (e) => {
    if (!touch) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.x, dy = t.clientY - touch.y;
    const quick = e.timeStamp - touch.at < 700;
    touch = null;
    if (quick && Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1, { focus: false });
  }, { passive: true });

  // Buttons and links (other than the tiles, which make the section sound, and the speaker) chime.
  document.addEventListener('click', (e) => {
    const el = e.target.closest('a[href], button');
    if (el && !el.classList.contains('tile') && el.id !== 'sound-toggle') sound.play('confirm');
  });

  // Primary action: move into the section's detailed content below the hero.
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
  const HOME = /* SCENES */ {"home":{"src":"art/home.webp","mask":"art/home-mask.png","width":2400,"height":1350,"screen":[[0.55228,0.34328],[0.68258,0.32723],[0.68296,0.5256],[0.55586,0.56292]]},"phone":{"src":"art/home-phone.webp","mask":"art/home-phone-mask.png","width":1350,"height":2400,"screen":[[0.26076,0.36082],[0.52133,0.34996],[0.5205,0.46912],[0.27118,0.49343]]}};
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

  // ---- Profile card clock: the visitor's local date and time, updated on the minute ----
  const clock = document.getElementById('gc-clock');
  const dateEl = document.getElementById('gc-date');
  const dateFormat2 = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
  const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  function tick() {
    const now = new Date();
    dateEl.textContent = dateFormat2.format(now).replace(',', '');
    clock.dateTime = now.toISOString();
    clock.replaceChildren(...timeFormat.formatToParts(now).map(p =>
      p.type === 'dayPeriod' ? Object.assign(document.createElement('small'), { textContent: p.value }) : p.value));
    setTimeout(tick, 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50);
  }
  tick();

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
