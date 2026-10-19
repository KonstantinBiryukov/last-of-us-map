/**
 * MusicControls.tsx — the soundtrack section of the player bar.
 *
 *   ♫ The Path (Vacant)          ⏮ ⏯ ⏭   0:42 ━━━━●──── 2:59   🔊 ━━●──
 *     Gustavo Santaolalla
 *
 * The seek bar and volume are native range inputs (keyboard + screen reader
 * friendly). The seek bar's position is refreshed from the FrameLoop a few
 * times per second without re-rendering React, and never while the user is
 * dragging it.
 */
import { memo, useEffect, useRef } from 'react';
import { useJourney, useMusic } from '../journey/JourneyContext';
import { formatTime } from './formatTime';
import { MuteIcon, MusicIcon, PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon, VolumeIcon } from './icons';
import styles from './MusicControls.module.css';

export const MusicControls = memo(function MusicControls({ compact = false }: { compact?: boolean }) {
  const { music, loop } = useJourney();
  const state = useMusic();
  const track = music.tracks[state.trackIndex]!;
  /** The seek slider and the elapsed-time text, updated directly (no re-render). */
  const seekRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  /** True while the user drags the seek slider (we must not move it under their finger). */
  const draggingRef = useRef(false);
  /** "Loading" counts as playing for the button: pressing it again should pause. */
  const isPlaying = state.status === 'playing' || state.status === 'loading';

  useEffect(() => {
    let lastText = '';
    let lastUpdate = 0;
    return loop.add((_dt, now) => {
      if (now - lastUpdate < 200) return; // 5×/s is plenty for a music timeline
      lastUpdate = now;
      const t = music.currentTime;
      const input = seekRef.current;
      if (input && !draggingRef.current) {
        input.value = String(t);
        // The CSS variable --progress paints the amber "played" part of the track (see the CSS file).
        input.style.setProperty('--progress', `${(t / (music.getSnapshot().duration || 1)) * 100}%`);
      }
      const text = formatTime(t);
      if (text !== lastText && timeRef.current) {
        lastText = text;
        timeRef.current.textContent = text;
      }
    });
  }, [loop, music]);

  return (
    <div className={`${styles.music} ${compact ? styles.compact : ''}`} aria-label="Soundtrack">
      <div className={styles.meta}>
        <MusicIcon size={16} className={styles.note} />
        <div className={styles.titles}>
          <span className={styles.title} title={track.title}>
            {track.title}
          </span>
          <span className={styles.artist}>
            {state.status === 'blocked'
              ? 'Press play to start the music'
              : state.status === 'error'
                ? state.errorMessage
                : state.status === 'loading'
                  ? 'Loading…'
                  : track.artist}
          </span>
        </div>
      </div>

      <div className={styles.buttons}>
        <button type="button" className={styles.icon} onClick={() => music.previous()} aria-label="Previous track">
          <SkipBackIcon size={16} />
        </button>
        <button
          type="button"
          className={`${styles.icon} ${styles.play}`}
          onClick={() => music.toggle()}
          aria-label={isPlaying ? 'Pause music' : 'Play music'}
          data-attention={state.status === 'blocked' || undefined}
        >
          {isPlaying ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
        </button>
        <button type="button" className={styles.icon} onClick={() => music.next()} aria-label="Next track">
          <SkipForwardIcon size={16} />
        </button>
      </div>

      <div className={styles.seek}>
        <span ref={timeRef} className={styles.time}>
          0:00
        </span>
        <input
          ref={seekRef}
          className={styles.range}
          type="range"
          min={0}
          max={state.duration || 1}
          step={0.5}
          defaultValue={0}
          aria-label={`Position in ${track.title}`}
          aria-valuetext={`${formatTime(music.currentTime)} of ${formatTime(state.duration)}`}
          onPointerDown={() => (draggingRef.current = true)}
          onPointerUp={() => (draggingRef.current = false)}
          onInput={(event) => {
            const value = Number(event.currentTarget.value);
            event.currentTarget.style.setProperty('--progress', `${(value / (state.duration || 1)) * 100}%`);
            music.seek(value);
          }}
        />
        <span className={styles.time}>{formatTime(state.duration)}</span>
      </div>

      <div className={styles.volume}>
        <button
          type="button"
          className={styles.icon}
          onClick={() => music.toggleMute()}
          aria-label={state.muted ? 'Unmute music' : 'Mute music'}
          aria-pressed={state.muted}
        >
          {state.muted ? <MuteIcon size={16} /> : <VolumeIcon size={16} />}
        </button>
        <input
          className={styles.range}
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={state.muted ? 0 : state.volume}
          style={{ ['--progress' as string]: `${(state.muted ? 0 : state.volume) * 100}%` }}
          aria-label="Music volume"
          onChange={(event) => music.setVolume(Number(event.currentTarget.value))}
        />
      </div>
    </div>
  );
});
