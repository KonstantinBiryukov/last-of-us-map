/**
 * camera.ts — the "director" that moves the map camera.
 *
 * Three modes:
 *   follow   – the camera glides after Joel and Ellie. It looks slightly AHEAD
 *              of them (so you see where they are going) and picks a zoom that
 *              keeps their on-screen speed comfortable: zoomed in for a slow
 *              walk through a city, zoomed out for a long ride. During a JUMP
 *              (a stretch with no detailed path) it pulls out to show the whole
 *              leap, then dives back in at the other end.
 *   overview – the whole journey framed at once.
 *   free     – the user is in control ("Explore the map"). The camera never moves
 *              on its own.
 *
 * WHAT THE USER MAY DO DURING THE JOURNEY (see `applyInteraction`)
 * Only ZOOM. Dragging the map away let the travellers walk off-screen while the story
 * kept playing, so panning (drag, keyboard arrows, box zoom, double-click zoom, which
 * all move the centre) is switched off in the journey. Wheel, pinch and the +/− buttons
 * still zoom, and they do NOT stop following: they change an offset (`zoomOffset`, e.g.
 * +1 = one level closer than the camera's own choice) that follow keeps applying, so the
 * zoom always happens around the travellers. Mapbox's own wheel/pinch zoom cannot be used
 * for this: follow moves the camera every frame, and every such move cancels a zoom
 * gesture Mapbox has just begun. So in the journey the wheel and two-finger pinch are read
 * here (`onWheel`, `onTouch…`) and turned into offset changes.
 * In "Explore the map" everything is Mapbox's again — that mode is for free browsing.
 *
 * Story navigation (next/previous chapter, clicking a location, releasing the
 * timeline) ALWAYS switches back to "follow" and flies to the new spot — that is
 * what the user asked to see.
 *
 * Smoothness: every frame the camera moves a fraction of the remaining way to
 * its target ("exponential smoothing"). The fraction is computed from dt, so
 * the glide feels identical at 30, 60 or 120 fps:
 *     k = 1 − e^(−dt × speed)      (dt = seconds since the last frame)
 *     value += (target − value) × k
 *
 * RELIABLE FLIGHTS (the trick that fixes "the camera did not follow")
 * When a new flyTo starts while another is still running, Mapbox stops the old
 * one and fires a `moveend` for it. If we treated that as "our flight is done",
 * the per-frame follow code would immediately take over and cancel the NEW
 * flight. So every flight carries an id (Mapbox passes extra "eventData" along
 * with the events it causes), and only the `moveend` of the CURRENT flight ends it.
 */
import type { LngLatBoundsLike, Map as MapboxMap } from 'mapbox-gl';
import type { PlaybackEngine } from '../playback/engine';
import { haversineMeters, type MutableLngLat } from '../geo/polyline';
import { metersPerPixel } from '../geo/mercator';
import { isJumpKind } from '../playback/timeline';
import { comfortableZoom, MAX_FOLLOW_ZOOM } from '../playback/followZoom';

export type CameraMode = 'follow' | 'free' | 'overview';

type Listener = () => void;

/** Camera tilt while following, in degrees (0 = straight down). */
const FOLLOW_PITCH = 52;
/** Smoothing speeds (bigger = snappier). Jumps use faster zoom so the swoop fits in 4.5 s. */
const CENTRE_SPEED = 2.6;
const ZOOM_SPEED = 0.9;
const JUMP_ZOOM_SPEED = 2.4;
const PITCH_SPEED = 1.5;
/** How fast the map turns towards a part's heading (see PartCamera in data/types.ts). */
const BEARING_SPEED = 1.1;
/**
 * How far (zoom levels) the user may zoom out (−) or in (+) from the camera's own choice.
 * Out: only one level, so the travellers never become specks. In: just 1 level — enough to get
 * a little closer, but not so close that the walking models fill the screen.
 */
