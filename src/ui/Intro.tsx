/**
 * Intro.tsx — the title screen shown at the production URL (#/).
 *
 * It is also the "main menu": the house button in the top-left corner of the
 * journey brings you back here, and if you had started, "Continue the journey"
 * resumes exactly where you were (or "Start over").
 *
 * It keeps the original site's essentials: the main background image, the
 * Firefly emblem, the spoiler/age warning, the two ways to experience the map
 * (follow the path, or explore freely), the About page, and the soft "click"
 * sound when hovering the menu.
 *
 * The map is already loading behind this screen, so the journey starts
 * instantly. "Begin the journey" is a real click, which is what browsers
 * require before allowing sound — so the music can start right away.
 */
import { useEffect, useRef } from 'react';
import { assetUrl, optimizedImage } from '../config/assets';
import { UI_CLICK_SOUND } from '../data/soundtrack';
import styles from './Intro.module.css';

interface IntroProps {
  /** False while the route is still downloading (buttons disabled). */
  ready: boolean;
  /** True if the user already watched part of the story (shows Continue + Start over). */
  inProgress: boolean;
  /** Start, or continue from where the user left off. */
  onBegin: () => void;
  /** Restart from the beginning. */
  onStartOver: () => void;
  onExplore: () => void;
  onAbout: () => void;
}

export function Intro({ ready, inProgress, onBegin, onStartOver, onExplore, onAbout }: IntroProps) {
  /** The original title-screen image (optimized copy + blurred placeholder). */
  const background = optimizedImage('server/assets/large_images/main_background.jpg');
  /** The short hover "click" sound from the original menu. */
  const clickRef = useRef<HTMLAudioElement | null>(null);
  /** The main button, focused automatically so Enter/Space starts the journey. */
  const beginRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const audio = new Audio(assetUrl(UI_CLICK_SOUND));
    audio.volume = 0.25;
    clickRef.current = audio;
    return () => {
      audio.pause();
      clickRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (ready) beginRef.current?.focus();
  }, [ready]);

  /** Plays the click sound from the start on hover. */
  const hoverSound = () => {
    const audio = clickRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    // Browsers block sound before the first click; that is fine — just stay silent.
    audio.play().catch(() => undefined);
  };

  return (
    <div className={styles.intro} role="dialog" aria-modal="true" aria-labelledby="intro-title">
      <div
        className={styles.backdrop}
        style={{ backgroundImage: `url("${background.src}"), url("${background.lqip ?? ''}")` }}
        aria-hidden="true"
      />
      <div className={styles.content}>
        <img className={styles.emblem} src={assetUrl('server/assets/other_images/firefly.png')} alt="" width={84} height={84} />
        <p className={styles.kicker}>An interactive journey</p>
        <h1 id="intro-title" className={styles.title}>
          The Last of Us
        </h1>
        <p className={styles.lede}>
          Follow Joel and Ellie across America — from Austin to Boston, west through Pittsburgh, the Rockies and
          Salt Lake City, and home to Jackson — with the places, the moments and the music of their road.
        </p>

        <div className={styles.actions}>
          <button
            ref={beginRef}
            type="button"
            className={styles.primary}
            onClick={onBegin}
            onMouseEnter={hoverSound}
            disabled={!ready}
          >
            {!ready ? 'Preparing the map…' : inProgress ? 'Continue the journey' : 'Begin the journey'}
          </button>
          {inProgress && (
            <button type="button" className={styles.secondary} onClick={onStartOver} onMouseEnter={hoverSound}>
              Start over
            </button>
          )}
          <button type="button" className={styles.secondary} onClick={onExplore} onMouseEnter={hoverSound} disabled={!ready}>
            Explore the map
          </button>
          <button type="button" className={styles.link} onClick={onAbout} onMouseEnter={hoverSound}>
            About
          </button>
        </div>

        <p className={styles.warning}>
          <strong>Warning:</strong> The journey contains major spoilers for the entire game. Best experienced with sound on.
        </p>
      </div>
    </div>
  );
}
