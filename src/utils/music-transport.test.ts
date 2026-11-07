import { afterEach, describe, expect, it, vi } from 'vitest';
import { MusicTransport } from './music-transport';

class FakeAudio extends EventTarget {
  duration: number;
  private time = 0;
  get currentTime(): number {
    return this.time;
  }
  set currentTime(value: number) {
    this.time = value;
    if (value < this.duration) this.ended = false;
  }
  readyState: number;
  volume = 1;
  ended = false;
  playCalls = 0;
  loadCalls = 0;
  pauseCalls = 0;
  rejectPlay = false;
  paused = true;

  constructor(duration: number, readyState = 3) {
    super();
    this.duration = duration;
    this.readyState = readyState;
  }

  play(): Promise<void> {
    this.playCalls += 1;
    if (this.rejectPlay) return Promise.reject(new Error('blocked'));
    this.paused = false;
    return Promise.resolve();
  }

  pause(): void {
    this.pauseCalls += 1;
    this.paused = true;
  }

  load(): void {
    this.loadCalls += 1;
  }

  canPlay(): void {
    this.readyState = 3;
    this.signal('canplay');
  }

  asElement(): HTMLAudioElement {
    return this as unknown as HTMLAudioElement;
  }

  signal(name: string): void {
    this.dispatchEvent(new Event(name));
  }
}

const elements = (...tracks: FakeAudio[]) =>
  tracks.map((track) => track.asElement());

afterEach(() => vi.useRealTimers());