const MIN_ZOOM_OFFSET = -1;
const MAX_ZOOM_OFFSET = 1;
/**
 * The box "Explore the map" is fenced into: 150° of longitude by 7°–72° N (Panama up into the
 * Canadian Arctic). With the fence, Mapbox will not show anything outside the box, so zoomed
 * out as far as it goes the box fills the view and the map is LOCKED in place.
 *
 * USA IN THE MIDDLE: Mapbox fits the box to the part of the screen NOT covered by the panels
 * (the map padding — the story panel on the left), so when locked, the middle of the BOX is in
 * the middle of THAT area, which is right of the screen's middle. The fence is therefore
 * shifted east by exactly that difference (see exploreFence), so the locked view has the
 * middle of the USA (−95°) in the middle of the whole screen. With no side panel (phones) the
 * shift is zero and the box is centred on the USA.
 */
const USA_CENTRE_LNG = -95;
const FENCE_HALF_WIDTH = 75;
const FENCE_SOUTH = 7;
const FENCE_NORTH = 72;
/** The fence centred on the USA, before the shift for the panels. */
const NORTH_AMERICA: [[number, number], [number, number]] = [
  [USA_CENTRE_LNG - FENCE_HALF_WIDTH, FENCE_SOUTH],
  [USA_CENTRE_LNG + FENCE_HALF_WIDTH, FENCE_NORTH],
];
/** Zoom levels per wheel "pixel" (a typical mouse notch is 100 px → ~0.4 levels). */
const WHEEL_ZOOM_RATE = 1 / 250;
/** Right after a user zoom, the camera zooms this much faster, so the gesture feels direct. */
const USER_ZOOM_SPEED = 6;
const USER_ZOOM_BOOST_MS = 700;
/**
 * How long story flights last (ms). The duration grows with the LOGARITHM of the distance
 * (see flightDuration): within a city ≈ 2 s, to a nearby town ≈ 3 s, to another state or
 * across the country ≈ 4.5–5 s. A straight "ms per pixel" rule hit its cap for almost every
 * chapter change, so long flights crammed a continent into the same time as a short one —
 * that is what felt like rushing.
 */
const FLIGHT_MIN_MS = 2000;
const FLIGHT_MAX_MS = 5000;
/**
 * Easing of story flights: "ease in-out sine" — starts and ends gently, with no sudden lurch
 * (Mapbox's default curve accelerates quite sharply at the start). t = 0…1 → progress 0…1.
 */
const flightEasing = (t: number): number => 0.5 - Math.cos(Math.PI * t) / 2;

export interface CameraOptions {
  /** Returns true when the user prefers reduced motion (we then cut instead of flying). */
  reducedMotion: () => boolean;
  /** Coordinates of every location marker (for framing the Explore view). */
  locationCoords: readonly (readonly [number, number])[];
}

export class CameraDirector {
  /** Current mode (see the top of this file). */
  private mode: CameraMode = 'overview';
  /** React components listening for mode changes (the Follow/Overview buttons). */
  private listeners = new Set<Listener>();
  /** Id of the flight in progress, or 0 when no flight is running. */
  private flightId = 0;
  /** Increasing counter used to give every flight a unique id. */
  private flightCounter = 0;
  /** Scratch arrays reused every frame (no garbage). */
  private readonly target: MutableLngLat = [0, 0];
  private readonly ahead: MutableLngLat = [0, 0];
  /** The camera's own smoothed values (we keep them instead of reading the map, to avoid drift). */
  private centre: MutableLngLat = [0, 0];
  private zoom = 9;
  private pitch = 0;
  /** Smoothed map heading (degrees; 0 = north up). Only parts with `camera.heading` or `camera.bearing` turn it. */
  private bearing = 0;
  private readonly map: MapboxMap;
  private readonly engine: PlaybackEngine;
  private readonly options: CameraOptions;
  /** Marker coordinates (copied from the options for convenience). */
  private readonly locationCoords: readonly (readonly [number, number])[];
  /**
   * Precomputed comfortable zoom per leg PART, keyed "chapterIndex:spanIndex". Per part, not
   * per leg, because one leg can be travelled at very different speeds (Boston → Lincoln is
   * a slow city walk in Boston and a fast, compressed walk to Lincoln).
   */
  private readonly spanZoom: Map<string, number>;
  /**
   * True in "Explore the map": the camera then belongs to the user completely and
   * story jumps are ignored (the story is not on screen in that mode).
   */
  private exploring = false;
  /** The user's own zoom on top of the camera's choice while following (see the top of this file). */
  private zoomOffset = 0;
  /** When the user last changed the zoom offset (performance.now() ms), for the fast-zoom boost. */
  private userZoomAt = -Infinity;
  /** Finger distance (px) of the two-finger pinch in progress, or 0 when there is none. */
  private pinchDistance = 0;
  /**
   * The last camera move we started (fly to the story, frame the journey, frame the
   * locations). If something interrupts it before it finishes — e.g. the panels change
   * size and the map padding is updated, which stops Mapbox animations — we restart it.
   */
  private lastFlight: (() => void) | null = null;
  /** Zoom that frames each jump arc completely; computed lazily (needs the current screen size). */
  private jumpZoom = new Map<number, number>();
  private readonly unsubscribeJump: () => void;

