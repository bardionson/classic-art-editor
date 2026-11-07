export type MusicSnapshot = {
  playing: boolean;
  position: number;
  duration: number;
  error: string | null;
  loading: boolean;
};

type MediaEvents =
  | 'canplay'
  | 'loadedmetadata'
  | 'durationchange'
  | 'timeupdate'
  | 'waiting'
  | 'error'
  | 'ended';

type TransportOptions = {
  readyTimeoutMs?: number;
  syncIntervalMs?: number;
  startWithPlay?: boolean;
};

const READY_STATE_FUTURE_DATA = 3;
const DRIFT_TOLERANCE_SECONDS = 0.12;
const BUFFER_AHEAD_SECONDS = 3;

/** Coordinates HTML audio elements that share one composition timeline. */
export class MusicTransport {
  private readonly media: HTMLAudioElement[];
  private readonly onChange: (snapshot: MusicSnapshot) => void;
  private readonly readyTimeoutMs: number;
  private readonly syncIntervalMs: number;
  private readonly startWithPlay: boolean;
  private readonly startupMuted = new Map<HTMLAudioElement, boolean>();
  private readonly listenerCleanup: (() => void)[] = [];
  private state: MusicSnapshot = {
    playing: false,
    position: 0,
    duration: 0,
    error: null,
    loading: false,
  };
  private leader: HTMLAudioElement | null = null;
  private generation = 0;
  private disposed = false;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private readonly readinessCancels: (() => void)[] = [];
  private pendingPlay: Promise<void> | null = null;

  constructor(
    media: HTMLAudioElement[],
    onChange: (snapshot: MusicSnapshot) => void,
    options: TransportOptions = {},
  ) {
    this.media = media;
    this.onChange = onChange;
    this.readyTimeoutMs = options.readyTimeoutMs ?? 30_000;
    this.syncIntervalMs = options.syncIntervalMs ?? 250;
    this.startWithPlay = options.startWithPlay ?? false;

    const perStemVolume = media.length ? 1 / media.length : 1;
    for (const element of media) element.volume = perStemVolume;

    for (const element of media) {
      const listen = (event: MediaEvents, handler: () => void) => {
        element.addEventListener(event, handler);
        this.listenerCleanup.push(() =>
          element.removeEventListener(event, handler),
        );
      };
      listen('loadedmetadata', () => this.refreshDuration());
      listen('durationchange', () => this.refreshDuration());
      listen('timeupdate', () => this.refreshPosition());
      listen('waiting', () => {
        if (this.state.playing && !element.ended) void this.rebuffer();
      });
      listen('error', () => {
        if (this.state.playing || this.state.loading) {
          this.fail('A stem failed to load. Press play to retry.');
        }
      });
      listen('ended', () => this.handleEnded());
    }
    this.refreshDuration(false);
    this.emit();
  }

  snapshot(): MusicSnapshot {
    return { ...this.state };
  }

  async play(): Promise<void> {
    if (this.disposed || this.state.playing) return;
    if (this.pendingPlay) return this.pendingPlay;
    if (this.media.length === 0) {
      this.state.error = 'No audio stems are available.';
      this.emit();
      return;
    }
    if (
      this.state.duration > 0 &&
      this.state.position >= this.state.duration - 0.05
    ) {
      this.state.position = 0;
      for (const element of this.media) this.safeSetTime(element, 0);
    }

    const token = ++this.generation;
    this.state.error = null;
    this.state.loading = true;
    this.emit();

    const operation = this.startPlayback(token).finally(() => {
      if (this.pendingPlay === operation) this.pendingPlay = null;
    });
    this.pendingPlay = operation;
    return operation;
  }

  pause(): void {
    if (this.disposed) return;
    ++this.generation;
    this.cancelReadiness();
    this.pendingPlay = null;
    this.clearSyncTimer();
    this.pauseAll();
    this.state.playing = false;
    this.state.loading = false;
    this.refreshPosition(false);
    this.emit();
  }

