/**
 * Slideshow.tsx — the story images, always in sync with the journey.
 *
 * The slideshow has NO timer of its own. Which image is shown comes from the
 * playback engine's snapshot (chapter + slide). So:
 *   • when the journey plays, slides change because the story clock moves;
 *   • when the user clicks ‹ / ›, we ask the ENGINE to seek to that slide —
 *     the map, travellers and route jump with it, so nothing can disagree.
 *
 * Transitions: the new image fades in on top of the old one (a slow
 * cross-dissolve), while a gentle "Ken Burns" zoom drifts across the image for
 * the length of the slide. The drift pauses when the story pauses and is
 * disabled for users who prefer reduced motion.
 *
 * No layout shift: the frame always has a fixed 16:9 shape, and a tiny
 * blurred preview (from the image manifest) fills it until the real image
 * arrives. The next two slides are preloaded in the background.
 */
import { memo, useEffect, useRef, useState } from 'react';
import type { Chapter } from '../data/types';
import { optimizedImage } from '../config/assets';
import { useJourney } from '../journey/JourneyContext';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';
import styles from './Slideshow.module.css';

interface SlideshowProps {
  chapters: readonly Chapter[];
  /** Which chapter/slide to show (from the engine snapshot). */
  chapterIndex: number;
  slideIndex: number;
  /** Ken Burns drift runs only while the story plays. */
  playing: boolean;
}

/** One image layer of the cross-fade stack. */
interface Layer {
  /** Unique per slide ("5-3" = chapter 5, slide 3); React uses it to keep or replace the element. */
  key: string;
  /** URL of the image to show (optimized WebP when available). */
  src: string;
  /** Tiny blurred preview shown until the image loads. */
  lqip: string | undefined;
  kind: 'title' | 'scene';
}

/** Builds the Layer for one slide of a chapter. */
function layerFor(chapter: Chapter, slideIndex: number): Layer {
  const slide = chapter.slides[slideIndex] ?? chapter.slides[0]!;
  const image = optimizedImage(slide.src);
  return { key: `${chapter.number}-${slideIndex}`, src: image.src, lqip: image.lqip, kind: slide.kind };
}

