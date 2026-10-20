/**
 * locations.ts — every real place on the journey.
 *
 * DATA MIGRATION: this list was copied 1:1 from the original
 * public/server/info/markers.geojson (same order, same coordinates, same icons,
 * same photos, same description text). Only three things changed:
 *   1. Each location got a stable `id` and a `shortName`.
 *   2. Austin's description contained a broken "\n" that had turned into the
 *      literal text "area.nThe"; it is now split into two paragraphs.
 *   3. Salt Lake City's marker moved from the city's western edge (near the airport,
 *      ~25 km from where the story ends) to downtown Salt Lake City. (It first stood on
 *      St. Mark's Hospital, where the journey ends, but there the glowing marker sat right on
 *      top of the hospital prop and hid it; the hospital prop now marks that spot.)
 *      The original coordinates are kept below as ORIGINAL_SALT_LAKE_CITY.
 *
 * The original GeoJSON file is kept in /public for reference.
 *
 * SOURCE & LICENCE OF THE TEXT: the descriptions match, word for word, The Last
 * of Us Wiki on Fandom (thelastofus.fandom.com, 2019–2020 page revisions), whose
 * text is licensed CC BY-SA 3.0. That licence requires attribution and that
 * adapted text stays under the same licence — the About page and README credit it.
 */
import type { StoryLocation } from "./types";

