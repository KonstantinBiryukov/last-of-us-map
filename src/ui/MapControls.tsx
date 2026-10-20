/**
 * MapControls.tsx — the small vertical toolbar on the map (journey and explore modes).
 *
 *   ◎  Follow the travellers (highlighted while following)
 *   ⛶  Whole-journey overview
 *   +  Zoom in      −  Zoom out
 *
 * While following, the zoom buttons keep following at the new zoom (camera.ts).
 * There are no map settings to choose from: the base map, 3D terrain and particles are
 * fixed choices of the app (state/settings.ts).
 */
import { memo } from 'react';
import { useCameraDirector, useCameraMode } from '../journey/JourneyContext';
import { FollowIcon, MinusIcon, OverviewIcon, PlusIcon } from './icons';
import styles from './MapControls.module.css';

interface MapControlsProps {
  /**
   * In "Explore the map" there is no story to follow: the Follow button is hidden and
   * the frame button shows all locations instead of the journey.
   */
  explore?: boolean;
}

export const MapControls = memo(function MapControls({ explore = false }: MapControlsProps) {
  const director = useCameraDirector();
  const mode = useCameraMode();

  /** Zoom buttons: while following, the camera keeps following at the new zoom (camera.ts). */
  const zoom = (delta: number) => director?.zoomBy(delta);

  return (
    <div className={styles.controls} role="toolbar" aria-label="Map controls">
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
    </div>
  );
});
