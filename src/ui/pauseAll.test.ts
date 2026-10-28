/** Tests for the "pause all / play all" rule (player-bar button and the P key). */
import { describe, expect, it } from 'vitest';
import type { PlaybackStatus } from '../playback/machine';
import type { MusicStatus } from '../audio/MusicPlayer';
import { isAnythingPlaying, togglePauseAll } from './pauseAll';

/** Minimal fakes that just flip their status, so we can read the result of one press. */
function fakes(journeyStatus: PlaybackStatus, musicStatus: MusicStatus) {
  const journey = {
    status: journeyStatus,
    play() {
      this.status = 'playing';
    },
    pause() {
      if (this.status === 'playing') this.status = 'paused';
    },
  };
  const music = {
    status: musicStatus,
    getSnapshot() {
      return { status: this.status };
    },
    play() {
      this.status = 'playing';
      return Promise.resolve();
    },
    pause() {
      this.status = 'paused';
    },
  };
  return { journey, music };
}

describe('isAnythingPlaying', () => {
  it('is true when either the journey or the music runs (loading counts as playing)', () => {
    expect(isAnythingPlaying('playing', 'paused')).toBe(true);
    expect(isAnythingPlaying('paused', 'playing')).toBe(true);
    expect(isAnythingPlaying('idle', 'loading')).toBe(true);
    expect(isAnythingPlaying('paused', 'paused')).toBe(false);
    expect(isAnythingPlaying('finished', 'blocked')).toBe(false);
    expect(isAnythingPlaying('idle', 'idle')).toBe(false);
  });
});

describe('togglePauseAll', () => {
  it('pauses both when both play', () => {
    const { journey, music } = fakes('playing', 'playing');
    togglePauseAll(journey, music);
    expect([journey.status, music.status]).toEqual(['paused', 'paused']);
  });

  it('pauses both when only one of them plays', () => {
    const onlyMusic = fakes('paused', 'playing');
    togglePauseAll(onlyMusic.journey, onlyMusic.music);
    expect([onlyMusic.journey.status, onlyMusic.music.status]).toEqual(['paused', 'paused']);

    const onlyJourney = fakes('playing', 'paused');
    togglePauseAll(onlyJourney.journey, onlyJourney.music);
    expect([onlyJourney.journey.status, onlyJourney.music.status]).toEqual(['paused', 'paused']);
  });

  it('plays both when nothing plays (including blocked autoplay)', () => {
    const { journey, music } = fakes('paused', 'blocked');
    togglePauseAll(journey, music);
    expect([journey.status, music.status]).toEqual(['playing', 'playing']);
  });

  it('round-trips: pause all, then play all', () => {
    const { journey, music } = fakes('playing', 'playing');
    togglePauseAll(journey, music);
    togglePauseAll(journey, music);
    expect([journey.status, music.status]).toEqual(['playing', 'playing']);
  });

  it('does not restart a finished journey, only resumes the music', () => {
    const { journey, music } = fakes('finished', 'paused');
    togglePauseAll(journey, music);
    expect([journey.status, music.status]).toEqual(['finished', 'playing']);
  });
});
