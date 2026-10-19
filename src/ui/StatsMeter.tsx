/**
 * StatsMeter.tsx — a tiny on-screen performance meter for checking smoothness
 * on your own computer.
 *
 * Turn it on by adding `?stats` to the address, before the `#`:
 *     http://localhost:5173/last-of-us-map/?stats#/path
 *     https://konstantinbiryukov.github.io/last-of-us-map/?stats#/path
 *
 * It shows:
 *   fps   – frames per second, averaged over the last half second (60 = smooth on a 60 Hz screen)
 *   avg   – average time between frames, in milliseconds (16.7 ms = 60 fps)
 *   worst – the longest frame in that half second (spikes above ~33 ms are visible stutters)
 *
 * It measures through the app's single FrameLoop (no extra animation loop) and
 * writes text directly into the DOM twice a second — it costs nothing noticeable.
 */
import { useEffect, useRef } from 'react';
import { useJourney } from '../journey/JourneyContext';
import styles from './StatsMeter.module.css';

/** True when the page address contains ?stats (read once; it does not change while the page is open). */
export const STATS_ENABLED = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('stats');

export function StatsMeter() {
  const { loop } = useJourney();
  const textRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    let frames = 0; // frames counted in the current half-second window
    let total = 0; // sum of frame durations in the window (ms)
    let worst = 0; // longest frame in the window (ms)
    let windowStart = -1; // timestamp when the window began
    let previous = -1; // timestamp of the previous frame
    return loop.add((_dt, now) => {
      if (previous >= 0) {
        const frame = now - previous;
        frames++;
        total += frame;
        worst = Math.max(worst, frame);
      }
      previous = now;
      if (windowStart < 0) windowStart = now;
      if (now - windowStart >= 500 && frames > 0) {
        const avg = total / frames;
        if (textRef.current) {
          textRef.current.textContent = `fps   ${(1000 / avg).toFixed(0)}\navg   ${avg.toFixed(1)} ms\nworst ${worst.toFixed(1)} ms`;
        }
        frames = 0;
        total = 0;
        worst = 0;
        windowStart = now;
      }
    });
  }, [loop]);

  return (
    <pre ref={textRef} className={styles.meter} aria-hidden="true">
      measuring…
    </pre>
  );
}
