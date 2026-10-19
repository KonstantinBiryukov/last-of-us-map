/**
 * types.ts — the vocabulary of the whole application.
 *
 * Think of these types as the "nouns" of the story:
 *
 *   Location  – a real place on the map (Austin, Boston, …). It has coordinates,
 *               a marker icon, a photo and a long description.
 *   Leg       – one piece of the travelled path (a line on the map) between two
 *               points, plus HOW it was travelled (on foot, by horse, by car…).
 *   LegPart   – a slice of a leg. Usually a chapter travels a whole leg, but a
 *               long leg can be shared by two chapters (e.g. the walk out of
 *               Pittsburgh is split between "Pittsburgh" and "The Suburbs").
 *   Chapter   – one chapter of the game. It happens at a Location, owns an
 *               ordered list of slideshow images and the LegParts travelled
 *               while those images are shown.
 *   Track     – one song of the soundtrack.
 *
 * Nothing in this file knows about React, Mapbox or Three.js. That separation
 * means the story data can be tested and edited without touching any UI code.
 *
 * About `readonly`: it tells TypeScript "nobody may change this after it is
 * created". Story data is fixed, so marking it readonly turns accidental
 * modifications into compile errors.
 */

/**
 * Longitude/latitude pair in degrees, in that order (the GeoJSON convention).
 * Example: Austin is [-97.7431, 30.2672] — 97° WEST (negative), 30° NORTH.
 * The `lng:`/`lat:` labels are only documentation for humans and editors.
 */
export type LngLat = readonly [lng: number, lat: number];

/**
 * Stable string ids for every location. Using a "union of literal strings"
 * instead of plain `string` means a typo like 'pitsburgh' is a compile error.
 */
export type LocationId =
  | 'austin'
  | 'boston'
  | 'lincoln'
  | 'pittsburgh'
  | 'jackson'
  | 'fort-collins'
  | 'silver-lake'
  | 'salt-lake-city';

/** One real place shown as a marker on the map. */
export interface StoryLocation {
  /** Unique id used everywhere else to refer to this place. */
  id: LocationId;
  /** Display title, e.g. "Pittsburgh, Pennsylvania". */
  title: string;
  /** Short name for tight spaces (marker labels), e.g. "Pittsburgh". */
  shortName: string;
  /** Marker position — copied unchanged from the original markers.geojson. */
  coordinates: LngLat;
  /** Round marker image (path relative to /public). */
  icon: string;
  /** Larger photo shown in the location preview (path relative to /public). */
  photo: string;
  /** Description paragraphs, migrated from markers.geojson. */
  description: readonly string[];
}

/**
 * How Joel and Ellie move along a leg. Each mode has its own 3D model,
 * animation and trail style.
 *   walk    – Joel and Ellie on foot.
 *   horse   – both riding one horse.
 *   vehicle – a pickup truck.
 */
export type TravelMode = 'walk' | 'horse' | 'vehicle';

/**
 * Where a leg's travel mode comes from.
 *   canon   – the mode is shown in the game for that part of the story.
 *   default – the game does not clearly show it; we use the documented default
 *             (walking) instead of inventing a detail.
 */
export type TravelModeSource = 'canon' | 'default';

/**
 * What kind of line a leg is.
 *   detailed – a detailed road/trail polyline from the original route file.
 *              The travellers are shown moving along it.
 *   jump     – the original file only had two points (start and end) for this
 *              stretch, so we do NOT know the real path. Instead of pretending,
 *              it is shown as a "jump": a dashed arc with an arrow head, the
 *              camera swoops over it, and a glowing comet (not the travellers)
 *              flies along it.
 *   timeskip – the story leaps forward in time AND space (Austin 2013 → Boston
 *              twenty years later). Shown like a jump but dotted, labelled
 *              "Time passes".
 */
export type LegKind = 'detailed' | 'jump' | 'timeskip';

/** Metadata for one leg. The coordinates themselves are loaded at runtime. */
export interface LegMeta {
  /** Index of the feature inside public/server/info/test2.geojson. */
  featureIndex: number;
  /** See LegKind above. */
  kind: LegKind;
  /** How they travel (decides which 3D model is shown). */
  mode: TravelMode;
  /** Whether `mode` is shown in the game or is our documented default. */
  modeSource: TravelModeSource;
  /** Human-readable note explaining the leg (shown in the story panel). */
  note: string;
  /**
   * Optional correction with a generated street route (scripts/build-street-routes.mjs):
   *   at 'start' – replace the START of this leg with the street route, joining the original
   *                line at its point closest to where the street route ends (leg 2: Boston's
   *                original section meandered on the spot);
   *                Leg 14 also uses it: the drive away starts at the hospital and joins
   *                the original line on I-80;
   *   at 'end'   – continue this leg with the street route after its last point (leg 13:
   *                on from downtown Salt Lake City to the Fireflies' hospital).
   */
  streets?: { route: StreetRoute; at: 'start' | 'end' };
}

