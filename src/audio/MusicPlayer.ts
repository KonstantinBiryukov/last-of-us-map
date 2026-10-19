/**
 * MusicPlayer.ts — the soundtrack player.
 *
 * WHY NOT HOWLER ANY MORE: the old app used Howler.js, and its play button
 * called `stop()` before `play()`, so every press restarted the song. We now use
 * the browser's built-in <audio> element directly, which already does
 * everything we need: streaming large MP3s, exact pause/resume, seeking,
 * duration, volume — with no extra library.
 *
 * Behaviour:
 *   • play/pause never resets the position; `restart()` does, explicitly.
 *   • tracks play in the original order and loop back to the first (as before).
 *   • the music is INDEPENDENT of the journey: pausing the story or jumping to
 *     another location never touches the music.
 *   • browsers block audio that starts without a user click ("autoplay
 *     policy"). If `play()` is refused we report `blocked` so the UI can show a
 *     friendly "tap to play music" hint instead of failing silently.
 *
 * Like the playback engine, the slow state (track, playing, volume…) is a store
 * React subscribes to, while the fast state (current time, ~4–60×/s) is read
 * directly by the timeline component without causing React renders.
 */
import type { Track } from '../data/types';
import { assetUrl } from '../config/assets';
import { Store } from '../state/store';

export type MusicStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'blocked' | 'error';

/**
 * The slow-changing music state React shows (re-rendered only when one of these changes).
 *   idle    – nothing requested yet        loading – waiting for audio data
 *   playing – sound is coming out          paused  – stopped, position kept
 *   blocked – browser refused autoplay     error   – file could not be loaded/played
 */
export interface MusicState {
  status: MusicStatus;
  /** Index into the playlist. */
  trackIndex: number;
  /** Duration of the current track in seconds (from metadata, or the known hint). */
  duration: number;
  /** 0 (silent) … 1 (full). */
  volume: number;
  /** Mute is separate from volume, so unmuting restores the previous level. */
  muted: boolean;
  /** Human-readable problem description, shown in the player. */
  errorMessage: string | null;
}

/** localStorage key where volume/mute are remembered between visits. */
const VOLUME_KEY = 'tlou-map-volume-v1';

/**
 * Reads the remembered volume/mute. localStorage may be unavailable (private
 * windows, blocked storage) or contain garbage, so everything is validated and
 * wrapped in try/catch, falling back to 70 % volume, not muted.
 */
function loadVolume(): { volume: number; muted: boolean } {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    if (raw) {
      const v = JSON.parse(raw) as { volume?: unknown; muted?: unknown };
      return {
        volume: typeof v.volume === 'number' ? Math.min(1, Math.max(0, v.volume)) : 0.7,
        muted: typeof v.muted === 'boolean' ? v.muted : false,
      };
    }
  } catch {
    // ignore: use defaults
  }
  return { volume: 0.7, muted: false };
}

export class MusicPlayer extends Store<MusicState> {
  /** The playlist, in playing order. */
  readonly tracks: readonly Track[];
  /** One <audio> element, reused for every track (we just change its `src`). It never joins the page. */
  private audio: HTMLAudioElement;
  /**
   * True while the user wants music: set by play(), cleared by pause(). Used to
   * decide whether switching track should keep playing, and to show "loading".
   */
  private wantsToPlay = false;

  constructor(tracks: readonly Track[]) {
    const { volume, muted } = loadVolume();
    super({
      status: 'idle',
      trackIndex: 0,
      duration: tracks[0]?.durationHint ?? 0,
      volume,
      muted,
      errorMessage: null,
    });
    this.tracks = tracks;
    this.audio = new Audio();
    // 'metadata' = download only the header (duration) until play is pressed — saves data.
    this.audio.preload = 'metadata';
    this.audio.volume = volume;
    this.audio.muted = muted;
    // The <audio> element tells us what happens through events; each one updates our state.
    this.audio.addEventListener('loadedmetadata', this.onMetadata);
    this.audio.addEventListener('playing', this.onPlaying);
    this.audio.addEventListener('pause', this.onPause);
    this.audio.addEventListener('waiting', this.onWaiting);
    this.audio.addEventListener('ended', this.onEnded);
    this.audio.addEventListener('error', this.onError);
    this.load(0);
  }

  // ───────────────────────── fast reads (no React render) ─────────────────────────

  /** Current playback position in seconds. */
  get currentTime(): number {
    return this.audio.currentTime || 0;
  }

  get track(): Track {
    return this.tracks[this.getSnapshot().trackIndex]!;
  }

  // ───────────────────────── commands ─────────────────────────

