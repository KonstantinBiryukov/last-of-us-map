/**
 * MapControls.tsx — the small vertical toolbar on the map (journey and explore modes).
 *
 *   ◎  Follow the travellers (highlighted while following)
 *   ⛶  Whole-journey overview
 *   +  Zoom in      −  Zoom out
 *   ≋  Map settings: satellite / atlas, 3D terrain, effects
 *
 * Zooming by button counts as "taking control": the camera stops following,
 * exactly as if the user had scrolled the map.
 */
import { memo, useEffect, useId, useRef, useState } from 'react';
import { MAPBOX_TOKEN } from '../config/env';
import { useCameraDirector, useCameraMode, useJourney, useSettings } from '../journey/JourneyContext';
import { FollowIcon, LayersIcon, MinusIcon, OverviewIcon, PlusIcon } from './icons';
import styles from './MapControls.module.css';

interface MapControlsProps {
  /**
   * In "Explore the map" there is no story to follow: the Follow button is hidden and
   * the frame button shows all locations instead of the journey.
   */
  explore?: boolean;
}

export const MapControls = memo(function MapControls({ explore = false }: MapControlsProps) {
  const { settings } = useJourney();
  const director = useCameraDirector();
  const mode = useCameraMode();
  const current = useSettings();
  /** Whether the settings pop-over is open. */
  const [menuOpen, setMenuOpen] = useState(false);
  /** Unique id linking the settings button to its pop-over (aria-controls). */
  const menuId = useId();
  /** The toolbar element, to detect clicks outside it. */
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close the settings menu when clicking anywhere else or pressing Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  /** Zoom buttons: taking control of the zoom means the camera stops following. */
  const zoom = (delta: number) => {
    if (!director) return;
    director.release();
    director.zoomBy(delta);
  };

  return (
    <div ref={wrapRef} className={styles.controls} role="toolbar" aria-label="Map controls">
      {!explore && (
        <button
          type="button"
          className={styles.button}
          data-active={mode === 'follow'}
          aria-pressed={mode === 'follow'}
          onClick={() => director?.follow()}
          aria-label="Follow Joel and Ellie"
          title="Follow Joel and Ellie  (F)"
        >
          <FollowIcon size={18} />
        </button>
      )}
      <button
        type="button"
        className={styles.button}
        data-active={!explore && mode === 'overview'}
        aria-pressed={!explore && mode === 'overview'}
        onClick={() => (explore ? director?.frameLocations() : director?.overview())}
        aria-label={explore ? 'Show all locations' : 'Show the whole journey'}
        title={explore ? 'All locations' : 'Whole journey  (O)'}
      >
        <OverviewIcon size={18} />
      </button>
      <div className={styles.separator} />
      <button type="button" className={`${styles.button} ${styles.zoomButton}`} onClick={() => zoom(1)} aria-label="Zoom in" title="Zoom in">
        <PlusIcon size={18} />
      </button>
      <button type="button" className={`${styles.button} ${styles.zoomButton}`} onClick={() => zoom(-1)} aria-label="Zoom out" title="Zoom out">
        <MinusIcon size={18} />
      </button>
      <div className={styles.separator} />
      <button
        type="button"
        className={styles.button}
        aria-expanded={menuOpen}
        aria-controls={menuId}
        onClick={() => setMenuOpen((open) => !open)}
        aria-label="Map settings"
        title="Map settings"
      >
        <LayersIcon size={18} />
      </button>

      {menuOpen && (
        <div id={menuId} className={styles.menu} role="group" aria-label="Map settings">
          <fieldset className={styles.fieldset} disabled={!MAPBOX_TOKEN}>
            <legend className={styles.legend}>Base map</legend>
            {(['satellite', 'atlas'] as const).map((style) => (
              <label key={style} className={styles.radio}>
                <input
                  type="radio"
                  name="map-style"
                  checked={current.mapStyle === style}
                  onChange={() => settings.update({ mapStyle: style })}
                />
                {style === 'satellite' ? 'Satellite' : 'Atlas'}
              </label>
            ))}
          </fieldset>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={current.terrain}
              disabled={!MAPBOX_TOKEN}
              onChange={(event) => settings.update({ terrain: event.currentTarget.checked })}
            />
            3D terrain
          </label>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={current.effects}
              onChange={(event) => settings.update({ effects: event.currentTarget.checked })}
            />
            Particles &amp; dust
          </label>
          <p className={styles.hint}>Turn off terrain and particles on slower computers.</p>
        </div>
      )}
    </div>
  );
});
