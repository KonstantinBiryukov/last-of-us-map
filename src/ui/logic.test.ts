/** Tests for small pure helpers used by the interface. */
import { describe, expect, it } from 'vitest';
import { parseHash } from './useHashRoute';
import { formatTime } from './formatTime';
import { markerStates } from '../map/markers';
import { CHAPTERS } from '../data/chapters';
import { LOCATIONS } from '../data/locations';
import { buildTimeline, completedLegCount } from '../playback/timeline';
import { loadRealRoute } from '../playback/testUtils';

describe('hash routes (the old URLs keep working)', () => {
  it('maps the production URL and the old Vue routes', () => {
    expect(parseHash('#/')).toEqual({ name: 'intro' });
    expect(parseHash('')).toEqual({ name: 'intro' });
    expect(parseHash('#/path')).toEqual({ name: 'journey' });
    expect(parseHash('#/map')).toEqual({ name: 'explore' });
    expect(parseHash('#/about')).toEqual({ name: 'about' });
    expect(parseHash('#/chapter/7')).toEqual({ name: 'chapter', chapterNumber: 7 });
    expect(parseHash('#/nonsense')).toEqual({ name: 'intro' });
  });
});

describe('formatTime', () => {
  it('formats seconds as m:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(192.7)).toBe('3:12');
    expect(formatTime(Number.NaN)).toBe('0:00');
  });
});

describe('marker states', () => {
  it('marks current, next, visited and upcoming locations', () => {
    // Chapter V (index 4) happens in Pittsburgh; the next different place is Jackson (Chapter VII).
    const states = markerStates(CHAPTERS, LOCATIONS, 4);
    expect(states.get('pittsburgh')).toBe('current');
    expect(states.get('jackson')).toBe('next');
    expect(states.get('austin')).toBe('visited');
    expect(states.get('boston')).toBe('visited');
    expect(states.get('salt-lake-city')).toBe('upcoming');
  });

  it('has no "next" marker in the last chapter', () => {
    const states = markerStates(CHAPTERS, LOCATIONS, CHAPTERS.length - 1);
    expect([...states.values()].includes('next')).toBe(false);
    expect(states.get('jackson')).toBe('current');
  });
});

describe('route progress for the completed-line layer', () => {
  const route = loadRealRoute();
  const timeline = buildTimeline(CHAPTERS, route);
  it('is 0 at the start and all legs at the end', () => {
    expect(completedLegCount(timeline, 0)).toBe(0);
    expect(completedLegCount(timeline, timeline.duration)).toBe(route.legs.length);
  });
  it('never decreases over time', () => {
    let previous = 0;
    for (let t = 0; t <= timeline.duration; t += 1) {
      const n = completedLegCount(timeline, t);
      expect(n).toBeGreaterThanOrEqual(previous);
      previous = n;
    }
  });
});
