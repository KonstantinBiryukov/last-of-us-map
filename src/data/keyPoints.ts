/**
 * keyPoints.ts — the key points of each chapter, shown as small blockmesh props beside
 * the route as Joel and Ellie pass them (three/keyPoints.ts draws them).
 *
 * The names are the game's own chapter sections (The Last of Us Part I: e.g. "The Quarantine
 * Zone" is made of "20 Years Later", "The Slums", "The Cargo" and "Beyond the Wall").
 *
 * WHERE: each point has a real-world coordinate (`coord`) — the place the game's location is
 * based on, or, where the game's place is fictional, a real stand-in that fits the story
 * (`basis` says which). playback/keyPoints.ts puts the prop at the closest point of that
 * chapter's route, on the side where the real place lies, so props are as geographically
 * right as the route allows, and the travellers walk right past them.
 *
 * Keyed by chapter number (1 = Prologue … 12 = Epilogue). Within a chapter, list the points
 * in the game's order — the props then also come in that order along the route (tested).
 */
import type { KeyPoint, PropKind } from './types';

/**
 * Boston's props: the walk loops tightly around eight places, so at the full usual size they
 * would only fit far out, up to a kilometre from their real places. 0.7 is the largest that
 * still fits close to the walk (about 60 % larger than before the walkers grew to 81 px).
 */
const BOSTON_SCALE = 0.7;

