// Chromium runs this as a service worker and must import its dependencies;
// Firefox loads them through background.scripts in its manifest.
if (typeof importScripts === 'function') importScripts('lib/browser-polyfill.js', 'lib/util.js');

// storage.local.focus = { minutes, endTime } while a session runs, absent otherwise.
// The timer lives only in storage and alarms, never in setTimeout: the service worker
// can be stopped at any moment and must be able to rebuild everything from storage.

const RULE_ID = 1;

// Run state changes one at a time, so two events (alarm + startup) cannot both finish a session.
let queue = Promise.resolve();
function serial(task) {
  queue = queue.then(task).catch(err => console.error('FocusTabs:', err));
  return queue;
}

async function getFocus() {
  return (await browser.storage.local.get('focus')).focus || null;
}

async function getBlocklist() {
  return (await browser.storage.local.get('blocklist')).blocklist || DEFAULT_BLOCKLIST;
}

// Makes alarms, blocking rule and badge match the stored session. Safe to call at any time.
async function sync() {
  const focus = await getFocus();
  if (focus && focus.endTime <= Date.now()) return finish(true);

  await browser.alarms.clearAll();
  if (focus) {
    await browser.alarms.create('focus-end', { when: focus.endTime });
    await browser.alarms.create('focus-tick', { periodInMinutes: 1 });
  }

  const blocklist = await getBlocklist();
  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [RULE_ID],
    addRules: focus && blocklist.length ? [{
      id: RULE_ID,
      priority: 1,
      action: { type: 'redirect', redirect: { extensionPath: '/blocked/blocked.html' } },
      condition: { requestDomains: blocklist, resourceTypes: ['main_frame'] }
    }] : []
  });

  await browser.action.setBadgeBackgroundColor({ color: '#c2410c' });
  await browser.action.setBadgeText({
    text: focus ? String(Math.ceil((focus.endTime - Date.now()) / 60000)) : ''
  });
}

async function start(minutes) {
  minutes = Math.min(600, Math.max(1, Math.round(Number(minutes)) || 25));
  await browser.storage.local.set({ focus: { minutes, endTime: Date.now() + minutes * 60000 } });
  await sync();

  // The blocking rule only catches new navigations; reload open blocked tabs so they hit it too.
  const blocklist = await getBlocklist();
  if (!blocklist.length) return;
  const open = await browser.tabs.query({ url: blocklist.map(domain => `*://*.${domain}/*`) });
  for (const tab of open) browser.tabs.reload(tab.id);
}

// completed = the timer ran out (true) or the user ended the session early (false).
async function finish(completed) {
  const focus = await getFocus();
  if (!focus) return;
  await browser.storage.local.remove('focus');
  await sync();
  if (!completed) return;

  await browser.notifications.create('focus-done', {
    type: 'basic',
    iconUrl: browser.runtime.getURL('icons/icon128.png'),
    title: 'Focus session complete',
    message: `${focus.minutes} focused minutes done. Blocked sites are open again.`
  });
}

browser.runtime.onMessage.addListener(message => {
  if (message?.type === 'start') return serial(() => start(message.minutes));
  if (message?.type === 'stop') return serial(() => finish(false));
});

// Both alarms land here: sync() ends the session when time is up, otherwise refreshes the badge.
browser.alarms.onAlarm.addListener(() => serial(sync));

// Firefox drops alarms on restart and a session may have expired while the browser was closed.
browser.runtime.onStartup.addListener(() => serial(sync));
browser.runtime.onInstalled.addListener(() => serial(sync));

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.blocklist) serial(sync);
});
