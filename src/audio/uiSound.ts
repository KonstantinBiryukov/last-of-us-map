/**
 * uiSound.ts — the menu's short "click" sound, played with the Web Audio API.
 *
 * BROWSER RULE: a page may play no sound until the visitor has clicked, tapped or pressed a key
 * on it — moving the mouse over a button does not count. So the very first hover on a first
 * visit is always silent; the first click/tap/key anywhere switches sound on (Intro.tsx also
 * offers a "Sound on" button for exactly that click).
 *
 * WHY WEB AUDIO (and not an <audio> element): an audio context is switched on by calling
 * `resume()` INSIDE the click/tap/key handler, which every browser accepts, and it then says
 * truthfully whether sound is allowed (`state === 'running'`). The earlier trick — "unlock" an
 * <audio> element by playing it muted — could not tell: browsers allow muted playback even
 * WITHOUT a click, so the page sometimes believed sound was on when it was still blocked, and
 * hover sounds stayed silent until a reload. Web Audio also plays short sounds instantly and
 * lets them overlap.
 *
 * HOW:
 *   preloadUiSound()  – downloads the sound file (allowed without a click)
 *   unlockUiSound()   – call from a click/tap/key handler: creates (or resumes) the audio
 *                       context and decodes the sound; resolves true once sound can play
 *   playUiSound()     – plays it if sound is on; returns false (and stays silent) if not yet
 */
import { assetUrl } from '../config/assets';
import { UI_CLICK_SOUND } from '../data/soundtrack';

/** How loud the click is (0‥1): a soft tick under the music (0.25, made 30 % louder). */
const VOLUME = 0.25 * 1.3;

let bytes: Promise<ArrayBuffer> | null = null;
let context: AudioContext | null = null;
let gain: GainNode | null = null;
let buffer: AudioBuffer | null = null;
let decoding: Promise<AudioBuffer | null> | null = null;

/** Starts downloading the sound (no click needed for that). Safe to call more than once. */
export function preloadUiSound(): void {
  bytes ??= fetch(assetUrl(UI_CLICK_SOUND)).then((response) => response.arrayBuffer());
}

/**
 * Switches sound on. MUST be called from inside a click, tap or key press handler (the browser
 * only allows it there). Resolves true once the context is running and the sound is decoded.
 */
export async function unlockUiSound(): Promise<boolean> {
  preloadUiSound();
  if (!context) {
    // Created inside the handler, so it starts "running" right away (created earlier, it would
    // start "suspended" and the browser would warn about it in the console).
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    context = new AudioContextClass();
    gain = context.createGain();
    gain.gain.value = VOLUME;
    gain.connect(context.destination);
  }
  // resume() is what the click "pays" for; it does nothing if the context is already running.
  const resumed = context.resume().catch(() => undefined);
  const ctx = context;
  decoding ??= bytes!
    .then((data) => ctx.decodeAudioData(data.slice(0))) // slice: decodeAudioData takes ownership of its input
    .then((decoded) => (buffer = decoded))
    .catch(() => null);
  await resumed;
  await decoding;
  return isUiSoundOn();
}

/** True when sound is allowed and the click sound is ready to play. */
export function isUiSoundOn(): boolean {
  return context?.state === 'running' && buffer !== null;
}

/** Plays the click from the start. Returns false (silently) while sound is not on yet. */
export function playUiSound(): boolean {
  if (!isUiSoundOn() || !context || !gain || !buffer) return false;
  const source = context.createBufferSource(); // one-shot: a new source per play (they can overlap)
  source.buffer = buffer;
  source.connect(gain);
  source.start();
  return true;
}