  seek(position: number): void {
    if (this.disposed || !Number.isFinite(position)) return;
    // Pausing on seek lets ended stems restart together on the next explicit play.
    if (this.state.playing || this.state.loading) this.pause();
    const target = Math.max(
      0,
      this.state.duration > 0
        ? Math.min(position, this.state.duration)
        : position,
    );
    this.state.position = target;
    for (const element of this.media) {
      const duration = this.validDuration(element.duration);
      if (duration !== null && target >= duration) {
        this.safeSetTime(element, duration);
        element.pause();
      } else {
        this.safeSetTime(element, target);
      }
    }
    this.selectLeader();
    this.emit();
  }

  /** Sets the mix level; each stem receives an equal share of the master gain. */
  setVolume(volume: number): void {
    if (this.disposed || !Number.isFinite(volume)) return;
    const perStemVolume =
      Math.max(0, Math.min(1, volume)) / Math.max(1, this.media.length);
    for (const element of this.media) element.volume = perStemVolume;
  }

  stop(): void {
    if (this.disposed) return;
    ++this.generation;
    this.cancelReadiness();
    this.pendingPlay = null;
    this.clearSyncTimer();
    this.pauseAll();
    for (const element of this.media) this.safeSetTime(element, 0);
    this.state = {
      ...this.state,
      playing: false,
      loading: false,
      position: 0,
      error: null,
    };
    this.emit();
  }

  dispose(): void {
    if (this.disposed) return;
    this.pause();
    this.disposed = true;
    for (const cleanup of this.listenerCleanup.splice(0)) cleanup();
  }

  private async rebuffer(): Promise<void> {
    this.refreshPosition(false);
    this.pauseAll();
    this.clearSyncTimer();
    this.state.playing = false;
    this.state.loading = true;
    this.state.error = null;
    const token = ++this.generation;
    this.emit();
    // Retain already downloaded bytes and resume the complete mix together.
    const operation = this.startPlayback(token, false).finally(() => {
      if (this.pendingPlay === operation) this.pendingPlay = null;
    });
    this.pendingPlay = operation;
    await operation;
  }

  private async startPlayback(token: number, reload = true): Promise<void> {
    try {
      this.refreshDuration(false);
      this.selectLeader();
      const position = this.state.position;
      const active = this.media.filter((element) => {
        const duration = this.validDuration(element.duration);
        if (duration !== null && position >= duration) {
          this.safeSetTime(element, duration);
          element.pause();
          return false;
        }
        this.safeSetTime(element, position);
        return true;
      });

      if (active.length === 0) {
        this.state.playing = false;
        this.state.loading = false;
        this.emit();
        return;
      }

      if (this.startWithPlay) {
        // iOS may not preload audio until play() is called directly from a tap.
        // Issue EVERY play request before the first await. Keep early starters
        // silent until the slowest stem starts, then align the complete mix.
        for (const element of active) {
          element.preload = 'auto';
          this.startupMuted.set(element, element.muted);
          element.muted = true;
        }
        await this.waitForPlay(active, token);
        if (!this.isCurrent(token)) return;
        for (const element of active) this.safeSetTime(element, position);
        await this.waitForPlay(active, token);
      } else {
        // Align before waiting: seeking after readiness can empty a stem's buffer.
        await Promise.all(
          active.map((element) =>
            this.waitUntilReady(element, token, reload, position),
          ),
        );
        if (!this.isCurrent(token)) return;
        await this.waitForPlay(active, token);
      }
      if (!this.isCurrent(token)) {
        // An old play promise must not pause a newer seek/restart operation.
        if (!this.state.playing && !this.state.loading) this.pauseAll();
        return;
      }
      this.restoreStartupMute();
      this.state.playing = true;
      this.state.loading = false;
      this.emit();
      this.startSyncTimer();
    } catch (error) {
      if (!this.isCurrent(token)) return;
      const message =
        error instanceof Error && error.message === 'Playback cancelled'
          ? null
          : error instanceof Error && error.name === 'NotAllowedError'
            ? 'The browser blocked playback. Tap play to retry.'
            : error instanceof Error &&
                error.message === 'Playback start timed out'
              ? 'Audio did not start in time. Tap play to retry.'
              : 'Unable to start all stems. Press play to retry.';
      if (message) this.fail(message);
      else {
        this.pauseAll();
        this.state.playing = false;
        this.state.loading = false;
        this.clearSyncTimer();
        this.emit();
      }
    }
  }

