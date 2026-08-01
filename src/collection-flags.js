// Collection flag resolution and config merge — two pure functions over the
// parsed collection.json config object. Resolution returns the five
// festival/gallery/publish fields with defaults and statement fallbacks
// applied, total over every input: a null, non-object, or array config
// resolves to the full default set rather than throwing, and each field is
// resolved independently so one bad field can't take the rest down with it.
// Merge folds a patch of those five fields into an existing config, refusing
// rather than producing output when the existing config isn't a plain
// object — this is the highest-value check in the module, since a merge
// that drops the collection's other fields bricks the config file that the
// app is fatal-on-missing for.

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

const COLLECTION_FLAG_KEYS = Object.keys(COLLECTION_FLAG_DEFAULTS);

// Merges a patch of the five flag fields into an existing parsed config,
// returning the merged object. Only keys the patch actually owns (via
// hasOwnProperty, so an explicit `undefined` still counts as owned) are
// overwritten — every other field on the existing config, recognised or not,
// passes through untouched. Refuses by returning null when the existing
// config is absent, null, not a plain object, or an array, so a failed read
// or a corrupt file can never be merged into a flags-only document.
function mergeCollectionFlags(existingConfig, patch) {
  if (!existingConfig || typeof existingConfig !== 'object' || Array.isArray(existingConfig)) {
    return null;
  }
  const p = (patch && typeof patch === 'object' && !Array.isArray(patch)) ? patch : {};
  const merged = Object.assign({}, existingConfig);
  for (const key of COLLECTION_FLAG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(p, key)) {
      merged[key] = p[key];
    }
  }
  return merged;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    resolveCollectionFlags,
    mergeCollectionFlags,
    COLLECTION_FLAG_DEFAULTS,
    COLLECTION_FLAG_KEYS
  };
}
