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

// Local calendar day as "YYYY-MM-DD": the key used in storage.local.stats.
function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// stats = { "YYYY-MM-DD": { sessions, minutes } }
// Returns totals for today and for this week (Monday to today), plus the streak in days.
function summarizeStats(stats, now = new Date()) {
  const daysAgo = n => stats[dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n))];
  const total = days => ({
    sessions: days.reduce((sum, day) => sum + (day?.sessions || 0), 0),
    minutes: days.reduce((sum, day) => sum + (day?.minutes || 0), 0)
  });
  const daysSinceMonday = (now.getDay() + 6) % 7;

  // A streak can still be extended today, so with nothing done yet today it counts from yesterday.
  let streak = 0;
  for (let n = daysAgo(0) ? 0 : 1; daysAgo(n); n++) streak++;

  return {
    today: total([daysAgo(0)]),
    week: total(Array.from({ length: daysSinceMonday + 1 }, (_, n) => daysAgo(n))),
    streak
  };
}

if (typeof module !== 'undefined') {
  module.exports = { DEFAULT_BLOCKLIST, normalizeDomain, formatRemaining, dayKey, summarizeStats };
}