  constructor(map: MapboxMap, engine: PlaybackEngine, options: CameraOptions) {
    this.map = map;
    this.engine = engine;
    this.options = options;
    this.locationCoords = options.locationCoords;
    this.spanZoom = this.computeSpanZooms();

    // Any camera movement that comes from a real mouse/touch/keyboard event means "the user is in control".
    for (const type of ['dragstart', 'rotatestart', 'pitchstart', 'zoomstart'] as const) {
      map.on(type, this.onUserMove);
    }
    map.on('moveend', this.onMoveEnd);
    // Journey zoom gestures (see the top of this file). Passive: false so the page does not scroll.
    const container = map.getContainer();
    container.addEventListener('wheel', this.onWheel, { passive: false });
    container.addEventListener('touchstart', this.onTouchStart, { passive: true });
    container.addEventListener('touchmove', this.onTouchMove, { passive: false });
    container.addEventListener('touchend', this.onTouchEnd);
    container.addEventListener('touchcancel', this.onTouchEnd);
    // The screen size changed → jump framing must be recomputed.
    map.on('resize', this.onResize);
    // Story navigation (chapter buttons, timeline, markers in the journey) → follow and fly there.
    this.unsubscribeJump = engine.onJump(() => {
      if (!this.exploring) this.follow();
    });
    this.applyInteraction(); // the app starts in the journey: zoom only
  }

  // ───────────────────────── store for React (useSyncExternalStore) ─────────────────────────

  /** Current mode (stable function reference, as React requires). */
  getMode = (): CameraMode => this.mode;

  /** Lets React re-render when the mode changes. Returns an unsubscribe function. */
  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private setModeInternal(mode: CameraMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    for (const l of this.listeners) l();
  }

  // ───────────────────────── public commands ─────────────────────────

  /** Start (or restart) following the travellers, with a short flight to them. */
  follow(): void {
    this.setModeInternal('follow');
    this.flyToStory();
  }

  /** Frame the whole journey; the camera then stays put ("overview" mode). */
  overview(): void {
    this.setModeInternal('overview');
    this.frameJourney();
  }

  /**
   * Enter or leave "Explore the map". Entering frames all locations once and then
   * leaves the camera entirely to the user ("free"); leaving just re-enables story jumps
   * (the journey then decides where to fly).
   */
  setExploring(exploring: boolean): void {
    if (exploring === this.exploring) return;
    this.exploring = exploring;
    this.applyInteraction();
    if (exploring) this.frameLocations();
  }