  private waitForPlay(
    elements: HTMLAudioElement[],
    token: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error?: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        const index = this.readinessCancels.indexOf(cancel);
        if (index !== -1) this.readinessCancels.splice(index, 1);
        error ? reject(error) : resolve();
      };
      const cancel = () => finish(new Error('Playback cancelled'));
      const timeout = setTimeout(
        () => finish(new Error('Playback start timed out')),
        this.readyTimeoutMs,
      );
      this.readinessCancels.push(cancel);
      // Catch synchronous failures per element so every stem gets the gesture.
      const starts = elements.map((element) => {
        try {
          return Promise.resolve(element.play());
        } catch (error) {
          return Promise.reject(error);
        }
      });
      Promise.all(starts).then(() => finish(), finish);
      if (!this.isCurrent(token)) cancel();
    });
  }

  private restoreStartupMute(): void {
    this.startupMuted.forEach((muted, element) => {
      element.muted = muted;
    });
    this.startupMuted.clear();
  }

  private waitUntilReady(
    element: HTMLAudioElement,
    token: number,
    reload: boolean,
    position: number,
  ): Promise<void> {
    // Even an initially playable element may still be in metadata-only mode.
    // Keep filling buffers while the mix pauses to wait for another stem.
    element.preload = 'auto';
    if (this.hasPlaybackBuffer(element)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        clearInterval(poll);
        for (const event of readyEvents)
          element.removeEventListener(event, onReady);
        element.removeEventListener('error', onError);
        const cancelIndex = this.readinessCancels.indexOf(cancel);
        if (cancelIndex !== -1) this.readinessCancels.splice(cancelIndex, 1);
        error ? reject(error) : resolve();
      };
      const readyEvents = [
        'canplay',
        'canplaythrough',
        'progress',
        'loadedmetadata',
        'seeked',
      ];
      const onReady = () => {
        if (element.readyState >= 1) this.safeSetTime(element, position);
        if (this.hasPlaybackBuffer(element)) finish();
      };
      const onError = () => finish(new Error('A stem failed to load.'));
      const cancel = () => finish(new Error('Playback cancelled'));
      const timeout = setTimeout(
        () => finish(new Error('Timed out waiting for a stem to load.')),
        this.readyTimeoutMs,
      );
      const poll = setInterval(onReady, 250);
      this.readinessCancels.push(cancel);
      for (const event of readyEvents) element.addEventListener(event, onReady);
      element.addEventListener('error', onError, { once: true });
      try {
        // Calling load() discards buffered bytes. Only reset failed/empty sources.
        if (
          reload &&
          (element.error ||
            element.networkState === 3 ||
            (element.readyState === 0 && element.networkState !== 2))
        )
          element.load();
      } catch {
        finish(new Error('Unable to load a stem.'));
      }
      if (!this.isCurrent(token)) cancel();
    });
  }

  private hasPlaybackBuffer(element: HTMLAudioElement): boolean {
    // HAVE_ENOUGH_DATA is the browser's can-play-through assessment. Some
    // engines expose no buffered ranges until playback starts for these files.
    if (element.readyState >= 4) return true;
    if (element.readyState < READY_STATE_FUTURE_DATA) return false;
    const duration = this.validDuration(element.duration);
    const required = Math.min(
      BUFFER_AHEAD_SECONDS,
      duration === null
        ? BUFFER_AHEAD_SECONDS
        : Math.max(0, duration - element.currentTime),
    );
    for (let i = 0; i < element.buffered.length; i++) {
      if (
        element.buffered.start(i) <= element.currentTime + 0.05 &&
        element.buffered.end(i) - element.currentTime >= required - 0.05
      )
        return true;
    }
    return false;
  }

  private fail(message: string): void {
    ++this.generation;
    this.cancelReadiness();
    this.pendingPlay = null;
    this.clearSyncTimer();
    this.pauseAll();
    this.state.playing = false;
    this.state.loading = false;
    this.state.error = message;
    this.refreshPosition(false);
    this.emit();
  }

  private refreshDuration(emit = true): void {
    const durations = this.media
      .map((element) => this.validDuration(element.duration))
      .filter((duration): duration is number => duration !== null);
    this.state.duration = durations.length ? Math.max(...durations) : 0;
    this.selectLeader();
    if (emit) this.emit();
  }

  private refreshPosition(emit = true): void {
    const position =
      this.leader && Number.isFinite(this.leader.currentTime)
        ? this.leader.currentTime
        : this.state.position;
    this.state.position = Math.max(
      0,
      Math.min(position, this.state.duration || position),
    );
    if (emit) this.emit();
  }

  private selectLeader(): void {
    let best: HTMLAudioElement | null = null;
    let bestDuration = -1;
    for (const element of this.media) {
      const duration = this.validDuration(element.duration);
      if (duration !== null && duration > bestDuration) {
        best = element;
        bestDuration = duration;
      }
    }
    this.leader = best ?? this.media[0] ?? null;
  }

  private startSyncTimer(): void {
    this.clearSyncTimer();
    this.syncTimer = setInterval(() => this.syncTick(), this.syncIntervalMs);
  }

  private syncTick(): void {
    if (!this.state.playing || this.disposed) return;
    this.refreshDuration(false);
    this.refreshPosition(false);
    const target = this.state.position;
    for (const element of this.media) {
      if (element === this.leader || element.ended) continue;
      const duration = this.validDuration(element.duration);
      if (duration !== null && target >= duration) {
        element.pause();
        continue;
      }
      if (Math.abs(element.currentTime - target) > DRIFT_TOLERANCE_SECONDS) {
        this.safeSetTime(element, target);
      }
    }
    if (
      (this.state.duration > 0 && target >= this.state.duration - 0.05) ||
      (this.media.length > 0 && this.media.every((element) => element.ended))
    ) {
      this.finish();
      return;
    }
    this.emit();
  }

  private handleEnded(): void {
    this.refreshPosition(false);
    if (
      this.state.duration > 0 &&
      this.state.position >= this.state.duration - 0.05
    )
      this.finish();
    else this.emit();
  }

  private finish(): void {
    this.clearSyncTimer();
    this.pauseAll();
    this.state.playing = false;
    this.state.loading = false;
    if (this.state.duration > 0) this.state.position = this.state.duration;
    this.emit();
  }

  private cancelReadiness(): void {
    for (const cancel of [...this.readinessCancels]) cancel();
    this.readinessCancels.length = 0;
  }

  private clearSyncTimer(): void {
    if (this.syncTimer !== null) clearInterval(this.syncTimer);
    this.syncTimer = null;
  }

  private pauseAll(): void {
    for (const element of this.media) element.pause();
    this.restoreStartupMute();
  }

  private safeSetTime(element: HTMLAudioElement, position: number): void {
    try {
      if (Math.abs(element.currentTime - position) > 0.01)
        element.currentTime = position;
    } catch {
      // Some media elements reject seeking until metadata is available.
    }
  }

  private validDuration(value: number): number | null {
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  private isCurrent(token: number): boolean {
    return !this.disposed && token === this.generation;
  }

  private emit(): void {
    if (!this.disposed) this.onChange(this.snapshot());
  }
}
