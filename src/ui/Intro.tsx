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
 * sound when hovering the menu (once the browser allows sound: after the first click, tap or
 * key press on the page — see the effect in the component).
 *
 * The map is already loading behind this screen, so the journey starts
 * instantly. "Begin the journey" is a real click, which is what browsers
 * require before allowing sound — so the music can start right away.
 */
import { useEffect, useRef, useState } from 'react';
import { assetUrl, optimizedImage } from '../config/assets';
import { isUiSoundOn, playUiSound, preloadUiSound, unlockUiSound } from '../audio/uiSound';
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
  /** The main button, focused automatically so Enter/Space starts the journey. */
  const beginRef = useRef<HTMLButtonElement>(null);

  /**
   * True once sound is on (audio/uiSound.ts). While false, a small "Sound on" button is shown:
   * browsers give a page sound only after a click/tap/key press, and hovering is not one — so
   * on a first visit the menu's hover sound cannot play until the visitor clicks something.
   * This button is that click, offered openly (any other first click turns sound on too).
   */
  const [soundOn, setSoundOn] = useState(isUiSoundOn);

  useEffect(() => {
    preloadUiSound(); // download the click now, so it is ready the moment sound is allowed
    // The first click, tap or key press ANYWHERE on the page switches sound on. These are the
    // events browsers accept as "the visitor did something" (a touch only counts when the
    // finger lifts: touchend / pointerup, not touchstart).
    const events = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'] as const;
    const unlock = () => {
      void unlockUiSound().then((on) => {
        if (!on) return; // still blocked: the next interaction tries again
        setSoundOn(true);
        for (const type of events) document.removeEventListener(type, unlock, { capture: true });
      });
    };
    for (const type of events) document.addEventListener(type, unlock, { capture: true });
    return () => {
      for (const type of events) document.removeEventListener(type, unlock, { capture: true });
    };
  }, []);

  useEffect(() => {
    if (ready) beginRef.current?.focus();
  }, [ready]);

  /** Plays the click sound on hover (silent until sound is on — see above). */
  const hoverSound = () => {
    playUiSound();
  };

  /** The "Sound on" button: switches sound on and plays the click once, so the visitor hears it worked. */
  const turnSoundOn = () => {
    void unlockUiSound().then((on) => {
      if (on) playUiSound();
    });
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
          Salt Lake City, and home to Jackson — through beautiful places and unforgettable moments, set to the
          game's haunting score.
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
        {/* Shown until sound is allowed (see `soundOn`), then it fades away — but it KEEPS its
            place on the page (only invisible, `soundOnDone`), so the text around it does not jump.
            Hidden from screen readers and the keyboard once done. */}
        <button
          type="button"
          className={`${styles.soundOn} ${soundOn ? styles.soundOnDone : ''}`}
          onClick={turnSoundOn}
          aria-label="Turn sound on"
          aria-hidden={soundOn}
          tabIndex={soundOn ? -1 : 0}
          disabled={soundOn}
        >
          <span aria-hidden="true">🔊</span> Sound on
        </button>
      </div>
    </div>
  );
}