  /** Frames every location marker (the "home" view of Explore the map); the camera stays free. */
  frameLocations(): void {
    this.lastFlight = () => this.frameLocations();
    const coords = this.locationCoords.flatMap((c) => [c[0], c[1]]);
    const reduced = this.options.reducedMotion();
    const id = ++this.flightCounter;
    this.flightId = reduced ? 0 : id;
    this.setModeInternal('free');
    // Work out the camera that fits all markers (and their name labels), at most zoom 6.
    // There is no lower limit any more: a phone needs to zoom out further (to ~1.7) to show
    // every place from Salt Lake City to Boston — the old minimum of 2.8 cut the West off —
    // and the North America fence (applyInteraction) already stops Mapbox from zooming out
    // past the continent. The margin around the markers is smaller on narrow screens, but
    // always wider than half a name label, so labels at the edges are not cut off.
    // cameraForBounds returns undefined when the padding leaves no room (e.g. for a moment
    // while the panels are changing size); then retry with a small margin instead.
    const bounds = boundsOf(coords);
    const width = this.map.getContainer().clientWidth;
    const margin = width < 600 ? 46 : 50;
    const camera =
      this.map.cameraForBounds(bounds, { padding: this.overviewPadding(margin) }) ??
      this.map.cameraForBounds(bounds, { padding: 20 });
    const zoom = Math.min(6, camera?.zoom ?? 3.5);
    this.map.easeTo(
      { center: camera?.center ?? [-96, 39], zoom, pitch: 0, bearing: 0, duration: reduced ? 0 : 1800 },
      { flightId: id },
    );
  }

  /**
   * Updates the map padding (space covered by panels). Mapbox stops any running camera
   * animation when the padding changes, so if one of OUR flights was in progress we
   * start it again with the new padding — otherwise a mode switch could leave the camera
   * stranded halfway.
   */
  setPadding(padding: { top: number; right: number; bottom: number; left: number }): void {
    const wasFlying = this.flightId !== 0;
    this.map.setPadding(padding);
    // The panels moved: re-centre the fence. Not mid-flight — measuring jumps the camera, which
    // would cut the flight short (the next panel change or resize catches up).
    if (this.exploring && !wasFlying) this.refreshExploreFence();
    if (wasFlying && this.lastFlight) {
      this.jumpZoom.clear(); // the visible area changed, so jump framing must be recomputed
      this.lastFlight();
    }
  }

  /** Hand control to the user (e.g. they pressed a zoom button). */
  release(): void {
    this.flightId = 0;
    this.setModeInternal('free');
  }

  /**
   * Zoom buttons: one level in (+1) or out (−1). While following, this changes the user's
   * zoom offset (the camera glides there and keeps following); otherwise it zooms the map.
   */
  zoomBy(delta: number): void {
    if (this.mode === 'follow' && !this.exploring) {
      this.changeZoomOffset(delta);
      return;
    }
    this.map.easeTo({ zoom: this.map.getZoom() + delta, duration: this.options.reducedMotion() ? 0 : 400 });
  }

  /** Instantly frame the journey (used before the map is first shown). */
  jumpToOverview(): void {
    this.mode = 'overview';
    const camera = this.map.cameraForBounds(this.journeyBounds(), { padding: this.overviewPadding() });
    if (camera) this.map.jumpTo({ ...camera, pitch: 0, bearing: 0 });
  }

  /** Called by the single FrameLoop every frame. */
  frame(dt: number): void {
    if (this.mode !== 'follow' || this.flightId !== 0) return; // only glide when following and not flying

    const { zoom, look, jumping, bearing } = this.storyTarget(true);
    const kCentre = 1 - Math.exp(-dt * CENTRE_SPEED);
    const boosted = performance.now() - this.userZoomAt < USER_ZOOM_BOOST_MS;
    const kZoom = 1 - Math.exp(-dt * (boosted ? USER_ZOOM_SPEED : jumping ? JUMP_ZOOM_SPEED : ZOOM_SPEED));
    const kPitch = 1 - Math.exp(-dt * PITCH_SPEED);
    this.centre[0] += (look[0] - this.centre[0]) * kCentre;
    this.centre[1] += (look[1] - this.centre[1]) * kCentre;
    this.zoom += (zoom - this.zoom) * kZoom;
    // Flatten the view during a jump (easier to read a cross-country arc from above).
    const pitchTarget = this.options.reducedMotion() ? 30 : jumping ? 25 : FOLLOW_PITCH;
    this.pitch += (pitchTarget - this.pitch) * kPitch;
    // Turn the shortest way round: the difference wrapped into −180…180° (350° → 10° is +20°).
    const turn = ((bearing - this.bearing + 540) % 360) - 180;
    this.bearing += turn * (1 - Math.exp(-dt * BEARING_SPEED));
    this.map.jumpTo({ center: this.centre, zoom: this.zoom, pitch: this.pitch, bearing: this.bearing });
  }