  /** Resume from the exact paused position (or start the current track). */
  /**
   * `audio.play()` returns a Promise that REJECTS if the browser blocks sound
   * (no user click yet) — `await` inside try/catch lets us handle that case.
   */
  async play(): Promise<void> {
    this.wantsToPlay = true;
    if (this.getSnapshot().status === 'error') this.load(this.getSnapshot().trackIndex);
    try {
      await this.audio.play();
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        this.wantsToPlay = false;
        this.set({ status: 'blocked' }); // autoplay policy: needs a user gesture
      } else if (error instanceof DOMException && error.name === 'AbortError') {
        // A newer load() interrupted this play(); not an error.
      } else {
        this.set({ status: 'error', errorMessage: 'This track could not be played.' });
      }
    }
  }

  /** Pause, keeping the exact position. */
  pause(): void {
    this.wantsToPlay = false;
    this.audio.pause(); // keeps currentTime — resume continues from here
  }

  /** Play ↔ pause (the round button, and the M key). */
  toggle(): void {
    if (this.getSnapshot().status === 'playing' || this.getSnapshot().status === 'loading') this.pause();
    else void this.play();
  }

  /** Explicit restart of the current track from 0:00. */
  restart(): void {
    this.seek(0);
    if (this.getSnapshot().status !== 'playing') void this.play();
  }

  /**
   * Jump inside the current track. Clamped just short of the end (0.05 s) so a
   * seek to the very end does not immediately fire "ended" and skip a song.
   */
  seek(seconds: number): void {
    const duration = this.getSnapshot().duration || this.audio.duration || 0;
    const t = Math.min(Math.max(seconds, 0), Math.max(0, duration - 0.05));
    if (Number.isFinite(t)) this.audio.currentTime = t;
  }

  /** Next track (wraps around to the first). */
  next(): void {
    this.selectTrack((this.getSnapshot().trackIndex + 1) % this.tracks.length);
  }

  previous(): void {
    // Like most players: if more than 3 s in, restart the track; otherwise go back one.
    if (this.audio.currentTime > 3) {
      this.seek(0);
      return;
    }
    const n = this.tracks.length;
    this.selectTrack((this.getSnapshot().trackIndex - 1 + n) % n);
  }

  /** Switch to a track; keeps playing if music was playing. */
  selectTrack(index: number): void {
    const keepPlaying = this.wantsToPlay;
    this.load(index);
    if (keepPlaying) void this.play();
  }

  /** Set the volume (0…1). Dragging to 0 counts as muted; any other value unmutes. */
  setVolume(volume: number): void {
    const v = Math.min(1, Math.max(0, volume));
    this.audio.volume = v;
    const muted = v === 0 ? true : false;
    this.audio.muted = muted;
    this.set({ volume: v, muted });
    this.saveVolume();
  }

  /** Mute ↔ unmute. */
  toggleMute(): void {
    const muted = !this.getSnapshot().muted;
    this.audio.muted = muted;
    // Unmuting at volume 0 would be confusing: restore a sensible level.
    if (!muted && this.getSnapshot().volume === 0) {
      this.audio.volume = 0.5;
      this.set({ muted, volume: 0.5 });
    } else {
      this.set({ muted });
    }
    this.saveVolume();
  }

  /** Stop and release the audio element (called when the app unmounts). */
  dispose(): void {
    this.audio.pause();
    this.audio.removeEventListener('loadedmetadata', this.onMetadata);
    this.audio.removeEventListener('playing', this.onPlaying);
    this.audio.removeEventListener('pause', this.onPause);
    this.audio.removeEventListener('waiting', this.onWaiting);
    this.audio.removeEventListener('ended', this.onEnded);
    this.audio.removeEventListener('error', this.onError);
    this.audio.removeAttribute('src');
    this.audio.load();
  }

  // ───────────────────────── internals ─────────────────────────

  /** Points the audio element at another track and resets the state for it. */
  private load(index: number): void {
    const track = this.tracks[index];
    if (!track) return;
    this.audio.src = assetUrl(track.src);
    this.set({
      trackIndex: index,
      duration: track.durationHint,
      status: this.wantsToPlay ? 'loading' : 'idle',
      errorMessage: null,
    });
  }

  /** Remembers volume/mute in localStorage (silently skipped if storage is unavailable). */
  private saveVolume(): void {
    try {
      const { volume, muted } = this.getSnapshot();
      localStorage.setItem(VOLUME_KEY, JSON.stringify({ volume, muted }));
    } catch {
      // ignore
    }
  }

  // ── <audio> event handlers (arrow functions so `this` is the player) ──

  /** The real duration is known: replace our hint with it. */
  private onMetadata = (): void => {
    if (Number.isFinite(this.audio.duration) && this.audio.duration > 0) this.set({ duration: this.audio.duration });
  };

  /** Sound really started (after buffering). */
  private onPlaying = (): void => this.set({ status: 'playing', errorMessage: null });

  /** Paused (by us or by the system); keep 'error'/'blocked' messages visible. */
  private onPause = (): void => {
    if (this.getSnapshot().status !== 'error' && this.getSnapshot().status !== 'blocked') this.set({ status: 'paused' });
  };

  /** Playback stalled waiting for data (slow connection). */
  private onWaiting = (): void => {
    if (this.wantsToPlay) this.set({ status: 'loading' });
  };

  private onEnded = (): void => {
    // Continue with the next song, looping the playlist like the original player.
    this.wantsToPlay = true;
    this.selectTrack((this.getSnapshot().trackIndex + 1) % this.tracks.length);
  };

  /** The file failed to load or decode. */
  private onError = (): void => {
    if (!this.audio.getAttribute('src')) return; // our own dispose() cleared it
    this.wantsToPlay = false;
    this.set({ status: 'error', errorMessage: `“${this.track.title}” could not be loaded.` });
  };
}
