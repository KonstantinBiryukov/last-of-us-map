import { describe, expect, it } from 'vitest';
import { trimEnd, trimStart } from './route';

describe('route corrections', () => {
  const line = [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
  ] as const;

  it('trimEnd ends a leg at its point closest to a place (that point included)', () => {
    expect(trimEnd(line, [0.01, 1.9])).toEqual([[0, 0], [0, 1], [0, 2]]);
  });

  it('trimStart starts a leg at its point closest to a place (that point included)', () => {
    expect(trimStart(line, [0.01, 1.1])).toEqual([[0, 1], [0, 2], [0, 3]]);
  });
});