  /** Remove all listeners (called when the map is destroyed). */
  dispose(): void {
    for (const type of ['dragstart', 'rotatestart', 'pitchstart', 'zoomstart'] as const) {
      this.map.off(type, this.onUserMove);
    }
    this.map.off('moveend', this.onMoveEnd);
    const container = this.map.getContainer();
    container.removeEventListener('wheel', this.onWheel);
    container.removeEventListener('touchstart', this.onTouchStart);
    container.removeEventListener('touchmove', this.onTouchMove);
    container.removeEventListener('touchend', this.onTouchEnd);
    container.removeEventListener('touchcancel', this.onTouchEnd);
    this.map.off('resize', this.onResize);
    this.unsubscribeJump();
    this.listeners.clear();
  }

  // ───────────────────────── internals ─────────────────────────

  /**
   * Switches the map's mouse/touch/keyboard handlers for the current experience:
   * explore → all of Mapbox's handlers; journey → none (zoom gestures are read by this
   * class instead, see the top of this file). Rotation and tilt stay off in both.
   */
  private applyInteraction(): void {
    const map = this.map;
    const free = this.exploring;
    for (const handler of [map.dragPan, map.keyboard, map.boxZoom, map.doubleClickZoom, map.scrollZoom, map.touchZoomRotate]) {
      if (free) handler.enable();
      else handler.disable();
    }
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    // Explore stays over North America: with maxBounds Mapbox refuses to pan past the box
    // and to zoom out so far that anything outside it would show. The journey needs no
    // fence (the camera director moves the camera there), so it is removed again.
    // (Mapbox removes the fence when given null; its TypeScript types only list a box.)
    // (The box is shifted for the panels so the USA ends up in the middle — see exploreFence.)
    if (free) this.refreshExploreFence();
    else map.setMaxBounds(null as unknown as LngLatBoundsLike);
    // Without panning, the "grab" hand cursor would promise something that does nothing.
    map.getContainer().classList.toggle('map--zoom-only', !free);
  }

  /** A camera movement started. If a human caused it, react (see the top of this file). */
  private onUserMove = (event: object): void => {
    // Programmatic moves (our own jumpTo/flyTo) have no originalEvent; real mouse/touch/wheel moves do.
    if (!('originalEvent' in event) || !event.originalEvent) return;
    if (!this.exploring) return; // journey: Mapbox's handlers are off, nothing can take over
    this.flightId = 0;
    this.setModeInternal('free');
  };

  /** Changes the user's zoom offset by `delta` levels (clamped) and boosts the zoom speed. */
  private changeZoomOffset(delta: number): void {
    this.zoomOffset = clamp(this.zoomOffset + delta, MIN_ZOOM_OFFSET, MAX_ZOOM_OFFSET);
    this.userZoomAt = performance.now();
  }

  /** Is a journey zoom gesture meaningful right now? (Following, not in Explore.) */
  private journeyZoom(): boolean {
    return !this.exploring && this.mode === 'follow';
  }

  /** Mouse wheel / trackpad scroll in the journey: wheel up = closer. */
  private onWheel = (event: WheelEvent): void => {
    if (this.exploring) return; // Explore: Mapbox's own scroll zoom handles it
    event.preventDefault(); // never scroll the page behind the map
    if (!this.journeyZoom()) return;
    // deltaMode 1 = lines (some mice/Firefox): about 40 px per line.
    const pixels = event.deltaMode === 1 ? event.deltaY * 40 : event.deltaY;
    this.changeZoomOffset(-pixels * WHEEL_ZOOM_RATE);
  };

