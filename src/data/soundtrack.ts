/**
 * soundtrack.ts — the playlist.
 *
 * The ORDER is copied from the original ThePlayer.vue, which played the songs
 * in this sequence (note: not the same as the numbers in the file names) and
 * looped back to the first track at the end. Durations were measured from the
 * files and are only used until the browser reads the real duration.
 *
 * Music: The Last of Us original soundtrack by Gustavo Santaolalla.
 */
import type { Track } from './types';

const ARTIST = 'Gustavo Santaolalla';
const BASE = 'server/assets/music';

export const SOUNDTRACK: readonly Track[] = [
  { id: 'seasons', title: 'Seasons', artist: ARTIST, src: `${BASE}/1_Seasons.mp3`, durationHint: 120.3 },
  { id: 'the-last-of-us', title: 'The Last of Us', artist: ARTIST, src: `${BASE}/5_The_Last_of_Us.mp3`, durationHint: 183.4 },
  { id: 'the-path', title: 'The Path', artist: ARTIST, src: `${BASE}/4_The_Path.mp3`, durationHint: 88.8 },
  { id: 'all-gone', title: 'All Gone (No Escape)', artist: ARTIST, src: `${BASE}/2_All_Gone(No_Escape).mp3`, durationHint: 174.2 },
  { id: 'the-path-vacant', title: 'The Path (Vacant)', artist: ARTIST, src: `${BASE}/3_The_Path_(Vacant).mp3`, durationHint: 179.0 },
  { id: 'the-path-new-beginning', title: 'The Path (A New Beginning)', artist: ARTIST, src: `${BASE}/6_The_Path_New_Beginning.mp3`, durationHint: 167.0 },
];

/** Short "click" sound the old main menu played on hover. */
export const UI_CLICK_SOUND = `${BASE}/click.m4a`;
