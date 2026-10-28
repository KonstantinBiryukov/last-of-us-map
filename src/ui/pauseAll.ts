/**
 * pauseAll.ts — the "pause all / play all" rule shared by the player-bar button and the P key.
 *
 * The journey and the music normally have separate controls (pausing one never touches
 * the other). This one control drives both at once:
 *
 *   anything playing (journey OR music)  →  pause both
 *   nothing playing                      →  play both
 *
 * "Anything" rather than "everything" so one press always brings silence and stillness:
 * if only the music is running, the button reads "Pause all", never "Play all".
 * Resuming starts both, even if only one of them was running before the pause.
 */
import type { PlaybackStatus } from '../playback/machine';
import type { MusicStatus } from '../audio/MusicPlayer';

/**
 * True while the journey moves or the music plays. "loading" counts as playing for the
 * music (the visitor asked for sound and it is about to start), as on the music button.
 */
export function isAnythingPlaying(journey: PlaybackStatus, music: MusicStatus): boolean {
  return journey === 'playing' || music === 'playing' || music === 'loading';
}

/** The slice of PlaybackEngine this rule needs (keeps it testable with a tiny fake). */
export interface PausableJourney {
  readonly status: PlaybackStatus;
  play(): void;
  pause(): void;
}

/** The slice of MusicPlayer this rule needs. */
export interface PausableMusic {
  getSnapshot(): { status: MusicStatus };
  play(): Promise<void>;
  pause(): void;
}

/**
 * Pause both if anything plays, otherwise play both.
 * A finished journey stays finished on "play all": playing it would restart it from the
 * beginning, which is a different action (the big Replay button), so only the music resumes.
 */
export function togglePauseAll(journey: PausableJourney, music: PausableMusic): void {
  if (isAnythingPlaying(journey.status, music.getSnapshot().status)) {
    journey.pause();
    music.pause();
  } else {
    if (journey.status !== 'finished') journey.play();
    void music.play();
  }
}
