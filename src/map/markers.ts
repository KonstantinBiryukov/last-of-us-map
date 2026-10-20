/**
 * markers.ts — the round location markers and their hover previews.
 *
 * Each marker is a real <button> (so it works with the keyboard and screen
 * readers) placed on the map with mapboxgl.Marker. Its look depends on the
 * story:
 *
 *   visited  – already passed: warm, slightly dimmed.
 *   current  – where the current chapter happens: bright ring that "breathes".
 *   next     – the next destination: dashed outline.
 *   upcoming – still ahead: small and muted.
 *
 * Changing state only swaps a CSS class (done when the chapter changes, never
 * per frame). Hovering or focusing a marker opens a small preview card;
 * clicking it asks the engine to jump to that location's first chapter.
 *
 * LABELS NEVER OVERLAP (declutter): zoomed out, several places are close together
 * (Jackson, Salt Lake City, Fort Collins, Silver Lake; Boston and Lincoln) and their name
 * labels piled on top of each other. After the map moves (at most once per frame), the
 * labels that are showing are placed one by one in order of importance — the open card's
 * place, then the current chapter's, the next destination, then the rest in story order.
 * A label keeps its usual side (below the marker; "Next" above) if that is clear of the
 * labels already placed and of every other marker's icon; otherwise it tries the other
 * side; if both collide it is hidden (hovering its marker still shows it, and zooming in
 * brings it back as the places move apart).
 */
import mapboxgl from 'mapbox-gl';
import type { Map as MapboxMap } from 'mapbox-gl';
import type { Chapter, LocationId, StoryLocation } from '../data/types';
import { optimizedImage } from '../config/assets';

/** How a marker looks, depending on where the story is (see the file header). */
export type MarkerState = 'visited' | 'current' | 'next' | 'upcoming';

/**
 * Which experience the markers serve:
 *   journey – markers show story progress (current / next / visited / upcoming) and a
 *             click jumps the story to that place;
 *   explore – every marker looks the same (no story state) and a click opens the
 *             location's information card.
 */
export type MarkerMode = 'journey' | 'explore';

/** Everything we keep per marker. */
interface MarkerEntry {
  location: StoryLocation;
  /** Mapbox's marker object (keeps the element positioned on the map). */
  marker: mapboxgl.Marker;
  /** The <button> we created. */
  element: HTMLButtonElement;
  /** The state currently applied as a CSS class (null before the first update). */
  state: MarkerState | null;
}

/**
 * Works out each location's state for a given chapter. Pure function (tested).
 *   current – the chapter's location
 *   next    – the first LATER chapter's location that is a different place
 *   visited – any location of an earlier chapter
 *   upcoming – everything else
 */
export function markerStates(
  chapters: readonly Chapter[],
  locations: readonly StoryLocation[],
  chapterIndex: number,
): Map<LocationId, MarkerState> {
  const states = new Map<LocationId, MarkerState>();
  const current = chapters[chapterIndex]?.locationId;
  const next = chapters.slice(chapterIndex + 1).find((c) => c.locationId !== current)?.locationId;
  const visited = new Set(chapters.slice(0, chapterIndex).map((c) => c.locationId));
  for (const location of locations) {
    let state: MarkerState = 'upcoming';
    if (location.id === current) state = 'current';
    else if (location.id === next) state = 'next';
    else if (visited.has(location.id)) state = 'visited';
    states.set(location.id, state);
  }
  return states;
}

/** "Chapter IV · Bill's Town" — used in labels and screen-reader text. */
const ROMAN_LABEL = (c: Chapter) => `${c.label} · ${c.title}`;

export class MarkerLayer {
  /** One entry per location. */
  private entries: MarkerEntry[] = [];
  /** A single shared preview card, moved to whichever marker is hovered. */
  private popup: mapboxgl.Popup;
  private readonly map: MapboxMap;
  private readonly chapters: readonly Chapter[];
  /** Called with the location id when a marker is clicked (MapView decides what that means per mode). */
  private readonly onSelect: (id: LocationId) => void;
  /** Current mode (see MarkerMode). */
  private mode: MarkerMode = 'journey';
  /** Location highlighted in explore mode (its card is open), or null. */
  private selected: LocationId | null = null;
  /** A label re-layout waiting for the next animation frame (null when none is scheduled). */
  private layoutFrame: number | null = null;

