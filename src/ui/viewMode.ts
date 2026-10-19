/**
 * viewMode.ts — the two experiences the app offers on top of the same map.
 *
 *   journey – the cinematic story: route, travellers, slideshow, timeline, camera follow.
 *   explore – "Explore the map": a free map of the USA with only the location markers;
 *             clicking one opens a card to read about the place. No route, no story.
 */
export type ViewMode = 'journey' | 'explore';