export const LOCATIONS: readonly StoryLocation[] = [
  {
    id: "austin",
    title: "Austin, Texas",
    shortName: "Austin",
    coordinates: [-97.7431, 30.2672],
    icon: "server/assets/marker_icons/austin.png",
    photo: "server/assets/card_images/austin_card.png",
    description: [
      "Austin was a city in Texas where Joel, Tommy, and Sarah lived before the cordyceps outbreak. Joel and Sarah's house was a short journey from the main city. There was plenty of grassland and even a farm in the area.",
      "The main city had hotels, gas stations, and several bars. There was also a hospital located next to the main 71 highway. There was also a police station in the area, big enough to house at least six police cars. When the outbreak occurred, the city quickly fell into chaos, with many people either dying outright or becoming infected. While fleeing into the city, Joel, Tommy and Sarah noticed a barn on fire. Tommy and Joel briefly remarked that it was owned by a man called Louis, the pair hoping he made it out alive. Years later, Tommy returned to the city and found Joel's old house, the city likely deserted, He claimed there wasn't much left, but he did manage to salvage a photo.",
    ],
  },
  {
    id: "boston",
    title: "Boston, Massachusetts",
    shortName: "Boston",
    coordinates: [-71.05024837, 42.3558849],
    icon: "server/assets/marker_icons/Chapter_quarantinezone.png",
    photo: "server/assets/card_images/boston_card.jpg",
    description: [
      "Boston is the capital city of Massachusetts and where Ellie was born and subsequently lived before meeting Joel. As of 2033, FEDRA and the military currently control it, the city acting as one of the last functioning Quarantine Zones in America. Although Firefly attacks occur frequently, Boston has not devolved into a total war-zone as other cities had. Indeed, Boston currently doesn't experience riots, and the military's hard crack down on the local Fireflies keeps the zone functioning. The Boston QZ corresponds to the real-life North End neighborhood of Boston, known for being the oldest residential community in the city and a hub for Italian-Americans.",
    ],
  },
  {
    id: "lincoln",
    title: "Lincoln, Massachusetts",
    shortName: "Lincoln",
    coordinates: [-71.3225763, 42.4403879],
    icon: "server/assets/marker_icons/lincoln.png",
    photo: "server/assets/card_images/lincoln_icon.jpg",
    description: [
      "Lincoln is a small town in Massachusetts and one of the many locations that Joel and Ellie come across during their journey across the United States of America in The Last of Us. Bill was the sole living resident of the town by the time of the game. Though the 'Mandatory Evacuation Notice' signs place Lincoln in 'Amherst County, Massachusetts', there is no Amherst county in Massachusetts; Lincoln, Massachusetts is located in Middlesex county, which is most likely the town this game refers to, as it is relatively close to Boston. 'Lincoln High School' has never existed in Lincoln, Massachusetts. Lincoln students attend Lincoln-Sudbury Regional High School in neighboring Sudbury, Massachusetts.",
    ],
  },
  {
    id: "pittsburgh",
    title: "Pittsburgh, Pennsylvania",
    shortName: "Pittsburgh",
    coordinates: [-80.0505408, 40.431478],
    icon: "server/assets/marker_icons/pittsburgh.png",
    photo: "server/assets/card_images/pittsburgh_icon.png",
    description: [
      "Pittsburgh is a city in Pennsylvania and one of the many locations that Joel and Ellie visited across the United States in The Last of Us in their quest to find the Fireflies. Hunters currently control the former east coast Quarantine Zone after overthrowing the military. Some of the buildings and structures used in the game are actually real locations. The real interstate 74/US 52 actually only runs from West to East in the Cincinnati area section of I-74 which is the Midwestern terminus of the highway. I-74 currently does not plan on expanding into Pennsylvania but rather in West Virginia, North Carolina, and South Carolina.",
    ],
  },
  {
    id: "jackson",
    title: "Jackson, Wyoming",
    shortName: "Jackson",
    coordinates: [-110.810617, 43.4745759],
    icon: "server/assets/marker_icons/jackson.jpeg",
    photo: "server/assets/card_images/jackson_icon.jpg",
    description: [
      "Jackson County, Wyoming is one of the many locations that Joel and Ellie reach during their journey across the United States in The Last of Us. It is where Tommy and Maria currently reside. Interestingly, no Infected are encountered in the area. The reason for this is unknown, although a possible explanation is the apparent remoteness from any large towns or cities. The county seems like an ideal location to avoid the outbreak, although Tommy mentions that attacks by Infected still occur. Wyoming, as evidenced through the players' journeys with Tommy, has several farms and is rich in both vegetation and wildlife. In the last level of the game, if one looks closely at the town while overlooking it on the hill with Joel, survivors can be seen walking around the town.",
    ],
  },
  {
    id: "fort-collins",
    title: "Fort Collins, Colorado",
    shortName: "Fort Collins",
    coordinates: [-105.081619, 40.573578],
    icon: "server/assets/marker_icons/collins.jpeg",
    photo: "server/assets/card_images/university.jpg",
    description: [
      "While the University of Eastern Colorado is not a real-life university and despite the campus map mentioning the location in Boulder, it is modeled after Colorado State University in Fort Collins. One of the newspaper clippings inside the Science building in the room to the left of the way in is from The Times newspaper August 9th 2011 edition on the London Riots. The Left Behind DLC explores the aftermath of this chapter. Specifically, it reveals that the trio fled to the Colorado Mountain Plaza, pursued by a splinter group from the cannibals.",
    ],
  },
  {
    id: "silver-lake",
    title: "Silver Lake, Boulder, Colorado",
    shortName: "Silver Lake",
    coordinates: [-105.5042227, 40.0314944],
    icon: "server/assets/marker_icons/lake.png",
    photo: "server/assets/card_images/silver_lake.jpg",
    description: [
      "Silver Lake is a town in Colorado that Joel and Ellie stumbled upon in the chapter Lakeside Resort. It is inhabited by cannibals. In reality, there are three locations known as 'Silver Lake' in Colorado: one is a lake west of Boulder, the other is a suburban lake in Loveland, and the last is a lake near Telluride.",
    ],
  },
  {
    id: "salt-lake-city",
    title: "Salt Lake City, Utah",
    shortName: "Salt Lake City",
    // Downtown Salt Lake City, clear of the hospital prop: see note 3 at the top of this file.
    coordinates: [-111.891, 40.7608],
    icon: "server/assets/marker_icons/firefly.jpg",
    photo: "server/assets/card_images/utah_icon.jpg",
    description: [
      "Salt Lake City is the capital city of Utah and is the last location that Joel and Ellie journey to in order to find the Fireflies in The Last of Us. The hospital in the city is a major base for the Fireflies, the city itself currently being an abandoned quarantine zone. When Joel and Ellie first enter Salt Lake City, the Salt Lake Temple of the Church of Jesus Christ of Latter-day Saints, also known as Mormons, can be seen as part of the skyline. In fact, the Temple is the one of the few buildings that actually exists in real life along with the Wells Fargo building and Saint Mark's Hospital, the basis for Saint Mary's Hospital. The surrounding skyscrapers and St. Mary's Hospital do not exist in real-life Salt Lake City. By the appearance of the road signs and the location of the skyline, Joel and Ellie appear to enter Salt Lake City along I-15/I-80, from the west side of the city. The baseball field shown in the foreground when Joel and Ellie first enter Salt Lake City is Bethany Clare Field.",
    ],
  },
];

/** Salt Lake City's marker position in the original markers.geojson (before note 3). */
export const ORIGINAL_SALT_LAKE_CITY = [-112.2006695, 40.7762691] as const;

/** Fast lookup: location id → location. */
export const LOCATIONS_BY_ID: ReadonlyMap<string, StoryLocation> = new Map(
  LOCATIONS.map((location) => [location.id, location]),
);
