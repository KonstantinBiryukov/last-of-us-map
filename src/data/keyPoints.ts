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
  1: [{ name: 'Hometown', prop: 'house', coord: [-97.619095, 30.175858], basis: "south-east Austin, where the escape drive starts (Joel's house is in the Austin suburbs)", close: true, scale: 0.5 }],
  2: [
    // Boston places from scripts/build-street-routes.mjs (the street route's stops).
    // BOSTON_SCALE: see below.
    { name: '20 Years Later', prop: 'checkpoint', coord: [-71.0547, 42.3637], basis: 'North End — the Quarantine Zone (the wiki: the QZ corresponds to the North End)', scale: BOSTON_SCALE },
    { name: 'The Slums', prop: 'slums', coord: [-71.0528, 42.3622], basis: 'the North End waterfront, inside the zone', scale: BOSTON_SCALE },
    // On LAND by the water: the route reaches Long Wharf and turns west along State Street;
    // the containers stand south of it, by Atlantic Avenue (the harbour is to the east).
    { name: 'The Cargo', prop: 'cargo', coord: [-71.0525, 42.3593], basis: "the waterfront by Long Wharf — Robert's place at the docks", scale: BOSTON_SCALE },
    { name: 'Beyond the Wall', prop: 'wall', coord: [-71.0625, 42.3608], basis: 'Cambridge Street, the edge of the zone', scale: BOSTON_SCALE },
  ],
  3: [
    { name: 'Outside', prop: 'trees', coord: [-71.0621, 42.3598], basis: 'Bowdoin Street, Beacon Hill — just past the wall', scale: BOSTON_SCALE },
    { name: 'Downtown', prop: 'towers', coord: [-71.0603, 42.3555], basis: 'Downtown Crossing', scale: BOSTON_SCALE },
    { name: 'The Museum', prop: 'museum', coord: [-71.0575, 42.3588], basis: "Old State House (a museum; the game's museum is fictional)", scale: BOSTON_SCALE },
    // The Capitol Building is the Massachusetts State House (its gold dome: 42.35778 N,
    // 71.06361 W). The trio reaches it as the Boston walk ends (where Tess stays behind),
    // as in the game's last Outskirts section — passing right by it, then on to Lincoln.
    { name: 'The Capitol Building', prop: 'capitol', coord: [-71.06361, 42.35778], basis: 'Massachusetts State House', close: true, scale: BOSTON_SCALE },
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
    { name: 'Hotel Lobby', prop: 'hotel', coord: [-80.0045, 40.4425], basis: 'downtown Pittsburgh (the game’s hotel is fictional)' },
    { name: 'Financial District', prop: 'towers', coord: [-80.0125, 40.452], basis: 'the river front by the Golden Triangle' },
    // The famous yellow bridges ("Three Sisters") link downtown and the North Side across the
    // Allegheny; the game's Pittsburgh bridges are styled on them. Exactly in place, along its axis.
    {
      name: 'Escape the City',
      prop: 'bridge',
      coord: [-80.00361, 40.44556],
      basis: 'the Roberto Clemente (Sixth Street) Bridge across the Allegheny, downtown ↔ North Side',
      exact: { heading: 350 },
    },
  ],
  6: [
    { name: 'Sewers', prop: 'sewer', coord: [-80.0954, 40.5936], basis: "Pittsburgh's northern suburbs" },
    { name: 'Suburbs', prop: 'suburb', coord: [-80.0941, 40.651], basis: "Pittsburgh's northern suburbs" },
  ],
  7: [
    { name: 'Hydroelectric Dam', prop: 'dam', coord: [-110.69, 43.31], basis: "the Snake River south of Jackson (Tommy's dam is fictional)" },
    { name: 'Ranch House', prop: 'ranch', coord: [-110.76, 43.47], basis: 'ranch land just outside Jackson' },
  ],
  8: [
    // The University of Eastern Colorado is modelled on Colorado State University, Fort Collins.
    { name: 'Go Big Horns', prop: 'campus', coord: [-105.085, 40.6], basis: 'Fort Collins, north of the CSU campus' },
    { name: 'Science Building', prop: 'lab', coord: [-105.083, 40.5755], basis: 'the Colorado State University campus' },
  ],
  9: [
    { name: 'The Hunt', prop: 'trees', coord: [-105.49, 40.056], basis: 'the snowy forest west of Boulder' },
    { name: 'Cabin Resort', prop: 'cabins', coord: [-105.5042, 40.0315], basis: 'Silver Lake, Boulder County (the map marker)' },
  ],
  10: [
    // The giraffes, met around the bus depot — out in the southern Salt Lake Valley, well
    // before the city and the hospital (the game's depot is fictional).
    { name: 'The Giraffes', prop: 'giraffe', coord: [-111.885, 40.5], basis: 'the southern Salt Lake Valley, by the bus depot (fictional)' },
  ],
  // The walk ends right at the hospital, which stands beside the route's end.
  11: [{ name: 'The Hospital', prop: 'hospital', coord: [-111.857112, 40.686071], basis: "St. Mark's Hospital (the basis of St. Mary's)", close: true }],
  12: [{ name: 'Jackson', prop: 'town', coord: [-110.762, 43.4799], basis: 'Jackson, Wyoming' }],
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
  towers: 1.9,
  museum: 2.1,
  capitol: 2.3,
  safehouse: 1.9,
  graveyard: 2,
  school: 2.3,
  hotel: 1.6,
  bridge: 2.4,
  sewer: 1.5,
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
