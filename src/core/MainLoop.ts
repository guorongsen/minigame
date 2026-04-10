/**
 * Fixed heartbeat driven by requestAnimationFrame.
 */
export class MainLoop {
  private running = false;
  private lastTime = 0;
  private rafId = 0;

  constructor(private readonly updateFn: (dt: number) => void, private readonly renderFn: () => void) {}

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.lastTime = Date.now();
    this.rafId = requestAnimationFrame(() => this.tick());
  }

  stop(): void {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  private tick(): void {
    if (!this.running) {
      return;
    }

    const now = Date.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;

    this.updateFn(dt);
    this.renderFn();

    this.rafId = requestAnimationFrame(() => this.tick());
  }
}
