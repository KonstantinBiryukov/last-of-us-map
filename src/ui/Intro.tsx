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

  /** True once the browser allows this page to play sound (see the effect below). */
  const unlockedRef = useRef(false);
  /**
   * The same, for the screen: while false, a small "Sound on" button is shown. Browsers give a
   * page sound only after a click/tap/key press, and hovering is not one — so on a first visit
   * the menu's hover sound cannot play until the visitor clicks something. This button is that
   * click, offered openly (any other first click unlocks sound too).
   */
  const [soundOn, setSoundOn] = useState(false);
  /** Unlocks sound (set up in the effect below; the "Sound on" button calls it). */
  const unlockRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const audio = new Audio(assetUrl(UI_CLICK_SOUND));
    audio.volume = 0.25;
    audio.preload = 'auto';
    clickRef.current = audio;
    // BROWSER RULE: a page may play no sound until the visitor has clicked, tapped or pressed a
    // key on it — hovering does not count. (After a reload Chrome remembers the earlier visit
    // and allows it, which is why the hover sound used to start working only after a refresh.)
    // So on the very FIRST click/tap/key anywhere on the page we "unlock" the sound: play it
    // silently once, which the browser now allows, and from then on every hover can play it.
    const unlock = () => {
      if (unlockedRef.current) return;
      audio.muted = true;
      audio
        .play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
          unlockedRef.current = true;
          setSoundOn(true);
        })
        .catch(() => {
          audio.muted = false; // still blocked: try again on the next interaction
        });
    };
    unlockRef.current = unlock;
    const events = ['pointerdown', 'keydown', 'touchstart'] as const;
    for (const type of events) document.addEventListener(type, unlock, { capture: true });
    return () => {
      for (const type of events) document.removeEventListener(type, unlock, { capture: true });
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
    // Before the first click the browser may still refuse (see above): then stay silent. A
    // successful play also means sound is allowed from now on.
    audio
      .play()
      .then(() => {
        unlockedRef.current = true;
        setSoundOn(true);
      })
      .catch(() => undefined);
  };

  /** The "Sound on" button: unlocks sound and plays the click once, so the visitor hears it worked. */
  const turnSoundOn = () => {
    unlockRef.current();
    const audio = clickRef.current;
    if (!audio) return;
    window.setTimeout(() => {
      audio.currentTime = 0;
      audio.play().catch(() => undefined);
    }, 120); // just after the silent unlock above has finished
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
        {/* Shown until sound is allowed (see `soundOn`); disappears once it is. */}
        {!soundOn && (
          <button type="button" className={styles.soundOn} onClick={turnSoundOn} aria-label="Turn sound on">
            <span aria-hidden="true">🔊</span> Sound on
          </button>
        )}
      </div>
    </div>
  );
}