export const KEY_POINTS: Readonly<Record<number, readonly KeyPoint[]>> = {
  // The escape drive starts at Joel's house: the house stands right where the route begins.
  1: [
    { name: 'Hometown', prop: 'house', coord: [-97.619095, 30.175858], basis: "south-east Austin, where the escape drive starts (Joel's house is in the Austin suburbs)", close: true, scale: 0.5 },
    // Driving out of Austin through the outbreak: a house burning in Buda, beside the road.
    { name: 'Outbreak Night', prop: 'burningHouse', coord: [-97.84, 30.082], basis: 'Buda, Texas, south of Austin on the escape route', scale: 0.5 }, // same size as the Hometown house
  ],
  2: [
    // Boston places from scripts/build-street-routes.mjs (the street route's stops).
    // BOSTON_SCALE: see below.
    { name: '20 Years Later', prop: 'checkpoint', coord: [-71.0547, 42.3637], basis: 'North End — the Quarantine Zone (the wiki: the QZ corresponds to the North End)', scale: BOSTON_SCALE },
    // On LAND by the water: the route reaches Long Wharf and turns west along State Street;
    // the containers stand south of it, by Atlantic Avenue (the harbour is to the east).
    { name: 'The Cargo', prop: 'cargo', coord: [-71.0525, 42.3593], basis: "the waterfront by Long Wharf — Robert's place at the docks", scale: BOSTON_SCALE },
    { name: 'Beyond the Wall', prop: 'wall', coord: [-71.0625, 42.3608], basis: 'Cambridge Street, the edge of the zone', scale: BOSTON_SCALE },
  ],
  3: [
    { name: 'Outside', prop: 'trees', coord: [-71.0621, 42.3598], basis: 'Bowdoin Street, Beacon Hill — just past the wall', scale: BOSTON_SCALE },
    { name: 'Downtown', prop: 'towers', coord: [-71.0603, 42.3555], basis: 'Downtown Crossing', scale: BOSTON_SCALE },
    // The Capitol Building is the Massachusetts State House (its gold dome: 42.35778 N,
    // 71.06361 W). The trio reaches it as the Boston walk ends (where Tess stays behind),
    // as in the game's last Outskirts section — passing right by it, then on to Lincoln.
    { name: 'The Capitol Building', prop: 'capitol', coord: [-71.06361, 42.35778], basis: 'Massachusetts State House', close: true, scale: BOSTON_SCALE * 0.9 }, // ≈ 40 % larger than it stood before (it used to be shrunk to fit its site)
  ],
  4: [
    // Lincoln, Massachusetts — Bill's town. The route crosses it from the east to the centre.
    { name: 'The Woods', prop: 'trees', coord: [-71.27, 42.434], basis: 'the woods on the eastern edge of Lincoln' },
    { name: 'Safehouse', prop: 'safehouse', coord: [-71.293, 42.4385], basis: 'north Lincoln' },
    { name: 'Graveyard', prop: 'graveyard', coord: [-71.3003, 42.4375], basis: 'Lincoln, near the town centre' },
    { name: 'High School Escape', prop: 'school', coord: [-71.3045, 42.4275], basis: 'Lincoln town centre, by the schools' },
  ],
  5: [
    // On foot through Pittsburgh: downtown and along the rivers.
    { name: 'Hotel Lobby', prop: 'hotel', coord: [-79.9966, 40.441], basis: 'the Omni William Penn Hotel, downtown (the game’s hotel is fictional)' },
    { name: 'Financial District', prop: 'towers', coord: [-80.0028, 40.4408], basis: 'PPG Place / Market Square, downtown' },
    // The famous yellow bridges ("Three Sisters") link downtown and the North Side across the
    // Allegheny; the game's Pittsburgh bridges are styled on them. Exactly in place, along its axis.
    {
      name: 'Escape the City',
      prop: 'bridge',
      coord: [-80.00361, 40.44556],
      basis: 'the Roberto Clemente (Sixth Street) Bridge across the Allegheny, downtown ↔ North Side',
      exact: { heading: 344 }, // the deck's real axis (the walking route over it runs at 344°)
    },
  ],
  6: [
    // The boat stranded on land that they pass in the game's Suburbs: on the Duff City side of
    // the walk (west of it), right beside it (`close`; the walk passes -80.0992, 40.5843 here).
    { name: 'The Boat', prop: 'boat', coord: [-80.1105, 40.5843], basis: 'Duff City, north-west of Pittsburgh (the beached boat in the game’s Suburbs)', close: true },
    { name: 'Sewers', prop: 'sewer', coord: [-80.0954, 40.5936], basis: "Pittsburgh's northern suburbs" },
    { name: 'Suburbs', prop: 'suburb', coord: [-80.0941, 40.651], basis: "Pittsburgh's northern suburbs" },
  ],
  7: [
    // The dam stands just north of ("up from", on the north-up map) the Jackson marker, its front
    // — where Tommy and Maria wait — facing south, towards the camera; ten times the usual size
    // (`scale: 10`). At that size its footprint is ~31 km in radius, so its centre is placed one
    // radius plus a little (~34 km) north of the marker (43.4746 N → 43.784 N).
    { name: 'Hydroelectric Dam', prop: 'dam', coord: [-110.810617, 43.784], basis: "just north of Jackson (Tommy's dam is fictional)", exact: { heading: 180 }, scale: 10, moment: 0.8 }, // reached as Tommy and Maria are met
    // The ranch: right beside the route as they arrive at Jackson (`close`), five times the usual size.
    { name: 'Ranch House', prop: 'ranch', coord: [-110.775, 43.47], basis: 'ranch land at the edge of Jackson', close: true, scale: 5 },
  ],
  8: [
    // The University of Eastern Colorado is modelled on Colorado State University, Fort Collins.
    { name: 'Go Big Horns', prop: 'campus', coord: [-105.085, 40.6], basis: 'Fort Collins, north of the CSU campus' },
    // Autumn trees right across the road from the university: the walk runs south past the
    // campus (west of it, at -105.0766, 40.6017), so these stand just east of it (`close`).
    { name: 'Fall Colours', prop: 'autumnTrees', coord: [-105.0685, 40.601], basis: 'Fort Collins, across the road from the campus', close: true },
    { name: 'Science Building', prop: 'lab', coord: [-105.083, 40.5755], basis: 'the Colorado State University campus' },
  ],
  9: [
    // Right beside Ellie's path (`close`) and 4× the usual size, so the deer and the rabbit are
    // seen as she walks past (at the usual size it was a third of the travellers' height).
    // `faceCamera`: the animals look at the camera, not away from it.
    { name: 'The Hunt', prop: 'hunt', coord: [-105.49, 40.056], basis: 'the snowy forest west of Boulder (a deer and a rabbit, as Ellie hunts in the game)', close: true, scale: 4, faceCamera: true },
    { name: 'Cabin Resort', prop: 'cabins', coord: [-105.5042, 40.0315], basis: 'Silver Lake, Boulder County (the map marker)', scale: 2 }, // twice the usual size
  ],
  10: [
    // Walking north into the Salt Lake valley: a ladder left lying on the ground in Lehi, right
    // beside the walk (`close`), small — a fifth of the giraffes' size (`scale: 0.4`). On the
    // town's side of the walk, a step north-east of where it passes (-111.8427, 40.3971); the
    // other side runs down to Utah Lake, and it must not stand near the water.
    { name: 'The Ladder', prop: 'ladder', coord: [-111.8352, 40.4016], basis: 'Lehi, Utah, at the south end of the Salt Lake valley', close: true, scale: 0.4 },
    // The giraffes, met around the bus depot — in the valley's south (Riverton), on the valley
    // side west of I-15 (not the mountains). Far enough south that they are passed in the middle
    // of "Bus Depot", not at its very end, where they were still on screen in "The Firefly Lab"
    // (the game's depot is fictional).
    { name: 'The Giraffes', prop: 'giraffe', coord: [-111.9391, 40.5219], basis: 'Riverton, Utah, in the south of the Salt Lake valley, by the bus depot (fictional)', scale: 2 }, // twice the usual size
  ],
  // The walk ends at the hospital: it stands straight ahead of them at the end of the route,
  // facing them, so they walk right up to its front, as if entering (`arrive`).
  11: [{ name: 'The Hospital', prop: 'hospital', coord: [-111.857112, 40.686071], basis: "St. Mark's Hospital (the basis of St. Mary's)", arrive: true, scale: 1.4 }],
  // Home: the town stands right beside the end of the journey (`close`).
  12: [{ name: 'Jackson', prop: 'town', coord: [-110.762, 43.4799], basis: 'Jackson, Wyoming', close: true }],
};

/**
 * How far each prop reaches from its centre (model metres, the characters' scale) — its
 * footprint "radius". Used to keep props clear of the route and of each other.
 */
export const PROP_RADIUS: Readonly<Record<PropKind, number>> = {
  house: 1.9,
  checkpoint: 2.3,
  slums: 2.1,
  cargo: 2,
  wall: 2.3,
  trees: 1.8,
  hunt: 1.9,
  burningHouse: 1.6,
  towers: 1.9,
  museum: 2.1,
  capitol: 2.3,
  safehouse: 1.9,
  graveyard: 2,
  school: 2.3,
  hotel: 1.6,
  bridge: 2.4,
  sewer: 1.7,
  boat: 1.3,
  autumnTrees: 1.2,
  ladder: 1.4,
  suburb: 2.3,
  dam: 2.4,
  ranch: 2.3,
  campus: 2.1,
  lab: 1.9,
  cabins: 2.2,
  hospital: 2.1,
  giraffe: 1.1,
  town: 2.3,
};
