// The inside cover: what the book is called and why, whose it is, the
// plate, and the keys that work on each page. Opened by the wordmark.

import { useEffect, useState } from 'react';
import { useApp } from '../state/AppContext';
import { BRAND } from '../brand';
import { storageKey } from '../state/storage';
import { PixelCrab } from './PixelCrab';
import plate from './art/plate.png';

const OWNER_KEY = storageKey('owner');

export function loadOwner(): string {
  try {
    return localStorage.getItem(OWNER_KEY) ?? '';
  }
  catch {
    return '';
  }
}

const KEYS: { page: string; keys: [string, string][] }[] = [
  { page: 'Everywhere', keys: [['space', 'play / stop'], ['m', 'mute'], ['d', 'drums'], ['b', 'bass'], ['1 – 4', 'guitar, bass, piano, OP-1'], ['j', 'jam ⇄ write'], ['esc', 'close a sheet']] },
  { page: 'Write', keys: [['n', 'new progression'], ['c', 'compose'], ['s', 'spice it up'], ['u', 'undo'], ['x', 'a/b the last spice'], ['r', 'reset'], ['l', 'demo lick'], ['k', 'let the crab in']] },
  { page: 'Jam', keys: [['l', 'demo lick'], ['esc', 'clear the map'], ['← → ⌫', 'step entry, when armed']] },
];

const MENU_KEYS: { page: string; keys: [string, string][] }[] = [
  { page: 'Menu bar', keys: [['⌘N', 'new progression'], ['⌘⇧N', 'compose'], ['⌘S', 'save to library'], ['⌘L', 'library'], ['⌘E', 'export MIDI'], ['⌘⇧C', 'copy tab / chart'], ['⌘P', 'play / stop'], ['⌘⇧S', 'spice it up'], ['⌘⇧A', 'a/b'], ['⌘⌥R', 'reset'], ['⌘⇧K', 'let the crab in'], ['⌘⇧M', 'mirror the chords'], ['⌘1 ⌘2 ⌘3', 'learn, jam, write'], ['⌘⌥1 – 4', 'instrument'], ['⌘,', 'sound'], ['⌘I', 'inside cover']] },
];

export function CoverModal({ onClose }: { onClose: () => void }) {
  const { desktop } = useApp();
  const [owner, setOwner] = useState(loadOwner);
  useEffect(() => {
    try {
      if (owner.trim()) localStorage.setItem(OWNER_KEY, owner.trim());
      else localStorage.removeItem(OWNER_KEY);
    }
    catch {
      // storage unavailable — the name simply isn't kept
    }
  }, [owner]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide cover" onClick={(e) => e.stopPropagation()}>
        <div className="cover-head">
          <PixelCrab size={64} title={BRAND.name} walking />
          <div>
            <div className="cover-mark">{BRAND.mark}</div>
            <div className="cover-tag">{BRAND.tagline}</div>
          </div>
          <button className="btn cover-close" onClick={onClose}>×</button>
        </div>
        <p className="cover-gloss">{BRAND.gloss}</p>
        <img className="cover-plate" src={plate} alt="a small crab carrying a guitar along an empty beach at low tide" width={760} height={347} />
        <label className="cover-owner">
          <span>This journal belongs to</span>
          <input value={owner} placeholder="your name" spellCheck={false} onChange={(e) => setOwner(e.target.value)} />
        </label>
        <div className="cover-keys">
          {[...KEYS, ...(desktop ? MENU_KEYS : [])].map((group) => (
            <div key={group.page} className="cover-keygroup">
              <div className="shelf-head">{group.page}</div>
              {group.keys.map(([k, what]) => (
                <div key={k + what} className="cover-key"><kbd>{k}</kbd><span>{what}</span></div>
              ))}
            </div>
          ))}
        </div>
        <div className="cover-colophon">
          Chords, scales and spice, explained as you go. Sound from Web Audio, no samples. Set in Newsreader, Fraunces, IBM Plex Mono and Silkscreen.
          Formerly Spicerack.
        </div>
      </div>
    </div>
  );
}