  /** Two fingers down: remember their distance (the start of a pinch). */
  private onTouchStart = (event: TouchEvent): void => {
    this.pinchDistance = !this.exploring && event.touches.length === 2 ? touchDistance(event.touches) : 0;
  };

  /** Two fingers moving: zoom by how much their distance changed (doubling it = one level closer). */
  private onTouchMove = (event: TouchEvent): void => {
    if (this.exploring || this.pinchDistance === 0 || event.touches.length !== 2) return;
    event.preventDefault(); // no browser page zoom
    const distance = touchDistance(event.touches);
    if (this.journeyZoom() && distance > 0) this.changeZoomOffset(Math.log2(distance / this.pinchDistance));
    this.pinchDistance = distance;
  };

  private onTouchEnd = (event: TouchEvent): void => {
    if (event.touches.length < 2) this.pinchDistance = 0;
  };

  /** A camera movement ended. Only the end of OUR current flight matters (see top of file). */
  private onMoveEnd = (event: object): void => {
    const id = 'flightId' in event ? event.flightId : undefined;
    if (this.flightId === 0 || id !== this.flightId) return;
    this.flightId = 0;
    // Continue smoothly from wherever the flight ended.
    const c = this.map.getCenter();
    this.centre = [c.lng, c.lat];
    this.zoom = this.map.getZoom();
    this.pitch = this.map.getPitch();
    this.bearing = this.map.getBearing();
  };

  private onResize = (): void => {
    this.jumpZoom.clear();
    // A new screen shape: the panel shift is another number of degrees. (Not mid-flight: the
    // measuring jumps would cut a flight short; the next resize or panel change catches up.)
    if (this.exploring && this.flightId === 0) this.refreshExploreFence();
  };

  /**
   * The fence for "Explore the map" (see NORTH_AMERICA): the box, shifted east so that when
   * zoomed all the way out — where the fence locks the view — the USA is in the middle of the
   * whole screen rather than of the area beside the panel.
   *
   *   shift (pixels)  = half of (left panel − right panel): how far the middle of the
   *                     uncovered area is from the middle of the screen
   *   shift (degrees) = pixels × 360° ÷ the world's width in pixels at the zoom-out limit
   *                     (512 × 2^zoom)
   *
   * The zoom-out limit depends on the screen's shape, the panels and the tilt, so instead of
   * calculating it we MEASURE it with the unshifted box (shifting sideways does not change it):
   * ask for zoom 0 — Mapbox stops at the limit — read the zoom, and put the camera straight
   * back. Both jumps happen before the next frame is drawn, so nothing is seen.
   */
  /** Re-measures the fence only when the screen size or the panels changed since last time. */
  private lastFenceKey = '';
  private refreshExploreFence(): void {
    const p = this.map.getPadding();
    const c = this.map.getContainer();
    const key = `${c.clientWidth}x${c.clientHeight}:${p.left ?? 0},${p.right ?? 0},${p.top ?? 0},${p.bottom ?? 0}`;
    if (key === this.lastFenceKey && this.map.getMaxBounds()) return; // same shape: same fence
    this.lastFenceKey = key;
    this.map.setMaxBounds(this.exploreFence());
  }

  private exploreFence(): [[number, number], [number, number]] {
    const map = this.map;
    const padding = map.getPadding();
    const shiftPx = ((padding.left ?? 0) - (padding.right ?? 0)) / 2;
    if (Math.abs(shiftPx) < 1) return NORTH_AMERICA;
    const centre = map.getCenter();
    const zoom = map.getZoom();
    map.setMaxBounds(NORTH_AMERICA);
    map.jumpTo({ zoom: 0 });
    const floor = map.getZoom();
    map.jumpTo({ center: centre, zoom });
    const shiftDeg = (shiftPx * 360) / (512 * 2 ** floor);
    const middle = USA_CENTRE_LNG + shiftDeg;
    return [
      [middle - FENCE_HALF_WIDTH, FENCE_SOUTH],
      [middle + FENCE_HALF_WIDTH, FENCE_NORTH],
    ];
  }

