/**
 * ChapterTitle.tsx — a brief, cinematic title card over the map when a new
 * chapter begins while the journey is playing:
 *
 *                       CHAPTER VII
 *                      Tommy's Dam
 *                         Fall
 *
 * It fades in, holds, and fades out by itself (pure CSS animation), and never
 * blocks clicks. Hidden from screen readers (the story panel already announces
 * chapter changes) and skipped for reduced-motion users.
 */
import { useEffect, useRef, useState } from 'react';
import { SEASON_LABELS } from '../data/chapters';
import { useJourney, usePlayback } from '../journey/JourneyContext';
import styles from './ChapterTitle.module.css';

export function ChapterTitle() {
  const { engine, reducedMotion } = useJourney();
  const { chapterIndex, status } = usePlayback();
  /** Chapter whose card is on screen, or null. */
  const [shown, setShown] = useState<number | null>(null);
  /** Chapter seen in the previous render, to detect a CHANGE (not just "a chapter"). */
  const previous = useRef(chapterIndex);

  useEffect(() => {
    if (chapterIndex !== previous.current && status === 'playing' && !reducedMotion) {
      setShown(chapterIndex);
      const id = window.setTimeout(() => setShown(null), 4200);
      previous.current = chapterIndex;
      return () => window.clearTimeout(id);
    }
    previous.current = chapterIndex;
    return undefined;
  }, [chapterIndex, status, reducedMotion]);

  if (shown === null) return null;
  const chapter = engine.chapters[shown]!;
  return (
    <div key={shown} className={styles.card} aria-hidden="true">
      <span className={styles.label}>{chapter.label}</span>
      <span className={styles.title}>{chapter.title}</span>
      <span className={styles.season}>{SEASON_LABELS[chapter.season]}</span>
    </div>
  );
}
