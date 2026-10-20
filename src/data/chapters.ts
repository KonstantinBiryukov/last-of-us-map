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
 * WHERE EACH CHAPTER TRAVELS (matched to the game and to the chapter's images)
 * Every chapter only moves through the place its images show, and the travellers
 * are always moving. Fractions of leg 2 (Boston → Lincoln, 34.8 km) come from the
 * generated Boston street route (public/server/info/boston-streets.geojson, straightened
 * on load — zig-zags under 40 m dropped, see data/legs.ts) and from measuring the line
 * (IMPLEMENTATION_GUIDE.md, Appendix C):
 *     0      Boston QZ (North End)            0.0152  Robert's place at the docks
 *     0.0388 the Fireflies (Ellie joins)      0.0472  beyond the wall
 *     0.0694 Downtown                         0.0818  the Museum
 *     0.1004 the Capitol (Tess stays behind)  0.8639  within 3 km of Lincoln
 *     0.9029 within 2 km of Lincoln (with Bill from here)
 * Bill's truck (leg 3) starts at the end of "Bill's Town" and drives on in "Pittsburgh";
 * "Bus Depot" starts with the jump to Utah and stays near Salt Lake City.
 *
 * WHO TRAVELS (party): Joel and Ellie by default. Tess and Bill join exactly where
 * the game has them, and Lakeside Resort separates Joel and Ellie like the game.
 * `timeShare` gives a part a fixed share of its chapter's time where distance alone
 * would be misleading (a long walk compressed into the end of a chapter).
 */
import type { Chapter, Slide, SlideKind } from './types';

/** How much larger Ellie is drawn when she travels alone: 1 / her height (0.82 of Joel's, three/models/character.ts). */
const ELLIE_ALONE_SCALE = 1 / 0.82;

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
    // The time skip plays during the title + "20 years later" cards. Then the Boston QZ, on
    // real streets: Joel and Tess from the North End to Robert at the docks and on to the
    // Fireflies, where Marlene hands Ellie over; the three of them slip beyond the wall.
    legs: [
      { leg: 1 },
      { leg: 2, from: 0, to: 0.0388, party: ['joel', 'tess'], note: 'Joel and Tess cross the Quarantine Zone to Robert and the Fireflies' },
      { leg: 2, from: 0.0388, to: 0.0472, party: ['joel', 'tess', 'ellie'], note: 'Marlene entrusts Ellie to them — beyond the wall' },
    ],
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
    // The game's own sections: Downtown → The Museum → The Capitol Building, the three of them
    // (about 70 % of the chapter; Tess dies near its end). Then Joel and Ellie leave Boston and
    // walk west, arriving close to Lincoln — that long walk is compressed into the last 30 %.
    legs: [
      // The trio's Boston walk takes 56 % of the chapter (1.85 km in ~34 s — a brisk walk,
      // ~25 % quicker than the 70 % it used to take). After the State House, Joel and Ellie
      // walk on at the SAME pace for ~1.2 km (0.1004 → 0.135: the time left after the jump;
      // leg 2 is 34.8 km, so 0.0346 of it ≈ 1.2 km ≈ the ~22 s that remain × the same speed),
      // then the long walk to Lincoln (~25 km) is skipped like a jump (`hidden`) — walking it
      // in what is left of the chapter would have meant running.
      { leg: 2, from: 0.0472, to: 0.1004, party: ['joel', 'tess', 'ellie'], timeShare: 0.56, note: 'Downtown, the Museum, the Capitol' },
      { leg: 2, from: 0.1004, to: 0.135, note: 'Without Tess — out of Boston' },
      { leg: 2, from: 0.135, to: 0.8639, hidden: true, note: 'The long walk to Lincoln' },
    ],
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
    // Starts right outside Lincoln. Into the town, then through it with Bill; at the end
    // Bill's truck runs again and they drive out of Lincoln (the last 20 % of the chapter).
    legs: [
      { leg: 2, from: 0.8639, to: 0.9029, note: 'Arriving in Lincoln' },
      { leg: 2, from: 0.9029, party: ['joel', 'bill', 'ellie'], note: 'Through Lincoln with Bill' },
      { leg: 3, from: 0, to: 0.1, timeShare: 0.2, note: "Bill's truck — leaving Lincoln" },
    ],
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
    // Opens on the road west in Bill's truck (the game starts this chapter in the truck,
    // entering Pittsburgh), then on foot through the city.
    // Near the end of the chapter they meet Henry and his younger brother Sam.
    legs: [
      { leg: 3, from: 0.1 },
      { leg: 4 },
      { leg: 5 },
      // Leg 6 starts with the Pittsburgh street route (scripts/build-street-routes.mjs): from
      // the truck near Monroeville they walk ~20 km into the city. Henry and Sam join them well
      // inside the city (25 %, around Oakland), so the FOUR walk past the hotel (39.2 %) and the
      // Financial District (40.4 %) and onto the Roberto Clemente Bridge together — its deck walk
      // is drawn from ~30 % (the deck model is long at this zoom), the bridge itself at 41.4–41.8 %.
      // 0.7875 = the same place as before the street route was added (where The Suburbs begin).
      { leg: 6, from: 0, to: 0.25, note: 'On foot from Monroeville into Pittsburgh' },
      { leg: 6, from: 0.25, to: 0.7875, party: ['joel', 'henry', 'sam', 'ellie'], note: 'Henry and Sam join them — together through the city and across the bridge' },
    ],
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
    // The rest of the walk, out of Pittsburgh into its suburbs, with Henry and Sam (the game
    // loses both of them at the very end of this chapter; the next one is Joel and Ellie again).
    legs: [{ leg: 6, from: 0.7875, party: ['joel', 'henry', 'sam', 'ellie'], note: 'With Henry and Sam, through the suburbs' }],
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
    // Months pass (the jump), then towards the dam — where they find Tommy, who goes on with them.
    legs: [
      { leg: 7 },
      { leg: 8, from: 0, to: 0.75, note: "Towards Tommy's dam" },
      // Tommy (and his wife Maria) wait at the dam — they stand there (a prop), they do not walk on.
      { leg: 8, from: 0.75, note: 'Reunited with Tommy and Maria at his dam' },
    ],
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
    // The long ride from Jackson (the first quarter of the chapter, at a gallop), then the last
    // 3.6 km onto the campus for the remaining three quarters (slow): the university's key-point
    // props stand right where that stretch begins (leg 9 at 0.9951), so they are on screen for
    // 75 % of the chapter instead of only its last moments. The camera comes in close for the
    // slow stretch, and the props are sized for that view.
    legs: [
      { leg: 9, from: 0, to: 0.995 },
      { leg: 9, from: 0.995, timeShare: 0.75, note: 'Riding onto the university campus' },
    ],
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
    // As in the game: it starts with Ellie riding Callus while wounded Joel lies across the
    // horse behind her (the escape after the university); in winter Ellie is on her own; Joel,
    // recovered, searches for her alone; they end the chapter together. Fixed shares of the
    // chapter's TIME (`timeShare`):
    //   ride with wounded Joel  50 %  leg 10, 0 → 0.806                        (85.1 km)
    //   Ellie alone             30 %  leg 10, 0.806 → 1  +  leg 11, 0 → 0.21   (20.5 + 13.6 km,
    //                                 split 18 % + 12 % by distance)
    //   Joel alone              10 %  leg 11, 0.21 → 0.737                     (34.0 km)
    //   together again          10 %  leg 11, 0.737 → 1                        (17.0 km)
    // Camera: during the ride it rides BEHIND the horse (map turned so the horse moves up the
    // screen); when the ride ends it turns smoothly back to north up for the second half. 0.8
    // levels closer than usual throughout (the walks are compressed, so it would pull far out).
    legs: [
      { leg: 10, from: 0, to: 0.806, mode: 'horse', wounded: true, timeShare: 0.5, note: 'Ellie rides on, wounded Joel lying across the horse', camera: { zoom: 0.8, heading: 'route', modelScale: 2 } }, // horse and riders drawn twice as large
      // Ellie alone: her bow in hand (`bow`), and drawn 1.22× larger (`modelScale`) — her
      // figure is built at 0.82 of Joel's height, so alone she looked small next to Joel on his
      // own part that follows; 1 / 0.82 ≈ 1.22 makes her the same size on screen as he is.
      // Her first stretch is cut where she passes closest to The Hunt (leg 10 at 0.8441, see
      // data/keyPoints.ts): there she stops for 5 s (`pauseSeconds`, added to the chapter —
      // the rest keeps its pace), draws her bow and shoots the rabbit (`hunt`). The 18 % of the
      // chapter is split by distance: 0.0381 / 0.194 of it before the pause, the rest after.
      { leg: 10, from: 0.806, to: 0.8441, party: ['ellie'], mode: 'walk', bow: true, timeShare: 0.0354, note: 'Ellie alone, hunting while Joel recovers', camera: { zoom: 0.8, modelScale: ELLIE_ALONE_SCALE } },
      { leg: 10, from: 0.8441, to: 0.8441, party: ['ellie'], mode: 'walk', bow: true, pauseSeconds: 5, hunt: true, note: 'Ellie hunts — a rabbit for Joel', camera: { zoom: 0.8, modelScale: ELLIE_ALONE_SCALE } },
      // After the hunt a snowstorm closes in (`blizzard`): Ellie, then Joel, fight their way
      // through wind and snow.
      { leg: 10, from: 0.8441, party: ['ellie'], mode: 'walk', bow: true, blizzard: true, timeShare: 0.1446, note: 'Ellie alone, hunting while Joel recovers', camera: { zoom: 0.8, modelScale: ELLIE_ALONE_SCALE } },
      { leg: 11, from: 0, to: 0.21, party: ['ellie'], bow: true, blizzard: true, timeShare: 0.12, note: 'Ellie alone in the snow', camera: { zoom: 0.8, modelScale: ELLIE_ALONE_SCALE } },
      { leg: 11, from: 0.21, to: 0.737, party: ['joel'], blizzard: true, timeShare: 0.1, note: 'Joel, barely recovered, searches for Ellie alone', camera: { zoom: 0.8 } },
      { leg: 11, from: 0.737, timeShare: 0.1, note: 'Together again', camera: { zoom: 0.8 } },
    ],
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
    // Spring: the jump from Colorado to Utah plays during the title card, then they walk
    // into Salt Lake City (they are together again).
    // Leg 13 is ~95.9 km: 83.1 km of original line into downtown, then 12.8 km of streets to
    // the hospital. 0.694 ≈ 66.5 km, ~14 km from downtown, where the original split was.
    legs: [{ leg: 12 }, { leg: 13, from: 0, to: 0.694 }],
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
    // The last ~17 km into downtown Salt Lake City, then ~13 km of streets south-east to
    // the Fireflies' hospital (St. Mark's — the game's St. Mary's).
    // Leg 13 reaches downtown at 0.8665 (83.1 of its 95.9 km). From there the streets head
    // south-east to the hospital, so on a north-up map they would walk DOWN the screen,
    // towards the camera, and reach the hospital's back. For that last stretch the camera
    // rides behind them (`heading: 'route'`): they walk UP the screen, straight at the
    // hospital's front door, which faces the camera.
    legs: [
      { leg: 13, from: 0.694, to: 0.8665 },
      { leg: 13, from: 0.8665, note: "Through the streets to St. Mary's Hospital", camera: { heading: 'route' } },
    ],
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
    // Most of the way by car; only the last 20 % on foot, walking the road home to Jackson.
    legs: [
      { leg: 14 },
      { leg: 15 },
      { leg: 16, from: 0, to: 0.8, mode: 'vehicle', note: 'Driving north towards Jackson' },
      { leg: 16, from: 0.8, timeShare: 0.2, note: 'The last stretch home to Jackson, on foot' },
    ],
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
