import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script, runInNewContext } from 'node:vm';
import { syncIOSWeb, bundleModules } from '../scripts/sync-ios-web.mjs';

test('the committed iPhone game is current, offline and valid classic JavaScript', async () => {
  const files = await syncIOSWeb({ check: true });
  new Script(files['zankii.js'], { filename: 'iOS/zankii.js' });
  assert.doesNotMatch(files['index.html'], /type="module"|https?:\/\/[^"']+\.(?:js|css)/);
  assert.match(files['index.html'], /class="native-ios"/);
  const resources = [...files['index.html'].matchAll(/(?:src|href)="([^"#]+)"/g)]
    .map(match => match[1]).filter(url => !url.includes('://'));
  for (const resource of resources) assert.ok(Object.hasOwn(files, resource), `Missing offline resource ${resource}`);
  const manifest = JSON.parse(files['manifest.json']);
  assert.equal(Object.keys(manifest.sources).length, 6);
  assert.deepEqual(Object.keys(manifest.files).sort(), ['favicon.svg', 'index.html', 'styles.css', 'zankii.js']);
});

test('offline bundling preserves module scopes and rejects unknown dependencies', () => {
  const sources = {
    'engine.js': 'const internal = 2;\nexport const value = internal;',
    'render.js': "import { value } from './engine.js?v=3';\nconst internal = 3;\nexport const answer = value + internal;",
    'game.js': "import { answer } from './render.js?v=3';\nglobalThis.result = answer;"
  };
  const sandbox = {};
  runInNewContext(bundleModules(sources), sandbox);
  assert.equal(sandbox.result, 5);
  assert.equal(sandbox.internal, undefined);
  assert.throws(() => bundleModules({ ...sources, 'game.js': "import { answer } from './missing.js';" }), /unsupported dependency/);
  assert.throws(() => bundleModules({ ...sources, 'game.js': 'import("https://example.com/game.js");' }), /unsupported module syntax/);
});

test('iPhone project ships the offline resource directory', async () => {
  const project = await readFile(new URL('../ios/Zankii.xcodeproj/project.pbxproj', import.meta.url), 'utf8');
  assert.match(project, /Web in Resources/);
  assert.match(project, /lastKnownFileType = folder;[\s\S]*?path = Web;/);
});
