const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveCollectionFlags, mergeCollectionFlags, COLLECTION_FLAG_DEFAULTS } = require('../src/collection-flags.js');

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

// ── mergeCollectionFlags ──

const FULL_CONFIG = {
  title: 'hummelrummel',
  description: 'Erstelle deine eigene Sammelkarte',
  name: 'Hummelrummel',
  policy: 'Seid rücksichtsvoll.',
  festival_mode: false,
  disable_gallery: false,
  disable_gallery_statement: 'Die Galerie ist derzeit geschlossen.',
  disable_publish: false,
  disable_publish_statement: 'Das Veröffentlichen ist derzeit nicht möglich.'
};

test('merging a flag patch into a full config preserves title, description, name and policy exactly', () => {
  const merged = mergeCollectionFlags(FULL_CONFIG, { festival_mode: true, disable_gallery: true });
  assert.equal(merged.title, FULL_CONFIG.title);
  assert.equal(merged.description, FULL_CONFIG.description);
  assert.equal(merged.name, FULL_CONFIG.name);
  assert.equal(merged.policy, FULL_CONFIG.policy);
});

test('merging applies the patched flag values', () => {
  const merged = mergeCollectionFlags(FULL_CONFIG, { festival_mode: true, disable_gallery: true });
  assert.equal(merged.festival_mode, true);
  assert.equal(merged.disable_gallery, true);
});

test('merging preserves unknown fields the app does not recognise', () => {
  const withExtra = Object.assign({}, FULL_CONFIG, { hand_added_field: 'kept me around' });
  const merged = mergeCollectionFlags(withExtra, { festival_mode: true });
  assert.equal(merged.hand_added_field, 'kept me around');
});

test('merging into an absent config refuses rather than returning a flags-only object', () => {
  assert.equal(mergeCollectionFlags(undefined, { festival_mode: true }), null);
});

test('merging into a null config refuses rather than returning a flags-only object', () => {
  assert.equal(mergeCollectionFlags(null, { festival_mode: true }), null);
});

test('merging into a non-object config refuses rather than returning a flags-only object', () => {
  assert.equal(mergeCollectionFlags('not an object', { festival_mode: true }), null);
});

test('merging into an array config refuses rather than returning a flags-only object', () => {
  assert.equal(mergeCollectionFlags([FULL_CONFIG], { festival_mode: true }), null);
});

test('a partial patch leaves the flags it does not mention untouched', () => {
  const merged = mergeCollectionFlags(FULL_CONFIG, { festival_mode: true });
  assert.equal(merged.disable_gallery, FULL_CONFIG.disable_gallery);
  assert.equal(merged.disable_gallery_statement, FULL_CONFIG.disable_gallery_statement);
  assert.equal(merged.disable_publish, FULL_CONFIG.disable_publish);
  assert.equal(merged.disable_publish_statement, FULL_CONFIG.disable_publish_statement);
});
