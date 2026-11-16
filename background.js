// Chromium runs this as a service worker and must import its dependencies;
// Firefox loads them through background.scripts in its manifest.
if (typeof importScripts === 'function') importScripts('lib/browser-polyfill.js');
