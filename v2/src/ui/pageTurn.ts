// Turning the page: a change of view runs its DOM update inside a view
// transition, so the old page can leave and the new one arrive (see the
// ::view-transition rules in styles.css). Without the API, or for anyone who
// asked for less motion, the page simply changes.

export function turnPage(update: () => void): void {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (typeof doc.startViewTransition === 'function' && !still) doc.startViewTransition(update);
  else update();
}
