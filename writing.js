(() => {
  const shell = document.getElementById('site-shell');
  const list = document.getElementById('writing-list');
  const status = document.getElementById('writing-status');
  const search = document.getElementById('writing-search');
  const more = document.getElementById('writing-more');
  const pageSize = 12;
  let articles = null;
  let loading = false;
  let limit = pageSize;
  const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

  function render() {
    const query = search.value.trim().toLocaleLowerCase();
    const matches = articles.filter(a => `${a.title} ${a.description}`.toLocaleLowerCase().includes(query));
    list.replaceChildren();
    for (const article of matches.slice(0, limit)) {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.className = 'writing-row';
      link.href = article.url;
      link.target = '_blank';
      link.rel = 'noopener';
      const date = document.createElement('time');
      date.className = 'writing-date';
      date.dateTime = article.publishedAt;
      date.textContent = dateFormat.format(new Date(article.publishedAt));
      const title = document.createElement('span');
      title.className = 'writing-title';
      title.textContent = article.title;
      const author = document.createElement('span');
      author.className = 'writing-author';
      author.textContent = article.author;
      const time = document.createElement('span');
      time.className = 'writing-time';
      time.textContent = article.readingMinutes ? `${article.readingMinutes}m` : '—';
      time.setAttribute('aria-label', article.readingMinutes ? `Estimated ${article.readingMinutes} minute read` : 'Reading time unavailable');
      link.append(date, title, author, time);
      li.append(link);
      list.append(li);
    }
    status.classList.toggle('sr-only', matches.length > 0);
    status.textContent = matches.length ? `${Math.min(limit, matches.length)} of ${matches.length} articles` : query ? 'No articles match your search.' : 'No articles published yet.';
    more.hidden = matches.length <= limit;
  }

  async function load() {
    if (articles || loading) return;
    loading = true;
    try {
      const response = await fetch('data/writing.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error('Index unavailable');
      const data = await response.json();
      if (!Array.isArray(data.articles)) throw new Error('Invalid index');
      articles = data.articles.filter(a => {
        try { const url = new URL(a.url); return url.protocol === 'https:' && url.hostname === 'davidfromkansas.substack.com' && typeof a.title === 'string' && Number.isFinite(Date.parse(a.publishedAt)); } catch { return false; }
      }).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
      render();
    } catch {
      status.classList.remove('sr-only');
      status.textContent = 'Writing is unavailable right now. You can still read every post on Substack below.';
    } finally { loading = false; }
  }

  function navigate() {
    const section = location.hash === '#writing' ? 'writing' : location.hash === '#press' ? 'press' : 'home';
    for (const name of ['home', 'press', 'writing']) document.getElementById(`${name}-view`).hidden = name !== section;
    shell.classList.toggle('is-writing', section === 'writing');
    document.body.classList.toggle('writing-page', section === 'writing');
    document.querySelectorAll('[data-section]').forEach(link => {
      if (link.dataset.section === section) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    document.title = section === 'home' ? 'David Lie-Tjauw' : `${section === 'writing' ? 'Writing' : 'Press'} — David Lie-Tjauw`;
    if (section === 'writing') load();
  }
  search.addEventListener('input', () => { limit = pageSize; if (articles) render(); });
  more.addEventListener('click', () => {
    const previous = list.children.length;
    limit += pageSize;
    render();
    list.children[previous]?.querySelector('a').focus();
  });
  window.addEventListener('hashchange', navigate);
  navigate();
})();
