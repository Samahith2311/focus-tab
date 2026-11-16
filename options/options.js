const box = document.getElementById('blocklist');
const note = document.getElementById('note');

// Normalizes, de-duplicates and stores the list. The background script re-applies the
// blocking rule on the storage change, so edits take effect during a running session.
async function save(lines) {
  const entries = lines.map(entry => entry.trim()).filter(Boolean);
  const blocklist = [...new Set(entries.map(normalizeDomain).filter(Boolean))];
  const invalid = entries.filter(entry => !normalizeDomain(entry));
  await browser.storage.local.set({ blocklist });
  box.value = blocklist.join('\n');
  note.textContent = `Saved ${blocklist.length} site${blocklist.length === 1 ? '' : 's'}.` +
    (invalid.length ? ` Ignored, not a domain: ${invalid.join(', ')}` : '');
}

document.getElementById('form').addEventListener('submit', e => {
  e.preventDefault();
  save(box.value.split('\n'));
});
document.getElementById('reset').addEventListener('click', () => save(DEFAULT_BLOCKLIST));

browser.storage.local.get('blocklist').then(({ blocklist = DEFAULT_BLOCKLIST }) => {
  box.value = blocklist.join('\n');
});
