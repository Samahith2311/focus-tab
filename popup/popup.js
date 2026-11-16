const $ = id => document.getElementById(id);
const say = msg => { $('status').textContent = msg; };
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Builds an element. Props that are not DOM properties (aria-*, data-*) become attributes.
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key in node) node[key] = value; else node.setAttribute(key, value);
  }
  node.append(...children);
  return node;
}

// ---------- Tabs / Focus switcher ----------

const tabButtons = [...document.querySelectorAll('[role=tab]')];

function selectTab(selected) {
  for (const button of tabButtons) {
    const on = button === selected;
    button.setAttribute('aria-selected', on);
    button.tabIndex = on ? 0 : -1;
    $(button.getAttribute('aria-controls')).hidden = !on;
  }
}

for (const button of tabButtons) button.addEventListener('click', () => selectTab(button));

document.querySelector('[role=tablist]').addEventListener('keydown', e => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const step = e.key === 'ArrowRight' ? 1 : -1;
  const next = tabButtons[(tabButtons.indexOf(document.activeElement) + step + tabButtons.length) % tabButtons.length];
  selectTab(next);
  next.focus();
});

// ---------- Tab manager ----------

let allTabs = [];

function domainOf(url) {
  try { return new URL(url).hostname || url; } catch { return url; }
}

// Every tab whose URL was already seen. Active tabs sort first so the one on screen is kept.
function duplicates() {
  const seen = new Set();
  return [...allTabs].sort((a, b) => b.active - a.active).filter(tab => {
    if (seen.has(tab.url)) return true;
    seen.add(tab.url);
    return false;
  });
}

function tabRow(tab) {
  const title = tab.title || tab.url;
  const icon = el('img', { className: 'favicon', alt: '' });
  icon.onerror = () => { icon.style.visibility = 'hidden'; };
  if (tab.favIconUrl) icon.src = tab.favIconUrl; else icon.style.visibility = 'hidden';

  const main = el('button', {
    type: 'button',
    className: 'tab-main',
    title: tab.url,
    'data-key': `m${tab.id}`,
    onclick: async () => {
      await browser.tabs.update(tab.id, { active: true });
      await browser.windows.update(tab.windowId, { focused: true });
      window.close();
    }
  }, icon, el('span', { className: 'tab-text' },
    el('span', { className: 'tab-title', textContent: title }),
    el('span', { className: 'tab-domain', textContent: domainOf(tab.url) })));
  if (tab.active) main.setAttribute('aria-current', 'true');

  const close = el('button', {
    type: 'button',
    className: 'tab-close',
    textContent: '×',
    'aria-label': `Close tab: ${title}`,
    'data-key': `c${tab.id}`,
    onclick: () => browser.tabs.remove(tab.id)
  });

  return el('li', { className: `${tab.active ? 'active' : ''} ${tab.discarded ? 'discarded' : ''}` }, main, close);
}

async function renderTabs() {
  const focusedKey = document.activeElement?.dataset.key;
  allTabs = await browser.tabs.query({});
  const current = await browser.windows.getCurrent();
  const windowIds = [...new Set(allTabs.map(tab => tab.windowId))];
  const query = $('search').value.trim().toLowerCase();

  const groups = [];
  for (const windowId of windowIds) {
    const tabs = allTabs.filter(tab => tab.windowId === windowId &&
      `${tab.title} ${tab.url}`.toLowerCase().includes(query));
    if (!tabs.length) continue;
    const label = `Window ${windowIds.indexOf(windowId) + 1}${windowId === current.id ? ' (current)' : ''} · ${plural(tabs.length, 'tab')}`;
    groups.push(el('section', { 'aria-label': label },
      el('h2', { textContent: label }),
      el('ul', { className: 'list' }, ...tabs.map(tabRow))));
  }
  if (!groups.length) groups.push(el('p', { className: 'muted', textContent: 'No tabs match.' }));
  $('windows').replaceChildren(...groups);

  const count = duplicates().length;
  $('close-dupes').textContent = `Close duplicates (${count})`;
  $('close-dupes').disabled = !count;

  // Re-rendering replaced the focused row; put keyboard focus back, or on search if the row is gone.
  if (focusedKey) (document.querySelector(`[data-key="${focusedKey}"]`) || $('search')).focus();
}

let refreshTimer;
function refreshTabs() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(renderTabs, 50);
}

$('search').addEventListener('input', renderTabs);
for (const event of ['onCreated', 'onRemoved', 'onUpdated', 'onReplaced']) browser.tabs[event].addListener(refreshTabs);

$('close-dupes').addEventListener('click', async () => {
  const ids = duplicates().map(tab => tab.id);
  await browser.tabs.remove(ids);
  say(`Closed ${plural(ids.length, 'duplicate tab')}.`);
});

