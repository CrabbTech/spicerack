import { describe, expect, it } from 'vitest';
import { SCORE_TEMPLATE, parseScoreJson, readScore, scoreToJson } from './parse';
import { compileScore } from './compile';
import { laidBackDbIntro } from '../data/songs/laid-back-db-intro';

describe('score import', () => {
  it('accepts the template the import panel ships', () => {
    const parsed = parseScoreJson(SCORE_TEMPLATE);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(compileScore(parsed.score).totalBars).toBe(4);
  });

  it('round-trips a committed song', () => {
    const parsed = parseScoreJson(scoreToJson(laidBackDbIntro));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.score.sections[0].bars[3].bass).toBe('Bbb');
      expect(parsed.score.caveats?.length).toBe(laidBackDbIntro.caveats?.length);
    }
  });

  it('explains bad JSON instead of throwing', () => {
    const parsed = parseScoreJson('{ nope');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors[0]).toContain('not valid JSON');
  });

  it('names every missing piece at once', () => {
    const parsed = readScore({ sections: [{ name: 'A', bars: [{}] }] });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors).toContain('missing "title"');
      expect(parsed.errors).toContain('missing "key.tonic" (e.g. "Db")');
      expect(parsed.errors.some((e) => e.includes('needs a "chord"'))).toBe(true);
    }
  });

  it('rejects a figure it does not know', () => {
    const parsed = readScore({
      title: 'X', key: { tonic: 'C', mode: 'major' }, bpm: 90,
      sections: [{ name: 'A', bars: [{ chord: 'C', figure: 'boogie' }] }],
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors[0]).toContain('unknown figure');
  });

  it('fills in ids and defaults', () => {
    const parsed = readScore({
      title: 'Laid-Back Intro in D♭', key: { tonic: 'Db', mode: 'major' }, bpm: 94,
      sections: [{ name: 'INTRO', bars: [{ chord: 'Db' }] }],
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.score.id).toBe('laid-back-intro-in-d');
      expect(parsed.score.sections[0].id).toBe('intro');
    }
  });
});