export const Slideshow = memo(function Slideshow({ chapters, chapterIndex, slideIndex, playing }: SlideshowProps) {
  const { engine, loop, reducedMotion } = useJourney();
  const chapter = chapters[chapterIndex]!;
  const current = layerFor(chapter, slideIndex);

  // Keep the previous image underneath while the new one fades in: the list holds at most
  // two layers [old, new]; once the new one is fully visible the old one is dropped.
  const [layers, setLayers] = useState<Layer[]>([current]);
  useEffect(() => {
    setLayers((previous) => {
      const last = previous[previous.length - 1];
      if (last?.key === current.key) return previous;
      return last ? [last, current] : [current];
    });
    // `current.key` changes exactly when the chapter or slide changes, which is all we react to.
  }, [current.key]);

  // Preload the next two slides (across chapter boundaries) so transitions never wait.
  useEffect(() => {
    let c = chapterIndex;
    let s = slideIndex;
    for (let i = 0; i < 2; i++) {
      s++;
      if (s >= chapters[c]!.slides.length) {
        c++;
        s = 0;
      }
      const next = chapters[c];
      if (!next) break;
      // Creating an Image and setting `src` makes the browser download it into its cache,
      // so when that slide comes up it appears instantly.
      const img = new Image();
      img.decoding = 'async';
      img.src = optimizedImage(next.slides[s]!.src).src;
    }
  }, [chapterIndex, slideIndex, chapters]);

  // The thin progress line under the image is updated every frame WITHOUT React re-rendering.
  const progressRef = useRef<HTMLDivElement>(null);
  useEffect(
    () =>
      loop.add(() => {
        const el = progressRef.current;
        if (el) el.style.transform = `scaleX(${engine.frame.slideProgress})`;
      }),
    [loop, engine],
  );

  const total = chapter.slides.length;

  return (
    <figure className={styles.frame} aria-roledescription="slideshow">
      <div className={styles.stage}>
        {layers.map((layer, i) => (
          <SlideImage
            key={layer.key}
            layer={layer}
            entering={i === layers.length - 1 && layers.length > 1}
            animate={!reducedMotion}
            playing={playing}
            seconds={engine.timeline.chapters[chapterIndex]?.slideSeconds ?? engine.timeline.config.slideSeconds}
            onShown={() => setLayers((ls) => (ls.length > 1 && ls[ls.length - 1]!.key === layer.key ? [layer] : ls))}
            alt={`${chapter.label}, ${chapter.title} — image ${slideIndex + 1} of ${total}`}
          />
        ))}
      </div>

      <button
        type="button"
        className={`${styles.nav} ${styles.prev}`}
        onClick={() => engine.previousSlide()}
        aria-label="Previous image"
        disabled={chapterIndex === 0 && slideIndex === 0}
      >
        <ChevronLeftIcon size={22} />
      </button>
      <button
        type="button"
        className={`${styles.nav} ${styles.next}`}
        onClick={() => engine.nextSlide()}
        aria-label="Next image"
        disabled={chapterIndex === chapters.length - 1 && slideIndex === total - 1}
      >
        <ChevronRightIcon size={22} />
      </button>

      <figcaption className={styles.caption}>
        <span className={styles.counter} aria-live="off">
          {String(slideIndex + 1).padStart(2, '0')} <span className={styles.counterTotal}>/ {String(total).padStart(2, '0')}</span>
        </span>
        <ol className={styles.dots} aria-label="Images in this chapter">
          {chapter.slides.map((_, i) => (
            <li key={i}>
              <button
                type="button"
                className={`${styles.dot} ${i === slideIndex ? styles.dotActive : ''} ${i < slideIndex ? styles.dotSeen : ''}`}
                onClick={() => engine.goToSlide(chapterIndex, i)}
                aria-label={`Image ${i + 1}`}
                aria-current={i === slideIndex ? 'step' : undefined}
              />
            </li>
          ))}
        </ol>
      </figcaption>
      <div className={styles.progress} aria-hidden="true">
        <div ref={progressRef} className={styles.progressFill} />
      </div>
    </figure>
  );
});

/** Props of one image layer. */
interface SlideImageProps {
  layer: Layer;
  entering: boolean;
  animate: boolean;
  playing: boolean;
  seconds: number;
  alt: string;
  onShown: () => void;
}

/** One image with its blurred placeholder, fade-in and optional Ken Burns drift. */
function SlideImage({ layer, entering, animate, playing, seconds, alt, onShown }: SlideImageProps) {
  /** The real image finished downloading → fade it in. */
  const [loaded, setLoaded] = useState(false);
  /** The image could not be loaded → show a calm placeholder instead. */
  const [failed, setFailed] = useState(false);

  // Once the new image has loaded and finished fading in, drop the old layer underneath.
  useEffect(() => {
    if (!entering || !(loaded || failed)) return;
    const id = window.setTimeout(onShown, animate ? 1100 : 150);
    return () => window.clearTimeout(id);
  }, [entering, loaded, failed, animate, onShown]);

  return (
    <div
      className={`${styles.layer} ${loaded || failed ? styles.visible : ''}`}
      style={{ backgroundImage: layer.lqip ? `url("${layer.lqip}")` : undefined }}
    >
      {!failed ? (
        <img
          className={`${styles.image} ${layer.kind === 'title' ? styles.contain : styles.cover} ${animate ? styles.kenBurns : ''}`}
          style={{ animationDuration: `${seconds + 1.5}s`, animationPlayState: playing ? 'running' : 'paused' }}
          src={layer.src}
          alt={alt}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      ) : (
        // A missing image must never break the story: show a calm placeholder instead.
        <div className={styles.missing} role="img" aria-label={`${alt} (image unavailable)`}>
          Image unavailable
        </div>
      )}
    </div>
  );
}
