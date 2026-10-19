/**
 * PlayerBar.tsx — the one cinematic player at the bottom of the screen.
 *
 *   ┌───────────────────────────────────────────────────────────────────┐
 *   │ 2:31 ━━━━━━━━━━━━━━━━━●┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ 11:10    │ ← journey timeline
 *   │ ⏮  ▶  ⏭  ↺     Chapter IV · Bill's Town     ♫ Seasons ⏮⏯⏭ ━━●── 🔊│
 *   └───────────────────────────────────────────────────────────────────┘
 *     journey controls      where you are         soundtrack
 *
 * The journey controls and the music controls are deliberately separate:
 * pausing the journey does NOT pause the music, and vice versa.
 */
import { memo } from 'react';
import { useJourney, usePlayback } from '../journey/JourneyContext';
import { StoryTimeline } from './StoryTimeline';
import { MusicControls } from './MusicControls';
import { PauseIcon, PlayIcon, ReplayIcon, RestartIcon, SkipBackIcon, SkipForwardIcon } from './icons';
import styles from './PlayerBar.module.css';

export const PlayerBar = memo(function PlayerBar({ compact }: { compact: boolean }) {
  const { engine } = useJourney();
  const playback = usePlayback();
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
      </div>
    </section>
  );
});
