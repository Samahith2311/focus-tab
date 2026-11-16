// Shared by the background script, popup, blocked page and options page (plain globals, no modules).

const DEFAULT_BLOCKLIST = ['youtube.com', 'instagram.com', 'x.com', 'reddit.com', 'facebook.com'];

// "https://www.YouTube.com/watch?v=1" -> "youtube.com". Returns null when the input is not a domain.
function normalizeDomain(input) {
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input.trim()) ? input.trim() : `http://${input.trim()}`;
    const host = new URL(withScheme).hostname.replace(/^www\./, '');
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : null;
  } catch {
    return null;
  }
}

// Milliseconds -> "m:ss", never negative.
function formatRemaining(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

if (typeof module !== 'undefined') module.exports = { DEFAULT_BLOCKLIST, normalizeDomain, formatRemaining };
