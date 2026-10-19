/**
 * About.tsx — credits, how to use the map, and honest notes about the data.
 *
 * Credits and the contact link are carried over from the original About page.
 */
import { useEffect, useRef } from 'react';
import { CloseIcon } from './icons';
import styles from './About.module.css';

export function About({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label="Close">
          <CloseIcon size={18} />
        </button>
        <h2 id="about-title" className={styles.title}>
          About this journey
        </h2>
        <p>
          This project helps you relive the events of <em>The Last of Us</em> (2013). It follows the path Joel and
          Ellie travel across the United States, chapter by chapter, with the places they pass, images from the game
          and its soundtrack — all synchronised on one timeline.
        </p>

        <h3>How to use it</h3>
        <ul>
          <li>Press play and lean back: the camera, the travellers, the images and the route move together.</li>
          <li>Pause at any time; drag the timeline to any moment; click a location on the map to jump to it.</li>
          <li>Drag or zoom the map to explore freely — press “Follow” to return to the travellers.</li>
          <li>The music has its own controls and keeps playing when you pause or jump in the journey.</li>
        </ul>

        <h3>Keyboard</h3>
        <dl className={styles.keys}>
          <dt>Space</dt>
          <dd>Play / pause the journey</dd>
          <dt>← →</dt>
          <dd>Previous / next image</dd>
          <dt>Shift + ← →</dt>
          <dd>Previous / next chapter</dd>
          <dt>M</dt>
          <dd>Play / pause music</dd>
          <dt>F · O</dt>
          <dd>Follow travellers · whole-journey overview</dd>
        </dl>

        <h3>About the data</h3>
        <ul>
          <li>Solid lines are detailed route paths. Dashed lines mark stretches where the source data only has a start and an end point.</li>
          <li>The dotted arc from Austin to Boston is the twenty-year time skip, not a road.</li>
          <li>Travel by truck and on horseback follows the game; where the game does not show how they travelled, the journey shows them on foot.</li>
          <li>Joel, Ellie, the horse and the truck are lightweight stylised 3D models made for this map.</li>
        </ul>

        <h3>Credits</h3>
        <p className={styles.credits}>
          All images are from <em>The Last of Us</em> (2013) and <em>The Last of Us Remastered</em> (2014), Naughty
          Dog. Music: <em>The Last of Us</em> original soundtrack, Gustavo Santaolalla. Location notes from the
          original project. This is a non-commercial fan project.
        </p>
        <p className={styles.stack}>Built with React, TypeScript, Mapbox GL JS and Three.js.</p>
        <p>
          <a className={styles.contact} href="https://konstantinbiryukov.github.io/website" target="_blank" rel="noreferrer">
            Contact the author
          </a>
        </p>
      </div>
    </div>
  );
}