  constructor(
    map: MapboxMap,
    locations: readonly StoryLocation[],
    chapters: readonly Chapter[],
    onSelect: (id: LocationId) => void,
  ) {
    this.map = map;
    this.chapters = chapters;
    this.onSelect = onSelect;
    this.popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 26,
      className: 'location-popup',
      maxWidth: '260px',
    });

    for (const location of locations) {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'map-marker';
      const chaptersHere = chapters.filter((c) => c.locationId === location.id);
      element.setAttribute(
        'aria-label',
        // Mode-neutral wording: in the journey a click jumps there, in explore it opens the card.
        `${location.title} — ${chaptersHere.map(ROMAN_LABEL).join(', ')}`,
      );
      const icon = optimizedImage(location.icon);
      // Built with DOM calls (not innerHTML) so no text can ever be interpreted as HTML.
      const ring = document.createElement('span');
      ring.className = 'map-marker__ring';
      const img = document.createElement('img');
      img.className = 'map-marker__icon';
      img.alt = '';
      img.src = icon.src;
      img.draggable = false;
      const label = document.createElement('span');
      label.className = 'map-marker__label';
      label.textContent = location.shortName;
      element.append(ring, img, label);

      element.addEventListener('click', (event) => {
        event.stopPropagation();
        this.onSelect(location.id);
      });
      element.addEventListener('mouseenter', () => this.showPreview(location, chaptersHere));
      element.addEventListener('focus', () => this.showPreview(location, chaptersHere));
      element.addEventListener('mouseleave', () => this.popup.remove());
      element.addEventListener('blur', () => this.popup.remove());

      const marker = new mapboxgl.Marker({ element, anchor: 'center' }).setLngLat([...location.coordinates]).addTo(map);
      // Mapbox marks marker elements as images; ours are real buttons, so say so to assistive technology.
      element.setAttribute('role', 'button');
      this.entries.push({ location, marker, element, state: null });
    }
    // Re-place the labels whenever the map moves or resizes (see LABELS in the header).
    map.on('move', this.scheduleLabelLayout);
    map.on('resize', this.scheduleLabelLayout);
    this.scheduleLabelLayout();
  }

  /** Asks for a label re-layout on the next animation frame (several moves → one layout). */
  private scheduleLabelLayout = (): void => {
    if (this.layoutFrame !== null) return;
    this.layoutFrame = requestAnimationFrame(() => {
      this.layoutFrame = null;
      this.layoutLabels();
    });
  };

  /** Places the labels so none overlaps another label or another marker (file header). */
  private layoutLabels(): void {
    // Which labels are showing at all: every one in explore; in the journey only the
    // current place's and the next destination's (the rest appear on hover).
    const showing = (e: MarkerEntry) => this.mode === 'explore' || e.state === 'current' || e.state === 'next';
    const rank = (e: MarkerEntry) =>
      e.location.id === this.selected ? 0 : e.state === 'current' ? 1 : e.state === 'next' ? 2 : 3;
    // Story order breaks ties (sort is stable, and the entries are already in story order).
    const ordered = this.entries.filter(showing).sort((a, b) => rank(a) - rank(b));
    // Obstacles: every marker's round icon, and each label once it has been placed.
    const icons = this.entries.map((e) => ({ entry: e, rect: (e.element.querySelector('.map-marker__icon') ?? e.element).getBoundingClientRect() }));
    const placed: DOMRect[] = [];
    const GAP = 3; // pixels kept free around each label
    const hits = (r: DOMRect, self: MarkerEntry) =>
      placed.some((p) => overlaps(r, p, GAP)) || icons.some((i) => i.entry !== self && overlaps(r, i.rect, GAP));
    for (const entry of this.entries) {
      if (!showing(entry)) entry.element.classList.remove('map-marker--label-flip', 'map-marker--label-hidden');
    }
    for (const entry of ordered) {
      const label = entry.element.querySelector<HTMLElement>('.map-marker__label');
      if (!label) continue;
      entry.element.classList.remove('map-marker--label-hidden', 'map-marker--label-flip');
      const usual = label.getBoundingClientRect();
      if (!hits(usual, entry)) {
        placed.push(usual);
        continue;
      }
      // The other side of the marker: the same box mirrored across the marker's middle.
      const marker = entry.element.getBoundingClientRect();
      const middle = marker.top + marker.height / 2;
      const flippedTop = 2 * middle - usual.bottom;
      const flipped = new DOMRect(usual.left, flippedTop, usual.width, usual.height);
      if (!hits(flipped, entry)) {
        entry.element.classList.add('map-marker--label-flip');
        placed.push(flipped);
      } else {
        entry.element.classList.add('map-marker--label-hidden');
      }
    }
  }

  /** Updates marker classes for the current chapter. */
  /**
   * Switches between journey and explore looks. Entering explore removes every story
   * class; going back to journey forgets the applied states so the next setChapter()
   * re-applies all of them.
   */
  setMode(mode: MarkerMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.popup.remove();
    for (const entry of this.entries) {
      if (entry.state) entry.element.classList.remove(`map-marker--${entry.state}`);
      entry.state = null;
      entry.element.classList.toggle('map-marker--explore', mode === 'explore');
      entry.element.style.zIndex = '1';
    }
    this.setSelected(mode === 'explore' ? this.selected : null);
    this.scheduleLabelLayout();
  }

  /** Highlights the marker whose information card is open (explore mode). */
  setSelected(id: LocationId | null): void {
    this.selected = id;
    for (const entry of this.entries) {
      const isSelected = entry.location.id === id;
      entry.element.classList.toggle('map-marker--selected', isSelected);
      entry.element.setAttribute('aria-pressed', String(isSelected));
      if (this.mode === 'explore') entry.element.style.zIndex = isSelected ? '3' : '1';
    }
    this.scheduleLabelLayout();
  }

  /** Updates marker classes for the current chapter (called only when the chapter changes). */
  setChapter(chapterIndex: number, locations: readonly StoryLocation[]): void {
    if (this.mode === 'explore') return; // explore markers carry no story state
    const states = markerStates(this.chapters, locations, chapterIndex);
    for (const entry of this.entries) {
      const state = states.get(entry.location.id) ?? 'upcoming';
      if (state === entry.state) continue;
      if (entry.state) entry.element.classList.remove(`map-marker--${entry.state}`);
      entry.element.classList.add(`map-marker--${state}`);
      entry.element.dataset['state'] = state;
      entry.state = state;
      // Keep the current marker on top of its neighbours (Boston and Lincoln are close).
      entry.element.style.zIndex = state === 'current' ? '3' : state === 'next' ? '2' : '1';
    }
    this.scheduleLabelLayout();
  }

  /** Builds the hover card (photo, title, chapters) and shows it above the marker. */
  private showPreview(location: StoryLocation, chaptersHere: readonly Chapter[]): void {
    const photo = optimizedImage(location.photo);
    const root = document.createElement('div');
    root.className = 'location-preview';
    const img = document.createElement('img');
    img.className = 'location-preview__photo';
    img.src = photo.src;
    img.alt = '';
    if (photo.width && photo.height) {
      img.width = photo.width;
      img.height = photo.height;
    }
    if (photo.lqip) img.style.backgroundImage = `url("${photo.lqip}")`;
    const title = document.createElement('div');
    title.className = 'location-preview__title';
    title.textContent = location.title;
    const list = document.createElement('div');
    list.className = 'location-preview__chapters';
    list.textContent = chaptersHere.map(ROMAN_LABEL).join(' · ');
    const hint = document.createElement('div');
    hint.className = 'location-preview__hint';
    hint.textContent = this.mode === 'explore' ? 'Click to read about it' : 'Click to jump here';
    root.append(img, title, list, hint);
    this.popup.setLngLat([...location.coordinates]).setDOMContent(root).addTo(this.map);
  }

  /** Removes all markers and the popup from the map. */
  remove(): void {
    this.map.off('move', this.scheduleLabelLayout);
    this.map.off('resize', this.scheduleLabelLayout);
    if (this.layoutFrame !== null) cancelAnimationFrame(this.layoutFrame);
    this.popup.remove();
    for (const entry of this.entries) entry.marker.remove();
    this.entries = [];
  }
}

/** Do two screen boxes overlap (with `gap` pixels of breathing room)? */
function overlaps(a: DOMRect, b: DOMRect, gap: number): boolean {
  return a.left < b.right + gap && b.left < a.right + gap && a.top < b.bottom + gap && b.top < a.bottom + gap;
}