  /** Cinematic flight to the travellers' current position. */
  private flyToStory(): void {
    this.lastFlight = () => this.flyToStory();
    const { zoom, look, bearing } = this.storyTarget(true);
    if (this.options.reducedMotion()) {
      this.flightId = 0;
      this.centre = [look[0], look[1]];
      this.zoom = zoom;
      this.pitch = 30;
      this.bearing = bearing;
      this.map.jumpTo({ center: this.centre, zoom, pitch: 30, bearing });
      return;
    }
    // Duration grows with how far the camera must travel, measured as the GROUND distance in
    // pixels of the current zoom. (Projecting the target on screen does not work for far
    // targets: in a tilted view a point beyond the horizon projects to a misleadingly small
    // distance, so a flight across the country was timed like a short hop.)
    const centre = this.map.getCenter();
    const metres = haversineMeters([centre.lng, centre.lat], [look[0], look[1]]);
    const pixels = metres / metersPerPixel(this.map.getZoom(), centre.lat) + Math.abs(zoom - this.map.getZoom()) * 400;
    const duration = flightDuration(pixels);
    const id = ++this.flightCounter;
    this.flightId = id;
    // The second argument is "eventData": Mapbox copies it onto the movestart/moveend events.
    this.map.flyTo(
      { center: [look[0], look[1]], zoom, pitch: FOLLOW_PITCH, bearing, curve: 1.42, duration, easing: flightEasing, essential: false },
      { flightId: id },
    );
  }

  /** Fits the whole journey on screen (the Overview button, and the end of the story). */
  private frameJourney(): void {
    this.lastFlight = () => this.frameJourney();
    const reduced = this.options.reducedMotion();
    const id = ++this.flightCounter;
    this.flightId = reduced ? 0 : id;
    this.map.fitBounds(
      this.journeyBounds(),
      { padding: this.overviewPadding(), pitch: reduced ? 0 : 20, bearing: 0, duration: reduced ? 0 : 2200 },
      { flightId: id },
    );
  }

  /**
   * Where the camera should be for the current story moment.
   *   zoom    – comfortable zoom for the current leg (or the framing zoom of a jump),
   *             plus the user's zoom offset when `withUserZoom` is true
   *   look    – the point to centre on (slightly ahead of the travellers)
   *   jumping – true during jumps and time skips
   *   bearing – the map heading: 0 (north up), or for a part with `camera.heading: 'route'`
   *             the travel direction, so they move up the screen
   */
  private storyTarget(withUserZoom: boolean): { zoom: number; look: MutableLngLat; jumping: boolean; bearing: number } {
    const frame = this.engine.frame;
    const journey = this.engine.route.journey;
    journey.pointAt(frame.distance, this.target);
    // A jump: a jump leg, or a `hidden` part of a walked leg (the span's kind says both).
    const currentSpan = this.engine.timeline.chapters[frame.chapterIndex]?.legSpans[frame.spanIndex];
    const jumping = currentSpan !== undefined && isJumpKind(currentSpan.kind);
    let zoom = this.spanZoom.get(`${frame.chapterIndex}:${frame.spanIndex}`) ?? 9;
    if (jumping) zoom = this.zoomForJump(frame.legIndex);
    if (withUserZoom) zoom = clamp(zoom + this.zoomOffset, 1.5, 18.5);
    // Look ~90 px ahead along the route so the travellers sit a little behind centre.
    const ahead = jumping ? 0 : metersPerPixel(zoom, this.target[1]) * 90;
    journey.pointAt(frame.distance + ahead, this.ahead);
    // Heading: averaged over ~250 screen pixels of route either side, so small wiggles do not
    // swing the whole map.
    const span = this.engine.timeline.chapters[frame.chapterIndex]?.legSpans[frame.spanIndex];
    const bearing =
      jumping ? 0
      : span?.camera.heading === 'route' ? journey.bearingAt(frame.distance, metersPerPixel(zoom, this.target[1]) * 250)
      : (span?.camera.bearing ?? 0); // a part's fixed heading (PartCamera.bearing), else north up
    return { zoom, look: this.ahead, jumping, bearing };
  }

