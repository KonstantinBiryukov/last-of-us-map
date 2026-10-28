/**
 * PlayerBar.tsx — the one cinematic player at the bottom of the screen.
 *
 *   ┌──────────────────────────────────────────────────────────────────────────────┐
 *   │ 2:31 ━━━━━━━━━━━━━━━━━●┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ 11:10 │ ← journey timeline
 *   │ ⏮  ▶  ⏭  ↺     Chapter IV · Bill's Town  │ ♫ Seasons ⏮⏯⏭ ━━●── 🔊 │ ⏸ ALL   │
 *   └──────────────────────────────────────────────────────────────────────────────┘
 *     journey controls      where you are         soundtrack            pause all
 *
 * The journey controls and the music controls are deliberately separate:
 * pausing the journey does NOT pause the music, and vice versa. The "Pause all"
 * button at the far right (and the P key) is the one exception: it pauses or
 * resumes both together (see pauseAll.ts for the exact rule).
 */
import { memo } from 'react';
import { useJourney, useMusic, usePlayback } from '../journey/JourneyContext';
import { StoryTimeline } from './StoryTimeline';
import { MusicControls } from './MusicControls';
import { PauseIcon, PlayIcon, ReplayIcon, RestartIcon, SkipBackIcon, SkipForwardIcon } from './icons';
import { isAnythingPlaying, togglePauseAll } from './pauseAll';
import styles from './PlayerBar.module.css';

export const PlayerBar = memo(function PlayerBar({ compact }: { compact: boolean }) {
  const { engine, music } = useJourney();
  const playback = usePlayback();
  /** Subscribed so the "Pause all" button flips when the music starts or stops on its own. */
  const musicState = useMusic();
  /** What "Pause all" would do now: pause if anything moves or sounds, else play both. */
  const anythingPlaying = isAnythingPlaying(playback.status, musicState.status);
  const chapter = engine.chapters[playback.chapterIndex]!;
  const playing = playback.status === 'playing';
  const finished = playback.status === 'finished';

  return (
    <section className={`${styles.bar} ${compact ? styles.compact : ''}`} aria-label="Journey player">
      <StoryTimeline />
      <div className={styles.row}>
        <div className={styles.transport} role="group" aria-label="Journey controls">
          <button
            type="button"
            className={styles.button}
            onClick={() => engine.previous()}
            aria-label="Previous chapter"
            title="Previous chapter  (Shift + ←)"
          >
            <SkipBackIcon size={18} />
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.primary}`}
            onClick={() => (finished ? engine.replay() : engine.toggle())}
            aria-label={finished ? 'Replay the journey' : playing ? 'Pause the journey' : 'Play the journey'}
            title={finished ? 'Replay' : playing ? 'Pause  (Space)' : 'Play  (Space)'}
          >
            {finished ? <ReplayIcon size={20} /> : playing ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={() => engine.next()}
            aria-label="Next chapter"
            title="Next chapter  (Shift + →)"
          >
            <SkipForwardIcon size={18} />
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={() => engine.restartChapter()}
            aria-label="Restart this chapter"
            title="Restart chapter"
          >
            <RestartIcon size={17} />
          </button>
        </div>

        {!compact && (
          <div className={styles.now} aria-hidden="true">
            <span className={styles.nowLabel}>{chapter.label}</span>
            <span className={styles.nowTitle}>{chapter.title}</span>
          </div>
        )}

        <div className={styles.divider} aria-hidden="true" />
        <MusicControls compact={compact} />

        {/*
          Pause all: one press stops both the journey and the music; the next press starts both.
          A labelled pill ("Pause all" / "Play all") at the far right. Left out on phones: there
          the compact bar has no room for it (it would squeeze out the track title), and a third
          round play/pause button next to the other two would be more confusing than helpful.
        */}
        {!compact && (
          <>
            <div className={styles.divider} aria-hidden="true" />
            <button
              type="button"
              className={styles.all}
              onClick={() => togglePauseAll(engine, music)}
              aria-label={anythingPlaying ? 'Pause the journey and the music' : 'Play the journey and the music'}
              title={anythingPlaying ? 'Pause journey and music  (P)' : 'Play journey and music  (P)'}
            >
              {anythingPlaying ? <PauseIcon size={15} /> : <PlayIcon size={15} />}
              <span className={styles.allLabel}>{anythingPlaying ? 'Pause all' : 'Play all'}</span>
            </button>
          </>
        )}
      </div>
    </section>
  );
});
