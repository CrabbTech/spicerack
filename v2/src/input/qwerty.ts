// The computer keyboard as a two-octave piano: Z-row = lower octave, Q-row =
// upper, black keys on the row above — the tracker layout most music software
// shares. It's the input that always works, so every listening feature can be
// tried with no hardware at all.

/** KeyboardEvent.code → semitones above the base C */
export const QWERTY_MAP: Record<string, number> = {
  KeyZ: 0, KeyS: 1, KeyX: 2, KeyD: 3, KeyC: 4, KeyV: 5, KeyG: 6, KeyB: 7, KeyH: 8, KeyN: 9, KeyJ: 10, KeyM: 11, Comma: 12,
  KeyQ: 12, Digit2: 13, KeyW: 14, Digit3: 15, KeyE: 16, KeyR: 17, Digit5: 18, KeyT: 19, Digit6: 20, KeyY: 21, Digit7: 22, KeyU: 23, KeyI: 24,
};

/** The C at or below the bottom of the playable range, so the rows cover where the lead lives. */
export const qwertyBase = (lo: number): number => 12 * Math.floor(lo / 12);

/** Key-cap legend for a midi note, for printing on diagrams: "Z", "S"… */
export function qwertyLabel(midi: number, base: number): string | undefined {
  // the two rows overlap on one C — the Q-row name wins, since that hand is already there
  const hit = Object.entries(QWERTY_MAP).reverse().find(([, semis]) => base + semis === midi);
  return hit?.[0].replace('Key', '').replace('Digit', '').replace('Comma', ',');
}