describe('MusicTransport', () => {
  it('allows initial waiting events until every play promise has settled', async () => {
    const first = new FakeAudio(90);
    const second = new FakeAudio(90);
    first.play = async () => {
      first.paused = false;
      first.signal('waiting');
    };
    second.play = async () => {
      second.paused = false;
      second.signal('waiting');
    };
    const transport = new MusicTransport(elements(first, second), vi.fn());
    await transport.play();
    expect(transport.snapshot().playing).toBe(true);
    expect(transport.snapshot().error).toBeNull();
    expect(first.paused).toBe(false);
    expect(second.paused).toBe(false);
    transport.dispose();
  });

  it('plays all ready stems from one timeline, pauses, seeks, and stops', async () => {
    const long = new FakeAudio(90);
    const short = new FakeAudio(45);
    const changed = vi.fn();
    const transport = new MusicTransport(elements(long, short), changed);

    expect(transport.snapshot()).toEqual({
      playing: false,
      position: 0,
      duration: 90,
      error: null,
      loading: false,
    });
    expect(long.volume).toBe(0.5);
    expect(short.volume).toBe(0.5);

    transport.seek(12);
    await transport.play();
    expect(long.currentTime).toBe(12);
    expect(short.currentTime).toBe(12);
    expect(long.playCalls).toBe(1);
    expect(short.playCalls).toBe(1);
    expect(transport.snapshot().playing).toBe(true);

    transport.pause();
    expect(long.paused).toBe(true);
    expect(short.paused).toBe(true);
    expect(transport.snapshot().playing).toBe(false);
    transport.seek(7);
    expect(long.currentTime).toBe(7);
    expect(short.currentTime).toBe(7);
    transport.setVolume(0.6);
    expect(long.volume).toBeCloseTo(0.3);
    expect(short.volume).toBeCloseTo(0.3);

    transport.stop();
    expect(long.currentTime).toBe(0);
    expect(short.currentTime).toBe(0);
    expect(transport.snapshot().position).toBe(0);
    expect(changed).toHaveBeenCalled();
    transport.dispose();
  });

  it('waits for all stems and removes readiness listeners when paused', async () => {
    vi.useFakeTimers();
    const first = new FakeAudio(60, 0);
    const second = new FakeAudio(60, 0);
    const transport = new MusicTransport(elements(first, second), vi.fn(), {
      readyTimeoutMs: 30_000,
    });
    const playback = transport.play();
    expect(transport.snapshot().loading).toBe(true);
    first.canPlay();
    transport.pause();
    await playback;

    second.canPlay();
    expect(first.playCalls).toBe(0);
    expect(second.playCalls).toBe(0);
    expect(first.loadCalls).toBe(1);
    expect(second.loadCalls).toBe(1);
    expect(transport.snapshot().loading).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    transport.dispose();
  });

  it('waits for canplay rather than loadeddata', async () => {
    const track = new FakeAudio(30, 0);
    const transport = new MusicTransport(elements(track), vi.fn());
    const playback = transport.play();
    track.readyState = 2;
    track.signal('loadeddata');
    await Promise.resolve();
    expect(track.playCalls).toBe(0);
    expect(transport.snapshot().loading).toBe(true);
    track.canPlay();
    await playback;
    expect(track.playCalls).toBe(1);
    transport.dispose();
  });

  it('times out waiting for readiness with a retryable error', async () => {
    vi.useFakeTimers();
    const track = new FakeAudio(30, 0);
    const transport = new MusicTransport(elements(track), vi.fn(), {
      readyTimeoutMs: 30_000,
    });
    const playback = transport.play();
    await vi.advanceTimersByTimeAsync(30_000);
    await playback;

    expect(transport.snapshot().error).toMatch(/retry/i);
    expect(transport.snapshot().loading).toBe(false);
    expect(track.playCalls).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    transport.dispose();
  });

  it('stops the whole mix if one play call fails', async () => {
    const first = new FakeAudio(80);
    const second = new FakeAudio(80);
    second.rejectPlay = true;
    const transport = new MusicTransport(elements(first, second), vi.fn());
    await transport.play();

    expect(first.paused).toBe(true);
    expect(second.paused).toBe(true);
    expect(transport.snapshot().playing).toBe(false);
    expect(transport.snapshot().error).toMatch(/all stems/i);
    transport.dispose();
  });

  it('pauses every stem on buffering and allows retry', async () => {
    const first = new FakeAudio(80);
    const second = new FakeAudio(80);
    const transport = new MusicTransport(elements(first, second), vi.fn());
    await transport.play();
    second.signal('waiting');

    expect(first.paused).toBe(true);
    expect(second.paused).toBe(true);
    expect(transport.snapshot().playing).toBe(false);
    expect(transport.snapshot().error).toMatch(/buffering/i);
    await transport.play();
    expect(first.playCalls).toBe(2);
    expect(second.playCalls).toBe(2);
    expect(transport.snapshot().playing).toBe(true);
    transport.dispose();
  });

  it('pauses when seeking during playback, ignores network stalled, and resumes at the seek point', async () => {
    const first = new FakeAudio(80);
    const second = new FakeAudio(80);
    const transport = new MusicTransport(elements(first, second), vi.fn());
    await transport.play();
    second.signal('stalled');
    expect(transport.snapshot().playing).toBe(true);

    transport.seek(20);
    expect(transport.snapshot().playing).toBe(false);
    expect(first.paused).toBe(true);
    expect(second.paused).toBe(true);
    expect(first.currentTime).toBe(20);
    expect(second.currentTime).toBe(20);
    await transport.play();
    expect(first.currentTime).toBe(20);
    expect(second.currentTime).toBe(20);
    expect(transport.snapshot().playing).toBe(true);
    transport.dispose();
  });

  it('reports an empty stream set and restarts from zero after reaching the end', async () => {
    const empty = new MusicTransport([], vi.fn());
    await empty.play();
    expect(empty.snapshot().error).toMatch(/no audio stems/i);
    empty.dispose();

    const track = new FakeAudio(10);
    const transport = new MusicTransport(elements(track), vi.fn(), {
      syncIntervalMs: 1,
    });
    await transport.play();
    track.currentTime = 10;
    track.ended = true;
    track.signal('ended');
    expect(transport.snapshot().playing).toBe(false);
    expect(transport.snapshot().position).toBe(10);
    await transport.play();
    expect(track.currentTime).toBe(0);
    expect(track.playCalls).toBe(2);
    expect(transport.snapshot().playing).toBe(true);
    transport.dispose();
  });

  it('corrects drift while playing and leaves a shorter stem silent after its end', async () => {
    vi.useFakeTimers();
    const long = new FakeAudio(100);
    const short = new FakeAudio(10);
    const transport = new MusicTransport(elements(long, short), vi.fn());
    await transport.play();

    long.currentTime = 5;
    short.currentTime = 4.7;
    await vi.advanceTimersByTimeAsync(250);
    expect(short.currentTime).toBe(5);

    long.currentTime = 11;
    short.currentTime = 10;
    short.ended = true;
    await vi.advanceTimersByTimeAsync(250);
    expect(short.playCalls).toBe(1);
    expect(short.currentTime).toBe(10);
    expect(long.paused).toBe(false);
    expect(transport.snapshot().playing).toBe(true);
    transport.dispose();
  });

  it('clears active playback timers and listeners on dispose', async () => {
    vi.useFakeTimers();
    const track = new FakeAudio(50);
    const changed = vi.fn();
    const transport = new MusicTransport(elements(track), changed);
    await transport.play();
    const notifications = changed.mock.calls.length;

    transport.dispose();
    await vi.advanceTimersByTimeAsync(1000);
    track.signal('waiting');
    expect(vi.getTimerCount()).toBe(0);
    expect(changed).toHaveBeenCalledTimes(notifications + 1);
    expect(track.paused).toBe(true);
  });
});
