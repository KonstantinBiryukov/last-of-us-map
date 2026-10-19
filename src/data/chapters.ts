/**
 * chapters.ts — the story, chapter by chapter.
 *
 * DATA MIGRATION
 * --------------
 * The original app had ONE long list of 134 images in PathCardsFlux.vue that
 * played every 5 seconds, and a route animation that ran on its own timer —
 * nothing actually connected an image to a place. The images were, however,
 * already organised in folders chapters/1 … chapters/12, one per game chapter,
 * and each folder starts with a title card ("CHAPTER VI · The Suburbs").
 *
 * So here every chapter owns:
 *   • exactly the images of its folder, in exactly the original order;
 *   • the location where it happens (from locations.ts);
 *   • the route slices ("leg parts", see legs.ts) travelled while its images
 *     are shown — EVERY chapter has at least one, so Joel and Ellie are always
 *     on the move, whatever moment of the story you jump to;
 *   • one or two particle moods ("ambience") that suit the place and season.
 *
 * Chapter titles are copied from the title-card images themselves.
 * Seasons follow the game's own season title screens (Summer, Fall, Winter, Spring).
 *
 * HOW SHARED LEGS ARE SPLIT
 * Some legs are travelled across two chapters. The split fraction is chosen so
 * the travellers keep the SAME pace across the chapter boundary (no sudden
 * speed-up or slow-down). For two chapters A and B sharing one leg:
 *     fraction for A = (time A spends on that leg) ÷ (time A + time B on that leg)
 * Each chapter lasts 5 s per slide; jumps and time skips take a fixed 4.5 s.
 * The worked numbers are written next to each split below, and a unit test
 * (timeline.test.ts) checks that the pace really stays continuous.
 */
import type { Chapter, Slide, SlideKind } from './types';

/** Folder holding one sub-folder of images per chapter. */
const BASE = 'server/assets/story_telling_images/chapters';

/**
 * Small helper: builds the slide list for one chapter folder.
 * @param folder chapter number = folder name (1 … 12)
 * @param files  file names in the order they should be shown
 */
function slides(folder: number, files: readonly string[]): Slide[] {
  return files.map((file) => ({ src: `${BASE}/${folder}/${file}`, kind: slideKind(file) }));
}

/**
 * Title cards (chapter names, "20 years later", logos) are recognised by file name:
 * welcome_screen, 1_naughty_dog, last_of_us, chapter5 / 2_chapter1 / 1_chapter2, 3_year …
 * The regular expression below is a pattern that matches exactly those names.
 */
function slideKind(file: string): SlideKind {
  return /^(welcome_screen|1_naughty_dog|last_of_us|\d?_?chapter\d*|\d_year)\./.test(file)
    ? 'title'
    : 'scene';
}

