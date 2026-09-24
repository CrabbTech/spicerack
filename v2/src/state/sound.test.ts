import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SOUND, channelLabel, loadSound, saveSound } from './sound';

function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
    removeItem: (k: string) => { m.delete(k); },
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  } as Storage;
}

describe('sound settings', () => {
  beforeEach(() => { (globalThis as { localStorage: Storage }).localStorage = fakeStorage(); });

  it('starts from the defaults and keeps what is chosen', () => {
    expect(loadSound()).toEqual(DEFAULT_SOUND);
    saveSound({ ...DEFAULT_SOUND, deviceId: 'Scarlett 2i2 USB', channel: 1 });
    expect(loadSound()).toMatchObject({ deviceId: 'Scarlett 2i2 USB', channel: 1, midiPort: null });
  });

  it('fills in fields an older save did not have', () => {
    localStorage.setItem('quire.sound', '{"deviceId":"Built-in Microphone"}');
    expect(loadSound()).toEqual({ ...DEFAULT_SOUND, deviceId: 'Built-in Microphone' });
  });

  it('names the inputs the way the interface does', () => {
    expect(channelLabel(0)).toBe('1');
    expect(channelLabel(1)).toBe('2');
    expect(channelLabel(-1)).toBe('Mix');
  });
});
