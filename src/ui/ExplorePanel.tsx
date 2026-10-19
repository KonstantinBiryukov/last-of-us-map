/**
 * ExplorePanel.tsx — the side panel of "Explore the map".
 *
 * Two states:
 *
 *   No location selected                 A location selected
 *   ┌──────────────────────────┐         ┌──────────────────────────┐
 *   │ EXPLORE THE MAP          │         │ ‹ All places          ✕  │
 *   │ Click a location on the  │         │ [ photo              ]   │
 *   │ map, or pick one below.  │         │ PITTSBURGH, PENNSYLVANIA │
 *   │ ◉ Austin, Texas          │         │ Chapter V · Pittsburgh ▶ │  ← start the journey here
 *   │ ◉ Boston, Massachusetts  │         │ Chapter VI · Suburbs   ▶ │
 *   │ …                        │         │ Description paragraphs…  │
 *   │ [ Begin the journey ]    │         └──────────────────────────┘
 *   └──────────────────────────┘
 *
 * The list is also the keyboard-friendly way to reach every location (markers are
 * buttons too, but scattered over a map). It contains no story state at all: this
 * mode is about reading about the places, at your own pace.
 */
import { useEffect, useRef } from 'react';
import { LOCATIONS, LOCATIONS_BY_ID } from '../data/locations';
import { CHAPTERS } from '../data/chapters';
import type { LocationId } from '../data/types';
import { optimizedImage } from '../config/assets';
import { ChevronLeftIcon, CloseIcon, PlayIcon } from './icons';
import styles from './ExplorePanel.module.css';

interface ExplorePanelProps {
  /** The location whose card is open, or null for the list. */
  selected: LocationId | null;
  /** Open a location's card (null = back to the list). */
  onSelect: (id: LocationId | null) => void;
  /**
   * Leave Explore and start the journey, optionally at a chapter (1-based number).
   * Called from a real click, so the music is allowed to start.
   */
  onStartJourney: (chapterNumber?: number) => void;
}

export function ExplorePanel({ selected, onSelect, onStartJourney }: ExplorePanelProps) {
  const location = selected ? LOCATIONS_BY_ID.get(selected) : undefined;
  /** The panel element: scrolled back to the top whenever another location opens. */
  const panelRef = useRef<HTMLElement>(null);
  /** The card's heading: receives keyboard focus when a card opens, so screen readers announce it. */
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 });
    if (selected) headingRef.current?.focus();
  }, [selected]);

  // Escape closes the card (back to the list).
  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onSelect(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, onSelect]);

  if (!location) {
    return (
      <section ref={panelRef} className={styles.panel} aria-label="Explore the map">
        <p className={styles.kicker}>Explore the map</p>
        <h1 className={styles.title}>The places of the journey</h1>
        <p className={styles.lede}>
          Move and zoom the map freely. Click a location on the map — or pick one below — to read about it.
        </p>
        <ul className={styles.list}>
          {LOCATIONS.map((l) => {
            const icon = optimizedImage(l.icon);
            const count = CHAPTERS.filter((c) => c.locationId === l.id).length;
            return (
              <li key={l.id}>
                <button type="button" className={styles.item} onClick={() => onSelect(l.id)}>
                  <img className={styles.itemIcon} src={icon.src} alt="" width={36} height={36} />
                  <span className={styles.itemText}>
                    <span className={styles.itemTitle}>{l.title}</span>
                    <span className={styles.itemMeta}>
                      {count} chapter{count === 1 ? '' : 's'}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" className={styles.primary} onClick={() => onStartJourney()}>
          <PlayIcon size={16} /> Begin the journey
        </button>
      </section>
    );
  }

  const photo = optimizedImage(location.photo);
  const chaptersHere = CHAPTERS.filter((c) => c.locationId === location.id);

  return (
    <section ref={panelRef} className={styles.panel} aria-label={location.title}>
      <div className={styles.cardBar}>
        <button type="button" className={styles.back} onClick={() => onSelect(null)}>
          <ChevronLeftIcon size={16} /> All places
        </button>
        <button type="button" className={styles.close} onClick={() => onSelect(null)} aria-label="Close">
          <CloseIcon size={16} />
        </button>
      </div>

      {/* Fixed 16:9 frame + blurred placeholder: no layout jump while the photo loads. */}
      <div className={styles.photoFrame} style={{ backgroundImage: photo.lqip ? `url("${photo.lqip}")` : undefined }}>
        <img key={photo.src} className={styles.photo} src={photo.src} alt="" decoding="async" />
      </div>

      {/* tabIndex={-1}: focusable from code (to announce the card), but not a Tab stop. */}
      <h1 ref={headingRef} tabIndex={-1} className={styles.cardTitle}>
        {location.title}
      </h1>

      <div className={styles.chapters}>
        <p className={styles.sectionLabel}>In the story</p>
        {chaptersHere.map((chapter) => (
          <button
            key={chapter.number}
            type="button"
            className={styles.chapter}
            onClick={() => onStartJourney(chapter.number)}
            title="Start the journey from this chapter"
          >
            <span>
              <span className={styles.chapterLabel}>{chapter.label}</span> {chapter.title}
            </span>
            <span className={styles.chapterGo} aria-hidden="true">
              <PlayIcon size={12} />
            </span>
            <span className="visually-hidden">— start the journey from this chapter</span>
          </button>
        ))}
      </div>

      <div className={styles.description}>
        {location.description.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
        <p className={styles.source}>Location notes from the original project.</p>
      </div>
    </section>
  );
}
