/* Internship Radar — reads jobs.json, which a cron job rewrites every morning. */
(() => {
  const $ = (s) => document.querySelector(s);
  const TYPES = ['All', 'Internship', 'Trainee', 'Junior', 'Full-time'];
  const CITIES = ['All cities', 'Kochi', 'Trivandrum', 'Calicut', 'Bangalore', 'Remote', 'Other'];
  const SAVED = 'radar.saved';

  let jobs = [], type = 'All', city = 'All cities', q = '', sortNew = false, onlySaved = false;
  let saved = new Set();
  try { saved = new Set(JSON.parse(localStorage.getItem(SAVED) || '[]')); } catch (e) { saved = new Set(); }

  const today = new Date().toISOString().slice(0, 10);
  const daysAgo = (d) => {
    if (!d) return null;
    const ms = Date.now() - new Date(d + 'T00:00:00').getTime();
    return Math.floor(ms / 86400000);
  };
  const rel = (d) => {
    const n = daysAgo(d);
    if (n === null || Number.isNaN(n)) return '';
    if (n <= 0) return 'today';
    if (n === 1) return 'yesterday';
    if (n < 30) return n + 'd ago';
    return Math.floor(n / 30) + 'mo ago';
  };

  const persist = () => localStorage.setItem(SAVED, JSON.stringify([...saved]));

  function chipRow(el, items, cur, onPick) {
    el.innerHTML = items.map((t) =>
      `<button class="chip ${t === cur ? 'on' : ''}" data-v="${t}">${t}</button>`).join('');
    el.querySelectorAll('.chip').forEach((b) => b.onclick = () => onPick(b.dataset.v));
  }

  function match(j) {
    if (type !== 'All' && j.type !== type) return false;
    if (city !== 'All cities' && j.city !== city) return false;
    if (onlySaved && !saved.has(j.url)) return false;
    if (!q) return true;
    const blob = [j.title, j.company, j.city, (j.stack || []).join(' '), j.snippet].join(' ').toLowerCase();
    return q.toLowerCase().split(/\s+/).every((w) => blob.includes(w));
  }

  function render() {
    // relevance order is the order the scraper produced (internships, Flutter/Python,
    // Kochi first). Recency is the opt-in, not the default: otherwise a brand-new
    // Bangalore listing buries the Kochi Flutter internship he actually wants.
    const rows = jobs.filter(match).sort((a, b) => {
      if (sortNew) return (b.posted || '').localeCompare(a.posted || '');
      return (a._i ?? 0) - (b._i ?? 0);
    });

    $('#list').innerHTML = rows.map((j) => {
      const isNew = j.posted === today || daysAgo(j.posted) === 0;
      const typeCls = j.type === 'Internship' ? 'intern' : j.type === 'Trainee' ? 'trainee' : j.type === 'Junior' ? 'junior' : '';
      const stacks = (j.stack || []).filter((s) => s !== 'Other').map((s) => `<span class="tag stack">${s}</span>`).join('');
      return `<article class="card ${isNew ? 'fresh' : ''}">
        <div class="card-top">
          <div>
            <h3>${esc(j.title)}</h3>
            <p class="company">${esc(j.company)} <span class="mono" style="color:var(--muted)">· ${rel(j.posted) || 'recently'}</span></p>
            <div class="tags">
              <span class="tag ${typeCls}">${j.type}</span>
              <span class="tag city">${j.city}</span>
              ${stacks}
              ${isNew ? '<span class="tag new">new</span>' : ''}
            </div>
          </div>
          <div class="actions">
            <button class="star ${saved.has(j.url) ? 'on' : ''}" data-save="${esc(j.url)}" aria-label="Save">★</button>
            <a class="apply" href="${esc(j.url)}" target="_blank" rel="noopener">Apply →</a>
          </div>
        </div>
        ${j.snippet ? `<p class="snippet">${esc(j.snippet)}</p>` : ''}
        ${j.email ? `<div class="mailrow">
          <a class="mail" href="mailto:${esc(j.email)}?subject=Application%20—%20${encodeURIComponent(j.title)}">${esc(j.email)}</a>
          <button class="copy" data-copy="${esc(j.email)}">copy</button>
          <span class="mono" style="font-size:9.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em">apply by email</span>
        </div>` : ''}
      </article>`;
    }).join('');

    $('#empty').hidden = rows.length > 0;
    $('#list').querySelectorAll('[data-save]').forEach((b) => b.onclick = () => {
      const u = b.dataset.save;
      saved.has(u) ? saved.delete(u) : saved.add(u);
      persist(); paintCounts(); render();
    });
    $('#list').querySelectorAll('[data-copy]').forEach((b) => b.onclick = async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'copied'; }
      catch (e) { b.textContent = 'select it'; }
      setTimeout(() => (b.textContent = 'copy'), 1400);
    });
  }

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function paintCounts() {
    $('#s-total').textContent = jobs.length;
    $('#s-intern').textContent = jobs.filter((j) => j.type === 'Internship').length;
    $('#s-kochi').textContent = jobs.filter((j) => j.city === 'Kochi').length;
    $('#s-new').textContent = jobs.filter((j) => j.posted === today).length;
    $('#savedCount').textContent = saved.size;
  }

  function build() {
    chipRow($('#typeChips'), TYPES, type, (v) => { type = v; build(); render(); });
    chipRow($('#cityChips'), CITIES, city, (v) => { city = v; build(); render(); });
    paintCounts();
    render();
  }

  $('#q').addEventListener('input', (e) => { q = e.target.value.trim(); render(); });
  $('#sort').addEventListener('click', (e) => {
    sortNew = !sortNew;
    e.target.textContent = sortNew ? 'Newest first' : 'Best match';
    e.target.classList.toggle('on', !sortNew);
    render();
  });
  $('#savedBtn').addEventListener('click', (e) => {
    onlySaved = !onlySaved;
    e.currentTarget.classList.toggle('on', onlySaved);
    render();
  });

  const savedTheme = localStorage.getItem('radar.theme');
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;
  else if (matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.dataset.theme = 'dark';
  $('#theme').addEventListener('click', () => {
    const n = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = n;
    localStorage.setItem('radar.theme', n);
  });

  fetch('jobs.json?v=' + Date.now())
    .then((r) => r.json())
    .then((d) => {
      jobs = (d.jobs || []).map((j, i) => ({ ...j, _i: i }));
      $('#updated').textContent = 'updated ' + (d.updated || '—');
      $('#built').textContent = d.updated || '—';
      build();
    })
    .catch(() => {
      $('#updated').textContent = 'could not load jobs.json';
      $('#list').innerHTML = '<div class="empty">The data file did not load. If you opened this from disk, serve it over HTTP (or use the live URL).</div>';
    });

  document.documentElement.dataset.ready = '1';
})();
