/**
 * StoryPanel.tsx — "where are we in the story?" at a glance.
 *
 *   ┌──────────────────────────────┐
 *   │ CHAPTER V · SUMMER           │  ← chapter label and season
 *   │ PITTSBURGH                   │  ← chapter title
 *   │ ◉ Pittsburgh, Pennsylvania   │  ← location of the chapter
 *   │ ┌──────────────────────────┐ │
 *   │ │        slideshow         │ │
 *   │ └──────────────────────────┘ │
 *   │ 🚶 On foot · note            │  ← how they travel right now
 *   │ ▸ About Pittsburgh           │  ← the location description (expandable)
 *   └──────────────────────────────┘
 *
 * It re-renders only when the chapter, slide, leg or play status changes —
 * `usePlayback()` returns the engine's slow-changing snapshot, and `memo`
 * prevents re-renders caused only by the parent re-rendering.
 */
import { memo, useId, useState } from 'react';
import { LOCATIONS_BY_ID } from '../data/locations';
import { SEASON_LABELS } from '../data/chapters';
import type { TravelMode, TravelModeSource } from '../data/types';
import { useJourney, usePlayback } from '../journey/JourneyContext';
import { Slideshow } from './Slideshow';
import { ClockIcon, HorseIcon, JumpIcon, TruckIcon, WalkIcon } from './icons';
import styles from './StoryPanel.module.css';

/** Human wording for each travel mode. */
const MODE_LABEL: Record<TravelMode, string> = { walk: 'On foot', horse: 'On horseback', vehicle: 'By truck' };

/** Picks the icon matching the travel mode. */
function TravelIcon({ mode }: { mode: TravelMode }) {
  if (mode === 'horse') return <HorseIcon size={18} />;
  if (mode === 'vehicle') return <TruckIcon size={18} />;
  return <WalkIcon size={18} />;
}

/** Small grey line under the travel note: data honesty (detailed path? assumed mode?). */
function travelDescription(source: TravelModeSource): string {
  return source === 'default' ? 'detailed route · travel mode assumed' : 'detailed route';
}

export const StoryPanel = memo(function StoryPanel() {
  const { engine } = useJourney();
  const playback = usePlayback();
  const chapter = engine.chapters[playback.chapterIndex]!;
  const location = LOCATIONS_BY_ID.get(chapter.locationId)!;
  // The leg being travelled (undefined only after the very end of the story).
  const leg = playback.legIndex >= 0 ? engine.route.legs[playback.legIndex] : undefined;
  const finished = playback.status === 'finished';
  /** Whether the "About …" text is expanded. */
  const [aboutOpen, setAboutOpen] = useState(false);
  /** Unique id linking the toggle button to the text it controls (for screen readers). */
  const aboutId = useId();

  return (
    <section className={styles.panel} aria-label="Story">
      <header className={styles.header}>
        <p className={styles.kicker}>
          {chapter.label} <span aria-hidden="true">·</span> {SEASON_LABELS[chapter.season]}
        </p>
        {/* `key` makes React re-create the heading on each chapter, replaying its fade-in animation. */}
        <h1 key={chapter.number} className={styles.title}>
          {chapter.title}
        </h1>
        <p className={styles.location}>
          <span className={styles.pin} aria-hidden="true" />
          {location.title}
        </p>
        {/* Screen readers hear a short announcement whenever the chapter changes ("polite" = when idle). */}
        <p className="visually-hidden" aria-live="polite">
          {`${chapter.label}: ${chapter.title}, ${location.title}`}
        </p>
      </header>

      <Slideshow
        chapters={engine.chapters}
        chapterIndex={playback.chapterIndex}
        slideIndex={playback.slideIndex}
        playing={playback.status === 'playing'}
      />

      <div className={styles.travel}>
        {finished || !leg ? (
          <span className={styles.resting}>Home in Jackson — the end of the journey</span>
        ) : leg.kind === 'timeskip' ? (
          <>
            <ClockIcon size={18} />
            <span>
              <strong>Time passes</strong> · {leg.note}
            </span>
          </>
        ) : leg.kind === 'jump' ? (
          <>
            <JumpIcon size={18} />
            <span>
              <strong>Jump</strong> · {leg.note}
              <span className={styles.travelMeta}>shown as an arc — the real path is unknown</span>
            </span>
          </>
        ) : (
          <>
            <TravelIcon mode={leg.mode} />
            <span>
              <strong>{MODE_LABEL[leg.mode]}</strong> · {leg.note}
              <span className={styles.travelMeta}>{travelDescription(leg.modeSource)}</span>
            </span>
          </>
        )}
      </div>

      <div className={styles.about}>
        <button
          type="button"
          className={styles.aboutToggle}
          aria-expanded={aboutOpen}
          aria-controls={aboutId}
          onClick={() => setAboutOpen((open) => !open)}
        >
          <span className={styles.caret} data-open={aboutOpen} aria-hidden="true" />
          About {location.shortName}
        </button>
        {/* `hidden` removes the text from view AND from screen readers while collapsed. */}
        <div id={aboutId} className={styles.aboutBody} hidden={!aboutOpen}>
          {location.description.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
          <p className={styles.source}>Location notes from the original project.</p>
        </div>
      </div>
    </section>
  );
});