$('suspend').addEventListener('click', async () => {
  const idle = allTabs.filter(tab => !tab.active && !tab.pinned && !tab.discarded);
  const results = await Promise.allSettled(idle.map(tab => browser.tabs.discard(tab.id)));
  say(`Suspended ${plural(results.filter(r => r.status === 'fulfilled').length, 'idle tab')}.`);
});

// ---------- Saved sessions ----------
// storage.local.sessions = [{ name, windows: [[url, ...], ...] }]

async function getSessions() {
  return (await browser.storage.local.get('sessions')).sessions || [];
}

async function renderSessions() {
  const sessions = await getSessions();
  const rows = sessions.map(session => el('li', {},
    el('span', { className: 'tab-text' },
      el('span', { className: 'tab-title', textContent: session.name }),
      el('span', { className: 'tab-domain', textContent: `${plural(session.windows.flat().length, 'tab')} in ${plural(session.windows.length, 'window')}` })),
    el('button', {
      type: 'button',
      textContent: 'Restore',
      'aria-label': `Restore session ${session.name}`,
      onclick: () => Promise.all(session.windows.map(url => browser.windows.create({ url })))
    }),
    el('button', {
      type: 'button',
      textContent: 'Delete',
      'aria-label': `Delete session ${session.name}`,
      onclick: async () => {
        await browser.storage.local.set({ sessions: sessions.filter(s => s !== session) });
        say(`Deleted session "${session.name}".`);
        renderSessions();
      }
    })));
  $('sessions').replaceChildren(...rows);
}

$('session-form').addEventListener('submit', async e => {
  e.preventDefault();
  const name = $('session-name').value.trim();
  if (!name) return;
  // Only web pages are saved: browsers refuse to reopen internal pages (about:, chrome:) from an extension.
  const byWindow = new Map();
  for (const tab of await browser.tabs.query({})) {
    if (!/^https?:/.test(tab.url)) continue;
    if (!byWindow.has(tab.windowId)) byWindow.set(tab.windowId, []);
    byWindow.get(tab.windowId).push(tab.url);
  }
  if (!byWindow.size) { say('No web pages open to save.'); return; }
  const sessions = (await getSessions()).filter(s => s.name !== name);
  sessions.push({ name, windows: [...byWindow.values()] });
  await browser.storage.local.set({ sessions });
  $('session-name').value = '';
  say(`Saved session "${name}".`);
  renderSessions();
});

// ---------- Focus mode ----------
// The background script owns the session. The popup sends start/stop and mirrors storage.

let countdown;

async function renderFocus() {
  const { focus } = await browser.storage.local.get('focus');
  clearInterval(countdown);
  $('focus-form').hidden = !!focus;
  $('focus-active').hidden = !focus;
  if (!focus) return;
  const tick = () => { $('focus-remaining').textContent = formatRemaining(focus.endTime - Date.now()); };
  tick();
  countdown = setInterval(tick, 1000);
}

$('focus-form').addEventListener('change', e => {
  const custom = new FormData(e.currentTarget).get('duration') === 'custom';
  $('custom-row').hidden = !custom;
  $('custom-minutes').disabled = !custom; // a disabled input is skipped by form validation
});

$('focus-form').addEventListener('submit', async e => {
  e.preventDefault();
  const choice = new FormData(e.currentTarget).get('duration');
  const minutes = Number(choice === 'custom' ? $('custom-minutes').value : choice);
  await browser.runtime.sendMessage({ type: 'start', minutes });
  await renderFocus();
  $('focus-stop').focus();
  say(`Focus session started: ${minutes} min.`);
});

$('focus-stop').addEventListener('click', async () => {
  await browser.runtime.sendMessage({ type: 'stop' });
  await renderFocus();
  $('focus-form').querySelector(':checked').focus();
  say('Focus session ended.');
});

$('open-options').addEventListener('click', () => browser.runtime.openOptionsPage());

// ---------- Stats footer ----------

async function renderStats() {
  const { stats = {} } = await browser.storage.local.get('stats');
  const { today, week, streak } = summarizeStats(stats);
  const cell = (label, value) => el('span', {},
    el('span', { className: 'stat-label', textContent: label }),
    el('b', { textContent: value }));
  $('stats').replaceChildren(
    cell('Today', `${plural(today.sessions, 'session')} · ${today.minutes} min`),
    cell('This week', `${plural(week.sessions, 'session')} · ${week.minutes} min`),
    cell('Streak', plural(streak, 'day')));
}

browser.storage.onChanged.addListener(changes => {
  if (changes.focus) renderFocus();
  if (changes.stats) renderStats();
});

renderTabs();
renderSessions();
renderFocus();
renderStats();
