// The name, in one place. Everything that says it — the wordmark, the window
// title, file names, storage keys — reads it from here.

export const BRAND = {
  name: 'Quire',
  /** the wordmark, set in pixel capitals */
  mark: 'QUIRE',
  tagline: 'a practice journal for chords',
  /** why the name: a quire is a gathering of pages; a choir is a gathering of voices */
  gloss: 'quire (n.) — a gathering of pages, folded and sewn; sounds like choir',
  /** localStorage keys are `${storagePrefix}.${name}` */
  storagePrefix: 'quire',
  /** the name this app shipped under before; its keys are carried over once */
  legacyStoragePrefix: 'spicerack2',
  /** file names: quire-night-drive-a-minor.mid, quire-library-2026-09-24.json */
  fileSlug: 'quire',
};
