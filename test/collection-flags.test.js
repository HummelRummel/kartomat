const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveCollectionFlags, COLLECTION_FLAG_DEFAULTS } = require('../src/collection-flags.js');

test('a config with none of the five fields resolves to all flags off and both statements at their defaults', () => {
  assert.deepEqual(resolveCollectionFlags({}), COLLECTION_FLAG_DEFAULTS);
});

test('a null config resolves to the full default set rather than throwing', () => {
  assert.deepEqual(resolveCollectionFlags(null), COLLECTION_FLAG_DEFAULTS);
});

test('a non-object config (string) resolves to the full default set rather than throwing', () => {
  assert.deepEqual(resolveCollectionFlags('not an object'), COLLECTION_FLAG_DEFAULTS);
});

test('a non-object config (number) resolves to the full default set rather than throwing', () => {
  assert.deepEqual(resolveCollectionFlags(42), COLLECTION_FLAG_DEFAULTS);
});

test('an array config resolves to the full default set rather than throwing', () => {
  assert.deepEqual(resolveCollectionFlags([true, 'x']), COLLECTION_FLAG_DEFAULTS);
});

test('an undefined config resolves to the full default set', () => {
  assert.deepEqual(resolveCollectionFlags(undefined), COLLECTION_FLAG_DEFAULTS);
});

test('an empty statement falls back to the built-in default rather than an empty string', () => {
  const resolved = resolveCollectionFlags({
    disable_gallery_statement: '',
    disable_publish_statement: ''
  });
  assert.equal(resolved.disable_gallery_statement, COLLECTION_FLAG_DEFAULTS.disable_gallery_statement);
  assert.equal(resolved.disable_publish_statement, COLLECTION_FLAG_DEFAULTS.disable_publish_statement);
});

test('a whitespace-only statement falls back to the built-in default rather than an empty string', () => {
  const resolved = resolveCollectionFlags({
    disable_gallery_statement: '   ',
    disable_publish_statement: '\n\t '
  });
  assert.equal(resolved.disable_gallery_statement, COLLECTION_FLAG_DEFAULTS.disable_gallery_statement);
  assert.equal(resolved.disable_publish_statement, COLLECTION_FLAG_DEFAULTS.disable_publish_statement);
});

test('a non-blank statement is used as-is', () => {
  const resolved = resolveCollectionFlags({
    disable_gallery_statement: 'Die Galerie macht heute Pause.',
    disable_publish_statement: 'Heute wird nichts mehr veröffentlicht.'
  });
  assert.equal(resolved.disable_gallery_statement, 'Die Galerie macht heute Pause.');
  assert.equal(resolved.disable_publish_statement, 'Heute wird nichts mehr veröffentlicht.');
});

test('a non-boolean flag value resolves predictably rather than turning the flag on for any truthy value', () => {
  const resolved = resolveCollectionFlags({
    festival_mode: 'yes',
    disable_gallery: 1,
    disable_publish: {}
  });
  assert.equal(resolved.festival_mode, COLLECTION_FLAG_DEFAULTS.festival_mode);
  assert.equal(resolved.disable_gallery, COLLECTION_FLAG_DEFAULTS.disable_gallery);
  assert.equal(resolved.disable_publish, COLLECTION_FLAG_DEFAULTS.disable_publish);
});

test('an explicit false is respected rather than replaced by the default', () => {
  const resolved = resolveCollectionFlags({ festival_mode: false, disable_gallery: false, disable_publish: false });
  assert.equal(resolved.festival_mode, false);
  assert.equal(resolved.disable_gallery, false);
  assert.equal(resolved.disable_publish, false);
});

test('an explicit true turns the flag on', () => {
  const resolved = resolveCollectionFlags({ festival_mode: true, disable_gallery: true, disable_publish: true });
  assert.equal(resolved.festival_mode, true);
  assert.equal(resolved.disable_gallery, true);
  assert.equal(resolved.disable_publish, true);
});