export const CHAPTERS: readonly Chapter[] = [
  {
    number: 1,
    title: 'Hometown',
    label: 'Chapter I',
    season: 'prologue',
    locationId: 'austin',
    slides: slides(1, [
      'welcome_screen.png',
      '1_naughty_dog.png',
      'last_of_us.jpg',
      '2_chapter1.png',
      '3_year.png',
      'img_1.png',
      'img_2.jpg',
      'img_3.jpg',
      'img_4.jpg',
      'img_5.jpg',
      'img_6.jpg',
      'img_7.png',
      'img_8.png',
    ]),
    // The truck drives out of Austin from the very first image.
    legs: [{ leg: 0 }],
    ambience: ['embers', 'smoke'],
  },
  {
    number: 2,
    title: 'Quarantine Zone',
    label: 'Chapter II',
    season: 'summer',
    locationId: 'boston',
    slides: slides(2, [
      '1_chapter2.png',
      '2_year.png',
      'img_1.jpg',
      'img_3.jpg',
      'img_4.jpg',
      'img_6.jpg',
      'img_8.jpg',
      'img_9.jpg',
    ]),
    // The time skip plays during the title + "20 years later" cards, then they walk out
    // through the Boston QZ. Split of leg 2: Chapter II has 40 − 4.5 = 35.5 s for it,
    // Chapter III 60 s → 35.5 ÷ 95.5 ≈ 0.37.
    legs: [{ leg: 1 }, { leg: 2, from: 0, to: 0.37 }],
    ambience: ['spores', 'dust'],
  },
  {
    number: 3,
    title: 'The Outskirts',
    label: 'Chapter III',
    season: 'summer',
    locationId: 'boston',
    slides: slides(3, [
      'chapter3.png',
      'img_0.jpg',
      'img_1.jpg',
      'img_2.jpg',
      'img_4.jpg',
      'img_5.jpg',
      'img_6.jpg',
      'img_7.jpg',
      'img_12.jpg',
      'img_14.jpg',
      'img_15.jpg',
      'img_16.jpg',
    ]),
    legs: [{ leg: 2, from: 0.37 }],
    ambience: ['spores', 'fireflies'],
  },
  {
    number: 4,
    title: "Bill's Town",
    label: 'Chapter IV',
    season: 'summer',
    locationId: 'lincoln',
    slides: slides(4, [
      'chapter4.png',
      'img_1.jpg',
      'img_2.jpg',
      'img_4_2.jpg',
      'img_5.jpg',
      'img_6_1.jpg',
      'img_6_2.jpg',
      'img_8_1.jpg',
      'img_8_2.jpg',
      'img_8_3.jpg',
      'img_9.jpg',
      'img_10.jpg',
      'img_12.jpg',
      'img_13.jpg',
      'img_14.jpg',
    ]),
    legs: [{ leg: 3 }, { leg: 4 }, { leg: 5 }],
    ambience: ['fireflies', 'dust'],
  },
  {
    number: 5,
    title: 'Pittsburgh',
    label: 'Chapter V',
    season: 'summer',
    locationId: 'pittsburgh',
    slides: slides(5, [
      'chapter5.png',
      'img_0_0.png',
      'img_0_1.png',
      'img_0_2.png',
      'img_1.jpg',
      'img_4.jpg',
      'img_5.jpg',
      'img_6_1.jpg',
      'img_6_2.jpg',
      'img_7.jpg',
      'img_8.jpg',
      'img_9.jpg',
      'img_10.jpg',
      'img_12.jpg',
      'img_13.jpg',
      'img_14.png',
      'img_15.jpg',
    ]),
    // Split of leg 6: Chapter V lasts 85 s, Chapter VI 35 s → 85 ÷ 120 ≈ 0.71.
    legs: [{ leg: 6, from: 0, to: 0.71 }],
    ambience: ['dust', 'fireflies'],
  },
  {
    number: 6,
    title: 'The Suburbs',
    label: 'Chapter VI',
    season: 'summer',
    locationId: 'pittsburgh',
    slides: slides(6, [
      'chapter6.png',
      'img_0_1.jpg',
      'img_0_2.jpg',
      'img_1.jpg',
      'img_2_1.jpg',
      'img_3.jpg',
      'img_4.jpg',
    ]),
    // The second part of the walk out of Pittsburgh (see the split under Chapter V).
    legs: [{ leg: 6, from: 0.71 }],
    ambience: ['fireflies', 'dust'],
  },
  {
    number: 7,
    title: "Tommy's Dam",
    label: 'Chapter VII',
    season: 'fall',
    locationId: 'jackson',
    slides: slides(7, [
      'chapter7.png',
      'img_1.jpg',
      'img_2.jpg',
      'img_2_2.jpg',
      'img_3.jpg',
      'img_4_0.png',
      'img_4_1.jpg',
      'img_4_2.jpg',
      'img_4_3.jpg',
      'img_5.jpg',
      'img_6.jpg',
      'img_7.jpg',
      'img_8.jpg',
      'img_9.png',
    ]),
    legs: [{ leg: 7 }, { leg: 8 }],
    ambience: ['leaves', 'dust'],
  },
  {
    number: 8,
    title: 'The University',
    label: 'Chapter VIII',
    season: 'fall',
    locationId: 'fort-collins',
    slides: slides(8, [
      'chapter8.png',
      'img_0.jpg',
      'img_00.jpg',
      'img_000.jpg',
      'img_1.jpg',
      'img_2.jpg',
      'img_3.jpg',
      'img_4.jpg',
      'img_5.jpg',
      'img_6.jpg',
      'img_7.jpg',
    ]),
    legs: [{ leg: 9 }],
    ambience: ['leaves', 'dust'],
  },
  {
    number: 9,
    title: 'Lakeside Resort',
    label: 'Chapter IX',
    season: 'winter',
    locationId: 'silver-lake',
    slides: slides(9, [
      'chapter9.png',
      'img_0.jpg',
      'img_1.jpg',
      'img_2_1.jpg',
      'img_2_2.jpg',
      'img_3.jpg',
      'img_4_1.jpg',
      'img_4_11.jpg',
      'img_4_2.jpg',
      'img_4_3.png',
      'img_5.jpg',
      'img_6.jpg',
      'img_7.jpg',
    ]),
    legs: [{ leg: 10 }],
    ambience: ['snow'],
  },
  {
    number: 10,
    title: 'Bus Depot',
    label: 'Chapter X',
    season: 'spring',
    locationId: 'salt-lake-city',
    slides: slides(10, [
      'chapter10.png',
      'img_1.jpg',
      'img_2.jpg',
      'img_3.jpg',
      'img_4.jpg',
      'img_5.jpg',
      'img_6.jpg',
      'img_6_2.png',
      'img_7.jpg',
      'img_8.jpg',
    ]),
    // Split of leg 13 (83 km): Chapter X has 50 − 4.5 = 45.5 s for leg 11 (65 km) plus a
    // fraction x of leg 13; Chapter XI has 40 s for the rest. Equal pace means
    // (65 + 83x) ÷ 45.5 = 83(1 − x) ÷ 40  →  x ≈ 0.17.
    legs: [{ leg: 11 }, { leg: 12 }, { leg: 13, from: 0, to: 0.17 }],
    ambience: ['pollen', 'petals'],
  },
  {
    number: 11,
    title: 'The Firefly Lab',
    label: 'Chapter XI',
    season: 'spring',
    locationId: 'salt-lake-city',
    slides: slides(11, [
      'chapter11.png',
      'img_1.jpg',
      'img_2.jpg',
      'img_3.jpg',
      'img_4.jpg',
      'img_5.jpg',
      'img_6.jpg',
      'img_7.png',
    ]),
    // The rest of the walk into Salt Lake City, to the hospital (see the split under Chapter X).
    legs: [{ leg: 13, from: 0.17 }],
    ambience: ['fireflies', 'pollen'],
  },
  {
    number: 12,
    title: 'Jackson',
    label: 'Epilogue',
    season: 'spring',
    locationId: 'jackson',
    slides: slides(12, [
      'chapter12.png',
      'img_1.jpg',
      'img_2.jpg',
      'img_3.jpg',
      'img_3_2.png',
      'img_4.jpeg',
    ]),
    legs: [{ leg: 14 }, { leg: 15 }, { leg: 16 }],
    ambience: ['petals', 'fireflies'],
  },
];

/** Total number of slides in the whole story (134, same as the original slideshow). `reduce` adds them up. */
export const TOTAL_SLIDES = CHAPTERS.reduce((sum, chapter) => sum + chapter.slides.length, 0);

/** Human labels for seasons (shown above the chapter title). */
export const SEASON_LABELS: Readonly<Record<Chapter['season'], string>> = {
  prologue: 'Prologue · 2013',
  summer: 'Summer',
  fall: 'Fall',
  winter: 'Winter',
  spring: 'Spring',
};