/** The generated street routes (files in public/server/info/<route>-streets.geojson). */
export type StreetRoute = 'boston' | 'hospital' | 'escape';

/** A leg after its coordinates have been loaded, corrected and measured. */
export interface Leg extends LegMeta {
  /** The line, from start to end, as [lng, lat] points. */
  coordinates: readonly LngLat[];
}

/**
 * A character who can appear on the map. Joel and Ellie travel most of the way; the
 * others join exactly where the game has them: Tess (Boston), Bill (Lincoln), Henry and
 * Sam (Pittsburgh and the suburbs), Tommy (his dam near Jackson), David (with Ellie in
 * Lakeside Resort).
 */
export type Traveller = 'joel' | 'ellie' | 'tess' | 'bill' | 'henry' | 'sam' | 'tommy' | 'david';

/**
 * A slice of a leg travelled during one chapter.
 *   leg     – index into the LEGS list (data/legs.ts)
 *   from/to – which slice of the leg, as fractions: 0 = leg start, 1 = leg end.
 *             Omitted means the whole leg. Example: { leg: 6, from: 0, to: 0.7 }
 *   party   – who travels this slice, in walking order (default: Joel and Ellie)
 *   mode    – overrides the leg's travel mode for this slice (e.g. Joel on foot)
 *   wounded – Joel lies wounded across the horse's back while Ellie rides
 *             (the escape after the university, in the game)
 *   timeShare – a fixed fraction of the chapter's time for this slice (e.g. 0.2 =
 *             the last 20 % of the Epilogue on foot), instead of the usual share
 *             by distance and speed
 *   note    – overrides the leg's note shown in the story panel
 */
export interface LegPart {
  leg: number;
  from?: number;
  to?: number;
  party?: readonly Traveller[];
  mode?: TravelMode;
  wounded?: boolean;
  timeShare?: number;
  note?: string;
}

/** The four seasons the game is split into (plus the 2013 prologue). */
export type Season = 'prologue' | 'summer' | 'fall' | 'winter' | 'spring';

/**
 * Kinds of atmospheric particles that can float around the travellers.
 * Each chapter lists one or two of them (see data/chapters.ts); the 3D layer
 * draws them with a GPU shader (three/ambience.ts).
 */
export type AmbienceKind =
  | 'embers' // glowing sparks rising from fires (the night Austin burns)
  | 'smoke' // big, slow, dark puffs drifting with the wind
  | 'dust' // warm motes floating in sunlight
  | 'spores' // pale green-yellow cordyceps spores swirling slowly
  | 'fireflies' // blinking yellow-green lights wandering (also a nod to the Fireflies)
  | 'leaves' // orange/red/yellow leaves tumbling down
  | 'snow' // snowflakes falling and drifting with the wind
  | 'pollen' // tiny bright specks drifting upward in spring air
  | 'petals'; // pale pink/white petals fluttering down

/** Whether a slide is a title card (show the whole image) or a scene (fill the frame). */
export type SlideKind = 'title' | 'scene';

/** One image of the slideshow. */
export interface Slide {
  /** Image path relative to /public (the original file). */
  src: string;
  /** Title cards are shown uncropped; scenes fill the 16:9 frame. */
  kind: SlideKind;
}

/** One chapter of the story. */
export interface Chapter {
  /** 1-based chapter number, matching the image folders chapters/1 … chapters/12. */
  number: number;
  /** Chapter title as written on the chapter's title card image. */
  title: string;
  /** Roman numeral or label printed on the title card, e.g. "Chapter VI" or "Epilogue". */
  label: string;
  /** The season the chapter belongs to (labels, map light, default mood). */
  season: Season;
  /** Where the chapter happens (which marker is "current"). */
  locationId: LocationId;
  /** Slides in the exact order of the original slideshow. */
  slides: readonly Slide[];
  /**
   * The route slices travelled while this chapter is on screen, in order.
   * Every chapter has at least one, so the travellers never stand still.
   */
  legs: readonly LegPart[];
  /** Particle moods floating around the travellers during this chapter (1–2). */
  ambience: readonly AmbienceKind[];
}

/** One song of the soundtrack. */
export interface Track {
  /** Unique id (used as a React key). */
  id: string;
  /** Song title shown in the player. */
  title: string;
  /** Composer/performer shown under the title. */
  artist: string;
  /** Audio file path relative to /public. */
  src: string;
  /** Known duration in seconds, used until the browser reads the real metadata. */
  durationHint: number;
}