  /** The zoom at which the whole arc of jump leg `legIndex` fits on screen (cached). */
  private zoomForJump(legIndex: number): number {
    const cached = this.jumpZoom.get(legIndex);
    if (cached !== undefined) return cached;
    const coords = this.engine.route.legs[legIndex]!.coordinates;
    const bounds = boundsOf(coords.flatMap((c) => [c[0], c[1]]));
    const camera = this.map.cameraForBounds(bounds, { padding: this.overviewPadding() });
    const zoom = Math.min(MAX_FOLLOW_ZOOM, Math.max(2.5, (camera?.zoom ?? 4) - 0.2));
    this.jumpZoom.set(legIndex, zoom);
    return zoom;
  }

  /**
   * For each detailed leg part, the zoom where the travellers move at a comfortable on-screen
   * speed (formula and limits in playback/followZoom.ts).
   */
  private computeSpanZooms(): Map<string, number> {
    const zooms = new Map<string, number>();
    for (const chapter of this.engine.timeline.chapters) {
      for (const [spanIndex, span] of chapter.legSpans.entries()) {
        if (isJumpKind(span.kind)) continue;
        // A pause (Ellie's hunt) does not move at all, so "a comfortable on-screen speed" would
        // mean zooming in without limit: keep the framing of the stretch walked just before it.
        const before = zooms.get(`${chapter.index}:${spanIndex - 1}`);
        if (span.pause && before !== undefined) {
          zooms.set(`${chapter.index}:${spanIndex}`, before);
          continue;
        }
        const lat = this.engine.route.legs[span.legIndex]!.coordinates[0]![1];
        zooms.set(`${chapter.index}:${spanIndex}`, comfortableZoom(span, lat));
      }
    }
    return zooms;
  }

  /**
   * `fitBounds` padding REPLACES the map's own padding (the space under the
   * story panel and player bar), so we add a 50 px margin on top of it ourselves.
   */
  private overviewPadding(margin = 50): { top: number; right: number; bottom: number; left: number } {
    const p = this.map.getPadding();
    return { top: (p.top ?? 0) + margin, right: (p.right ?? 0) + margin, bottom: (p.bottom ?? 0) + margin, left: (p.left ?? 0) + margin };
  }

  private journeyBounds(): LngLatBoundsLike {
    return boundsOf(this.engine.route.journey.coords);
  }
}

/** Distance in pixels between the first two fingers of a touch list. */
function touchDistance(touches: TouchList): number {
  const a = touches[0]!;
  const b = touches[1]!;
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

/**
 * Story flight duration (ms) for a camera move of `pixels` (ground distance in pixels at the
 * current zoom):  1600 + 380 × log2(1 + pixels / 300), kept between FLIGHT_MIN_MS and
 * FLIGHT_MAX_MS. Each doubling of the distance adds only 0.38 s, so far flights take longer
 * but never drag. E.g. at street zoom: 1 km ≈ 2 s, 20 km ≈ 3.2 s, 300+ km = 5 s.
 */
function flightDuration(pixels: number): number {
  return clamp(1600 + 380 * Math.log2(1 + pixels / 300), FLIGHT_MIN_MS, FLIGHT_MAX_MS);
}

/** Keeps `value` between `min` and `max`. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Smallest box containing all points of a flat [lng0, lat0, lng1, lat1, …] list. */
function boundsOf(coords: ArrayLike<number>): LngLatBoundsLike {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (let i = 0; i < coords.length; i += 2) {
    minLng = Math.min(minLng, coords[i]!);
    maxLng = Math.max(maxLng, coords[i]!);
    minLat = Math.min(minLat, coords[i + 1]!);
    maxLat = Math.max(maxLat, coords[i + 1]!);
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}
