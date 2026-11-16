// Copies the extension into dist/chrome and dist/firefox, each with the right manifest.json.
// Run: node scripts/build.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const SOURCES = ['background.js', 'popup', 'blocked', 'options', 'lib', 'icons'];
const TARGETS = { chrome: 'manifest.json', firefox: 'manifest.firefox.json' };

for (const [target, manifestFile] of Object.entries(TARGETS)) {
  const out = path.join(root, 'dist', target);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  for (const source of SOURCES) {
    fs.cpSync(path.join(root, source), path.join(out, source), { recursive: true });
  }

  // JSON.parse fails the build on a malformed manifest.
  const manifest = JSON.parse(fs.readFileSync(path.join(root, manifestFile), 'utf8'));
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  // A manifest that points at a file the build did not copy would fail to load in the browser.
  const referenced = [
    manifest.action.default_popup,
    manifest.options_ui.page,
    manifest.background.service_worker,
    ...(manifest.background.scripts || []),
    ...Object.values(manifest.icons),
    ...manifest.web_accessible_resources.flatMap(entry => entry.resources)
  ].filter(Boolean);
  for (const file of referenced) {
    if (!fs.existsSync(path.join(out, file))) throw new Error(`${manifestFile} references missing file: ${file}`);
  }

  console.log(`dist/${target}: ${manifest.name} ${manifest.version} (${referenced.length} manifest references checked)`);
}
