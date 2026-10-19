/**
 * MusicPlayer tests. jsdom does not play audio, so we replace the few
 * HTMLMediaElement methods the player uses with tiny fakes that behave like a
 * browser: play() resolves (or rejects for the autoplay policy), pause() keeps
 * currentTime, and the right events fire.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SOUNDTRACK } from '../data/soundtrack';
import { MusicPlayer } from './MusicPlayer';

let blockAutoplay = false;

beforeEach(() => {
  blockAutoplay = false;
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
    if (blockAutoplay) return Promise.reject(new DOMException('blocked', 'NotAllowedError'));
    this.dispatchEvent(new Event('playing'));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
    this.dispatchEvent(new Event('pause'));
  });
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
});

afterEach(() => vi.restoreAllMocks());

describe('MusicPlayer', () => {
  it('starts with the first track of the original playlist order', () => {
    const player = new MusicPlayer(SOUNDTRACK);
    expect(player.track.title).toBe('Seasons');
    expect(player.getSnapshot().status).toBe('idle');
    player.dispose();
  });

  it('pause keeps the position and play resumes from it', async () => {
    const player = new MusicPlayer(SOUNDTRACK);
    await player.play();
    expect(player.getSnapshot().status).toBe('playing');
    // Simulate 42 s of playback.
    Object.defineProperty((player as unknown as { audio: HTMLAudioElement }).audio, 'currentTime', {
      value: 42,
      writable: true,
    });
    player.pause();
    expect(player.getSnapshot().status).toBe('paused');
    expect(player.currentTime).toBe(42);
    await player.play();
    expect(player.currentTime).toBe(42);
    player.dispose();
  });

  it('reports "blocked" when the browser refuses autoplay, instead of failing silently', async () => {
    blockAutoplay = true;
    const player = new MusicPlayer(SOUNDTRACK);
    await player.play();
    expect(player.getSnapshot().status).toBe('blocked');
    player.dispose();
  });

  it('next / previous wrap around the playlist', () => {
    const player = new MusicPlayer(SOUNDTRACK);
    player.previous(); // at 0:00 → goes to the last track
    expect(player.getSnapshot().trackIndex).toBe(SOUNDTRACK.length - 1);
    player.next();
    expect(player.getSnapshot().trackIndex).toBe(0);
    player.dispose();
  });

  it('continues with the next track when a song ends, looping like the original player', async () => {
    const player = new MusicPlayer(SOUNDTRACK);
    await player.play();
    const audio = (player as unknown as { audio: HTMLAudioElement }).audio;
    audio.dispatchEvent(new Event('ended'));
    expect(player.getSnapshot().trackIndex).toBe(1);
    player.dispose();
  });

  it('volume and mute are clamped and independent', () => {
    const player = new MusicPlayer(SOUNDTRACK);
    player.setVolume(2);
    expect(player.getSnapshot().volume).toBe(1);
    player.toggleMute();
    expect(player.getSnapshot().muted).toBe(true);
    player.toggleMute();
    expect(player.getSnapshot().muted).toBe(false);
    expect(player.getSnapshot().volume).toBe(1);
    player.dispose();
  });

  it('a loading error is reported with the track name', () => {
    const player = new MusicPlayer(SOUNDTRACK);
    const audio = (player as unknown as { audio: HTMLAudioElement }).audio;
    audio.dispatchEvent(new Event('error'));
    expect(player.getSnapshot().status).toBe('error');
    expect(player.getSnapshot().errorMessage).toContain('Seasons');
    player.dispose();
  });
});
