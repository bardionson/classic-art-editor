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
};

const READY_STATE_FUTURE_DATA = 3;
const DRIFT_TOLERANCE_SECONDS = 0.12;

/** Coordinates HTML audio elements that share one composition timeline. */
export class MusicTransport {
  private readonly media: HTMLAudioElement[];
  private readonly onChange: (snapshot: MusicSnapshot) => void;
  private readonly readyTimeoutMs: number;
  private readonly syncIntervalMs: number;
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
        if (this.state.playing) void this.rebuffer();
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
      await Promise.all(
        this.media.map((element) =>
          this.waitUntilReady(element, token, reload),
        ),
      );
      if (!this.isCurrent(token)) return;

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

      await Promise.all(
        active.map((element) => Promise.resolve(element.play())),
      );
      if (!this.isCurrent(token)) {
        this.pauseAll();
        return;
      }
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

  private waitUntilReady(
    element: HTMLAudioElement,
    token: number,
    reload: boolean,
  ): Promise<void> {
    if (element.readyState >= READY_STATE_FUTURE_DATA) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        element.removeEventListener('canplay', onReady);
        element.removeEventListener('error', onError);
        const cancelIndex = this.readinessCancels.indexOf(cancel);
        if (cancelIndex !== -1) this.readinessCancels.splice(cancelIndex, 1);
        error ? reject(error) : resolve();
      };
      const onReady = () => {
        if (element.readyState >= READY_STATE_FUTURE_DATA) finish();
      };
      const onError = () => finish(new Error('A stem failed to load.'));
      const cancel = () => finish(new Error('Playback cancelled'));
      const timeout = setTimeout(
        () => finish(new Error('Timed out waiting for a stem to load.')),
        this.readyTimeoutMs,
      );
      this.readinessCancels.push(cancel);
      element.addEventListener('canplay', onReady, { once: true });
      element.addEventListener('error', onError, { once: true });
      try {
        element.preload = 'auto';
        if (reload) element.load();
      } catch {
        finish(new Error('Unable to load a stem.'));
      }
      if (!this.isCurrent(token)) cancel();
    });
  }

  private fail(message: string): void {
    ++this.generation;
    this.cancelReadiness();
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
