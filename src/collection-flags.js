// Collection flag resolution — given a parsed collection.json config object,
// returns the five festival/gallery/publish fields with defaults and
// statement fallbacks applied. Total over every input: a null, non-object, or
// array config resolves to the full default set rather than throwing, and
// each field is resolved independently so one bad field can't take the rest
// down with it.

const DISABLE_GALLERY_STATEMENT_DEFAULT = 'Die Galerie ist derzeit geschlossen.';
const DISABLE_PUBLISH_STATEMENT_DEFAULT = 'Das Veröffentlichen ist derzeit nicht möglich.';

const COLLECTION_FLAG_DEFAULTS = {
  festival_mode: false,
  disable_gallery: false,
  disable_gallery_statement: DISABLE_GALLERY_STATEMENT_DEFAULT,
  disable_publish: false,
  disable_publish_statement: DISABLE_PUBLISH_STATEMENT_DEFAULT
};

// A non-boolean flag value is rejected rather than coerced — an arbitrary
// truthy value (a string, a number) does not turn the flag on. Only the
// literal `true`/`false` are meaningful; anything else falls back to default.
function _resolveFlag(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

// An empty or whitespace-only statement counts as absent, so hand-clearing
// the field in the dashboard falls back to the default rather than showing
// a blank box.
function _resolveStatement(value, fallback) {
  return (typeof value === 'string' && value.trim() !== '') ? value : fallback;
}

function resolveCollectionFlags(config) {
  const cfg = (config && typeof config === 'object' && !Array.isArray(config)) ? config : {};
  return {
    festival_mode: _resolveFlag(cfg.festival_mode, COLLECTION_FLAG_DEFAULTS.festival_mode),
    disable_gallery: _resolveFlag(cfg.disable_gallery, COLLECTION_FLAG_DEFAULTS.disable_gallery),
    disable_gallery_statement: _resolveStatement(cfg.disable_gallery_statement, COLLECTION_FLAG_DEFAULTS.disable_gallery_statement),
    disable_publish: _resolveFlag(cfg.disable_publish, COLLECTION_FLAG_DEFAULTS.disable_publish),
    disable_publish_statement: _resolveStatement(cfg.disable_publish_statement, COLLECTION_FLAG_DEFAULTS.disable_publish_statement)
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    resolveCollectionFlags,
    COLLECTION_FLAG_DEFAULTS
  };
}
