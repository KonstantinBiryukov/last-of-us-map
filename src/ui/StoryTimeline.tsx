/**
 * StoryTimeline.tsx — the scrubber for the whole journey.
 *
 * Under the hood it is a native <input type="range">, made invisible and laid
 * over our own drawing. That gives keyboard support (arrow keys, Home/End)
 * and screen-reader support for free, while we draw:
 *   • 12 segments, one per chapter, sized by chapter length, with small gaps;
 *   • the played part in amber — drawn INSIDE each segment (each chapter fills
 *     separately), so the gaps between chapters stay visible over the played part;
 *   • a playhead.
 *
 * Fast updates: the fill, playhead and time text are written directly to the
 * DOM from the shared FrameLoop (no React render per frame). The time text is
 * only touched when the displayed second changes.
 *
 * Scrubbing: while dragging we seek "silently" (the camera does not start a
 * new flight on every pixel). When the pointer is released — ANYWHERE on the
 * page, or if the browser cancels the gesture — we commit a normal seek and
 * the camera flies to the new spot. Listening on `window` matters: if the
 * pointer is released outside the slider, the slider itself never hears it.
 */
import { memo, useEffect, useRef, useState } from 'react';
import { useJourney } from '../journey/JourneyContext';
import { formatTime } from './formatTime';
import styles from './StoryTimeline.module.css';

export const StoryTimeline = memo(function StoryTimeline() {
  const { engine, loop } = useJourney();
  const { timeline, chapters } = engine;
  const duration = timeline.duration;

  // Direct references to DOM nodes we update every frame.
  const inputRef = useRef<HTMLInputElement>(null);
  /** One amber fill per chapter segment (index = chapter index). */
  const fillRefs = useRef<(HTMLDivElement | null)[]>([]);
  const headRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  /** True while a pointer (mouse/finger) is dragging the slider. A ref, not state: no re-render needed. */
  const draggingRef = useRef(false);
  /** Hover tooltip position (px) and the time under the pointer; null = hidden. */
  const [hover, setHover] = useState<{ x: number; time: number } | null>(null);

  // Per-frame DOM updates (registered once with the shared loop; the cleanup unregisters it).
  useEffect(() => {
    let lastSecond = -1;
    // Last value written to each segment, so unchanged segments are not touched (most frames
    // only the current chapter's segment changes).
    const lastFill = timeline.chapters.map(() => -1);
    return loop.add(() => {
      const t = engine.time;
      const fraction = duration > 0 ? t / duration : 0;
      timeline.chapters.forEach((c, i) => {
        // 0 before the chapter, 1 after it, in between while it plays.
        const f = Math.min(1, Math.max(0, (t - c.start) / (c.end - c.start)));
        if (f === lastFill[i]) return;
        lastFill[i] = f;
        // `transform: scaleX` is GPU-accelerated and does not trigger a page re-layout.
        const el = fillRefs.current[i];
        if (el) el.style.transform = `scaleX(${f})`;
      });
      if (headRef.current) headRef.current.style.left = `${fraction * 100}%`;
      const second = Math.floor(t);
      if (second !== lastSecond) {
        lastSecond = second;
        if (timeRef.current) timeRef.current.textContent = formatTime(t);
        const input = inputRef.current;
        if (input && !draggingRef.current) {
          input.value = String(t);
          input.setAttribute('aria-valuetext', `${formatTime(t)} of ${formatTime(duration)}, ${chapterLabel(t)}`);
        }
      }
    });
    // chapterLabel only reads data that never changes.
  }, [loop, engine, duration, timeline]);

  // End a drag wherever the pointer is released, and commit the final position.
  useEffect(() => {
    const endDrag = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      const input = inputRef.current;
      if (input) engine.seek(Number(input.value)); // normal seek → camera flies there
    };
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    return () => {
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, [engine]);

  /** "Chapter IV: Bill's Town" for a given time (used by the tooltip and screen readers). */
  function chapterLabel(t: number): string {
    const index = timeline.chapters.findIndex((c) => t >= c.start && t < c.end);
    const chapter = chapters[index < 0 ? chapters.length - 1 : index]!;
    return `${chapter.label}: ${chapter.title}`;
  }

  /** Moves the hover tooltip with the pointer and shows the chapter/time under it. */
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
    setHover({ x, time: (x / rect.width) * duration });
  };

  return (
    <div className={styles.wrap}>
      <span ref={timeRef} className={styles.time}>
        0:00
      </span>
      <div className={styles.track} onPointerMove={onPointerMove} onPointerLeave={() => setHover(null)}>
        {/* One grey segment per chapter (width proportional to its length), each with its own amber fill. */}
        <div className={styles.segments} aria-hidden="true">
          {timeline.chapters.map((c, i) => (
            <div
              key={i}
              className={styles.segment}
              // Placed at the chapter's exact share of the timeline (so it lines up with the
              // playhead and with where a click lands), minus 1.5 px on each side for the gap.
              style={{
                left: `calc(${(c.start / duration) * 100}% + 1.5px)`,
                width: `calc(${((c.end - c.start) / duration) * 100}% - 3px)`,
              }}
            >
              <div
                ref={(el) => {
                  fillRefs.current[i] = el;
                }}
                className={styles.fill}
              />
            </div>
          ))}
        </div>
        <div ref={headRef} className={styles.head} aria-hidden="true" />
        {hover && (
          <div className={styles.tooltip} style={{ left: hover.x }} aria-hidden="true">
            <span className={styles.tooltipChapter}>{chapterLabel(hover.time)}</span>
            <span className={styles.tooltipTime}>{formatTime(hover.time)}</span>
          </div>
        )}
        <input
          ref={inputRef}
          className={styles.input}
          type="range"
          min={0}
          max={duration}
          step={0.1}
          defaultValue={0}
          aria-label="Journey timeline"
          onPointerDown={() => (draggingRef.current = true)}
          onInput={(event) => {
            const value = Number(event.currentTarget.value);
            // Silent while dragging with a pointer; keyboard steps commit immediately (camera flies).
            engine.seek(value, !draggingRef.current);
          }}
          onKeyDown={(event) => {
            // PageUp/PageDown jump by chapter for keyboard users.
            if (event.key === 'PageUp') {
              event.preventDefault();
              engine.next();
            } else if (event.key === 'PageDown') {
              event.preventDefault();
              engine.previous();
            }
          }}
        />
      </div>
      <span className={styles.time}>{formatTime(duration)}</span>
    </div>
  );
});
